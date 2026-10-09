import assert from "node:assert/strict";
import test from "node:test";
import { createAuthoritativeWallTextContent, createAuthoritativeWallTextEdit } from "./wall-layout-engine.ts";
import { createWallTextLayout } from "./wall-text-feed-logic.ts";
import { validateWallTextContent } from "./wall-text-text-logic.ts";
import { validateWallTextRenderFit } from "./wall-text-render-validation.ts";
import { getWallTextManualBlocks, normalizeWallTextManualCopy, validateWallTextManualCopy } from "./wall-text-manual-copy.ts";
import { updateWallTextEditBox } from "./creative-edit-contract.ts";
import { resizeWallTextEditBox, moveWallTextEditBox } from "./wall-text-editor-layout.ts";
import { buildWallTextRenderLayout } from "../../worker/dist/lib/wall-text-render-spec.js";
import { parseRenderWallTextVideoPayload } from "../../worker/dist/jobs/render-wall-text-video.js";
import { prepareWallTextOverlayAsset } from "../../worker/dist/lib/wall-text-overlay-renderer.js";

const example = "5 tools I’d keep if I were building a SaaS from zero today:\n\nGraphite - code review\n\nVercel - deployment\n\nDatafast - analytics\n\nUGCpilot - marketing\n\nSentry - finding what breaks";

async function prepare(text, layout = createWallTextLayout()) {
  const result = await createAuthoritativeWallTextEdit({
    fullText: text, previousContent: { fullText: "Previous copy", segments: [] }, formatId: "freeform", layout,
  });
  validateWallTextContent(result.content, 6);
  await validateWallTextRenderFit(result.content);
  return result;
}

function workerPayload(result) {
  return parseRenderWallTextVideoPayload({
    assignmentId: "assignment", creativeId: "creative", renderId: "render", projectId: "project", userId: "owner",
    creativeEditId: "edit", creativeEditRevision: 1, title: "Manual Wall", durationSeconds: 6,
    sourceVideoUrl: "https://example.com/source.mp4", text: result.content, layout: result.layout,
    textColor: "#ffffff", audio: { assetDurationSeconds: 6, assetId: "audio", audioUrl: "https://example.com/audio.mp3",
      cueStartSeconds: 0, fadeOutSeconds: 0, fitMode: "exact", matchingVersion: "wall-audio-v1", selectionId: "selection" },
  });
}

test("the supplied tool list retains its exact paragraphs through edit validation, worker parsing, and raster export", async () => {
  const result = await prepare(example);
  assert.equal(result.content.fullText, example);
  const blocks = result.content.finalLayout.blocks;
  assert.equal(blocks.length, 6);
  assert.deepEqual(blocks.slice(1).map(block => block.lines), example.split("\n\n").slice(1).map(line => [line]));
  assert.ok(blocks[0].lines.length > 1, "only the long introduction should wrap");
  assert.deepEqual(blocks.map(block => block.gapAfterPx), [18, 18, 18, 18, 18, 0]);
  const originalBox = createWallTextLayout().textBox;
  assert.ok(result.layout.textBox.height > originalBox.height);
  assert.ok(Math.abs(result.layout.textBox.y + result.layout.textBox.height / 2 -
    (originalBox.y + originalBox.height / 2)) < 0.000001);
  assert.ok(result.layout.textBox.y >= result.layout.safeArea.top);
  assert.ok(result.layout.textBox.y + result.layout.textBox.height <= 1 - result.layout.safeArea.bottom);
  const changed = structuredClone(result.content);
  changed.finalLayout.blocks[1].lines = ["Graphite - a different tool"];
  assert.throws(() => validateWallTextContent(changed, 6), /authoritative manual layout/u);
  const payload = workerPayload(result);
  assert.deepEqual(payload.text.finalLayout, result.content.finalLayout);
  const exported = await prepareWallTextOverlayAsset(payload);
  assert.deepEqual(exported.content.finalLayout.blocks, blocks);
  assert.ok(exported.png.length > 1000);
});

