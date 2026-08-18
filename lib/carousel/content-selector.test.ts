import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
  getCarouselContentFormat,
} from "./content-grammar.ts";
import {
  CAROUSEL_CONTENT_SELECTOR_VERSION,
  selectCarouselContentAssignments,
  selectCarouselExperimentBatch,
  type CarouselRecentContentSummary,
} from "./content-selector.ts";
import type { CarouselPerformanceSignals } from "./performance-logic.ts";

const history: CarouselRecentContentSummary[] = [
  {
    angle: "Three campaign mistakes that create late work",
    audienceId: "audience_campaign_managers",
    contentFormatId: "mistakes",
    hook: "These campaign mistakes keep following you home",
    hookFamilyId: "mistake",
    topic: "campaign planning",
    topicId: "topic_campaign_planning",
  },
  {
    angle: "A campaign handoff checklist",
    audienceId: "audience_small_teams",
    contentFormatId: "checklist",
    hook: "Check these before the next handoff",
    hookFamilyId: "utility",
    topic: "campaign handoffs",
    topicId: "topic_campaign_handoffs",
  },
];

test("rotates the fifteen stable format IDs in deterministic five-format batches", () => {
  const first = selectCarouselExperimentBatch({
    batchSequence: 0,
    history,
    topicOptionCount: 6,
  });
  const second = selectCarouselExperimentBatch({
    batchSequence: 1,
    history,
    topicOptionCount: 6,
  });
  const third = selectCarouselExperimentBatch({
    batchSequence: 2,
    history,
    topicOptionCount: 6,
  });
  const nextCycle = selectCarouselExperimentBatch({
    batchSequence: 3,
    history,
    topicOptionCount: 6,
  });

  assert.deepEqual(first.map((item) => item.contentFormatId), [
    "list",
    "mistakes",
    "how_to",
    "comparison",
    "swap",
  ]);
  assert.deepEqual(second.map((item) => item.contentFormatId), [
    "myth_fact",
    "cheat_sheet",
    "checklist",
    "framework",
    "breakdown",
  ]);
  assert.deepEqual(third.map((item) => item.contentFormatId), [
    "problem_solution",
    "beginner_roadmap",
    "resources",
    "examples",
    "before_after",
  ]);
  assert.deepEqual(nextCycle.map((item) => item.contentFormatId), [
    "cheat_sheet",
    "checklist",
    "framework",
    "breakdown",
    "myth_fact",
  ]);
  const firstCycleCheatSheet = second.find(
    (item) => item.contentFormatId === "cheat_sheet",
  );
  const nextCycleCheatSheet = nextCycle.find(
    (item) => item.contentFormatId === "cheat_sheet",
  );
  assert.notEqual(
    firstCycleCheatSheet?.hookFamilyId,
    nextCycleCheatSheet?.hookFamilyId,
  );

  for (const assignment of [...first, ...second, ...third]) {
    const format = getCarouselContentFormat(assignment.contentFormatId);
    assert.equal(assignment.assignedContentFormatId, assignment.contentFormatId);
    assert.equal(assignment.formatSelectionMode, "controlled_rotation");
    assert.equal(assignment.formatSelectionMultiplier, 1);
    assert.equal(assignment.formatVersion, format.version);
    assert.equal(assignment.grammarVersion, CAROUSEL_CONTENT_GRAMMAR_VERSION);
    assert.equal(assignment.selectorVersion, CAROUSEL_CONTENT_SELECTOR_VERSION);
    assert.ok(format.compatibleHookFamilies.includes(assignment.hookFamilyId));
    assert.equal(assignment.hookSelectionMode, "controlled_rotation");
    assert.equal(assignment.hookSelectionMultiplier, 1);
    assert.equal(
      assignment.rotationCandidateContentFormatId,
      assignment.contentFormatId,
    );
  }
});

test("is retry-stable, keeps compact history, and preserves persisted reservations", () => {
  const longHistory = Array.from({ length: 14 }, (_, index) => ({
    angle: `Angle ${index}`,
    audienceId: `audience_${index}`,
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
  const input = {
    candidateCount: 10,
    history: longHistory,
    reserved,
    seed: "ignored-by-controlled-selector",
    topicOptionCount: 6,
  } as const;
  const first = selectCarouselContentAssignments(input);
  const retry = selectCarouselContentAssignments(input);

  assert.deepEqual(retry, first);
  assert.equal(first.length, 10);
  assert.equal(first[1]?.contentFormatId, "comparison");
  assert.equal(first[1]?.hookFamilyId, "comparison");
  assert.equal(first[1]?.historySnapshot.length, 10);
  assert.equal(first[0]?.historySnapshot[0]?.audienceId, "audience_0");
});

test("gently weights multiple proven formats while preserving one exploration slot", () => {
  const performanceSignals: CarouselPerformanceSignals = {
    formatMultipliers: {
      checklist: 0.85,
      comparison: 1.15,
      list: 1.25,
    },
  };
  const counts = new Map<string, number>();

  for (let batchSequence = 0; batchSequence < 300; batchSequence += 1) {
    const first = selectCarouselExperimentBatch({
      batchSequence,
      history,
      performanceSignals,
      selectionKey: "business-profile-1",
      topicOptionCount: 6,
    });
    const retry = selectCarouselExperimentBatch({
      batchSequence,
      history,
      performanceSignals,
      selectionKey: "business-profile-1",
      topicOptionCount: 6,
    });

    assert.deepEqual(retry, first);
    assert.equal(first.length, 5);
    assert.equal(new Set(first.map((item) => item.contentFormatId)).size, 5);
    assert.equal(
      first.filter(
        (item) => item.formatSelectionMode === "performance_exploration",
      ).length,
      1,
    );
    assert.equal(
      first.filter(
        (item) => item.formatSelectionMode === "performance_weighted",
      ).length,
      4,
    );

    for (const item of first) {
      counts.set(
        item.contentFormatId,
        (counts.get(item.contentFormatId) ?? 0) + 1,
      );
    }
  }

  assert.ok((counts.get("list") ?? 0) > (counts.get("checklist") ?? 0));
  assert.ok(
    (counts.get("comparison") ?? 0) > (counts.get("checklist") ?? 0),
  );
});

test("weights compatible hook families separately and keeps hook exploration", () => {
  const performanceSignals: CarouselPerformanceSignals = {
    formatMultipliers: { comparison: 1.15, list: 1.1 },
    hookFamilyMultipliers: {
      comparison: {
        comparison: 1.2,
        question: 0.9,
      },
    },
  };
  const hookCounts = new Map<string, number>();
  let explorationCount = 0;
  let weightedCount = 0;

  for (let batchSequence = 0; batchSequence < 500; batchSequence += 1) {
    const batch = selectCarouselExperimentBatch({
      batchSequence,
      history,
      performanceSignals,
      selectionKey: "business-profile-2",
      topicOptionCount: 6,
    });
    const comparison = batch.find(
      (assignment) => assignment.contentFormatId === "comparison",
    );

    if (!comparison) continue;

    hookCounts.set(
      comparison.hookFamilyId,
      (hookCounts.get(comparison.hookFamilyId) ?? 0) + 1,
    );
    if (comparison.hookSelectionMode === "performance_exploration") {
      explorationCount += 1;
    }
    if (comparison.hookSelectionMode === "performance_weighted") {
      weightedCount += 1;
    }
  }

  assert.ok((hookCounts.get("comparison") ?? 0) > (hookCounts.get("question") ?? 0));
  assert.ok(explorationCount > 0);
  assert.ok(weightedCount > 0);
});
