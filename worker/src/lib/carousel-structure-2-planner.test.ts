import assert from "node:assert/strict";
import test from "node:test";
import { buildCarouselStructure2StoryPlanBatch, type CarouselStructure2PlanFailure } from "./carousel-structure-2-planner.js";
import { CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS, CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS } from "./carousel-structure-2-story-plan.js";
import { CAROUSEL_STRUCTURE_2_STORY_ROLES } from "./carousel-structure-2-formats.js";

const assignments = Array.from({ length: 5 }, (_, slotIndex) => ({
  slotIndex, candidateIndex: slotIndex, creativeSeed: `Seed ${slotIndex}`,
  emotion: "relief", storyFormatId: "wrong_belief" as const,
}));
const businessDescription = "Todaywise is an application for planning work when priorities change.";
const copy = [
  "Why weekly plans collapse by Tuesday",
  "On Monday, one changed priority made me rebuild every task, delay the first decision, and lose the context I had already collected.",
  "I realized the problem was not effort; my plan assumed that ordinary work would never change after I wrote it down.",
  "Todaywise let me work from the changing task list, so I could update the next action without rebuilding the entire week from scratch.",
  "The week still changed, but I stopped treating each shift as a reset and finished the important work with a clearer next decision.",
  "Keep the next decision visible, then try the same approach with one changing priority.",
];
function rawPlan(valid: boolean) {
  return {
    strategy: { angle: "a weekly plan that could not adapt to real work" },
    slides: Object.fromEntries(CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((key, i) => [key, {
      storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[i], storyText: i === 3
        ? valid ? "Todaywise let me adjust the next task without rebuilding my entire week." : "Todaywise saved me 90% of my time while planning my work."
        : copy[i],
      ctaText: i === 5 ? "Try the same approach with one changing priority." : null,
      visualContext: `ordinary planning scene ${i + 1}`,
    }])),
  };
}

test("retains a valid candidate between failures and diagnoses only the rejected slots", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  let calls = 0;
  let emptyResponse = false;
  const failures: CarouselStructure2PlanFailure[] = [];
  globalThis.fetch = async () => {
    const content = calls++ === 0
      ? { plans: Object.fromEntries(CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((key, i) => [key, rawPlan(i === 1)])) }
      : rawPlan(false);
    return new Response(JSON.stringify({ choices: [{ message: { content: emptyResponse ? null : JSON.stringify(content) }, finish_reason: "stop" }] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  try {
    const plans = await buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription,
      onPlanFailure: async (failure) => { failures.push(failure); },
    });
    assert.deepEqual(plans.map((plan) => plan.slotIndex), [1]);
    assert.deepEqual(failures.map((failure) => failure.slotIndex), [0, 2, 3, 4]);
    assert.equal(calls, 5, "one batch request and one repair per rejected candidate");
    assert.ok(failures.every((failure) => failure.rawLlmResponse.repair));
    assert.match(failures[0]!.message, /precise claim/);
    assert.ok(plans[0]!.validationResult.advisoryIssues.some((issue) => issue.code === "word_count"));
    assert.equal(plans[0]!.validationResult.repairAttempted, false);
    emptyResponse = true;
    calls = 0;
    await assert.rejects(buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription }), /no Structure 2 story batch content/);
    assert.equal(calls, 1, "an empty provider response must not trigger five repairs");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
