import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";

const command = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000 });
function power(path, time, frequency) {
  const buffer = command(["-ss", String(time), "-i", path, "-t", "0.2", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
  let real = 0, imaginary = 0;
  for (let i = 0; i < buffer.length / 4; i++) { const phase = 2 * Math.PI * frequency * i / 16000, sample = buffer.readFloatLE(i * 4); real += sample * Math.cos(phase); imaginary += sample * Math.sin(phase); }
  return real ** 2 + imaginary ** 2;
}

test("render keeps opening speech, demo-only audio and continuous music in their separate time ranges", async t => {
  const parent = resolve(".tmp"); await mkdir(parent, { recursive: true }); const dir = await mkdtemp(join(parent, "talking-head-music-mix-"));
  t.after(async () => { assert.equal(dirname(resolve(dir)), parent); assert.ok(basename(dir).startsWith("talking-head-music-mix-")); await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });
  const opening = join(dir, "opening.mp4"), demo = join(dir, "demo.mp4"), music = join(dir, "music.wav"), demoAudio = join(dir, "demo.wav");
  for (const [path, frequency] of [[opening, 440], [demo, 660]]) command(["-n", "-f", "lavfi", "-i", "color=c=blue:s=160x240:r=24:d=2", "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=2`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path]);
  for (const [path, frequency] of [[music, 880], [demoAudio, 1100]]) command(["-n", "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=1`, path]);
  const edited = { version: 1, format: "hook", trimStartMs: 500, trimEndMs: 1500, originalVolume: .7, musicVolume: .2, text: null };
  const result = await finishExploreVideo({ sourcePath: opening, demoPath: demo, demoAudioPath: demoAudio, demoAudioPlayback: "repeat", backgroundMusicPath: music, backgroundMusicPlayback: "repeat",
    clipComposition: { version: 1, sourceEditing: edited, demoEditing: edited, sourceAudioPlayback: "once" },
    tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") }, workDir: join(dir, "final") });
  assert.ok(Math.abs(result.durationMs - 2000) < 100);
  assert.ok(power(result.outputPath, .3, 440) > power(result.outputPath, .3, 660) * 100, "Opening speech remains audible");
  assert.ok(power(result.outputPath, 1.3, 660) > power(result.outputPath, 1.3, 440) * 100, "Demo original sound remains in demo");
  assert.ok(power(result.outputPath, 1.3, 1100) > power(result.outputPath, .3, 1100) * 100, "Demo attachment starts only with demo");
  assert.ok(power(result.outputPath, .3, 880) > power(result.outputPath, .3, 1100) * 100, "Whole-video music starts with opening");
  assert.ok(power(result.outputPath, 1.3, 880) > power(result.outputPath, 1.3, 440) * 100, "Whole-video music continues through demo");
});
