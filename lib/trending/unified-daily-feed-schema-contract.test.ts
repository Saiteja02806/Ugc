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

test("replans only unbound positions after an authenticated mix update", () => {
  assert.match(contentMixRoute, /requireFirebaseUser\(request\)/);
  assert.match(contentMixRoute, /wall_text: z\.number\(\)\.int\(\)\.min\(0\)\.max\(50\)/);
  assert.match(contentMixRoute, /hook_video: z\.number\(\)\.int\(\)\.min\(0\)\.max\(50\)/);
  assert.match(contentMixRoute, /allocateUnboundTrendingSlots/);
  assert.match(contentMixRoute, /replanDailyTrendingUnboundSlots/);
  assert.match(
    migration,
    /state in \('planned', 'failed'\)[\s\S]*carousel_assignment_id is null/,
  );
});
