import assert from "node:assert/strict";
import test from "node:test";
import { getSubtitleLayout } from "./captions.js";
import { groupNaturalSubtitleWords } from "./phrases.js";
import { SubtitleError, type TimedWord } from "./contracts.js";

const layout = getSubtitleLayout(720, 1280, "clean");
const measure = async (text: string) => text.length * 10;
const word = (text: string, startMs: number, endMs: number): TimedWord => ({ text, startMs, endMs });

test("natural grouping keeps every word, timing, and input object unchanged", async () => {
  const words = "You can make better videos with a little practice and a clear story.".split(" ").map((text, i) => word(text, i * 250, i * 250 + 200));
  const before = structuredClone(words);
  const cues = await groupNaturalSubtitleWords(words, layout, measure);
  assert.deepEqual(words, before);
  assert.deepEqual(cues.flatMap(cue => cue.words), before);
  for (const cue of cues) {
    assert.equal(cue.startMs, cue.words[0].startMs);
    assert.equal(cue.endMs, cue.words.at(-1)!.endMs);
    assert.ok(cue.words.length <= 6);
    assert.ok(cue.endMs - cue.startMs <= 2800);
    assert.deepEqual(cue.lines.flat(), cue.words.map((_, i) => i));
  }
});

test("natural grouping respects sentence endings and long speech pauses", async () => {
  const words = [word("Hello", 100, 400), word("world.", 450, 750), word("Next", 800, 1100), word("later", 2000, 2300)];
  const cues = await groupNaturalSubtitleWords(words, layout, measure);
  assert.deepEqual(cues.map(c => [c.startMs, c.endMs, c.words.map(w => w.text)]), [[100, 750, ["Hello", "world."]], [800, 1100, ["Next"]], [2000, 2300, ["later"]]]);
});

test("natural grouping uses measured two-line safe area and rejects unfit words", async () => {
  const narrow = { ...layout, maxLineWidth: 130 };
  const words = [word("caption", 0, 300), word("words", 300, 600), word("again", 600, 900)];
  const cues = await groupNaturalSubtitleWords(words, narrow, measure);
  assert.deepEqual(cues.flatMap(c => c.words), words);
  for (const cue of cues) {
    assert.ok(cue.lines.length <= 2);
    for (const line of cue.lines) assert.ok(await measure(line.map(i => cue.words[i].text).join(" ")) <= narrow.maxLineWidth);
  }
  await assert.rejects(groupNaturalSubtitleWords([word("this-word-cannot-fit", 0, 300)], narrow, measure), e => e instanceof SubtitleError && e.code === "TEXT_DOES_NOT_FIT");
});

test("natural grouping preserves overlaps without overlapping display cues", async () => {
  const words = [word("First.", 100, 500), word("Next.", 450, 800)];
  const cues = await groupNaturalSubtitleWords(words, layout, measure);
  assert.deepEqual(cues.flatMap(c => c.words), words);
  assert.equal(cues[0].endMs, cues[1].startMs);
});
