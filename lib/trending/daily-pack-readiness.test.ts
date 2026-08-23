import assert from "node:assert/strict";
import test from "node:test";

import {
  exposeTrendingDailyPackItems,
  getTrendingDailyPackReadiness,
} from "./daily-pack-readiness.ts";

test("keeps every item private until all ten Free slots are deliverable", () => {
  const slots = Array.from({ length: 10 }, (_, index) => ({
    assignmentId: `assignment-${index}`,
    state: "ready" as const,
  }));
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: 10,
    resolvedAssignmentIds: new Set(
      slots.slice(0, 9).map((slot) => slot.assignmentId),
    ),
    slots,
  });

  assert.deepEqual(readiness, {
    completedCount: 0,
    pendingSlotCount: 1,
    ready: false,
    remainingCount: 10,
  });
  assert.deepEqual(
    exposeTrendingDailyPackItems({ items: ["partial"], readiness }),
    [],
  );
});

test("exposes the complete remaining pack in one response", () => {
  const slots = Array.from({ length: 20 }, (_, index) => ({
    assignmentId: index < 3 ? null : `assignment-${index}`,
    state: index < 3 ? ("decided" as const) : ("ready" as const),
  }));
  const items = slots.slice(3).map((slot) => slot.assignmentId!);
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: 20,
    resolvedAssignmentIds: new Set(items),
    slots,
  });

  assert.deepEqual(readiness, {
    completedCount: 3,
    pendingSlotCount: 0,
    ready: true,
    remainingCount: 17,
  });
  assert.deepEqual(exposeTrendingDailyPackItems({ items, readiness }), items);
});

test("treats a ready slot without a provider item as pending", () => {
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: 1,
    resolvedAssignmentIds: new Set(),
    slots: [{ assignmentId: "missing-provider-item", state: "ready" }],
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.pendingSlotCount, 1);
});

test("marks a fully decided daily pack as caught up", () => {
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: 10,
    resolvedAssignmentIds: new Set(),
    slots: Array.from({ length: 10 }, () => ({
      assignmentId: null,
      state: "decided" as const,
    })),
  });

  assert.deepEqual(readiness, {
    completedCount: 10,
    pendingSlotCount: 0,
    ready: true,
    remainingCount: 0,
  });
});
