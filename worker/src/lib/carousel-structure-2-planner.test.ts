import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCarouselStructure2StoryPlanBatch,
  CarouselStructure2EmptyProviderResponseError,
  type CarouselStructure2PlanFailure,
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

function shortTakeawayPlan() {
  const plan = rawPlan(true);
  plan.slides[CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS[5]]!.storyText =
    "Keep the next decision visible so changing priorities always have a clear owner and context to continue.";
  return plan;
}

function multiIssuePlan() {
  const plan = rawPlan(true);
  plan.slides.first!.storyText =
    "This cover hook deliberately uses too many words for the compact visual space before anything changes";
  plan.slides.sixth!.storyText = "Keep your next task visible today.";
  return plan;
}

test("a two-statement hook receives a cover-only repair with every body slide frozen", async () => {
  // Each OpenAI instance captures its fetch implementation. Isolate this mock
  // from the following test's cached client without changing production code.
  const { buildCarouselStructure2StoryPlanBatch } = await import(new URL("./carousel-structure-2-planner.js?single-hook-regression", import.meta.url).href) as typeof import("./carousel-structure-2-planner.js");
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  const rejected = rawPlan(true);
  rejected.slides.first!.storyText = "content felt hard. i needed a change";
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    const content = requests.length === 1
      ? { plans: Object.fromEntries(CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((key, index) => [key, index === 0 ? rejected : rawPlan(true)])) }
      : { storyTextBySlide: { slide1: "i kept running out of things to post" } };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const plans = await buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription });
    assert.equal(plans.length, 5);
    assert.equal(requests.length, 2, "one batch request and one isolated cover repair");
    const repaired = plans.find((plan) => plan.slotIndex === 0)!;
    assert.equal(repaired.plan.slides[0]!.storyText, "i kept running out of things to post");
    assert.ok(repaired.validationResult.initialIssues.some((issue) => issue.code === "hook_structure"));
    assert.equal(repaired.validationResult.repaired, true);
    for (const [index, key] of CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.entries()) {
      if (index > 0) assert.equal(repaired.plan.slides[index]!.storyText, rejected.slides[key]!.storyText);
    }
    const schema = requests[1]!.response_format as { json_schema: { schema: { properties: { storyTextBySlide: { properties: Record<string, unknown> } } } } };
    assert.deepEqual(Object.keys(schema.json_schema.schema.properties.storyTextBySlide.properties), ["slide1"]);
    const prompt = JSON.stringify(requests[1]!.messages);
    assert.match(prompt, /Hook slide = one statement only/);
    assert.match(prompt, /First-person hooks are welcome/);
    const messages = requests[1]!.messages as Array<{ role: string; content: string }>;
    const system = messages.find(message => message.role === "system")!.content;
    assert.match(system, /body-block instructions NEVER apply to the cover/);
    assert.match(system, /slide1 NEVER uses a blank line/);
    assert.match(system, /excluding headline and ctaText/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("renderer overflow is repaired before a candidate is accepted even when estimated fit passes", async () => {
  const { buildCarouselStructure2StoryPlanBatch: buildBatch } = await import(new URL("./carousel-structure-2-planner.js?measured-fit-regression", import.meta.url).href) as typeof import("./carousel-structure-2-planner.js");
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  const rejected = rawPlan(true);
  Reflect.set(rejected.slides.sixth!, "headline", null);
  rejected.slides.sixth!.storyText = "I used WWWWWWWWWWWWWWWW for planning.\n\nMy next task had an owner and context so I could continue.";
  const distinctHooks = ["why my Monday plan fell apart", "how changing priorities derailed my week",
    "i kept restarting work after every change", "my task list forgot the next decision", "what i missed when planning my week"];
  rejected.slides.first!.storyText = distinctHooks[0]!;
  const replacement = "Keep your next task visible as priorities change.\n\nA clear owner and context help you continue without starting over.";
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    const content = requests.length === 1
      ? { plans: Object.fromEntries(CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((key, index) => {
          const plan = index === 0 ? rejected : rawPlan(true);
          plan.slides.first!.storyText = distinctHooks[index]!;
          return [key, plan];
        })) }
      : { storyTextBySlide: { slide6: replacement } };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const plans = await buildBatch({ assignments, businessDescription });
    assert.equal(plans.length, 5);
    assert.equal(requests.length, 2);
    const repaired = plans.find(plan => plan.slotIndex === 0)!;
    assert.equal(repaired.plan.slides[5]!.storyText, replacement);
    assert.ok(repaired.validationResult.initialIssues.some(issue => issue.slideNumber === 6 && /Actual renderer/.test(issue.message)));
    assert.deepEqual(repaired.plan.slides.slice(0,5).map(slide => slide.storyText), CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.slice(0,5).map(key => rejected.slides[key]!.storyText));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("retains a valid candidate between failures and diagnoses only the rejected slots", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  let calls = 0;
  const requests: Array<Record<string, unknown>> = [];
  let emptyResponse = false;
  let scenario: "default" | "second-repair" = "default";
  const failures: CarouselStructure2PlanFailure[] = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    const requestNumber = calls++;
    const content = scenario === "second-repair"
      ? requestNumber === 0
        ? {
          plans: Object.fromEntries(
            CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((key, index) => [
              key,
              index === 0 ? multiIssuePlan() : rawPlan(false),
            ]),
          ),
        }
        : requestNumber === 1
          ? {
              storyTextBySlide: {
                slide1: "Campaign changes should not steal nights",
                slide6: "Keep your next task visible today.",
              },
            }
          : requestNumber === 2
            ? { storyTextBySlide: { slide6: copy[5] } }
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
    await assert.rejects(
      buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription }),
      (error: unknown) => {
        assert.ok(error instanceof CarouselStructure2EmptyProviderResponseError);
        assert.equal(error.diagnostic.finishReason, "stop");
        assert.equal(error.diagnostic.responseCharacterCount, 0);
        return true;
      },
    );
    assert.equal(calls, 1, "an empty provider response must not trigger five repairs");

    emptyResponse = false;
    scenario = "second-repair";
    calls = 0;
    requests.splice(0, requests.length);
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
    const firstRepairSchema = requests[1]!
      .response_format as { json_schema: { schema: { properties: { storyTextBySlide: { properties: Record<string, unknown> } } } } };
    const secondRepairSchema = requests[2]!
      .response_format as { json_schema: { schema: { properties: { storyTextBySlide: { properties: Record<string, unknown> } } } } };
    assert.deepEqual(
      Object.keys(firstRepairSchema.json_schema.schema.properties.storyTextBySlide.properties),
      ["slide1", "slide6"],
    );
    assert.deepEqual(
      Object.keys(secondRepairSchema.json_schema.schema.properties.storyTextBySlide.properties),
      ["slide6"],
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
