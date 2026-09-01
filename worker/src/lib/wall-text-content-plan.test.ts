import assert from "node:assert/strict";
import test from "node:test";

import {
  createWallTextContentIdeaFingerprint,
  isExactWallTextReplacementDuplicate,
  parseWallTextContentPlanChunk,
  validateWallTextContentPlanChunk,
} from "./wall-text-content-plan.js";

function oneBrief(overrides: Record<string, unknown> = {}) {
  const childContext = (slot: number) => ({
    audienceContext: "People managing changing priorities",
    emotionalTension: `A distinct planning tension ${slot + 1}`,
    humanMoment: `A distinct real-life planning moment ${slot + 1}`,
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
        contentIdea: "The afternoon plan that vanishes after one unexpected meeting",
        feeling: "frustration",
        itemSlotIndex: 0,
      },
      {
        ...childContext(1),
        contentIdea: "A schedule that looks realistic in the morning and impossible by lunch",
        feeling: "self-blame",
        itemSlotIndex: 1,
      },
      {
        ...childContext(2),
        contentIdea: "The unfinished list that turns a normal day into personal pressure",
        feeling: "pressure",
        itemSlotIndex: 2,
      },
      {
        ...childContext(3),
        contentIdea: "When a careful afternoon plan starts reacting to everyone else",
        feeling: "loss of control",
        itemSlotIndex: 3,
      },
      {
        ...childContext(4),
        contentIdea: "A plan with no room for interruption was never realistic",
        feeling: "relief",
        itemSlotIndex: 4,
      },
    ],
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
    supportedAngle: "A planning method that accounts for real capacity",
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
  assert.equal(parsed.items[0]?.planningBrief.conceptLane, "everyday_friction");
  assert.equal(
    parsed.items[0]?.planningBrief.humanMoment,
    "A distinct real-life planning moment 1",
  );
});

test("rejects exact ideas, permits wording variations, and rejects prewritten video structure", () => {
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
        contentIdea: "The perfect weekly plan quietly becomes all of the work",
        feeling: "quiet frustration",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
      {
        briefSlotIndex: 0,
        contentIdea: "Slide 1 explains the planning problem before the CTA",
        feeling: "anxiety",
        itemSlotIndex: 1,
        planningBrief: planningBrief(1),
      },
    ],
  });

  assert.ok(issues.some((issue) => issue.includes("repeats")));
  assert.ok(issues.some((issue) => issue.includes("prewrites")));

  const rearrangedCopyIssues = validateWallTextContentPlanChunk({
    existingItems: [
      {
        content_idea: "Manual follow-ups make your best leads disappear",
        feeling: "frustration",
      },
    ],
    items: [
      {
        briefSlotIndex: 0,
        contentIdea: "Your best leads disappear; manual follow-ups make",
        feeling: "frustration",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
    ],
  });
  assert.ok(!rearrangedCopyIssues.some((issue) => issue.includes("repeats")));

  const mildRelatedIssues = validateWallTextContentPlanChunk({
    existingItems: [
      {
        content_idea: "Manual follow-ups make your best leads disappear",
        feeling: "frustration",
      },
    ],
    items: [
      {
        briefSlotIndex: 0,
        contentIdea: "A prospect loses momentum after a handoff without clear next steps",
        feeling: "uncertainty",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
    ],
  });
  assert.ok(!mildRelatedIssues.some((issue) => issue.includes("repeats")));
});

test("permits repeated private human situations when the ideas differ", () => {
  const issues = validateWallTextContentPlanChunk({
    existingItems: [],
    items: [
      {
        briefSlotIndex: 0,
        contentIdea: "A first broad idea about an interrupted workday",
        feeling: "frustration",
        itemSlotIndex: 0,
        planningBrief: planningBrief(0),
      },
      {
        briefSlotIndex: 0,
        contentIdea: "A second broad idea about recovering after a surprise meeting",
        feeling: "pressure",
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

test("rejects a replacement that would copy a later Wall-of-Text idea", () => {
  const historicalIdea = "A delayed reply makes a warm prospect lose momentum";
  const laterIdea = "A shop owner answers the same customer questions repeatedly";
  const originalItems = [
    {
      briefSlotIndex: 0,
      contentIdea: historicalIdea,
      feeling: "frustration",
      itemSlotIndex: 0,
      planningBrief: planningBrief(0),
    },
    {
      briefSlotIndex: 0,
      contentIdea: laterIdea,
      feeling: "pressure",
      itemSlotIndex: 1,
      planningBrief: planningBrief(1),
    },
  ];
  assert.ok(
    validateWallTextContentPlanChunk({
      existingItems: [{ content_idea: historicalIdea, feeling: "frustration" }],
      items: originalItems,
    }).some((issue) => issue.startsWith("Brief 0 idea 0 repeats")),
  );

  assert.equal(
    isExactWallTextReplacementDuplicate({
      candidate: "A shop owner answers the same customer questions repeatedly.",
      existingItems: [{ content_idea: historicalIdea }],
      siblingItems: [originalItems[1]!],
    }),
    true,
  );

  const repairedItems = [
    {
      ...originalItems[0]!,
      contentIdea: "A rushed handoff leaves a warm prospect waiting for the next step",
    },
    originalItems[1]!,
  ];
  assert.equal(
    isExactWallTextReplacementDuplicate({
      candidate: repairedItems[0]!.contentIdea,
      existingItems: [{ content_idea: historicalIdea }],
      siblingItems: [repairedItems[1]!],
    }),
    false,
  );
  assert.deepEqual(
    validateWallTextContentPlanChunk({
      existingItems: [{ content_idea: historicalIdea, feeling: "frustration" }],
      items: repairedItems,
    }),
    [],
  );
});

test("creates stable duplicate fingerprints for content ideas", () => {
  assert.equal(
    createWallTextContentIdeaFingerprint("  Quiet   FRUSTRATION! "),
    createWallTextContentIdeaFingerprint("quiet frustration"),
  );
});
