import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { CAROUSEL_GENERATION_PILOT_USER_ID } from "../carousel/generation-hold.ts";

const calls = [];
const pilotProfile = { id: "profile", profileVersion: 1, userId: CAROUSEL_GENERATION_PILOT_USER_ID, trendingTimezone: "UTC" };
const nonPilotProfile = { id: "profile-other", profileVersion: 1, userId: "other-owner", trendingTimezone: "UTC" };
const savedPreference = { mix: { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 }, preferenceVersion: 3, updatedAt: "saved" };
const storedPlan = {
  feed: { id: "feed", businessProfileId: "profile", businessProfileVersion: 1, dailyLimit: 5, planKey: "pro", mix: savedPreference.mix, preferenceVersion: 3, lastError: null, wallTextRetryKey: null },
  slots: [
    { format: "carousel", state: "planned", assignmentId: null, position: 1 },
    { format: "hook_video", state: "planned", assignmentId: null, position: 2 },
    { format: "wall_text", state: "preparing", assignmentId: null, position: 3 },
    { format: "reaction", state: "ready", assignmentId: "reaction", position: 4 },
    { format: "carousel", state: "decided", assignmentId: "old-slide", position: 5 },
  ],
};
let plan = storedPlan;
let accessBlocked = false;
const original = structuredClone(storedPlan);
const unexpected = () => { throw new Error("Unexpected dependency call."); };

mock.module("../business-profiles/db.ts", { namedExports: { updateBusinessProfileTrendingTimezone: unexpected } });
mock.module("./daily-feed.ts", { namedExports: {
  readTrendingDailyFeed: async params => { calls.push(["read-slides", params.dailyLimitOverride]); return { carousels: [] }; },
  ensureTrendingDailyFeed: async params => { calls.push(["prepare-slides", params.dailyLimitOverride]); return { carousels: [] }; },
} });
mock.module("./trending-hook-feed.ts", { namedExports: {
  getTrendingHookFeedProvider: async () => { calls.push(["read-hooks"]); return { format: "hook_video", items: [], state: "ready" }; },
  prepareTrendingHookIdeas: async profile => { calls.push(["prepare-hooks", profile.userId]); return { exhausted: false, ideaCount: 0, jobId: "hook-job", status: "queued" }; },
  TrendingHookPreparationError: class extends Error {},
} });
mock.module("./trending-wall-text-feed.ts", { namedExports: {
  getTrendingWallTextFeedProvider: async () => { calls.push(["read-wall"]); return { format: "wall_text", items: [], state: "ready" }; },
  enqueueTrendingWallTextRefill: async profile => { calls.push(["prepare-wall", profile.userId]); return { activeCount: 0, jobId: "wall-job", status: "scheduled" }; },
} });
mock.module("./reaction-feed.ts", { namedExports: {
  getTrendingReactionFeedProvider: async () => {
    calls.push(["read-reaction"]);
    return {
      format: "reaction",
      items: [{ assignmentId: "reaction", format: "reaction", id: "reaction:1", position: 4, readiness: "preview_ready", source: "new" }],
      state: "ready",
    };
  },
} });
mock.module("../reaction-format/generation-jobs.ts", { namedExports: {
  enqueueTrendingReactionRefill: async profile => { calls.push(["prepare-reaction", profile.userId]); return { kind: "job", job: { id: "reaction-job", status: "queued" } }; },
} });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  getTrendingContentMixPreference: async () => structuredClone(savedPreference),
  getDailyTrendingFeedForDate: async () => plan,
  getDailyTrendingFeed: async () => plan,
  getTrendingPlanEntitlement: async () => {
    if (accessBlocked) throw new FreeTrialAccessError("Trial ended.", "free_trial_content_expired");
    return { dailyLimit: 20, planKey: "pro", displayName: "Starter" };
  },
  getTrendingLocalDate: () => "2026-11-20",
  normalizeTrendingTimezone: () => "UTC",
  ensureDailyTrendingFeedPlan: async params => {
    calls.push(["reserve", params]);
    if (!plan) plan = { feed: { ...storedPlan.feed, dailyLimit: 20, mix: params.preference.mix }, slots: params.formats.map((format, index) => ({ format, position: index + 1, state: "planned", assignmentId: null })) };
    return plan;
  },
  reconcileDailyTrendingFeedSlotIntegrity: async params => { calls.push(["reconcile", params]); },
  attachDailyTrendingAssignments: async () => {},
  markDailyTrendingFeedFormatsFailed: unexpected,
} });

