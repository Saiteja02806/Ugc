import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const creativeMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260726100000_create_trending_wall_text_creatives.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260728104054_add_wall_text_video_catalog_metadata.sql",
    import.meta.url,
  ),
  "utf8",
);
const unifiedCopyMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260728183932_wall_text_unified_copy_v2.sql",
    import.meta.url,
  ),
  "utf8",
);
const renderingMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260729100000_add_wall_text_content_rendering.sql",
    import.meta.url,
  ),
  "utf8",
);
const renderSchemaRepairMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260808072043_repair_wall_text_render_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const renderEditIndexMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260808072642_index_wall_text_render_edit.sql",
    import.meta.url,
  ),
  "utf8",
);
const semanticOverlayMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260730061012_wall_text_semantic_overlay_v3.sql",
    import.meta.url,
  ),
  "utf8",
);
const sixSecondMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260730192903_wall_text_six_second_v4.sql",
    import.meta.url,
  ),
  "utf8",
);
const qualityMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260730201500_wall_text_prompt_quality_v5.sql",
    import.meta.url,
  ),
  "utf8",
);
const oneCallFormatsMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260812135048_wall_text_one_call_formats_v6.sql",
    import.meta.url,
  ),
  "utf8",
);
const generationV7Migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260814141455_add_wall_text_generation_v7_architecture.sql",
    import.meta.url,
  ),
  "utf8",
);
const sixSecondSourceMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260824160000_enforce_wall_text_six_second_sources.sql",
    import.meta.url,
  ),
  "utf8",
);
const semiboldTypographyMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260824170000_allow_wall_text_semibold_typography.sql",
    import.meta.url,
  ),
  "utf8",
);
const lighterTypographyMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825130000_add_wall_text_lighter_typography_v8.sql",
    import.meta.url,
  ),
  "utf8",
);
const balancedLayoutMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260826160000_add_wall_text_balanced_layout_v9.sql",
    import.meta.url,
  ),
  "utf8",
);
const reservationCollisionMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260830130908_prevent_wall_text_background_reservation_collisions.sql",
    import.meta.url,
  ),
  "utf8",
);
const backgroundReuseMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260830190443_allow_wall_text_background_reuse_after_fresh_rotation.sql",
    import.meta.url,
  ),
  "utf8",
);
const generatorSource = readFileSync(
  new URL("./generate-trending-wall-text-ideas.ts", import.meta.url),
  "utf8",
);
const formatsSource = readFileSync(
  new URL("./wall-formats.ts", import.meta.url),
  "utf8",
);
const promptSource = readFileSync(
  new URL("./wall-prompt.ts", import.meta.url),
  "utf8",
);
const layoutEngineSource = readFileSync(
  new URL("./wall-layout-engine.ts", import.meta.url),
  "utf8",
);
const textLogicSource = readFileSync(
  new URL("./wall-text-text-logic.ts", import.meta.url),
  "utf8",
);
const visualStyleSource = readFileSync(
  new URL("./wall-text-visual-style.ts", import.meta.url),
  "utf8",
);
const renderValidationSource = readFileSync(
  new URL("./wall-text-render-validation.ts", import.meta.url),
  "utf8",
);
const workerRenderSpecSource = readFileSync(
  new URL("../../worker/src/lib/wall-text-render-spec.ts", import.meta.url),
  "utf8",
);
const workerRenderEngineSource = readFileSync(
  new URL("../../worker/src/lib/render-engine.ts", import.meta.url),
  "utf8",
);
const fontMeasurementSource = readFileSync(
  new URL("./wall-text-font.ts", import.meta.url),
  "utf8",
);
const overlaySource = readFileSync(
  new URL("../../components/trending/wall-text-overlay.tsx", import.meta.url),
  "utf8",
);
const editorSource = readFileSync(
  new URL("../../components/trending/trending-creative-editor.tsx", import.meta.url),
  "utf8",
);
const rootLayoutSource = readFileSync(
  new URL("../../app/layout.tsx", import.meta.url),
  "utf8",
);
const nextConfigSource = readFileSync(
  new URL("../../next.config.ts", import.meta.url),
  "utf8",
);
const feedSource = readFileSync(
  new URL("./trending-wall-text-feed.ts", import.meta.url),
  "utf8",
);
const databaseSource = readFileSync(
  new URL("./wall-text-db.ts", import.meta.url),
  "utf8",
);
const jobsSource = readFileSync(
  new URL("./wall-text-jobs.ts", import.meta.url),
  "utf8",
);
const internalPreparationRoute = readFileSync(
  new URL(
    "../../app/api/internal/jobs/prepare-wall-text/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const workerPreparationClient = readFileSync(
  new URL(
    "../../worker/src/lib/wall-text-preparation.ts",
    import.meta.url,
  ),
  "utf8",
);
const migration =
  `${creativeMigration}\n${catalogMigration}\n${unifiedCopyMigration}\n${renderingMigration}\n${semanticOverlayMigration}\n${sixSecondMigration}\n${qualityMigration}`;

test("stores user-specific Wall ideas without duplicating source videos", () => {
  assert.match(
    migration,
    /create table if not exists public\.wall_text_creatives/i,
  );
  assert.match(
    migration,
    /overlay_media_asset_id uuid not null[\s\S]+references public\.overlay_media_assets/i,
  );
  assert.match(
    migration,
    /business_profile_id uuid not null[\s\S]+business_profile_version integer not null/i,
  );
  assert.match(
    migration,
    /constraint wall_text_creatives_profile_asset_key unique/i,
  );
});

test("validates profile ownership and reviewed video metadata in the database", () => {
  assert.match(
    migration,
    /profile\.user_id = new\.user_id[\s\S]+profile\.profile_version = new\.business_profile_version/i,
  );
  assert.match(
    migration,
    /asset\.asset_type = 'video'[\s\S]+asset\.aspect_ratio = '9:16'[\s\S]+asset\.status = 'active'[\s\S]+asset\.analysis_status = 'succeeded'[\s\S]+asset\.duration_seconds > 0[\s\S]+asset\.source_file_sha256 is not null[\s\S]+asset\.source_batch is not null[\s\S]+asset\.visual_group is not null/i,
  );
});

test("requires every active Wall source video to be at least six seconds", () => {
  assert.match(
    sixSecondSourceMigration,
    /status <> 'active'[\s\S]+asset_type <> 'video'[\s\S]+format_family <> 'wall_text_overlay'[\s\S]+duration_seconds >= 6/i,
  );
  assert.match(
    sixSecondSourceMigration,
    /validate constraint overlay_media_assets_active_wall_min_duration_chk/i,
  );
});

test("preserves the historical 600/700 migration while the current renderer normalizes to 400", () => {
  assert.match(
    semiboldTypographyMigration,
    /layoutVersion' = 'wall-text-overlay-v6'[\s\S]+fontWeight'\)::integer in \(600, 700\)/i,
  );
  assert.match(
    semiboldTypographyMigration,
    /add constraint wall_text_creatives_text_content_chk[\s\S]+not valid[\s\S]+validate constraint wall_text_creatives_text_content_chk/i,
  );
  assert.doesNotMatch(
    semiboldTypographyMigration,
    /update\s+public\.wall_text_creatives/i,
  );
});

