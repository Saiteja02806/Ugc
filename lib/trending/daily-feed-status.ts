import type { TrendingDailyPackReadiness } from "./daily-pack-readiness.ts";

export function getPublicDailyFeedState(params: {
  items: readonly unknown[];
  readiness: TrendingDailyPackReadiness;
  terminalFailure?: boolean;
}): "caught_up" | "failed" | "preparing" | "ready" {
  if (params.readiness.remainingCount === 0) return "caught_up";
  if (params.terminalFailure || params.readiness.failedSlotCount > 0) return "failed";
  if (params.readiness.pendingSlotCount > 0) return "preparing";
  return params.items.length > 0 ? "ready" : "failed";
}

export function shouldPollTrendingFeed(params: {
  pendingSlotCount: number;
  upgradeRequired?: boolean;
}) {
  // Access will not change by polling generation. Paid activation triggers
  // its own prebuild; the next authenticated visit reloads the entitlement.
  return !params.upgradeRequired && params.pendingSlotCount > 0;
}
