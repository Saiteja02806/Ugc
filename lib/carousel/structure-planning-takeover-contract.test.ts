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

test("runtime retries Structure 1 twice and then reloads the whole batch as Structure 2", () => {
  assert.match(runtime, /while \(planningAttemptCount < 2 && !plannedItems\)/);
  assert.match(runtime, /allowDeterministicFallback: false/);
  assert.match(runtime, /takeOverCarouselExperimentBatchWithStructure2/);
  assert.match(runtime, /resolvedGenerations\.some/);
  assert.match(runtime, /generateCarouselStructure2Batch/);
});

test("Structure 1 fails closed while Structure 2 uses its validated dedicated fallback", () => {
  assert.match(
    structure1Planner,
    /input\.allowDeterministicFallback === false[\s\S]*runtime fallback copy is not permitted/i,
  );
  assert.match(
    structure2Planner,
    /buildDeterministicCarouselStructure2StoryPlan/,
  );
  assert.match(
    structure2Runtime,
    /buildCarouselStructure2StoryPlanBatch\(\{[\s\S]*allowDeterministicFallback: true/,
  );
});
