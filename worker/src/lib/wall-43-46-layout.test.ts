import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../../lib/explore/reference-text-catalog.json" with { type: "json" };
import { wallTextProfile, initialWallText } from "./wall-initial-text-layout.ts";
import { automaticHookEdit, type AutomaticHookTextPlan } from "./automatic-hook-text.ts";
import { formatTextLayout, parseExploreFormatEdit } from "./explore-format-edit.ts";

test("Wall 43 and 46 bind their source and keep editable text for the full duration", () => {
  for (const id of ["explore-wall-text-43", "explore-wall-text-46"]) {
    const source = catalog.items.find(item => item.referenceId === id)!;
    const profile = wallTextProfile(id, source.sourceSha256)!;
    assert.ok(profile);
    assert.equal(wallTextProfile(id, "f".repeat(64)), null);
    const plan = { source, wallLayout: profile, promptVersion: 2, businessContext: {} } as unknown as AutomaticHookTextPlan;
    for (const value of [source.blocks[0].text, "A simple idea\nfor your business\nthat stays editable"]) {
      const edit = automaticHookEdit({ blocks: [value], heading: "", body: "" }, plan, 15, "9:16");
      const text = edit.textOverlays![0];
      assert.equal(text.value, value);
      assert.equal(text.endMs, 15000);
      assert.equal(edit.trimEndMs, 15000);
      assert.equal(formatTextLayout(text, 720, 1280).fits, true);
      assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
    }
    assert.throws(() => initialWallText("word ".repeat(200), profile, 15000), /fit|valid text/);
  }
});
