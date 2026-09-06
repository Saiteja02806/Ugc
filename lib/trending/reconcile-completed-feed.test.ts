import assert from "node:assert/strict";
import test from "node:test";
import { FreeTrialAccessError } from "../billing/free-trial.ts";
import { reconcileCompletedTrendingFeedForUser } from "./reconcile-completed-feed.ts";
import { getPublicDailyFeedFailure } from "./unified-daily-feed.ts";

test("expired trial callbacks settle once instead of retrying forever", async () => {
  for (const code of ["free_trial_content_expired", "free_trial_content_days_exhausted"] as const) {
    const result = await reconcileCompletedTrendingFeedForUser("user", {
      getProfile: async () => ({ trendingTimezone: "UTC" } as never),
      ensureFeed: async () => { throw new FreeTrialAccessError("No more access", code); },
    });
    assert.equal(result.skipped, true);
    assert.equal(result.pendingSlotCount, 0);
  }
});

test("temporary database failures still reach the durable reconciliation retry", async () => {
  const failure = new Error("database temporarily unavailable");
  await assert.rejects(reconcileCompletedTrendingFeedForUser("user", {
    getProfile: async () => ({ trendingTimezone: "UTC" } as never),
    ensureFeed: async () => { throw failure; },
  }), (error) => error === failure);
});

test("paid reconciliation returns the actual feed result", async () => {
  const result = await reconcileCompletedTrendingFeedForUser("user", {
    getProfile: async () => ({ trendingTimezone: "UTC" } as never),
    ensureFeed: async () => ({ feed: { id: "feed", state: "ready", pendingSlotCount: 0 } } as never),
  });
  assert.equal(result.skipped, false);
  assert.equal(result.feedId, "feed");
});

test("every terminal format gets a public failure object for the retained review shell", () => {
  for (const format of ["carousel", "hook_video", "wall_text", "reaction"]) {
    const failure = getPublicDailyFeedFailure({
      error: "private database diagnostic",
      slots: [{ format, state: "failed", assignmentId: null }] as never,
    });
    assert.equal(failure?.code, "content_generation_failed");
    assert.ok(failure?.message);
    assert.ok(!failure?.message.includes("private database"));
  }
});
