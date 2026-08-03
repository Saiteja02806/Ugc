import { NextResponse } from "next/server";

import { requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import {
  assertBackgroundJobOwner,
  retryAndDispatchBackgroundJob,
} from "@/lib/jobs/background-job-service";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const [user, params] = await Promise.all([
      requireFirebaseUser(request),
      context.params,
    ]);
    const existing = await assertBackgroundJobOwner({
      jobId: params.jobId,
      userId: user.uid,
    });

    if (!existing) {
      return json({ ok: false, error: "Job was not found." }, 404);
    }

    const missing = getMissingBackgroundJobCloudTasksEnvVars([
      existing.jobType,
    ]);

    if (missing.length > 0) {
      return json({ ok: false, error: `Job dispatch is not configured. Add ${missing.join(", ")}.` }, 501);
    }

    const job = await retryAndDispatchBackgroundJob({
      jobId: existing.id,
      userId: user.uid,
    });

    if (!job) {
      return json({ ok: false, error: "Job was not found." }, 404);
    }

    return json({ ok: true, job: getPublicBackgroundJob(job) }, 202);
  } catch (error) {
    const status = getAuthStatus(error);

    if (status) {
      return json({ ok: false, error: "Sign in to retry this job." }, status);
    }

    console.error("Failed to retry background job:", error);
    return json({ ok: false, error: "Could not retry the job." }, 409);
  }
}

function getAuthStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? Number((error as { status: unknown }).status) || null
    : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
