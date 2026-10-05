import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const split = read("components/explore/recreate-split-pane.tsx");
const layout = read("components/explore/recreate-layout.module.css");
const workspace = read("components/explore/recreate-workspace.tsx");
const generation = read("components/explore/recreate-generation-panel.tsx");

test("resizing has pointer capture, cancellation, cleanup and keyboard alternatives", () => {
  for (const contract of [/role="separator"/, /aria-orientation="vertical"/, /aria-controls=\{editorId\}/,
    /aria-valuemin/, /aria-valuemax/, /aria-valuenow/, /setPointerCapture/, /onLostPointerCapture/,
    /onPointerCancel/, /cancelAnimationFrame/, /observer\.disconnect\(\)/,
    /"ArrowLeft"/, /"ArrowRight"/, /"Home"/, /"End"/, /"Enter"/, /"Escape"/]) assert.match(split, contract);
  assert.match(layout, /touch-action: none/);
  assert.match(layout, /user-select: none/);
  assert.match(layout, /\.divider:focus-visible/);
});

test("the same generators stay mounted and mobile keeps the stacked layout", () => {
  assert.match(workspace, /<RecreateSplitPane>/);
  assert.match(split, /children\[0\]/);
  assert.match(split, /children\[1\]/);
  assert.doesNotMatch(split, /localStorage|fetch\(|key=|window\.location|onSubmit/);
  assert.match(layout, /\.divider \{ display: none; \}/);
  assert.match(layout, /@media \(min-width: 1024px\)/);
  assert.match(generation, /lg:flex-1 lg:w-full/);
  assert.doesNotMatch(generation, /lg:w-\[360px\]|min-\[1600px\]:w-\[400px\]/);
  assert.match(generation, /localPreview \? "locked" : accountAccessState/);
  assert.doesNotMatch(generation, /<(?:ImagePanel|VideoPanel)[^>]*\bkey=/);
});

test("the splitter has no full-height line or focus outline", () => {
  assert.doesNotMatch(layout, /\.divider::before|\.divider::after/);
  assert.match(layout, /\.divider:focus-visible \.grip \{ outline: 2px solid/);
  assert.doesNotMatch(layout, /\.divider:focus-visible \{[^}]*outline:/);
  assert.match(layout, /clamp\(220px, 20%, 320px\)/);
  assert.match(split, /onDoubleClick=\{\(\) => setRequestedWidth\(null\)\}/);
  assert.match(split, /startRequestedWidth: requestedWidth/);
});

test("narrow recreate controls are compact without losing their names or settings", () => {
  const composer = read("components/generation/ai-studio-composer.tsx");
  assert.match(layout, /@container recreate-editor \(max-width: 300px\)/);
  assert.match(layout, /composer-settings-label"\]\) \{ display: none/);
  assert.match(composer, /aria-label="Generation settings" title="Generation settings"/);
  assert.match(composer, /data-slot="composer-settings-label">Settings<\/span>/);
  assert.match(composer, /const minimumHeight = compact \? 64/);
  assert.match(composer, /const maximumHeight = compact \? 96/);
  assert.match(composer, /<div className="flex flex-wrap items-center gap-2">\{settings\}<\/div>/);
});

test("the clearer recreate arrow still selects a reference, not resets playback or drafts", () => {
  const card = workspace.slice(workspace.indexOf("function ReferenceCard"), workspace.indexOf("function ReferenceMedia"));
  assert.match(card, /onClick=\{onRecreate\}/);
  assert.match(card, /aria-label=\{`Recreate \$\{reference\.title\}`\}/);
  assert.match(card, /size-10[^\n]*rounded-lg/);
  assert.match(card, /RotateCcw className="size-5" strokeWidth=\{1\.6\}/);
  assert.doesNotMatch(card, /currentTime|setPrompt|setInstructions/);
});
