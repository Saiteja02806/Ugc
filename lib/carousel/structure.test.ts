import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCarouselStructureRuntimeReady,
  isCarouselStructureRuntimeReady,
  selectCarouselStructureAssignment,
} from "./structure.ts";

test("rotate mode alternates complete five-carousel batches deterministically", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((structureRotationSequence) =>
      selectCarouselStructureAssignment({
        structureMode: "rotate",
        structureRotationSequence,
      }),
    ),
    [
      {
        structureId: "structure_1",
        structureRotationSequence: 0,
        structureSelectionMode: "rotation",
      },
      {
        structureId: "structure_2",
        structureRotationSequence: 1,
        structureSelectionMode: "rotation",
      },
      {
        structureId: "structure_1",
        structureRotationSequence: 2,
        structureSelectionMode: "rotation",
      },
      {
        structureId: "structure_2",
        structureRotationSequence: 3,
        structureSelectionMode: "rotation",
      },
      {
        structureId: "structure_1",
        structureRotationSequence: 4,
        structureSelectionMode: "rotation",
      },
    ],
  );
});

test("global overrides choose one structure without consuming rotation", () => {
  assert.deepEqual(
    selectCarouselStructureAssignment({
      structureMode: "structure_1_only",
      structureRotationSequence: 12,
    }),
    {
      structureId: "structure_1",
      structureRotationSequence: null,
      structureSelectionMode: "global_override",
    },
  );
  assert.deepEqual(
    selectCarouselStructureAssignment({
      structureMode: "structure_2_only",
      structureRotationSequence: 12,
    }),
    {
      structureId: "structure_2",
      structureRotationSequence: null,
      structureSelectionMode: "global_override",
    },
  );
});

test("rejects invalid rotation state", () => {
  for (const structureRotationSequence of [-1, 1.5, Number.NaN]) {
    assert.throws(
      () =>
        selectCarouselStructureAssignment({
          structureMode: "rotate",
          structureRotationSequence,
        }),
      /carousel_structure_rotation_sequence_invalid/,
    );
  }
});

test("both structures are runtime-ready through their isolated engines", () => {
  assert.equal(isCarouselStructureRuntimeReady("structure_1"), true);
  assert.equal(isCarouselStructureRuntimeReady("structure_2"), true);
  assert.doesNotThrow(() => assertCarouselStructureRuntimeReady("structure_1"));
  assert.doesNotThrow(() => assertCarouselStructureRuntimeReady("structure_2"));
});
