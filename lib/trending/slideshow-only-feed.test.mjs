import assert from "node:assert/strict";
import { mock, test } from "node:test";

const calls = [];
const profile = { id: "profile", profileVersion: 1, userId: "owner", trendingTimezone: "UTC" };
const savedPreference = { mix: { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 }, preferenceVersion: 3, updatedAt: "saved" };
const storedPlan = {
  feed: { id: "feed", businessProfileId: "profile", businessProfileVersion: 1, dailyLimit: 5, planKey: "pro", mix: savedPreference.mix, preferenceVersion: 3, lastError: null, wallTextRetryKey: null },
  slots: [
    { format: "carousel", state: "planned", assignmentId: null, position: 1 },
    { format: "hook_video", state: "failed", assignmentId: null, position: 2 },
    { format: "wall_text", state: "preparing", assignmentId: null, position: 3 },
    { format: "reaction", state: "ready", assignmentId: "reaction", position: 4 },
    { format: "carousel", state: "decided", assignmentId: "old-slide", position: 5 },
  ],
};
let plan = storedPlan;
let accessBlocked = false;
const original = structuredClone(storedPlan);
const blocked = () => { throw new Error("A hidden provider or generator was invoked."); };

mock.module("../business-profiles/db.ts", { namedExports: { updateBusinessProfileTrendingTimezone: blocked } });
mock.module("./daily-feed.ts", { namedExports: {
  readTrendingDailyFeed: async params => { calls.push(["read-slides", params.dailyLimitOverride]); return { carousels: [] }; },
  ensureTrendingDailyFeed: async params => { calls.push(["prepare-slides", params.dailyLimitOverride]); return { carousels: [] }; },
} });
mock.module("./trending-hook-feed.ts", { namedExports: { getTrendingHookFeedProvider: blocked, prepareTrendingHookIdeas: blocked, TrendingHookPreparationError: class extends Error {} } });
mock.module("./trending-wall-text-feed.ts", { namedExports: { getTrendingWallTextFeedProvider: blocked, enqueueTrendingWallTextRefill: blocked } });
mock.module("./reaction-feed.ts", { namedExports: { getTrendingReactionFeedProvider: blocked } });
mock.module("../reaction-format/generation-jobs.ts", { namedExports: { enqueueTrendingReactionRefill: blocked } });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  getTrendingContentMixPreference: async () => structuredClone(savedPreference),
  getDailyTrendingFeedForDate: async () => plan,
  getDailyTrendingFeed: async () => plan,
  getTrendingPlanEntitlement: async () => {
    if (accessBlocked) throw new FreeTrialAccessError("Trial ended.", "free_trial_content_expired");
    return { dailyLimit: 20, planKey: "pro", displayName: "Starter" };
  },
  getTrendingLocalDate: () => "2026-10-13",
  normalizeTrendingTimezone: () => "UTC",
  ensureDailyTrendingFeedPlan: async params => {
    calls.push(["reserve", params]);
    if (!plan) plan = { feed: { ...storedPlan.feed, dailyLimit: 20, mix: params.preference.mix }, slots: params.formats.map((format, index) => ({ format, position: index + 1, state: "planned", assignmentId: null })) };
    return plan;
  },
  reconcileDailyTrendingFeedSlotIntegrity: async params => { calls.push(["reconcile", params]); },
  attachDailyTrendingAssignments: async () => {},
  markDailyTrendingFeedFormatsFailed: blocked,
} });

const { readUnifiedTrendingDailyFeed, ensureUnifiedTrendingDailyFeed } = await import("./unified-daily-feed.ts");
const { FreeTrialAccessError } = await import("../billing/free-trial.ts");
const params = { includeHookVideos: true, includeWallText: true, profile, userId: "owner", timezone: "UTC" };

test("read and preparation hide mixed legacy video slots without loading or generating them", async () => {
  for (const load of [readUnifiedTrendingDailyFeed, ensureUnifiedTrendingDailyFeed]) {
    calls.length = 0;
    const result = await load(params);
    assert.deepEqual(result.contentMix.percentages, { carousel: 100, hook_video: 0, reaction: 0, wall_text: 0 });
    assert.equal(result.feed.pendingSlotCount, 1);
    assert.equal(result.feed.remainingCount, 1);
    assert.deepEqual(result.formatAvailability.map(row => row.format), ["carousel"]);
    assert.deepEqual(storedPlan, original);
    const reconciliation = calls.find(([kind]) => kind === "reconcile")?.[1];
    if (reconciliation) {
      assert.equal(reconciliation.hookVideoProviderResolved, false);
      assert.equal(reconciliation.wallTextProviderResolved, false);
      assert.equal(reconciliation.reactionProviderResolved, false);
    }
    const reservation = calls.find(([kind]) => kind === "reserve")?.[1];
    if (reservation) assert.deepEqual(reservation.formats, storedPlan.slots.map(slot => slot.format));
  }
});

test("new packs reserve the complete allowance as slideshows despite saved video percentages", async () => {
  plan = null;
  calls.length = 0;
  const result = await ensureUnifiedTrendingDailyFeed(params);
  const reservation = calls.find(([kind]) => kind === "reserve")[1];
  assert.deepEqual(reservation.formats, Array(20).fill("carousel"));
  assert.equal(result.feed.pendingSlotCount, 20);
  assert.deepEqual(result.contentMix.allocation, { carousel: 20, hook_video: 0, reaction: 0, wall_text: 0 });
});

test("expired access with a historical all-video pack still returns a settled empty feed", async () => {
  plan = { feed: { ...storedPlan.feed, dailyLimit: 3 }, slots: storedPlan.slots.filter(slot => slot.format !== "carousel") };
  accessBlocked = true;
  try {
    const result = await readUnifiedTrendingDailyFeed(params);
    assert.equal(result.upgradeRequired, true);
    assert.equal(result.feed.state, "caught_up");
    assert.equal(result.feed.pendingSlotCount, 0);
    assert.equal(result.requiresPreparation, false);
    assert.deepEqual(result.items, []);
  } finally { accessBlocked = false; }
});
