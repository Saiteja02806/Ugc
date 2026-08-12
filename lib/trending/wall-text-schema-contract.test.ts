import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const creativeMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260726100000_create_trending_wall_text_creatives.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260728104054_add_wall_text_video_catalog_metadata.sql",
    import.meta.url,
  ),
  "utf8",
);
const unifiedCopyMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260728183932_wall_text_unified_copy_v2.sql",
    import.meta.url,
  ),
  "utf8",
);
const renderingMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260729100000_add_wall_text_content_rendering.sql",
    import.meta.url,
  ),
  "utf8",
);
const renderSchemaRepairMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260808072043_repair_wall_text_render_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const renderEditIndexMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260808072642_index_wall_text_render_edit.sql",
    import.meta.url,
  ),
  "utf8",
);
const semanticOverlayMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260730061012_wall_text_semantic_overlay_v3.sql",
    import.meta.url,
  ),
  "utf8",
);
const sixSecondMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260730192903_wall_text_six_second_v4.sql",
    import.meta.url,
  ),
  "utf8",
);
const qualityMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260730201500_wall_text_prompt_quality_v5.sql",
    import.meta.url,
  ),
  "utf8",
);
const oneCallFormatsMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260812135048_wall_text_one_call_formats_v6.sql",
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
const overlaySource = readFileSync(
  new URL(
    "../../components/trending/wall-text-overlay.tsx",
    import.meta.url,
  ),
  "utf8",
);
const editorSource = readFileSync(
  new URL(
    "../../components/trending/trending-creative-editor.tsx",
    import.meta.url,
  ),
  "utf8",
);
const visualStyleSource = readFileSync(
  new URL("./wall-text-visual-style.ts", import.meta.url),
  "utf8",
);
const migration =
  `${creativeMigration}\n${catalogMigration}\n${unifiedCopyMigration}\n${renderingMigration}\n${semanticOverlayMigration}\n${sixSecondMigration}\n${qualityMigration}`;

test("uses one consistent line rhythm across Wall preview and editor", () => {
  assert.match(overlaySource, /lineHeight: WALL_TEXT_LINE_HEIGHT_FACTOR/);
  assert.match(editorSource, /lineHeight: WALL_TEXT_LINE_HEIGHT_FACTOR/);
  assert.doesNotMatch(overlaySource, /marginTop|WALL_TEXT_SECTION_GAP/);
  assert.doesNotMatch(editorSource, /WALL_TEXT_SECTION_GAP/);
  assert.doesNotMatch(visualStyleSource, /WALL_TEXT_SECTION_GAP/);
});

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

test("uses one GPT-5 mini call for the complete Wall candidate batch", () => {
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
  assert.match(
    generatorSource,
    /const WallTextSourceContentSchema = z\.discriminatedUnion\("kind"/,
  );
  assert.match(
    generatorSource,
    /const EligibleWallTextFormatIdSchema = z\.enum\([\s\S]+getEligibleWallTextFormatIds\(\)[\s\S]+formatId: EligibleWallTextFormatIdSchema/,
  );
  assert.match(
    generatorSource,
    /buildWallTextGenerationPrompt\(\{ business, candidates \}\)/,
  );
  assert.match(
    generatorSource,
    /return Promise\.all\([\s\S]+createAuthoritativeWallTextContent/,
  );
  assert.doesNotMatch(
    generatorSource,
    /retry|repair|reviewer|revisionFeedback/i,
  );
  assert.match(
    promptSource,
    /natural continuous Wall-of-Text language[\s\S]+do not insert newline characters/i,
  );
  assert.match(
    promptSource,
    /Return exactly one result for every candidate\. Do not return final visual lines\./,
  );
});

test("keeps the approved twelve Wall formats in one controlled registry", () => {
  const expectedFormatIds = [
    "identity_mirror",
    "recognizable_moment",
    "hidden_truth",
    "contrarian_reframe",
    "personal_confession",
    "aspiration_redefinition",
    "pain_beneath_the_pain",
    "niche_insight",
    "list_rules",
    "community_prompt",
    "analogy_reframe",
    "progression_sequence",
  ];

  assert.equal(formatsSource.match(/\n    id: "/g)?.length, 12);
  for (const formatId of expectedFormatIds) {
    assert.match(formatsSource, new RegExp(`id: "${formatId}"`));
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
  assert.match(layoutEngineSource, /textBox: \{/);
  assert.match(
    layoutEngineSource,
    /rebalanceInternalLines[\s\S]+measureLines[\s\S]+getLineBalanceScore/,
  );
  assert.match(
    layoutEngineSource,
    /widths\.some\(\(width\) => width > maximumWidth\)/,
  );
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
  assert.equal(layout.lineHeightPx, 56.33);
  assert.deepEqual(layout.blocks[0]?.lines, [
    "People assume one program",
    "fits every meal. But",
    "personalized guidance",
    "connects choices to goals.",
    "Relevance matters more than",
    "rigid rules.",
  ]);
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
    /content: \{ kind: "prose", text: existingContent\.fullText \}[\s\S]+formatId: getBackfillWallTextFormatId\(existingContent\.pattern\)/,
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
    /\.in\("generator_version", \[[\s\S]+LEGACY_WALL_TEXT_GENERATOR_VERSION[\s\S]+WALL_TEXT_GENERATOR_VERSION/,
  );
  assert.match(
    databaseSource,
    /creative\.generator_version === WALL_TEXT_GENERATOR_VERSION[\s\S]+finalLayout !== undefined/,
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
