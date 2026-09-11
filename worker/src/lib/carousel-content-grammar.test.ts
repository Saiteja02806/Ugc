import assert from "node:assert/strict";
import test from "node:test";

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
    "You’re managing complicated cross-functional campaign approval handoffs completely wrong (here’s how to fix them today)";

  initial.slides[0]!.body = overflowingHook;
  repair.slides[0]!.body = overflowingHook;
  repair.slides[1]!.body =
    "This repair tried to replace a valid second slide even though only the cover overflowed.";

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
              body: "Why campaign handoffs keep breaking",
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
              content: JSON.stringify(responseContent),
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
    assert.equal(plan.slides[0]!.body, "Why campaign handoffs keep breaking");
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
              content: JSON.stringify(responseContent),
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
    "You’re managing complicated cross-functional campaign approval handoffs completely wrong (here’s how to fix them today)";
  initialPlans[0]!.slides[0]!.body = overflowingHook;
  const repairPlan = structuredClone(initialPlans[0]!);
  repairPlan.slides[1]!.body =
    "This repair tried to replace a valid second slide even though only the cover overflowed.";

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
              body: "Why launch ownership keeps disappearing",
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
              content: JSON.stringify(responseContent),
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
    assert.equal(recovered.plan.slides[0]!.body, "Why launch ownership keeps disappearing");
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

  fixture.slides[0]!.body = "Better productivity starts here";
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
  fixture.slides[0]!.body = "Why ceramic glazes crack unexpectedly";
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
  fixture.slides[0]!.body = "You’re doing {topic} wrong today";

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
  fixture.slides[0]!.body = "This simple switch got me 10x better campaign results";

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

test("Structure 1 uses the white SVG only for an actual heading", async () => {
  const heading = await inspectCarouselSlideLayout({
    format: "1:1",
    slide: {
      body: "Supporting copy remains directly on the image.",
      ctaText: null,
      headline: "The heading is highlighted",
      imageDirection: "An object-only workspace with open centered space.",
      layoutPreset: "middle-statement",
      listItems: [],
      slideNumber: 1,
      slideType: "hook",
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
      slideNumber: 1,
      slideType: "hook",
      subtext: null,
      textMode: "single_statement",
      textPosition: "center",
    },
  });

  assert.equal(heading.whiteBackgroundGroupCount, 1);
  assert.equal(bodyOnly.whiteBackgroundGroupCount, 0);
  assert.equal(heading.bodyFontSize, 44);
  assert.equal(bodyOnly.bodyFontSize, 60);
  assert.equal(heading.headingBackgroundUsesLineFittedPath, true);
  assert.equal(
    heading.headingBackgroundLineCount,
    heading.headingBackgroundLineWidths?.length,
  );
  assert.equal(bodyOnly.headingBackgroundUsesLineFittedPath, false);
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

test("Structure 1 treats generic copy as a repairable blocking issue", () => {
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
    partitioned.blockingIssues.some((issue) => issue.code === "generic_copy"),
  );
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
        "Assign one launch owner before the handoff so every open decision has a clear destination.",
        "Place the owner beside the launch date so reviewers know who can resolve a blocked choice.",
        "Record the next approval action while the discussion is fresh enough to remain useful.",
        "Review ownership again when timing changes so the handoff never points to an outdated person.",
        "Keep one visible owner beside every launch decision before the campaign moves forward.",
      ],
      concept: "A practical ownership system for cleaner campaign launches",
      hook: "Why launch ownership disappears during campaign handoffs",
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
        "Capture the approval reason beside the edited asset so later reviewers can understand the decision.",
        "Link each comment to its campaign version so old feedback cannot redirect current work.",
        "Summarize the accepted change in plain language before another review round begins.",
        "Separate pending questions from approved edits so the team can act without guessing.",
        "Preserve the reason behind each approval, not only the final yes or no.",
      ],
      concept: "An approval trail that keeps campaign decisions understandable",
      hook: "Approval notes lose context at the worst moment",
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
        "Check the latest reporting signal before changing timing so the schedule reflects current campaign evidence.",
        "Compare the planned milestone with recent activity before moving a launch date forward.",
        "Flag delayed inputs early enough for the next review to choose a realistic response.",
        "Write the timing decision beside its evidence so future changes retain the original context.",
        "Let current reporting guide the schedule before urgency turns into an avoidable delay.",
      ],
      concept: "A reporting rhythm that protects campaign timing decisions",
      hook: "Campaign timing slips when reporting arrives too late",
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
        "Write each review decision as a concrete action so it survives the move into the next round.",
        "Attach the decision to the affected campaign element instead of leaving it inside a broad summary.",
        "Mark unresolved choices separately so completed decisions never return as duplicate questions.",
        "Read the prior decision log before reviewing new changes so the conversation continues coherently.",
        "A short decision record keeps every review round connected to what the last one settled.",
      ],
      concept: "A decision record for connected campaign review rounds",
      hook: "Small campaign decisions vanish between review rounds",
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
        "State the audience decision first so every later detail supports the same campaign direction.",
        "Add the required approval checkpoint before listing optional ideas or visual preferences.",
        "Name the available evidence so reviewers can distinguish known facts from open assumptions.",
        "Finish with the next action and owner so the brief can move directly into execution.",
        "A useful campaign brief answers the next decision before it adds more background detail.",
      ],
      concept: "A focused campaign brief that exposes missing decisions",
      hook: "A useful campaign brief reveals its hidden gaps",
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
          ? theme.hook
          : listItems.length > 0
            ? null
            : theme.bodies[index - 1]!,
      listItems,
    };
  });

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
    "Record the practical next step after each review so the team can resume campaign work without rebuilding the handoff context.",
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
          ? "Why campaign handoffs keep creating extra work"
          : index === 5
            ? "Keep the next campaign handoff clear with one connected workflow."
            : valueBodies[index - 1]!;

      return {
        body,
        ctaText: null,
        formatRole: definition.role,
        headline: null,
        imageDirection: "Organized calendar and notebook still life with clear upper space.",
        listItems: selectedListItems,
        slideNumber: index + 1,
        slideType: definition.slideType,
        textMode,
      };
    }),
  };
}
