import {
  PaidTrendingPrebuildRequestError,
  preparePaidTrendingInApp,
} from "../lib/paid-trending-prebuild.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runPreparePaidTrendingJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  const input = parseInput(job);

  await context.checkpoint({
    progress: null,
    stage: "preparing_paid_trending_feed",
    status: "waiting_external_service",
  });

  try {
    const result = await preparePaidTrendingInApp(input);

    await context.checkpoint({
      progress: null,
      stage: "paid_trending_feed_prepared",
      status: "processing",
    });

    return result;
  } catch (error) {
    if (error instanceof PaidTrendingPrebuildRequestError && error.retryable) {
      throw new RetryableJobError(error.message, {
        code: "paid_trending_prebuild_unavailable",
        retryAfterSeconds: 30,
      });
    }

    throw error;
  }
}

function parseInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);
  const expectedPlanKey = getPlanKey(input?.expectedPlanKey);
  const subscriptionId = getString(input?.subscriptionId);
  const userId = getString(input?.userId) || job.user_id || "";

  if (!job.user_id || job.user_id !== userId || !expectedPlanKey || !subscriptionId) {
    throw new Error("paid_trending_prebuild input is invalid.");
  }

  return { expectedPlanKey, subscriptionId, userId };
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getPlanKey(
  value: Json | undefined,
): "starter" | "growth" | null {
  return value === "starter" || value === "growth" ? value : null;
}

function getString(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
