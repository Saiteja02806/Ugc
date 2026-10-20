import assert from "node:assert/strict";
import test from "node:test";
import { getSubtitleLayout, serializeAss } from "./captions.js";
import { type TimedWord } from "./contracts.js";
import { groupSerifBoxWords, serifBoxAnchor, serializeSerifBoxAss } from "./serif-box.js";

const layout = getSubtitleLayout(720, 1280, "serif-box");
const word = (text: string, startMs: number, endMs: number): TimedWord => ({ text, startMs, endMs });
const measure = async (text: string) => ({ left: 2, top: 8, width: text.length * 12, height: 32 });

test("serif labels preserve sentence case and real timings in measured single-line phrases", async () => {
  const words = [word("Security", 100, 400), word("researchers", 400, 700), word("use", 700, 900), word("powerful", 900, 1200),
    word("prompts,", 1200, 1500), word("then", 1600, 1800), word("pause.", 1800, 2000), word("Next", 2700, 2900)];
  const before = structuredClone(words);
  const cues = await groupSerifBoxWords(words, layout, measure);
  assert.deepEqual(words, before); assert.deepEqual(cues.flatMap(cue => cue.words), before);
  for (const cue of cues) {
    assert.equal(cue.lines.length, 1); assert.ok(cue.words.length <= 6);
    assert.equal(cue.startMs, cue.words[0].startMs); assert.equal(cue.endMs, cue.words.at(-1)!.endMs);
    assert.ok(cue.endMs - cue.startMs <= 2800);
  }
  assert.equal(cues.at(-2)!.endMs, 2000); assert.equal(cues.at(-1)!.startMs, 2700);
});

test("the reference five-word phrase stays together instead of revealing separate small chunks", async () => {
  const words = [word("And", 0, 100), word("if", 170, 250), word("you", 300, 420), word("use", 530, 770), word("this", 860, 1040)];
  const cues = await groupSerifBoxWords(words, layout, measure);
  assert.equal(cues.length, 1); assert.deepEqual(cues[0].words, words);
});

test("short labels split at measured width instead of turning into two-line sentences", async () => {
  const narrow = { ...layout, maxLineWidth: 125 };
  const words = [word("Longer", 0, 300), word("words", 300, 600), word("fit.", 600, 900)];
  const cues = await groupSerifBoxWords(words, narrow, measure);
  assert.deepEqual(cues.flatMap(cue => cue.words), words);
  assert.ok(cues.every(cue => cue.lines.length === 1));
  await assert.rejects(groupSerifBoxWords([word("UnbreakablyLongWord", 0, 300)], narrow, measure), { code: "TEXT_DOES_NOT_FIT" });
});

test("Instrument Serif words reveal grey to white inside one fixed opaque rounded box", async () => {
  const cues = await groupSerifBoxWords([word("Security", 100, 500), word("researchers", 500, 900)], layout, measure);
  for (const placement of ["bottom", "middle", "top"] as const) {
    const ass = await serializeSerifBoxAss(cues, layout, placement, measure);
    assert.match(ass, /Style: Caption,Instrument Serif,61,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,0.3,0/);
    const events = ass.split("\n").filter(line => line.startsWith("Dialogue:"));
    assert.equal(events.length, 2);
    assert.ok(events.every(line => line.includes("0:00:00.10,0:00:00.90")));
    assert.match(events[0], /\\p1\\c&H000000&\\bord0\\shad0.* b /);
    assert.match(events[1], /\\c&H555555&\\3c&H555555&\\t\(0,240,2,\\c&HFFFFFF&\\3c&HFFFFFF&\)\}Security/);
    assert.match(events[1], /\\t\(400,640,2,\\c&HFFFFFF&\\3c&HFFFFFF&\)\}researchers$/);
    assert.doesNotMatch(events[1], /\\(?:k|K|kf|fad|fscx|fscy|b1|i1|N|clip)/);
    const position = events[0].match(/\\pos\(([-\d.]+),([-\d.]+)\)/)!;
    const width = (await measure("Security researchers")).width + 30, height = 86;
    assert.equal(Number(position[1]) + width / 2, 360);
    assert.equal(Number(position[2]) + height / 2, Math.round(1280 * serifBoxAnchor(placement)));
  }
  assert.throws(() => serializeAss(cues, layout, "serif-box", "bottom"), { code: "SERIF_BOX_PLANNER_REQUIRED" });
});

test("reveal windows use each supplied word interval and freeze across a short pause", async () => {
  const cues = await groupSerifBoxWords([word("Keep", 100, 160), word("your", 360, 440), word("story", 440, 700)], layout, measure);
  const ass = await serializeSerifBoxAss(cues, layout, "bottom", measure);
  assert.match(ass, /\\t\(0,60,2,\\c&HFFFFFF&\\3c&HFFFFFF&\)\}Keep/);
  assert.match(ass, /\\t\(260,340,2,\\c&HFFFFFF&\\3c&HFFFFFF&\)\}your/);
  assert.match(ass, /\\t\(340,580,2,\\c&HFFFFFF&\\3c&HFFFFFF&\)\}story/);
});

test("overlapping word intervals never display two boxes and ASS commands remain literal text", async () => {
  const cues = await groupSerifBoxWords([word("First.", 100, 800), word("{\\pos(0,0)}", 700, 1000)], layout, measure);
  assert.equal(cues[0].endMs, 700);
  const ass = await serializeSerifBoxAss(cues, layout, "bottom", measure);
  assert.ok(!ass.includes("{\\pos(0,0)}")); assert.ok(ass.includes("(/pos(0,0))"));
});
