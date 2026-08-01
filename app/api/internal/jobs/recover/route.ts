import { NextResponse } from "next/server";

import {
  attachQueueMessageToBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  listRecoverableBackgroundJobs,
  recoverBackgroundJob,
} from "@/lib/jobs/background-jobs";
import { enqueueBackgroundJobCloudTask } from "@/lib/jobs/gcp-cloud-tasks";
import {
  getMissingCloudTasksOidcEnvVars,
  verifyCloudTasksOidcRequest,
} from "@/lib/scheduling/cloud-tasks-oidc-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const missing = [
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingCloudTasksOidcEnvVars(),
  ];

  if (missing.length > 0) {
    console.error("Background job recovery is not configured", { missing });
    return json({ ok: false, error: "Recovery is not configured." }, 503);
  }

  const audience = getRequestAudience(request.url);
  const authorized = await verifyCloudTasksOidcRequest({
    audience,
    authorization: request.headers.get("authorization"),
  });

  if (!authorized) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const limit = clampInteger(url.searchParams.get("limit"), 100, 1, 500);
  const staleAfterSeconds = clampInteger(
    url.searchParams.get("staleAfterSeconds"),
    900,
    60,
    43_200,
  );

  try {
    const staleJobs = await listRecoverableBackgroundJobs({
      limit,
      staleAfterSeconds,
    });
    const results = [];

    for (const staleJob of staleJobs) {
      try {
        const recovered = await recoverBackgroundJob(staleJob.id);

        if (!recovered) {
          results.push({ jobId: staleJob.id, result: "skipped" });
          continue;
        }

        if (recovered.status !== "queued") {
          results.push({
            jobId: recovered.id,
            result: recovered.status,
          });
          continue;
        }

        const delivery = await enqueueBackgroundJobCloudTask(recovered);

        try {
          await attachQueueMessageToBackgroundJob({
            jobId: recovered.id,
            queueMessageId: delivery.messageId,
          });
        } catch (error) {
          console.error("Recovered Cloud Task metadata was not attached:", {
            error: getErrorMessage(error),
            jobId: recovered.id,
            taskName: delivery.messageId,
          });
        }

        results.push({
          jobId: recovered.id,
          result: "redispatched",
          taskName: delivery.messageId,
        });
      } catch (error) {
        console.error("Background job recovery item failed:", {
          error: getErrorMessage(error),
          jobId: staleJob.id,
        });
        results.push({
          error: "recovery_failed",
          jobId: staleJob.id,
          result: "failed",
        });
      }
    }

    return json({
      inspected: staleJobs.length,
      ok: true,
      results,
    });
  } catch (error) {
    console.error("Background job recovery scan failed:", error);
    return json({ ok: false, error: "Recovery scan failed." }, 500);
  }
}

function clampInteger(
  rawValue: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number.parseInt(rawValue || "", 10);

  return Number.isFinite(value) ? Math.max(min, Math.min(value, max)) : fallback;
}

function getRequestAudience(requestUrl: string) {
  const explicitAudience = process.env.GCP_JOB_RECOVERY_AUDIENCE?.trim();

  if (explicitAudience) {
    return explicitAudience;
  }

  const url = new URL(requestUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
