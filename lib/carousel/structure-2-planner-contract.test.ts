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
const carouselTextModel = read("worker/src/lib/carousel-text-model.ts");
const generationRuntime = read("worker/src/lib/carousel-generate.ts");
const structureBoundary = read("worker/src/lib/carousel-structure.ts");

test("Structure 2 has a dedicated prompt, schema, validator, and isolated LLM repair", () => {
  assert.match(
    structure2Planner,
    /CAROUSEL_STRUCTURE_2_PLANNER_VERSION/,
  );
  assert.match(structure2Planner, /buildCarouselStructure2StoryPlanBatch/);
  assert.match(structure2Planner, /attemptIsolatedRepair/);
  assert.doesNotMatch(structure2Planner, /buildDeterministic|deterministic-fallback/);
  assert.doesNotMatch(structure2StoryPlan, /buildDeterministic|deterministic fallback/i);
  assert.match(structure2StoryPlan, /buildCarouselStructure2BatchMessages/);
  assert.match(structure2StoryPlan, /buildCarouselStructure2StoryBatchSchema/);
  assert.match(structure2StoryPlan, /validateCarouselStructure2StoryPlan/);
  assert.match(structure2StoryPlan, /partitionCarouselStructure2ValidationIssues/);
});

test("Structure 1 and Structure 2 are both LLM-only writers", () => {
  const prohibitedRuntimeCopy =
    /allowDeterministicFallback|buildFallbackPlan|deterministic-fallback|CAROUSEL_(?:CONTENT|STRUCTURE_2)_PLANNER_MODE/;

  assert.doesNotMatch(structure1Planner, prohibitedRuntimeCopy);
  assert.doesNotMatch(structure2Planner, prohibitedRuntimeCopy);
  assert.match(structure1Planner, /failed after validation repair/i);
  assert.match(structure2Planner, /failed after isolated LLM repair/i);
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

test("both Carousel text structures are pinned to gpt-4o-mini", () => {
  assert.match(carouselTextModel, /CAROUSEL_TEXT_MODEL = "gpt-4o-mini"/);
  assert.match(structure1Planner, /import \{ CAROUSEL_TEXT_MODEL \}/);
  assert.match(structure2Planner, /import \{ CAROUSEL_TEXT_MODEL \}/);
  assert.doesNotMatch(
    `${structure1Planner}\n${structure2Planner}`,
    /OPENAI_CAROUSEL_(?:PLANNER|STRUCTURE_2)_MODEL/,
  );
});

test("Structure 2 receives the last ten exact accepted copies", () => {
  assert.match(
    structure2StoryPlan,
    /CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT = 10/,
  );
  assert.match(structure2StoryPlan, /Last accepted Carousel copies \(exact visible text\)/);
  assert.match(structure2StoryPlan, /CarouselRecentAcceptedCopy/);
  assert.doesNotMatch(
    structure2StoryPlan,
    /hookFamilyId|CarouselRecentContentSummaryInput|productMechanism/,
  );
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
