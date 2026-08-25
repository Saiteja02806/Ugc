import assert from "node:assert/strict";
import test from "node:test";

import {
  createCarouselContentPlanSeedFingerprint,
  getCarouselContentPlanDayPosition,
  parseCarouselContentPlanChunk,
  validateCarouselContentPlanChunk,
} from "./carousel-content-plan.js";

function oneBrief(overrides: Record<string, unknown> = {}) {
  return {
    audienceContext: "People managing changing priorities",
    briefSlotIndex: 0,
    creativeSeed: "The plan starts to feel heavier than the work itself",
    emotionalTension: "Frustration mixed with self-blame",
    humanMoment: "An unexpected meeting moves every important task into the afternoon",
    items: [
      {
        creativeSeed: "The afternoon plan that quietly disappears after one unexpected meeting",
        emotion: "frustration",
        itemSlotIndex: 0,
      },
      {
        creativeSeed: "A schedule can look realistic in the morning and impossible by lunchtime",
        emotion: "self-blame",
        itemSlotIndex: 1,
      },
      {
        creativeSeed: "The unfinished list that makes a normal day feel like a personal failure",
        emotion: "pressure",
        itemSlotIndex: 2,
      },
      {
        creativeSeed: "When a carefully planned afternoon starts reacting to everyone else",
        emotion: "loss of control",
        itemSlotIndex: 3,
      },
      {
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
  assert.deepEqual(parsed.items[0], {
    briefSlotIndex: 0,
    creativeSeed: "The afternoon plan that quietly disappears after one unexpected meeting",
    emotion: "frustration",
    itemSlotIndex: 0,
  });
});

test("rejects close seed repetition and prewritten slide instructions", () => {
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
        creativeSeed: "The perfect weekly plan becomes all of the work",
        emotion: "quiet frustration",
        itemSlotIndex: 0,
      },
      {
        briefSlotIndex: 0,
        creativeSeed: "Slide 1 explains the campaign problem and CTA",
        emotion: "anxiety",
        itemSlotIndex: 1,
      },
    ],
  });

  assert.ok(issues.some((issue) => issue.includes("repeats")));
  assert.ok(issues.some((issue) => issue.includes("prewrites")));
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
