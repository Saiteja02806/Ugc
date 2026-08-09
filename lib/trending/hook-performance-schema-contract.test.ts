import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260808114912_create_hook_performance_observations.sql",
    import.meta.url,
  ),
  "utf8",
);
const learningMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260808114920_add_hook_performance_learning_signals.sql",
    import.meta.url,
  ),
  "utf8",
);
const analyticsWorker = readFileSync(
  new URL(
    "../../app/api/internal/jobs/sync-analytics/route.ts",
    import.meta.url,
  ),
  "utf8",
);

test("Hook performance is attributed through a published schedule and selected Hook", () => {
  assert.match(
    migration,
    /scheduled_post_targets target[\s\S]*target\.status = 'published'/,
  );
  assert.match(
    migration,
    /hook_video_drafts draft[\s\S]*draft\.selected_hook_id/,
  );
  assert.match(
    migration,
    /target\.user_id = p_user_id[\s\S]*draft\.user_id = p_user_id/,
  );
  assert.match(migration, /on conflict \(scheduled_post_target_id\)/);
});

test("unsupported outcome metrics remain nullable instead of receiving defaults", () => {
  for (const column of [
    "watch_time_seconds",
    "average_watch_time_seconds",
    "completion_rate",
    "click_count",
    "conversion_count",
    "attributed_sales_amount",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`));
    assert.doesNotMatch(
      migration,
      new RegExp(`${column}[^,\\n]*default\\s+`, "i"),
    );
  }
});

test("analytics sync records performance without making analytics unavailable on attribution failure", () => {
  assert.match(analyticsWorker, /recordInstagramHookPerformance/);
  assert.match(analyticsWorker, /recordTikTokHookPerformance/);
  assert.match(
    analyticsWorker,
    /recordHookPerformanceSafely[\s\S]*try[\s\S]*catch/,
  );
});

test("performance learning uses only published, user-scoped Hook observations", () => {
  assert.match(learningMigration, /hook_performance_observations as observation/);
  assert.match(learningMigration, /suggestion\.id = observation\.hook_video_suggestion_id/);
  assert.match(learningMigration, /observation\.user_id = p_user_id/);
  assert.match(learningMigration, /suggestion\.business_profile_id = p_business_profile_id/);
  assert.match(learningMigration, /suggestion\.campaign_purpose/);
  assert.match(learningMigration, /attributed_sales_currency/);
});
