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
  "Keep the next decision visible so each changed priority still has one practical next step, accountable owner, and the context needed to continue.",
];
function rawPlan(valid: boolean) {
  return {
    strategy: { angle: "a weekly plan that could not adapt to real work" },
    slides: Object.fromEntries(CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((key, i) => [key, {
      storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[i], storyText: i === 3
        ? valid ? "Todaywise let me adjust the next task without rebuilding my entire week whenever changing priorities shifted the campaign work I needed to finish." : "Todaywise saved me 90% of my time while planning my work."
        : copy[i],
      ctaText: null,
      visualContext: `ordinary planning scene ${i + 1}`,
    }])),
  };
}

function shortTakeawayPlan() {
  const plan = rawPlan(true);
  plan.slides[CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS[5]]!.storyText =
    "Keep the next decision visible so changing priorities always have a clear owner and context to continue.";
  return plan;
}

test("retains a valid candidate between failures and diagnoses only the rejected slots", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  let calls = 0;
  let emptyResponse = false;
  let scenario: "default" | "second-repair" = "default";
  const failures: CarouselStructure2PlanFailure[] = [];
  globalThis.fetch = async () => {
    const requestNumber = calls++;
    const content = scenario === "second-repair"
      ? requestNumber === 0
        ? {
          plans: Object.fromEntries(
            CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((key, index) => [
              key,
              index === 0 ? shortTakeawayPlan() : rawPlan(false),
            ]),
          ),
        }
        : requestNumber === 1
          ? shortTakeawayPlan()
          : requestNumber === 2
            ? rawPlan(true)
            : rawPlan(false)
      : requestNumber === 0
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
    assert.deepEqual(plans[0]!.validationResult.advisoryIssues, []);
    assert.equal(plans[0]!.validationResult.repairAttempted, false);
    emptyResponse = true;
    calls = 0;
    await assert.rejects(buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription }), /no Structure 2 story batch content/);
    assert.equal(calls, 1, "an empty provider response must not trigger five repairs");

    emptyResponse = false;
    scenario = "second-repair";
    calls = 0;
    failures.splice(0, failures.length);
    const secondRepairPlans = await buildCarouselStructure2StoryPlanBatch({
      assignments,
      businessDescription,
      onPlanFailure: async (failure) => { failures.push(failure); },
    });
    assert.deepEqual(secondRepairPlans.map((plan) => plan.slotIndex), [0]);
    assert.deepEqual(failures.map((failure) => failure.slotIndex), [1, 2, 3, 4]);
    assert.equal(calls, 7, "one batch, two bounded repairs, then one repair per unrelated failure");
    assert.equal(secondRepairPlans[0]!.validationResult.repairAttempted, true);
    assert.match(
      secondRepairPlans[0]!.rawLlmResponse.repair ?? "",
      /--- Structure 2 repair attempt ---/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
