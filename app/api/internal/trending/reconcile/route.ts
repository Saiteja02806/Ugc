import { NextResponse } from "next/server";

import {
  getMissingBusinessProfileEnvVars,
} from "@/lib/business-profiles/db";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import { reconcileCompletedTrendingFeedForUser } from "@/lib/trending/reconcile-completed-feed";
import { getMissingUnifiedTrendingFeedEnvVars } from "@/lib/trending/unified-daily-feed-db";
import { claimDueTrendingFeedReconciliations, completeTrendingFeedReconciliation,
  getTrendingFeedReconciliationStatus, rescheduleTrendingFeedReconciliation } from "@/lib/trending/unified-daily-feed-db";
import { verifyCloudTasksOidcRequest } from "@/lib/scheduling/cloud-tasks-oidc-auth";
import { getBackgroundJobById } from "@/lib/jobs/background-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_BODY_LENGTH = 4_096;

export async function POST(request: Request) {
  const missing = [
    ...new Set([
      ...getMissingBusinessProfileEnvVars(),
      ...getMissingInternalFinalizationEnvVars(),
      ...getMissingUnifiedTrendingFeedEnvVars(),
    ]),
  ];

  if (missing.length > 0) {
    console.error("Trending reconciliation is not configured", { missing });
    return json({ ok: false, message: "Trending reconciliation is unavailable." }, 503);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Invalid request body." }, 400);
  }

  const signedWorkerRequest = verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    });
  const audience = new URL(request.url);
  audience.search = "";
  audience.hash = "";
  const cloudTaskRequest = !signedWorkerRequest && await verifyCloudTasksOidcRequest({
    audience: process.env.GCP_TRENDING_RECONCILIATION_AUDIENCE?.trim() || audience.toString(),
    authorization: request.headers.get("authorization"),
  });
  if (!signedWorkerRequest && !cloudTaskRequest) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  const input = parseInput(rawBody);

  if (!input) {
    return json({ ok: false, message: "Invalid Trending reconciliation input." }, 400);
  }

  try {
    if (cloudTaskRequest) {
      const job = await getBackgroundJobById(input.sourceJobId);
      if (!job || job.userId !== input.userId || !["completed", "failed", "cancelled"].includes(job.status)) {
        return json({ ok: false, message: "Invalid reconciliation source." }, 403);
      }
      const [claim] = await claimDueTrendingFeedReconciliations({ sourceJobId: job.id, limit: 1 });
      if (!claim) {
        const status = await getTrendingFeedReconciliationStatus(job.id);
        return status === null || status === "completed"
          ? json({ ok: true, skipped: true, sourceJobId: job.id })
          : json({ ok: false, message: "Reconciliation is waiting for its claim." }, 503);
      }
      try {
        const result = await reconcileCompletedTrendingFeedForUser(claim.userId);
        const completed = await completeTrendingFeedReconciliation({ sourceJobId: claim.sourceJobId });
        if (!completed) return json({ ok: false, message: "Reconciliation claim expired." }, 503);
        return json({ ok: true, ...result, sourceJobId: claim.sourceJobId });
      } catch (error) {
        await rescheduleTrendingFeedReconciliation({ sourceJobId: claim.sourceJobId,
          message: error instanceof Error ? error.message : "Reconciliation failed." });
        throw error;
      }
    }
    const result = await reconcileCompletedTrendingFeedForUser(input.userId);

    return json({
      feedId: result.feedId,
      ok: true,
      skipped: result.skipped,
      sourceJobId: input.sourceJobId,
    });
  } catch (error) {
    console.error("Could not reconcile completed Trending work:", {
      error,
      sourceJobId: input.sourceJobId,
      userId: input.userId,
    });
    return json(
      { ok: false, message: "Trending reconciliation failed." },
      500,
    );
  }
}

function parseInput(rawBody: string) {
  try {
    const value = JSON.parse(rawBody) as Record<string, unknown>;
    const sourceJobId = getString(value.sourceJobId, 64);
    const userId = getString(value.userId, 128);

    return sourceJobId && userId ? { sourceJobId, userId } : null;
  } catch {
    return null;
  }
}

function getString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() && value.length <= maxLength
    ? value.trim()
    : "";
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
