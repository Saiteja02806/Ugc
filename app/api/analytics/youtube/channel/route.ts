import { NextResponse } from "next/server";

import { enqueueAnalyticsSyncJob } from "@/lib/analytics/jobs";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import { hasYouTubeBetaAccess } from "@/lib/social/youtube-beta-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let userId: string;
  let user: Awaited<ReturnType<typeof requireFirebaseUser>>;

  try {
    user = await requireFirebaseUser(request);
    userId = user.uid;
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json(
      {
        message:
          status === 401
            ? "Sign in before viewing YouTube analytics."
            : "Could not verify your sign-in session.",
        ok: false,
      },
      status,
    );
  }

  if (!hasYouTubeBetaAccess(user)) {
    return json(
      {
        code: "youtube_beta_access_required",
        message: "YouTube analytics are not enabled for this account.",
        ok: false,
      },
      403,
    );
  }

  const missing = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingBackgroundJobCloudTasksEnvVars(["analytics_sync"]),
    ]),
  );

  if (missing.length > 0) {
    return json(
      {
        message: `Analytics jobs are not configured. Add ${missing.join(", ")}.`,
        ok: false,
      },
      501,
    );
  }

  try {
    const job = await enqueueAnalyticsSyncJob({
      idempotencyKey:
        request.headers.get("Idempotency-Key")?.trim().slice(0, 200) || null,
      operation: "youtube_channel",
      userId,
    });
    return json(
      { job: getPublicBackgroundJob(job), jobId: job.id, ok: true },
      job.status === "completed" ? 200 : 202,
    );
  } catch (error) {
    console.error("Could not queue YouTube analytics synchronization:", error);
    return json(
      { message: "Could not start YouTube analytics synchronization.", ok: false },
      502,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
