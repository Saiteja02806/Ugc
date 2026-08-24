import assert from "node:assert/strict";
import test from "node:test";

import {
  createCarouselContentPlanSeedFingerprint,
  getCarouselContentPlanDayPosition,
  parseCarouselContentPlanChunk,
  validateCarouselContentPlanChunk,
} from "./carousel-content-plan.js";

test("parses seed and emotion without accepting extra creative structure", () => {
  const items = parseCarouselContentPlanChunk(
    {
      items: [
        {
          creativeSeed: "The planning ritual that quietly becomes the work",
          emotion: "quiet frustration",
          slotIndex: 0,
        },
      ],
    },
    1,
  );

  assert.deepEqual(items, [
    {
      creativeSeed: "The planning ritual that quietly becomes the work",
      emotion: "quiet frustration",
      slotIndex: 0,
    },
  ]);
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
        creativeSeed: "The perfect weekly plan becomes all of the work",
        emotion: "quiet frustration",
        slotIndex: 0,
      },
      {
        creativeSeed: "Slide 1 explains the campaign problem and CTA",
        emotion: "anxiety",
        slotIndex: 1,
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