test("one-line phrases, lists, and calls to action do not require AI sentence or word rules", async () => {
  for (const text of ["Graphite - code review", "My tools:\nGraphite\nVercel", "Try my app today", "Works."]) {
    const result = await prepare(text);
    const payload = workerPayload(result);
    const render = buildWallTextRenderLayout({ content: payload.text, textBox: payload.textBox });
    assert.ok(render.blockHeight > 0);
    assert.equal(result.content.fullText, text);
  }
});

test("long manual lines wrap at measured width without merging the next explicit line", async () => {
  const longLine = "Graphite - code review for a team building a new software product with several people";
  const result = await prepare(`${longLine}\nVercel - deployment`);
  const lines = result.content.finalLayout.blocks[0].lines;
  assert.equal(lines.at(-1), "Vercel - deployment");
  assert.equal(lines.slice(0, -1).join(" "), longLine);
  assert.ok(lines.length > 2);
});

test("CRLF, multiple blank lines, and single breaks retain their separate meanings", async () => {
  assert.equal(normalizeWallTextManualCopy(" A\r\nB\r\n\r\n\r\nC "), "A\nB\n\n\nC");
  assert.deepEqual(getWallTextManualBlocks("A\nB\n\n\nC"), [
    { role: "text", lines: ["A", "B"], gapAfterPx: 36 },
    { role: "text", lines: ["C"], gapAfterPx: 0 },
  ]);
  const result = await prepare("Graphite - code review\r\nVercel - deployment\r\n\r\n\r\nSentry - debugging");
  assert.equal(result.content.finalLayout.blocks[0].gapAfterPx, 36);
  assert.deepEqual(workerPayload(result).text.finalLayout, result.content.finalLayout);
});

test("manual edits reject empty, oversized, or unrenderable text without clipping or shrinking", async () => {
  assert.throws(() => validateWallTextManualCopy(" \n "), /empty/u);
  assert.throws(() => validateWallTextManualCopy("x".repeat(601)), /600/u);
  await assert.rejects(() => prepare("Graphite\n".repeat(30)), /does not fit/u);
  await assert.rejects(() => prepare(`Short ${"W".repeat(100)}`), /word that cannot fit/u);
});

test("generated copy retains its complete-sentence rule", async () => {
  const result = await createAuthoritativeWallTextContent({
    content: { kind: "text", text: example }, formatId: "freeform", layout: createWallTextLayout(),
  });
  assert.equal(result.content.finalLayout.textMode, undefined);
  assert.throws(() => validateWallTextContent(result.content, 6), /complete sentence/u);
});

test("color and position changes preserve existing measured copy, rows, and typography", async () => {
  const generated = await createAuthoritativeWallTextContent({
    content: { kind: "text", text: `${example}.` }, formatId: "freeform", layout: createWallTextLayout(),
  });
  for (const previous of [generated, await prepare(example)]) {
    const moved = { ...previous.layout, textBox: { ...previous.layout.textBox, y: previous.layout.textBox.y + 0.01 } };
    const result = await createAuthoritativeWallTextEdit({
      fullText: previous.content.fullText, previousContent: previous.content, formatId: "freeform", layout: moved,
    });
    assert.deepEqual(result.content.finalLayout.blocks, previous.content.finalLayout.blocks);
    assert.equal(result.content.finalLayout.textMode, previous.content.finalLayout.textMode);
    assert.equal(result.content.finalLayout.fontSizePx, previous.content.finalLayout.fontSizePx);
    assert.deepEqual(result.content.finalLayout.textBox, moved.textBox);
    validateWallTextContent(result.content, 6);
    await validateWallTextRenderFit(result.content);
  }
});

