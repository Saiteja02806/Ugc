import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const structure2Planner = read(
  "worker/src/lib/carousel-structure-2-planner.ts",
);
const structure2StoryPlan = read(
  "worker/src/lib/carousel-structure-2-story-plan.ts",
);
const structure1Planner = read("worker/src/lib/carousel-llm-slide-plan.ts");
const generationRuntime = read("worker/src/lib/carousel-generate.ts");
const structureBoundary = read("worker/src/lib/carousel-structure.ts");

test("Structure 2 has a dedicated prompt, schema, validator, repair, and fallback", () => {
  assert.match(
    structure2Planner,
    /CAROUSEL_STRUCTURE_2_PLANNER_VERSION/,
  );
  assert.match(structure2Planner, /buildCarouselStructure2StoryPlanBatch/);
  assert.match(structure2Planner, /attemptIsolatedRepair/);
  assert.match(
    structure2Planner,
    /buildDeterministicCarouselStructure2StoryPlan/,
  );
  assert.match(structure2StoryPlan, /buildCarouselStructure2BatchMessages/);
  assert.match(structure2StoryPlan, /buildCarouselStructure2StoryBatchSchema/);
  assert.match(structure2StoryPlan, /validateCarouselStructure2StoryPlan/);
});

test("Structure 2 planning does not import Structure 1 formats or hook families", () => {
  assert.doesNotMatch(
    structure2Planner,
    /carousel-content-grammar|carousel-llm-slide-plan/,
  );
  assert.doesNotMatch(
    structure2StoryPlan,
    /CAROUSEL_CONTENT_FORMAT|CarouselHookFamily|hookFamilyId|formats\.json/,
  );
  assert.doesNotMatch(
    structure1Planner,
    /carousel-structure-2-(?:planner|story-plan)/,
  );
});

test("the story planner is reached only through the dedicated Structure 2 batch runtime", () => {
  assert.match(generationRuntime, /generateCarouselStructure2Batch/);
  assert.match(
    structureBoundary,
    /CAROUSEL_RUNTIME_READY_STRUCTURE_IDS = \[[\s\S]*"structure_1"[\s\S]*"structure_2"/,
  );
  assert.match(generationRuntime, /carousel_structure_2_requires_batch_runtime/);
});

test("Structure 2 history is compact and structure-specific", () => {
  assert.match(
    structure2StoryPlan,
    /CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT = 10/,
  );
  assert.match(structure2StoryPlan, /Recent compact Structure 2 history only/);
  assert.doesNotMatch(
    structure2StoryPlan,
    /contentFormatId|hookFamilyId|CarouselRecentContentSummaryInput/,
  );
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
