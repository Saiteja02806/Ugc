import assert from "node:assert/strict";
import countedSyntheticFixture from "./carousel-config/counted-body-synthetic-fixture.json" with { type: "json" };
import { decodeCountedPlanBodies, CAROUSEL_COUNTED_BODY_REPAIR_VERSION } from "./carousel-counted-body-repair.js";
import test from "node:test";
import { CAROUSEL_BATCH_POSITION_KEYS } from "./carousel-batch-positions.js";

// Fixtures explicitly address keys; production responses no longer choose indexes.
function providerContent(value: unknown) {
  const batch = value as { items?: Array<{ slotIndex: number; [key: string]: unknown }> };
  if (!Array.isArray(batch?.items)) return value;
  return { items: Object.fromEntries(batch.items.map(({ slotIndex, ...item }) => [CAROUSEL_BATCH_POSITION_KEYS[slotIndex]!, item])) };
}

import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  CAROUSEL_CONTENT_GRAMMAR,
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
  CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
} from "./carousel-content-grammar.js";
import { getCarouselHookTemplate } from "./carousel-hook-templates.js";
import {
  buildCarouselContentPlan,
  buildCarouselContentPlanBatch,
  CarouselPartialBatchPlanningError,
  parseCarouselContentPlanForAssignment,
  partitionCarouselContentPlanValidationIssues,
  validateCarouselContentPlan,
} from "./carousel-llm-slide-plan.js";
import { buildCarouselBusinessContentContext } from "./carousel-business-content-context.js";
import {
  buildLineFittedHeadingSvgPath,
  inspectCarouselSlideLayout,
} from "./carousel-render-slide.js";

const analysis: WebsiteBusinessAnalysis = {
  brandTone: "clear and practical",
  businessName: "CampaignFlow",
  carouselAngles: ["A calmer campaign handoff"],
  categories: ["campaign planning"],
  category: "marketing software",
  claimsToAvoid: ["guaranteed revenue growth"],
  confidence: "high",
  ctaIdeas: ["Organize your next campaign"],
  differentiators: ["Planning and reporting stay in one workspace"],
  mainProblem: "Campaign planning and reporting are scattered across tools",
  mainPromise: "Keep campaign work in one organized workflow",
  painPoints: ["Missed follow-ups"],
  productSummary: "A workspace for planning and reporting marketing campaigns.",
  targetAudience: ["small marketing teams"],
  valueProps: ["Connect planning, follow-up, and reporting"],
  visualKeywords: ["paper calendar", "organized desk"],
};

test("a provider-produced synthetic counted plan passes all publishing checks without rewriting copy", () => {
  const decoded = decodeCountedPlanBodies(countedSyntheticFixture);
  const checked = parseCarouselContentPlanForAssignment(decoded, {
    analysis, contentFormatId: "list", hookFamilyId: "surprise", recentHistory: [], slideCount: 6,
  });
  assert.deepEqual(checked.blockingIssues, []);
  for (const slide of checked.plan.slides) assert.equal(slide.ctaText, null);
  assert.equal(checked.plan.slides[4]!.body, countedSyntheticFixture.slides[4]!.body!.firstWords.join(" ")
    + "\n\n" + countedSyntheticFixture.slides[4]!.body!.secondWords.join(" "));
});

test("Structure 1 accepts natural repetition and paraphrasing without rewriting useful advice", () => {
  const fixture = decodeCountedPlanBodies(countedSyntheticFixture) as ReturnType<typeof createFixture>;
  fixture.grounding.anchorId = "workflow:main_problem";
  fixture.concept = "How to stop details disappearing between apps";
  fixture.slides[4]!.body = "Move the launch note to one folder for review.\n\nLink the draft to its approval so edits stay visible.";
  const accepted = parseCarouselContentPlanForAssignment(fixture, {
    analysis, contentFormatId: "list", hookFamilyId: "surprise", recentHistory: [], slideCount: 6,
  });
  assert.deepEqual(accepted.blockingIssues, []);
  for (const code of ["nearby_word_repetition", "grounding_disconnected"]) {
    assert.ok(accepted.advisoryIssues.some((issue) => issue.code === code), code);
  }
  assert.equal(accepted.plan.slides[4]!.body, fixture.slides[4]!.body);
});

test("Structure 1 language relaxation keeps publishing integrity checks blocking", () => {
  const codes = ["body_length", "body_word_limit", "grounding_missing", "grounding_unsupported",
    "grammar", "headline_body_repetition", "headline_length", "hook_structure", "incomplete_ending",
    "invalid_plan", "recent_repetition", "render_fit", "repeated_punctuation", "story_structure",
    "story_repetition", "unresolved_placeholder", "unsupported_claim"] as const;
  const issues = codes.map((code) => ({ code, message: `Integrity check: ${code}`, slideNumber: null }));
  const partitioned = partitionCarouselContentPlanValidationIssues(issues);
  assert.deepEqual(partitioned.blockingIssues, issues);
  assert.deepEqual(partitioned.advisoryIssues, []);
});

test("Structure 1 accepts useful action wording and short sentences with advisory diagnostics", () => {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats.find((candidate) =>
    candidate.slides.some((slide) => slide.slideType === "solution" && !slide.listItemCount),
  )!;
  assert.ok(format);
  const hookFamilyId = format.compatibleHookFamilies[0]!;
  const fixture = createFixture(format.id, hookFamilyId);
  const slide = fixture.slides.find((slide) => slide.slideType === "solution" && !slide.listItems.length)!;
  slide.body = "Record the missing approval beside the launch note today.\n\nAdd a short owner comment before the next review starts.";
  const input = { analysis, contentFormatId: format.id, hookFamilyId, recentHistory: [], slideCount: 6 };
  const accepted = parseCarouselContentPlanForAssignment(fixture, input);
  assert.deepEqual(accepted.blockingIssues, []);
  assert.ok(accepted.advisoryIssues.some((issue) => issue.code === "solution_tone"));

  slide.body = "Check the launch note. Confirm its owner before review.\n\nStore feedback beside the draft so changes remain visible.";
  const shortSentences = parseCarouselContentPlanForAssignment(fixture, input);
  assert.deepEqual(shortSentences.blockingIssues, []);
  assert.ok(shortSentences.advisoryIssues.some((issue) => issue.code === "multiple_ideas"));
});

