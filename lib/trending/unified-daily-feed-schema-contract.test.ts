import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260820084842_create_unified_daily_trending_feed.sql",
  "utf8",
);
const decisionRoute = readFileSync(
  "app/api/trending/feed/decisions/route.ts",
  "utf8",
);
const contentMixRoute = readFileSync(
  "app/api/trending/content-mix/route.ts",
  "utf8",
);
const freeAllowanceMigration = readFileSync(
  "supabase/migrations/20260823130857_raise_free_trending_allowance.sql",
  "utf8",
);
const unifiedFeed = readFileSync(
  "lib/trending/unified-daily-feed.ts",
  "utf8",
);
const unifiedFeedDatabase = readFileSync(
  "lib/trending/unified-daily-feed-db.ts",
  "utf8",
);
const feedRoute = readFileSync(
  "app/api/trending/feed/route.ts",
  "utf8",
);
const carouselDailyFeed = readFileSync(
  "lib/trending/daily-feed.ts",
  "utf8",
);

test("raises Free to ten posts and expands an already-created smaller feed", () => {
  assert.match(
    freeAllowanceMigration,
    /daily_trending_limit = 10[\s\S]*where plan_key = 'free'/,
  );
  assert.match(
    freeAllowanceMigration,
    /resolved_daily_limit < p_daily_limit[\s\S]*where requested\.ordinality > resolved_daily_limit/,
  );
  assert.match(
    freeAllowanceMigration,
    /daily_limit = p_daily_limit[\s\S]*status = 'preparing'/,
  );
  assert.match(
    unifiedFeedDatabase,
    /requestedPlanKey === "free"[\s\S]*fallback\.dailyLimit/,
  );
});

test("plans Free at 3/4/3 and dispatches missing formats together", () => {
  assert.match(
    unifiedFeed,
    /entitlement\.planKey === "free"[\s\S]*FREE_TRENDING_CONTENT_MIX/,
  );
  assert.match(
    unifiedFeed,
    /carouselAssignmentIds: carouselProvider\.items\.map[\s\S]*hookVideoAssignmentIds: hookProvider\.items\.map[\s\S]*wallTextAssignmentIds: wallTextProvider\.items\.map/,
  );
  assert.match(unifiedFeed, /await Promise\.all\(tasks\)/);
});

test("exposes daily content only after the complete remaining pack resolves", () => {
  assert.match(unifiedFeed, /getTrendingDailyPackReadiness/);
  assert.match(unifiedFeed, /exposeTrendingDailyPackItems/);
  assert.match(
    unifiedFeed,
    /const resolvedAssignmentIds = new Set\([\s\S]*resolvedItems\.map\(\(item\) => item\.assignmentId\)/,
  );
  assert.match(
    unifiedFeed,
    /readiness\.remainingCount === 0[\s\S]*readiness\.pendingSlotCount > 0/,
  );
});

test("serves a read-only feed fast path and prepares missing work after the response", () => {
  assert.match(feedRoute, /readUnifiedTrendingDailyFeed\(preparationParams\)/);
  assert.match(
    feedRoute,
    /after\(\(\) =>[\s\S]*prepareUnifiedTrendingDailyFeed\(preparationParams\)/,
  );
  assert.doesNotMatch(feedRoute, /await ensureUnifiedTrendingDailyFeed/);
  assert.match(unifiedFeed, /inFlightDailyPackPreparations/);
  assert.match(unifiedFeed, /readTrendingDailyFeed\(/);
  assert.match(carouselDailyFeed, /inspectProcessingCandidates: false/);
});

test("surfaces terminal format preparation failures instead of polling forever", () => {
  assert.match(unifiedFeed, /hasTerminalPreparationFailure/);
  assert.match(unifiedFeed, /hasUnresolvedReadyAssignment/);
  assert.match(
    unifiedFeed,
    /preparationResults\.get\("hook_video"\) === "failed"/,
  );
  assert.match(
    unifiedFeed,
    /preparationResults\.get\("wall_text"\) === "failed"/,
  );
  assert.match(unifiedFeed, /preparationFailed[\s\S]*\? "failed"/);
  assert.match(unifiedFeed, /markDailyTrendingFeedPreparationFailed/);
  assert.match(
    unifiedFeedDatabase,
    /status: "failed"[\s\S]*\.in\("state", \["planned", "preparing"\]\)/,
  );
});

test("stores an exact combined daily allowance for the renamed billing plans", () => {
  assert.match(
    migration,
    /where plan_key = 'pro'[\s\S]*values \('creator', 'Growth', 10, 50, true\)/,
  );
  assert.match(
    migration,
    /display_name = 'Starter',[\s\S]*daily_trending_limit = 20/,
  );
  assert.match(
    migration,
    /create table if not exists public\.daily_trending_feeds/,
  );
  assert.match(
    migration,
    /create table if not exists public\.daily_trending_feed_slots/,
  );
  assert.match(migration, /unique \(user_id, local_date\)/);
  assert.match(migration, /unique \(feed_id, position\)/);
});

test("enforces the content mix and protects its server-only tables", () => {
  assert.match(
    migration,
    /wall_text_percent between 0 and 50[\s\S]*hook_video_percent between 0 and 50[\s\S]*carousel_percent \+ wall_text_percent \+ hook_video_percent = 100/,
  );
  for (const table of [
    "trending_content_mix_preferences",
    "daily_trending_feeds",
    "daily_trending_feed_slots",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(
      migration,
      new RegExp(`revoke all privileges on table public\\.${table}[\\s\\S]*from anon, authenticated`),
    );
  }
  assert.match(
    migration,
    /save_trending_content_mix_preference[\s\S]*pg_advisory_xact_lock/,
  );
});

test("retires a daily slot after a swipe and never schedules a replacement", () => {
  assert.match(decisionRoute, /markDailyTrendingSlotDecided/);
  assert.doesNotMatch(decisionRoute, /replenishTrendingFormatAfterDecision/);
  assert.match(
    migration,
    /mark_daily_trending_feed_slot_decided[\s\S]*set state = 'decided'/,
  );
});

test("keeps an existing daily pack immutable after an authenticated mix update", () => {
  assert.match(contentMixRoute, /requireFirebaseUser\(request\)/);
  assert.match(contentMixRoute, /wall_text: z\.number\(\)\.int\(\)\.min\(0\)\.max\(50\)/);
  assert.match(contentMixRoute, /hook_video: z\.number\(\)\.int\(\)\.min\(0\)\.max\(50\)/);
  assert.doesNotMatch(contentMixRoute, /allocateUnboundTrendingSlots/);
  assert.doesNotMatch(contentMixRoute, /replanDailyTrendingUnboundSlots/);
  assert.match(contentMixRoute, /applied: currentFeed \? "next_day" : "today"/);
  assert.match(contentMixRoute, /Today's complete pack stays unchanged/);
  assert.match(
    contentMixRoute,
    /entitlement\.planKey === "free"[\s\S]*3 Slideshows, 4 Wall-of-text posts, and 3 Hooks/,
  );
});
