import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test, { mock } from "node:test";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import * as media from "../worker/dist/subtitles/media.js";

const commands = [];
let badFont = false;
let abortDuringCommand;
mock.module("../worker/dist/subtitles/media.js", { namedExports: { ...media, runMediaCommand: async (...args) => {
  commands.push(args[1]);
  const abortTimer = abortDuringCommand ? setTimeout(() => abortDuringCommand.abort(), 10) : null;
  try {
    const result = await media.runMediaCommand(...args);
    return badFont ? { ...result, stderr: `${result.stderr}\nGlyph 1 not found` } : result;
  } finally { if (abortTimer) clearTimeout(abortTimer); }
} } });
const { createSerifBoxMeasurer, prepareSerifBoxFonts, serializeSerifBoxAss } = await import("../worker/dist/subtitles/serif-box.js");
const { createEditorialMeasurer, prepareEditorialFonts } = await import("../worker/dist/subtitles/editorial-media.js");
const { editorialHeader, editorialFontTags } = await import("../worker/dist/subtitles/editorial.js");
const { getSubtitleLayout, escapeAssText } = await import("../worker/dist/subtitles/captions.js");
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
async function workspace(t, editorial = false) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "subtitle-batch-test-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("subtitle-batch-test-"));
    await rm(dir, { recursive: true, force: true });
  });
  await (editorial ? prepareEditorialFonts : prepareSerifBoxFonts)(tools, dir);
  commands.length = 0;
  return dir;
}

// Reference the previous single-frame libass algorithm. Batch output must keep
// identical shaped ink bounds, including stroke, italic overhang and clipping.
async function legacyProbe(dir, layout, text, font, size) {
  const editorial = Boolean(font);
  const width = Math.ceil((layout.width * 1.4 + 128) / 2) * 2;
  const height = Math.ceil(Math.max(editorial ? 400 : 200, (size ?? layout.fontSize) * 2 + 128) / 2) * 2;
  const header = editorial ? editorialHeader({ width, height }) : await serializeSerifBoxAss([], { ...layout, width, height }, "bottom", async () => {});
  const tags = editorial ? `\\fs${size}${editorialFontTags(font)}\\bord0\\shad0\\c&H00FFFFFF&` : "";
  await writeFile(join(dir, "legacy.ass"), header + `Dialogue: 0,0:00:00.00,0:00:01.00,Caption,,0,0,0,,{\\an7\\pos(64,64)${tags}}${escapeAssText(text)}\n`);
  await media.runMediaCommand(ffmpeg, ["-nostdin", "-v", "error", "-y", "-protocol_whitelist", "file,pipe", "-f", "lavfi", "-i",
    `color=c=black:s=${width}x${height}:r=24`, "-vf", "ass=legacy.ass:fontsdir=fonts", "-frames:v", "1", "legacy.png"], { cwd: dir });
  const { data, info } = await sharp(await readFile(join(dir, "legacy.png"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * info.channels] > 32) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left: left - 64, top: top - 64, width: right >= width - 3 ? width * 2 : right - left + 1, height: bottom - top + 1 };
}

test("Serif batches and deduplicates exact measurements without changing single-frame ink", async t => {
  const phrases = ["And if you use this", "Ag", "grey to white", "don't pause.", "Research, then go!", "{\\pos(0,0)}", "éclair", "W".repeat(90)];
  for (const [width, height] of [[478, 850], [720, 1280], [1080, 1920], [1920, 1080]]) {
    const dir = await workspace(t), layout = getSubtitleLayout(width, height, "serif-box");
    const measure = createSerifBoxMeasurer(layout, tools, dir);
    await measure.preload([...phrases, ...phrases]);
    assert.equal(commands.length, 1, "all eight unique phrases should share one FFmpeg invocation");
    for (const phrase of phrases) assert.deepEqual(await measure(phrase), await legacyProbe(dir, layout, phrase));
    assert.equal(commands.length, 1, "cached requests must not render again");
    assert.ok((await readdir(dir)).every(file => !file.includes("-batch-")), "temporary batch frames must be removed");
  }
});