test("makes the lighter V8 Wall layout persistent and re-layoutable", () => {
  assert.match(
    lighterTypographyMigration,
    /set default 'business-profile-wall-text-v8'/i,
  );
  assert.match(
    lighterTypographyMigration,
    /fontWeight'\)::integer in \(400, 600, 700\)/i,
  );
  assert.match(
    lighterTypographyMigration,
    /fontSizePx'\)::integer in \(36, 38, 40, 42, 44, 46, 48, 50, 52\)/i,
  );
  assert.match(
    lighterTypographyMigration,
    /replace_wall_text_creative_copy_v8[\s\S]+expected_count < 1 or expected_count > 50[\s\S]+generator_version = 'business-profile-wall-text-v8'/i,
  );
});

test("stores the balanced V9 layout while preserving old selected drafts", () => {
  assert.match(
    balancedLayoutMigration,
    /set default 'business-profile-wall-text-v9'/i,
  );
  assert.match(
    balancedLayoutMigration,
    /generator_version = 'business-profile-wall-text-v9'[\s\S]+between 5 and 8/i,
  );
  assert.match(
    balancedLayoutMigration,
    /generator_version <> 'business-profile-wall-text-v9'[\s\S]+between 4 and 7/i,
  );
  assert.match(
    balancedLayoutMigration,
    /replace_wall_text_creative_copy_v9[\s\S]+generator_version = 'business-profile-wall-text-v9'/i,
  );
  assert.match(databaseSource, /replace_wall_text_creative_copy_v9/);
});

test("stores one visual group, source batch, and SHA-256 per source video", () => {
  assert.match(
    catalogMigration,
    /add column if not exists source_file_sha256 text[\s\S]+add column if not exists source_batch text[\s\S]+add column if not exists visual_group text/i,
  );
  assert.match(
    catalogMigration,
    /create unique index if not exists overlay_media_assets_wall_video_sha256_idx/i,
  );
  assert.match(
    catalogMigration,
    /wall-text-layout-v2/i,
  );
});

test("supports one unified v2 text value and refreshes v1 rows in place", () => {
  assert.match(
    unifiedCopyMigration,
    /wall-text-overlay-v2[\s\S]+jsonb_typeof\(text_content -> 'text'\) = 'string'/i,
  );
  assert.match(
    unifiedCopyMigration,
    /create or replace function public\.replace_wall_text_creative_copy_v2[\s\S]+security invoker/i,
  );
  assert.match(
    unifiedCopyMigration,
    /update public\.wall_text_creatives[\s\S]+generator_version = 'business-profile-wall-text-v2'[\s\S]+text_content = update_item\.text_content/i,
  );
  assert.doesNotMatch(
    unifiedCopyMigration,
    /delete\s+from\s+public\.wall_text_creatives/i,
  );
  assert.match(
    unifiedCopyMigration,
    /revoke all on function public\.replace_wall_text_creative_copy_v2[\s\S]+from public, anon, authenticated[\s\S]+grant execute[\s\S]+to service_role/i,
  );
});

test("does not retain the superseded multi-pass Wall generator", () => {
  assert.doesNotMatch(
    generatorSource,
    /MAX_WALL_TEXT_GENERATION_ATTEMPTS|MAX_WALL_TEXT_REVIEW_ATTEMPTS/,
  );
  /* Historical assertions retained here only as documentation of the removed
     contract. They are intentionally not executed.
  assert.match(generatorSource, /const DEFAULT_MODEL = "gpt-5-mini"/);
  assert.match(generatorSource, /reasoning_effort: "low"/);
  assert.match(
    generatorSource,
    /const businessProfile = buildWallTextBusinessContext\(params\.business\)/,
  );
  assert.match(
    generatorSource,
    /segments: z\.array\(WallTextSegmentSchema\)\.min\(2\)\.max\(3\)/,
  );
  assert.match(
    generatorSource,
    /fullText: z\.string\(\)\.trim\(\)\.min\(12\)\.max\(300\)/,
  );
  assert.match(
    generatorSource,
    /validateWallTextRenderFit[\s\S]+WallTextReviewSchema/,
  );
  assert.match(
    generatorSource,
    /MAX_WALL_TEXT_GENERATION_ATTEMPTS = 4[\s\S]+previous draft failed validation[\s\S]+revisionFeedback/i,
  );
  assert.match(
    generatorSource,
    /Promise\.all\([\s\S]+generateWallTextCandidateWithRepair[\s\S]+candidates: \[params\.candidate\]/,
  );
  assert.match(
    generatorSource,
    /Target \$\{WALL_TEXT_PREFERRED_MIN_WORDS\}–\$\{WALL_TEXT_PREFERRED_MAX_WORDS\} words[\s\S]+Return \$\{MIN_WALL_TEXT_RENDERED_LINES\}–\$\{MAX_WALL_TEXT_RENDERED_LINES\} short semantic lines[\s\S]+Never return one, two, or three Hook-style lines/i,
  );
  assert.match(
    generatorSource,
    /problem_change_result[\s\S]+mistake_correction[\s\S]+situation_discovery[\s\S]+before_after[\s\S]+belief_reframe[\s\S]+action_benefit/i,
  );
  assert.match(
    generatorSource,
    /requiredPattern: getWallTextPatternForCandidate[\s\S]+requiredPatternStructure/i,
  );
  assert.match(
    generatorSource,
    /synchronizeWallTextFullText[\s\S]+flatMap\(\(segment\) => segment\.lines\)/,
  );
  assert.match(
    generatorSource,
    /MAX_WALL_TEXT_REVIEW_ATTEMPTS = 3[\s\S]+internally inconsistent[\s\S]+previousReviewFailure/i,
  );
  assert.match(generatorSource, /must never use a two-line Hook rule/i); */
});

