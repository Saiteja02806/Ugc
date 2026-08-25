const PLAN_TIER_BY_KEY: Record<string, number> = {
  creator: 2,
  free: 0,
  growth: 2,
  pro: 1,
  starter: 1,
  ultra_pro: 2,
};

/**
 * A same-day upgrade is an additional pack, not a replacement for content
 * already delivered under the earlier plan. The daily feed snapshots the plan
 * that last received a full pack, so the grant can be made once and stays
 * idempotent on subsequent reads.
 */
export function getAdditionalTrendingSlotsForUpgrade(params: {
  currentPlanDailyLimit: number;
  currentPlanKey: string;
  existingFeedPlanKey: string;
}) {
  const currentTier = getPlanTier(params.currentPlanKey);
  const existingTier = getPlanTier(params.existingFeedPlanKey);

  if (currentTier <= existingTier) {
    return 0;
  }

  return Math.max(Math.trunc(params.currentPlanDailyLimit), 0);
}

function getPlanTier(planKey: string) {
  return PLAN_TIER_BY_KEY[planKey.trim().toLowerCase()] ?? 0;
}
