import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { formatPreviewAudioPosition, mapSequencePreviewDemoAudio, sequencePreviewAudioPosition } from "../lib/explore/sequence-preview.ts";

const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const command = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
const edit = { version: 1, format: "hook", trimStartMs: 500, trimEndMs: 1500, originalVolume: 0, musicVolume: 1, text: null };
const samples = (path, start) => command(["-ss", String(start), "-i", path, "-t", "0.15", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
function power(buffer, frequency) {
  let real = 0, imaginary = 0;
  for (let i = 0; i < buffer.length / 4; i++) {
    const phase = 2 * Math.PI * frequency * i / 16000, value = buffer.readFloatLE(i * 4);
    real += value * Math.cos(phase); imaginary += value * Math.sin(phase);
  }
  return real ** 2 + imaginary ** 2;
}
async function fixture(t) {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, "explore-audio-preview-parity-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), parent);
    assert.ok(basename(directory).startsWith("explore-audio-preview-parity-"));
    await rm(directory, { recursive: true, force: true });
  });
  const sourcePath = join(directory, "source.mp4"), musicPath = join(directory, "two-tone.wav");
  command(["-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-c:v", "libx264", "-c:a", "aac", sourcePath]);
  command(["-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=0.5", "-f", "lavfi", "-i", "sine=frequency=1100:duration=1.5", "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]", musicPath]);
  return { directory, sourcePath, musicPath };
}

test("trimmed opening custom-music preview hears the same track section as the real standalone export", async t => {
  const { directory, sourcePath, musicPath } = await fixture(t);
  for (const playback of ["once", "repeat"]) {
    const preview = formatPreviewAudioPosition(2000, 2000, edit, 700, playback);
    assert.equal(preview.positionMs, 700); assert.equal(preview.gain, 1);
    const result = await finishExploreVideo({ sourcePath, backgroundMusicPath: musicPath, backgroundMusicPlayback: playback,
      editing: edit, tools, workDir: join(directory, playback) });
    const actual = samples(result.outputPath, .2), expected = samples(musicPath, preview.positionMs / 1000);
    for (const audio of [actual, expected]) assert.ok(power(audio, 1100) > power(audio, 880) * 100);
  }
});

test("raw trimmed Demo Schedule preview restarts its music exactly like the final composition", async t => {
  const { directory, sourcePath, musicPath } = await fixture(t);
  const segment = { id: "demo", label: "Demo", url: sourcePath, durationSeconds: 2, width: 256, height: 384, editing: edit,
    addedAudio: { url: musicPath, volume: 1, playback: "once", timelineOffsetMs: 500, mixDurationMs: 2000 } };
  const normalized = mapSequencePreviewDemoAudio(segment, { rawComposition: true });
  const audio = normalized.addedAudio;
  const preview = sequencePreviewAudioPosition(2000, audio.mixDurationMs, 200 + audio.timelineOffsetMs, audio.playback);
  assert.equal(preview.positionMs, 200); assert.equal(preview.gain, 1);
  const result = await finishExploreVideo({ sourcePath, demoPath: sourcePath, demoAudioPath: musicPath, demoAudioPlayback: "once", sourceOriginalVolume: 0,
    clipComposition: { version: 1, sourceEditing: null, demoEditing: edit, sourceAudioAssetId: null, sourceAudioPlayback: "once" }, tools, workDir: join(directory, "raw-demo") });
  const actual = samples(result.outputPath, 2.2), expected = samples(musicPath, preview.positionMs / 1000);
  for (const buffer of [actual, expected]) assert.ok(power(buffer, 880) > power(buffer, 1100) * 100);
  assert.equal(mapSequencePreviewDemoAudio(segment, { rawComposition: false }), segment);
});

test("paired reference clip music retains its deliberate post-trim restart in preview and real export", async t => {
  const { directory, sourcePath, musicPath } = await fixture(t);
  const preview = formatPreviewAudioPosition(2000, 2000, edit, 700, "repeat", true);
  assert.equal(preview.positionMs, 200); assert.equal(preview.gain, 1);
  const result = await finishExploreVideo({ sourcePath, referenceAudioPath: musicPath, referenceAudioVolume: 1, editing: edit,
    sourceOriginalVolume: 0, tools, workDir: join(directory, "paired") });
  const actual = samples(result.outputPath, .2), expected = samples(musicPath, preview.positionMs / 1000);
  for (const buffer of [actual, expected]) assert.ok(power(buffer, 880) > power(buffer, 1100) * 100);
  assert.ok(result.referenceAudioBasePath, "The clean base remains available for later edits");
});