test("Structure 1 retains all five style-advisory plans without spending repair calls", async () => {
  const assignments = [
    { contentFormatId: "how_to", hookFamilyId: "curiosity" },
    { contentFormatId: "mistakes", hookFamilyId: "problem_recognition" },
    { contentFormatId: "before_after", hookFamilyId: "specific_outcome" },
    { contentFormatId: "comparison", hookFamilyId: "question" },
    { contentFormatId: "list", hookFamilyId: "surprise" },
  ];
  const fixtures = assignments.map((assignment, index) => {
    const plan = createDistinctBatchFixture(assignment.contentFormatId, assignment.hookFamilyId, index);
    plan.concept = `Work smarter: ${plan.concept}`;
    return plan;
  });
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-advisory-batch";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    assert.equal(calls, 1, "Style advisories must not request a repair");
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(providerContent({
      items: fixtures.map((plan, slotIndex) => ({ plan, slotIndex, status: "ready", notApplicableReason: null })),
    })) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await buildCarouselContentPlanBatch({
      analysis, businessDescription: analysis.productSummary ?? "", recentHistory: [],
      bodyRepairPolicy: { version: CAROUSEL_COUNTED_BODY_REPAIR_VERSION },
      items: assignments.map((assignment, slotIndex) => ({ ...assignment, slotIndex, candidateIndex: slotIndex,
        creativeSeed: `Campaign ${slotIndex}`, emotion: "relief", hookTemplateId: null, hookTemplateVersion: null, planningBrief: null })),
    });
    assert.equal(result.length, 5);
    assert.equal(calls, 1);
    for (const item of result) {
      assert.equal(item.plan.validationResult.ok, true);
      assert.ok(item.plan.validationResult.advisoryIssues.some((issue) => issue.code === "generic_copy"));
      assert.equal(item.plan.concept, fixtures[item.slotIndex]!.concept);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("backend batch positions must be exactly the five integer slots before calling the provider", async () => {
  for (const slots of [[0, 1, 2, 3, 3], [0, 1, 2, 3, 3.5], [0, 1, 2, 3, NaN], [0, 1, 2, 3, 5]]) {
    await assert.rejects(buildCarouselContentPlanBatch({ analysis, businessDescription: analysis.productSummary ?? "", recentHistory: [],
      items: slots.map(slotIndex => ({ contentFormatId: "how_to", hookFamilyId: "curiosity", slotIndex, candidateIndex: slotIndex,
        creativeSeed: "Campaign", emotion: "relief", hookTemplateId: null, hookTemplateVersion: null, planningBrief: null })),
    }), /slots 0 through 4 exactly once/);
  }
});

test("backend-owned keys preserve brief mapping and repair only a missing assigned item", async () => {
  const assignments = [
    { contentFormatId: "how_to", hookFamilyId: "curiosity" },
    { contentFormatId: "mistakes", hookFamilyId: "problem_recognition" },
    { contentFormatId: "before_after", hookFamilyId: "specific_outcome" },
    { contentFormatId: "comparison", hookFamilyId: "question" },
    { contentFormatId: "list", hookFamilyId: "surprise" },
  ];
  const fixtures = assignments.map((a, i) => createDistinctBatchFixture(a.contentFormatId, a.hookFamilyId, i));
  const previousFetch = globalThis.fetch, previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-fixed-position-missing-item";
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)); calls++;
    let content: unknown;
    if (calls === 1) {
      const schema = request.response_format.json_schema.schema;
      assert.equal(schema.properties.items.type, "object");
      assert.deepEqual(schema.properties.items.required, [...CAROUSEL_BATCH_POSITION_KEYS]);
      assert.equal(JSON.stringify(schema).includes('"slotIndex"'), false);
      const items = Object.fromEntries([...CAROUSEL_BATCH_POSITION_KEYS].reverse().filter(key => key !== "second")
        .map(key => [key, { plan: fixtures[CAROUSEL_BATCH_POSITION_KEYS.indexOf(key)], status: "ready", notApplicableReason: null }]));
      content = { items };
    } else {
      assert.equal(calls, 2, "Only the missing second slot may require a repair");
      assert.equal(request.response_format.json_schema.name, "repaired_carousel_batch_item");
      content = fixtures[1];
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await buildCarouselContentPlanBatch({ analysis, businessDescription: analysis.productSummary ?? "", recentHistory: [],
      items: assignments.map((assignment, slotIndex) => ({ ...assignment, slotIndex, candidateIndex: slotIndex + 100,
        creativeSeed: `Campaign ${slotIndex}`, emotion: "relief", hookTemplateId: null, hookTemplateVersion: null, planningBrief: null })).reverse(),
    });
    assert.equal(calls, 2);
    assert.deepEqual(result.map(item => item.slotIndex), [0, 1, 2, 3, 4]);
    for (const item of result) {
      assert.equal(item.actualContentFormatId, assignments[item.slotIndex]!.contentFormatId);
      assert.equal(item.plan.concept, fixtures[item.slotIndex]!.concept);
      assert.equal(item.plan.validationResult.repairAttempted, item.slotIndex === 1);
    }
  } finally { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
});

test("Structure 1 accepts a short body and a heading wrapped onto two fixed-size lines", async () => {
  const raw = createFixture("comparison", "question");
  const plan = parseCarouselContentPlanForAssignment(raw, { analysis, contentFormatId: "comparison", hookFamilyId: "question", recentHistory: [], slideCount: 6 }).plan;
  const slide = plan.slides[1]!;
  Object.assign(slide, { textMode: "headline_body", headline: "Keep campaign reviews connected to each clear next decision", body: "Store review notes beside the campaign draft.", subtext: null });
  const issues = validateCarouselContentPlan(plan, analysis);
  assert.equal(issues.some(issue => issue.slideNumber === 2 && ["body_length", "headline_length", "render_fit"].includes(issue.code)), false);
  for (const format of ["1:1", "4:5"] as const) {
    const layout = await inspectCarouselSlideLayout({ format, slide });
    assert.equal(layout.headingBackgroundLineCount, 2);
  }
  slide.headline = "Keep campaign\nreviews connected\nto each next decision";
  assert.ok(validateCarouselContentPlan(plan, analysis).some(issue => issue.slideNumber === 2 && issue.code === "render_fit"));
});

test("Structure 1 expands every educational format to the agreed six-slide flow", () => {
  assert.equal(CAROUSEL_CONTENT_GRAMMAR.formats.length, 15);
  assert.equal(CAROUSEL_CONTENT_GRAMMAR.hookFamilies.length, 10);
  assert.equal(
    CAROUSEL_CONTENT_GRAMMAR_VERSION,
    "carousel-formats-v2-six-slide-core-flow+carousel-hook-families-v1",
  );

  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    assert.equal(format.slides.length, CAROUSEL_STRUCTURE_1_SLIDE_COUNT);
    assert.equal(format.slides[0]!.role, "cover_hook");
    assert.equal(format.slides[0]!.slideType, "hook");
    assert.equal(format.slides[4]!.role, "practical_extension");
    assert.equal(format.slides[5]!.role, "takeaway_cta");
    assert.equal(format.slides[5]!.slideType, "cta");
  }
});

test("Structure 1 accepts a six-slide reader-first educational carousel", () => {
  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    const hookFamilyId = format.compatibleHookFamilies[0]!;
    const result = parseCarouselContentPlanForAssignment(
      createFixture(format.id, hookFamilyId),
      {
        analysis,
        contentFormatId: format.id,
        hookFamilyId,
        recentHistory: [],
        slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
      },
    );

    assert.deepEqual(result.blockingIssues, [], format.id);
    assert.equal(result.plan.slides.length, 6, format.id);
    assert.equal(result.plan.slides[0]!.formatRole, "cover_hook");
    assert.equal(result.plan.slides[5]!.formatRole, "takeaway_cta");
  }
});

test("Structure 1 accepts lowercase body openings across every educational format", () => {
  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    const hookFamilyId = format.compatibleHookFamilies[0]!;
    const fixture = createFixture(format.id, hookFamilyId);
    for (const slide of fixture.slides) {
      if (slide.body) slide.body = slide.body.toLowerCase();
    }

    const result = parseCarouselContentPlanForAssignment(fixture, {
      analysis,
      contentFormatId: format.id,
      hookFamilyId,
      recentHistory: [],
      slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
    });

    assert.deepEqual(result.blockingIssues, [], format.id);
    assert.ok(
      result.plan.slides.some((slide) => slide.body && /^[a-z]/.test(slide.body)),
      format.id,
    );
  }
});

test("Structure 1 still blocks repeated words and punctuation spacing in lowercase bodies", () => {
  const original = parseCarouselContentPlanForAssignment(
    createFixture("comparison", "question"),
    { analysis, contentFormatId: "comparison", hookFamilyId: "question", recentHistory: [], slideCount: 6 },
  ).plan;
  const slide = original.slides.find((slide) => slide.slideNumber > 1 && slide.body);
  assert.ok(slide?.body);
  const lowercase = slide.body.toLowerCase();
  const firstWord = lowercase.split(/\s+/)[0]!;

  for (const body of [
    `${firstWord} ${lowercase}`,
    lowercase.replace(/\.$/, " ."),
  ]) {
    const altered = {
      ...original,
      slides: original.slides.map((current) =>
        current.slideNumber === slide.slideNumber ? { ...current, body } : current,
      ),
    };
    const partitioned = partitionCarouselContentPlanValidationIssues(
      validateCarouselContentPlan(altered, analysis),
    );
    assert.ok(
      partitioned.blockingIssues.some((issue) => issue.code === "grammar" && issue.slideNumber === slide.slideNumber),
      body,
    );
  }
});

