import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { createScribeTranscriptionProvider } from "../worker/dist/subtitles/elevenlabs-provider.js";

const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const hash = buffer => createHash("sha256").update(buffer).digest("hex");
async function workspace(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, "explore-finishing-test-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("explore-finishing-test-"));
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}
function video(path, seconds = 1, frequency = 440) {
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-f", "lavfi", "-i", `color=c=blue:s=256x384:r=2:d=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${seconds}`, "-c:a", "aac", "-c:v", "libx264", "-pix_fmt", "yuv420p", path], { windowsHide: true, timeout: 30000 });
}
const speech = durationMs => ({ schemaVersion: 1, provider: "fixture", model: "offline-only", language: "en", durationMs,
  words: [{ text: "Opening", startMs: 100, endMs: 400 }, { text: "Demo", startMs: 1200, endMs: 1600 }] });
const samples = path => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { windowsHide: true, timeout: 30000 });
const extractAac = path => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-i", path, "-vn", "-c:a", "copy", "-f", "adts", "pipe:1"], { windowsHide: true, timeout: 30000 });
const frame = (path, seconds) => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-ss", String(seconds), "-i", path, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 30000 });
function power(buffer, frequency) {
  let real = 0, imaginary = 0;
  for (let i = 0; i < buffer.length / 4; i++) { const phase = 2 * Math.PI * frequency * i / 16000; const value = buffer.readFloatLE(i * 4); real += value * Math.cos(phase); imaginary += value * Math.sin(phase); }
  return real ** 2 + imaginary ** 2;
}

test("subtitles off finishes without any transcription and leaves source files unchanged", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"); video(sourcePath);
  const before = hash(await readFile(sourcePath));
  const result = await finishExploreVideo({ sourcePath, workDir: join(dir, "render"), tools });
  assert.equal(result.subtitleStyle, null); assert.equal(result.subtitleWordCount, 0);
  assert.ok((await stat(result.outputPath)).size > 0); assert.equal(hash(await readFile(sourcePath)), before);
});

test("all four styles burn actual timed captions onto the combined video, preserve sound and source files", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4");
  video(sourcePath); video(demoPath, 1, 660);
  const originals = await Promise.all([sourcePath, demoPath].map(async path => hash(await readFile(path))));
  for (const style of ["clean", "bold-box", "active-word", "editorial"]) {
    let calls = 0;
    const workDir = join(dir, style);
    const result = await finishExploreVideo({ sourcePath, demoPath, workDir, tools, subtitles: { language: "en", style, loadTranscript: async identity => {
      calls++; assert.equal(identity.language, "en"); assert.equal(identity.durationMs, 2000); assert.equal(identity.sourceHash, hash(await readFile(identity.audioPath)));
      return speech(identity.durationMs);
    } } });
    assert.equal(calls, 1); assert.equal(result.subtitleStyle, style); assert.equal(result.subtitleWordCount, 2);
    const ass = await readFile(join(workDir, "subtitles/captions.ass"), "utf8"); assert.match(ass, /Opening/); assert.match(ass, /Demo/);
    assert.equal(hash(extractAac(result.outputPath)), hash(extractAac(join(workDir, "composed.mp4"))));
    assert.notEqual(hash(await readFile(result.outputPath)), hash(await readFile(join(workDir, "composed.mp4"))));
    const plainFrame = frame(join(workDir, "composed.mp4"), 1.5), captionedFrame = frame(result.outputPath, 1.5);
    assert.equal(plainFrame.length, captionedFrame.length);
    const visibleChanges = captionedFrame.reduce((count, value, index) => count + (Math.abs(value - plainFrame[index]) > 20 ? 1 : 0), 0);
    assert.ok(visibleChanges > 100, `${style} must burn visible caption pixels, not only emit subtitle metadata`);
    assert.deepEqual(await Promise.all([sourcePath, demoPath].map(async path => hash(await readFile(path)))), originals);
  }
});

test("transcription receives original speech only, not either known added background layer", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "music.wav");
  video(sourcePath); video(demoPath, 1, 660);
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=2", demoAudioPath], { windowsHide: true, timeout: 30000 });
  await finishExploreVideo({ sourcePath, demoPath, demoAudioPath, backgroundMusicPath: demoAudioPath, workDir: join(dir, "render"), tools,
    subtitles: { language: "en", style: "clean", loadTranscript: async identity => {
      const audio = samples(identity.audioPath); assert.ok(power(audio, 440) > 100 * power(audio, 880)); assert.ok(power(audio, 660) > 100 * power(audio, 880));
      return speech(identity.durationMs);
    } } });
});

