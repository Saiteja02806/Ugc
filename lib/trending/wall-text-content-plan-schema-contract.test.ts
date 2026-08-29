import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825120000_add_wall_text_content_plan.sql",
    import.meta.url,
  ),
  "utf8",
);
const freeformMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260826101500_disable_forced_wall_text_formats.sql",
    import.meta.url,
  ),
  "utf8",
);
const freeformPlanCompatibilityMigration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260826113000_allow_freeform_wall_text_plan_briefs.sql",
    import.meta.url,
  ),
  "utf8",
);
const planner = readFileSync(
  new URL("../../worker/src/lib/wall-text-content-plan.ts", import.meta.url),
  "utf8",
);
const appPlan = readFileSync(
  new URL("./wall-text-content-plan.ts", import.meta.url),
  "utf8",
);
const finalWriter = readFileSync(
  new URL("./wall-prompt.ts", import.meta.url),
  "utf8",
);
const jobs = readFileSync(
  new URL("./wall-text-jobs.ts", import.meta.url),
  "utf8",
);
const planLaunch = readFileSync(
  new URL("./wall-text-content-plan-generation-job.ts", import.meta.url),
  "utf8",
);
const preparationRoute = readFileSync(
  new URL("../../app/api/trending/wall-text/feed/prepare/route.ts", import.meta.url),
  "utf8",
);
const feed = readFileSync(
  new URL("./trending-wall-text-feed.ts", import.meta.url),
  "utf8",
);
const storage = readFileSync(
  new URL("./wall-text-db.ts", import.meta.url),
  "utf8",
);
const workerHandlers = readFileSync(
  new URL("../../worker/src/jobs/index.ts", import.meta.url),
  "utf8",
);
const aiWorkerVariables = readFileSync(
  new URL(
    "../../infra/gcp/ai-generation-worker/variables.tf",
    import.meta.url,
  ),
  "utf8",
);
const aiWorkerProductionVariables = readFileSync(
  new URL(
    "../../infra/gcp/ai-generation-worker/terraform.tfvars.example",
    import.meta.url,
  ),
  "utf8",
);

test("creates a separate private 30-day Wall plan with forty briefs and two hundred child ideas", () => {
  for (const table of [
    "wall_text_content_plans",
    "wall_text_content_plan_briefs",
    "wall_text_content_plan_items",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table if not exists public\\.${table}`, "i"),
    );
  }

  assert.match(migration, /period_end_date = period_start_date \+ 29/i);
  assert.match(migration, /target_item_count integer not null default 200[\s\S]*target_item_count = 200/i);
  assert.match(migration, /brief_index smallint not null[\s\S]*brief_index between 1 and 40/i);
  assert.match(migration, /sequence_index integer not null[\s\S]*sequence_index between 1 and 200/i);
  assert.match(migration, /jsonb_array_length\(p_items\) <> v_brief_count \* 5/i);

  for (const field of [
    "creative_seed",
    "audience_context",
    "human_moment",
    "emotional_tension",
    "supported_angle",
    "preferred_format_family",
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`, "i"));
  }

  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});

test("uses five parent fields for five child ideas without prewriting Wall copy", () => {
  for (const definition of [
    /creativeSeed: The central human observation or tension\. It is not final copy/i,
    /audienceContext: The supported audience segment experiencing that situation\. It must not mean everyone/i,
    /humanMoment: One concrete, recognisable everyday event or situation/i,
    /emotionalTension: The inner feeling or conflict created by that moment/i,
    /supportedAngle: The factual connection to the business, based only on approved facts\. It is not a sales claim or a promise/i,
  ]) {
    assert.match(planner, definition);
  }
  assert.match(
    planner,
    /Use all five fields together to create exactly five different child ideas/i,
  );
  assert.match(
    planner,
    /Each child has contentIdea and feeling/i,
  );
  assert.match(
    planner,
    /Do not write final overlay copy, line breaks, a slide layout, a CTA, a product pitch, or a finished script/i,
  );
  assert.match(
    planner,
    /wall-text-content-plan-five-context-v3-freeform/i,
  );
  assert.match(
    appPlan,
    /wall-text-content-plan-five-context-v3-freeform/i,
  );
});