test("Structure 1 removes only a body that exactly duplicates its list items", () => {
  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats.filter((format) =>
    format.slides.some((slide) => slide.listItemCount !== undefined),
  )) {
    const hookFamilyId = format.compatibleHookFamilies[0]!;
    for (const marker of ["numbered", "bullet", "plain"] as const) {
      const fixture = createFixture(format.id, hookFamilyId);
      for (const slide of fixture.slides) {
        if (slide.listItems.length > 0) {
          slide.body = slide.listItems.map((item, index) =>
            marker === "numbered" ? `${index + 3}. ${item}` : marker === "bullet" ? `- ${item}` : item,
          ).join("\n\n");
        }
      }
      const result = parseCarouselContentPlanForAssignment(fixture, {
        analysis, contentFormatId: format.id, hookFamilyId, recentHistory: [], slideCount: 6,
      });
      assert.deepEqual(result.blockingIssues, [], `${format.id}/${marker}`);
      for (const slide of result.plan.slides.filter((slide) => slide.listItems.length > 0)) {
        assert.equal(slide.body, null);
        assert.equal(slide.subtext, null);
        assert.deepEqual(slide.listItems, fixture.slides[slide.slideNumber - 1]!.listItems);
      }
    }
  }
});

test("Structure 1 never discards unique list-body advice or relaxes item fit", () => {
  const fixture = createFixture("list", "curiosity");
  const input = { analysis, contentFormatId: "list", hookFamilyId: "curiosity", recentHistory: [], slideCount: 6 };
  const slide = fixture.slides.find((slide) => slide.listItems.length > 0)!;
  slide.body = `Important context that must not disappear.\n\n${slide.listItems.map((item, index) => `${index + 1}. ${item}`).join("\n\n")}`;
  assert.throws(() => parseCarouselContentPlanForAssignment(fixture, input), /List line|Body must|one clear idea/i);
  slide.body = null;
  slide.listItems[0] = "A deliberately excessive sentence that cannot fit inside the fixed list item area because it repeats every detail";
  assert.throws(() => parseCarouselContentPlanForAssignment(fixture, input), /list items|List line/i);
});

test("Structure 1 repair diagnostics report the actual body count separately from headings", () => {
  const fixture = createFixture("comparison", "question");
  const parsed = parseCarouselContentPlanForAssignment(fixture, {
    analysis, contentFormatId: "comparison", hookFamilyId: "question", recentHistory: [], slideCount: 6,
  }).plan;
  parsed.slides[1]!.headline = "Detailed campaign planning advice";
  parsed.slides[1]!.body = "Keep campaign decisions visible";
  const issues = validateCarouselContentPlan(parsed, analysis);
  assert.equal(issues.some((issue) => issue.code === "body_length"), false);
  parsed.slides[1]!.body = "Keep campaign decisions visible. ".repeat(20);
  assert.match(validateCarouselContentPlan(parsed, analysis).find((issue) => issue.code === "body_length")?.message ?? "", /Actual body:.*excluding the headline, list and CTA/);
});

