import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activationMigration = read(
  "supabase/migrations/20260817193000_activate_carousel_structure_2_runtime.sql",
);
const appPreparation = read("lib/carousel/prepare-business-profile.ts");
const appGeneration = read("lib/carousel/generate-carousel.ts");
const structure2Runtime = read(
  "worker/src/lib/carousel-structure-2-generate.ts",
);
const workerGeneration = read("worker/src/lib/carousel-generate.ts");

test("activation preserves exact Structure 2 formats and null Structure 1 hooks", () => {
  for (const formatId of [
    "wrong_belief",
    "perfect_plan_breaks",
    "stopped_behavior",
    "terrible_at",
    "result_without_sacrifice",
    "identity_transformation",
    "new_rule",
    "wrong_villain",
  ]) {
    assert.match(activationMigration, new RegExp(`'${formatId}'`));
  }

  assert.match(
    activationMigration,
    /structure_id = 'structure_2'[\s\S]*hook_family_id is null[\s\S]*hook_selection_mode is null/i,
  );
  assert.doesNotMatch(
    activationMigration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});

test("deployment holds Structure 1 until the complete runtime is verified", () => {
  assert.match(
    activationMigration,
    /alter column structure_mode set default 'structure_1_only'/i,
  );
  assert.doesNotMatch(
    activationMigration,
    /update public\.carousel_global_settings[\s\S]*structure_mode = 'rotate'/i,
  );
});

test("Structure 2 selection, history, and performance remain independent", () => {
  assert.match(appPreparation, /selectCarouselStructure2ExperimentBatch/);
  assert.match(appPreparation, /listRecentCarouselStructure2History/);
  assert.match(appPreparation, /getCarouselStructure2PerformanceSignals/);
  assert.match(
    activationMigration,
    /observation\.structure_id = p_structure_id/i,
  );
  assert.match(
    activationMigration,
    /where recent\.hook_family_id is not null/i,
  );
});

test("Structure 2 owns its planner, role reservation, renderer, and persistence path", () => {
  assert.match(workerGeneration, /generateCarouselStructure2Batch/);
  assert.match(structure2Runtime, /buildCarouselStructure2StoryPlanBatch/);
  assert.match(structure2Runtime, /useProductAsset: true/);
  assert.match(structure2Runtime, /buildCarouselStructure2RenderSpecs/);
  assert.match(structure2Runtime, /renderCarouselStructure2SlideWithDiagnostics/);
  assert.match(structure2Runtime, /createCarouselStructure2SlideInserts/);
  assert.doesNotMatch(
    structure2Runtime,
    /carousel-llm-slide-plan|carousel-content-grammar|renderCarouselSlideWithDiagnostics/,
  );
});

test("single-carousel paths fail closed instead of entering the Structure 1 planner", () => {
  assert.match(appGeneration, /carousel_structure_2_requires_batch_runtime/);
  assert.match(workerGeneration, /carousel_structure_2_requires_batch_runtime/);
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
