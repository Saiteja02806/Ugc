import { NextResponse } from "next/server";

import { enqueueAnalyticsSyncJob } from "@/lib/analytics/jobs";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import { getInstagramContentSnapshotForOwner } from "@/lib/analytics/instagram-snapshots";
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
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({
      message:
        status === 401
          ? "Sign in before viewing Instagram content performance."
          : "Could not verify your sign-in session.",
      ok: false,
    }, status);
  }

  const body = await request.json().catch(() => null) as {
    days?: unknown;
    force?: unknown;
  } | null;
  const days = Number(body?.days);
  const force = body?.force === true;

  if (!supportedRanges.has(days as InstagramInsightsRangeDays)) {
    return json({ message: "Choose a supported Instagram content date range.", ok: false }, 400);
  }

  let snapshot;

  try {
    snapshot = await getInstagramContentSnapshotForOwner({
      days: days as InstagramInsightsRangeDays,
      userId,
    });
  } catch (error) {
    console.error("Could not read Instagram content snapshots:", error);
    return json({ message: "Could not read saved Instagram analytics.", ok: false }, 500);
  }

  const data = {
    accounts: snapshot.accounts,
    days,
    operation: "instagram_content",
  };

  if (!force && snapshot.hasSnapshot && !snapshot.needsRefresh) {
    return json({ data, ok: true, refreshing: false });
  }

  const missing = Array.from(new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingBackgroundJobCloudTasksEnvVars(["analytics_sync"]),
  ]));

  if (missing.length > 0) {
    if (snapshot.hasSnapshot) {
      return json({
        data,
        message: "Saved analytics are shown, but background refresh is not configured.",
        ok: true,
        refreshing: false,
      });
    }

    return json({ message: `Analytics jobs are not configured. Add ${missing.join(", ")}.`, ok: false }, 501);
  }

  try {
    const job = await enqueueAnalyticsSyncJob({
      days: days as InstagramInsightsRangeDays,
      force,
      idempotencyKey: request.headers.get("Idempotency-Key")?.trim().slice(0, 200) || null,
      operation: "instagram_content",
      userId,
    });
    return json({
      ...(snapshot.hasSnapshot ? { data } : {}),
      job: getPublicBackgroundJob(job),
      jobId: job.id,
      ok: true,
      refreshing: job.status !== "completed",
    }, snapshot.hasSnapshot || job.status === "completed" ? 200 : 202);
  } catch (error) {
    console.error("Could not queue Instagram content synchronization:", error);
    return json({ message: "Could not start Instagram content synchronization.", ok: false }, 502);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}
