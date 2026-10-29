import assert from "node:assert/strict";
import test from "node:test";
import catalog from "./reference-text-catalog.json" with { type: "json" };
import { ReferenceTextSchema, validateRemixDraft, validateRemixOutput } from "./reference-text.ts";
import { applyVideoTextRemix } from "./remix-text-edit.ts";
import { readRemixTextDraft } from "./remix-text-draft.ts";
import { parseExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { readFormatEditDraft, prepareFormatEditForExport } from "./format-edit-draft.ts";

const source = ReferenceTextSchema.parse(catalog.items.find(item => item.referenceId === "explore-wall-text-04"));
const output = { blocks: [], heading: "A new heading", body: "First body paragraph.\n\nSecond body paragraph." };
const edit = parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 500, trimEndMs: 8500, originalVolume: .4, musicVolume: .7, text: null });

test("manual structured Wall fields validate and apply without inferring the boundary from body paragraphs", () => {
  assert.deepEqual(validateRemixOutput(output, source), output);
  const applied = applyVideoTextRemix(edit, output, source);
  assert.deepEqual(applied.textOverlays!.map(layer => layer.value), [output.heading, output.body]);
  assert.equal(applied.trimStartMs, 500); assert.equal(applied.trimEndMs, 8500);
  assert.equal(applied.originalVolume, .4); assert.equal(applied.musicVolume, .7);
  assert.ok(applied.textOverlays!.every(layer => layer.startMs === 0 && layer.endMs === 8000));
  const saved = { ...applied, textOverlays: applied.textOverlays!.map((layer, i) => ({ ...layer, y: .15 + i * .3, width: .6, fontSize: 30 })) };
  const reapplied = applyVideoTextRemix(saved, { ...output, heading: "Edited heading" }, source);
  assert.deepEqual(reapplied.textOverlays, saved.textOverlays!.map((layer, i) => ({ ...layer, value: i === 0 ? "Edited heading" : output.body })));
  const single = { ...applied, textOverlays: [saved.textOverlays![0]] };
  assert.deepEqual(applyVideoTextRemix(single, output, source).textOverlays, [{ ...single.textOverlays[0], value: `${output.heading}\n\n${output.body}` }]);
  assert.throws(() => validateRemixOutput({ ...output, body: "x".repeat(700) }, source), /too long/);
});

test("legacy Wall block outputs and unfinished structured drafts survive reload without rewriting their content", () => {
  const legacy = { blocks: source.blocks.map(block => block.text), heading: "", body: "" };
  assert.deepEqual(validateRemixOutput(legacy, source), legacy);
  assert.equal(applyVideoTextRemix(edit, legacy, source).textOverlays!.length, 2);
  const receipt = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, format: "wall_text", instructions: "", outcome: "completed", source };
  for (const reviewedDraft of [legacy, output, { ...output, heading: "", body: "" }, { ...output, body: "x".repeat(6000) }]) {
    assert.deepEqual(readRemixTextDraft(JSON.stringify({ ...receipt, reviewedDraft }))?.reviewedDraft, reviewedDraft);
  }
  assert.throws(() => validateRemixDraft({ ...output, heading: "" }, source));
  assert.throws(() => validateRemixDraft({ ...output, body: "" }, source));
  assert.throws(() => validateRemixDraft({ ...output, body: "x".repeat(6001) }, source));
});

test("structured Wall data cannot reinterpret another reference, stale hash or another format", () => {
  for (const other of [{ ...source, sourceSha256: "f".repeat(64) }, { ...source, referenceId: "unknown-wall" }, { ...source, format: "hook" as const }]) {
    assert.throws(() => validateRemixDraft(output, other));
  }
  const slide = { ...source, format: "slideshow" as const, slideId: "slide-1", blocks: [{ text: "Slide copy", startMs: null, endMs: null }] };
  assert.throws(() => validateRemixDraft({ ...output, body: "x".repeat(601) }, slide));
});

test("structured manual review survives saved-edit roundtrip and export while empty draft layers remain recoverable", () => {
  const applied = applyVideoTextRemix(edit, validateRemixOutput(output, source), source);
  const reopened = readFormatEditDraft(JSON.parse(JSON.stringify(applied)));
  assert.deepEqual(reopened, applied);
  assert.deepEqual(prepareFormatEditForExport(reopened), applied);
  const unfinished = { ...reopened, textOverlays: reopened.textOverlays!.map(layer => ({ ...layer, value: "" })) };
  const recovered = readFormatEditDraft(JSON.parse(JSON.stringify(unfinished)));
  assert.deepEqual(recovered, unfinished);
  assert.equal(prepareFormatEditForExport(recovered).textOverlays, undefined);
  assert.deepEqual(recovered, unfinished, "Export preparation never erases the saved empty draft");
});