test("uses one batched GPT-5 mini Writer request per normal ten-candidate chunk", () => {
  assert.match(generatorSource, /const DEFAULT_MODEL = "gpt-5-mini"/);
  assert.match(generatorSource, /reasoning_effort: "low"/);
  assert.match(
    generatorSource,
    /const business = buildWallTextBusinessContext\(params\.business\)/,
  );
  assert.equal(
    generatorSource.match(/chat\.completions\.parse/g)?.length,
    1,
    "the batch generator must make exactly one AI request",
  );
  assert.match(generatorSource, /candidateIndex:[\s\S]+text: z\.string/);
  assert.doesNotMatch(generatorSource, /formatId: EligibleWallTextFormatIdSchema/);
  assert.match(
    generatorSource,
    /buildWallTextGenerationPrompt\([\s\S]+business: params\.business[\s\S]+candidates: params\.candidates/,
  );
  assert.match(generatorSource, /MAX_WRITER_RETRIES = 2/);
  assert.match(generatorSource, /pending = failures\.map/);
  assert.ok(
    generatorSource.indexOf("if (params.onChunkAccepted") <
      generatorSource.indexOf("if (attempt === MAX_WRITER_RETRIES)"),
    "valid candidates must be persisted before a failed candidate exhausts repair",
  );
  assert.doesNotMatch(generatorSource, /reviewer|embeddings?/i);
  assert.match(
    promptSource,
    /natural continuous Wall-of-Text language[\s\S]+do not insert newline characters/i,
  );
  assert.match(
    promptSource,
    /Return exactly one result for every candidate\. Do not return formatId, duration, coordinates, or final visual lines\./,
  );
});

test("persists stable batches, original chunks, assignments, budgets, and placement", () => {
  assert.match(
    generationV7Migration,
    /create table if not exists public\.wall_text_generation_batches[\s\S]+requested_count integer not null check \(requested_count between 1 and 50\)/i,
  );
  assert.match(
    generationV7Migration,
    /create table if not exists public\.wall_text_generation_chunks[\s\S]+candidate_count integer not null check \(candidate_count between 1 and 10\)[\s\S]+idempotency_key text not null unique/i,
  );
  assert.match(
    generationV7Migration,
    /create table if not exists public\.wall_text_generation_assignments[\s\S]+duration_seconds numeric\(8, 3\) not null[\s\S]+layout_json jsonb not null[\s\S]+target_words integer not null[\s\S]+max_words integer not null/i,
  );
  assert.match(
    generationV7Migration,
    /create or replace function public\.claim_wall_text_generation_chunk_v1[\s\S]+returns uuid[\s\S]+claim_token = next_claim_token[\s\S]+status = 'processing'/i,
  );
  assert.match(
    generationV7Migration,
    /save_wall_text_generation_candidate_v1[\s\S]+chunk\.claim_token = p_claim_token[\s\S]+wall_text_generation_candidate_stale_claim/i,
  );
  assert.match(
    generationV7Migration,
    /record_wall_text_generation_chunk_failure_v1[\s\S]+case when p_retryable then 'retry_pending' else 'failed' end/i,
  );
  const prepareSource = feedSource.match(
    /export async function prepareTrendingWallTextIdeas[\s\S]+?export async function getTrendingWallTextFeedProvider/,
  )?.[0] ?? "";
  assert.ok(
    prepareSource.indexOf("getWallTextGenerationReservation") <
      prepareSource.indexOf("resolveTrendingVideoSource"),
    "a retry must load its saved reservation before selecting fresh videos",
  );
  assert.match(
    feedSource,
    /groupReservedAssignmentsByChunk[\s\S]+claimWallTextGenerationChunk[\s\S]+onChunkAccepted[\s\S]+saveWallTextGenerationCandidate/,
  );
});

test("prevents concurrent Wall refills while allowing completed backgrounds to recycle", () => {
  assert.match(
    databaseSource,
    /export async function listReservedWallTextBackgroundAssetIds[\s\S]+\.in\("status", \["pending", "processing", "retry_pending"\]\)/,
  );
  assert.match(
    feedSource,
    /listReservedWallTextBackgroundAssetIds[\s\S]+reservedBackgroundAssetIds[\s\S]+availableInventory/,
  );
  assert.match(
    feedSource,
    /freshUgcpilotCandidates[\s\S]+recycledUgcpilotCandidates[\s\S]+selectFreshThenRecycledWallTextGenerationSources/,
  );
  assert.doesNotMatch(feedSource, /unavailableBackgroundAssetIds/);
  assert.match(
    reservationCollisionMigration,
    /create trigger enforce_wall_text_generation_assignment_background_uniqueness_trigger[\s\S]+before insert or update of batch_id, overlay_media_asset_id/i,
  );
  assert.match(
    backgroundReuseMigration,
    /create or replace function public\.enforce_wall_text_generation_assignment_background_uniqueness\(\)[\s\S]+pg_catalog\.pg_advisory_xact_lock[\s\S]+assignment\.status in \('pending', 'processing', 'retry_pending'\)[\s\S]+wall_text_background_already_reserved/i,
  );
  assert.doesNotMatch(backgroundReuseMigration, /wall_text_background_already_used/);
});

test("keeps each Instagram Reel video, reference, safe box, and locked audio together", () => {
  assert.match(
    generationV7Migration,
    /create table if not exists public\.wall_text_instagram_reel_templates[\s\S]+overlay_media_asset_id uuid not null unique[\s\S]+locked_audio_asset_id text not null unique[\s\S]+reference_text text not null[\s\S]+safe_text_box jsonb not null/i,
  );
  assert.match(
    generationV7Migration,
    /wall_text_generation_assignments_source_chk[\s\S]+source_kind = 'instagram_reel'[\s\S]+instagram_reel_template_id is not null/i,
  );
  assert.match(
    feedSource,
    /listActiveWallTextInstagramReelTemplates[\s\S]+instagramReferenceText:[\s\S]+instagramReferenceTextHash:/,
  );
  assert.match(
    feedSource,
    /assignment\.instagram_reference_text[\s\S]+referenceText: assignment\.instagram_reference_text/,
  );
  assert.match(
    feedSource,
    /source\.selection[\s\S]+Promise\.resolve\(\[\]\)[\s\S]+listActiveWallTextInstagramReelTemplates/,
  );
  assert.match(
    promptSource,
    /Reference text is not evidence[\s\S]+Never repeat its numbers, psychology statements, factual claims, product names, or promises/i,
  );
});

test("keeps historical duplicate protection outside the Writer prompt", () => {
  assert.match(
    generationV7Migration,
    /wall_text_content_history_exact_duplicate_key[\s\S]+unique \(user_id, business_profile_id, content_hash\)/i,
  );
  assert.match(
    databaseSource,
    /listWallTextDuplicateSignatures[\s\S]+wall_text_content_history/,
  );
  assert.match(
    generatorSource,
    /createWallTextDuplicateSignature[\s\S]+findWallTextDuplicate/,
  );
  assert.doesNotMatch(promptSource, /historicalSignatures|previous Wall texts/i);
});

test("learns from views only after the fixed 72-96 hour observation window", () => {
  assert.match(
    generationV7Migration,
    /create table if not exists public\.wall_text_performance_observations[\s\S]+view_count bigint/i,
  );
  assert.doesNotMatch(
    generationV7Migration.match(
      /create table if not exists public\.wall_text_performance_observations[\s\S]+?\);/i,
    )?.[0] ?? "",
    /like_count|comment_count|share_count|save_count/i,
  );
  assert.match(
    generationV7Migration,
    /p_observed_at < v_published_at \+ interval '72 hours'[\s\S]+p_observed_at > v_published_at \+ interval '96 hours'/i,
  );
});

