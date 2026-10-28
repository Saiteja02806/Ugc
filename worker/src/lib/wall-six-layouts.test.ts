import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../../../lib/explore/reference-text-catalog.json" with { type: "json" };
import { wallTextProfile, initialWallText } from "./wall-initial-text-layout.ts";
import { applyVideoTextRemix } from "../../../lib/explore/remix-text-edit.ts";
import { ReferenceTextSchema } from "../../../lib/explore/reference-text.ts";

for (const n of [45, 49, 52, 56, 57, 58, 62, 63, "652f166f3a7a7a8d", "e95ccc86a8f9ee96", "2fe054f77b9d9549"]) test(`Wall ${n} actual profile preserves copy, saved edits and full duration`, () => {
  const source = ReferenceTextSchema.parse(catalog.items.find(r => r.referenceId === `explore-wall-text-${n}`));
  const profile = wallTextProfile(source.referenceId, source.sourceSha256)!;
  assert.ok(profile);
  assert.equal(wallTextProfile(source.referenceId, "f".repeat(64)), null);
  const longer = source.blocks[0].text + " " + source.blocks[0].text.slice(0, Math.floor(source.blocks[0].text.length * .2));
  try {
    const fitted = initialWallText(longer, profile, 12000);
    assert.equal(fitted.value, longer);
    assert.equal(fitted.endMs, 12000);
  } catch (error) {
    assert.match((error as Error).message, /Review the Wall text's fit/);
  }
  for (const duration of [6000, 12000, 63565]) {
    for (const value of [source.blocks[0].text, "A clear product idea\nshared in your own words."]) {
      const text = initialWallText(value, profile, duration);
      assert.equal(text.value, value); assert.equal(text.endMs, duration);
      const edit = { version: 1 as const, format: "wall_text" as const, trimStartMs: 0, trimEndMs: duration, originalVolume: 1, musicVolume: .2, text: { ...text, width: .72, y: .33 } };
      const result = applyVideoTextRemix(edit, { blocks: [value], heading: "", body: "" }, source);
      assert.equal(result.trimEndMs, duration);
      assert.equal(result.textOverlays![0].width, .72);
      assert.equal(result.textOverlays![0].y, .33);
    }
  }
  assert.throws(() => initialWallText("word ".repeat(1000), profile, 12000), /fit|valid text/);
});
