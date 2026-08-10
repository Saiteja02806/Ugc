import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
  getCarouselContentFormat,
} from "./content-grammar.ts";
import {
  CAROUSEL_CONTENT_SELECTOR_VERSION,
  selectCarouselContentAssignments,
  type CarouselRecentContentSummary,
} from "./content-selector.ts";

const history: CarouselRecentContentSummary[] = [
  {
    angle: "Three campaign mistakes that create late work",
    contentFormatId: "mistakes",
    hook: "These campaign mistakes keep following you home",
    hookFamilyId: "mistake",
    topic: "campaign planning",
    topicId: "topic_campaign_planning",
  },
  {
    angle: "A campaign handoff checklist",
    contentFormatId: "checklist",
    hook: "Check these before the next handoff",
    hookFamilyId: "utility",
    topic: "campaign handoffs",
    topicId: "topic_campaign_handoffs",
  },
];

test("selects a retry-stable and diverse ten-carousel batch", () => {
  const input = {
    candidateCount: 10,
    history,
    seed: "profile-1:batch-1",
    topicOptionCount: 6,
  } as const;
  const first = selectCarouselContentAssignments(input);
  const retry = selectCarouselContentAssignments(input);

  assert.deepEqual(retry, first);
  assert.equal(first.length, 10);
  assert.notEqual(first[0]?.contentFormatId, history[0]?.contentFormatId);
  assert.equal(
    first[0]?.historySnapshot[0]?.topicId,
    "topic_campaign_planning",
  );
  assert.ok(new Set(first.map((item) => item.contentFormatId)).size >= 8);

  for (const assignment of first) {
    const format = getCarouselContentFormat(assignment.contentFormatId);
    assert.ok(format.compatibleHookFamilies.includes(assignment.hookFamilyId));
    assert.equal(assignment.grammarVersion, CAROUSEL_CONTENT_GRAMMAR_VERSION);
    assert.equal(assignment.selectorVersion, CAROUSEL_CONTENT_SELECTOR_VERSION);
    assert.equal(assignment.historySnapshot.length, 2);
  }

  for (let index = 1; index < first.length; index += 1) {
    assert.notEqual(first[index]?.contentFormatId, first[index - 1]?.contentFormatId);
  }
});

test("preserves a compatible reservation and caps retry history at ten", () => {
  const longHistory = Array.from({ length: 14 }, (_, index) => ({
    angle: `Angle ${index}`,
    contentFormatId: index % 2 === 0 ? "list" : "how_to",
    hook: `Hook ${index}`,
    hookFamilyId: index % 2 === 0 ? "utility" : "beginner",
    topic: `Topic ${index}`,
    topicId: `topic_${index}`,
  })) satisfies CarouselRecentContentSummary[];
  const reserved = new Map([
    [
      1,
      {
        contentFormatId: "comparison" as const,
        hookFamilyId: "comparison" as const,
      },
    ],
  ]);
  const assignments = selectCarouselContentAssignments({
    candidateCount: 3,
    history: longHistory,
    reserved,
    seed: "profile-1:batch-retry",
    topicOptionCount: 6,
  });

  assert.equal(assignments[1]?.contentFormatId, "comparison");
  assert.equal(assignments[1]?.hookFamilyId, "comparison");
  assert.equal(assignments[1]?.historySnapshot.length, 10);
});
