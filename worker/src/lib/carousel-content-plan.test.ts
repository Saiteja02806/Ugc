import assert from "node:assert/strict";
import test from "node:test";

import {
  createCarouselContentPlanSeedFingerprint,
  getCarouselConceptLanes,
  getCarouselContentPlanDayPosition,
  isExactCarouselReplacementDuplicate,
  parseCarouselContentPlanChunk,
  validateCarouselContentPlanChunk,
} from "./carousel-content-plan.js";

function oneBrief(overrides: Record<string, unknown> = {}) {
  const childContext = (slot: number) => ({
    audienceContext: "People managing changing priorities",
    emotionalTension: `A distinct planning tension ${slot + 1}`,
    humanMoment: `A distinct real-life planning moment ${slot + 1}`,
    preferredFormatFamily: "relatable_situation",
    privateCreativeSeed: `A private planning observation ${slot + 1}`,
    supportedAngle: "A planning method that accounts for real capacity",
  });
  return {
    audienceContext: "People managing changing priorities",
    briefSlotIndex: 0,
    creativeSeed: "The plan starts to feel heavier than the work itself",
    emotionalTension: "Frustration mixed with self-blame",
    humanMoment: "An unexpected meeting moves every important task into the afternoon",
    items: [
      {
        ...childContext(0),
        creativeSeed: "The afternoon plan that quietly disappears after one unexpected meeting",
        emotion: "frustration",
        itemSlotIndex: 0,
      },
      {
        ...childContext(1),
        creativeSeed: "A schedule can look realistic in the morning and impossible by lunchtime",
        emotion: "self-blame",
        itemSlotIndex: 1,
      },
      {
        ...childContext(2),
        creativeSeed: "The unfinished list that makes a normal day feel like a personal failure",
        emotion: "pressure",
        itemSlotIndex: 2,
      },
      {
        ...childContext(3),
        creativeSeed: "When a carefully planned afternoon starts reacting to everyone else",
        emotion: "loss of control",
        itemSlotIndex: 3,
      },
      {
        ...childContext(4),
        creativeSeed: "A plan with no room for interruption was never as realistic as it looked",
        emotion: "relief",
        itemSlotIndex: 4,
      },
    ],
    preferredFormatFamily: "relatable_situation",
    supportedAngle: "A planning method that accounts for real capacity",
    ...overrides,
  };
}

function planningBrief(slot: number) {
  return {
    audienceContext: "People managing changing priorities",
    conceptLane: "everyday_friction",
    creativeSeed: `A private planning observation ${slot + 1}`,
    emotionalTension: `A distinct planning tension ${slot + 1}`,
    humanMoment: `A distinct real-life planning moment ${slot + 1}`,
    preferredFormatFamily: "relatable_situation",
    supportedAngle: "A planning method that accounts for real capacity",
  };
}

test("parses one private six-field brief with five seed-and-emotion ideas", () => {
  const parsed = parseCarouselContentPlanChunk(
    { briefs: [oneBrief()] },
    1,
  );

  assert.equal(parsed.briefs.length, 1);
  assert.deepEqual(parsed.briefs[0], {
    audienceContext: "People managing changing priorities",
    briefSlotIndex: 0,
    creativeSeed: "The plan starts to feel heavier than the work itself",
    emotionalTension: "Frustration mixed with self-blame",
    humanMoment: "An unexpected meeting moves every important task into the afternoon",
    preferredFormatFamily: "relatable_situation",
    supportedAngle: "A planning method that accounts for real capacity",
  });
  assert.equal(parsed.items.length, 5);
  assert.equal(parsed.items[0]?.planningBrief.conceptLane, "everyday_friction");
  assert.equal(
    parsed.items[0]?.planningBrief.humanMoment,
    "A distinct real-life planning moment 1",
  );
});

