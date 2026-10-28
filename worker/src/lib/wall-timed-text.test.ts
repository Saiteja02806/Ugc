import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../../lib/explore/reference-text-catalog.json" with { type: "json" };
import { parseExploreFormatEdit } from "./explore-format-edit.ts";
import { buildTimedWallEdit, type WallTimedLayout } from "./wall-timed-text.ts";

const source = catalog.items.find(item => item.referenceId === "explore-wall-text-21")!;
const positions = [.45, .59, .76, .56, .59, .48, .48, .48, .48, .70];
const layout: WallTimedLayout = { version: 1, referenceId: source.referenceId, sourceSha256: source.sourceSha256,
  sourceDurationMs: 11353, blocks: source.blocks.map((block, i) => ({ startMs: block.startMs!, endMs: block.endMs!, y: positions[i], width: .84, fontSize: 48, lineHeight: 1.2, outlineWidth: 8 })) };
const words = source.blocks.map(block => block.text);

test("Wall 21 timed prototype retains every word, position, timing, tail and full duration", () => {
  for (const duration of [6000, 11353, 15000]) {
    const edit = buildTimedWallEdit(layout, source, words, duration);
    assert.equal(edit.trimStartMs, 0); assert.equal(edit.trimEndMs, duration);
    assert.equal(edit.textOverlays!.length, 10);
    edit.textOverlays!.forEach((text, i) => {
      assert.equal(text.value, words[i]); assert.equal(text.y, positions[i]);
      assert.equal(text.startMs, Math.round(layout.blocks[i].startMs / 11353 * duration));
      assert.equal(text.endMs, Math.round(layout.blocks[i].endMs / 11353 * duration));
    });
    assert.ok(edit.textOverlays!.at(-1)!.endMs < duration);
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
  }
});

test("timed prototype rejects different source, changed intervals, missing output, overlap and overflow", () => {
  assert.throws(() => buildTimedWallEdit(layout, { ...source, sourceSha256: "f".repeat(64) }, words, 11353));
  assert.throws(() => buildTimedWallEdit(layout, { ...source, blocks: source.blocks.map((b, i) => i === 2 ? { ...b, startMs: 3934 } : b) }, words, 11353));
  assert.throws(() => buildTimedWallEdit(layout, source, words.slice(1), 11353));
  const overlap = { ...layout, blocks: layout.blocks.map((b, i) => i === 1 ? { ...b, startMs: 1 } : b) };
  assert.throws(() => buildTimedWallEdit(overlap, source, words, 11353));
  assert.throws(() => buildTimedWallEdit(layout, source, ["word\n".repeat(200), ...words.slice(1)], 11353));
});