test("stores every manual Wall edit for duplicates but excludes major edits from learning", () => {
  assert.match(
    generationV7Migration,
    /save_wall_text_edit_with_history_v1[\s\S]+p_edit_classification not in \('none', 'minor', 'major'\)[\s\S]+learning_eligible :=[\s\S]+p_edit_classification in \('none', 'minor'\)/i,
  );
  assert.match(
    generationV7Migration,
    /insert into public\.wall_text_content_history[\s\S]+on conflict \(user_id, business_profile_id, content_hash\) do nothing/i,
  );
  assert.match(
    generationV7Migration,
    /coalesce\(\(media\.metadata ->> 'formatLearningEligible'\)::boolean, false\)[\s\S]+history\.performance_eligible/i,
  );
});

test("keeps the approved thirty Wall formats in one controlled registry", () => {
  const expectedFormatIds = [
    "hidden_alternative",
    "manual_automatic",
    "secret_advantage",
    "outcome_mystery",
    "community_question",
    "internal_conflict",
  ];

  assert.equal(formatsSource.match(/\n  format\(/g)?.length, 30);
  for (const formatId of expectedFormatIds) {
    assert.match(formatsSource, new RegExp(`"${formatId}"`));
  }
  assert.match(
    formatsSource,
    /requiresFirstPersonEvidence: true[\s\S]+getEligibleWallTextFormats/,
  );
});

test("measures final Wall lines with Inter before saving authoritative layout", () => {
  assert.match(layoutEngineSource, /fontFamily: "Inter"/);
  assert.match(layoutEngineSource, /sharp\([\s\S]+\.metadata\(\)/);
  assert.match(layoutEngineSource, /finalLayout,/);
  assert.match(layoutEngineSource, /blocks,/);
  assert.match(layoutEngineSource, /fontSizePx: fontSize/);
  assert.match(layoutEngineSource, /lineHeightPx,/);
  assert.match(layoutEngineSource, /textBox: params\.layout\.textBox/);
  assert.match(layoutEngineSource, /maximumWidth = getWallTextSafeLineWidth\(textBoxWidth\)/);
  assert.match(visualStyleSource, /WALL_TEXT_INLINE_SAFE_PADDING = 15/);
  assert.match(visualStyleSource, /WALL_TEXT_OUTLINE_WIDTH = 4/);
  assert.match(
    renderValidationSource,
    /maximumTextWidth = getWallTextSafeLineWidth\(textBoxWidth\)/,
  );
  assert.match(workerRenderSpecSource, /WALL_TEXT_INLINE_SAFE_PADDING = 15/);
  assert.match(workerRenderSpecSource, /WALL_TEXT_OUTLINE_WIDTH = 4/);
  assert.match(
    workerRenderEngineSource,
    /textBox\.width \* WALL_TEXT_RENDER_WIDTH\)[\s\S]+WALL_TEXT_INLINE_SAFE_PADDING \* 2/,
  );
  assert.match(overlaySource, /boxSizing: "border-box"[\s\S]+paddingInline/);
  assert.match(editorSource, /boxSizing: "border-box"[\s\S]+paddingInline/);
  assert.match(
    layoutEngineSource,
    /rebalanceInternalLines[\s\S]+measureLines[\s\S]+getLineBalanceScore/,
  );
  assert.match(
    layoutEngineSource,
    /widths\.some\(\(width\) => width >= maximumWidth\)/,
  );
});

test("runs the final render-fit gate before generated Wall copy reaches storage", () => {
  const arrangeIndex = generatorSource.indexOf(
    "createAuthoritativeWallTextContent({",
  );
  const validateIndex = generatorSource.indexOf(
    "validateWallTextRenderFit(authoritative.content)",
  );
  const applyIndex = generatorSource.indexOf(
    "applyWallTextRenderFit(authoritative.content, render)",
  );
  const saveFunction = databaseSource.match(
    /export async function saveWallTextGenerationCandidate[\s\S]+?return creative;/,
  )?.[0] ?? "";

  assert.ok(arrangeIndex >= 0);
  assert.ok(validateIndex > arrangeIndex);
  assert.ok(applyIndex > validateIndex);
  assert.match(
    saveFunction,
    /prepareWallTextForPersistence\([\s\S]+p_text_content: toJson\(renderSafeText\)/,
  );
  assert.match(
    databaseSource,
    /replaceTrendingWallTextCreativeCopy[\s\S]+prepareWallTextForPersistence\(/,
  );
  assert.match(
    databaseSource,
    /createTrendingWallTextCreatives[\s\S]+prepareWallTextForPersistence\(/,
  );
  assert.match(layoutEngineSource, /renderSafetyVersion: WALL_TEXT_RENDER_SAFETY_VERSION/);
  assert.match(
    databaseSource,
    /content\??\.renderSafetyVersion === WALL_TEXT_RENDER_SAFETY_VERSION/,
  );
  assert.match(
    databaseSource,
    /text\.renderSafetyVersion !== WALL_TEXT_RENDER_SAFETY_VERSION/,
  );
});

test("rejects the reported overflow and synchronizes a safe fallback font", () => {
  const loaderPath = new URL(
    "../../scripts/next-server-only-test-loader.mjs",
    import.meta.url,
  ).href;
  const engineUrl = new URL("wall-layout-engine.ts", import.meta.url).href;
  const validationUrl = new URL(
    "wall-text-render-validation.ts",
    import.meta.url,
  ).href;
  const original =
    "Working with classmates or teammates becomes calmer when real-time collaboration lets everyone update tasks together, keeping conversations focused and responsibilities clearly shared across the group.";
  const script = `
    const [engine, validation] = await Promise.all([
      import(${JSON.stringify(engineUrl)}),
      import(${JSON.stringify(validationUrl)}),
    ]);
    const textBox = {
      x: 150 / 1080,
      y: 800 / 1920,
      width: 780 / 1080,
      height: 480 / 1920,
    };
    const unsafe = {
      kind: "wall_text",
      pattern: "freeform",
      formatId: "freeform",
      fullText: ${JSON.stringify(original)},
      layoutVersion: "wall-text-overlay-v6",
      renderFontSize: 52,
      sourceContent: { kind: "text", text: ${JSON.stringify(original)} },
      segments: [{
        role: "lead",
        lines: [
          "Working with classmates or teammates",
          "becomes calmer when real-time",
          "collaboration lets everyone update tasks",
          "together, keeping conversations focused",
          "and responsibilities clearly shared",
          "across the group.",
        ],
      }],
      finalLayout: {
        blocks: [{
          role: "text",
          lines: [
            "Working with classmates or teammates",
            "becomes calmer when real-time",
            "collaboration lets everyone update tasks",
            "together, keeping conversations focused",
            "and responsibilities clearly shared",
            "across the group.",
          ],
        }],
        fontFamily: "Inter",
        fontSizePx: 52,
        fontWeight: 400,
        lineHeightPx: 57.2,
        textBox,
        version: "wall-text-final-layout-v2",
      },
    };
    let rejected = false;
    try {
      await validation.validateWallTextRenderFit(unsafe);
    } catch (error) {
      rejected = error?.code === validation.WALL_TEXT_RENDER_FIT_REJECTED;
    }
    const layout = {
      alignment: "center",
      placement: "middle",
      placementSource: "visual-group-fallback",
      safeArea: {
        top: 280 / 1920,
        left: 140 / 1080,
        right: 140 / 1080,
        bottom: 460 / 1920,
      },
      textBox,
      version: "wall-text-layout-v4",
    };
    const rebuilt = await engine.createAuthoritativeWallTextContent({
      content: { kind: "text", text: ${JSON.stringify(original)} },
      formatId: "freeform",
      layout,
    });
    const forcedLarge = {
      ...rebuilt.content,
      renderFontSize: 52,
      finalLayout: {
        ...rebuilt.content.finalLayout,
        fontSizePx: 52,
        lineHeightPx: 57.2,
      },
    };
    const fit = await validation.validateWallTextRenderFit(forcedLarge);
    const applied = validation.applyWallTextRenderFit(forcedLarge, fit);
    process.stdout.write(JSON.stringify({
      appliedFinalFont: applied.finalLayout.fontSizePx,
      appliedLineHeight: applied.finalLayout.lineHeightPx,
      appliedRenderFont: applied.renderFontSize,
      fit,
      lines: applied.finalLayout.blocks[0].lines,
      rejected,
    }));
  `;
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      loaderPath,
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      script,
    ],
    { encoding: "utf8", stdio: "pipe" },
  );
  const result = JSON.parse(output) as {
    appliedFinalFont: number;
    appliedLineHeight: number;
    appliedRenderFont: number;
    fit: {
      fontSize: number;
      lineHeight: number;
      maximumLineWidth: number;
      valid: true;
    };
    lines: string[];
    rejected: boolean;
  };

  assert.equal(result.rejected, true);
  assert.equal(result.fit.valid, true);
  assert.ok(result.fit.fontSize < 52);
  assert.ok(result.fit.maximumLineWidth + 8 < 750);
  assert.equal(result.appliedRenderFont, result.fit.fontSize);
  assert.equal(result.appliedFinalFont, result.fit.fontSize);
  assert.equal(result.appliedLineHeight, result.fit.lineHeight);
  assert.equal(result.lines.join(" "), original);
  assert.ok(result.lines.length >= 5 && result.lines.length <= 8);
});

test("uses packaged Inter 400 with the restored 44-52px Wall scale", () => {
  assert.match(visualStyleSource, /WALL_TEXT_FONT_WEIGHT = 400/);
  assert.match(visualStyleSource, /WALL_TEXT_MINIMUM_FONT_SIZE = 44/);
  assert.match(visualStyleSource, /WALL_TEXT_MAXIMUM_FONT_SIZE = 52/);
  assert.match(layoutEngineSource, /Inter Regular \$\{fontSize\}/);
  assert.match(layoutEngineSource, /getVerifiedWallTextInterFontPath/);
  assert.match(renderValidationSource, /Inter Regular \$\{params\.fontSize\}/);
  assert.match(renderValidationSource, /getVerifiedWallTextInterFontPath/);
  assert.match(fontMeasurementSource, /inter-variable\.ttf/);
  assert.match(fontMeasurementSource, /FONTCONFIG_FILE/);
  assert.match(
    fontMeasurementSource,
    /stat\(INTER_REGULAR_FONT_PATH\)[\s\S]+font\.size === 0[\s\S]+packaged Inter Regular font is unavailable/,
  );
  assert.match(
    nextConfigSource,
    /outputFileTracingIncludes[\s\S]+inter-variable\.ttf[\s\S]+fontconfig[\\/]fonts\.conf/,
  );
  assert.match(overlaySource, /fontWeight: WALL_TEXT_FONT_WEIGHT/);
  assert.match(editorSource, /fontWeight: WALL_TEXT_FONT_WEIGHT/);
  assert.doesNotMatch(
    editorSource.match(/function WallTextOverlayText[\s\S]+?function StaticCreativeTextOverlay/)?.[0] ?? "",
    /font-bold/,
  );
  assert.match(
    rootLayoutSource,
    /inter-latin-400-normal\.woff2[\s\S]+variable: "--font-wall-text"[\s\S]+weight: "400"/,
  );
});

test("keeps the Wall editor save gate aligned with the 15-50 word contract", () => {
  assert.match(editorSource, /wordCount < MIN_SHORT_WALL_TEXT_WORDS \|\|[\s\S]+wordCount > 50/);
  assert.match(editorSource, /MIN_SHORT_WALL_TEXT_WORDS\}–50 words and fit the measured 5–8-line layout/);
  assert.match(textLogicSource, /MIN_SHORT_WALL_TEXT_WORDS = 15/);
  assert.doesNotMatch(editorSource, /exact limit is checked against the selected clip/);
});

test("keeps measured finalLayout lines as the current Wall source of truth", () => {
  assert.match(promptSource, /do not insert newline characters/i);
  assert.match(promptSource, /at least \$\{MIN_SHORT_WALL_TEXT_WORDS\} words/i);
  assert.match(promptSource, /Do not return[\s\S]+final visual lines/i);
  assert.match(layoutEngineSource, /createWallTextFinalLayout[\s\S]+blocks,/);
  assert.match(overlaySource, /getWallTextRenderBlocks\(content\)/);
  assert.match(
    databaseSource,
    /finalLayoutText = lines\.join\(" "\)[\s\S]+parsedSource\.text !== normalizedFullText[\s\S]+finalLayoutText !== normalizedFullText/,
  );
  assert.match(
    textLogicSource,
    /authoritativeText = lines\.join\(" "\)[\s\S]+normalizeText\(authoritativeText\) !== normalizeText\(content\.fullText\)/,
  );
});

test("V9 uses soft copy targets and measured fit instead of clip-time limits", () => {
  const currentValidation = textLogicSource.match(
    /if \(content\.layoutVersion === "wall-text-overlay-v6"\)[\s\S]+?\n    return;/,
  )?.[0] ?? "";

  assert.match(layoutEngineSource, /deriveWallTextSpatialBudget/);
  assert.doesNotMatch(layoutEngineSource, /temporalMaximum|durationSeconds\s*\*\s*4\.3/);
  assert.match(layoutEngineSource, /maxWords: ABSOLUTE_MAXIMUM_WORDS/);
  assert.match(formatsSource, /preferredWordRange/);
  assert.doesNotMatch(formatsSource, /hardWordRange/);
  assert.match(
    promptSource,
    /soft writing target, not a required minimum[\s\S]+absolute safety ceiling[\s\S]+measured 5-8 line fit/i,
  );
  assert.doesNotMatch(promptSource, /CODE-DERIVED READABILITY BUDGETS/);
  assert.doesNotMatch(generatorSource, /targetWords\s*-\s*4/);
  assert.match(currentValidation, /MAX_CURRENT_WALL_TEXT_WORDS/);
  assert.doesNotMatch(
    currentValidation,
    /durationSeconds\s*\*|estimateWallTextReadingSeconds|longer than the/,
  );
  assert.match(feedSource, /promptVersion: WALL_TEXT_PROMPT_VERSION/);
});

test("V9 fits thirty natural words in the wider measured reading column", () => {
  const loaderPath = new URL(
    "../../scripts/next-server-only-test-loader.mjs",
    import.meta.url,
  ).href;
  const engineUrl = new URL("wall-layout-engine.ts", import.meta.url).href;
  const feedLogicUrl = new URL("wall-text-feed-logic.ts", import.meta.url).href;
  const textLogicUrl = new URL("wall-text-text-logic.ts", import.meta.url).href;
  const original =
    "A full day can seem clear until small tasks use every open gap. When those quiet demands become visible, the next useful choice becomes easier to make without guessing again.";
  const script = `
    const [engine, feed, logic] = await Promise.all([
      import(${JSON.stringify(engineUrl)}),
      import(${JSON.stringify(feedLogicUrl)}),
      import(${JSON.stringify(textLogicUrl)}),
    ]);
    const layout = feed.createWallTextLayout();
    const result = await engine.createAuthoritativeWallTextContent({
      content: { kind: "text", text: ${JSON.stringify(original)} },
      formatId: "hidden_cause",
      layout,
    });
    logic.validateWallTextContent(result.content, 6);
    const budget = await engine.deriveWallTextSpatialBudget({
      formatId: "hidden_cause",
      layout,
    });
    process.stdout.write(JSON.stringify({ budget, content: result.content }));
  `;
  assert.equal(original.split(/\s+/u).length, 30);
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      loaderPath,
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      script,
    ],
    { encoding: "utf8", stdio: "pipe" },
  );
  const result = JSON.parse(output) as {
    content: { finalLayout: { blocks: Array<{ lines: string[] }> } };
  };
  const lines = result.content.finalLayout.blocks.flatMap((block) => block.lines);
  assert.ok(lines.length >= 5 && lines.length <= 8);
  assert.equal(lines.join(" "), original);
});

