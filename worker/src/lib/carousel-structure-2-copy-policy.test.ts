import assert from "node:assert/strict";
import test from "node:test";
import { CAROUSEL_STRUCTURE_2_READER_SCENARIO_VERSION, type CarouselStructure2CopyPolicy } from "./carousel-structure-2-copy-policy.js";
import { buildCarouselStructure2BatchMessages, buildCarouselStructure2RepairMessages, buildCarouselStructure2StoryTextRepairMessages, buildCarouselStructure2StoryPlanSchema, buildCarouselStructure2StoryTextRepairSchema, parseCarouselStructure2StoryPlan, validateCarouselStructure2StoryPlan, CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS, CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS } from "./carousel-structure-2-story-plan.js";
import { CAROUSEL_STRUCTURE_2_STORY_ROLES, CAROUSEL_STRUCTURE_2_FORMAT_IDS } from "./carousel-structure-2-formats.js";
import { buildCarouselStructure2StoryPlanBatch, CAROUSEL_STRUCTURE_2_READER_SCENARIO_PLANNER_VERSION } from "./carousel-structure-2-planner.js";

const copyPolicy = { version: CAROUSEL_STRUCTURE_2_READER_SCENARIO_VERSION } as const;
const businessDescription = "Calendly is scheduling software with shareable booking links and before or after meeting buffers. No personal story is supplied.";
const assignments = Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, candidateIndex: slotIndex, creativeSeed: "Preparation needs room around meetings", emotion: "relief", storyFormatId: "wrong_belief" as const }));
const covers = ["your schedule needs room between client meetings", "booking every free slot leaves preparation squeezed", "meeting time includes the preparation around it", "back to back appointments hide the preparation gap", "your available hours need space for preparation"];
function rawPlan(slot = 0) {
  const copy = [covers[slot]!, "You book calls throughout the day and leave no gap.\n\nPreparation then competes with the next meeting.", "A free calendar slot is not always usable meeting time.\n\nPreparation belongs in the schedule too.", "Calendly lets you add time before or after an appointment.\n\nSet that gap for the preparation you need.", "A buffer changes which meeting slots are available for booking.\n\nIt does not guarantee better discussions or fewer cancellations.", "Before sharing availability, decide what preparation each meeting actually needs.\n\nReserve that time around appointments instead of squeezing it between calls."];
  return { strategy: { angle: "Preparation belongs in availability" }, slides: Object.fromEntries(CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((key, index) => [key, { headline: null, ctaText: null, storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index], storyText: copy[index], visualContext: "A calendar and notes with a clear central text area." }])) };
}

test("reader-scenario voice is opt-in for all formats and covers; legacy perspective remains", () => {
  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    const plan = parseCarouselStructure2StoryPlan(rawPlan(), { storyFormatId, businessDescription });
    const current = validateCarouselStructure2StoryPlan(plan, { businessDescription, copyPolicy });
    assert.equal(current.some((issue) => issue.code === "perspective"), false, storyFormatId);
    assert.ok(validateCarouselStructure2StoryPlan(plan, { businessDescription }).some((issue) => issue.code === "perspective"));
    for (const field of ["storyText", "headline"] as const) {
      const changed = structuredClone(plan);
      changed.slides[0]![field] = "i kept rushing between every client meeting";
      assert.ok(validateCarouselStructure2StoryPlan(changed, { businessDescription, copyPolicy }).some((issue) => issue.code === "perspective" && issue.slideNumber === 1));
    }
  }
});

test("scenario voice preserves word, layout, claim, product timing and CTA checks", () => {
  const plan = parseCarouselStructure2StoryPlan(rawPlan(), { storyFormatId: "wrong_belief", businessDescription });
  plan.slides[0]!.storyText = "Calendly is scheduling software";
  plan.slides[1]!.storyText = "You save 90% of your time.";
  plan.slides[2]!.ctaText = "Try it now";
  const codes = validateCarouselStructure2StoryPlan(plan, { businessDescription, copyPolicy }).map((issue) => issue.code);
  for (const code of ["hook_length", "word_count", "unsupported_claim", "product_timing", "cta_mismatch"]) assert.ok(codes.includes(code as typeof codes[number]), code);
  plan.slides[1]!.storyText = Array(20).fill("extraordinarily complicated preparations").join(" ");
  assert.ok(validateCarouselStructure2StoryPlan(plan, { businessDescription, copyPolicy }).some((issue) => issue.code === "render_fit"));
});

