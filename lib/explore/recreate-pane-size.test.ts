import assert from "node:assert/strict";
import test from "node:test";

import { clampRecreateEditorWidth, recreateEditorDefault, recreateEditorMaximum } from "./recreate-pane-size.ts";

test("the approved five-percent wider default is bounded to 336–441 pixels", () => {
  assert.equal(recreateEditorDefault(1200), 403);
  assert.equal(recreateEditorDefault(1500), 441);
  assert.equal(recreateEditorDefault(1800), 441);
  assert.equal(recreateEditorDefault(800), 336);
  assert.equal(recreateEditorDefault(1084), 364);
});

test("the wider default still reserves room for the gallery on small containers", () => {
  assert.equal(recreateEditorDefault(656), 320);
  assert.equal(recreateEditorDefault(640), 304);
  assert.equal(recreateEditorDefault(556), 220);
  for (const container of [556, 640, 656, 800, 1084, 1200, 1500, 1800]) {
    assert.ok(recreateEditorDefault(container) <= recreateEditorMaximum(container));
    assert.ok(container - recreateEditorDefault(container) - 16 >= 320);
  }
});

test("editor bounds keep room for the gallery and divider", () => {
  assert.equal(recreateEditorMaximum(1200), 560);
  assert.equal(recreateEditorMaximum(800), 464);
  assert.equal(recreateEditorMaximum(656), 320);
  assert.equal(recreateEditorMaximum(640), 304);
  assert.equal(recreateEditorMaximum(556), 220);
});

test("drag and keyboard sizes clamp at both limits", () => {
  assert.equal(clampRecreateEditorWidth(150, 1200), 220);
  assert.equal(clampRecreateEditorWidth(240, 1200), 240);
  assert.equal(clampRecreateEditorWidth(700, 1200), 560);
  assert.equal(clampRecreateEditorWidth(550, 800), 464);
  assert.equal(clampRecreateEditorWidth(391.8, 1200), 392);
  assert.equal(clampRecreateEditorWidth(Number.NaN, 1200), 403);
  assert.equal(clampRecreateEditorWidth(Number.POSITIVE_INFINITY, 800), 336);
});
