import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkWallTextAssignments,
  selectWallTextFormatAssignments,
} from "./wall-format-selector.ts";

test("Wall format allocation is deterministic and never exceeds fifty percent", () => {
  for (const candidateCount of [10, 24, 40]) {
    const first = selectWallTextFormatAssignments({
      candidateCount,
      selectionKey: `business-a:${candidateCount}`,
    });
    const second = selectWallTextFormatAssignments({
      candidateCount,
      selectionKey: `business-a:${candidateCount}`,
    });
    assert.deepEqual(first, second);
    const counts = new Map<string, number>();
    for (const entry of first) {
      counts.set(entry.assignedFormatId, (counts.get(entry.assignedFormatId) ?? 0) + 1);
    }
    assert.ok(Math.max(...counts.values()) <= Math.floor(candidateCount * 0.5));
  }
});

test("24 candidates become stable Writer chunks of 10, 10 and 4", () => {
  const assignments = selectWallTextFormatAssignments({
    candidateCount: 24,
    selectionKey: "business-b:request-24",
  });
  assert.deepEqual(chunkWallTextAssignments(assignments).map((chunk) => chunk.length), [10, 10, 4]);
});
