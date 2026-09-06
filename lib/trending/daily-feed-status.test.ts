import assert from "node:assert/strict";
import test from "node:test";
import { getTrendingDailyPackReadiness } from "./daily-pack-readiness.ts";
import { getPublicDailyFeedState, shouldPollTrendingFeed } from "./daily-feed-status.ts";
import { loadTrendingFormat } from "./format-isolation.ts";

test("Starter has no pause at ten: only unfinished slots keep it preparing", () => {
  const decided = Array.from({ length: 10 }, () => ({ assignmentId: null, state: "decided" as const }));
  for (const dailyLimit of [10, 20, 50]) {
    const slots = [...decided, ...Array.from({ length: dailyLimit - 10 }, () => ({
      assignmentId: null, state: "preparing" as const,
    }))];
    const readiness = getTrendingDailyPackReadiness({ dailyLimit, slots, resolvedAssignmentIds: new Set() });
    assert.equal(readiness.pendingSlotCount, dailyLimit - 10);
    assert.equal(getPublicDailyFeedState({ items: [], readiness }), dailyLimit === 10 ? "caught_up" : "preparing");
  }
});

test("missing physical slots remain pending after the last existing card is decided", () => {
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: 20, resolvedAssignmentIds: new Set(),
    slots: Array.from({ length: 10 }, () => ({ assignmentId: null, state: "decided" as const })),
  });
  assert.equal(readiness.pendingSlotCount, 10);
  assert.equal(readiness.ready, false);
  assert.equal(getPublicDailyFeedState({ items: [], readiness }), "preparing");
});

test("one failed format exposes failure while other ready content remains deliverable", () => {
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: 3, resolvedAssignmentIds: new Set(["ready"]),
    slots: [
      { assignmentId: "ready", state: "ready" },
      { assignmentId: null, state: "failed" },
      { assignmentId: null, state: "preparing" },
    ],
  });
  assert.equal(readiness.deliverableCount, 1);
  assert.equal(getPublicDailyFeedState({ items: ["ready"], readiness }), "failed");
  assert.equal(shouldPollTrendingFeed({ pendingSlotCount: 1 }), true);
  assert.equal(shouldPollTrendingFeed({ pendingSlotCount: 1, upgradeRequired: true }), false);
  assert.equal(shouldPollTrendingFeed({ pendingSlotCount: 0 }), false);
});

for (const failingFormat of ["carousel", "hook_video", "wall_text", "reaction"]) {
  test(`${failingFormat} load failure cannot discard the other three formats`, async () => {
    const errors: unknown[] = [];
    const results = await Promise.all(["carousel", "hook_video", "wall_text", "reaction"].map((format) =>
      loadTrendingFormat({
        load: async () => {
          if (format === failingFormat) throw new Error("simulated provider read failure");
          return [format];
        },
        fallback: [] as string[], onError: (error) => { errors.push(error); },
      }),
    ));
    assert.deepEqual(results.flat(), ["carousel", "hook_video", "wall_text", "reaction"].filter((f) => f !== failingFormat));
    assert.equal(errors.length, 1);
  });
}