test("counted body repair preserves all valid fields with the existing one-call repair budget", async () => {
  const assignments = [
    { contentFormatId: "how_to", hookFamilyId: "curiosity" },
    { contentFormatId: "mistakes", hookFamilyId: "problem_recognition" },
    { contentFormatId: "before_after", hookFamilyId: "specific_outcome" },
    { contentFormatId: "comparison", hookFamilyId: "question" },
    { contentFormatId: "list", hookFamilyId: "surprise" },
  ];
  const fixtures = assignments.map((a, i) => createDistinctBatchFixture(a.contentFormatId, a.hookFamilyId, i));
  const finalBody = fixtures[0]!.slides[5]!.body!;
  fixtures[0]!.slides[5]!.body = "Keep the next decision visible for";
  const previousFetch = globalThis.fetch, previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-counted-repair";
  const requests: Array<{ response_format: { json_schema: { name: string; schema: { properties: Record<string, unknown> } } } }> = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)); requests.push(request);
    const words = finalBody.split(/\s+/);
    const midpoint = Math.ceil(words.length / 2);
    const content = request.response_format.json_schema.name === "carousel_content_batch"
      ? { items: fixtures.map((plan, slotIndex) => ({ plan, slotIndex, status: "ready", notApplicableReason: null })) }
      : { bodiesBySlide: { slide6: { firstWords: words.slice(0, midpoint), secondWords: words.slice(midpoint) } } };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(providerContent(content)) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await buildCarouselContentPlanBatch({ analysis, businessDescription: analysis.productSummary ?? "", recentHistory: [],
      bodyRepairPolicy: { version: CAROUSEL_COUNTED_BODY_REPAIR_VERSION },
      items: assignments.map((assignment, slotIndex) => ({ ...assignment, slotIndex, candidateIndex: slotIndex, creativeSeed: `Campaign ${slotIndex}`, emotion: "relief", hookTemplateId: null, hookTemplateVersion: null, planningBrief: null })),
    });
    assert.equal(result.length, 5);
    assert.equal(requests.length, 2);
    assert.equal(requests[1]!.response_format.json_schema.name, "counted_carousel_body_repair");
    assert.equal(result[0]!.plan.slides[5]!.body?.split(/\s+/).length, finalBody.split(/\s+/).length);
    for (const item of result) {
      assert.equal(item.plan.validationResult.bodyRepairPolicyVersion, CAROUSEL_COUNTED_BODY_REPAIR_VERSION);
      for (const slide of item.plan.slides) {
        const original = fixtures[item.slotIndex]!.slides[slide.slideNumber - 1]!;
        assert.equal(slide.headline, original.headline);
        assert.deepEqual(slide.listItems, original.listItems);
        assert.equal(slide.imageDirection, original.imageDirection);
        if (!(item.slotIndex === 0 && slide.slideNumber === 6)) assert.equal(slide.body, original.body);
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("mixed safety/body failures use counted repairs and preserve other batch items", async () => {
  const assignments = [
    { contentFormatId: "how_to", hookFamilyId: "curiosity" },
    { contentFormatId: "mistakes", hookFamilyId: "problem_recognition" },
    { contentFormatId: "before_after", hookFamilyId: "specific_outcome" },
    { contentFormatId: "comparison", hookFamilyId: "question" },
    { contentFormatId: "list", hookFamilyId: "surprise" },
  ];
  const fixtures = assignments.map((a, i) => createDistinctBatchFixture(a.contentFormatId, a.hookFamilyId, i));
  const fixed = structuredClone(fixtures[0]!);
  fixtures[0]!.concept = "Work smarter";
  fixtures[0]!.slides[3]!.imageDirection = "A person at a desk.";
  fixtures[0]!.slides[5]!.body = "Keep the next decision visible for";
  const counted = { ...fixed, slides: fixed.slides.map((slide) => {
    if (!slide.body) return slide;
    const words = slide.body.split(/\s+/);
    const midpoint = Math.ceil(words.length / 2);
    return { ...slide, body: { firstWords: words.slice(0, midpoint), secondWords: words.slice(midpoint) } };
  }) };
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-full-counted-repair";
  let rejectRepair = false;
  let needsBodyFollowup = false;
  const requests: Array<{ response_format: { json_schema: { name: string; schema: unknown } } }> = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)); requests.push(request);
    const content = request.response_format.json_schema.name === "carousel_content_batch"
      ? { items: fixtures.map((plan, slotIndex) => ({ plan, slotIndex, status: "ready", notApplicableReason: null })) }
      : request.response_format.json_schema.name === "scoped_carousel_batch_repair"
        ? { concept: fixed.concept, angle: fixed.contentStrategy.angle, broadSituations: fixed.broadSituations,
          bodiesBySlide: { slide6: counted.slides[5]!.body } }
        : request.response_format.json_schema.name === "counted_carousel_body_repair"
        ? { bodiesBySlide: { slide6: counted.slides[5]!.body } }
        : rejectRepair ? { ...counted, grounding: { anchorId: "product_detail:invented" } }
          : needsBodyFollowup ? { ...counted, slides: counted.slides.map((slide, index) => index === 5 ? { ...slide, body: "Keep the next decision visible for" } : slide) } : counted;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(providerContent(content)) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const input = { analysis, businessDescription: analysis.productSummary ?? "", recentHistory: [],
      bodyRepairPolicy: { version: CAROUSEL_COUNTED_BODY_REPAIR_VERSION } as const,
      items: assignments.map((assignment, slotIndex) => ({ ...assignment, slotIndex, candidateIndex: slotIndex, creativeSeed: `Campaign ${slotIndex}`, emotion: "relief", hookTemplateId: null, hookTemplateVersion: null, planningBrief: null })),
    };
    const result = await buildCarouselContentPlanBatch(input);
    assert.equal(result.length, 5);
    assert.equal(requests.length, 2);
    assert.equal(requests[1]!.response_format.json_schema.name, "repaired_carousel_batch_item");
    for (const request of requests) assert.match(JSON.stringify(request.response_format.json_schema.schema), /firstWords/);
    assert.equal(result[0]!.plan.concept, fixed.concept);
    assert.equal(typeof result[0]!.plan.slides[5]!.body, "string");
    assert.equal(result[0]!.plan.validationResult.ok, true);
    assert.equal(result[1]!.plan.slides[2]!.body, fixtures[1]!.slides[2]!.body);
    fixtures[0]!.slides[3]!.imageDirection = fixed.slides[3]!.imageDirection;
    requests.length = 0;
    const scoped = await buildCarouselContentPlanBatch(input);
    assert.equal(scoped.length, 5);
    assert.equal(requests[1]!.response_format.json_schema.name, "counted_carousel_body_repair");
    assert.equal(scoped[0]!.plan.slides[2]!.body, fixed.slides[2]!.body);
    fixtures[0]!.slides[3]!.imageDirection = "A person at a desk.";
    needsBodyFollowup = true;
    requests.length = 0;
    const followedUp = await buildCarouselContentPlanBatch(input);
    assert.equal(followedUp.length, 5);
    assert.equal(requests.length, 3);
    assert.equal(requests[2]!.response_format.json_schema.name, "counted_carousel_body_repair");
    assert.equal(followedUp[0]!.plan.slides[2]!.body, fixed.slides[2]!.body);
    assert.equal(followedUp[0]!.plan.slides[5]!.body, fixed.slides[5]!.body);
    needsBodyFollowup = false;
    rejectRepair = true;
    await assert.rejects(buildCarouselContentPlanBatch(input), (error: unknown) => {
      assert.ok(error instanceof CarouselPartialBatchPlanningError);
      assert.deepEqual(error.completedItems.map((item) => item.slotIndex), [1, 2, 3, 4]);
      assert.ok(error.completedItems.every((item) => item.plan.validationResult.ok));
      return true;
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("Structure 1 rejects calls to action on every helpful-tip slide", () => {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats[0]!;
  const fixture = createFixture(format.id, format.compatibleHookFamilies[0]!);
  Reflect.set(fixture.slides[5]!, "ctaText", "Save this for later.");

  assert.throws(() => parseCarouselContentPlanForAssignment(fixture, {
    analysis, contentFormatId: format.id, hookFamilyId: format.compatibleHookFamilies[0]!, recentHistory: [], slideCount: 6,
  }), /Helpful tips cannot include a call to action/i);
});

test("Structure 1 requires one 5-14 word hook and rejects Slide 1 support copy", () => {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats[0]!;
  const input = {
    analysis,
    contentFormatId: format.id,
    hookFamilyId: format.compatibleHookFamilies[0]!,
    recentHistory: [],
    slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
  };
  const shortHook = createFixture(format.id, format.compatibleHookFamilies[0]!);
  shortHook.slides[0]!.headline = "Stop losing approvals today";

  assert.throws(
    () => parseCarouselContentPlanForAssignment(shortHook, input),
    /Headline must be 5-14 words/i,
  );

  const withSupport = createFixture(format.id, format.compatibleHookFamilies[0]!);
  withSupport.slides[0]!.body = "Keep every approval beside the decision that needs it.";

  assert.throws(
    () => parseCarouselContentPlanForAssignment(withSupport, input),
    /no supporting body copy/i,
  );
});

test("Structure 1 blocks two-sentence covers even within the hook word budget", () => {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats[0]!;
  const fixture = createFixture(format.id, format.compatibleHookFamilies[0]!);
  fixture.slides[0]!.headline = "content felt hard. i needed a change";
  assert.throws(() => parseCarouselContentPlanForAssignment(fixture, { analysis, contentFormatId: format.id, hookFamilyId: format.compatibleHookFamilies[0]!, recentHistory: [], slideCount: 6 }), /one statement only/i);
  fixture.slides[0]!.headline = "i kept running out of things to post";
  const valid = parseCarouselContentPlanForAssignment(fixture, { analysis, contentFormatId: format.id, hookFamilyId: format.compatibleHookFamilies[0]!, recentHistory: [], slideCount: 6 });
  assert.deepEqual(valid.blockingIssues, []);
  fixture.slides[0]!.headline = "why i kept saying yes to every small task and lost my whole week";
  assert.deepEqual(parseCarouselContentPlanForAssignment(fixture, { analysis, contentFormatId: format.id, hookFamilyId: format.compatibleHookFamilies[0]!, recentHistory: [], slideCount: 6 }).blockingIssues, []);
  fixture.slides[0]!.headline += " again";
  assert.throws(() => parseCarouselContentPlanForAssignment(fixture, { analysis, contentFormatId: format.id, hookFamilyId: format.compatibleHookFamilies[0]!, recentHistory: [], slideCount: 6 }), /Headline must be 5-14 words/i);
});

test("Structure 1 accepts useful short body copy but still blocks excessive body copy", () => {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats[0]!;
  const input = {
    analysis,
    contentFormatId: format.id,
    hookFamilyId: format.compatibleHookFamilies[0]!,
    recentHistory: [],
    slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
  };
  const tooShort = createFixture(format.id, format.compatibleHookFamilies[0]!);
  const shortProseSlide = tooShort.slides.find(
    (slide) => slide.slideNumber > 1 && slide.body !== null,
  );
  assert.ok(shortProseSlide);
  shortProseSlide.body =
    "Keep every approval visible beside the campaign work it affects during handoffs.";

  assert.deepEqual(parseCarouselContentPlanForAssignment(tooShort, input).blockingIssues, []);

  const tooLong = createFixture(format.id, format.compatibleHookFamilies[0]!);
  const longProseSlide = tooLong.slides.find(
    (slide) => slide.slideNumber > 1 && slide.body !== null,
  );
  assert.ok(longProseSlide);
  longProseSlide.body =
    "Keep every approval, owner, decision, deadline, campaign version, review note, reporting signal, next action, unresolved question, stakeholder comment, dependency, and change request visible beside the active work so the handoff never loses essential operating context, timing, or responsibility.";

  assert.ok(
    validateCarouselContentPlan(
      tooLong as unknown as Parameters<typeof validateCarouselContentPlan>[0],
      analysis,
    ).some(
      (issue) =>
        issue.code === "body_word_limit" &&
        issue.slideNumber === longProseSlide.slideNumber,
    ),
  );
});

test("Structure 1 requires a verified anchor but records missing exact keywords as advisory", () => {
  const input = {
    analysis,
    contentFormatId: "how_to",
    hookFamilyId: "curiosity",
    recentHistory: [],
    slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
  };

  const missingAnchor: Record<string, unknown> = {
    ...createFixture("how_to", "curiosity"),
  };
  delete missingAnchor.grounding;
  assert.throws(
    () => parseCarouselContentPlanForAssignment(missingAnchor, input),
    /grounding/i,
  );

  const unsupportedAnchor = createFixture("how_to", "curiosity");
  unsupportedAnchor.grounding.anchorId = "product_detail:invented";
  assert.throws(
    () => parseCarouselContentPlanForAssignment(unsupportedAnchor, input),
    /grounding/i,
  );

  const disconnectedAnchor = createFixture("how_to", "curiosity");
  disconnectedAnchor.concept = "A practical way to keep a launch review clear";
  const accepted = parseCarouselContentPlanForAssignment(disconnectedAnchor, input);
  assert.deepEqual(accepted.blockingIssues, []);
  assert.ok(accepted.advisoryIssues.some((issue) => issue.code === "grounding_disconnected"));
});

test("Structure 1 accepts a persisted Slide 1 hook template without changing its six-slide grammar", () => {
  const hookTemplate = getCarouselHookTemplate("cracked_the_code");
  const result = parseCarouselContentPlanForAssignment(
    createFixture("how_to", "curiosity"),
    {
      analysis,
      contentFormatId: "how_to",
      hookFamilyId: "curiosity",
      hookTemplateId: hookTemplate.id,
      hookTemplateVersion: hookTemplate.version,
      recentHistory: [],
      slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
    },
  );

  assert.deepEqual(result.blockingIssues, []);
  assert.equal(result.plan.slides.length, 6);
  assert.equal(result.plan.slides[0]!.formatRole, "cover_hook");
  assert.equal(result.plan.slides[1]!.formatRole, "step_1");
  assert.equal(result.plan.slides[5]!.formatRole, "takeaway_cta");
});

test("Structure 1 falls back when a persisted hook template conflicts with its selected format", () => {
  const hookTemplate = getCarouselHookTemplate("steal_this_formula");
  const result = parseCarouselContentPlanForAssignment(
    createFixture("comparison", "curiosity"),
    {
      analysis,
      contentFormatId: "comparison",
      hookFamilyId: "curiosity",
      hookTemplateId: hookTemplate.id,
      hookTemplateVersion: hookTemplate.version,
      recentHistory: [],
      slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
    },
  );

  assert.deepEqual(result.blockingIssues, []);
  assert.equal(result.plan.slides.length, 6);
});

test("Structure 1 falls back for stale, incomplete, and unknown template assignments", () => {
  const scenarios = [
    { hookTemplateId: "cracked_the_code", hookTemplateVersion: 999 },
    { hookTemplateId: null, hookTemplateVersion: 1 },
    { hookTemplateId: "misspelled_template", hookTemplateVersion: 1 },
  ];

  for (const scenario of scenarios) {
    const result = parseCarouselContentPlanForAssignment(
      createFixture("how_to", "curiosity"),
      {
        analysis,
        contentFormatId: "how_to",
        hookFamilyId: "curiosity",
        hookTemplateId: scenario.hookTemplateId,
        hookTemplateVersion: scenario.hookTemplateVersion,
        recentHistory: [],
        slideCount: CAROUSEL_STRUCTURE_1_SLIDE_COUNT,
      },
    );

    assert.deepEqual(result.blockingIssues, []);
  }
});

test("the worker sends a persisted template only as Slide 1 planner guidance", async () => {
  const hookTemplate = getCarouselHookTemplate("cracked_the_code");
  const fixture = createFixture("how_to", "curiosity");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let request: Record<string, unknown> | null = null;

  process.env.OPENAI_API_KEY = "test-key-batch";
  globalThis.fetch = (async (_input, init) => {
    request = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: {
              content: JSON.stringify(fixture),
              refusal: null,
              role: "assistant",
            },
          },
        ],
        created: 0,
        id: "chatcmpl-hook-template-test",
        model: "gpt-4o-mini",
        object: "chat.completion",
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  }) as typeof fetch;

  try {
    const plan = await buildCarouselContentPlan({
      analysis,
      businessDescription: analysis.productSummary ?? undefined,
      contentFormatId: "how_to",
      creativeSeed: "Clearer campaign handoffs",
      emotion: "relief",
      hookFamilyId: "curiosity",
      hookTemplateId: hookTemplate.id,
      hookTemplateVersion: hookTemplate.version,
      recentHistory: [],
      slideCount: 6,
    });
    const requestText = JSON.stringify(request);

    assert.equal(plan.slides.length, 6);
    assert.match(requestText, /Resolved combined Structure 1 format/);
    assert.match(requestText, /how_to__cracked_the_code/);
    assert.match(requestText, new RegExp(hookTemplate.id));
    assert.match(requestText, /I finally cracked the code for \{topic\}/);
    assert.match(requestText, /not let it change Slides 2-6/i);
    assert.match(requestText, /Verified grounding anchors/i);
    assert.match(requestText, /social slideshow cover/i);
    assert.match(requestText, /72px/i);
    assert.match(requestText, /Inter Medium at 500 weight/i);
    assert.match(requestText, /normally 6-14 words/i);
    assert.match(requestText, /four centred display lines at 72px/i);
    assert.match(requestText, /no minimum word count/i);
    assert.match(requestText, /conversational lowercase/i);
    assert.match(requestText, /Hook slide = one statement only/i);
    assert.match(requestText, /First-person hooks are welcome/i);
    assert.match(requestText, /Save the explanation for Slide 2 onward/i);
    assert.doesNotMatch(requestText, /Do not begin a complete personal story|Do not open with a complete personal-story/i);
    assert.match(requestText, /only add one when it names a distinct idea/i);
    // Word limits stay in the prompt and publisher validator. They must not be
    // encoded as regex patterns in the strict decoder schema: gpt-4o-mini can
    // terminate with an empty `length` response when those patterns are present.
    const responseSchema = (
      request as {
        response_format?: { json_schema?: { schema?: unknown } };
      } | null
    )?.response_format?.json_schema?.schema;
    assert.doesNotMatch(JSON.stringify(responseSchema), /"pattern":/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Structure 1 drops an optional hook overlay after two Slide 1 overflow attempts", async () => {
  const hookTemplate = getCarouselHookTemplate("doing_it_wrong");
  const initial = createFixture("mistakes", "problem_recognition");
  const repair = structuredClone(initial);
  const originalSlideTwoBody = initial.slides[1]!.body;
  const overflowingHook =
    "Cross-functional campaign handoffs repeatedly create invisible approval bottlenecks";

  initial.slides[0]!.headline = overflowingHook;
  repair.slides[0]!.headline = overflowingHook;
  repair.slides[1]!.body =
    "This repair incorrectly rewrote a valid second slide even though the only failing content was the long cover hook on Slide 1.";

  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const requests: Array<Record<string, unknown>> = [];

  process.env.OPENAI_API_KEY = "test-key-hook-overflow-fallback";
  globalThis.fetch = (async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body)) as {
      response_format?: { json_schema?: { name?: string } };
    };
    requests.push(requestBody);
    const schemaName = requestBody.response_format?.json_schema?.name;
    const responseContent =
      schemaName === "native_slide_one_overflow_fallback"
        ? {
            slide: {
              ...initial.slides[0],
              body: null,
              headline: "Why campaign handoffs keep breaking",
            },
          }
        : schemaName === "repaired_carousel_content_plan"
          ? repair
          : initial;

    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: {
              content: JSON.stringify(providerContent(responseContent)),
              refusal: null,
              role: "assistant",
            },
          },
        ],
        created: 0,
        id: `chatcmpl-${schemaName}`,
        model: "gpt-4o-mini",
        object: "chat.completion",
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  }) as typeof fetch;

  try {
    const plan = await buildCarouselContentPlan({
      analysis,
      businessDescription: analysis.productSummary ?? undefined,
      contentFormatId: "mistakes",
      creativeSeed: "Clearer campaign handoffs",
      emotion: "relief",
      hookFamilyId: "problem_recognition",
      hookTemplateId: hookTemplate.id,
      hookTemplateVersion: hookTemplate.version,
      recentHistory: [],
      slideCount: 6,
    });

    assert.equal(requests.length, 3);
    assert.equal(plan.slides[0]!.body, null);
    assert.equal(plan.slides[0]!.headline, "Why campaign handoffs keep breaking");
    assert.equal(plan.slides[1]!.body, originalSlideTwoBody);
    assert.deepEqual(
      plan.slides.slice(1).map((slide) => slide.formatRole),
      initial.slides.slice(1).map((slide) => slide.formatRole),
    );
    assert.equal(plan.validationResult.hookTemplateFallbackUsed, true);
    assert.ok(plan.rawLlmResponse.hookFallback);
    assert.match(
      JSON.stringify(requests[2]),
      /optional hook-template pattern has been removed/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("the production-shaped five-item batch uses combined formats and a native fallback", async () => {
  const assignments = [
    {
      contentFormatId: "how_to",
      hookFamilyId: "curiosity",
      hookTemplateId: "cracked_the_code",
      hookTemplateVersion: 1,
    },
    {
      contentFormatId: "mistakes",
      hookFamilyId: "problem_recognition",
      hookTemplateId: "doing_it_wrong",
      hookTemplateVersion: 1,
    },
    {
      contentFormatId: "before_after",
      hookFamilyId: "specific_outcome",
      hookTemplateId: "simple_switch_10x",
      hookTemplateVersion: 1,
    },
    {
      contentFormatId: "comparison",
      hookFamilyId: "question",
      hookTemplateId: "advice_to_ignore",
      hookTemplateVersion: 1,
    },
    {
      contentFormatId: "list",
      hookFamilyId: "surprise",
      hookTemplateId: null,
      hookTemplateVersion: null,
    },
  ];
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let request: Record<string, unknown> | null = null;

  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body)) as {
      messages?: Array<{ content?: string }>;
      response_format?: { json_schema?: { name?: string } };
    };
    const schemaName = requestBody.response_format?.json_schema?.name;
    if (schemaName === "carousel_content_batch") request = requestBody;
    const prompt = requestBody.messages?.map((message) => message.content).join("\n") ?? "";
    const slotMatches = [...prompt.matchAll(/"slotIndex":(\d)/g)];
    const repairSlotIndex = Number(slotMatches.at(-1)?.[1] ?? 0);
    const repairAssignment = assignments[repairSlotIndex] ?? assignments[0]!;
    const responseContent =
      schemaName === "repaired_carousel_batch_item"
        ? createDistinctBatchFixture(
            repairAssignment.contentFormatId,
            repairAssignment.hookFamilyId,
            repairSlotIndex,
          )
        : {
            items: assignments.map((assignment, slotIndex) => ({
              notApplicableReason: null,
              plan: createDistinctBatchFixture(
                assignment.contentFormatId,
                assignment.hookFamilyId,
                slotIndex,
              ),
              slotIndex,
              status: "ready",
            })),
          };
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: {
              content: JSON.stringify(providerContent(responseContent)),
              refusal: null,
              role: "assistant",
            },
          },
        ],
        created: 0,
        id: "chatcmpl-combined-format-batch-test",
        model: "gpt-4o-mini",
        object: "chat.completion",
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  }) as typeof fetch;

  try {
    const plans = await buildCarouselContentPlanBatch({
      analysis,
      businessDescription: analysis.productSummary ?? "",
      items: assignments.map((assignment, slotIndex) => ({
        candidateIndex: slotIndex,
        ...assignment,
        creativeSeed: `Campaign handoff angle ${slotIndex + 1}`,
        emotion: "relief",
        planningBrief: null,
        slotIndex,
      })),
      recentHistory: [],
    });
    const requestText = JSON.stringify(request);

    assert.equal(plans.length, 5);
    assert.deepEqual(
      plans.map((plan) => plan.actualHookTemplateId),
      [
        "cracked_the_code",
        "doing_it_wrong",
        "simple_switch_10x",
        "advice_to_ignore",
        null,
      ],
    );
    assert.match(requestText, /combinedFormat/);
    assert.match(requestText, /how_to__cracked_the_code/);
    assert.match(requestText, /list__native/);
    assert.match(requestText, /source.*format_native/);
    assert.match(requestText, /social slideshow cover/i);
    assert.match(requestText, /within 4 lines/i);
    assert.match(requestText, /Inter Medium at 500 weight/i);
    assert.match(requestText, /normally 6-14 words/i);
    assert.match(requestText, /four centred display lines at 72px/i);
    assert.match(requestText, /no minimum word count/i);
    assert.match(requestText, /heading is optional/i);
    assert.match(requestText, /grounding\.anchorId/i);
    const schemaText = (request as { response_format: { json_schema: { schema: unknown } } } | null)!.response_format.json_schema.schema;
    function assertListBodies(value: unknown) {
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      const properties = record.properties as {
        body?: { type?: string; anyOf?: Array<{ type?: string; description?: string }> };
        ctaText?: { type?: string };
        listItems?: { minItems: number };
      } | undefined;
      if (properties?.listItems && properties.listItems.minItems > 0) assert.deepEqual(properties.body, { type: "null" });
      else if (properties?.body?.anyOf) assert.match(properties.body.anyOf.find((field) => field.type === "string")?.description ?? "", /at most 30 words total excluding the headline/);
      if (properties?.ctaText) assert.deepEqual(properties.ctaText, { type: "null" });
      for (const child of Object.values(record)) assertListBodies(child);
    }
    assertListBodies(schemaText);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("the batch planner keeps Slides 2-6 while abandoning an overflowing optional overlay", async () => {
  const assignments = [
    {
      contentFormatId: "mistakes",
      hookFamilyId: "problem_recognition",
      hookTemplateId: "doing_it_wrong",
      hookTemplateVersion: 1,
    },
    {
      contentFormatId: "how_to",
      hookFamilyId: "curiosity",
      hookTemplateId: "cracked_the_code",
      hookTemplateVersion: 1,
    },
    {
      contentFormatId: "before_after",
      hookFamilyId: "specific_outcome",
      hookTemplateId: null,
      hookTemplateVersion: null,
    },
    {
      contentFormatId: "comparison",
      hookFamilyId: "question",
      hookTemplateId: null,
      hookTemplateVersion: null,
    },
    {
      contentFormatId: "list",
      hookFamilyId: "surprise",
      hookTemplateId: null,
      hookTemplateVersion: null,
    },
  ];
  const initialPlans = assignments.map((assignment, slotIndex) =>
    createDistinctBatchFixture(
      assignment.contentFormatId,
      assignment.hookFamilyId,
      slotIndex,
    ),
  );
  const overflowingHook =
    "Cross-functional campaign handoffs repeatedly create invisible approval bottlenecks";
  initialPlans[0]!.slides[0]!.headline = overflowingHook;
  const repairPlan = structuredClone(initialPlans[0]!);
  repairPlan.slides[1]!.body =
    "This repair incorrectly rewrote a valid second slide even though the only failing content was the long cover hook on Slide 1.";

  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const requests: Array<Record<string, unknown>> = [];

  process.env.OPENAI_API_KEY = "test-key-batch-hook-overflow-fallback";
  globalThis.fetch = (async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body)) as {
      response_format?: { json_schema?: { name?: string } };
    };
    requests.push(requestBody);
    const schemaName = requestBody.response_format?.json_schema?.name;
    const responseContent =
      schemaName === "native_slide_one_overflow_fallback"
        ? {
            slide: {
              ...initialPlans[0]!.slides[0],
              body: null,
              headline: "Why launch ownership keeps disappearing",
            },
          }
        : schemaName === "repaired_carousel_batch_item"
          ? repairPlan
          : {
              items: initialPlans.map((plan, slotIndex) => ({
                notApplicableReason: null,
                plan,
                slotIndex,
                status: "ready",
              })),
            };

    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: {
              content: JSON.stringify(providerContent(responseContent)),
              refusal: null,
              role: "assistant",
            },
          },
        ],
        created: 0,
        id: `chatcmpl-${schemaName}`,
        model: "gpt-4o-mini",
        object: "chat.completion",
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  }) as typeof fetch;

  try {
    const plans = await buildCarouselContentPlanBatch({
      analysis,
      businessDescription: analysis.productSummary ?? "",
      items: assignments.map((assignment, slotIndex) => ({
        candidateIndex: slotIndex,
        ...assignment,
        creativeSeed: `Campaign handoff angle ${slotIndex + 1}`,
        emotion: "relief",
        planningBrief: null,
        slotIndex,
      })),
      recentHistory: [],
    });
    const recovered = plans[0]!;

    assert.equal(requests.length, 3);
    assert.equal(recovered.plan.slides[0]!.body, null);
    assert.equal(recovered.plan.slides[0]!.headline, "Why launch ownership keeps disappearing");
    assert.equal(
      recovered.plan.slides[1]!.body,
      initialPlans[0]!.slides[1]!.body,
    );
    assert.equal(recovered.plan.validationResult.hookTemplateFallbackUsed, true);
    assert.equal(recovered.actualHookTemplateId, null);
    assert.equal(recovered.actualHookTemplateVersion, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Structure 1 keeps subjective cover wording nonblocking while recording an advisory", () => {
  const fixture = createFixture("comparison", "question");
  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(fixture, {
        analysis,
        contentFormatId: "comparison",
        hookFamilyId: "question",
        recentHistory: [],
        slideCount: 5,
      }),
    /exactly six slides/i,
  );

  fixture.slides[0]!.headline = "Calmer campaign planning starts here";
  const accepted = parseCarouselContentPlanForAssignment(fixture, {
    analysis,
    contentFormatId: "comparison",
    hookFamilyId: "question",
    recentHistory: [],
    slideCount: 6,
  });
  assert.deepEqual(
    accepted.blockingIssues,
    [],
  );
  assert.ok(
    accepted.advisoryIssues.some((issue) => issue.code === "hook_quality"),
  );
});

