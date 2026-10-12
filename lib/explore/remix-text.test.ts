import assert from "node:assert/strict";
import test from "node:test";
import { ReferenceTextSchema, validateRemixDraft, validateRemixOutput, type ReferenceText } from "./reference-text.ts";
import { applyVideoTextRemix } from "./remix-text-edit.ts";
import { readRemixTextDraft } from "./remix-text-draft.ts";
import { remixTextPrompt } from "./remix-text-prompt.ts";
import { remixInputSource } from "./remix-text-input.ts";
import { parseExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

const source: ReferenceText = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "The first hook\nwith two lines", startMs: 0, endMs: 2000 }, { text: "The second hook", startMs: 3000, endMs: 4000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
const output = { blocks: ["Our first hook\nwith two lines", "Our second hook"], heading: "", body: "" };

test("applying a remix changes only copy on existing overlays and scales new timing", () => {
  const original = parseExploreFormatEdit({ version: 1, format: "hook", trimStartMs: 1000, trimEndMs: 9000, originalVolume: .2, musicVolume: .7, text: { value: "User draft", width: .6, y: .5, fontSize: 60, color: "#ff00ff", startMs: 100, endMs: 1500 } });
  const result = applyVideoTextRemix(original, output, source);
  assert.equal(original.text?.value, "User draft", "input is never mutated");
  assert.deepEqual(result.textOverlays?.[0], { ...original.text, value: output.blocks[0] });
  assert.equal(result.textOverlays?.[1].startMs, 6000); assert.equal(result.textOverlays?.[1].endMs, 8000);
  assert.equal(result.trimStartMs, 1000); assert.equal(result.originalVolume, .2); assert.equal(result.musicVolume, .7);
  assert.throws(() => applyVideoTextRemix({ ...original, format: "wall_text" }, output, source));
});
test("invalid, empty, overlong and cross-format output cannot enter the editor", () => {
  for (const value of [{ ...output, blocks: ["Only one"] }, { ...output, heading: "Unexpected" }, { ...output, blocks: ["", "second"] }, { ...output, blocks: ["x".repeat(100), "y".repeat(100)] }, { ...output, blocks: ["bad\u0001copy", "second"] }]) assert.throws(() => validateRemixOutput(value, source));
  const slide = { ...source, slideId: "slide-1", format: "slideshow" as const, blocks: [{ text: "Original heading\nOriginal body", startMs: null, endMs: null }] };
  assert.throws(() => validateRemixOutput(output, slide));
  assert.deepEqual(validateRemixOutput({ blocks: [], heading: "New heading", body: "New body" }, slide), { blocks: [], heading: "New heading", body: "New body" });
  assert.throws(() => ReferenceTextSchema.parse({ ...source, slideId: "wrong-slide" }));
});

test("a user can expand the generated draft while preserving editor bounds and their chosen preset", () => {
  const expanded = { ...output, blocks: ["a".repeat(150), "b".repeat(150)] };
  assert.throws(() => validateRemixOutput(expanded, source), /too long/);
  assert.deepEqual(validateRemixDraft(expanded, source), expanded);
  assert.throws(() => validateRemixDraft({ ...expanded, blocks: ["a".repeat(601), "b"] }, source));
  const original = parseExploreFormatEdit({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 8000, originalVolume: .2, musicVolume: .7,
    text: { value: "User draft", width: .94, y: .075, fontSize: 56, color: "#ffffff", startMs: 0, endMs: 2000, preset: "snapchat-classic", backgroundOpacity: .4 } });
  const result = applyVideoTextRemix(original, expanded, source);
  assert.ok(result.textOverlays);
  assert.equal(result.textOverlays[0].value, expanded.blocks[0]);
  assert.equal(result.textOverlays[1].preset, "snapchat-classic");
  assert.equal(result.textOverlays[1].backgroundOpacity, .4);
  assert.equal(result.textOverlays[1].startMs, 6000);
});
test("recovery state validates identities and preserves the original request exactly", () => {
  const draft = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, instructions: "Keep the opening", outcome: "uncertain" };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(draft)), draft);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...draft, requestKey: "invalid" })), null);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...draft, businessContext: "foreign client data" })), null);
  assert.equal(readRemixTextDraft("{broken"), null);
  assert.equal(readRemixTextDraft("x".repeat(64001)), null);
});

test("editable prose keeps reference timing, while a custom idea is scoped to one clip", () => {
  const request = { requestKey: "00000000-0000-4000-8000-000000000001", referenceId: "hook-a", slideId: null, format: "hook" as const, instructions: "", referenceBlocks: ["A single revised opening for our business"] };
  const edited = remixInputSource(request, source);
  assert.deepEqual(edited.blocks, [{ text: request.referenceBlocks[0], startMs: 0, endMs: 4000 }]);
  assert.equal(edited.referenceId, source.referenceId); assert.notEqual(edited.sourceSha256, source.sourceSha256);
  const unchanged = remixInputSource({ ...request, referenceBlocks: source.blocks.map(block => block.text) }, source);
  assert.deepEqual(unchanged.blocks.map(({ startMs, endMs }) => ({ startMs, endMs })), source.blocks.map(({ startMs, endMs }) => ({ startMs, endMs })));
  const custom = remixInputSource({ ...request, referenceId: null }, null);
  assert.equal(custom.referenceId, "manual:hook"); assert.equal(custom.blocks.length, 1);
  assert.throws(() => remixInputSource({ ...request, referenceId: null, referenceBlocks: undefined }, null));
  assert.throws(() => remixInputSource({ ...request, format: "wall_text" }, source));
});

test("a reviewed draft survives reloads, including unfinished edits, without changing the source identity", () => {
  const saved = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, format: "hook", instructions: "", referenceBlocks: source.blocks.map(block => block.text), outcome: "completed", source, reviewedDraft: output };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(saved)), saved);
  const unfinished = { ...saved, reviewedDraft: { ...output, blocks: ["", "Still editing"] } };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(unfinished)), unfinished);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, source: { ...source, referenceId: "other-hook" } })), null);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, reviewedDraft: { ...output, blocks: ["Wrong block count"] } })), null);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, source: undefined })), null);
});
test("provider payload includes verbatim source blocks and server business facts", () => {
  const context = { businessName: "Acme", productSummary: "Helpful product" };
  assert.deepEqual(JSON.parse(remixTextPrompt(source, context, "Keep the structure")), { format: "hook", referenceText: source.blocks.map(b => b.text), businessContext: context, additionalInstructions: "Keep the structure" });
});