const { readUnifiedTrendingDailyFeed, ensureUnifiedTrendingDailyFeed } = await import("./unified-daily-feed.ts");
const { FreeTrialAccessError } = await import("../billing/free-trial.ts");
const pilotParams = { includeHookVideos: true, includeWallText: true, profile: pilotProfile, userId: pilotProfile.userId, timezone: "UTC" };
const nonPilotParams = { includeHookVideos: true, includeWallText: true, profile: nonPilotProfile, userId: nonPilotProfile.userId, timezone: "UTC" };

test("non-pilot accounts stay paused and never trigger Hook, Wall, Reaction, or Carousel generation", async () => {
  const old = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  plan = null;
  calls.length = 0;
  try {
    const result = await ensureUnifiedTrendingDailyFeed(nonPilotParams);
    assert.equal(result.requiresPreparation, false);
    assert.equal(calls.some(([kind]) => kind.startsWith("prepare-") || kind === "reserve"), false);
  } finally {
    plan = storedPlan;
    if (old === undefined) delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
    else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED = old;
  }
});

test("pilot owner loads and prepares all four formats from a mixed pack without mutating stored slots", async () => {
  const old = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  plan = storedPlan;
  try {
    calls.length = 0;
    const readResult = await readUnifiedTrendingDailyFeed(pilotParams);
    assert.deepEqual(readResult.contentMix.percentages, savedPreference.mix);
    assert.equal(readResult.feed.pendingSlotCount, 3);
    assert.equal(readResult.feed.remainingCount, 4);
    assert.deepEqual(readResult.formatAvailability.map(row => row.format), ["carousel", "wall_text", "hook_video", "reaction"]);
    assert.equal(calls.some(([kind]) => kind.startsWith("prepare-")), false);

    calls.length = 0;
    const prepared = await ensureUnifiedTrendingDailyFeed(pilotParams);
    assert.deepEqual(prepared.contentMix.percentages, savedPreference.mix);
    assert.equal(calls.some(([kind]) => kind === "prepare-slides"), true);
    assert.equal(calls.some(([kind, uid]) => kind === "prepare-hooks" && uid === CAROUSEL_GENERATION_PILOT_USER_ID), true);
    assert.equal(calls.some(([kind, uid]) => kind === "prepare-wall" && uid === CAROUSEL_GENERATION_PILOT_USER_ID), true);
    assert.deepEqual(storedPlan, original);
  } finally {
    if (old === undefined) delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
    else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED = old;
  }
});

test("pilot owner reserves all four formats using the saved 20/30/20/30 mix on new packs", async () => {
  const old = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  plan = null;
  calls.length = 0;
  try {
    const result = await ensureUnifiedTrendingDailyFeed(pilotParams);
    const reservation = calls.find(([kind]) => kind === "reserve")[1];
    assert.equal(reservation.formats.length, 20);
    assert.equal(reservation.formats.filter(f => f === "carousel").length, 4);
    assert.equal(reservation.formats.filter(f => f === "hook_video").length, 6);
    assert.equal(reservation.formats.filter(f => f === "wall_text").length, 6);
    assert.equal(reservation.formats.filter(f => f === "reaction").length, 4);
    assert.deepEqual(result.contentMix.allocation, { carousel: 4, hook_video: 6, reaction: 4, wall_text: 6 });
    assert.equal(calls.some(([kind]) => kind === "prepare-hooks"), true);
    assert.equal(calls.some(([kind]) => kind === "prepare-wall"), true);
    assert.equal(calls.some(([kind]) => kind === "prepare-reaction"), true);
    assert.equal(calls.some(([kind]) => kind === "prepare-slides"), true);
  } finally {
    plan = storedPlan;
    if (old === undefined) delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
    else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED = old;
  }
});

test("expired access with a historical all-decided pack returns a settled empty feed without preparation", async () => {
  plan = { feed: { ...storedPlan.feed, dailyLimit: 1 }, slots: [{ format: "hook_video", state: "decided", assignmentId: "done-hook", position: 1 }] };
  accessBlocked = true;
  calls.length = 0;
  try {
    const result = await readUnifiedTrendingDailyFeed(pilotParams);
    assert.equal(result.upgradeRequired, true);
    assert.equal(result.feed.state, "caught_up");
    assert.equal(result.feed.pendingSlotCount, 0);
    assert.equal(result.requiresPreparation, false);
    assert.deepEqual(result.items, []);
    assert.equal(calls.some(([kind]) => kind.startsWith("prepare-")), false);
  } finally {
    accessBlocked = false;
    plan = storedPlan;
  }
});