test("Structure 1 records possible hook-to-chapter misalignment without blocking generation", () => {
  const fixture = createFixture("comparison", "question");
  fixture.slides[0]!.headline = "Why ceramic glazes crack unexpectedly";
  const accepted = parseCarouselContentPlanForAssignment(fixture, {
    analysis,
    contentFormatId: "comparison",
    hookFamilyId: "question",
    recentHistory: [],
    slideCount: 6,
  });

  assert.deepEqual(accepted.blockingIssues, []);
  assert.ok(
    accepted.advisoryIssues.some((issue) => issue.code === "hook_alignment"),
  );
});

test("Structure 1 repairs an unreplaced hook-template placeholder", () => {
  const fixture = createFixture("mistakes", "problem_recognition");
  fixture.slides[0]!.headline = "You’re doing {topic} wrong today";

  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(fixture, {
        analysis,
        contentFormatId: "mistakes",
        hookFamilyId: "problem_recognition",
        hookTemplateId: "doing_it_wrong",
        hookTemplateVersion: 1,
        recentHistory: [],
        slideCount: 6,
      }),
    /unreplaced hook-template placeholder/i,
  );
});

test("Structure 1 rejects unsupported 10x claims introduced by a template", () => {
  const fixture = createFixture("before_after", "specific_outcome");
  fixture.slides[0]!.headline = "This simple switch got me 10x better campaign results";

  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(fixture, {
        analysis,
        contentFormatId: "before_after",
        hookFamilyId: "specific_outcome",
        hookTemplateId: "simple_switch_10x",
        hookTemplateVersion: 1,
        recentHistory: [],
        slideCount: 6,
      }),
    /unsupported or prohibited claim/i,
  );
});

