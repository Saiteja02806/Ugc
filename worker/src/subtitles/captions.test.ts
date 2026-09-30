import assert from "node:assert/strict";
import test from "node:test";
import { getSubtitleLayout, groupSubtitleWords, serializeAss, serializeSrt, serializeVtt } from "./captions.js";
import { validateTranscript, SubtitleError, type TimedWord } from "./contracts.js";
import { normalizeOpenAITranscript } from "./openai-provider.js";

const transcript = (words: unknown, durationMs = 3_000) => ({ schemaVersion: 1, provider: "fixture", model: "test", language: "en", durationMs, words });
const word = (text: string, startMs: number, endMs: number): TimedWord => ({ text, startMs, endMs });
const measure = async (text: string) => text.length * 10;
const layout = getSubtitleLayout(720, 1280, "clean");

test("normalizes OpenAI seconds to milliseconds without inventing timings", () => {
  const result = normalizeOpenAITranscript({ language: "english", words: [{ word: "Hello", start: 0.23, end: 0.78 }] }, 3_000);
  assert.deepEqual(result.words, [word("Hello", 230, 780)]);
  assert.throws(() => normalizeOpenAITranscript({ text: "Hello" }, 3_000), (e) => e instanceof SubtitleError && e.code === "WORD_TIMINGS_UNAVAILABLE");
});

test("rejects the observed music hallucination and unreliable word timings", () => {
  const tiny = { words: ["Thank", "you", "for", "watching"].map((word, i) => ({ word, start: 10.8 + i * 0.02, end: 10.82 + i * 0.02 })),
    segments: [{ start: 10.8, end: 10.9, no_speech_prob: 0.486, avg_logprob: -0.97 }] };
  assert.throws(() => normalizeOpenAITranscript(tiny, 11_000), (e) => e instanceof SubtitleError && e.code === "TRANSCRIPT_UNRELIABLE");
  assert.throws(() => normalizeOpenAITranscript({ words: [{word: "Choose", start: 1, end: 1}] }, 3_000),
    (e) => e instanceof SubtitleError && e.code === "WORD_TIMINGS_UNRELIABLE");
  assert.throws(() => normalizeOpenAITranscript({ words: [{word: "words", start: 0, end: 1}],
    segments: [{start:0,end:1,no_speech_prob:0.9,avg_logprob:-1.4}] }, 3_000),
    (e) => e instanceof SubtitleError && e.code === "TRANSCRIPT_UNRELIABLE");
});

test("rejects reversed, nonfinite, unordered, out-of-duration and zero-duration word timings", () => {
  for (const words of [[word("bad", -1, 50)], [word("bad", 100, 100)], [word("bad", 100, Infinity)],
    [word("bad", 100, 3_200)], [word("first", 200, 300), word("second", 100, 200)], [word("bad", 0.01, 0.1)]]) {
    assert.throws(() => validateTranscript(transcript(words), 3_000), (e) => e instanceof SubtitleError && e.code === "INVALID_TIMESTAMPS");
  }
  assert.equal(validateTranscript(transcript([word("end", 2_900, 3_100)]), 3_000).words[0].endMs, 3_000);
});

test("empty speech, wrong duration and unsafe control characters fail explicitly", () => {
  assert.throws(() => validateTranscript(transcript([]), 3_000), (e) => e instanceof SubtitleError && e.code === "NO_SPEECH");
  assert.throws(() => validateTranscript(transcript([word("ok", 0, 50)], 2_000), 3_000));
  assert.throws(() => validateTranscript(transcript([word("bad\nDialogue:", 0, 50)]), 3_000));
});

test("phrases stop at speech ends, preserve pauses and split at punctuation", async () => {
  const cues = await groupSubtitleWords([word("Hello", 100, 400), word("world.", 450, 750), word("Next", 800, 1100), word("later", 2000, 2300)], layout, measure);
  assert.deepEqual(cues.map((cue) => [cue.startMs, cue.endMs, cue.words.map((w) => w.text)]),
    [[100, 750, ["Hello", "world."]], [800, 1100, ["Next"]], [2000, 2300, ["later"]]]);
});

test("wraps at actual measured width with at most two lines; long words are rejected", async () => {
  const narrow = { ...layout, maxLineWidth: 130 };
  const cues = await groupSubtitleWords([word("caption", 0, 300), word("words", 300, 600), word("again", 600, 900)], narrow, measure);
  for (const cue of cues) {
    assert.ok(cue.lines.length <= 2);
    for (const line of cue.lines) assert.ok(await measure(line.map((i) => cue.words[i].text).join(" ")) <= narrow.maxLineWidth);
  }
  assert.deepEqual(cues.flatMap((c) => c.words.map((w) => w.text)), ["caption", "words", "again"]);
  await assert.rejects(groupSubtitleWords([word("this-word-cannot-fit", 0, 300)], narrow, measure), (e) => e instanceof SubtitleError && e.code === "TEXT_DOES_NOT_FIT");
});

test("ASS treats transcript syntax as display text, never positioning commands", async () => {
  const cues = await groupSubtitleWords([word("{\\pos(0,0)}", 100, 900)], layout, measure);
  const ass = serializeAss(cues, layout, "clean", "bottom");
  assert.ok(!ass.includes("{\\pos(0,0)}"));
  assert.ok(ass.includes("(/pos(0,0))"));
  assert.ok(serializeSrt(cues).includes("{\\pos(0,0)}")); // Raw text retained in plain subtitle export.
});

test("active-word highlighting changes with real boundaries and clears between words", async () => {
  const cues = await groupSubtitleWords([word("One", 100, 400), word("two", 500, 800)], layout, measure);
  const ass = serializeAss(cues, layout, "active-word", "bottom");
  assert.match(ass, /0:00:00\.10,0:00:00\.40.*\{\\c&H0059DDFF&\}One/u);
  const pause = ass.split("\n").find((line) => line.includes("0:00:00.40,0:00:00.50"));
  assert.ok(pause && !pause.includes("0059DDFF"));
  assert.match(ass, /0:00:00\.50,0:00:00\.80.*\{\\c&H0059DDFF&\}two/u);
  assert.ok(!ass.includes("0:00:03.00"));
});

test("VTT escapes HTML-like text and SRT retains millisecond timing", async () => {
  const cues = await groupSubtitleWords([word("<b>&", 123, 456)], layout, measure);
  assert.ok(serializeVtt(cues).includes("&lt;b&gt;&amp;"));
  assert.ok(serializeSrt(cues).includes("00:00:00,123 --> 00:00:00,456"));
});
