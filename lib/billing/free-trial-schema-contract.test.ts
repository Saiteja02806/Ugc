import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260827160000_add_free_trial_entitlements.sql",
    import.meta.url,
  ),
  "utf8",
);
const scheduleDatabase = readFileSync(
  new URL("../scheduling/db.ts", import.meta.url),
  "utf8",
);
const scheduleService = readFileSync(
  new URL("../scheduling/service.ts", import.meta.url),
  "utf8",
);
const feedRoute = readFileSync(
  new URL("../../app/api/trending/feed/route.ts", import.meta.url),
  "utf8",
);
const unifiedFeedDatabase = readFileSync(
  new URL("../trending/unified-daily-feed-db.ts", import.meta.url),
  "utf8",
);
const freeTrialAccess = readFileSync(
  new URL("./free-trial.ts", import.meta.url),
  "utf8",
);

test("free trial migration initializes new users and expires existing profiles", () => {
  assert.match(migration, /create table if not exists public\.free_trial_entitlements/);
  assert.match(migration, /new\.onboarding_completed_at \+ interval '3 days'/);
  assert.match(migration, /from public\.business_profiles as profile\s+on conflict/i);
  assert.match(migration, /now\(\) - interval '3 days'/);
  assert.match(migration, /create trigger grant_free_trial_on_onboarding_completion/i);
});

test("free trial content is database-enforced at ten pieces on three daily packs", () => {
  assert.match(migration, /daily_content_pieces integer not null default 10/);
  assert.match(migration, /content_days_limit integer not null default 3/);
  assert.match(migration, /create trigger enforce_free_trial_daily_trending_feed/i);
  assert.match(migration, /new\.daily_limit > trial\.daily_content_pieces/);
  assert.match(migration, /content_days_used >= trial\.content_days_limit/);
  assert.match(freeTrialAccess, /contentDaysRemaining <= 0/);
  assert.match(freeTrialAccess, /getContentDaysUsed/);
});

test("five Instagram schedules are atomically enforced and returned as an upgrade response", () => {
  assert.match(migration, /instagram_schedule_limit integer not null default 5/);
  assert.match(
    migration,
    /create table if not exists public\.free_trial_instagram_schedule_usage/,
  );
  assert.match(migration, /for update;[\s\S]*scheduled_post_count/);
  assert.match(migration, /free_trial_schedule_limit_reached/);
  assert.match(migration, /create trigger enforce_free_trial_instagram_schedule_limit/i);
  assert.match(scheduleDatabase, /free_trial_schedule_limit_reached/);
  assert.match(scheduleDatabase, /402/);
  assert.match(scheduleService, /assertInstagramTrialScheduleAccess/);
  assert.match(
    scheduleService,
    /connection\.platform === "instagram"[\s\S]*assertInstagramTrialScheduleAccess/,
  );
});

test("expired trials receive a clear Trending upgrade response", () => {
  assert.match(unifiedFeedDatabase, /free_trial_content_days_exhausted/);
  assert.match(unifiedFeedDatabase, /new FreeTrialAccessError/);
  assert.match(feedRoute, /error instanceof FreeTrialAccessError/);
  assert.match(feedRoute, /upgradeRequired: true/);
});