test("Structure 1 reserves the white SVG heading treatment for content slides", async () => {
  const heading = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "Supporting copy remains directly on the image.",
      ctaText: null,
      headline: "The heading is highlighted",
      imageDirection: "An object-only workspace with open centered space.",
      layoutPreset: "middle-statement",
      listItems: [],
      slideNumber: 2,
      slideType: "problem",
      subtext: null,
      textMode: "headline_body",
      textPosition: "center",
    },
  });
  const bodyOnly = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "A clear cover gives readers a reason to swipe.",
      ctaText: null,
      headline: null,
      imageDirection: "An object-only workspace with open centered space.",
      layoutPreset: "middle-statement",
      listItems: [],
      slideNumber: 2,
      slideType: "problem",
      subtext: null,
      textMode: "single_statement",
      textPosition: "center",
    },
  });
  const cover = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "Start with the reader tension.",
      ctaText: null,
      headline: "This hook earns the swipe",
      imageDirection: "An approved Hook-category portrait with clear central space.",
      layoutPreset: "middle-statement",
      listItems: [],
      slideNumber: 1,
      slideType: "hook",
      subtext: null,
      textMode: "headline_body",
      textPosition: "center",
    },
  });

  assert.equal(heading.whiteBackgroundGroupCount, 1);
  assert.equal(bodyOnly.whiteBackgroundGroupCount, 0);
  assert.equal(cover.whiteBackgroundGroupCount, 0);
  assert.equal(heading.bodyFontSize, 48);
  assert.equal(bodyOnly.bodyFontSize, 48);
  assert.equal(cover.bodyFontSize, 72);
  assert.equal(heading.headingBackgroundUsesLineFittedPath, true);
  assert.equal(
    heading.headingBackgroundLineCount,
    heading.headingBackgroundLineWidths?.length,
  );
  assert.equal(bodyOnly.headingBackgroundUsesLineFittedPath, false);
  assert.equal(cover.headingBackgroundUsesLineFittedPath, false);
});

