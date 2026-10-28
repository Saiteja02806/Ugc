import assert from "node:assert/strict";
import { test } from "node:test";
import release from "./explore-wall-money-reference-release.json" with { type: "json" };
import catalog from "../../../lib/explore/reference-text-catalog.json" with { type: "json" };
import { wallTextProfile, initialWallText } from "./wall-initial-text-layout.ts";
import { automaticHookEdit, validateAutomaticHookText, type AutomaticHookTextPlan } from "./automatic-hook-text.ts";
import { formatTextLayout, parseExploreFormatEdit } from "./explore-format-edit.ts";

test("all six measured layouts bind exact sources and preserve full Wall durations and words", () => {
  for (const item of release.items) {
    const source = catalog.items.find(s => s.referenceId === item.id)!;
    const profile = wallTextProfile(item.id, item.videoSha256)!;
    assert.ok(profile); assert.equal(wallTextProfile(item.id, "f".repeat(64)), null);
    for (const duration of [6, 7.067, 12, 30]) {
      const plan = { version: 1, source, wallLayout: profile, promptVersion: 2, businessContext: {} } as unknown as AutomaticHookTextPlan;
      const edit = automaticHookEdit({ blocks: [source.blocks[0].text], heading: "", body: "" }, plan, duration, "9:16");
      assert.equal(edit.format, "wall_text"); assert.equal(edit.trimEndMs, Math.floor(duration * 1000));
      const text = edit.textOverlays![0];
      assert.equal(text.value, source.blocks[0].text); assert.equal(text.startMs, 0); assert.equal(text.endMs, edit.trimEndMs);
      assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
      for (const width of [196, 277, 390, 720, 1080]) {
        const layout = formatTextLayout(text, width, width * 16 / 9);
        assert.equal(layout.fits, true); assert.equal(layout.lines.length, profile.sourceLines);
        assert.ok(layout.textWidth < width * .94);
      }
    }
  }
});

test("unknown references, changed hashes/versions, nonportrait and overflow require review", () => {
  assert.equal(wallTextProfile("unreviewed"), null);
  const profile = wallTextProfile(release.items[0].id)!;
  for (const p of [{ ...profile, sourceSha256: "a".repeat(64) }, { ...profile, version: 2 }, { ...profile, y: .03 }]) {
    assert.throws(() => initialWallText("Copy", p as typeof profile, 6000), /verified/);
  }
  assert.throws(() => initialWallText("Copy", profile, 6000, 1920, 1080), /aspect ratio/);
  assert.throws(() => initialWallText("word ".repeat(120), profile, 6000), /fit/);
});

test("optional line spacing preserves historical defaults without adding fields to old JSON", () => {
  const text = { value: "One\nTwo", width: .6, y: .2, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 6000 };
  const edit = { version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: 6000, originalVolume: 1, musicVolume: .2, text };
  assert.deepEqual(parseExploreFormatEdit(edit).text, text);
  assert.equal(formatTextLayout(text, 1080, 1920).lineHeight, 48 * 1.35);
  for (const lineHeight of [0, .9, 1.6, NaN, "1.2"]) assert.throws(() => parseExploreFormatEdit({ ...edit, text: { ...text, lineHeight } }));
});

test("Wall validation does not impose Hook brevity even when its prompt version increases", () => {
  const value = catalog.items.find(s => s.referenceId === release.items[5].id)!.blocks[0].text;
  const plan = { source: { format: "wall_text", blocks: [{ text: value }] }, promptVersion: 99 } as AutomaticHookTextPlan;
  assert.equal(validateAutomaticHookText({ blocks: [value], heading: "", body: "" }, plan).blocks[0], value);
});

test("reviewed Wall 02 and 05 retain source-specific style and full-length editable text", () => {
  for (const id of ["explore-wall-text-02", "explore-wall-text-05"]) {
    const source = catalog.items.find(item => item.referenceId === id)!;
    const profile = wallTextProfile(id, source.sourceSha256)!;
    assert.ok(profile); assert.equal(wallTextProfile(id, "f".repeat(64)), null);
    const plan = { version: 1, source, wallLayout: profile, promptVersion: 2, businessContext: {} } as unknown as AutomaticHookTextPlan;
    const edit = automaticHookEdit({ blocks: [source.blocks[0].text], heading: "", body: "" }, plan, 12, "9:16");
    const text = edit.textOverlays![0];
    assert.equal(edit.trimEndMs, 12000); assert.equal(text.endMs, 12000); assert.equal(text.value, source.blocks[0].text);
    assert.equal(text.color, id.endsWith("02") ? "#f2c8ec" : "#ffffff");
    for (const width of [196, 390, 720, 1080]) {
      const layout = formatTextLayout(text, width, width * 16 / 9);
      assert.equal(layout.fits, true); assert.equal(layout.lines.length, profile.sourceLines);
    }
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
    for (const candidate of ["A short\neditable thought", "A longer idea\nthat keeps the words\nin a readable block\nwithout losing details."]) {
      const generated = automaticHookEdit({ blocks: [candidate], heading: "", body: "" }, plan, 12, "9:16");
      assert.equal(generated.textOverlays![0].value, candidate);
      assert.equal(generated.textOverlays![0].endMs, 12000);
      assert.equal(formatTextLayout(generated.textOverlays![0], 720, 1280).fits, true);
    }
  }
});

