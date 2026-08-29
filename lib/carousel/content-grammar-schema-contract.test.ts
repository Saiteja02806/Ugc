import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const migration = read("supabase/migration_archive/pre_baseline_20260829/canonical_history/20260810174540_add_carousel_content_grammar.sql");
const experimentMigration = read("supabase/migration_archive/pre_baseline_20260829/canonical_history/20260813110309_add_controlled_carousel_experiment_batches.sql");
const preparation = read("lib/carousel/prepare-business-profile.ts");
const appGenerator = read("lib/carousel/generate-carousel.ts");
const generationDb = read("lib/carousel/db.ts");
const legacyGenerateRoute = read("app/api/carousel/generate/route.ts");
const legacyGenerateMoreRoute = read("app/api/carousel/generate-more/route.ts");
const workerGenerator = read("worker/src/lib/carousel-generate.ts");
const workerPlanner = read("worker/src/lib/carousel-llm-slide-plan.ts");
const workerStore = read("worker/src/lib/supabase.ts");

test("adds content grammar state only to existing carousel generations", () => {
  assert.match(migration, /alter table public\.carousel_generations/i);
  assert.doesNotMatch(migration, /create table(?: if not exists)? public\.business_profiles/i);

  for (const column of [
    "content_format_id",
    "hook_family_id",
    "content_grammar_version",
    "content_selector_version",
    "content_history_snapshot",
    "content_audience_id",
    "content_problem_id",
    "content_goal_id",
    "content_topic_id",
    "content_topic",
    "content_angle",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}\\b`, "i"));
  }

  assert.match(migration, /jsonb_array_length\(content_history_snapshot\) <= 10/i);
  assert.match(migration, /separate from format, which stores the canvas ratio/i);
  assert.match(
    migration,
    /business_profile_id,\s*created_at desc,\s*candidate_index desc[\s\S]*generation_source = 'auto_generated'[\s\S]*status in \('processing', 'completed'\)/i,
  );
  assert.match(
    migration,
    /content_format_id is not null[\s\S]*content_grammar_version is not null[\s\S]*content_selector_version is not null/i,
  );
});

test("all new generation entry points require structure-owned assignments", () => {
  for (const route of [legacyGenerateRoute, legacyGenerateMoreRoute]) {
    assert.match(route, /carousel_manual_generation_retired/);
    assert.match(route, /\b410\b/);
    assert.doesNotMatch(route, /createCarouselGeneration/);
    assert.doesNotMatch(route, /enqueueCarouselGenerationJob/);
  }

  assert.match(generationDb, /businessProfileId: string;/);
  assert.match(generationDb, /businessProfileVersion: number;/);
  assert.match(
    generationDb,
    /contentAssignment: CarouselStructureContentAssignment;/,
  );
  assert.match(
    generationDb,
    /CarouselContentAssignment[\s\S]*CarouselStructure2FormatAssignment/,
  );
  assert.match(generationDb, /generationSource: "auto_generated";/);
  assert.match(
    workerPlanner,
    /throw new Error\(CAROUSEL_V1_ASSIGNMENT_REQUIRED_ERROR\)/,
  );
});

test("automatic generation persists controlled five-item batches before one batch job", () => {
  assert.match(preparation, /getBusinessProfileForUser/);
  assert.match(
    preparation,
    /buildCarouselBusinessContentContext\(\s*params\.businessContext/,
  );
  assert.match(preparation, /businessContext:\s*profile\.context/);
  assert.match(preparation, /selectCarouselExperimentBatch/);
  assert.match(preparation, /reserveCarouselExperimentBatches/);
  assert.match(preparation, /upsertCarouselExperimentAssignments/);
  assert.match(preparation, /enqueueCarouselExperimentBatchJob/);
  assert.match(experimentMigration, /create table if not exists public\.carousel_experiment_batches/);
  assert.match(experimentMigration, /create table if not exists public\.carousel_experiment_assignments/);
  assert.match(experimentMigration, /requested_carousel_count = 5/);
  assert.match(experimentMigration, /pg_advisory_xact_lock/);
  assert.match(experimentMigration, /grant select, insert, update on table public\.carousel_experiment_batches\s+to service_role/i);
  assert.match(experimentMigration, /alter table public\.carousel_experiment_batches enable row level security/i);
  assert.match(experimentMigration, /assigned_format_id text not null/i);
  assert.match(experimentMigration, /actual_format_id text/i);
  assert.match(experimentMigration, /replacement_for_format_id text/i);
  assert.match(
    workerGenerator,
    /content_format_id:\s*params\.plannedItem\.actualContentFormatId/,
  );
  assert.match(
    workerGenerator,
    /replacement_for_format_id:\s*params\.plannedItem\.replacementForFormatId/,
  );
  assert.doesNotMatch(preparation, /createBusinessProfile/);

  assert.match(appGenerator, /contentFormatId: generation\.contentFormatId/);
  assert.match(appGenerator, /getBusinessProfileForUser/);
  assert.match(appGenerator, /getCarouselCreativeBriefForGeneration/);
  assert.match(appGenerator, /listRecentAcceptedCarouselCopy/);
  assert.match(appGenerator, /businessDescription: creativeBrief\.businessDescription/);
  assert.match(appGenerator, /recentHistory,/);
  assert.match(workerGenerator, /contentFormatId: generation\.content_format_id/);
  assert.match(workerGenerator, /getBusinessProfileForCarousel/);
  assert.match(workerGenerator, /getCarouselCreativeBrief/);
  assert.match(workerGenerator, /listRecentAcceptedCarouselCopy/);
  assert.match(workerGenerator, /businessDescription,/);
  assert.match(workerGenerator, /recentHistory,/);
  assert.match(
    workerStore,
    /from\(BUSINESS_PROFILES_TABLE\)[\s\S]*eq\("id", params\.businessProfileId\)[\s\S]*eq\("user_id", params\.userId\)[\s\S]*eq\("profile_version", params\.businessProfileVersion\)/,
  );
  assert.match(
    workerStore,
    /eq\("generation_batch_id", params\.generationBatchId\)[\s\S]*not\("content_topic_id", "is", null\)/,
  );
});

function read(relativePath: string) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}
