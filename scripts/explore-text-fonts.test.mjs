import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { EXPLORE_TEXT_FONTS, EXPLORE_TEXT_WEIGHTS, applyFormatTextPreset, createFormatTextSvg, formatTextLayout, parseExploreFormatEdit } from "../worker/dist/lib/explore-format-edit.js";
import { prepareExploreFormatEditFilter } from "../worker/dist/lib/explore-format-render.js";
import { createOutlinedFormatTextSvg } from "../worker/dist/lib/explore-text-outlines.js";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { readFormatEditDraft, prepareFormatEditForExport } from "../lib/explore/format-edit-draft.ts";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";

const legacyText = { value: "What nobody tells you about this", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
const edit = text => ({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 2000, originalVolume: 1, musicVolume: .2, text });
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

test("dragged positions reach real video exports for legacy, bundled-font and Snapchat text", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const root = await mkdtemp(resolve(".tmp/explore-position-video-")), sourcePath = join(root, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const before = digest(await readFile(sourcePath));
  const positions = [{}, { font: "inter", fontWeight: 700 }, { preset: "snapchat-classic", backgroundOpacity: .58 }];
  const textOverlays = positions.map((style, i) => ({ ...legacyText, ...style, value: "Move", fontSize: 84, x: .7, y: .5, startMs: i * 600, endMs: i * 600 + 500 }));
  const saved = readFormatEditDraft(JSON.parse(JSON.stringify({ ...edit(null), textOverlays })));
  const output = await finishExploreVideo({ sourcePath, editing: saved, workDir: join(root, "render"), tools });
  for (let i = 0; i < positions.length; i++) {
    const frame = execFileSync(ffmpeg, ["-v", "error", "-ss", String((i * 600 + 200) / 1000), "-i", output.outputPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true });
    const pixels = [];
    for (let n = 0; n < frame.length; n += 3) if (frame[n] > 200 && frame[n + 1] > 200 && frame[n + 2] > 200) pixels.push({ x: (n / 3) % 360, y: Math.floor(n / 3 / 360) });
    assert.ok(pixels.length > 100, `Rendered text is visible for mode ${i}`);
    const xs = pixels.map(p => p.x), ys = pixels.map(p => p.y), center = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(Math.abs(center - .7 * 360) < 5, `Mode ${i}: saved horizontal position reaches output (${center})`);
    assert.ok(Math.min(...ys) >= 320 && Math.max(...ys) < 370, `Mode ${i}: saved vertical position reaches output`);
  }
  assert.equal(digest(await readFile(sourcePath)), before);
});

test("new Remix text defaults to Inter Bold in Hook and Wall workflows", () => {
  for (const format of ["hook", "wall_text"]) {
    const source = { version: 1, referenceId: "ref", slideId: null, format, language: "en", sourceSha256: "a".repeat(64), blocks: [{ text: "Reference", startMs: 0, endMs: 2000 }] };
    const remixed = applyVideoTextRemix({ ...edit(null), format }, { blocks: ["New business message"], heading: "", body: "" }, source);
    assert.equal(remixed.textOverlays[0].font, "inter");
    assert.equal(remixed.textOverlays[0].fontWeight, 700);
  }
});

test("font choices survive save/reopen, blank drafts, preset changes and Remix; legacy shape is unchanged", () => {
  assert.deepEqual(parseExploreFormatEdit(edit(legacyText)), edit(legacyText));
  for (const { id: font } of EXPLORE_TEXT_FONTS) for (const { value: fontWeight } of EXPLORE_TEXT_WEIGHTS) {
    const text = { ...legacyText, font, fontWeight };
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit(text)))).text, text);
    const blank = { ...edit(null), textOverlays: [{ ...text, value: "" }] };
    assert.deepEqual(readFormatEditDraft(blank), blank);
    assert.equal(prepareFormatEditForExport(blank).text, null);
    const classic = applyFormatTextPreset(text, "snapchat-classic");
    assert.equal(classic.font, font); assert.equal(classic.fontWeight, 400);
    const bold = applyFormatTextPreset(classic, "bold");
    assert.equal(bold.fontWeight, 700); assert.equal(bold.value, text.value); assert.equal(bold.endMs, text.endMs);
    const source = { version: 1, referenceId: "ref", slideId: null, format: "hook", language: "en", sourceSha256: "a".repeat(64), blocks: [{ text: "Reference", startMs: 0, endMs: 2000 }] };
    const remixed = applyVideoTextRemix(edit(text), { blocks: ["New business message"], heading: "", body: "" }, source);
    assert.equal(remixed.textOverlays[0].font, font); assert.equal(remixed.textOverlays[0].fontWeight, fontWeight);
  }
  for (const patch of [{ font: "../../unsafe" }, { font: "unknown" }, { fontWeight: 900 }, { fontWeight: "500" }, { fontWeight: 500 }]) assert.throws(() => parseExploreFormatEdit(edit({ ...legacyText, ...patch })), /supported font/);
});

