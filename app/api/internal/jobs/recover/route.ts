import { NextResponse } from "next/server";

import {
  attachQueueMessageToBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  listRecoverableBackgroundJobs,
  recoverBackgroundJob,
} from "@/lib/jobs/background-jobs";
import { enqueueBackgroundJobCloudTask } from "@/lib/jobs/gcp-cloud-tasks";
import {
  getMissingBusinessProfileEnvVars,
} from "@/lib/business-profiles/db";
import {
  getMissingCloudTasksOidcEnvVars,
  verifyCloudTasksOidcRequest,
} from "@/lib/scheduling/cloud-tasks-oidc-auth";
import { reconcileCompletedTrendingFeedForUser } from "@/lib/trending/reconcile-completed-feed";
import {
  claimDueTrendingFeedReconciliations,
  completeTrendingFeedReconciliation,
  getMissingUnifiedTrendingFeedEnvVars,
  listCurrentTrendingFeedIntegrityRepairs,
  rescheduleTrendingFeedReconciliation,
} from "@/lib/trending/unified-daily-feed-db";
import {
  claimDueTrendingHookGenerationChunkDispatches,
  completeTrendingHookGenerationChunkDispatch,
  rescheduleTrendingHookGenerationChunkDispatch,
} from "@/lib/trending/trending-hook-generation-runs";

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
  const trendingMissing = [
    ...new Set([
      ...getMissingBusinessProfileEnvVars(),
      ...getMissingUnifiedTrendingFeedEnvVars(),
    ]),
  ];

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

    const trendingResults =
      trendingMissing.length > 0
        ? {
            error: "Trending reconciliation is not configured.",
            inspected: 0,
            results: [],
          }
        : await reconcileDurableTrendingFeeds({
            limit: Math.min(limit, 25),
          });

    const hookDispatchRecovery =
      trendingMissing.length > 0
        ? {
            error: "Trending Hook dispatch recovery is not configured.",
            inspected: 0,
            results: [],
          }
        : await recoverUnattachedTrendingHookChunks({
            limit: Math.min(limit, 25),
          });

    if (trendingMissing.length > 0) {
      console.error("Durable Trending reconciliation is not configured", {
        missing: trendingMissing,
      });
    }

    const integrityResults =
      trendingMissing.length > 0
        ? {
            error: "Trending integrity repair is not configured.",
            inspected: 0,
            results: [],
          }
        : await repairIncompleteTrendingFeeds({
            limit: Math.min(limit, 25),
          });

    return json({
      inspected: staleJobs.length,
      ok: true,
      results,
      hookDispatchRecovery,
      trendingIntegrityRepair: integrityResults,
      trendingReconciliation: trendingResults,
    });
  } catch (error) {
    console.error("Background job recovery scan failed:", error);
    return json({ ok: false, error: "Recovery scan failed." }, 500);
  }
}

/**
 * Repairs the only pre-job crash window in the durable Hook flow. A row here
 * exists only when Postgres reserved candidates but no physical job was
 * attached. Normal requests never wait for this scanner.
 */
