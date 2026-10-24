import assert from "node:assert/strict";
import test from "node:test";
import catalog from "./reference-text-catalog.json" with { type: "json" };
import { ReferenceTextSchema } from "./reference-text.ts";
import { hookRemixResult, hookRemixSource, repairHookRemixEdit } from "./hook-remix-source.ts";
import { remixInputSource } from "./remix-text-input.ts";
import { applyVideoTextRemix } from "./remix-text-edit.ts";
import { clipPreviewTextTimeMs } from "./clip-preview-time.ts";
import type { ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

const currentSource = ReferenceTextSchema.parse(catalog.items.find(item => item.referenceId === "explore-paired-hook-4585ee949081c4e5cd835cd3"));
// Immutable pre-trim receipt: the live catalogue now contains only the kept
// footage, so it cannot serve as the historical two-block input for recovery.
const source = ReferenceTextSchema.parse({ ...currentSource, blocks: [
  { ...currentSource.blocks[0], startMs: 0, endMs: 3067 },
  { text: "Legacy screen-cut caption", startMs: 3067, endMs: 3100 },
] });
const output = { blocks: ["SaaS founders!!\nThis app is a game changer", "I used to think marketing my SaaS\nwould take so much time"], heading: "", body: "" };
const blank: ExploreFormatEdit = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3167, originalVolume: 1, musicVolume: .2, text: null };
const style = { width: .84, y: .18, fontSize: 72, color: "#ffffff", font: "inter" as const, fontWeight: 700 as const };
const legacy: ExploreFormatEdit = { ...blank, textOverlays: [
  { ...style, value: output.blocks[0], startMs: 0, endMs: 3133 },
  { ...style, fontSize: 48, value: output.blocks[1], startMs: 3133, endMs: 3167 },
] };

test("reviewed one-frame screen-cut captions stay in the transcript but not the Hook remix", () => {
  const snapshot = structuredClone(source), next = hookRemixSource(source);
  assert.deepEqual(next.blocks, [{ ...source.blocks[0], endMs: 3100 }]);
  assert.deepEqual(source, snapshot);
  assert.equal(hookRemixSource(next), next);
  const second = ReferenceTextSchema.parse(catalog.items.find(item => item.referenceId === "explore-paired-hook-7c53cba88343579e7e15c8b0"));
  assert.equal(hookRemixSource(second).blocks.length, 1);
});

test("new requests omit inherited tail text, including requests from older clients", () => {
  const request = { requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, format: "hook" as const, instructions: "" };
  for (const referenceBlocks of [undefined, source.blocks.map(block => block.text), [source.blocks[0].text]]) {
    const next = remixInputSource({ ...request, referenceBlocks }, source);
    assert.deepEqual(next.blocks, [{ ...source.blocks[0], endMs: 3100 }]);
  }
  const authored = remixInputSource({ ...request, referenceBlocks: ["My opening", "My intentional second caption"] }, source);
  assert.equal(authored.blocks.length, 2, "User-authored sequences are retained");
});

test("recovering and applying an old paid remix removes the tail without changing the receipt", () => {
  const before = structuredClone({ source, output });
  const recovered = hookRemixResult(output, source);
  assert.deepEqual(recovered.output.blocks, [output.blocks[0]]);
  const applied = applyVideoTextRemix(blank, output, source);
  assert.deepEqual(applied.textOverlays?.map(({ value, startMs, endMs }) => ({ value, startMs, endMs })),
    [{ value: output.blocks[0], startMs: 0, endMs: 3167 }]);
  assert.deepEqual({ source, output }, before);
});

test("old clip drafts retain custom main copy, font, weight, size, position and audio through the ending", () => {
  const customized = { ...legacy, textOverlays: legacy.textOverlays!.map((block, index) => index ? block : { ...block, value: "My edited hook", y: .25, color: "#ff00ff" }) };
  const repaired = repairHookRemixEdit(customized, source.referenceId);
  assert.deepEqual(repaired.textOverlays, [{ ...customized.textOverlays[0], endMs: 3167 }]);
  assert.equal(repaired.originalVolume, 1); assert.equal(repaired.musicVolume, .2);
  assert.equal(repairHookRemixEdit(repaired, source.referenceId), repaired);
  const reapplied = applyVideoTextRemix(customized, output, source);
  assert.deepEqual(reapplied.textOverlays, [{ ...repaired.textOverlays![0], value: output.blocks[0] }]);
});

test("unknown references, revised timings, Wall text and intentional short overlays are not removed", () => {
  for (const other of [{ ...source, referenceId: "other-hook" }, { ...source, format: "wall_text" as const },
    { ...source, blocks: [source.blocks[0], { ...source.blocks[1], endMs: 4000 }] }]) assert.equal(hookRemixSource(other), other);
  assert.equal(repairHookRemixEdit(legacy, "other-hook"), legacy);
  const manual = { ...legacy, textOverlays: [{ ...legacy.textOverlays![0], endMs: 3000 }, { ...legacy.textOverlays![1], startMs: 3000 }] };
  assert.equal(repairHookRemixEdit(manual, source.referenceId), manual);
});

test("the chosen caption and exact typography remain stable before and at the paused 3.2s endpoint", () => {
  const repaired = repairHookRemixEdit(legacy, source.referenceId);
  for (const time of [0, 3100, 3133, 3166, 3167]) {
    const previewTime = clipPreviewTextTimeMs(time, 3167);
    const visible = repaired.textOverlays!.filter(text => previewTime >= text.startMs && previewTime < text.endMs);
    assert.equal(visible.length, 1); assert.equal(visible[0].value, output.blocks[0]); assert.equal(visible[0].fontSize, 72);
  }
  const timed = { ...repaired.textOverlays![0], endMs: 3000 };
  assert.equal(clipPreviewTextTimeMs(3167, 3167) < timed.endMs, false, "An intentionally early end stays hidden");
});
