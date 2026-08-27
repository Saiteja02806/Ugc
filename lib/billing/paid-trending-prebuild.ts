export type PaidTrendingPrebuildPlanKey = "starter" | "growth";

/**
 * This key is shared with the database trigger. It collapses duplicate Dodo
 * deliveries while allowing a new paid pack when a later billing period begins.
 */
export function getPaidTrendingPrebuildIdempotencyKey(params: {
  periodStart: string | null;
  planKey: PaidTrendingPrebuildPlanKey;
  subscriptionId: string;
}) {
  return [
    "paid-trending-prebuild",
    "v1",
    params.subscriptionId.trim(),
    params.planKey,
    getPeriodKey(params.periodStart),
  ].join(":");
}

function getPeriodKey(periodStart: string | null) {
  if (!periodStart) return "subscription";

  const timestamp = new Date(periodStart);

  if (!Number.isFinite(timestamp.getTime())) {
    return "subscription";
  }

  return `${timestamp
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "")}Z`;
}
