import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260818100000_add_carousel_structure_planning_takeover.sql",
  "utf8",
);
const runtime = readFileSync(
  "worker/src/lib/carousel-generate.ts",
  "utf8",
);
const structure1Planner = readFileSync(
  "worker/src/lib/carousel-llm-slide-plan.ts",
  "utf8",
);
const structure2Planner = readFileSync(
  "worker/src/lib/carousel-structure-2-planner.ts",
  "utf8",
);
const structure2Runtime = readFileSync(
  "worker/src/lib/carousel-structure-2-generate.ts",
  "utf8",
);
const sharedSlideContract = readFileSync(
  "worker/src/lib/carousel-slide-plan.ts",
  "utf8",
);

test("persists requested and resolved Carousel structures separately", () => {
  assert.match(migration, /requested_structure_id text/i);
  assert.match(migration, /structure_resolution_mode text not null/i);
  assert.match(
    migration,
    /requested_structure_id = 'structure_1'[\s\S]*structure_id = 'structure_2'/i,
  );
  assert.match(
    migration,
    /initialize_carousel_requested_structure[\s\S]*before insert/i,
  );
});

test("allows only an untouched five-row batch to take over atomically", () => {
  assert.match(
    migration,
    /take_over_carousel_experiment_batch_with_structure_2/i,
  );
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /v_generation_count <> 5/i);
  assert.match(migration, /v_assignment_count <> 5/i);
  assert.match(migration, /generation\.content_plan_normalized is not null/i);
  assert.match(migration, /from public\.carousel_slides/i);
  assert.match(migration, /from public\.carousel_performance_observations/i);
  assert.match(migration, /deferrable initially deferred/i);
  assert.match(
    migration,
    /structure_resolution_mode = 'planning_fallback'[\s\S]*return query/i,
  );
});

test("preserves global rotation while advancing Structure 2 format history", () => {
  assert.doesNotMatch(
    migration,
    /set[\s\S]{0,500}structure_rotation_sequence\s*=/i,
  );
  assert.match(
    migration,
    /where batch\.business_profile_id = v_batch\.business_profile_id[\s\S]*batch\.structure_id = 'structure_2'/i,
  );
  assert.match(
    migration,
    /\(\(v_next_structure_sequence \* 5 \+ assignment\.slot_index\) % 8\) \+ 1/i,
  );
});

test("runtime limits Structure 1 takeover to plan-backed automatic rotation", () => {
  assert.match(runtime, /while \(planningAttemptCount < 2 && !plannedItems\)/);
  assert.doesNotMatch(runtime, /allowDeterministicFallback/);
  assert.match(runtime, /planAwareAutomaticRecovery/);
  assert.match(runtime, /structure_mode_snapshot === "rotate"/);
  assert.match(runtime, /structure_selection_mode === "rotation"/);
  assert.match(
    runtime,
    /rows\.every\([\s\S]*generation\.content_plan_id[\s\S]*generation\.content_plan_item_id[\s\S]*generation\.content_plan_reservation_id/,
  );
  assert.match(
    runtime,
    /if \(!planAwareAutomaticRecovery\)[\s\S]*Carousel Structure 1 planning failed after two attempts/,
  );
  assert.match(runtime, /takeOverCarouselExperimentBatchWithStructure2/);
  assert.match(runtime, /resolvedGenerations\.some/);
  assert.match(runtime, /generateCarouselStructure2Batch/);
});

test("both structures keep hardcoded copy out of the publishing runtime", () => {
  assert.doesNotMatch(
    structure1Planner,
    /allowDeterministicFallback|buildFallbackPlan|deterministic-fallback|CAROUSEL_CONTENT_PLANNER_MODE|normalizeRepairedCarouselCopy|repairCopyText|Try this approach/,
  );
  assert.doesNotMatch(
    structure2Planner,
    /buildDeterministic|deterministic-fallback|CAROUSEL_STRUCTURE_2_PLANNER_MODE|CAROUSEL_CONTENT_PLANNER_MODE/,
  );
  assert.doesNotMatch(structure2Runtime, /allowDeterministicFallback/);
  assert.doesNotMatch(
    sharedSlideContract,
    /buildCarouselSlidePlan|FALLBACK_HEADLINES|fallback copy/i,
  );
  assert.match(structure1Planner, /failed after validation repair/i);
  assert.match(structure2Planner, /failed after isolated LLM repair/i);
});
