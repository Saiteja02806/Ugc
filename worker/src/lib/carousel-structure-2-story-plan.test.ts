import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarouselStructure2StoryPlanBatch,
  CAROUSEL_STRUCTURE_2_PLANNER_VERSION,
} from "./carousel-structure-2-planner.js";
import {
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2RepairMessages,
  parseCarouselStructure2StoryPlan,
  partitionCarouselStructure2ValidationIssues,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2StoryAssignment,
} from "./carousel-structure-2-story-plan.js";
import {
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  getCarouselStructure2Format,
  type CarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";

const businessDescription =
  "Todaywise is an application for planning work when priorities change.";

test("Structure 2 receives only the minimal business description, seeds, emotions, formats, and exact copy history", () => {
  const messages = buildCarouselStructure2BatchMessages({
    assignments: makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5)),
    businessDescription,
    recentHistory: [makeRecentCopy()],
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /creativeSeed/);
  assert.match(prompt, /emotion/);
  assert.match(prompt, /allowedCtaPositions/);
  assert.match(prompt, /exact visible text/i);
  assert.match(prompt, /i kept rebuilding monday's list/);
  assert.doesNotMatch(prompt, /productMechanism/);
  assert.doesNotMatch(prompt, /targetAudience|painPoints|valueProps|claimsToAvoid/);
});

test("all eight formats keep five slides while moving CTA by format", () => {
  const ctaPositions = new Set<number>();

  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    const plan = makeStoryPlan(storyFormatId);
    const format = getCarouselStructure2Format(storyFormatId);
    const ctaSlide = plan.slides.find((slide) => slide.ctaText !== null)!;

    assert.equal(plan.slides.length, 5);
    assert.ok(format.allowedCtaPositions.includes(ctaSlide.slideNumber));
    assert.equal(plan.strategy.storyFormatId, storyFormatId);
    ctaPositions.add(ctaSlide.slideNumber);
  }

  assert.deepEqual([...ctaPositions].sort(), [2, 3, 4, 5]);
});

test("the format flow is reference material while format id and CTA position stay structural", () => {
  const plan = makeRawStoryPlan("perfect_plan_breaks");
  [plan.slides[1], plan.slides[2]] = [plan.slides[2]!, plan.slides[1]!];
  plan.slides.forEach((slide, index) => {
    slide.slideNumber = index + 1;
  });

  assert.doesNotThrow(() =>
    parseCarouselStructure2StoryPlan(plan, {
      businessDescription,
      storyFormatId: "perfect_plan_breaks",
    }),
  );

  const wrongCta = makeRawStoryPlan("perfect_plan_breaks");
  wrongCta.slides.forEach((slide) => {
    slide.ctaText = slide.slideNumber === 5 ? "try this with your own week" : null;
  });
  assert.throws(
    () =>
      parseCarouselStructure2StoryPlan(wrongCta, {
        businessDescription,
        storyFormatId: "perfect_plan_breaks",
      }),
    /allows its CTA only on slide 4/i,
  );
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
  assert.match(prompt, /allowedCtaPositions/);
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
    slotIndex,
    storyFormatId: formatIds[slotIndex % formatIds.length]!,
  })) satisfies CarouselStructure2StoryAssignment[];
}

function makeStoryPlan(storyFormatId: CarouselStructure2FormatId) {
  return parseCarouselStructure2StoryPlan(makeRawStoryPlan(storyFormatId), {
    businessDescription,
    storyFormatId,
  });
}

function makeRawStoryPlan(storyFormatId: CarouselStructure2FormatId) {
  const ctaPosition = getCarouselStructure2Format(storyFormatId)
    .allowedCtaPositions[0]!;
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
    slides: copy.map((storyText, index) => ({
      ctaText:
        index + 1 === ctaPosition
          ? "try the same idea with one changing priority"
          : null,
      slideNumber: index + 1,
      storyRole: roles[index]!,
      storyText,
      visualContext: `ordinary planning scene ${index + 1}`,
    })),
    strategy: {
      angle: "a perfect weekly plan colliding with an ordinary change",
      storyFormatId,
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
