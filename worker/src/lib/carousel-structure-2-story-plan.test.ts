import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2StoryBatchSchema,
  CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS,
  CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS,
  buildCarouselStructure2StoryPlanSchema,
  parseCarouselStructure2StoryBatch,
  parseCarouselStructure2StoryPlan,
  partitionCarouselStructure2ValidationIssues,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2StoryAssignment,
} from "./carousel-structure-2-story-plan.js";
import {
  CAROUSEL_STRUCTURE_2_FORMAT_IDS,
  CAROUSEL_STRUCTURE_2_STORY_ROLES,
  type CarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import {
  CAROUSEL_STRUCTURE_2_COVER_FONT_SIZE,
  getCarouselStructure2StoryMaxLines,
} from "./carousel-structure-2-layout.js";

const businessDescription =
  "Todaywise is an application for planning work when priorities change.";

test("Structure 2 plans exactly the required six-slide product story", () => {
  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
      businessDescription,
      storyFormatId,
    });

    assert.equal(plan.slides.length, 6);
    assert.deepEqual(
      plan.slides.map((slide) => slide.storyRole),
      CAROUSEL_STRUCTURE_2_STORY_ROLES,
    );
    assert.equal(plan.slides[5]!.ctaText, "Try the same approach with one changing priority.");
    assert.deepEqual(
      partitionCarouselStructure2ValidationIssues(
        validateCarouselStructure2StoryPlan(plan, { businessDescription }),
      ).blockingIssues,
      [],
    );
  }
});

test("Structure 2 rejects reordering story roles or placing a CTA before Slide 6", () => {
  const reordered = makeRawStoryPlan();
  [reordered.slides.second, reordered.slides.third] = [
    reordered.slides.third!,
    reordered.slides.second!,
  ];
  assert.throws(
    () => parseCarouselStructure2StoryPlan(reordered, { businessDescription, storyFormatId: "wrong_belief" }),
    /must use the failure_scene role/i,
  );

  const earlyCta = makeRawStoryPlan();
  earlyCta.slides.third!.ctaText = "Try this today.";
  assert.throws(
    () => parseCarouselStructure2StoryPlan(earlyCta, { businessDescription, storyFormatId: "wrong_belief" }),
    /cannot include a CTA/i,
  );
});

test("Structure 2 leaves creative cover wording to the prompt and uses a larger cover treatment", () => {
  const raw = makeRawStoryPlan();
  raw.slides.first!.storyText = "Is your content plan falling apart when life gets busy?";
  const plan = parseCarouselStructure2StoryPlan(raw, {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  const issues = validateCarouselStructure2StoryPlan(plan, { businessDescription });

  assert.equal(CAROUSEL_STRUCTURE_2_COVER_FONT_SIZE, 60);
  assert.equal(getCarouselStructure2StoryMaxLines(1), 3);
  assert.ok(!issues.some((issue) => issue.code === "perspective"));
});

test("Structure 2 keeps five batch plan keys separate from six slide keys", () => {
  const assignments = makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5));
  const schema = buildCarouselStructure2StoryBatchSchema({ assignments });
  const rawBatch = {
    plans: Object.fromEntries(
      CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((positionKey) => [
        positionKey,
        makeRawStoryPlan(),
      ]),
    ),
  };
  const parsed = parseCarouselStructure2StoryBatch(rawBatch, assignments);

  assert.deepEqual(
    Object.keys(schema.properties.plans.properties),
    CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS,
  );
  assert.equal(parsed.size, 5);
  assert.deepEqual([...parsed.keys()], [0, 1, 2, 3, 4]);
  assert.equal(CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.length, 6);
});

test("Structure 2 prompt and schema describe the strict six-slide contract", () => {
  const messages = buildCarouselStructure2BatchMessages({
    assignments: makeAssignments(CAROUSEL_STRUCTURE_2_FORMAT_IDS.slice(0, 5)),
    businessDescription,
  });
  const prompt = messages.map((message) => message.content).join("\n");
  const schema = JSON.stringify(buildCarouselStructure2StoryPlanSchema());

  assert.match(prompt, /exactly six slides/i);
  assert.match(prompt, /only Slide 1 may lead with direct reader wording/i);
  assert.match(prompt, /Slides 1-5 must return ctaText: null/i);
  assert.match(prompt, /Slide 4 must explain a real product capability/i);
  assert.doesNotMatch(prompt, /CTA presence and slide position are your creative choice/i);
  assert.match(schema, /sixth/);
  assert.doesNotMatch(schema, /slideNumber|storyFormatId/);
});

test("Structure 2 sends writing-quality failures back through the repair path", () => {
  const plan = parseCarouselStructure2StoryPlan(makeRawStoryPlan(), {
    businessDescription,
    storyFormatId: "wrong_belief",
  });
  plan.slides[1]!.storyText = "One platform helped me work smarter.";
  const partitioned = partitionCarouselStructure2ValidationIssues(
    validateCarouselStructure2StoryPlan(plan, { businessDescription }),
  );

  assert.ok(partitioned.blockingIssues.some((issue) => issue.code === "generic_copy"));
  assert.deepEqual(partitioned.advisoryIssues, []);
});

function makeAssignments(formatIds: readonly CarouselStructure2FormatId[]) {
  return Array.from({ length: 5 }, (_, slotIndex) => ({
    candidateIndex: slotIndex,
    creativeSeed: `Open creative starting point ${slotIndex + 1}`,
    emotion: "quiet frustration",
    slotIndex,
    storyFormatId: formatIds[slotIndex % formatIds.length]!,
  })) satisfies CarouselStructure2StoryAssignment[];
}

function makeRawStoryPlan() {
  const copy = [
    "Why weekly plans collapse by Tuesday",
    "On Monday, one changed priority made me rebuild every task, delay the first decision, and lose the context I had already collected.",
    "I realized the problem was not effort; my plan assumed that ordinary work would never change after I wrote it down.",
    "Todaywise let me work from the changing task list, so I could update the next action without rebuilding the entire week from scratch.",
    "The week still changed, but I stopped treating each shift as a reset and finished the important work with a clearer next decision.",
    "Keep the next decision visible, then try the same approach with one changing priority.",
  ];

  return {
    slides: Object.fromEntries(
      CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((positionKey, index) => [
        positionKey,
        {
          ctaText:
            index === 5
              ? "Try the same approach with one changing priority."
              : null,
          storyRole: CAROUSEL_STRUCTURE_2_STORY_ROLES[index]!,
          storyText: copy[index]!,
          visualContext: `ordinary planning scene ${index + 1}`,
        },
      ]),
    ),
    strategy: { angle: "a weekly plan that could not adapt to real work" },
  };
}
