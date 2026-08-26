import assert from "node:assert/strict";
import test from "node:test";

import {
  createWallTextContentIdeaFingerprint,
  parseWallTextContentPlanChunk,
  validateWallTextContentPlanChunk,
} from "./wall-text-content-plan.js";

function oneBrief(overrides: Record<string, unknown> = {}) {
  return {
    audienceContext: "People managing changing priorities",
    briefSlotIndex: 0,
    creativeSeed: "The plan starts to feel heavier than the work itself",
    emotionalTension: "Frustration mixed with self-blame",
    humanMoment: "An unexpected meeting moves every important task into the afternoon",
    items: [
      {
        contentIdea: "The afternoon plan that vanishes after one unexpected meeting",
        feeling: "frustration",
        itemSlotIndex: 0,
      },
      {
        contentIdea: "A schedule that looks realistic in the morning and impossible by lunch",
        feeling: "self-blame",
        itemSlotIndex: 1,
      },
      {
        contentIdea: "The unfinished list that turns a normal day into personal pressure",
        feeling: "pressure",
        itemSlotIndex: 2,
      },
      {
        contentIdea: "When a careful afternoon plan starts reacting to everyone else",
        feeling: "loss of control",
        itemSlotIndex: 3,
      },
      {
        contentIdea: "A plan with no room for interruption was never realistic",
        feeling: "relief",
        itemSlotIndex: 4,
      },
    ],
    supportedAngle: "A planning method that accounts for real capacity",
    ...overrides,
  };
}

test("parses one five-field private Wall brief with five contentIdea and feeling children", () => {
  const parsed = parseWallTextContentPlanChunk({ briefs: [oneBrief()] }, 1);

  assert.equal(parsed.briefs.length, 1);
  assert.deepEqual(parsed.briefs[0], {
    audienceContext: "People managing changing priorities",
    briefSlotIndex: 0,
    creativeSeed: "The plan starts to feel heavier than the work itself",
    emotionalTension: "Frustration mixed with self-blame",
    humanMoment: "An unexpected meeting moves every important task into the afternoon",
    supportedAngle: "A planning method that accounts for real capacity",
  });
  assert.equal(parsed.items.length, 5);
  assert.deepEqual(parsed.items[0], {
    briefSlotIndex: 0,
    contentIdea: "The afternoon plan that vanishes after one unexpected meeting",
    feeling: "frustration",
    itemSlotIndex: 0,
  });
});

test("rejects repeated ideas and child output that tries to prewrite a CTA or video structure", () => {
  const issues = validateWallTextContentPlanChunk({
    existingItems: [
      {
        content_idea: "The perfect weekly plan quietly becomes all of the work",
        feeling: "frustration",
      },
    ],
    items: [
      {
        briefSlotIndex: 0,
        contentIdea: "The perfect weekly plan becomes all of the work",
        feeling: "quiet frustration",
        itemSlotIndex: 0,
      },
      {
        briefSlotIndex: 0,
        contentIdea: "Slide 1 explains the planning problem before the CTA",
        feeling: "anxiety",
        itemSlotIndex: 1,
      },
    ],
  });

  assert.ok(issues.some((issue) => issue.includes("repeats")));
  assert.ok(issues.some((issue) => issue.includes("prewrites")));
});

test("creates stable duplicate fingerprints for content ideas", () => {
  assert.equal(
    createWallTextContentIdeaFingerprint("  Quiet   FRUSTRATION! "),
    createWallTextContentIdeaFingerprint("quiet frustration"),
  );
});
