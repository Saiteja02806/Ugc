import assert from "node:assert/strict";
import test from "node:test";
import { parseExploreFormatEdit, formatTextLayout, formatTextLineRuns, createFormatTextSvg, applyFormatTextPreset } from "../worker/src/lib/explore-format-edit.ts";
import { wallTextProfile, initialWallText } from "../worker/src/lib/wall-initial-text-layout.ts";
import catalog from "../lib/explore/reference-text-catalog.json" with { type: "json" };
test("left Wall text retains alignment through persistence and preview line positions", () => {
  for (const suffix of ["952c9e951086145c", "d2a11374187469b8f8baee61"]) {
    const source = catalog.items.find(r => r.referenceId.endsWith(suffix))!;
    const profile = wallTextProfile(source.referenceId, source.sourceSha256)!;
    const text = initialWallText(source.blocks[0].text, profile, 12000);
    const layout = formatTextLayout(text, 1080, 1920);
    const origins = layout.lines.filter(Boolean).map(line => formatTextLineRuns(line, text, layout)[0].x);
    assert.ok(origins.every(x => Math.abs(x - origins[0]) < .001));
    assert.match(createFormatTextSvg(text, 1080, 1920), /text-anchor="start"/);
    const edit = { version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: 12000, originalVolume: 1, musicVolume: .2, text };
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
  }
});
test("long Wall copy remains editable while Hook retains its existing limit", () => {
  const text = { value: "a".repeat(601), width: .8, y: .2, fontSize: 30, color: "#ffffff", startMs: 0, endMs: 12000 };
  const edit = { version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: 12000, originalVolume: 1, musicVolume: .2, text };
  assert.equal(parseExploreFormatEdit(edit).text!.value, text.value);
  assert.throws(() => parseExploreFormatEdit({ ...edit, format: "hook" }));
  assert.throws(() => parseExploreFormatEdit({ ...edit, text: { ...text, align: "right" } }));
});

test("source text boxes roundtrip and explicit preset changes replace their appearance", () => {
  const text = { value: "A clear heading", width: .6, y: .2, fontSize: 48, color: "#000000", boxColor: "#ffffff", startMs: 0, endMs: 12000 };
  const edit = { version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: 12000, originalVolume: 1, musicVolume: .2, text };
  assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
  const layout = formatTextLayout(text, 1080, 1920);
  assert.ok(layout.background!.width < 1080);
  assert.match(createFormatTextSvg(text, 1080, 1920), /fill="#ffffff"/);
  assert.equal(applyFormatTextPreset(text, "bold").boxColor, undefined);
  assert.equal(applyFormatTextPreset(text, "snapchat-classic").boxColor, undefined);
  assert.throws(() => parseExploreFormatEdit({ ...edit, text: { ...text, boxColor: "invalid" } }));
});