test("balances the reported Wall example into readable measured lines", () => {
  const loaderPath = new URL(
    "../../scripts/next-server-only-test-loader.mjs",
    import.meta.url,
  ).href;
  const engineUrl = new URL("wall-layout-engine.ts", import.meta.url).href;
  const feedLogicUrl = new URL("wall-text-feed-logic.ts", import.meta.url).href;
  const script = `
    const [engine, feed] = await Promise.all([
      import(${JSON.stringify(engineUrl)}),
      import(${JSON.stringify(feedLogicUrl)}),
    ]);
    const layout = await engine.createWallTextFinalLayout({
      content: {
        kind: "prose",
        text: "People assume one program fits every meal. But personalized guidance connects choices to goals. Relevance matters more than rigid rules.",
      },
      layout: feed.createWallTextLayout(),
    });
    process.stdout.write(JSON.stringify(layout));
  `;
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      loaderPath,
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      script,
    ],
    { encoding: "utf8" },
  );
  const layout = JSON.parse(output) as {
    blocks: Array<{ lines: string[] }>;
    fontFamily: string;
    lineHeightPx: number;
  };

  assert.equal(layout.fontFamily, "Inter");
  assert.equal(layout.lineHeightPx, 57.2);
  const lines = layout.blocks.flatMap((block) => block.lines);
  assert.ok(lines.length >= 5 && lines.length <= 8);
  assert.equal(
    lines.join(" "),
    "People assume one program fits every meal. But personalized guidance connects choices to goals. Relevance matters more than rigid rules.",
  );
  assert.ok(!lines.every((line) => line.split(/\s+/u).length <= 2));
});