test("Editorial batches compatible font sizes and keeps italic and hero geometry identical", async t => {
  for (const [width, height] of [[478, 850], [720, 1280], [1080, 1920], [1920, 1080]]) {
    const dir = await workspace(t, true), layout = getSubtitleLayout(width, height, "editorial");
    const measure = createEditorialMeasurer(layout, tools, dir);
    const variants = [{ text: "Make it simple.", size: layout.fontSize, font: "lead" },
      { text: "hero", size: Math.round(width * .3), font: "hero" },
      { text: "future words", size: Math.round(width * .08), font: "support" },
      { text: "W".repeat(70), size: layout.fontSize, font: "lead" },
      { text: "{\\pos(0,0)}", size: layout.fontSize, font: "lead" }];
    const bounds = await Promise.all(variants.map(({ text, size, font }) => measure(text, size, font)));
    const canvases = new Set(variants.map(({ size }) => Math.ceil(Math.max(400, size * 2 + 128) / 2) * 2));
    assert.equal(commands.length, canvases.size, "only different canvas dimensions should require another batch");
    for (let i = 0; i < variants.length; i++) {
      const { text, size, font } = variants[i];
      assert.deepEqual(bounds[i], await legacyProbe(dir, layout, text, font, size));
    }
  }
});

test("large batches stay bounded and two measurers in one directory do not race", async t => {
  const dir = await workspace(t), layout = getSubtitleLayout(478, 850, "serif-box");
  const a = createSerifBoxMeasurer(layout, tools, dir), b = createSerifBoxMeasurer(layout, tools, dir);
  await Promise.all([a.preload(Array.from({ length: 35 }, (_, i) => `caption ${i}`)), b.preload(["Different font check", "Ag"])]);
  assert.equal(commands.length, 4);
  assert.ok(commands.every(args => Number(args[args.indexOf("-frames:v") + 1]) <= 16));
  assert.ok((await readdir(dir)).every(file => !file.includes("-batch-")));
});

test("font failures reject every affected request and remove batch artifacts", async t => {
  const dir = await workspace(t), measure = createSerifBoxMeasurer(getSubtitleLayout(478, 850, "serif-box"), tools, dir);
  badFont = true;
  try {
    const results = await Promise.allSettled(Array.from({ length: 35 }, (_, i) => measure(`Phrase ${i}`)));
    assert.ok(results.every(result => result.status === "rejected" && result.reason.code === "FONT_UNAVAILABLE"));
    assert.equal(commands.length, 1, "failed measurement must stop queued batches");
  } finally { badFont = false; }
  assert.ok((await readdir(dir)).every(file => !file.includes("-batch-")));
});

test("an aborted render starts no FFmpeg process", async t => {
  const dir = await workspace(t), signal = AbortSignal.abort();
  const measure = createSerifBoxMeasurer(getSubtitleLayout(478, 850, "serif-box"), tools, dir, signal);
  await assert.rejects(measure.preload(["First", "Second"]), /abort/iu);
  assert.equal(commands.length, 0);
});

test("cancellation during rasterization settles the whole queue and removes temporary files", async t => {
  const dir = await workspace(t), controller = new AbortController();
  const measure = createSerifBoxMeasurer(getSubtitleLayout(1080, 1920, "serif-box"), tools, dir, controller.signal);
  abortDuringCommand = controller;
  try { await assert.rejects(measure.preload(Array.from({ length: 35 }, (_, i) => `Cancel phrase ${i}`)), { code: "CANCELLED" }); }
  finally { abortDuringCommand = undefined; }
  assert.equal(commands.length, 1, "cancellation must not start the next batch");
  assert.ok((await readdir(dir)).every(file => !file.includes("-batch-")));
});

test("invisible text cannot return an invented fitting measurement", async t => {
  const dir = await workspace(t), measure = createSerifBoxMeasurer(getSubtitleLayout(478, 850, "serif-box"), tools, dir);
  await assert.rejects(measure.preload(["Visible", " "]), { code: "FONT_UNAVAILABLE" });
  assert.ok((await readdir(dir)).every(file => !file.includes("-batch-")));
});
