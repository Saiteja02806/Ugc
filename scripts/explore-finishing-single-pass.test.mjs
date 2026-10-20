import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test, { mock } from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import * as media from "../worker/dist/subtitles/media.js";

let videoEncodes = 0;
mock.module("../worker/dist/subtitles/media.js", { namedExports: { ...media,
  runMediaCommand: async (program, args, options) => {
    if (program === ffmpeg && args.some((arg, index) => arg === "-c:v" && args[index + 1] === "libx264")) videoEncodes++;
    return media.runMediaCommand(program, args, options);
  },
} });
const { finishExploreVideo } = await import("../worker/dist/lib/explore-video-finishing.js");
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const hash = buffer => createHash("sha256").update(buffer).digest("hex");
const command = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
async function workspace(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "explore-single-pass-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("explore-single-pass-"));
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}
function source(path, withAudio = true) {
  command(["-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=3",
    ...(withAudio ? ["-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "aac"] : []),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", path]);
}
const edit = patch => ({ version: 1, format: "hook", trimStartMs: 500, trimEndMs: 2500, originalVolume: .5, musicVolume: .2, text: null, ...patch });
const frame = (path, time) => command(["-ss", String(time), "-i", path, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
const samples = (path, start) => command(["-ss", String(start), "-i", path, "-t", "0.2", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
function power(buffer, frequency) {
  let real = 0, imaginary = 0;
  for (let i = 0; i < buffer.length / 4; i++) {
    const phase = 2 * Math.PI * frequency * i / 16000, value = buffer.readFloatLE(i * 4);
    real += value * Math.cos(phase); imaginary += value * Math.sin(phase);
  }
  return real ** 2 + imaginary ** 2;
}
function colors(buffer) {
  let red = 0, white = 0;
  for (let i = 0; i < buffer.length; i += 3) {
    if (buffer[i] > 140 && buffer[i + 1] < 100 && buffer[i + 2] < 120) red++;
    if (buffer[i] > 190 && buffer[i + 1] > 190 && buffer[i + 2] > 190) white++;
  }
  return { red, white };
}

test("one real encode preserves trimmed mixed text timing, music offset and immutable inputs", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "source.mp4"), backgroundMusicPath = join(dir, "music.wav");
  source(sourcePath);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", "-f", "lavfi", "-i", "sine=frequency=1100:duration=2", "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]", backgroundMusicPath]);
  const originals = await Promise.all([sourcePath, backgroundMusicPath].map(async path => hash(await readFile(path))));
  const text = { width: .8, y: .1, fontSize: 60, startMs: 100, endMs: 500 };
  videoEncodes = 0;
  const result = await finishExploreVideo({ sourcePath, backgroundMusicPath, workDir: join(dir, "render"), tools,
    editing: edit({ textOverlays: [
      { ...text, value: "FIRST", color: "#ff0000" },
      { ...text, value: "SECOND", color: "#ffffff", startMs: 1100, endMs: 1600, preset: "snapchat-classic" },
    ] }),
  });
  assert.equal(videoEncodes, 1); assert.ok(Math.abs(result.durationMs - 2000) < 50);
  const first = colors(frame(result.outputPath, .3)), gap = colors(frame(result.outputPath, .8)), second = colors(frame(result.outputPath, 1.3));
  assert.ok(first.red > 30); assert.equal(first.white, 0); assert.deepEqual(gap, { red: 0, white: 0 }); assert.ok(second.white > 30); assert.equal(second.red, 0);
  const early = samples(result.outputPath, .15), later = samples(result.outputPath, .65);
  assert.ok(power(early, 440) > power(early, 880)); assert.ok(power(early, 880) > power(early, 1100) * 100);
  assert.ok(power(later, 1100) > power(later, 880) * 100, "music keeps its original pre-trim position rather than restarting");
  assert.deepEqual(await Promise.all([sourcePath, backgroundMusicPath].map(async path => hash(await readFile(path)))), originals);
});

test("one real encode handles silent source clips and validates trims before rendering", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "silent.mp4"); source(sourcePath, false);
  videoEncodes = 0;
  const result = await finishExploreVideo({ sourcePath, workDir: join(dir, "render"), tools, editing: edit({ originalVolume: 0 }) });
  assert.equal(videoEncodes, 1); assert.equal(result.durationMs, 2000);
  const audio = samples(result.outputPath, .2); assert.ok(audio.length > 0);
  assert.ok(power(audio, 440) < .001);
  videoEncodes = 0;
  await assert.rejects(finishExploreVideo({ sourcePath, workDir: join(dir, "invalid"), tools, editing: edit({ trimEndMs: 3500 }) }), /beyond this video/);
  assert.equal(videoEncodes, 0); await assert.rejects(stat(join(dir, "invalid")), error => error.code === "ENOENT");
});

test("paired reference audio still starts at the trimmed clip beginning and preserves the unmixed base", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "source.mp4"), referenceAudioPath = join(dir, "reference.wav"); source(sourcePath);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", "-f", "lavfi", "-i", "sine=frequency=1100:duration=2", "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]", referenceAudioPath]);
  videoEncodes = 0;
  const result = await finishExploreVideo({ sourcePath, referenceAudioPath, referenceAudioVolume: .2, workDir: join(dir, "render"), tools, editing: edit({ originalVolume: 1 }) });
  assert.equal(videoEncodes, 1); assert.ok(result.referenceAudioBasePath);
  const early = samples(result.outputPath, .65), later = samples(result.outputPath, 1.2);
  assert.ok(power(early, 880) > power(early, 1100) * 100, "paired music starts after the trim");
  assert.ok(power(later, 1100) > power(later, 880) * 100);
  assert.ok(power(samples(result.referenceAudioBasePath, .65), 880) < power(early, 880) / 100);
});
