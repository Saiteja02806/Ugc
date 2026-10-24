import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { formatInlineRuns, formatInlineSymbol, formatTextGraphemes } from "../worker/dist/lib/explore-inline-symbols.js";
import { createOutlinedFormatTextSvg } from "../worker/dist/lib/explore-text-outlines.js";
import { createFormatTextSvg, formatTextLayout, EXPLORE_TEXT_FONTS } from "../worker/dist/lib/explore-format-edit.js";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { EMPTY_SLIDE_TEXT, slideTextSvg } from "../lib/explore/slideshow-text.ts";

const text = { value: "Building more features ❌\nMarketing my SaaS ✅", width: .9, y: .12, fontSize: 64, color: "#ffffff", startMs: 200, endMs: 1200 };
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
function colors(bytes, channels = 3) {
  let red = 0, green = 0, white = 0;
  for (let i = 0; i < bytes.length; i += channels) {
    if (channels === 4 && bytes[i + 3] < 180) continue;
    const [r, g, b] = bytes.subarray(i, i + 3);
    if (r > 140 && r > g * 1.6 && r > b * 1.6) red++;
    if (g > 95 && g > r * 1.5 && g > b * 1.3) green++;
    if (r > 200 && g > 200 && b > 200) white++;
  }
  return { red, green, white };
}

test("Explore slideshow text uses the same colored symbols in preview/export across alignments", async () => {
  for (const align of ["left", "center", "right"]) {
    const svg = slideTextSvg({ ...EMPTY_SLIDE_TEXT, align, heading: text.value, body: "Continue → ✔️ 😂", size: 64 }, 1080, 1920, (value, font) => value.length * parseFloat(font.split(" ")[1]) * .6);
    assert.equal((svg.match(/data-format-inline-symbol=/g) ?? []).length, 4);
    const ink = colors(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer(), 4);
    assert.ok(ink.red > 400 && ink.green > 400, align);
  }
});

test("cross/check/arrow artwork is independent of fonts and caption colors, without changing saved Unicode", async () => {
  for (const preset of [undefined, "snapchat-classic"]) for (const font of [undefined, ...EXPLORE_TEXT_FONTS.map(f => f.id)]) {
    const input = { ...text, preset, font, color: "#aabbff", value: "❌ ✅ → ✔️ ☑️ ✖️ ➡️" };
    const before = JSON.stringify(input), svg = await createOutlinedFormatTextSvg(input, 1080, 1920, tools.fontsDir);
    const image = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    const ink = colors(image, 4);
    assert.ok(ink.red > 400 && ink.green > 400, `${font ?? "Arial"}/${preset ?? "bold"}: red and green artwork survives rasterization`);
    assert.equal(JSON.stringify(input), before);
    assert.equal((svg.match(/data-format-inline-symbol=/g) ?? []).length, 7);
    assert.doesNotMatch(svg, /NaN|Infinity/);
    const preview = createFormatTextSvg(input, 1080, 1920);
    assert.equal((preview.match(/data-format-inline-symbol=/g) ?? []).length, 7);
    assert.match(preview, /fill="#e53935"/); assert.match(preview, /fill="#22a447"/);
  }
});

test("selectors, ZWJ, skin tones, keycaps and flags stay intact instead of splitting at wraps or font fallback", async () => {
  const graphemes = ["✔️", "☑️", "👩🏽‍💻", "❤️", "1️⃣", "🇮🇳", "😂"];
  assert.deepEqual(formatTextGraphemes(graphemes.join("")), graphemes);
  assert.equal(formatInlineSymbol("✔\ufe0e"), undefined, "explicit text presentation retains its font and text color");
  assert.equal(formatInlineRuns("X x + =").some(r => r.symbol), false);
  assert.equal(formatInlineSymbol("→"), "arrow-right");
  const input = { ...text, font: "inter", fontWeight: 700, value: graphemes.join("") + " <unsafe> & Café 中文" };
  const svg = await createOutlinedFormatTextSvg(input, 1080, 1920, tools.fontsDir);
  for (const value of graphemes.slice(2)) assert.ok(svg.includes(value), `fallback retains complete ${value}`);
  assert.doesNotMatch(svg, /<unsafe>/); assert.match(createFormatTextSvg(input, 1080, 1920), /&lt;unsafe&gt;/);
  const layout = formatTextLayout({ ...input, width: .4, fontSize: 84, value: graphemes.join("").repeat(8) }, 1080, 1920);
  assert.equal(layout.lines.join(""), graphemes.join("").repeat(8));
  assert.ok(layout.lines.every(line => !/^[\ufe0f\u200d\u20e3\u{1f3fd}]/u.test(line)));
});

test("real Hook/Wall exports keep red cross, green tick, ordinary white copy and original timing", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(resolve(".tmp/explore-symbol-render-")), sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=540x960:r=30:d=1.5", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const sourceBytes = await readFile(sourcePath);
  const cases = [{ format: "hook" }, { format: "hook", font: "inter", fontWeight: 700 }, { format: "wall_text", font: "montserrat", fontWeight: 400 }, { format: "hook", preset: "snapchat-classic" }];
  for (const [i, { format, ...style }] of cases.entries()) {
    const editing = { version: 1, format, trimStartMs: 0, trimEndMs: 1500, originalVolume: 1, musicVolume: .2, text: { ...text, ...style } };
    const result = await finishExploreVideo({ sourcePath, editing, workDir: join(dir, `render-${i}`), tools });
    const frame = ms => execFileSync(ffmpeg, ["-v", "error", "-ss", String(ms / 1000), "-i", result.outputPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const during = frame(600), ink = colors(during);
    assert.ok(ink.red > 40 && ink.green > 40 && ink.white > 100, `${JSON.stringify(style)} keeps the colored symbols and white words in actual encoded video`);
    assert.deepEqual(colors(frame(100)), { red: 0, green: 0, white: 0 });
    assert.deepEqual(colors(frame(1300)), { red: 0, green: 0, white: 0 });
    if (i === 1) {
      await sharp(during, { raw: { width: 540, height: 960, channels: 3 } }).png().toFile(join(dir, "corrected-hook-frame.png"));
      await writeFile(join(dir, "corrected-overlay.svg"), await createOutlinedFormatTextSvg(editing.text, 1080, 1920, tools.fontsDir));
    }
  }
  assert.deepEqual(await readFile(sourcePath), sourceBytes);
  console.log(`Rendered evidence: ${dir}`);
});
