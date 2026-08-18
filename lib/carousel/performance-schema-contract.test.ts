import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = read(
  "supabase/migrations/20260813122724_add_carousel_performance_learning.sql",
);
const analyticsWorker = read("app/api/internal/jobs/sync-analytics/route.ts");
const performanceLogic = read("lib/carousel/performance-logic.ts");
const performanceStore = read("lib/carousel/performance.ts");
const preparation = read("lib/carousel/prepare-business-profile.ts");
const selector = read("lib/carousel/content-selector.ts");

test("attributes only published, unedited generated Carousels", () => {
  assert.match(migration, /create table if not exists public\.carousel_performance_observations/i);
  assert.match(
    migration,
    /scheduled_post_targets as target[\s\S]*target\.status = 'published'/,
  );
  assert.match(
    migration,
    /post\.source_kind = 'library_item'[\s\S]*item\.source_type = 'generated_carousel'/,
  );
  assert.match(
    migration,
    /generation\.id::text = item\.source_id[\s\S]*generation\.status = 'completed'/,
  );
  assert.match(
    migration,
    /item\.metadata -> 'trendingCreativeEdit'[\s\S]*'null'::jsonb/,
  );
  assert.match(migration, /target\.user_id = p_user_id/);
  assert.match(migration, /target\.social_connection_id = p_social_connection_id/);
});

test("freezes one comparable seven-day snapshot and never replaces it", () => {
  assert.match(
    migration,
    /evaluation_due_at = published_at \+ interval '7 days'/,
  );
  assert.match(
    migration,
    /evaluation_due_at - interval '24 hours'[\s\S]*evaluation_due_at \+ interval '24 hours'/,
  );
  assert.match(
    migration,
    /if v_existing\.evaluated_at is not null then[\s\S]*return query select true, true/,
  );
  assert.match(
    migration,
    /where evaluated_at is not null and view_count is not null/,
  );
});

test("Carousel learning collects and stores views only", () => {
  const observationTable = migration.match(
    /create table if not exists public\.carousel_performance_observations \([\s\S]*?\n\);/i,
  )?.[0];

  assert.ok(observationTable);
  assert.match(observationTable, /view_count bigint/);

  for (const forbiddenMetric of [
    "reach_count",
    "interaction_count",
    "like_count",
    "comment_count",
    "share_count",
    "save_count",
  ]) {
    assert.doesNotMatch(observationTable, new RegExp(forbiddenMetric));
  }

  assert.match(migration, /p_view_count bigint/);
  assert.doesNotMatch(migration, /p_metrics jsonb/);
  assert.match(performanceStore, /p_view_count: params\.observation\.viewCount/);

  for (const forbiddenMetric of [
    "commentCount",
    "interactionCount",
    "likeCount",
    "reachCount",
    "saveCount",
    "shareCount",
  ]) {
    assert.doesNotMatch(performanceLogic, new RegExp(forbiddenMetric));
    assert.doesNotMatch(performanceStore, new RegExp(forbiddenMetric));
  }
});

test("performance storage is service-only and indexed for learning queries", () => {
  assert.match(
    migration,
    /alter table public\.carousel_performance_observations enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.carousel_performance_observations\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.carousel_performance_observations\s+to service_role/i,
  );
  assert.match(migration, /carousel_performance_profile_evaluated_idx/);
  assert.match(migration, /carousel_performance_generation_idx/);
  assert.match(migration, /carousel_performance_connection_idx/);
});

test("analytics records Carousel results best-effort and preparation consumes learned signals", () => {
  assert.match(analyticsWorker, /recordInstagramCarouselPerformance/);
  assert.match(
    analyticsWorker,
    /recordPerformanceSafely\("Carousel"[\s\S]*recordInstagramCarouselPerformance/,
  );
  assert.match(preparation, /getCarouselPerformanceSignals/);
  assert.match(preparation, /getCarouselStructure2PerformanceSignals/);
  assert.match(
    preparation,
    /performanceSignals:\s*structure1Performance/,
  );
  assert.match(
    preparation,
    /performanceSignals:\s*structure2Performance/,
  );
  assert.match(preparation, /selectionKey: params\.profile\.id/);
});

test("selector keeps bounded exploration and persists selection telemetry", () => {
  assert.match(selector, /FORMAT_EXPLORATION_SLOTS_PER_BATCH = 1/);
  assert.match(selector, /HOOK_EXPLORATION_RATE = 0\.25/);
  assert.match(selector, /performance_exploration/);
  assert.match(selector, /performance_weighted/);
  assert.match(migration, /rotation_candidate_format_id text/);
  assert.match(migration, /format_selection_multiplier numeric/);
  assert.match(migration, /hook_selection_multiplier numeric/);
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