test("V9 keeps every word in one measured 5-8 line block", () => {
  const loaderPath = new URL(
    "../../scripts/next-server-only-test-loader.mjs",
    import.meta.url,
  ).href;
  const engineUrl = new URL("wall-layout-engine.ts", import.meta.url).href;
  const feedLogicUrl = new URL("wall-text-feed-logic.ts", import.meta.url).href;
  const original =
    "I tracked the obvious steps but missed the quiet habits. Those small details explained why the result kept changing at once.";
  const script = `
    const [engine, feed] = await Promise.all([
      import(${JSON.stringify(engineUrl)}),
      import(${JSON.stringify(feedLogicUrl)}),
    ]);
    const result = await engine.createAuthoritativeWallTextContent({
      content: { kind: "text", text: ${JSON.stringify(original)} },
      formatId: "retrospective_lesson",
      layout: feed.createWallTextLayout(),
    });
    process.stdout.write(JSON.stringify(result));
  `;
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      loaderPath,
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      script,
    ],
    { encoding: "utf8" },
  );
  const result = JSON.parse(output) as {
    content: {
      finalLayout: {
        blocks: Array<{ lines: string[]; role: string }>;
        textBox: { width: number };
        version: string;
      };
      fullText: string;
      sourceContent: { kind: string; text: string };
    };
  };
  const lines = result.content.finalLayout.blocks.flatMap((block) => block.lines);
  assert.equal(result.content.fullText, original);
  assert.equal(result.content.sourceContent.kind, "text");
  assert.equal(result.content.finalLayout.version, "wall-text-final-layout-v2");
  assert.equal(result.content.finalLayout.blocks.length, 1);
  assert.equal(result.content.finalLayout.blocks[0]?.role, "text");
  assert.ok(lines.length >= 5 && lines.length <= 8);
  assert.equal(lines.join(" "), original);
  assert.equal(Math.round(result.content.finalLayout.textBox.width * 1080), 780);
});

