import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { SUBTITLE_STYLE_REGISTRY } from "../worker/dist/subtitles/styles.js";
import { parseStyle } from "../worker/dist/subtitles/contracts.js";
import { parseExploreFinishDraft } from "../worker/dist/lib/explore-finishing-contract.js";
const root = "public/subtitle-previews/v1", fixture = "scripts/fixtures/subtitle-preview";
const hash = value => createHash("sha256").update(value).digest("hex");
const run = (tool, args) => execFileSync(tool, ["-v", "error", ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const frame = (style, time) => run(ffmpeg, ["-ss", String(time), "-i", `${root}/${style}.mp4`, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
const count = (data, predicate) => {
  let pixels = 0, left = 480, right = 0, top = 854, bottom = 0;
  for (let y = 547; y < 752; y++) for (let x = 0; x < 480; x++) {
    const i = (y * 480 + x) * 3;
    if (predicate(data[i], data[i + 1], data[i + 2])) { pixels++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  return { pixels, left, right, top, bottom };
};
const gold = (r, g, b) => r > 180 && g > 150 && b < 145;
const marker = (r, g, b) => Math.abs(r - 106) < 20 && Math.abs(g - 72) < 20 && Math.abs(b - 163) < 20;
const white = (r, g, b) => r > 205 && g > 205 && b > 205;

test("every approved style has one real example sharing the frozen source, transcript, dimensions and audio", () => {
  const manifest = JSON.parse(readFileSync(`${root}/manifest.json`));
  assert.deepEqual(manifest.examples.map(entry => entry.style), SUBTITLE_STYLE_REGISTRY.map(style => style.id));
  const sourceHash = hash(readFileSync(`${fixture}/source.mp4`));
  const transcriptHash = hash(JSON.stringify(JSON.parse(readFileSync(`${fixture}/transcript.json`))));
  const audios = [];
  for (const entry of manifest.examples) {
    const file = `${root}/${entry.style}.mp4`;
    assert.equal(entry.sourceHash, sourceHash); assert.equal(entry.transcriptHash, transcriptHash);
    assert.equal(entry.renderVersion, SUBTITLE_STYLE_REGISTRY.find(s => s.id === entry.style).renderVersion);
    assert.equal(hash(readFileSync(file)), entry.videoHash);
    const media = JSON.parse(run(ffprobe.path, ["-show_streams", "-show_format", "-of", "json", file]));
    assert.equal(Number(media.format.duration), 8);
    const video = media.streams.find(s => s.codec_type === "video"); assert.equal(video.width, 480); assert.equal(video.height, 854);
    audios.push(hash(run(ffmpeg, ["-i", file, "-vn", "-c:a", "copy", "-f", "adts", "pipe:1"])));
    assert.ok(readFileSync(`${root}/${entry.style}.jpg`).length > 1000);
  }
  assert.equal(new Set(audios).size, 1, "Every preview preserves exactly the same AAC packets");
});
test("real preview pixels stop at speech gaps and remain inside the portrait safe area", () => {
  for (const style of SUBTITLE_STYLE_REGISTRY) {
    const textColor = style.id === "karaoke" ? (r, g, b) => (r > 175 && g > 175 && b > 175) || gold(r, g, b) : white;
    const visible = count(frame(style.id, .8), textColor);
    assert.ok(visible.pixels > 100, `${style.id}: visible rendered text`);
    assert.ok(visible.left >= 40 && visible.right <= 440 && visible.top >= 547 && visible.bottom < 752, `${style.id}: safe area`);
    assert.equal(count(frame(style.id, 1.8), textColor).pixels, 0, `${style.id}: no invented text in the long pause`);
  }
});
test("Karaoke fills progressively, freezes during a real short pause, and keeps completed words filled", () => {
  const early = count(frame("karaoke", .4), gold).pixels, later = count(frame("karaoke", .7), gold).pixels;
  assert.ok(early > 0 && later > early + 50);
  const before = count(frame("karaoke", 2.67), gold).pixels, after = count(frame("karaoke", 2.73), gold).pixels;
  assert.ok(before > 100); assert.ok(Math.abs(after - before) < 20, "Fill must freeze over the word-time gap");
  assert.ok(count(frame("karaoke", 3.0), gold).pixels > after);
});
test("Marker highlights only the current word; its phrase remains visible during short pauses", () => {
  assert.ok(count(frame("marker-highlight", 2.5), marker).pixels > 100);
  assert.equal(count(frame("marker-highlight", 2.67), marker).pixels, 0);
  assert.ok(count(frame("marker-highlight", 2.67), white).pixels > 100);
  assert.ok(count(frame("marker-highlight", 3.0), marker).pixels > 100);
  assert.equal(count(frame("word-pop", 2.67), white).pixels, 0);
});
test("style validation is additive and unknown persisted or worker styles fail closed", () => {
  const base = { version: 1, kind: "hook", sourceAssetId: "11111111-1111-4111-8111-111111111111", demoAssetId: null, demoAudioAssetId: null,
    demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: { language: "en", style: "clean" } };
  for (const style of SUBTITLE_STYLE_REGISTRY) { assert.equal(parseStyle(style.id), style.id); assert.equal(parseExploreFinishDraft({ ...base, subtitles: { language: "en", style: style.id } }).subtitles.style, style.id); }
  for (const style of ["unknown", "", null, "Word pop", "Clean"]) {
    assert.throws(() => parseStyle(style)); assert.throws(() => parseExploreFinishDraft({ ...base, subtitles: { language: "en", style } }));
  }
});
