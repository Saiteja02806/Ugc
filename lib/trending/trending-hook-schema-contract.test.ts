import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260728183858_add_trending_hook_ideas.sql",
    import.meta.url,
  ),
  "utf8",
);
const indexMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260728184236_index_trending_hook_foreign_keys.sql",
    import.meta.url,
  ),
  "utf8",
);
const copyWorkerMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260729113000_add_validated_trending_hook_copy_worker.sql",
    import.meta.url,
  ),
  "utf8",
);
const legacyCompatibilityMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260729114500_preserve_legacy_trending_hook_candidate_contract.sql",
    import.meta.url,
  ),
  "utf8",
);
const patternedCopyMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260729191556_add_patterned_trending_hook_copy_v3.sql",
    import.meta.url,
  ),
  "utf8",
);
const tightenedHookMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260730120000_tighten_trending_hook_opening_v4.sql",
    import.meta.url,
  ),
  "utf8",
);
const threeLineOverlayMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260811120000_expand_hook_overlay_to_three_lines.sql",
    import.meta.url,
  ),
  "utf8",
);
const globalFormatsMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260813150000_add_global_hook_text_formats_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const globalFormatsRegistry = readFileSync(
  new URL(
    "../../worker/src/lib/trending-hook-text-formats.ts",
    import.meta.url,
  ),
  "utf8",
);
const hookFeedSource = readFileSync(
  new URL("./trending-hook-feed.ts", import.meta.url),
  "utf8",
);
const hookJobsSource = readFileSync(
  new URL("./trending-hook-copy-jobs.ts", import.meta.url),
  "utf8",
);
const hookWorkerJobSource = readFileSync(
  new URL(
    "../../worker/src/jobs/generate-trending-hook-copy.ts",
    import.meta.url,
  ),
  "utf8",
);
const hookWorkerCopySource = readFileSync(
  new URL(
    "../../worker/src/lib/trending-hook-copy.ts",
    import.meta.url,
  ),
  "utf8",
);

test("stores pre-demo Hook text separately from demo-based composition text", () => {
  assert.match(
    migration,
    /suggestion_context\s+text\s+not null default 'composition'/i,
  );
  assert.match(migration, /suggestion_context in \('composition', 'trending'\)/i);
  assert.match(migration, /alter column demo_asset_id drop not null/i);
  assert.match(
    migration,
    /suggestion_context = 'trending'[\s\S]*demo_asset_id is null/i,
  );
});

test("keeps validated Hook results when one source candidate fails review", () => {
  assert.match(
    hookWorkerJobSource,
    /allowPartialCandidates: true/,
  );
  assert.match(
    hookWorkerCopySource,
    /if \(params\.allowPartialCandidates\)[\s\S]*failures\.push\(message\)[\s\S]*return \[\]/,
  );
  assert.match(
    hookFeedSource,
    /Math\.max\(targetActive - activeCount, 6\)/,
  );
});

test("tracks Hook feed assignments without changing Carousel assignments", () => {
  assert.match(
    migration,
    /create table if not exists public\.user_hook_video_assignments/i,
  );
  assert.match(
    migration,
    /state in \('active', 'completed_skipped', 'selected'\)/i,
  );
  assert.doesNotMatch(migration, /alter table public\.user_carousel_assignments/i);
});

test("persists variable source and trimmed Hook durations", () => {
  assert.match(migration, /duration_seconds numeric/i);
  assert.match(migration, /source_duration_seconds numeric/i);
  assert.match(migration, /trim_start numeric/i);
  assert.match(migration, /trim_end numeric/i);
});

test("indexes Trending Hook assignment foreign keys", () => {
  assert.match(
    indexMigration,
    /on public\.user_hook_video_assignments \(business_profile_id\)/i,
  );
  assert.match(
    indexMigration,
    /on public\.user_hook_video_assignments \(hook_suggestion_id\)/i,
  );
});

test("persists only AI-reviewed, visually fitting Hook copy generations", () => {
  assert.match(
    copyWorkerMigration,
    /generate_trending_hook_copy/i,
  );
  assert.match(
    copyWorkerMigration,
    /persist_trending_hook_copy_generation/i,
  );
  assert.match(
    copyWorkerMigration,
    /readabilityReview,readable[\s\S]*'true'/i,
  );
  assert.match(
    copyWorkerMigration,
    /readabilityReview,estimatedReadingSeconds[\s\S]*durationSeconds/i,
  );
  assert.match(
    copyWorkerMigration,
    /visualFit,fits[\s\S]*'true'/i,
  );
});

test("supersedes only active feed assignments and preserves saved selections", () => {
  assert.match(
    copyWorkerMigration,
    /state in \([\s\S]*'superseded'[\s\S]*\)/i,
  );
  assert.match(
    copyWorkerMigration,
    /where user_id = p_user_id[\s\S]*and state = 'active'/i,
  );
  assert.doesNotMatch(
    copyWorkerMigration,
    /delete from public\.hook_video_suggestions/i,
  );
  assert.doesNotMatch(
    copyWorkerMigration,
    /delete from public\.hook_video_drafts/i,
  );
});

