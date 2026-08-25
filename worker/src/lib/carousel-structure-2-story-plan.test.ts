import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarouselStructure2StoryPlanBatch,
  CAROUSEL_STRUCTURE_2_PLANNER_VERSION,
} from "./carousel-structure-2-planner.js";
import {
  buildCarouselStructure2StoryBatchSchema,
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2RepairMessages,
  buildCarouselStructure2StoryPlanSchema,
  CAROUSEL_STRUCTURE_2_POSITION_KEYS,
  parseCarouselStructure2StoryBatch,
  parseCarouselStructure2StoryPlan,
  partitionCarouselStructure2ValidationIssues,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2StoryAssignment,
} from "./carousel-structure-2-story-plan.js";
import {
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  type CarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";

const businessDescription =
  "Todaywise is an application for planning work when priorities change.";

test("Structure 2 receives the private creative brief alongside seeds, formats, and exact copy history", () => {
  const messages = buildCarouselStructure2BatchMessages({
    assignments: makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5)),
    businessDescription,
    recentHistory: [makeRecentCopy()],
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /creativeSeed/);
  assert.match(prompt, /emotion/);
  assert.match(prompt, /privateCreativeBrief/);
  assert.match(prompt, /An unexpected meeting moves the important work into the afternoon/);
  assert.match(prompt, /CTA is optional/i);
  assert.doesNotMatch(prompt, /allowedCtaPositions|exactly one CTA|CTA position is .*required/i);
  assert.match(prompt, /exact visible text/i);
  assert.match(prompt, /i kept rebuilding monday's list/);
  assert.doesNotMatch(prompt, /productMechanism/);
  assert.match(prompt, /preferredFormatFamily must never override/i);
  assert.doesNotMatch(prompt, /productMechanism|claimsToAvoid/);
});

test("all eight formats keep five slides without requiring a CTA", () => {
  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    const rawPlan = makeRawStoryPlan();
    for (const slide of Object.values(rawPlan.slides)) slide.ctaText = null;
    const plan = parseCarouselStructure2StoryPlan(rawPlan, {
      businessDescription,
      storyFormatId,
    });

    assert.equal(plan.slides.length, 5);
    assert.ok(plan.slides.every((slide) => slide.ctaText === null));
    assert.equal(plan.strategy.storyFormatId, storyFormatId);
  }
});

test("the AI contract omits structural identities and the worker assigns them", () => {
  const assignments = makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5));
  const rawPlan = makeRawStoryPlan();
  const planSchema = JSON.stringify(
    buildCarouselStructure2StoryPlanSchema(),
  );
  const batchSchema = JSON.stringify(
    buildCarouselStructure2StoryBatchSchema({ assignments }),
  );

  assert.doesNotMatch(planSchema, /slideNumber|storyFormatId/);
  assert.doesNotMatch(batchSchema, /slideNumber|slotIndex|candidateIndex|storyFormatId/);
  assert.ok(
    CAROUSEL_STRUCTURE_2_POSITION_KEYS.every(
      (positionKey) => rawPlan.slides[positionKey] !== undefined,
    ),
  );
  assert.ok(
    Object.values(rawPlan.slides).every(
      (slide) => !("slideNumber" in slide),
    ),
  );
  assert.ok(!("storyFormatId" in rawPlan.strategy));

  const parsedPlan = parseCarouselStructure2StoryPlan(rawPlan, {
    businessDescription,
    storyFormatId: assignments[0]!.storyFormatId,
  });
  assert.deepEqual(
    parsedPlan.slides.map((slide) => slide.slideNumber),
    [1, 2, 3, 4, 5],
  );
  assert.equal(
    parsedPlan.strategy.storyFormatId,
    assignments[0]!.storyFormatId,
  );

  const rawPlans = Object.fromEntries(
    CAROUSEL_STRUCTURE_2_POSITION_KEYS.map((positionKey) => [
      positionKey,
      makeRawStoryPlan(),
    ]),
  );
  const parsedBatch = parseCarouselStructure2StoryBatch(
    { plans: rawPlans },
    assignments,
  );

  assignments.forEach((assignment, index) => {
    assert.equal(
      parsedBatch.get(assignment.slotIndex),
      rawPlans[CAROUSEL_STRUCTURE_2_POSITION_KEYS[index]],
    );
  });
});

test("the format flow is reference material while CTA presence and position stay flexible", () => {
  const plan = makeRawStoryPlan();
  [plan.slides.second, plan.slides.third] = [
    plan.slides.third!,
    plan.slides.second!,
  ];

  assert.doesNotThrow(() =>
    parseCarouselStructure2StoryPlan(plan, {
      businessDescription,
      storyFormatId: "perfect_plan_breaks",
    }),
  );

  const flexibleCta = makeRawStoryPlan();
  CAROUSEL_STRUCTURE_2_POSITION_KEYS.forEach((positionKey, index) => {
    flexibleCta.slides[positionKey]!.ctaText =
      index === 0 ? "try this with your own week" : null;
  });
  assert.doesNotThrow(
    () =>
      parseCarouselStructure2StoryPlan(flexibleCta, {
        businessDescription,
        storyFormatId: "perfect_plan_breaks",
      }),
  );
});

test("the structured-output schema permits a CTA or null on every slide", () => {
  const schema = buildCarouselStructure2StoryPlanSchema() as {
    properties: {
      slides: {
        properties: Record<
          string,
          { properties: { ctaText: { anyOf: Array<{ type: string }> } } }
        >;
      };
    };
  };

  for (const positionKey of CAROUSEL_STRUCTURE_2_POSITION_KEYS) {
    assert.deepEqual(
      schema.properties.slides.properties[positionKey]!.properties.ctaText.anyOf.map(
        (entry) => entry.type,
      ),
      ["string", "null"],
    );
  }
});