test("bundled faces and licenses match the preparation manifest", async () => {
  const manifest = JSON.parse(await readFile(resolve(tools.fontsDir, "explore-text/manifest.json"), "utf8"));
  for (const { id } of EXPLORE_TEXT_FONTS) {
    assert.match(await readFile(resolve(tools.fontsDir, `explore-text/${id}-OFL.txt`), "utf8"), /SIL OPEN FONT LICENSE/i);
    for (const { value } of EXPLORE_TEXT_WEIGHTS) {
      assert.equal(digest(await readFile(resolve(tools.fontsDir, `explore-text/${id}-${value}.ttf`))), manifest.files[id].weights[value].ttfSha256);
      assert.equal(digest(await readFile(resolve(`public/explore-text-fonts/${id}-${value}.woff2`))), manifest.files[id].weights[value].woff2Sha256);
    }
  }
});

test("every family and weight rasterizes distinctly using its bundled face and common layout", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const root = await mkdtemp(resolve(".tmp/explore-font-exports-")), hashes = new Set();
  for (const { id: font } of EXPLORE_TEXT_FONTS) for (const { value: fontWeight } of EXPLORE_TEXT_WEIGHTS) {
    const text = { ...legacyText, value: "Widen your world", font, fontWeight, fontSize: 84 };
    const workDir = join(root, `${font}-${fontWeight}`); await mkdir(workDir);
    const result = await prepareExploreFormatEditFilter({ width: 1080, height: 1920, durationMs: 2000, editing: edit(text), workDir, tools });
    assert.equal(result.captionImages.length, 1); assert.doesNotMatch(result.filter, /drawtext=/);
    const png = await readFile(join(workDir, result.captionImages[0]));
    const ink = await sharp(await sharp(png).trim({ background: "#00000000" }).toBuffer()).metadata();
    assert.ok(ink.width > 300 && ink.width < 864, `${font} ${fontWeight} stays inside its text box`);
    hashes.add(digest(png));
    const svg = createFormatTextSvg(text, 1080, 1920), layout = formatTextLayout(text, 1080, 1920);
    assert.ok(svg.includes(layout.fontFamily)); assert.ok(svg.includes(`font-weight="${fontWeight}"`));
    // A missing packaged face cannot fall back silently to another font.
    await assert.rejects(prepareExploreFormatEditFilter({ width: 1080, height: 1920, durationMs: 2000, editing: edit(text), workDir, tools: { ...tools, fontsDir: join(root, "missing") } }));
  }
  assert.equal(hashes.size, 12, "No family/weight silently falls back to the same face");
});

test("real video export preserves mixed font timing and original source bytes", async () => {
  const root = await mkdtemp(resolve(".tmp/explore-font-video-")), sourcePath = join(root, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const before = digest(await readFile(sourcePath));
  const textOverlays = EXPLORE_TEXT_FONTS.map(({ id: font }, i) => ({ ...legacyText, font, fontWeight: 500, startMs: i * 450, endMs: i * 450 + 350 }));
  const output = await finishExploreVideo({ sourcePath, editing: { ...edit(null), textOverlays }, workDir: join(root, "render"), tools });
  assert.equal(digest(await readFile(sourcePath)), before);
  const bright = ms => { const frame = execFileSync(ffmpeg, ["-v", "error", "-ss", String(ms / 1000), "-i", output.outputPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true }); let count = 0; for (let i=0;i<frame.length;i+=3) if (frame[i]>190 && frame[i+1]>190 && frame[i+2]>190) count++; return count; };
  for (let i=0;i<4;i++) assert.ok(bright(i*450+150)>60);
  assert.equal(bright(1900), 0);
});

test("font outlines retain accents, emoji/script fallback and the selected preset background", async () => {
  const text = { ...applyFormatTextPreset(legacyText, "snapchat-classic"), font: "montserrat", fontWeight: 500, value: "Café & <wow> 😭 中文" };
  const svg = await createOutlinedFormatTextSvg(text, 1080, 1920, tools.fontsDir);
  assert.match(svg, /<path d=/); assert.match(svg, /😭/); assert.match(svg, /中文/);
  assert.match(svg, /fill-opacity="0.58"/); assert.doesNotMatch(svg, /<wow>/);
  assert.ok((await sharp(Buffer.from(svg)).png().toBuffer()).length > 1000);
});