test("uses planned ideas progressively but preserves the established Wall fallback", () => {
  assert.match(
    migration,
    /A plan is optional during rollout\. If no complete batch of ready private[\s\S]*original Wall generation path proceeds unchanged/i,
  );
  assert.match(migration, /if coalesce\(cardinality\(v_plan_item_ids\), 0\) <> assignment_count then[\s\S]*v_content_plan_id := null/i);
  assert.match(migration, /wall_text_content_plan_id, wall_text_content_plan_item_id/i);
  assert.match(migration, /set status = 'reserved'/i);
  assert.match(migration, /set status = 'consumed'/i);
  assert.match(migration, /set status = 'retired'/i);
  assert.match(jobs, /ensureWallTextContentPlanGeneration/);
  assert.match(jobs, /must never prevent the established Wall generation fallback/i);
});

test("allows the deployed AI-generation worker to execute the new private planning job", () => {
  assert.match(aiWorkerVariables, /wall_text_content_plan_generation/);
  assert.match(aiWorkerProductionVariables, /wall_text_content_plan_generation/);
});

test("connects the complete planned Wall flow without exposing private context to the frontend", () => {
  assert.match(
    preparationRoute,
    /enqueueTrendingWallTextJob\([\s\S]*profile,/,
  );
  assert.match(
    jobs,
    /ensureWallTextContentPlanGeneration\(\{ profile: params\.profile \}\)/,
  );
  assert.match(planLaunch, /beforeDispatch:[\s\S]*attachWallTextContentPlanGenerationJob/);
  assert.match(
    workerHandlers,
    /wall_text_content_plan_generation[\s\S]*runGenerateWallTextContentPlanJob/,
  );
  assert.match(feed, /reserveWallTextGenerationBatch/);
  assert.match(feed, /getWallTextPrivateCreativeContexts/);
  assert.match(feed, /privateCreativeContext:/);
  assert.match(feed, /saveWallTextGenerationCandidate/);
  assert.match(storage, /reserve_wall_text_generation_batch_v1/);
  assert.match(storage, /save_wall_text_generation_candidate_v1/);
  assert.doesNotMatch(feed, /creativeSeed|audienceContext|humanMoment|emotionalTension|supportedAngle|preferredFormatFamily/);
});

test("keeps planning context private and removes format pressure from the Wall writer", () => {
  assert.match(
    finalWriter,
    /use its contentIdea, feeling, and all five planningBrief fields together as private guidance/i,
  );
  assert.match(finalWriter, /Do not print field names or treat creativeSeed as finished copy/i);
  assert.match(finalWriter, /Do not force it into a named writing format, template, list, or formula/i);
  assert.doesNotMatch(finalWriter, /preferredFormatFamily|assignedFormatId|APPROVED WALL FORMATS/);
  assert.doesNotMatch(feed, /selectWallTextFormatAssignments|getWallTextPerformanceSignals/);
  assert.match(feed, /assignedFormatId: null,[\s\S]*selectionMode: "freeform"/);
  assert.match(
    finalWriter,
    /Return exactly one result for every candidate\. Do not return formatId, duration, coordinates, or final visual lines\./i,
  );
  assert.match(finalWriter, /measured 5-8 line fit/i);
});

test("stores new Wall copy as freeform and excludes it from format learning", () => {
  assert.match(
    freeformMigration,
    /selection_mode in \([\s\S]*'freeform'/i,
  );
  assert.match(
    freeformMigration,
    /if new\.format_id is null then[\s\S]*new\.performance_eligible := false/i,
  );
  assert.match(
    freeformMigration,
    /freeform_copy_has_no_format_learning/i,
  );
  assert.match(
    storage,
    /formatLearningEligible:[\s\S]*assignment\.assigned_format_id !== null/i,
  );
  assert.match(
    freeformPlanCompatibilityMigration,
    /wall_text_content_plan_briefs_preferred_format_family_check[\s\S]*'freeform'/i,
  );
  assert.match(
    freeformPlanCompatibilityMigration,
    /wall_text_creatives_text_content_chk[\s\S]*layoutVersion' = 'wall-text-overlay-v6'[\s\S]*formatId' in \([\s\S]*'freeform'/i,
  );
  assert.match(
    freeformPlanCompatibilityMigration,
    /add constraint wall_text_creatives_text_content_chk[\s\S]*not valid[\s\S]*validate constraint wall_text_creatives_text_content_chk/i,
  );
  assert.match(
    freeformPlanCompatibilityMigration,
    /daily_trending_feed_slots[\s\S]*slot\.format = 'wall_text'[\s\S]*wall_text_assignment_id is null/i,
  );
  assert.match(
    freeformPlanCompatibilityMigration,
    /trending_feed_reconciliation_outbox[\s\S]*on conflict \(source_job_id\) do update[\s\S]*status = 'pending'/i,
  );
});
