import { NextResponse } from "next/server";

import { enqueueAnalyticsSyncJob } from "@/lib/analytics/jobs";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import {
  FirebaseAuthRequestError,
} from "@/lib/firebase/server-auth";
import { BillingAccessError } from "@/lib/billing/subscription-db";
import { requireActivePaidUser } from "@/lib/billing/server-access";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedRanges = new Set<InstagramInsightsRangeDays>([7, 30, 90]);

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireActivePaidUser(request)).user.uid;
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError || error instanceof BillingAccessError
        ? error.status
        : 500;
    return json({
      message:
        error instanceof BillingAccessError
          ? error.message
          : status === 401
            ? "Sign in before viewing Instagram content performance."
            : "Could not verify your sign-in session.",
      ok: false,
    }, status);
  }

  const body = await request.json().catch(() => null) as { days?: unknown } | null;
  const days = Number(body?.days);

  if (!supportedRanges.has(days as InstagramInsightsRangeDays)) {
    return json({ message: "Choose a supported Instagram content date range.", ok: false }, 400);
  }

  const missing = Array.from(new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingBackgroundJobCloudTasksEnvVars(["analytics_sync"]),
  ]));

  if (missing.length > 0) {
    return json({ message: `Analytics jobs are not configured. Add ${missing.join(", ")}.`, ok: false }, 501);
  }

  try {
    const job = await enqueueAnalyticsSyncJob({
      days: days as InstagramInsightsRangeDays,
      idempotencyKey: request.headers.get("Idempotency-Key")?.trim().slice(0, 200) || null,
      operation: "instagram_content",
      userId,
    });
    return json({ job: getPublicBackgroundJob(job), jobId: job.id, ok: true }, job.status === "completed" ? 200 : 202);
  } catch (error) {
    console.error("Could not queue Instagram content synchronization:", error);
    return json({ message: "Could not start Instagram content synchronization.", ok: false }, 502);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}
