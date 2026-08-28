import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  attachVideoRenderExecutionSlot,
  attachWorkerExecutionToBackgroundJob,
  claimVideoRenderExecutionSlot,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  releaseVideoRenderExecutionSlot,
} from "@/lib/jobs/background-jobs";
import {
  getMissingCloudRunRenderJobEnvVars,
  launchBackgroundRenderJob,
} from "@/lib/jobs/gcp-cloud-run-jobs";
import type { BackgroundJobTaskPayload } from "@/lib/jobs/gcp-cloud-tasks-logic";
import {
  getMissingCloudTasksOidcEnvVars,
  verifyCloudTasksOidcRequest,
} from "@/lib/scheduling/cloud-tasks-oidc-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;

export async function POST(request: Request) {
  const missingEnv = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingCloudTasksOidcEnvVars(),
      ...getMissingCloudRunRenderJobEnvVars(),
    ]),
  );

  if (missingEnv.length > 0) {
    console.error("Cloud Run render launcher is not configured", { missingEnv });
    return json({ ok: false, error: "Render launcher is not configured." }, 503);
  }

  const audience =
    process.env.GCP_BACKGROUND_JOB_TASK_AUDIENCE?.trim() ||
    new URL(request.url).origin;
  const authorized = await verifyCloudTasksOidcRequest({
    audience,
    authorization: request.headers.get("authorization"),
  });

  if (!authorized) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, error: "Invalid task payload." }, 400);
  }

  const payload = parseTaskPayload(rawBody);

  if (!payload) {
    return json({ ok: false, error: "Invalid task payload." }, 400);
  }

  const job = await getBackgroundJobById(payload.jobId);

  if (!job) {
    return json({ ok: true, dropped: true });
  }

  if (job.jobType !== payload.jobType || job.queueName !== "video-render") {
    return json({ ok: false, error: "Task does not match the render job." }, 400);
  }

  if (["cancelled", "completed", "failed"].includes(job.status)) {
    return json({ ok: true, jobId: job.id, status: job.status });
  }

  const renderClaimToken = randomUUID();
  const renderSlot = await claimVideoRenderExecutionSlot({
    claimToken: renderClaimToken,
    jobId: job.id,
  });

  if (!renderSlot) {
    // All ten durable render slots are busy. A non-2xx response leaves the
    // Cloud Task available for retry; no render is silently dropped.
    return json({ ok: false, error: "Render capacity is temporarily full." }, 503);
  }

  if (!renderSlot.should_launch) {
    if (!renderSlot.is_launched) {
      // A different launcher has the fresh lease but has not yet recorded its
      // Cloud Run execution. Keep this delivery retryable instead of acking a
      // crash-window gap.
      return json({ ok: false, error: "Render launch is being confirmed." }, 503);
    }

    return json({
      jobId: job.id,
      ok: true,
      slotNumber: renderSlot.slot_number,
      status: "already_launched",
    });
  }

  try {
    const execution = await launchBackgroundRenderJob(job);

    await attachWorkerExecutionToBackgroundJob({
      jobId: job.id,
      workerExecutionId: execution.executionName,
    }).catch((error) => {
      console.error("Render execution launched before metadata attachment failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        executionName: execution.executionName,
        jobId: job.id,
      });
    });

    const slotAttached = await attachVideoRenderExecutionSlot({
      claimToken: renderClaimToken,
      jobId: job.id,
      workerExecutionId: execution.executionName,
    }).catch((error) => {
      console.error("Render execution launched before slot attachment failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        executionName: execution.executionName,
        jobId: job.id,
      });
      return false;
    });

    if (!slotAttached) {
      // Do not acknowledge this Cloud Task yet. The launched execution owns a
      // fresh slot lease, so a retry will wait to confirm it rather than launch
      // another render. If it never started, the lease eventually becomes
      // eligible for one safe recovery launch.
      return json({ ok: false, error: "Render launch is being confirmed." }, 503);
    }

    return json(
      {
        executionName: execution.executionName,
        jobId: job.id,
        ok: true,
        status: "launched",
      },
      202,
    );
  } catch (error) {
    await releaseVideoRenderExecutionSlot({
      claimToken: renderClaimToken,
      jobId: job.id,
    }).catch((releaseError) => {
      console.error("Could not release failed render slot claim", {
        error: releaseError instanceof Error ? releaseError.message : "Unknown error",
        jobId: job.id,
      });
    });
    console.error("Could not launch background render job", {
      error: error instanceof Error ? error.message : "Unknown error",
      jobId: job.id,
    });
    return json({ ok: false, error: "Could not launch the render job." }, 503);
  }
}

function parseTaskPayload(rawBody: string): BackgroundJobTaskPayload | null {
  try {
    const value = JSON.parse(rawBody) as Partial<BackgroundJobTaskPayload>;

    return value &&
      value.schemaVersion === 1 &&
      typeof value.attempt === "number" &&
      typeof value.jobId === "string" &&
      typeof value.jobType === "string"
      ? (value as BackgroundJobTaskPayload)
      : null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
