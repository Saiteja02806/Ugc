import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextReplenishmentCursor,
  isValidReplenishmentCycleId,
  parseReplenishmentPageResponse,
} from "./replenishment-page-logic.ts";

const CURRENT_CURSOR = "00000000-0000-4000-8000-000000000500";
const NEXT_CURSOR = "00000000-0000-4000-8000-000000000505";
const CYCLE_ID = "2026-07-17T00:15:00.000Z";

test("continues from a strictly increasing durable UUID cursor", () => {
  assert.equal(
    getNextReplenishmentCursor({
      currentCursor: CURRENT_CURSOR,
      hasMore: true,
      nextCursor: NEXT_CURSOR,
      processedCount: 5,
    }),
    NEXT_CURSOR,
  );
});

test("stops after a short or empty final page", () => {
  assert.equal(
    getNextReplenishmentCursor({
      currentCursor: CURRENT_CURSOR,
      hasMore: false,
      nextCursor: NEXT_CURSOR,
      processedCount: 1,
    }),
    null,
  );
});

test("rejects a full page with a missing, equal, backward, or invalid cursor", () => {
  for (const nextCursor of [
    null,
    CURRENT_CURSOR,
    "00000000-0000-4000-8000-000000000499",
    "profile-505",
  ]) {
    assert.throws(
      () =>
        getNextReplenishmentCursor({
          currentCursor: CURRENT_CURSOR,
          hasMore: true,
          nextCursor,
          processedCount: 5,
        }),
      /did not advance/,
    );
  }

  assert.throws(
    () =>
      getNextReplenishmentCursor({
        currentCursor: CURRENT_CURSOR,
        hasMore: true,
        nextCursor: NEXT_CURSOR,
        processedCount: 0,
      }),
    /without processed profiles/,
  );
});

test("validates the signed replenishment page response at runtime", () => {
  const response = parseReplenishmentPageResponse({
    cycleId: CYCLE_ID,
    cycleStatus: "active",
    hasMore: true,
    nextCursor: NEXT_CURSOR,
    ok: true,
    pageCursor: CURRENT_CURSOR,
    processedCount: 2,
    results: [
      {
        assignedCount: 5,
        localDate: "2026-07-17",
        ok: true,
        pendingSlotCount: 5,
        state: "preparing",
        userId: "user-a",
      },
      {
        error: "No approved safe carousel assets are available.",
        ok: false,
        userId: "user-b",
      },
    ],
  });

  assert.equal(response.processedCount, 2);
  assert.equal(response.results.length, 2);
});

test("accepts only deterministic canonical schedule cycle IDs", () => {
  assert.equal(isValidReplenishmentCycleId(CYCLE_ID), true);
  assert.equal(isValidReplenishmentCycleId("2026-07-17T05:45:00+05:30"), false);
  assert.equal(isValidReplenishmentCycleId("daily-cycle"), false);
});

test("accepts an idempotent completed-cycle replay without processing a page", () => {
  const response = parseReplenishmentPageResponse({
    cycleId: CYCLE_ID,
    cycleStatus: "completed",
    hasMore: false,
    nextCursor: null,
    ok: true,
    pageCursor: NEXT_CURSOR,
    processedCount: 0,
    results: [],
  });

  assert.equal(response.cycleStatus, "completed");
  assert.equal(response.processedCount, 0);
});

test("rejects malformed page responses before pagination continues", () => {
  assert.throws(() =>
    parseReplenishmentPageResponse({
      cycleId: CYCLE_ID,
      cycleStatus: "active",
      hasMore: true,
      nextCursor: "not-a-uuid",
      ok: true,
      pageCursor: CURRENT_CURSOR,
      processedCount: 1,
      results: [],
    }),
  );
  assert.throws(() =>
    parseReplenishmentPageResponse({
      cycleId: CYCLE_ID,
      cycleStatus: "completed",
      hasMore: false,
      nextCursor: null,
      ok: true,
      pageCursor: CURRENT_CURSOR,
      processedCount: 2,
      results: [
        {
          ok: true,
          pendingSlotCount: 0,
          state: "ready",
          userId: "user-a",
        },
      ],
    }),
  );

  assert.throws(() =>
    parseReplenishmentPageResponse({
      cycleId: CYCLE_ID,
      cycleStatus: "completed",
      hasMore: true,
      nextCursor: NEXT_CURSOR,
      ok: true,
      pageCursor: CURRENT_CURSOR,
      processedCount: 1,
      results: [
        {
          ok: true,
          pendingSlotCount: 0,
          state: "ready",
          userId: "user-a",
        },
      ],
    }),
  );
});
