import assert from "node:assert/strict";
import test from "node:test";

import {
  clampCreateContentTextPosition,
  createCenteredTextPosition,
  isCreateContentTextFormat,
  normalizeCreateContentText,
} from "./card-contract.ts";

test("Create Content begins generated text at the centre of the selected video", () => {
  assert.deepEqual(createCenteredTextPosition(), { x: 0.5, y: 0.5 });
});

test("Create Content keeps a manually moved text anchor within the visible video", () => {
  assert.deepEqual(
    clampCreateContentTextPosition({ x: -2, y: 4 }),
    { x: 0.04, y: 0.96 },
  );
  assert.deepEqual(
    clampCreateContentTextPosition({ x: Number.NaN, y: 0.54 }),
    { x: 0.5, y: 0.54 },
  );
});

test("Create Content only accepts its two single-overlay formats", () => {
  assert.equal(isCreateContentTextFormat("wall_text"), true);
  assert.equal(isCreateContentTextFormat("hook_text"), true);
  assert.equal(isCreateContentTextFormat("carousel"), false);
});

test("editing preserves deliberate line breaks while normalizing whitespace", () => {
  assert.equal(
    normalizeCreateContentText("  A   human thought \r\n  that stays readable  "),
    "A human thought\nthat stays readable",
  );
});