test("keeps the deployed v1 candidate conflict target compatible", () => {
  assert.match(
    legacyCompatibilityMigration,
    /hook_video_suggestions_trending_candidate_unique unique/i,
  );
  assert.match(
    legacyCompatibilityMigration,
    /coalesce\(max\(suggestion\.candidate_index\), -1\) \+ 1/i,
  );
  assert.match(
    legacyCompatibilityMigration,
    /position = suggestion\.candidate_index - slot_base/i,
  );
  assert.doesNotMatch(
    legacyCompatibilityMigration,
    /delete from public\.hook_video_suggestions/i,
  );
});

test("persists v3 Hook patterns, semantic lines, and hard-validation evidence", () => {
  assert.match(patternedCopyMigration, /opening_lines jsonb/i);
  assert.match(patternedCopyMigration, /pattern_library_version text/i);
  assert.match(patternedCopyMigration, /validator_version text/i);
  assert.match(patternedCopyMigration, /input_context_hash text/i);
  assert.match(
    patternedCopyMigration,
    /readabilityReview,scores,total[\s\S]*between 80 and 100/i,
  );
  assert.match(
    patternedCopyMigration,
    /visualFit,overlayVersion[\s\S]*hook-overlay-v3/i,
  );
});

test("persists v4 Hooks only after opening, evidence, and human-voice gates pass", () => {
  assert.match(
    tightenedHookMigration,
    /persist_trending_hook_copy_generation_v4/i,
  );
  assert.match(
    tightenedHookMigration,
    /jsonb_array_length\(candidate -> 'openingLines'\) not between 1 and 2/i,
  );
  assert.match(
    tightenedHookMigration,
    /trending-hook-patterns-v2/i,
  );
  assert.match(
    tightenedHookMigration,
    /problem_observation/i,
  );
  assert.match(
    tightenedHookMigration,
    /validation,evidenceBindings/i,
  );
  assert.match(
    tightenedHookMigration,
    /readabilityReview,humanVoice[\s\S]*readabilityReview,openingOnly[\s\S]*readabilityReview,singleIdea/i,
  );
  assert.match(
    tightenedHookMigration,
    /from public, anon, authenticated/i,
  );
  assert.match(tightenedHookMigration, /to service_role/i);
});

test("the current Hook persistence contract accepts up to three semantic lines", () => {
  assert.match(
    threeLineOverlayMigration,
    /jsonb_array_length\(opening_lines\) between 1 and 3/i,
  );
  assert.match(
    threeLineOverlayMigration,
    /jsonb_array_length\(v_lines\) not between 1 and 3/i,
  );
  assert.match(
    threeLineOverlayMigration,
    /visualFit,semanticLineCount[\s\S]*between 1 and 3/i,
  );
  assert.match(
    threeLineOverlayMigration,
    /visualFit,renderedLineCount[\s\S]*between 1 and 3/i,
  );
});

test("V7 stores Global writing formats without changing visual or audio format records", () => {
  assert.match(globalFormatsMigration, /create table if not exists public\.hook_text_formats/);
  assert.match(globalFormatsMigration, /create table if not exists public\.hook_text_format_variants/);
  assert.match(globalFormatsMigration, /create table if not exists public\.hook_text_format_evidence/);
  assert.match(globalFormatsMigration, /add column if not exists hook_text_format_id/);
  assert.match(globalFormatsMigration, /persist_trending_hook_copy_generation_v7/);
  assert.match(globalFormatsMigration, /global-format-rotation-v1/);
  assert.match(globalFormatsMigration, /pattern_id = null/);
  assert.equal(
    new Set(globalFormatsMigration.match(/GF_\d{3}/g) ?? []).size,
    18,
  );
  assert.equal(
    new Set(globalFormatsMigration.match(/GF_\d{3}_[A-Z]/g) ?? []).size,
    31,
  );
  assert.deepEqual(
    [...new Set(globalFormatsMigration.match(/GF_\d{3}_[A-Z]/g) ?? [])]
      .sort(),
    [...new Set(globalFormatsRegistry.match(/GF_\d{3}_[A-Z]/g) ?? [])]
      .sort(),
  );
  assert.doesNotMatch(globalFormatsMigration, /alter table public\.hook_formats/);
  assert.doesNotMatch(globalFormatsMigration, /update public\.hook_audio_assets/);
});

test("refills Hook ideas from unused videos with one deduplicated batch", () => {
  assert.match(
    hookFeedSource,
    /mode\?: "initial" \| "refill"[\s\S]+active\.length >= targetActive/,
  );
  assert.match(
    hookFeedSource,
    /mode === "initial" && active\.length === 0[\s\S]+mode = "refill"/,
  );
  assert.match(
    hookFeedSource,
    /usedVideoIds[\s\S]+!usedVideoIds\.has\(entry\.video\.id\)/,
  );
  assert.match(
    hookFeedSource,
    /refillKey: mode === "refill" \? String\(existing\.length\) : null/,
  );
  assert.match(
    hookJobsSource,
    /refillKey\?: string \| null[\s\S]+refill-\$\{params\.refillKey\}/,
  );
  assert.match(
    hookJobsSource,
    /job\.status === "failed" \|\| job\.status === "cancelled"[\s\S]+replacement:\$\{job\.id\}/,
  );
});
