import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { composeExploreVideo, buildExploreCompositionFilter } from "../worker/dist/lib/explore-video-composition.js";

const tools = { ffmpeg, ffprobe: ffprobe.path };
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
async function workspace(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, "explore-composition-test-"));
  t.after(async () => {
    if (dirname(resolve(path)) !== parent || !basename(path).startsWith("explore-composition-test-")) throw new Error("Unsafe fixture cleanup path");
    await rm(path, { recursive: true, force: true });
  });
  return path;
}
function video(path, { seconds = 1, color = "blue", size = "128x128", audio = true, offset = false } = {}) {
  const args = ["-nostdin", "-v", "error", "-n", "-f", "lavfi", "-i", `color=c=${color}:s=${size}:r=2:d=${seconds}`];
  if (audio) args.push("-f", "lavfi", ...(offset ? ["-itsoffset", "0.5"] : []), "-i", `sine=frequency=440:duration=${seconds}`, "-c:a", "aac");
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", path);
  execFileSync(ffmpeg, args, { windowsHide: true, timeout: 30_000 });
}
function audio(path, seconds, frequency = 880) {
  execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${seconds}`, "-c:a", path.endsWith(".mp3") ? "libmp3lame" : "pcm_s16le", path], { windowsHide: true, timeout: 30_000 });
}
function samples(path, start, seconds) {
  return execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-ss", String(start), "-i", path, "-t", String(seconds), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { windowsHide: true, timeout: 30_000 });
}
function energy(buffer) {
  let sum = 0;
  for (let offset = 0; offset < buffer.length; offset += 4) sum += buffer.readFloatLE(offset) ** 2;
  return sum / (buffer.length / 4);
}
function tonePower(buffer, frequency) {
  let real = 0, imaginary = 0;
  const count = buffer.length / 4;
  for (let index = 0; index < count; index++) {
    const value = buffer.readFloatLE(index * 4), phase = 2 * Math.PI * frequency * index / 16000;
    real += value * Math.cos(phase); imaginary += value * Math.sin(phase);
  }
  return (real ** 2 + imaginary ** 2) / count ** 2;
}

test("filter preserves opening/demo order and original audio; added background is demo-only and defaults to play once", () => {
  const parts = [{ width: 128, height: 192, durationMs: 15_000, videoIndex: 0, audioIndex: 1 }, { width: 192, height: 128, durationMs: 45_000, videoIndex: 0, audioIndex: 1 }];
  const filter = buildExploreCompositionFilter(parts, { audioIndex: 0, durationMs: 60_000 });
  assert.match(filter, /\[v0\]\[a0\]\[v1\]\[a1\]concat=n=2/);
  assert.match(filter, /\[original0\]anull\[a0\]/);
  assert.match(filter, /\[2:0\].*volume=0.2.*atrim=duration=45/);
  assert.match(filter, /\[original1\]\[background\]amix=inputs=2:duration=first/);
  assert.match(filter, /force_original_aspect_ratio=decrease.*pad=128:192/);
  assert.doesNotMatch(filter, /crop|aloop|loop=|drawtext|ass=/);
});

test("a hook on its own exports a new playable derivative without overwriting its source", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4");
  video(sourcePath);
  const original = digest(await readFile(sourcePath));
  const result = await composeExploreVideo({ sourcePath, workDir: join(dir, "render"), tools });
  assert.ok((await stat(result.outputPath)).size > 0);
  assert.equal(result.width, 128); assert.equal(result.height, 128);
  assert.equal(result.segments.length, 1); assert.equal(result.segments[0].hasOriginalAudio, true);
  assert.ok(Math.abs(result.durationMs - 1000) < 150);
  assert.deepEqual(result.sourceHashes, [original]);
  assert.equal(digest(await readFile(sourcePath)), original);
  await assert.rejects(composeExploreVideo({ sourcePath, workDir: join(dir, "render"), tools }), /EEXIST/);
  assert.equal(digest(await readFile(sourcePath)), original);
});

test("a measured 31+29-second sequence is accepted for English subtitles; originals and framing are preserved", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4");
  video(sourcePath, { seconds: 31, size: "128x192", audio: false });
  video(demoPath, { seconds: 29, size: "192x128", color: "red" });
  const originals = await Promise.all([sourcePath, demoPath].map(async (path) => digest(await readFile(path))));
  const result = await composeExploreVideo({ sourcePath, demoPath, workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  assert.equal(result.measuredDurationMs, 60_000);
  assert.ok(Math.abs(result.durationMs - 60_000) < 150);
  assert.deepEqual(result.segments.map((part) => part.kind), ["opening", "demo"]);
  assert.deepEqual(result.segments.map((part) => part.hasOriginalAudio), [false, true]);
  assert.equal(result.width, 128); assert.equal(result.height, 192);
  assert.ok(energy(samples(result.outputPath, 0.2, 0.3)) < 1e-8);
  assert.ok(energy(samples(result.outputPath, 31.2, 0.3)) > 1e-5);
  assert.deepEqual(await Promise.all([sourcePath, demoPath].map(async (path) => digest(await readFile(path)))), originals);
  assert.deepEqual(result.sourceHashes, originals);
});

test("over-60-second combined sequences and non-English subtitles fail before creating outputs; no trimming", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4");
  video(sourcePath, { seconds: 31 }); video(demoPath, { seconds: 30 });
  for (const [name, language, code] of [["long", "en", "SUBTITLE_DURATION_UNSUPPORTED"], ["language", "hi", "SUBTITLE_LANGUAGE_UNSUPPORTED"]]) {
    const workDir = join(dir, name);
    await assert.rejects(composeExploreVideo({ sourcePath, demoPath, workDir, tools, subtitleScope: { language } }), { code });
    await assert.rejects(stat(workDir), { code: "ENOENT" });
  }
  // The subtitle cap does not cut otherwise-valid videos when subtitles are off.
  const result = await composeExploreVideo({ sourcePath, demoPath, workDir: join(dir, "no-subtitles"), tools });
  assert.equal(result.measuredDurationMs, 61_000);
  assert.ok(result.durationMs > 60_000);
});

test("background audio is audible only in the demo; a shorter track ends without looping", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "background.wav");
  video(sourcePath, { audio: false }); video(demoPath, { seconds: 2, audio: false }); audio(demoAudioPath, 1);
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, workDir: join(dir, "render"), tools });
  assert.equal(result.hasDemoBackgroundAudio, true);
  assert.ok(energy(samples(result.outputPath, 0.2, 0.2)) < 1e-8);
  assert.ok(energy(samples(result.outputPath, 1.2, 0.2)) > 1e-5);
  assert.ok(energy(samples(result.outputPath, 2.4, 0.2)) < 1e-8);
});

test("original opening and demo speech are preserved, with final mixed audio on the subtitle timeline", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), backgroundMusicPath = join(dir, "music.wav");
  video(sourcePath); video(demoPath, { seconds: 2 }); audio(backgroundMusicPath, 3, 1300);
  const originals = await Promise.all([sourcePath, demoPath, backgroundMusicPath].map(async (path) => digest(await readFile(path))));
  const result = await composeExploreVideo({ sourcePath, demoPath, backgroundMusicPath, workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  assert.equal(result.hasBackgroundMusic, true);
  assert.ok(result.subtitleAudioPath);
  const opening = samples(result.subtitleAudioPath, 0.2, 0.2), demo = samples(result.subtitleAudioPath, 1.2, 0.2), playback = samples(result.outputPath, 1.2, 0.2);
  assert.ok(tonePower(opening, 440) > 1e-4);
  assert.ok(tonePower(demo, 440) > 1e-4, "The demo's original voice must be preserved");
  assert.ok(tonePower(demo, 1300) > 1e-5, "Transcription uses the final mixed soundtrack");
  assert.ok(tonePower(playback, 1300) > 1e-5, "Background music remains audible in the rendered soundtrack");
  assert.ok(tonePower(samples(result.subtitleAudioPath, 2.4, 0.2), 440) > 1e-4, "The original demo voice continues for the whole demo");
  assert.deepEqual(await Promise.all([sourcePath, demoPath, backgroundMusicPath].map(async (path) => digest(await readFile(path)))), originals);
});

test("uploaded demo audio mixes underneath original demo audio and never enters the opening, and shares the final subtitle timeline", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "background.wav");
  video(sourcePath); video(demoPath, { seconds: 2 }); audio(demoAudioPath, 1, 880);
  const inputs = [sourcePath, demoPath, demoAudioPath];
  const originals = await Promise.all(inputs.map(async (path) => digest(await readFile(path))));
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  const opening = samples(result.outputPath, 0.2, 0.2), demo = samples(result.outputPath, 1.2, 0.2), ending = samples(result.outputPath, 2.4, 0.2);
  assert.ok(tonePower(opening, 440) > 1e-4, "Original opening sound remains audible");
  assert.ok(tonePower(opening, 880) < 1e-7, "Uploaded demo audio must never play during the opening");
  assert.ok(tonePower(demo, 440) > 1e-4, "Original demo sound remains audible alongside the upload");
  assert.ok(tonePower(demo, 880) > 1e-5, "Uploaded audio is audible during the demo");
  assert.ok(tonePower(demo, 880) < tonePower(demo, 440) * 0.1, "The uploaded layer plays underneath the original sound");
  assert.ok(tonePower(ending, 440) > 1e-4, "Original demo sound continues after the uploaded track ends");
  assert.ok(tonePower(ending, 880) < 1e-7, "Uploaded audio does not loop");
  const speech = samples(result.subtitleAudioPath, 1.2, 0.2);
  assert.ok(tonePower(speech, 440) > 1e-4);
  assert.ok(tonePower(speech, 880) > 1e-5, "Added audio shares the final subtitle timeline");
  assert.deepEqual(await Promise.all(inputs.map(async (path) => digest(await readFile(path)))), originals);
});

test("demo-only layers share the final subtitle track while the silent opening stays silent", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "background.wav");
  video(sourcePath, { audio: false }); video(demoPath, { audio: false }); audio(demoAudioPath, 1);
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  assert.ok(energy(samples(result.outputPath, 1.2, 0.2)) > 1e-5);
  assert.ok(energy(samples(result.subtitleAudioPath, 1.2, 0.2)) > 1e-5);
});

test("audio without a demo, invalid playback, cancelled, offset-video and remote inputs fail safely", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "background.wav");
  video(sourcePath); video(demoPath); audio(demoAudioPath, 2);
  const shared = { sourcePath, demoPath, demoAudioPath, workDir: join(dir, "should-not-exist"), tools };
  await assert.rejects(composeExploreVideo({ ...shared, demoPath: undefined }), { code: "COMPOSITION_DEMO_REQUIRED" });
  await assert.rejects(composeExploreVideo({ ...shared, demoAudioPlayback: "auto" }), { code: "COMPOSITION_AUDIO_INVALID" });
  await assert.rejects(composeExploreVideo({ ...shared, backgroundMusicPlayback: "repeat" }), { code: "COMPOSITION_INPUT_INVALID" });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(composeExploreVideo({ ...shared, signal: controller.signal }), { name: "AbortError" });
  await assert.rejects(composeExploreVideo({ ...shared, sourcePath: "https://untrusted.example/source.mp4" }), { code: "COMPOSITION_INPUT_INVALID" });
  const offset = join(dir, "offset.mp4"); video(offset, { offset: true });
  await assert.rejects(composeExploreVideo({ sourcePath: offset, workDir: shared.workDir, tools }), { code: "COMPOSITION_TIMELINE_UNSUPPORTED" });
  await assert.rejects(stat(shared.workDir), { code: "ENOENT" });
});

test("longer demo background audio is fitted and faded without shortening videos or changing sources", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "long.wav");
  video(sourcePath); video(demoPath, { seconds: 2 }); audio(demoAudioPath, 4);
  const paths = [sourcePath, demoPath, demoAudioPath], original = await Promise.all(paths.map(async (path) => digest(await readFile(path))));
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  assert.equal(result.demoAudioTiming.fit, "trim");
  assert.ok(Math.abs(result.durationMs - 3000) < 150);
  const middle = samples(result.outputPath, 1.5, 0.1), ending = samples(result.outputPath, 2.94, 0.04);
  assert.ok(tonePower(middle, 440) > 1e-4);
  assert.ok(tonePower(middle, 880) > 1e-5);
  assert.ok(tonePower(ending, 880) < tonePower(middle, 880) * 0.2, "Only the added soundtrack fades out at the demo end");
  assert.ok(tonePower(ending, 440) > 1e-4, "Original demo speech is not faded");
  assert.deepEqual(await Promise.all(paths.map(async (path) => digest(await readFile(path)))), original);
});

test("explicitly repeated short demo music covers the demo, never the opening, and shares final subtitle audio", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "short.wav");
  video(sourcePath); video(demoPath, { seconds: 2 }); audio(demoAudioPath, 0.5);
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, demoAudioPlayback: "repeat", workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  assert.equal(result.demoAudioTiming.fit, "loop");
  assert.ok(tonePower(samples(result.outputPath, 0.4, 0.1), 880) < 1e-7);
  assert.ok(tonePower(samples(result.outputPath, 2.5, 0.1), 880) > 1e-5, "The short track continues when explicitly repeated");
  assert.ok(tonePower(samples(result.subtitleAudioPath, 2.5, 0.1), 880) > 1e-5);
  assert.ok(tonePower(samples(result.subtitleAudioPath, 2.5, 0.1), 440) > 1e-4);
  assert.ok(Math.abs(result.durationMs - 3000) < 150);
});

test("whole-video music and separate demo audio use distinct inputs and share the final subtitle audio", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "demo-audio.wav"), backgroundMusicPath = join(dir, "whole-video.wav");
  video(sourcePath); video(demoPath, { seconds: 2 }); audio(demoAudioPath, 4, 880); audio(backgroundMusicPath, 0.5, 1300);
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, backgroundMusicPath, backgroundMusicPlayback: "repeat", workDir: join(dir, "render"), tools, subtitleScope: { language: "en" } });
  assert.equal(result.demoAudioTiming.fit, "trim");
  assert.equal(result.backgroundMusicTiming.fit, "loop");
  const opening = samples(result.outputPath, 0.5, 0.1), demo = samples(result.outputPath, 2.5, 0.1), speech = samples(result.subtitleAudioPath, 2.5, 0.1);
  assert.ok(tonePower(opening, 440) > 1e-4);
  assert.ok(tonePower(opening, 1300) > 1e-5);
  assert.ok(tonePower(opening, 880) < 1e-7);
  for (const frequency of [880, 1300]) {
    assert.ok(tonePower(demo, frequency) > 1e-5);
    assert.ok(tonePower(speech, frequency) > 1e-5);
  }
  assert.ok(tonePower(speech, 440) > 1e-4);
  assert.ok(Math.abs(result.durationMs - 3000) < 150);
});

test("MP3 encoder-delay metadata is normalized for added audio without weakening original-video timing checks", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), demoPath = join(dir, "demo.mp4"), demoAudioPath = join(dir, "music.mp3");
  video(sourcePath); video(demoPath, { seconds: 2 }); audio(demoAudioPath, 1);
  const metadata = JSON.parse(execFileSync(tools.ffprobe, ["-v", "error", "-show_streams", "-of", "json", demoAudioPath], { windowsHide: true, encoding: "utf8" }));
  assert.ok(Number(metadata.streams.find((stream) => stream.codec_type === "audio").start_time) > 0, "This fixture must exercise a real MP3 encoder delay");
  const result = await composeExploreVideo({ sourcePath, demoPath, demoAudioPath, demoAudioPlayback: "repeat", workDir: join(dir, "render"), tools });
  assert.ok(tonePower(samples(result.outputPath, 2.5, 0.1), 880) > 1e-5);
  assert.ok(tonePower(samples(result.outputPath, 0.5, 0.1), 880) < 1e-7);
  assert.ok(Math.abs(result.durationMs - 3000) < 150);
});

test("a library track longer than the video input cap is fitted, while the video cap stays unchanged", async (t) => {
  const dir = await workspace(t), sourcePath = join(dir, "opening.mp4"), backgroundMusicPath = join(dir, "long-library-track.wav");
  video(sourcePath, { seconds: 2 }); audio(backgroundMusicPath, 122, 1300);
  const result = await composeExploreVideo({ sourcePath, backgroundMusicPath, workDir: join(dir, "render"), tools });
  assert.equal(result.backgroundMusicTiming.sourceDurationMs, 122_000);
  assert.equal(result.backgroundMusicTiming.fit, "trim");
  assert.equal(result.measuredDurationMs, 2000);
  assert.ok(Math.abs(result.durationMs - 2000) < 150);
  assert.ok(tonePower(samples(result.outputPath, 0.5, 0.1), 1300) > 1e-5);
  const overlong = join(dir, "overlong.mp4"); video(overlong, { seconds: 121, audio: false });
  const workDir = join(dir, "must-not-render");
  await assert.rejects(composeExploreVideo({ sourcePath: overlong, workDir, tools }), { code: "COMPOSITION_DURATION_INVALID" });
  await assert.rejects(stat(workDir), { code: "ENOENT" });
});