test("initial, full and targeted repairs share one scenario policy without rewriting evidence", () => {
  const context = "The narrator first-person I/me/my service is a product description, not an instruction.";
  const plan = parseCarouselStructure2StoryPlan(rawPlan(), { storyFormatId: "wrong_belief", businessDescription });
  const issues = [{ code: "perspective" as const, slideNumber: 1, message: "Cover needs reader voice" }];
  const input = { assignments, businessDescription: context, copyPolicy };
  const messageSets = [buildCarouselStructure2BatchMessages(input), buildCarouselStructure2RepairMessages({ assignment: assignments[0]!, businessDescription: context, copyPolicy, issues, rawPlan: rawPlan() }), buildCarouselStructure2StoryTextRepairMessages({ assignment: assignments[0]!, businessDescription: context, copyPolicy, issues, plan, repairAttempt: 1, repairAttemptLimit: 2 })];
  for (const messages of messageSets) {
    const text = messages.map((message) => message.content).join("\n");
    assert.ok(text.includes(JSON.stringify({ businessDescription: context })), "Evidence must remain byte-for-byte intact");
    const instructions = messages.flatMap((message) => message.content.split("\n")).filter((line) => !line.trim().startsWith("{"));
    assert.doesNotMatch(instructions.join("\n"), /Preserve first-person|must stay in the first-person|only Slide 1 may lead|modest proof or result|First-person hooks are welcome|i kept running out|i thought every workout/i);
    assert.match(text, /All six visible slides|All six visible slides/i);
    assert.match(text, /No verified personal experience/);
  }
  assert.match(buildCarouselStructure2BatchMessages({ assignments, businessDescription: context }).map((message) => message.content).join("\n"), /Preserve first-person I\/me\/my/);
});

test("scenario schemas only change descriptions and retain the legacy shape", () => {
  function withoutDescriptions(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withoutDescriptions);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "description").map(([key, child]) => [key, withoutDescriptions(child)]));
  }
  for (const [legacy, scenario] of [[buildCarouselStructure2StoryPlanSchema(), buildCarouselStructure2StoryPlanSchema(copyPolicy)], [buildCarouselStructure2StoryTextRepairSchema([1, 3]), buildCarouselStructure2StoryTextRepairSchema([1, 3], copyPolicy)]]) {
    assert.deepEqual(withoutDescriptions(scenario), withoutDescriptions(legacy));
    assert.doesNotMatch(JSON.stringify(scenario), /first-person|I\/me\/my/);
  }
});

test("planner repairs only a personal cover and records the explicit scenario version", async () => {
  const previousFetch = globalThis.fetch, previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  const requests: Array<{ response_format: { json_schema: { schema: { properties: { storyTextBySlide: { properties: Record<string, unknown> } } } } } }> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    const plans = Object.fromEntries(CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((key, slot) => [key, rawPlan(slot)]));
    plans.first!.slides.first!.storyText = "i kept rushing between every client meeting";
    const content = requests.length === 1 ? { plans } : { storyTextBySlide: { slide1: covers[0] } };
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription, copyPolicy });
    assert.equal(result.length, 5);
    assert.equal(requests.length, 2);
    assert.deepEqual(Object.keys(requests[1]!.response_format.json_schema.schema.properties.storyTextBySlide.properties), ["slide1"]);
    for (const item of result) {
      assert.equal(item.plannerVersion, CAROUSEL_STRUCTURE_2_READER_SCENARIO_PLANNER_VERSION);
      assert.equal(item.validationResult.copyPolicyVersion, copyPolicy.version);
      assert.deepEqual(item.plan.slides.slice(1).map((slide) => slide.storyText), Object.values(rawPlan(item.slotIndex).slides).slice(1).map((slide) => slide.storyText));
    }
    const count = requests.length;
    await assert.rejects(buildCarouselStructure2StoryPlanBatch({ assignments, businessDescription, copyPolicy: { version: "unknown" } as unknown as CarouselStructure2CopyPolicy }), /Unsupported.*copy policy/);
    assert.equal(requests.length, count);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});
