import "server-only";

import { getPaidTrendingPrebuildIdempotencyKey } from "./paid-trending-prebuild";
import { getBackgroundJobByIdempotencyKey } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";

export type PaidTrendingPrebuildDispatchParams = {
  periodStart: string | null;
  planKey: "starter" | "growth";
  subscriptionId: string;
  userId: string;
};

/**
 * Dispatch is deliberately best-effort after the billing transaction. The
 * queued job remains durable for the recovery scheduler if Cloud Tasks is
 * temporarily unavailable.
 */
export async function dispatchPaidTrendingPrebuild(
  params: PaidTrendingPrebuildDispatchParams,
) {
  try {
    const job = await getBackgroundJobByIdempotencyKey(
      getPaidTrendingPrebuildIdempotencyKey(params),
      { jobType: "paid_trending_prebuild", userId: params.userId },
    );

    if (job) {
      await dispatchQueuedBackgroundJobForRecovery(job);
    }
  } catch (error) {
    console.error("Paid Trending prebuild dispatch was deferred to recovery:", {
      error: error instanceof Error ? error.message : "Unknown dispatch error",
      subscriptionId: params.subscriptionId,
      userId: params.userId,
    });
  }
}