test("Wall 03 uses a condensed list profile without losing source wording or full duration",()=>{
 const source=catalog.items.find(item=>item.referenceId==="explore-wall-text-03")!, profile=wallTextProfile(source.referenceId,source.sourceSha256)!;
 const text=initialWallText(source.blocks[0].text,profile,12000);
 assert.equal(text.value,source.blocks[0].text);assert.equal(text.font,"robotocondensed");assert.equal(text.fontWeight,400);assert.equal(text.endMs,12000);
 assert.equal(formatTextLayout(text,1080,1920).lines.length,15);
});

test("Wall 04 preserves the complete source heading and body in the measured regions",()=>{
 const source=catalog.items.find(item=>item.referenceId==="explore-wall-text-04")!,profile=wallTextProfile(source.referenceId,source.sourceSha256)!;
 const [heading,...body]=source.blocks[0].text.split("\n\n");
 const plan={source,wallLayout:profile,promptVersion:2,businessContext:{}} as unknown as AutomaticHookTextPlan;
 const edit=automaticHookEdit({blocks:[],heading,body:body.join("\n\n")},plan,12,"9:16");
 assert.equal(edit.textOverlays!.map(t=>t.value).join("\n\n"),source.blocks[0].text);
 assert.deepEqual(edit.textOverlays!.map(t=>formatTextLayout(t,1080,1920).lines.length),[1,23]);
});

test("Wall 07 uses its source-bound dense overlay and preserves editable words and full duration", () => {
  const source = catalog.items.find(item => item.referenceId === "explore-wall-text-07")!;
  const profile = wallTextProfile(source.referenceId, source.sourceSha256)!;
  assert.ok(profile);
  assert.equal(wallTextProfile(source.referenceId, "f".repeat(64)), null);
  const plan = { source, wallLayout: profile, promptVersion: 2, businessContext: {} } as unknown as AutomaticHookTextPlan;
  for (const value of [source.blocks[0].text, "A new idea\nthat stays editable\nthroughout the video."]) {
    const edit = automaticHookEdit({ blocks: [value], heading: "", body: "" }, plan, 13, "9:16");
    const text = edit.textOverlays![0];
    assert.equal(text.value, value);
    assert.equal(text.startMs, 0);
    assert.equal(text.endMs, 13000);
    assert.equal(edit.trimEndMs, 13000);
    assert.equal(formatTextLayout(text, 720, 1280).fits, true);
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
  }
  assert.throws(() => initialWallText("word ".repeat(200), profile, 13000), /fit/);
});

test("reviewed Wall profiles preserve reference structure, full duration, and reject unknown sources", () => {
  for (const id of ["explore-wall-text-12", "explore-wall-text-14", "explore-wall-text-15", "explore-wall-text-16", "explore-wall-text-17", "explore-wall-text-18", "explore-wall-text-19", "explore-wall-text-20", "explore-wall-text-22", "explore-wall-text-23", "explore-wall-text-24", "explore-wall-text-25", "explore-wall-text-26", "explore-wall-text-29", "explore-wall-text-30", "explore-wall-text-31", "explore-wall-text-32", "explore-wall-text-33", "explore-wall-text-34", "explore-wall-text-35", "explore-wall-text-36", "explore-wall-text-38", "explore-wall-text-39", "explore-wall-text-40", "explore-wall-text-41"]) {
    const source = catalog.items.find(item => item.referenceId === id)!;
    const profile = wallTextProfile(id, source.sourceSha256)!;
    assert.ok(profile);
    assert.equal(wallTextProfile(id, "f".repeat(64)), null);
    const plan = { source, wallLayout: profile, promptVersion: 2, businessContext: {} } as unknown as AutomaticHookTextPlan;
    for (const value of [source.blocks[0].text, "An editable idea\nfor this video\nthat retains its words."]) {
      const edit = automaticHookEdit({ blocks: [value], heading: "", body: "" }, plan, 15, "9:16");
      const text = edit.textOverlays![0];
      assert.equal(text.value, value);
      assert.equal(edit.trimEndMs, 15000);
      assert.equal(text.startMs, 0);
      assert.equal(text.endMs, 15000);
      assert.equal(formatTextLayout(text, 720, 1280).fits, true);
      assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))), edit);
    }
    assert.throws(() => initialWallText("word ".repeat(200), profile, 15000), /fit|valid text/);
  }
});
