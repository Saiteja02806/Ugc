import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { probeAudio } from "./audio-media.ts";

// Use the already installed Windows tools locally; the Linux worker image
// includes ffmpeg and ffprobe on PATH. No provider calls or downloaded fixtures.
if (process.platform === "win32") {
  const ffmpeg = resolve("node_modules/ffmpeg-static/ffmpeg.exe");
  const ffprobe = resolve("node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");
  if (existsSync(ffmpeg)) process.env.FFMPEG_PATH = ffmpeg;
  if (existsSync(ffprobe)) process.env.FFPROBE_PATH = ffprobe;
}
const execute = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), "ugc-audio-media-tests-"));
after(() => rm(directory, { recursive: true, force: true }));

function wave(seconds = 1) {
  const sampleRate = 16000; const dataSize = Math.floor(seconds * sampleRate) * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF",0); buffer.writeUInt32LE(36 + dataSize,4); buffer.write("WAVEfmt ",8);
  buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(1,20); buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(sampleRate,24); buffer.writeUInt32LE(sampleRate * 2,28);
  buffer.writeUInt16LE(2,32); buffer.writeUInt16LE(16,34); buffer.write("data",36); buffer.writeUInt32LE(dataSize,40);
  for (let index = 0; index < dataSize / 2; index++) buffer.writeInt16LE(Math.round(Math.sin(index * 2 * Math.PI * 440 / sampleRate) * 1000),44 + index * 2);
  return buffer;
}
const input = join(directory,"sample.wav"); await writeFile(input,wave());
async function convert(name,args) {
  const output = join(directory,name);
  await execute(process.env.FFMPEG_PATH || "ffmpeg",["-v","error","-y","-i",input,...args,output],{ windowsHide:true });
  return readFile(output);
}

test("actual audio tools accept complete WAV and supported encoded containers", async () => {
  assert.ok(Math.abs(await probeAudio(wave()) - 1) < 0.1);
  for (const [name,args] of [["sample.mp3",["-c:a","libmp3lame"]],["sample.m4a",["-c:a","aac"]],["sample.ogg",["-c:a","libvorbis"]],["sample.webm",["-c:a","libopus"]]]) {
    assert.ok(await probeAudio(await convert(name,args)) > 0, `${name} should remain supported`);
  }
});

test("a local-file playlist is rejected before following its recording references", async () => {
  const escaped = input.replaceAll("\\","/").replaceAll("'","'\\''");
  const playlist = Buffer.from(`ffconcat version 1.0\nfile '${escaped}'\n`);
  await assert.rejects(probeAudio(playlist), /complete, playable|validation failed/i);
  const manifest = Buffer.from(`#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n${escaped}\n#EXT-X-ENDLIST\n`);
  await assert.rejects(probeAudio(manifest), /complete, playable|validation failed/i);
});

test("uploads cannot include video or exceed three minutes", async () => {
  const output = join(directory,"video.mp4");
  await execute(process.env.FFMPEG_PATH || "ffmpeg",["-v","error","-y","-f","lavfi","-i","color=c=black:s=32x32:d=1","-i",input,"-shortest","-c:v","libx264","-c:a","aac",output],{ windowsHide:true });
  await assert.rejects(probeAudio(await readFile(output)), /without video/);
  await assert.rejects(probeAudio(wave(180.1)), /shorter than three minutes/);
});

test("malformed recordings and undersized files are rejected", async () => {
  await assert.rejects(probeAudio(new Uint8Array(20)), /size/);
  await assert.rejects(probeAudio(Buffer.from("not an audio recording".repeat(10))), /complete, playable|validation failed/i);
});
