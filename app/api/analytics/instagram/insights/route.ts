import { NextResponse } from "next/server";

import {
  enqueueAnalyticsSyncJob,
} from "@/lib/analytics/jobs";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedRanges = new Set<InstagramInsightsRangeDays>([7, 30, 90]);

export async function POST(request: Request) {
  const auth = await authenticate(request);

  if (auth.response) {
    return auth.response;
  }

  const body = await request.json().catch(() => null) as { days?: unknown } | null;
  const days = Number(body?.days);

  if (!supportedRanges.has(days as InstagramInsightsRangeDays)) {
    return json({ message: "Choose a supported Instagram insight date range.", ok: false }, 400);
  }

  return queueJob({
    days: days as InstagramInsightsRangeDays,
    idempotencyKey: request.headers.get("Idempotency-Key"),
    operation: "instagram_insights",
    userId: auth.userId,
  });
}

async function authenticate(request: Request) {
  try {
    return { response: null, userId: (await requireFirebaseUser(request)).uid };
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return {
      response: json({
        message:
          status === 401
            ? "Sign in before viewing Instagram insights."
            : "Could not verify your sign-in session.",
        ok: false,
      }, status),
      userId: "",
    };
  }
}

async function queueJob(params: {
  days: InstagramInsightsRangeDays;
  idempotencyKey: string | null;
  operation: "instagram_insights";
  userId: string;
}) {
  const missing = Array.from(new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingBackgroundJobCloudTasksEnvVars(["analytics_sync"]),
  ]));

  if (missing.length > 0) {
    return json({ message: `Analytics jobs are not configured. Add ${missing.join(", ")}.`, ok: false }, 501);
  }

  try {
    const job = await enqueueAnalyticsSyncJob({
      days: params.days,
      idempotencyKey: params.idempotencyKey?.trim().slice(0, 200) || null,
      operation: params.operation,
      userId: params.userId,
    });
    return json({ job: getPublicBackgroundJob(job), jobId: job.id, ok: true }, job.status === "completed" ? 200 : 202);
  } catch (error) {
    console.error("Could not queue Instagram insights synchronization:", error);
    return json({ message: "Could not start Instagram insights synchronization.", ok: false }, 502);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}
