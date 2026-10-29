import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import catalog from "../lib/explore/reference-text-catalog.json" with { type: "json" };
import { wallTextProfile, initialWallText, initialWallRegions, initialWallHeadingBody } from "../worker/src/lib/wall-initial-text-layout.ts";
import { formatTextLayout, parseExploreFormatEdit, createFormatTextSvg } from "../worker/src/lib/explore-format-edit.ts";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";
import { ReferenceTextSchema } from "../lib/explore/reference-text.ts";

const inventory = JSON.parse(fs.readFileSync("outputs/wall-layout-batch-20261028/all-source-review-inventory.json", "utf8")) as { id: string; sha256: string; duration: number }[];
const excluded = new Set(["06", "08", "09", "21", "28", "59"].map(n => `explore-wall-text-${n}`));
const applicable = inventory.filter(item => !excluded.has(item.id));
test("review scope accounts for every source without restoring retired references", () => assert.equal(applicable.length, 97));
for (const item of applicable) test(`${item.id}: source-bound layout, full duration and preserved saved edits`, () => {
  const source = ReferenceTextSchema.parse(catalog.items.find(row => row.referenceId === item.id));
  const profile = wallTextProfile(item.id, item.sha256);
  assert.ok(profile, `Missing reviewed layout: ${item.id}`);
  assert.equal(wallTextProfile(item.id, "0".repeat(64)), null);
  const words = source.blocks[0].text;
  const duration = Math.round(item.duration * 1000);
  const init = (value: string) => profile.regions ? initialWallRegions(value, profile, duration) : profile.structure ? (() => {
    const [heading, ...body] = value.split("\n");
    return initialWallHeadingBody(heading, body.join("\n").trim(), profile, duration, 1);
  })() : [initialWallText(value, profile, duration)];
  const layers = init(words);
  assert.equal(layers.map(layer => layer.value).join("\n\n").replace(/\s+/gu, " ").trim(), words.replace(/\s+/gu, " ").trim());
  for (const layer of layers) {
    assert.equal(layer.startMs, 0); assert.equal(layer.endMs, duration);
    assert.ok(formatTextLayout(layer, 1080, 1920).fits);
    if (layer.boxColor) assert.ok(createFormatTextSvg(layer, 1080, 1920).includes(`fill="${layer.boxColor}"`));
  }
  const edit = parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: duration, originalVolume: 1, musicVolume: .2, text: null, textOverlays: layers });
  assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
  const saved = { ...edit, textOverlays: edit.textOverlays!.map(layer => ({ ...layer, width: .72, y: .33 })) };
  const remixed = applyVideoTextRemix(saved, { blocks: [words], heading: "", body: "" }, source);
  assert.equal(remixed.trimEndMs, duration);
  assert.equal(remixed.textOverlays![0].width, .72);
  assert.equal(remixed.textOverlays![0].y, .33);
  assert.equal(remixed.textOverlays!.length, saved.textOverlays.length);
  assert.ok(remixed.textOverlays!.every(layer => layer.width === .72 && layer.y === .33));
  const blank = { ...edit, text: null, textOverlays: [] };
  const manual = applyVideoTextRemix(blank, { blocks: [words], heading: "", body: "" }, source);
  assert.equal(manual.textOverlays!.length, layers.length);
  assert.deepEqual(manual.textOverlays!.map(layer => layer.value), layers.map(layer => layer.value));
  if (profile.regions) {
    const originalY = profile.regions[0].y;
    profile.regions[0].y = .9;
    assert.equal(wallTextProfile(item.id, item.sha256)!.regions![0].y, originalY, "Caller mutations cannot change catalogue measurements");
    profile.regions[0].y = originalY;
  }
  if (profile.regions) assert.throws(() => init("One paragraph with the wrong structure"), /separate regions/);
});
