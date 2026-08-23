export type TrendingDailyPackSlot = {
  assignmentId: string | null;
  state: "decided" | "failed" | "planned" | "preparing" | "ready";
};

export type TrendingDailyPackReadiness = {
  completedCount: number;
  pendingSlotCount: number;
  ready: boolean;
  remainingCount: number;
};

/**
 * Computes the public daily-pack boundary.
 *
 * A slot is only deliverable when both the durable slot and its resolved feed
 * item exist. This prevents a nominally-ready database slot from leaking a
 * partial pack when a provider response is missing or stale.
 */
export function getTrendingDailyPackReadiness(params: {
  dailyLimit: number;
  resolvedAssignmentIds: ReadonlySet<string>;
  slots: readonly TrendingDailyPackSlot[];
}): TrendingDailyPackReadiness {
  const dailyLimit = Math.max(Math.trunc(params.dailyLimit), 0);
  let completedCount = 0;
  let deliverableCount = 0;

  for (const slot of params.slots) {
    if (slot.state === "decided") {
      completedCount += 1;
      continue;
    }

    if (
      slot.state === "ready" &&
      slot.assignmentId &&
      params.resolvedAssignmentIds.has(slot.assignmentId)
    ) {
      deliverableCount += 1;
    }
  }

  const remainingCount = Math.max(dailyLimit - completedCount, 0);
  const pendingSlotCount = Math.max(remainingCount - deliverableCount, 0);

  return {
    completedCount,
    pendingSlotCount,
    ready: remainingCount === 0 || pendingSlotCount === 0,
    remainingCount,
  };
}

export function exposeTrendingDailyPackItems<T>(params: {
  items: readonly T[];
  readiness: TrendingDailyPackReadiness;
}) {
  return params.readiness.ready ? [...params.items] : [];
}