test("rejects exact seed copies, permits wording variations, and rejects prewritten slide instructions", () => {
  const issues = validateCarouselContentPlanChunk({
    existingItems: [
      {
        creative_seed: "The perfect weekly plan quietly becomes the work",
        emotion: "frustration",
      },
    ],
    items: [
      {
        briefSlotIndex: 0,
        creativeSeed: "The perfect weekly plan quietly becomes the work",
        emotion: "quiet frustration",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
      {
        briefSlotIndex: 0,
        creativeSeed: "Slide 1 explains the campaign problem and CTA",
        emotion: "anxiety",
        itemSlotIndex: 1,
        planningBrief: planningBrief(1),
      },
    ],
  });

  assert.ok(issues.some((issue) => issue.includes("repeats")));
  assert.ok(issues.some((issue) => issue.includes("prewrites")));

  const rearrangedCopyIssues = validateCarouselContentPlanChunk({
    existingItems: [
      {
        creative_seed: "Manual follow-ups make your best leads disappear",
        emotion: "frustration",
      },
    ],
    items: [
      {
        briefSlotIndex: 0,
        creativeSeed: "Your best leads disappear; manual follow-ups make",
        emotion: "frustration",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
    ],
  });
  assert.ok(!rearrangedCopyIssues.some((issue) => issue.includes("repeats")));

  const mildRelatedIssues = validateCarouselContentPlanChunk({
    existingItems: [
      {
        creative_seed: "Manual follow-ups make your best leads disappear",
        emotion: "frustration",
      },
    ],
    items: [
      {
        briefSlotIndex: 0,
        creativeSeed: "When a rushed handoff leaves a warm prospect waiting for context",
        emotion: "uncertainty",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
    ],
  });
  assert.ok(!mildRelatedIssues.some((issue) => issue.includes("repeats")));
});

test("permits repeated private human situations when the ideas differ", () => {
  const issues = validateCarouselContentPlanChunk({
    existingItems: [],
    items: [
      {
        briefSlotIndex: 0,
        creativeSeed: "A first broad idea about an interrupted workday",
        emotion: "frustration",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
      {
        briefSlotIndex: 0,
        creativeSeed: "A second broad idea about recovering after a surprise meeting",
        emotion: "pressure",
        itemSlotIndex: 1,
        planningBrief: {
          ...planningBrief(1),
          humanMoment: "A distinct real-life planning moment 1",
        },
      },
    ],
  });

  assert.ok(!issues.some((issue) => issue.includes("private human moment")));
});

test("rejects a replacement that would copy a later Carousel idea", () => {
  const historicalIdea = "A delayed reply makes a warm prospect lose momentum";
  const laterIdea = "A shop owner answers the same customer questions repeatedly";
  const originalItems = [
    {
      briefSlotIndex: 0,
      creativeSeed: historicalIdea,
      emotion: "frustration",
      itemSlotIndex: 0,
      planningBrief: planningBrief(0),
    },
    {
      briefSlotIndex: 0,
      creativeSeed: laterIdea,
      emotion: "pressure",
      itemSlotIndex: 1,
      planningBrief: planningBrief(1),
    },
  ];
  assert.ok(
    validateCarouselContentPlanChunk({
      existingItems: [{ creative_seed: historicalIdea, emotion: "frustration" }],
      items: originalItems,
    }).some((issue) => issue.startsWith("Brief 0 idea 0 repeats")),
  );

  assert.equal(
    isExactCarouselReplacementDuplicate({
      candidate: "A shop owner answers the same customer questions repeatedly.",
      existingItems: [{ creative_seed: historicalIdea }],
      siblingItems: [originalItems[1]!],
    }),
    true,
  );

  const repairedItems = [
    {
      ...originalItems[0]!,
      creativeSeed: "A rushed handoff leaves a warm prospect waiting for the next step",
    },
    originalItems[1]!,
  ];
  assert.equal(
    isExactCarouselReplacementDuplicate({
      candidate: repairedItems[0]!.creativeSeed,
      existingItems: [{ creative_seed: historicalIdea }],
      siblingItems: [repairedItems[1]!],
    }),
    false,
  );
  assert.deepEqual(
    validateCarouselContentPlanChunk({
      existingItems: [{ creative_seed: historicalIdea, emotion: "frustration" }],
      items: repairedItems,
    }),
    [],
  );
});

test("maps the baseline to five organizational items per day without a usage cap", () => {
  assert.deepEqual(getCarouselContentPlanDayPosition(1), {
    dayNumber: 1,
    daySlotIndex: 1,
  });
  assert.deepEqual(getCarouselContentPlanDayPosition(150), {
    dayNumber: 30,
    daySlotIndex: 5,
  });
  assert.deepEqual(getCarouselContentPlanDayPosition(151), {
    dayNumber: 1,
    daySlotIndex: 6,
  });
});

test("creates stable normalized duplicate fingerprints", () => {
  assert.equal(
    createCarouselContentPlanSeedFingerprint("  Quiet   FRUSTRATION! "),
    createCarouselContentPlanSeedFingerprint("quiet frustration"),
  );
});

test("rotates broad private concept lanes across the 30-day plan", () => {
  const lanes = getCarouselConceptLanes(1, 12);

  assert.equal(lanes.length, 60);
  assert.notEqual(lanes[0]?.key, lanes[1]?.key);
  assert.equal(lanes[0]?.key, lanes[10]?.key);
  assert.match(lanes[0]?.direction ?? "", /ordinary moment/i);
});