async function recoverUnattachedTrendingHookChunks(params: { limit: number }) {
  const claims = await claimDueTrendingHookGenerationChunkDispatches({
    limit: params.limit,
  });
  const results: Array<Record<string, string | number | boolean | null>> = [];

  for (const claim of claims) {
    try {
      const reconciliation = await reconcileCompletedTrendingFeedForUser(
        claim.userId,
      );
      const completed = await completeTrendingHookGenerationChunkDispatch({
        claimToken: claim.claimToken,
        dispatchId: claim.dispatchId,
      });

      if (completed) {
        results.push({
          attemptCount: claim.attemptCount,
          chunkId: claim.chunkId,
          feedId: reconciliation.feedId,
          result: "dispatched",
          runId: claim.runId,
          targetValidCount: claim.targetValidCount,
          userId: claim.userId,
        });
        continue;
      }

      // The normal dispatcher may have attached the job while this recovery
      // request was running. If it did not, leave this durable row due again
      // rather than pretending a worker was created.
      const rescheduled = await rescheduleTrendingHookGenerationChunkDispatch({
        claimToken: claim.claimToken,
        dispatchId: claim.dispatchId,
        errorMessage:
          "The Hook dispatch recovery did not observe a physical worker job attachment.",
      });

      results.push({
        attemptCount: claim.attemptCount,
        chunkId: claim.chunkId,
        feedId: reconciliation.feedId,
        result: rescheduled ? "waiting_for_attachment" : "already_resolved",
        runId: claim.runId,
        targetValidCount: claim.targetValidCount,
        userId: claim.userId,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      try {
        await rescheduleTrendingHookGenerationChunkDispatch({
          claimToken: claim.claimToken,
          dispatchId: claim.dispatchId,
          errorMessage: message,
        });
      } catch (rescheduleError) {
        console.error("Could not reschedule durable Hook dispatch recovery", {
          chunkId: claim.chunkId,
          error: getErrorMessage(rescheduleError),
          runId: claim.runId,
        });
      }

      console.error("Durable Hook dispatch recovery failed", {
        chunkId: claim.chunkId,
        error: message,
        runId: claim.runId,
        userId: claim.userId,
      });
      results.push({
        attemptCount: claim.attemptCount,
        chunkId: claim.chunkId,
        result: "rescheduled",
        runId: claim.runId,
        targetValidCount: claim.targetValidCount,
        userId: claim.userId,
      });
    }
  }

  return {
    inspected: claims.length,
    results,
  };
}

async function repairIncompleteTrendingFeeds(params: { limit: number }) {
  const repairs = await listCurrentTrendingFeedIntegrityRepairs({
    limit: params.limit,
  });
  const results: Array<Record<string, string | null>> = [];

  for (const repair of repairs) {
    try {
      const reconciliation = await reconcileCompletedTrendingFeedForUser(
        repair.user_id,
      );
      results.push({
        feedId: repair.feed_id,
        result: reconciliation.skipped ? "skipped" : "repaired",
        userId: repair.user_id,
      });
    } catch (error) {
      console.error("Incomplete Trending feed repair failed", {
        error: getErrorMessage(error),
        feedId: repair.feed_id,
        userId: repair.user_id,
      });
      results.push({
        feedId: repair.feed_id,
        result: "retry_next_recovery",
        userId: repair.user_id,
      });
    }
  }

  return {
    inspected: repairs.length,
    results,
  };
}

async function reconcileDurableTrendingFeeds(params: { limit: number }) {
  const claims = await claimDueTrendingFeedReconciliations({
    limit: params.limit,
  });
  const results: Array<Record<string, string | number | boolean | null>> = [];

  for (const claim of claims) {
    try {
      const reconciliation = await reconcileCompletedTrendingFeedForUser(
        claim.userId,
      );
      const completed = await completeTrendingFeedReconciliation({
        sourceJobId: claim.sourceJobId,
      });

      results.push({
        attemptCount: claim.attemptCount,
        feedId: reconciliation.feedId,
        result: completed ? "completed" : "claim_lost",
        skipped: reconciliation.skipped,
        sourceJobId: claim.sourceJobId,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      try {
        await rescheduleTrendingFeedReconciliation({
          message,
          sourceJobId: claim.sourceJobId,
        });
      } catch (rescheduleError) {
        console.error("Could not reschedule durable Trending reconciliation", {
          error: getErrorMessage(rescheduleError),
          sourceJobId: claim.sourceJobId,
        });
      }

      console.error("Durable Trending reconciliation failed", {
        error: message,
        sourceJobId: claim.sourceJobId,
        userId: claim.userId,
      });
      results.push({
        attemptCount: claim.attemptCount,
        result: "rescheduled",
        sourceJobId: claim.sourceJobId,
      });
    }
  }

  return {
    inspected: claims.length,
    results,
  };
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
