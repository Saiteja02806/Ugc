import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { SUBTITLE_STYLE_REGISTRY, subtitlePreview } from "../worker/dist/subtitles/styles.js";
import { parseStyle } from "../worker/dist/subtitles/contracts.js";
import { parseExploreFinishDraft } from "../worker/dist/lib/explore-finishing-contract.js";
const root = "public/subtitle-previews/v1", fixture = "scripts/fixtures/subtitle-preview";
const hash = value => createHash("sha256").update(value).digest("hex");
const run = (tool, args) => execFileSync(tool, ["-v", "error", ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const frame = (style, time) => run(ffmpeg, ["-ss", String(time), "-i", `public${subtitlePreview(style).video}`, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
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
    const file = `public${subtitlePreview(entry.style).video}`;
    assert.equal(entry.sourceHash, sourceHash); assert.equal(entry.transcriptHash, transcriptHash);
    assert.equal(entry.renderVersion, SUBTITLE_STYLE_REGISTRY.find(s => s.id === entry.style).renderVersion);
    assert.equal(hash(readFileSync(file)), entry.videoHash);
    const media = JSON.parse(run(ffprobe.path, ["-show_streams", "-show_format", "-of", "json", file]));
    assert.equal(Number(media.format.duration), 8);
    const video = media.streams.find(s => s.codec_type === "video"); assert.equal(video.width, 480); assert.equal(video.height, 854);
    audios.push(hash(run(ffmpeg, ["-i", file, "-vn", "-c:a", "copy", "-f", "adts", "pipe:1"])));
    assert.ok(readFileSync(`public${subtitlePreview(entry.style).poster}`).length > 1000);
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

test("Serif black box reveals whole words grey to white while the phrase and rounded label stay fixed", () => {
  const early = frame("serif-box", .4), later = frame("serif-box", .7), complete = frame("serif-box", 1.2);
  const dark = (r, g, b) => r < 12 && g < 12 && b < 12;
  const box = count(early, dark), ink = count(complete, white);
  assert.ok(box.pixels > 1000 && ink.pixels > 100);
  assert.ok(Math.abs((box.left + box.right) / 2 - 240) <= 2, "Label is centered horizontally");
  assert.ok(Math.abs((box.top + box.bottom) / 2 - 854 * .75) <= 2, "Label matches the reference lower-third anchor");
  assert.ok(ink.left - box.left >= 4 && ink.left - box.left <= 16, "Horizontal padding stays compact");
  assert.ok(ink.top - box.top >= 8 && ink.top - box.top <= 22, "Vertical padding matches the reference");
  const pixel = (x, y) => { const offset = (y * 480 + x) * 3; return [...early.subarray(offset, offset + 3)]; };
  assert.ok(!dark(...pixel(box.left, box.top)), "Corner is rounded instead of square");
  assert.ok(dark(...pixel(box.left + 6, box.top + 3)), "The label interior is solid black");
  const midBox = count(later, dark), endBox = count(complete, dark);
  for (const bounds of [midBox, endBox]) for (const edge of ["left", "right", "top", "bottom"]) assert.equal(bounds[edge], box[edge], "Box geometry stays fixed throughout the phrase");
  assert.ok(count(later, white).pixels > count(early, white).pixels + 40, "Spoken words brighten progressively");
  assert.ok(ink.pixels > count(later, white).pixels + 40, "Future words start grey instead of appearing white");
  // Sample both halves of "every" midway through its actual speech interval.
  // A left-to-right karaoke wipe would already contain fully white pixels.
  const revealing = frame("serif-box", .63);
  const peak = (left, right) => {
    const pixels = [];
    for (let y = 629; y < 660; y++) for (let x = left; x < right; x++) pixels.push(revealing[(y * 480 + x) * 3]);
    return pixels.sort((a, b) => b - a).slice(0, 15).reduce((sum, value) => sum + value, 0) / 15;
  };
  const firstHalf = peak(180, 200), secondHalf = peak(200, 221);
  assert.ok(firstHalf > 95 && firstHalf < 180 && secondHalf > 95 && secondHalf < 180, "The whole word fades instead of sweeping white across its letters");
  assert.ok(Math.abs(firstHalf - secondHalf) < 15, "Both halves brighten together");
  const beforePause = count(frame("serif-box", 2.67), white).pixels, afterPause = count(frame("serif-box", 2.73), white).pixels;
  assert.ok(beforePause > 100); assert.ok(Math.abs(beforePause - afterPause) < 20, "Completed words retain their white fill during a real word-time gap");
  assert.equal(count(frame("serif-box", 1.8), dark).pixels, 0, "Box disappears during the real speech pause");
});