test("V9 fixes the two reported narrow Wall layouts", () => {
  const loaderPath = new URL(
    "../../scripts/next-server-only-test-loader.mjs",
    import.meta.url,
  ).href;
  const engineUrl = new URL("wall-layout-engine.ts", import.meta.url).href;
  const feedLogicUrl = new URL("wall-text-feed-logic.ts", import.meta.url).href;
  const samples = [
    "Between classes, meetings, and errands, integrating your schedule with calendars so tasks appear alongside appointments helps reduce the mental load of planning.",
    "Lately everything feels chaotic, and a clear, user-friendly interface that shows tasks at a glance can make organizing your day feel possible again.",
  ];
  const script = `
    const [engine, feed] = await Promise.all([
      import(${JSON.stringify(engineUrl)}),
      import(${JSON.stringify(feedLogicUrl)}),
    ]);
    const results = [];
    for (const text of ${JSON.stringify(samples)}) {
      results.push(await engine.createAuthoritativeWallTextContent({
        content: { kind: "text", text },
        formatId: "freeform",
        layout: feed.createWallTextLayout(),
      }));
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      loaderPath,
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      script,
    ],
    { encoding: "utf8" },
  );
  const results = JSON.parse(output) as Array<{
    content: { finalLayout: { blocks: Array<{ lines: string[] }>; textBox: { width: number } } };
  }>;

  results.forEach((result, index) => {
    const lines = result.content.finalLayout.blocks.flatMap((block) => block.lines);
    assert.ok(lines.length >= 5 && lines.length <= 8);
    assert.equal(lines.join(" "), samples[index]);
    assert.ok(
      lines.reduce(
        (total, line) => total + line.split(/\s+/u).length,
        0,
      ) / lines.length >= 3,
    );
    assert.ok(
      !lines.every((line) => line.split(/\s+/u).length === 2),
    );
    assert.equal(Math.round(result.content.finalLayout.textBox.width * 1080), 780);
  });
});

test("stores semantic Wall v3 content and face-aware placement metadata", () => {
  assert.match(
    semanticOverlayMigration,
    /add column if not exists placement_analysis jsonb/i,
  );
  assert.match(
    semanticOverlayMigration,
    /wall-text-overlay-v3[\s\S]+jsonb_typeof\(text_content -> 'segments'\) = 'array'[\s\S]+text_content -> 'fullText'/i,
  );
  assert.match(
    semanticOverlayMigration,
    /wall-text-layout-v3/i,
  );
  assert.match(
    semanticOverlayMigration,
    /replace_wall_text_creative_copy_v3[\s\S]+business-profile-wall-text-v3/i,
  );
});

test("versions the six-second Wall v4 content, layout, and replacement function", () => {
  assert.match(
    sixSecondMigration,
    /wall-text-overlay-v4[\s\S]+text_content ->> 'pattern' in[\s\S]+problem_change_result[\s\S]+action_benefit/i,
  );
  assert.match(
    sixSecondMigration,
    /wall-text-layout-v4/i,
  );
  assert.match(
    sixSecondMigration,
    /wall-text-placement-v2[\s\S]+upper-middle[\s\S]+middle[\s\S]+lower-middle/i,
  );
  assert.match(
    sixSecondMigration,
    /replace_wall_text_creative_copy_v4[\s\S]+business-profile-wall-text-v4/i,
  );
  assert.match(
    databaseSource,
    /replace_wall_text_creative_copy_v5/,
  );
});

test("preserves evidence-controlled v5 copy and adds the v6 one-call layout contract", () => {
  assert.match(
    qualityMigration,
    /replace_wall_text_creative_copy_v5[\s\S]+business-profile-wall-text-v5/i,
  );
  assert.match(
    oneCallFormatsMigration,
    /wall-text-overlay-v5[\s\S]+wall-text-final-layout-v1[\s\S]+fontFamily'[\s\S]+Inter/i,
  );
  assert.match(
    oneCallFormatsMigration,
    /replace_wall_text_creative_copy_v6[\s\S]+security invoker[\s\S]+business-profile-wall-text-v6/i,
  );
  assert.match(
    oneCallFormatsMigration,
    /revoke all on function public\.replace_wall_text_creative_copy_v6[\s\S]+grant execute[\s\S]+to service_role/i,
  );
});

test("upgrades stale Wall layout without sending existing copy back to AI", () => {
  assert.match(
    feedSource,
    /const staleCreatives = existing\.filter\([\s\S]+!isTrendingWallTextCreativeCurrent\(creative\)/,
  );
  assert.match(
    feedSource,
    /parseWallTextContent\(creative\.text_content\)/,
  );
  assert.match(
    feedSource,
    /content: \{ kind: "text", text: existingContent\.fullText \}[\s\S]+formatId: getBackfillWallTextFormatId\(existingContent\.pattern\)/,
  );
  assert.match(
    feedSource,
    /generatorModel: "wall-layout-engine-v1"/,
  );
  assert.doesNotMatch(
    feedSource.match(
      /async function backfillExistingTrendingWallTextIdeas[\s\S]+$/,
    )?.[0] ?? "",
    /generateBusinessTrendingWallTextIdeas/,
  );
  assert.match(
    feedSource,
    /!areTrendingWallTextCreativesCurrent\(creatives\)[\s\S]+latest format/,
  );
  assert.match(
    databaseSource,
    /creative\.generator_version === WALL_TEXT_GENERATOR_VERSION[\s\S]+finalLayout !== undefined/,
  );
});

test("reopens a ready slot that is pinned to stale Wall layout instead of serving it forever", () => {
  assert.match(
    databaseSource,
    /creativeQuery = creativeQuery\.eq\([\s\S]*"generator_version",[\s\S]*WALL_TEXT_GENERATOR_VERSION/,
  );
  assert.match(
    feedSource,
    /pinnedAssignmentIds\.size > 0[\s\S]*!areTrendingWallTextCreativesCurrent\(creatives\)[\s\S]*createWallTextTrendingFeedProvider\(\[\]\)/,
  );
  assert.match(
    balancedLayoutMigration,
    /update public\.daily_trending_feed_slots as slot[\s\S]*wall_text_assignment_id = null,[\s\S]*state = 'planned'[\s\S]*slot\.state = 'ready'[\s\S]*creative\.generator_version <> 'business-profile-wall-text-v9'/i,
  );
  assert.match(
    balancedLayoutMigration,
    /update public\.daily_trending_feeds as feed[\s\S]*status = 'preparing'[\s\S]*reopened_slots/i,
  );
});

test("accepts the previous Wall worker payload during rolling deployments", () => {
  assert.match(
    internalPreparationRoute,
    /input\.requestedCount === null \|\| input\.requestedCount === undefined[\s\S]*\? 6/,
  );
  assert.match(
    internalPreparationRoute,
    /"legacy-wall-job"[\s\S]*`v\$\{businessProfileVersion\}`/,
  );
  assert.match(
    workerPreparationClient,
    /requestedCount: number;[\s\S]*requestKey: string;/,
  );
  assert.match(
    workerPreparationClient,
    /typeof result\?\.error === "string"[\s\S]*response\.status/,
  );
});

test("keeps assignment history server-only and updates source usage atomically", () => {
  assert.match(
    migration,
    /create table if not exists public\.user_wall_text_assignments/i,
  );
  assert.match(
    migration,
    /usage_count = asset\.usage_count \+ 1[\s\S]+last_used_at = now\(\)/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.user_wall_text_assignments[\s\S]+from anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.user_wall_text_assignments[\s\S]+to service_role/i,
  );
});

test("indexes Wall foreign keys for a growing creative library", () => {
  assert.match(
    migration,
    /wall_text_creatives_business_profile_idx[\s\S]+on public\.wall_text_creatives \(business_profile_id\)/i,
  );
  assert.match(
    migration,
    /wall_text_creatives_overlay_asset_idx[\s\S]+on public\.wall_text_creatives \(overlay_media_asset_id\)/i,
  );
  assert.match(
    migration,
    /user_wall_text_assignments_business_profile_idx[\s\S]+on public\.user_wall_text_assignments \(business_profile_id\)/i,
  );
  assert.match(
    migration,
    /user_wall_text_assignments_creative_idx[\s\S]+on public\.user_wall_text_assignments \(wall_text_creative_id\)/i,
  );
});

test("claims one standalone Wall render without entering the Hook demo renderer", () => {
  assert.match(
    renderingMigration,
    /render_wall_text_video/i,
  );
  assert.match(
    renderingMigration,
    /source_type in \([\s\S]+wall_text_render/i,
  );
  assert.match(
    renderingMigration,
    /create or replace function public\.claim_wall_text_render/i,
  );
  assert.match(
    renderingMigration,
    /render_status in \([\s\S]+'queued'[\s\S]+'rendering'[\s\S]+'ready'[\s\S]+'failed'/i,
  );
  assert.match(
    renderingMigration,
    /state = 'selected'/i,
  );
});

test("repairs the deployed Wall renderer schema without reverting current job types", () => {
  assert.match(
    renderSchemaRepairMigration,
    /add column if not exists render_id uuid[\s\S]+render_status text not null/i,
  );
  assert.match(
    renderSchemaRepairMigration,
    /source_type in \([\s\S]+wall_text_render/i,
  );
  assert.doesNotMatch(
    renderSchemaRepairMigration,
    /alter table public\.background_jobs/i,
  );
});

test("indexes the Wall render edit foreign key", () => {
  assert.match(
    renderEditIndexMigration,
    /create index if not exists user_wall_text_assignments_render_edit_idx[\s\S]+\(render_edit_id\)/i,
  );
});

test("uses the content generator version and recovers failed preparation jobs", () => {
  assert.match(
    jobsSource,
    /WALL_TEXT_GENERATOR_VERSION[\s\S]+trending-wall-text/i,
  );
  assert.match(
    jobsSource,
    /job\.status === "failed"[\s\S]+retryAndDispatchBackgroundJob/i,
  );
  assert.match(
    jobsSource,
    /replacement:\$\{job\.id\}/,
  );
});

test("refills Wall ideas from unused backgrounds with one deduplicated batch", () => {
  assert.match(
    feedSource,
    /enqueueTrendingWallTextRefill[\s\S]+active\.length >= targetActive/,
  );
  assert.match(
    feedSource,
    /mode === "initial" && existing\.length > 0[\s\S]+active\.length === 0[\s\S]+mode = "refill"/,
  );
  assert.match(
    feedSource,
    /usedBackgroundAssetIds[\s\S]+!usedBackgroundAssetIds\.has\(asset\.id\)/,
  );
  assert.match(
    feedSource,
    /refillKey: String\(existing\.length\)/,
  );
  assert.match(
    jobsSource,
    /refillKey\?: string \| null[\s\S]+refill-\$\{params\.refillKey\}/,
  );
});
