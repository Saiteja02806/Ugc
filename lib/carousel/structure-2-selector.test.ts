import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_STRUCTURE_2_FORMATS_VERSION,
  getCarouselStructure2Format,
} from "./structure-2-formats.ts";
import {
  CAROUSEL_STRUCTURE_2_SELECTOR_VERSION,
  getCarouselStructure2RotationFormats,
  selectCarouselStructure2ExperimentBatch,
  type CarouselStructure2RecentHistory,
} from "./structure-2-selector.ts";

test("rotates formats 1-5, then 6-8 and back to 1-2", () => {
  const first = selectCarouselStructure2ExperimentBatch({
    batchSequence: 0,
    history: [],
  });
  const second = selectCarouselStructure2ExperimentBatch({
    batchSequence: 1,
    history: [],
  });

  assert.deepEqual(first.map((assignment) => assignment.storyFormatId), [
    "wrong_belief",
    "perfect_plan_breaks",
    "stopped_behavior",
    "terrible_at",
    "result_without_sacrifice",
  ]);
  assert.deepEqual(second.map((assignment) => assignment.storyFormatId), [
    "identity_transformation",
    "new_rule",
    "wrong_villain",
    "wrong_belief",
    "perfect_plan_breaks",
  ]);

  for (const assignment of [...first, ...second]) {
    assert.equal(assignment.assignedStoryFormatId, assignment.storyFormatId);
    assert.equal(assignment.formatSelectionMode, "controlled_rotation");
    assert.equal(assignment.formatSelectionMultiplier, 1);
    assert.equal(
      assignment.formatVersion,
      getCarouselStructure2Format(assignment.storyFormatId).version,
    );
    assert.equal(assignment.grammarVersion, CAROUSEL_STRUCTURE_2_FORMATS_VERSION);
    assert.equal(
      assignment.selectorVersion,
      CAROUSEL_STRUCTURE_2_SELECTOR_VERSION,
    );
    assert.equal(
      assignment.rotationCandidateStoryFormatId,
      assignment.storyFormatId,
    );
  }
});

test("keeps circular five-format windows balanced across eight batches", () => {
  const counts = new Map<string, number>();

  for (let batchSequence = 0; batchSequence < 8; batchSequence += 1) {
    const formats = getCarouselStructure2RotationFormats(batchSequence);

    assert.equal(formats.length, 5);
    assert.equal(new Set(formats.map((format) => format.id)).size, 5);
    for (const format of formats) {
      counts.set(format.id, (counts.get(format.id) ?? 0) + 1);
    }
  }

  assert.equal(counts.size, 8);
  assert.deepEqual(new Set(counts.values()), new Set([5]));
});

test("is retry-stable and preserves a persisted Structure 2 reservation", () => {
  const reserved = new Map([
    [
      2,
      {
        assignedStoryFormatId: "wrong_villain" as const,
        formatSelectionMode: "performance_weighted" as const,
        formatSelectionMultiplier: 1.2,
        rotationCandidateStoryFormatId: "stopped_behavior" as const,
        storyFormatId: "wrong_villain" as const,
      },
    ],
  ]);
  const params = {
    batchSequence: 0,
    history: [],
    reserved,
    selectionKey: "business-1",
  } as const;
  const first = selectCarouselStructure2ExperimentBatch(params);
  const retry = selectCarouselStructure2ExperimentBatch(params);

  assert.deepEqual(retry, first);
  assert.equal(first[2]?.assignedStoryFormatId, "wrong_villain");
  assert.equal(first[2]?.storyFormatId, "wrong_villain");
  assert.equal(first[2]?.rotationCandidateStoryFormatId, "stopped_behavior");
  assert.equal(first[2]?.formatSelectionMode, "performance_weighted");
  assert.equal(first[2]?.formatSelectionMultiplier, 1.2);
});

test("weights proven Structure 2 formats while preserving one exploration slot", () => {
  const counts = new Map<string, number>();

  for (let batchSequence = 0; batchSequence < 400; batchSequence += 1) {
    const batch = selectCarouselStructure2ExperimentBatch({
      batchSequence,
      history: [],
      performanceSignals: {
        formatMultipliers: {
          perfect_plan_breaks: 1.15,
          terrible_at: 0.85,
          wrong_belief: 1.25,
        },
      },
      selectionKey: "business-performance",
    });
    const retry = selectCarouselStructure2ExperimentBatch({
      batchSequence,
      history: [],
      performanceSignals: {
        formatMultipliers: {
          perfect_plan_breaks: 1.15,
          terrible_at: 0.85,
          wrong_belief: 1.25,
        },
      },
      selectionKey: "business-performance",
    });

    assert.deepEqual(retry, batch);
    assert.equal(batch.length, 5);
    assert.equal(new Set(batch.map((assignment) => assignment.storyFormatId)).size, 5);
    assert.equal(
      batch.filter(
        (assignment) =>
          assignment.formatSelectionMode === "performance_exploration",
      ).length,
      1,
    );
    assert.equal(
      batch.filter(
        (assignment) =>
          assignment.formatSelectionMode === "performance_weighted",
      ).length,
      4,
    );

    for (const assignment of batch) {
      counts.set(
        assignment.storyFormatId,
        (counts.get(assignment.storyFormatId) ?? 0) + 1,
      );
    }
  }

  assert.ok((counts.get("wrong_belief") ?? 0) > (counts.get("terrible_at") ?? 0));
  assert.ok(
    (counts.get("perfect_plan_breaks") ?? 0) >
      (counts.get("terrible_at") ?? 0),
  );
});

test("does not use performance weighting until at least two formats qualify", () => {
  const batch = selectCarouselStructure2ExperimentBatch({
    batchSequence: 1,
    history: [],
    performanceSignals: { formatMultipliers: { wrong_belief: 1.25 } },
  });

  assert.ok(
    batch.every(
      (assignment) =>
        assignment.formatSelectionMode === "controlled_rotation",
    ),
  );
});

test("keeps compact Structure 2 history and normalizes turns_out", () => {
  const history = Array.from({ length: 14 }, (_, index) => ({
    centralProblem: ` Problem ${index} `,
    ctaAngle: ` CTA ${index} `,
    hookIdea: ` Hook ${index} `,
    productMechanism: ` Mechanism ${index} `,
    storyAngle: ` Angle ${index} `,
    storyFormatId: index === 0 ? "turns_out" : "wrong_belief",
    summary: ` Summary ${index} `,
  })) as unknown as CarouselStructure2RecentHistory[];
  const batch = selectCarouselStructure2ExperimentBatch({
    batchSequence: 0,
    history,
  });

  assert.equal(batch[0]?.historySnapshot.length, 10);
  assert.equal(batch[0]?.historySnapshot[0]?.storyFormatId, "wrong_villain");
  assert.equal(batch[0]?.historySnapshot[0]?.centralProblem, "Problem 0");
  assert.equal(batch[0]?.historySnapshot[0]?.summary, "Summary 0");
});
