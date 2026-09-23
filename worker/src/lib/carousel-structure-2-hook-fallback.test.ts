import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCarouselStructure2StoryPlanBatch,
} from "./carousel-structure-2-planner.js";
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


test("template overflow gets one native cover repair without changing story or attribution", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  const overflow = "Every delayed approval quietly stalls the next important campaign decision";
  const source = rawPlan(true);
  source.slides.first!.storyText = overflow;
  let nativeCalls = 0;
  let templateRepairs = 0;
  let useOverflow = true;
  let useUnsupportedClaim = false;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    const name = request.response_format.json_schema.name as string;
    let content: unknown;
    if (name.includes("native_cover")) {
      nativeCalls++;
      assert.match(JSON.stringify(request.messages), /No optional hook template/);
      content = { storyTextBySlide: { slide1: "Why weekly plans collapse by Tuesday" } };
    } else if (name.includes("repair")) {
      templateRepairs++;
      assert.match(JSON.stringify(request.messages), /adapt the hook pattern/);
      content = useUnsupportedClaim ? rawPlan(false) : { storyTextBySlide: { slide1: overflow } };
    } else {
      content = { plans: Object.fromEntries(CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map(key => [key, useUnsupportedClaim ? rawPlan(false) : useOverflow ? source : rawPlan(true)])) };
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const results = await buildCarouselStructure2StoryPlanBatch({
      assignments: assignments.map(a => ({ ...a, hookTemplateId: "the_real_reason", hookTemplateVersion: 1 })),
      businessDescription, onPlanFailure: async () => {},
    });
    assert.ok(results.length > 0);
    assert.ok(nativeCalls > 0);
    assert.ok(templateRepairs >= 2);
    const result = results[0]!;
    assert.equal(result.hookTemplateId, null);
    assert.equal(result.hookTemplateVersion, null);
    assert.equal(result.fallbackReason, "hook_template_cover_render_fit");
    assert.equal(result.validationResult.fallbackUsed, true);
    assert.equal(result.plan.strategy.angle, source.strategy.angle);
    assert.deepEqual(result.plan.slides.slice(1).map(s => s.storyText), CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.slice(1).map(key => source.slides[key]!.storyText));
    useOverflow = false;
    const successful = await buildCarouselStructure2StoryPlanBatch({
      assignments: assignments.map(a => ({ ...a, hookTemplateId: "the_real_reason", hookTemplateVersion: 1 })),
      businessDescription, onPlanFailure: async () => {},
    });
    assert.equal(successful[0]!.hookTemplateId, "the_real_reason");
    assert.equal(successful[0]!.hookTemplateVersion, 1);
    assert.equal(successful[0]!.fallbackReason, null);
    const nativeCallsBeforeClaims = nativeCalls;
    useUnsupportedClaim = true;
    const rejected = await buildCarouselStructure2StoryPlanBatch({
      assignments: assignments.map(a => ({ ...a, hookTemplateId: "the_real_reason", hookTemplateVersion: 1 })),
      businessDescription, onPlanFailure: async () => {},
    });
    assert.equal(rejected.length, 0);
    assert.equal(nativeCalls, nativeCallsBeforeClaims, "native cover repair must never bypass unsupported body claims");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
