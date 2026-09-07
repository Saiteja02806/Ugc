export type TrendingDailyPackSlot = {
  assignmentId: string | null;
  state: "decided" | "failed" | "planned" | "preparing" | "ready";
};

export type TrendingDailyPackReadiness = {
  completedCount: number;
  deliverableCount: number;
  failedSlotCount: number;
  pendingSlotCount: number;
  ready: boolean;
  remainingCount: number;
};

/**
 * Computes the state of a daily pack.
 *
 * A slot is only deliverable when both the durable slot and its resolved feed
 * item exist. A reserved assignment without its provider item can still be
 * rendering, so it remains background work. Only an explicitly failed slot is
 * terminal. This lets the caller expose valid items without treating one
 * unavailable slot as a failed whole pack.
 */
export function getTrendingDailyPackReadiness(params: {
  dailyLimit: number;
  resolvedAssignmentIds: ReadonlySet<string>;
  slots: readonly TrendingDailyPackSlot[];
}): TrendingDailyPackReadiness {
  const dailyLimit = Math.max(Math.trunc(params.dailyLimit), 0);
  let completedCount = 0;
  let deliverableCount = 0;
  let failedSlotCount = 0;
  // Interrupted reservation writes must not appear complete just because the
  // physical rows are missing. The recovery scanner can restore these slots.
  let pendingSlotCount = Math.max(dailyLimit - params.slots.length, 0);

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
    } else if (slot.state === "failed") {
      failedSlotCount += 1;
    } else {
      pendingSlotCount += 1;
    }
  }

  const remainingCount = Math.max(dailyLimit - completedCount, 0);

  return {
    completedCount,
    deliverableCount,
    failedSlotCount,
    pendingSlotCount,
    ready:
      remainingCount === 0 ||
      (pendingSlotCount === 0 && failedSlotCount === 0),
    remainingCount,
  };
}

export function exposeTrendingDailyPackItems<T>(params: {
  items: readonly T[];
}) {
  return [...params.items];
}
