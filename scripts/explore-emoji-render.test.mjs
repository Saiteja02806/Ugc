import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import * as emoji from "../worker/src/lib/explore-emoji.ts";
import * as artwork from "../worker/src/lib/explore-emoji-artwork.ts";
import { formatInlineRuns, formatTextEmojiError, formatTextGraphemes } from "../worker/src/lib/explore-inline-symbols.ts";
import { formatTextLayout, formatTextLineRuns } from "../worker/dist/lib/explore-format-edit.js";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";

const assets = resolve("worker/src/assets/emoji"), tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const samples = "😂 😭 🔥 🚀\n❤️ 👍🏽 👩🏽‍💻 🇮🇳\n1️⃣ 💯 ✨ 🎉\n❌ ✅ ✔️ ☑️";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

test("every one of Unicode 17's 3,944 RGI sequences resolves as one complete bundled emoji", async () => {
  const { sequences, variants } = JSON.parse(await readFile(join(assets, "coverage.json"), "utf8"));
  assert.equal(sequences.length, 3944);
  for (const value of sequences) {
    assert.equal(formatTextGraphemes(value).length, 1, value);
    assert.ok(emoji.exploreEmojiId(value), `Missing ${value}`);
    const runs = formatInlineRuns(value);
    assert.equal(runs.length, 1, value);
    assert.equal(runs[0].value, value);
    assert.ok(runs[0].symbol || runs[0].artwork, value);
    assert.equal(formatTextEmojiError(value), null, value);
  }
  assert.equal(emoji.exploreEmojiId("❤"), emoji.exploreEmojiId("❤️"));
  assert.equal(emoji.exploreEmojiId("❤\ufe0e"), undefined, "Authored text-presentation selector stays typography");
  assert.equal(formatTextEmojiError("Plain X x + = 123 # *"), null);
  assert.match(formatTextEmojiError("😀\u200d😀"), /not supported/);
  assert.match(formatTextEmojiError("\u{1faff}"), /not supported/, "Reserved future pictographs cannot silently become missing font boxes");
  for (const value of variants) assert.ok(emoji.exploreEmojiId(value), `Missing qualification variant ${value}`);
});

test("all 4,009 bundled vector assets rasterize without any OS emoji font", async () => {
  const manifest = JSON.parse(await readFile("worker/src/lib/explore-emoji-manifest.json", "utf8"));
  const queue = [...manifest.ids];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const id = queue.pop(), svg = await artwork.readExploreEmojiArtwork(id, assets);
      assert.doesNotMatch(svg, /<(?:text|script|foreignObject|image|use)\b/);
      const pixels = await sharp(Buffer.from(svg)).resize(24, 24).ensureAlpha().raw().toBuffer();
      assert.ok(pixels.some((value, index) => index % 4 === 3 && value > 100), `${id} must have actual visible ink`);
    }
  }));
});

test("preview endpoint returns the exact export artwork with immutable caching and bounded public IDs", async () => {
  const exports = {};
  const code = ts.transpileModule(readFileSync("app/api/explore/emoji/[version]/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = { "node:path": { join }, "@/worker/src/lib/explore-emoji": emoji, "@/worker/src/lib/explore-emoji-artwork": artwork };
  vm.runInNewContext(code, { exports, Response, process, require(name) { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; } });
  for (const value of ["😂", "👍🏽", "👩🏽‍💻", "🇮🇳", "1️⃣"]) {
    const id = emoji.exploreEmojiId(value), response = await exports.GET(new Request("https://www.getugcpilot.com" + emoji.exploreEmojiUrl(id)), { params: Promise.resolve({ id, version: emoji.EXPLORE_EMOJI_VERSION }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type"), /image\/svg\+xml/);
    assert.match(response.headers.get("Cache-Control"), /immutable/);
    assert.match(response.headers.get("Link"), /licenses\/explore-emoji/);
    assert.equal(digest(await response.text()), digest(await artwork.readExploreEmojiArtwork(id, assets)));
  }
  for (const params of [{ id: "../private", version: emoji.EXPLORE_EMOJI_VERSION }, { id: "1f602", version: "other" }, { id: "a", version: emoji.EXPLORE_EMOJI_VERSION }]) {
    assert.equal((await exports.GET(new Request("https://www.getugcpilot.com"), { params: Promise.resolve(params) })).status, 404);
  }
  await assert.rejects(artwork.readExploreEmojiArtwork("1f602", join(assets, "missing")));
});

test("remixed faces, flags, skin tones and joined emojis retain color in clips and final Hook/demo MP4s", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(resolve(".tmp/explore-emoji-render-")), sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=540x960:r=30:d=1.5", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const sourceHash = digest(await readFile(sourcePath));
  const reference = { format: "hook", referenceId: "manual:hook", blocks: [{ text: samples, startMs: 0, endMs: 1500 }] };
  for (const [index, style] of [{}, { font: "inter", fontWeight: 700 }, { preset: "snapchat-classic" }, { font: "montserrat", fontWeight: 400 }].entries()) {
    const edit = applyVideoTextRemix({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 1500, originalVolume: 0, musicVolume: 0,
      text: { value: "Old caption", width: .9, y: .1, fontSize: 84, color: "#ffffff", startMs: 0, endMs: 1500, ...style } }, { blocks: [samples], heading: "", body: "" }, reference);
    const restored = JSON.parse(JSON.stringify(edit)), text = restored.textOverlays[0];
    assert.equal(text.value, samples);
    const parent = join(dir, String(index)); await mkdir(parent);
    const result = await finishExploreVideo({ sourcePath, tools, workDir: join(parent, "final"), ...(index % 2 ? {
      demoPath: sourcePath, clipComposition: { version: 1, sourceEditing: restored, demoEditing: null, sourceAudioPlayback: "once" },
    } : { editing: restored }) });
    const frame = ms => execFileSync(ffmpeg, ["-v", "error", "-ss", String(ms / 1000), "-i", result.outputPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const pixels = frame(600), layout = formatTextLayout(text, 540, 960);
    for (const [lineIndex, line] of layout.lines.entries()) for (const run of formatTextLineRuns(line, text, layout)) {
      if (!run.symbol && !run.artwork) continue;
      const region = await sharp(pixels, { raw: { width: 540, height: 960, channels: 3 } }).extract({ left: Math.floor(run.x), top: Math.floor(layout.y + lineIndex * layout.lineHeight), width: Math.ceil(run.width), height: Math.ceil(layout.lineHeight) }).raw().toBuffer();
      let colored = 0;
      for (let i = 0; i < region.length; i += 3) { const rgb = [...region.subarray(i, i + 3)]; if (Math.max(...rgb) > 100 && Math.max(...rgb) - Math.min(...rgb) > 70) colored++; }
      assert.ok(colored > 40, `${run.value} must have colored pixels in real MP4, style ${index}`);
    }
    const metadata = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_format", "-of", "json", result.outputPath], { encoding: "utf8", windowsHide: true }));
    assert.match(metadata.format.tags.comment, /Twemoji.*CC BY 4.0/);
    if (index % 2) assert.equal(frame(2100).some(value => value > 50), false, "Caption cannot bleed into demo");
    if (index === 1) await sharp(pixels, { raw: { width: 540, height: 960, channels: 3 } }).extract({ left: 110, top: 75, width: 320, height: 275 }).png().toFile(join(dir, "corrected-emoji-sample.png"));
  }
  assert.equal(digest(await readFile(sourcePath)), sourceHash);
  console.log(`Bundled emoji evidence: ${dir}`);
});