test("widening the supplied list reflows the heading to two rows and persists through worker raster export", async () => {
  const previous = await prepare(example);
  const draft = updateWallTextEditBox({ format: "wall_text", version: "trending-creative-edit-v1",
    ...previous, textColor: "#ffffff" }, resizeWallTextEditBox(previous.layout, 0.94));
  assert.equal(draft.content.finalLayout, undefined, "the typing preview must rewrap immediately");
  assert.equal(draft.content.fullText, example);
  assert.equal(draft.layout.safeArea.left, 0.03);
  assert.equal(draft.layout.safeArea.right, 0.03);
  assert.ok(Math.abs(draft.layout.textBox.x - 0.03) < 0.000001);
  const saved = await createAuthoritativeWallTextEdit({
    fullText: draft.content.fullText, previousContent: previous.content, formatId: "freeform", layout: draft.layout,
  });
  validateWallTextContent(saved.content, 6);
  await validateWallTextRenderFit(saved.content);
  assert.equal(previous.content.finalLayout.blocks[0].lines.length, 3);
  assert.equal(saved.content.finalLayout.blocks[0].lines.length, 2);
  assert.deepEqual(saved.content.finalLayout.blocks.slice(1).map(block => block.lines),
    example.split("\n\n").slice(1).map(line => [line]));
  assert.equal(saved.content.finalLayout.fontSizePx, previous.content.finalLayout.fontSizePx);
  const payload = workerPayload(saved);
  assert.equal(payload.textBox.width, 0.94);
  const exported = await prepareWallTextOverlayAsset(payload);
  assert.deepEqual(exported.content.finalLayout.blocks, saved.content.finalLayout.blocks);
  assert.ok(exported.png.length > 1000);
  const narrowed = await prepare(example, { ...draft.layout, textBox: resizeWallTextEditBox(draft.layout, 0.4) });
  assert.ok(narrowed.content.finalLayout.blocks[0].lines.length > 3);
  assert.equal(workerPayload(narrowed).textBox.width, 0.4);
  await prepareWallTextOverlayAsset(workerPayload(narrowed));
  const generated = await createAuthoritativeWallTextContent({
    content: { kind: "text", text: `${example}.` }, formatId: "freeform", layout: createWallTextLayout(),
  });
  const resizedGenerated = await createAuthoritativeWallTextEdit({
    fullText: generated.content.fullText, previousContent: generated.content, formatId: "freeform",
    layout: { ...generated.layout, textBox: resizeWallTextEditBox(generated.layout, 0.94) },
  });
  assert.equal(resizedGenerated.content.finalLayout.textMode, "manual");
  assert.equal(resizedGenerated.content.fullText, generated.content.fullText);
  await prepareWallTextOverlayAsset(workerPayload(resizedGenerated));
});

test("side resizing anchors the opposite edge and movement respects the manual margin", async () => {
  const layout = createWallTextLayout();
  const rightEdge = layout.textBox.x + layout.textBox.width;
  const left = resizeWallTextEditBox(layout, 1, "right");
  assert.ok(Math.abs(left.x - 0.03) < 0.000001);
  assert.ok(Math.abs(left.x + left.width - rightEdge) < 0.000001);
  const right = resizeWallTextEditBox(layout, 1, "left");
  assert.ok(Math.abs(right.x - layout.textBox.x) < 0.000001);
  assert.ok(Math.abs(right.x + right.width - 0.97) < 0.000001);
  const edited = updateWallTextEditBox({ format: "wall_text", version: "trending-creative-edit-v1",
    content: { fullText: example, segments: [] }, layout, textColor: "#ffffff" }, resizeWallTextEditBox(layout, 0.4));
  const moved = moveWallTextEditBox(edited.layout, -1, 2);
  assert.equal(moved.x, 0.03);
  assert.ok(Math.abs(moved.y + moved.height - (1 - layout.safeArea.bottom)) < 0.000001);
  assert.equal(resizeWallTextEditBox(edited.layout, 0).width, 0.4);
});

test("the worker rejects widths or positions outside the manual edit bounds", async () => {
  const result = await prepare("Graphite - code review");
  for (const box of [
    { ...result.layout.textBox, width: 0.39 },
    { ...result.layout.textBox, x: 0.02 },
    { ...result.layout.textBox, x: 0.02, width: 0.96 },
    { ...result.layout.textBox, x: 0.26 },
  ]) {
    const changed = { ...result, layout: { ...result.layout, textBox: box },
      content: { ...result.content, finalLayout: { ...result.content.finalLayout, textBox: box } } };
    assert.throws(() => buildWallTextRenderLayout({ content: changed.content, textBox: box,
      safeArea: { ...changed.layout.safeArea, left: 0, right: 0 } }), /text box|safe area|placement/iu);
  }
});