test("Structure 1 permits a people-first image direction only on the Hook cover", () => {
  const fixture = createFixture("mistakes", "problem_recognition");
  fixture.slides[0]!.imageDirection =
    "A focused founder portrait from the approved Hook-category library with clear central text space.";

  const plan = parseCarouselContentPlanForAssignment(fixture, {
    analysis,
    contentFormatId: "mistakes",
    hookFamilyId: "problem_recognition",
    hookTemplateId: null,
    hookTemplateVersion: null,
    recentHistory: [],
    slideCount: 6,
  });

  assert.equal(plan.plan.slides[0]!.textPosition, "center");

  fixture.slides[1]!.imageDirection =
    "A focused person portrait with clear center space.";

  assert.throws(
    () =>
      parseCarouselContentPlanForAssignment(fixture, {
        analysis,
        contentFormatId: "mistakes",
        hookFamilyId: "problem_recognition",
        hookTemplateId: null,
        hookTemplateVersion: null,
        recentHistory: [],
        slideCount: 6,
      }),
    /prohibited human subject/i,
  );
});

test("Structure 1's heading SVG gives every measured line a rounded shoulder", () => {
  for (const widths of [
    [680, 412],
    [680, 412, 556],
    [680, 412, 556, 338],
  ]) {
    const geometry = buildLineFittedHeadingSvgPath({
      centerX: 540,
      groupHeight: 76 + (widths.length - 1) * 46,
      groupY: 300,
      lineCenterOffset: 38,
      lineStep: 46,
      outerRadius: 21,
      stepRadius: 16,
      widths,
    });

    assert.deepEqual(geometry.widths, widths);
    assert.equal(
      geometry.pathData.match(/\bC\b/g)?.length ?? 0,
      0,
    );
    assert.equal(
      geometry.pathData.match(/\bQ\b/g)?.length ?? 0,
      4 + (widths.length - 1) * 4,
    );
    assert.ok(geometry.pathData.includes("880"));
    assert.ok(geometry.pathData.includes("746"));
  }
});

test("Structure 1 records generic wording without relaxing body limits", () => {
  const parsed = parseCarouselContentPlanForAssignment(
    createFixture("comparison", "question"),
    {
      analysis,
      contentFormatId: "comparison",
      hookFamilyId: "question",
      recentHistory: [],
      slideCount: 6,
    },
  ).plan;
  const altered = {
    ...parsed,
    slides: parsed.slides.map((slide, index) =>
      index === 1
        ? { ...slide, body: "Work smarter with one platform.", subtext: "Work smarter with one platform." }
        : slide,
    ),
  };
  const partitioned = partitionCarouselContentPlanValidationIssues(
    validateCarouselContentPlan(altered, analysis),
  );

  assert.ok(
    partitioned.advisoryIssues.some((issue) => issue.code === "generic_copy"),
  );
  assert.equal(partitioned.blockingIssues.some((issue) => issue.code === "body_length"), false);
});