test("Scribe adapter accepts the actual prepared WAV and burns its mocked word timings across both clips", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "music.wav");
  video(sourcePath); video(demoPath, 1, 660);
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=2", demoAudioPath], { windowsHide: true, timeout: 30000 });
  let calls = 0, preparedHash;
  const provider = createScribeTranscriptionProvider("offline-not-real", async (_url, options) => {
    calls++;
    const wav = Buffer.from(await options.body.get("file").arrayBuffer());
    assert.equal(hash(wav), preparedHash);
    const audio = execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { input: wav, windowsHide: true, timeout: 30000 });
    assert.ok(power(audio, 440) > 100 * power(audio, 880));
    assert.ok(power(audio, 660) > 100 * power(audio, 880));
    return Response.json({ language_code: "en", language_probability: 0.98,
      words: [{ type: "word", text: "Opening", start: 0.1, end: 0.4 }, { type: "word", text: "Demo", start: 1.2, end: 1.6 }] });
  });
  const workDir = join(dir, "render");
  const result = await finishExploreVideo({ sourcePath, demoPath, demoAudioPath, workDir, tools,
    subtitles: { language: "en", style: "clean", loadTranscript: async identity => {
      const prepared = await provider.prepare(identity.audioPath, Math.ceil(identity.durationMs));
      preparedHash = identity.sourceHash; assert.equal(prepared.sourceHash, preparedHash); assert.equal(calls, 0);
      return prepared.submit();
    } } });
  assert.equal(calls, 1); assert.equal(result.subtitleWordCount, 2);
  const ass = await readFile(join(workDir, "subtitles/captions.ass"), "utf8");
  assert.match(ass, /Opening/); assert.match(ass, /Demo/);
  assert.notDeepEqual(frame(result.outputPath, 1.5), frame(join(workDir, "composed.mp4"), 1.5));
  assert.equal(hash(extractAac(result.outputPath)), hash(extractAac(join(workDir, "composed.mp4"))));
});

test("invalid style and English scope fail before transcription; overlong videos are not trimmed", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"); video(sourcePath, 61);
  let calls = 0;
  for (const [name, language, style, code] of [["long", "en", "clean", "SUBTITLE_DURATION_UNSUPPORTED"], ["language", "hi", "clean", "SUBTITLE_LANGUAGE_UNSUPPORTED"], ["style", "en", "unknown", "INVALID_STYLE"]]) {
    await assert.rejects(finishExploreVideo({ sourcePath, workDir: join(dir, name), tools, subtitles: { language, style, loadTranscript: async () => { calls++; } } }), error => error.code === code);
    await assert.rejects(stat(join(dir, name)), error => error.code === "ENOENT");
  }
  assert.equal(calls, 0);
});

test("missing fonts fail before any transcript request", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"); video(sourcePath);
  let calls = 0;
  await assert.rejects(finishExploreVideo({ sourcePath, workDir: join(dir, "render"), tools: { ...tools, fontsDir: join(dir, "missing") },
    subtitles: { language: "en", style: "clean", loadTranscript: async () => { calls++; } } }));
  assert.equal(calls, 0);
});

test("non-English, missing language, no speech or invalid timings never publish a captioned result", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"); video(sourcePath); video(demoPath);
  let index = 0;
  for (const change of [{ language: "hi" }, { language: null }, { words: [] }, { words: [{ text: "bad", startMs: 100, endMs: 3000 }] }]) {
    const workDir = join(dir, `rejected-${index++}`);
    await assert.rejects(finishExploreVideo({ sourcePath, demoPath, workDir, tools,
      subtitles: { language: "en", style: "clean", loadTranscript: async ({ durationMs }) => ({ ...speech(durationMs), ...change }) } }));
    await assert.rejects(stat(join(workDir, "subtitles/captioned.mp4")), error => error.code === "ENOENT");
  }
});

test("an existing output directory blocks replay before requesting another transcript", async t => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), workDir = join(dir, "render"); video(sourcePath); await mkdir(workDir);
  let calls = 0;
  await assert.rejects(finishExploreVideo({ sourcePath, workDir, tools, subtitles: { language: "en", style: "clean", loadTranscript: async () => { calls++; } } }), /EEXIST/);
  assert.equal(calls, 0);
});
