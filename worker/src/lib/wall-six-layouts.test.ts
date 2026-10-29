import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../../../lib/explore/reference-text-catalog.json" with { type: "json" };
import { wallTextProfile, initialWallText } from "./wall-initial-text-layout.ts";
import { applyVideoTextRemix } from "../../../lib/explore/remix-text-edit.ts";
import { ReferenceTextSchema } from "../../../lib/explore/reference-text.ts";

for (const n of [45, 49, 52, 56, 57, 58, 62, 63, "652f166f3a7a7a8d", "e95ccc86a8f9ee96", "2fe054f77b9d9549", "f5bc390383e437fb", "c2fbebde7c4f9676", "5286682bcc6952ad","explore-wall-text-0d0039479ef4cca9","explore-wall-text-ec359c870c62a893","explore-wall-text-359cef4971f58d83","explore-wall-text-d5ac739cb19678ff","explore-wall-text-a1616299d8dcc625","explore-wall-text-8d69fa9e5c2f3c3b","explore-paired-wall_text-1d9ddc3d4a768263d88460f0","explore-paired-wall_text-a7691418a6df49c274c4d888","explore-wall-text-10","explore-wall-text-11","explore-wall-text-44","explore-wall-text-47","explore-wall-text-48","explore-wall-text-54","explore-wall-text-60","explore-wall-text-61","explore-wall-text-13","explore-wall-text-42","explore-wall-text-50","explore-wall-text-51","explore-wall-text-55","explore-paired-wall_text-d3259c1239762b2daa319893","explore-paired-wall_text-499cd7912d85e60e54ac54be","explore-paired-wall_text-abb1480dfd075d5c7923b4d6","explore-paired-wall_text-f056193f755c5158c5e8a7c4","explore-wall-text-d496fde4808ff903","explore-wall-text-765ce326c924aaf6","explore-wall-text-dd3e344317913399","explore-wall-text-f02839f347ec57fe","explore-wall-text-0fad669fefb4c9e6","explore-wall-text-e1d5e39019c57edd","explore-wall-text-edcf31d415ad6095","explore-wall-text-186edbf9361266e6","explore-wall-text-5cdc0bf33fa496f7","explore-wall-text-6ef884242109d8db","explore-wall-text-cf2340e8e4407dab","explore-wall-text-1a22e628bb1a4428"]) test(`Wall ${n} actual profile preserves copy, saved edits and full duration`, () => {
  const source = ReferenceTextSchema.parse(catalog.items.find(r => r.referenceId === (String(n).startsWith("explore-") ? n : `explore-wall-text-${n}`)));
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