function createDistinctBatchFixture(
  formatId: string,
  hookFamilyId: string,
  slotIndex: number,
) {
  const themes = [
    {
      angle: "Make launch ownership explicit before work changes hands",
      bodies: [
        "Assign one launch owner before the handoff so every open decision has a clear destination during busy review cycles.",
        "Place the owner beside the launch date so reviewers know who can resolve a blocked choice before it delays launch work.",
        "Record the next approval action while the discussion is fresh enough to remain useful for the people inheriting the work tomorrow.",
        "Review ownership again when timing changes so the handoff never points to an outdated person or a team that cannot respond.",
        "Keep one visible owner beside every launch decision before the campaign moves forward so pending work never loses its accountable destination.",
      ],
      concept: "A practical ownership system for cleaner campaign launches",
      hook: "Why launch owners disappear suddenly",
      items: [
        "Name the launch owner",
        "Attach the open decision",
        "Mark the approval deadline",
        "Record the next action",
        "Review ownership changes",
        "Close the handoff loop",
      ],
      situations: [
        "launch ownership missing after review",
        "open decisions without a responsible person",
        "approval deadlines detached from owners",
      ],
    },
    {
      angle: "Keep approval rationale beside the exact campaign change",
      bodies: [
        "Capture the approval reason beside the edited asset so later reviewers can understand the decision without reopening the same question after launch work begins.",
        "Link each comment to its campaign version so old feedback cannot redirect current work or confuse the team during final review.",
        "Summarize the accepted change in plain language before another review round begins so collaborators can continue with shared context and confidence.",
        "Separate pending questions from approved edits so the team can act without guessing which changes are ready for production immediately.",
        "Preserve the reason behind each approval, not only the final yes or no, so teams can defend decisions during later reviews.",
      ],
      concept: "An approval trail that keeps campaign decisions understandable",
      hook: "Why approval work keeps stalling",
      items: [
        "Link feedback to one version",
        "Write the approval reason",
        "Separate open questions",
        "Summarize accepted changes",
        "Archive outdated comments",
        "Confirm the final decision",
      ],
      situations: [
        "feedback attached to an outdated asset",
        "approved edits mixed with open questions",
        "decision rationale lost between review rounds",
      ],
    },
    {
      angle: "Use current reporting signals to protect campaign timing",
      bodies: [
        "Check the latest reporting signal before changing timing so the schedule reflects current campaign evidence rather than an outdated optimistic assumption.",
        "Compare the planned milestone with recent activity before moving a launch date forward so the schedule matches actual progress across the team.",
        "Flag delayed inputs early enough for the next review to choose a realistic response before the missed deadline forces last-minute changes.",
        "Write the timing decision beside its evidence so future changes retain the original context and reviewers understand why the schedule moved.",
        "Let current reporting guide the schedule before urgency turns into an avoidable delay that disrupts the entire campaign handoff.",
      ],
      concept: "A reporting rhythm that protects campaign timing decisions",
      hook: "Why campaign plans break down",
      items: [
        "Check the latest signal",
        "Compare the next milestone",
        "Flag delayed inputs",
        "Record timing evidence",
        "Revisit the launch date",
        "Share the current decision",
      ],
      situations: [
        "launch timing based on stale reporting",
        "delayed inputs discovered after review",
        "schedule changes without recorded evidence",
      ],
    },
    {
      angle: "Carry small campaign decisions through every review round",
      bodies: [
        "Write each review decision as a concrete action so it survives the move into the next round without losing its original owner or deadline.",
        "Attach the decision to the affected campaign element instead of leaving it inside a broad summary where it will be missed during the next review.",
        "Mark unresolved choices separately so completed decisions never return as duplicate questions when the campaign enters another review round.",
        "Read the prior decision log before reviewing new changes so the conversation continues coherently with the context required to make a fast choice.",
        "A short decision record keeps every review round connected to what the last one settled and prevents routine choices from being reopened.",
      ],
      concept: "A decision record for connected campaign review rounds",
      hook: "Why small choices get lost",
      items: [
        "Write one concrete action",
        "Attach the affected element",
        "Mark unresolved choices",
        "Review the prior decision",
        "Remove duplicate questions",
        "Carry context forward",
      ],
      situations: [
        "small decisions omitted from review summaries",
        "settled questions returning in later rounds",
        "campaign changes detached from prior choices",
      ],
    },
    {
      angle: "Build a campaign brief around the gaps that block action",
      bodies: [
        "State the audience decision first so every later detail supports the same campaign direction instead of creating conflicting ideas and approvals.",
        "Add the required approval checkpoint before listing optional ideas or visual preferences so the team knows what must happen before launch.",
        "Name the available evidence so reviewers can distinguish known facts from open assumptions when they decide which direction to approve.",
        "Finish with the next action and owner so the brief can move directly into execution without another meeting to determine responsibility.",
        "A useful campaign brief answers the next decision before it adds more background detail so readers can act instead of searching for direction.",
      ],
      concept: "A focused campaign brief that exposes missing decisions",
      hook: "Why campaign briefs miss details",
      items: [
        "State the audience decision",
        "Name the campaign objective",
        "Add the approval checkpoint",
        "Separate facts from assumptions",
        "Identify the next action",
        "Assign the responsible owner",
      ],
      situations: [
        "campaign briefs without a clear audience choice",
        "approval checkpoints missing before execution",
        "facts and assumptions blended together",
      ],
    },
  ] as const;
  const theme = themes[slotIndex];
  if (!theme) throw new Error(`Unknown batch fixture slot ${slotIndex}.`);

  const fixture = createFixture(formatId, hookFamilyId);
  fixture.broadSituations = [...theme.situations];
  fixture.concept = theme.concept;
  fixture.contentStrategy.angle = theme.angle;
  let listCursor = 0;
  fixture.slides = fixture.slides.map((slide, index) => {
    const listItems =
      slide.listItems.length > 0
        ? theme.items.slice(listCursor, listCursor + slide.listItems.length)
        : [];
    listCursor += listItems.length;

    return {
      ...slide,
      body:
        index === 0
          ? null
          : listItems.length > 0
            ? null
            : fixtureTextBlocks(theme.bodies[index - 1]!),
      headline: index === 0 ? theme.hook : slide.headline,
      listItems,
    };
  });

  // The batch path now requires the selected verified workflow to be visible
  // in the concept and across the middle teaching slides. Keep this
  // production-shaped fixture tied to the selected main-problem anchor rather
  // than making the validator accept an ungrounded sequence of generic steps.
  const groundingSlide = fixture.slides[2]!;
  fixture.slides[2] = groundingSlide.listItems.length > 0
    ? {
        ...groundingSlide,
        listItems: groundingSlide.listItems.map((item, index) =>
          index === 0 ? "Connect campaign planning" : item,
        ),
      }
    : {
        ...groundingSlide,
        body: "Keep campaign planning and reporting connected in one visible workflow\n\ninstead of scattering decisions, deadlines, and ownership across separate tools.",
      };

  return fixture;
}

function createFixture(formatId: string, hookFamilyId: string) {
  const format = CAROUSEL_CONTENT_GRAMMAR.formats.find(
    (candidate) => candidate.id === formatId,
  );
  if (!format) throw new Error(`Unknown Structure 1 test format ${formatId}.`);

  const context = buildCarouselBusinessContentContext(analysis);
  const listItems = [
    "Capture launch context",
    "Name the next action",
    "Connect approval notes",
    "Review campaign timing",
    "Keep reporting visible",
    "Record the handoff",
  ];
  const valueBodies = [
    "Map the campaign owner before a handoff so the next decision has a clear person responsible for moving it forward.",
    "Keep approval context beside the work so campaign changes do not send the team searching through separate messages and documents.",
    "Review timing with the current reporting details so launch choices reflect what changed instead of relying on an outdated checklist.",
    "Record the practical next step after each review so the team can resume campaign work without rebuilding the handoff context again.",
  ];
  let listCursor = 0;

  return {
    broadSituations: [
      "campaign details scattered across tools",
      "approval notes separated from launch work",
      "reporting context missing during handoffs",
    ],
    concept: `A practical ${format.name} for clearer campaign handoffs`,
    contentStrategy: {
      angle: `Use ${format.name} to keep campaign handoffs clear`,
      audienceId: context.audiences[0]!.id,
      contentFormatId: format.id,
      customerGoalId: context.customerGoals[0]!.id,
      hookFamilyId,
      problemId: context.problems[0]!.id,
      topicId: context.topics[0]!.id,
    },
    grounding: {
      anchorId: "workflow:main_problem",
    },
    slides: format.slides.map((definition, index) => {
      const listItemCount = definition.listItemCount ?? 0;
      const selectedListItems = listItems.slice(listCursor, listCursor + listItemCount);
      listCursor += listItemCount;
      const textMode = listItemCount > 0
        ? definition.preferredTextModes[0]!
        : definition.slideType === "cta"
          ? "cta_takeaway"
          : definition.preferredTextModes.includes("single_statement")
            ? "single_statement"
            : "body_only";
      const body = listItemCount > 0
        ? null
        : index === 0
          ? null
          : index === 5
            ? "Keep the next campaign handoff clear with one connected workflow so every owner, decision, and deadline remains visible when priorities change."
            : valueBodies[index - 1]!;

      return {
        body: body ? fixtureTextBlocks(body) : null,
        ctaText: null,
        formatRole: definition.role,
        headline:
          index === 0 ? "Why campaign work keeps stalling" : null,
        imageDirection: "Organized calendar and notebook still life with clear upper space.",
        listItems: selectedListItems,
        slideNumber: index + 1,
        slideType: definition.slideType,
        textMode,
      };
    }),
  };
}

// Test copy deliberately models the new two-thought transport, not a runtime rewrite.
function fixtureTextBlocks(value: string) {
  const words = value.split(/\s+/);
  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n\n${words.slice(midpoint).join(" ")}`;
}