test("valid AI copy is preserved and writing-quality warnings stay advisory", () => {
  const plan = makeStoryPlan("wrong_belief");
  const aiCopy = "i’d plan the perfect meal prep schedule every sunday…";
  plan.slides[0]!.storyText = aiCopy;
  plan.slides[1]!.storyText = "one platform helped me work smarter";

  const partitioned = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription }),
  );

  assert.equal(plan.slides[0]!.storyText, aiCopy);
  assert.deepEqual(partitioned.blockingIssues, []);
  assert.ok(partitioned.advisoryIssues.some((issue) => issue.code === "generic_copy"));
});

test("Structure 2 blocks copy that cannot fit at the fixed slideshow font size", () => {
  const plan = makeStoryPlan("wrong_belief");
  plan.slides[0]!.storyText = Array.from(
    { length: 32 },
    (_, index) => `wideword${index + 1}`,
  ).join(" ");

  const partitioned = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription }),
  );

  assert.ok(
    partitioned.blockingIssues.some((issue) => issue.code === "render_fit"),
  );
});

test("recent repetition compares exact accepted slide copy", () => {
  const plan = makeStoryPlan("wrong_belief");
  const history = makeRecentCopy(plan.slides.map((slide) => slide.storyText));
  const issues = validateCarouselStructure2StoryPlan(plan, {
    businessDescription,
    recentHistory: [history],
  });

  assert.ok(issues.some((issue) => issue.code === "recent_repetition"));
});

test("repair keeps the same creative brief and flexible format reference", () => {
  const assignment = makeAssignments(["new_rule"])[0]!;
  const messages = buildCarouselStructure2RepairMessages({
    assignment,
    businessDescription,
    issues: [{ code: "invalid_plan", message: "CTA missing", slideNumber: null }],
    rawPlan: {},
    recentHistory: [makeRecentCopy()],
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /new_rule/);
  assert.match(prompt, /quiet frustration/);
  assert.match(prompt, /CTA remains optional/i);
  assert.doesNotMatch(prompt, /allowedCtaPositions|format-specific CTA position/i);
  assert.doesNotMatch(prompt, /productMechanism/);
});

test("Structure 2 remains LLM-only and pinned to gpt-4o-mini", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      buildCarouselStructure2StoryPlanBatch({
        assignments: makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5)),
        businessDescription,
      }),
      /OPENAI_API_KEY is required/i,
    );
    assert.match(CAROUSEL_STRUCTURE_2_PLANNER_VERSION, /flexible-seed-writer/);
    assert.equal(CAROUSEL_TEXT_MODEL, "gpt-4o-mini");
  } finally {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  }
});

function makeAssignments(formatIds: readonly CarouselStructure2FormatId[]) {
  return Array.from({ length: 5 }, (_, slotIndex) => ({
    candidateIndex: slotIndex,
    creativeSeed: `A different open creative starting point ${slotIndex + 1}`,
    emotion: slotIndex === 0 ? "quiet frustration" : `emotion ${slotIndex + 1}`,
    planningBrief: {
      audienceContext: "People managing changing priorities",
      creativeSeed: "The plan starts to feel heavier than the work itself",
      emotionalTension: "Frustration mixed with self-blame",
      humanMoment: "An unexpected meeting moves the important work into the afternoon",
      preferredFormatFamily: "relatable_situation",
      supportedAngle: "A planning method that accounts for real capacity",
    },
    slotIndex,
    storyFormatId: formatIds[slotIndex % formatIds.length]!,
  })) satisfies CarouselStructure2StoryAssignment[];
}

function makeStoryPlan(storyFormatId: CarouselStructure2FormatId) {
  return parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
    businessDescription,
    storyFormatId,
  });
}

function makeRawStoryPlan() {
  const copy = [
    "i thought a perfect weekly plan would keep every priority under control",
    "then monday changed one task and i rebuilt the whole list before starting anything",
    "the problem was not effort; the plan left no room for ordinary changes",
    "i tried Todaywise and used the changing plan as my starting point",
    "the week stayed imperfect, but i stopped treating every change like a restart",
  ];
  const roles = [
    "recognition",
    "failure_scene",
    "reframe",
    "product_turning_point",
    "proof_reflection_cta",
  ] as const;

  return {
    slides: Object.fromEntries(
      CAROUSEL_STRUCTURE_2_POSITION_KEYS.map((positionKey, index) => [
        positionKey,
        {
          ctaText:
            index === 4
              ? "try the same idea with one changing priority"
              : null,
          storyRole: roles[index]!,
          storyText: copy[index]!,
          visualContext: `ordinary planning scene ${index + 1}`,
        },
      ]),
    ),
    strategy: {
      angle: "a perfect weekly plan colliding with an ordinary change",
    },
  };
}

function makeRecentCopy(copy?: string[]) {
  const visible = copy ?? [
    "i kept rebuilding monday's list",
    "one changed priority restarted the whole plan",
  ];

  return {
    contentPlanItemId: "00000000-0000-0000-0000-000000000001",
    formatId: "wrong_belief",
    generationId: "00000000-0000-0000-0000-000000000002",
    slides: visible.map((headline, index) => ({
      ctaText: null,
      headline,
      slideNumber: index + 1,
      subtext: null,
    })),
    structureId: "structure_2" as const,
  };
}
