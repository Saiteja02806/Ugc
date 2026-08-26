import assert from "node:assert/strict";
import test from "node:test";

import {
  getDailyFeedTopUpPlan,
  getOrCreatePersistedDailyFeed,
  getTrendingDailyFeedState,
  partitionRuntimeSafeAssignments,
} from "./daily-feed-logic.ts";

test("returns an existing daily feed without rewriting it", async () => {
  const existing = { id: "feed-existing" };
  let createCalls = 0;

  const feed = await getOrCreatePersistedDailyFeed({
    create: async () => {
      createCalls += 1;
      return { id: "feed-created" };
    },
    findExisting: async () => existing,
  });

  assert.equal(feed, existing);
  assert.equal(createCalls, 0);
});

test("creates a daily feed only when one is missing", async () => {
  let createCalls = 0;

  const feed = await getOrCreatePersistedDailyFeed({
    create: async () => {
      createCalls += 1;
      return { id: "feed-created" };
    },
    findExisting: async () => null,
  });

  assert.deepEqual(feed, { id: "feed-created" });
  assert.equal(createCalls, 1);
});

test("tops up a partial feed into every unoccupied daily position", () => {
  assert.deepEqual(
    getDailyFeedTopUpPlan({
      dailyLimit: 10,
      existingPositions: [1, 2, 4],
    }),
    {
      availablePositions: [3, 5, 6, 7, 8, 9, 10],
      remainingSlotCount: 7,
    },
  );
});

test("does not populate a feed that already reached its daily limit", () => {
  assert.equal(
    getDailyFeedTopUpPlan({
      dailyLimit: 3,
      existingPositions: [1, 2, 3],
    }).remainingSlotCount,
    0,
  );
});

test("separates runtime-unsafe assignments for invalidation", () => {
  const result = partitionRuntimeSafeAssignments({
    assignments: [
      { carouselId: "complete-safe", id: "assignment-1" },
      { carouselId: "missing-slide", id: "assignment-2" },
      { carouselId: "unsafe-background", id: "assignment-3" },
    ],
    getCarouselId: (assignment) => assignment.carouselId,
    runtimeSafeCarouselIds: new Set(["complete-safe"]),
  });

  assert.deepEqual(
    result.valid.map((assignment) => assignment.id),
    ["assignment-1"],
  );
  assert.deepEqual(
    result.invalid.map((assignment) => assignment.id),
    ["assignment-2", "assignment-3"],
  );
});

test("exposes terminal and polling feed states explicitly", () => {
  assert.equal(
    getTrendingDailyFeedState({
      activeCarouselCount: 0,
      completedAssignmentCount: 0,
      hasProcessingCandidates: false,
      pendingSlotCount: 10,
    }),
    "exhausted",
  );
  assert.equal(
    getTrendingDailyFeedState({
      activeCarouselCount: 0,
      completedAssignmentCount: 10,
      hasProcessingCandidates: false,
      pendingSlotCount: 0,
    }),
    "caught_up",
  );
  assert.equal(
    getTrendingDailyFeedState({
      activeCarouselCount: 2,
      completedAssignmentCount: 0,
      hasProcessingCandidates: true,
      pendingSlotCount: 8,
    }),
    "preparing",
  );
  assert.equal(
    getTrendingDailyFeedState({
      activeCarouselCount: 2,
      completedAssignmentCount: 0,
      hasProcessingCandidates: false,
      pendingSlotCount: 8,
    }),
    "ready",
  );
});
