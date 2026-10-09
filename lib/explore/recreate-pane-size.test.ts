import assert from "node:assert/strict";
import test from "node:test";

import { clampRecreateEditorWidth, recreateEditorDefault, recreateEditorMaximum } from "./recreate-pane-size.ts";

test("the default takes 20 percent, bounded for usable controls and a larger gallery", () => {
  assert.equal(recreateEditorDefault(1200), 240);
  assert.equal(recreateEditorDefault(1500), 300);
  assert.equal(recreateEditorDefault(1800), 320);
  assert.equal(recreateEditorDefault(800), 220);
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
  assert.equal(clampRecreateEditorWidth(Number.NaN, 1200), 240);
});
