import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import { composeExploreVideo } from "../worker/dist/lib/explore-video-composition.js";

const run = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
const tools = { ffmpeg, ffprobe: ffprobe.path };
const digest = async path => createHash("sha256").update(await readFile(path)).digest("hex");
async function workspace(t) {
  const parent = resolve(".tmp/demo-framing-render-tests"); await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, "fixture-"));
  t.after(async () => { if (dirname(resolve(directory)) !== parent || !basename(directory).startsWith("fixture-")) throw new Error("Unsafe fixture cleanup"); await rm(directory, { recursive: true, force: true }); });
  return directory;
}
async function inputs(directory) {
  const sourcePath = join(directory, "opening.mp4"), demoPath = join(directory, "demo.mp4"), gradientPath = join(directory, "gradient.png");
  const pixels = Buffer.alloc(384 * 256 * 3);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 384; x++) {
    const offset = (y * 384 + x) * 3; pixels[offset] = Math.round(x * 255 / 383); pixels[offset + 1] = 60; pixels[offset + 2] = 60;
  }
  await sharp(pixels, { raw: { width: 384, height: 256, channels: 3 } }).png().toFile(gradientPath);
  run(["-n", "-f", "lavfi", "-i", "color=c=blue:s=128x256:r=30:d=1", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath]);
  run(["-n", "-loop", "1", "-framerate", "30", "-i", gradientPath, "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=4", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", demoPath]);
  return { sourcePath, demoPath };
}
const framing = { version: 1, width: 1 / 3, height: 1, points: [[0, 0, 0], [1000, 0, 0], [3000, 2 / 3, 0], [4000, 2 / 3, 0]] };
test("real export pans continuously at DEMO timestamps, preserves the opening, all source files, speech and total duration", async t => {
  const directory = await workspace(t), input = await inputs(directory);
  const before = await Promise.all([digest(input.sourcePath), digest(input.demoPath)]);
  const result = await composeExploreVideo({ ...input, demoFraming: framing, workDir: join(directory, "render"), tools, subtitleScope: { language: "en" } });
  assert.equal(result.width, 128); assert.equal(result.height, 256); assert.ok(Math.abs(result.durationMs - 5000) < 150);
  assert.deepEqual(result.segments.map(segment => segment.hasOriginalAudio), [true, true]);
  assert.deepEqual(await Promise.all([digest(input.sourcePath), digest(input.demoPath)]), before);
  const samples = run(["-i", result.outputPath, "-vf", "format=rgb24,crop=1:1:64:128:exact=1", "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
  const red = Array.from({ length: samples.length / 3 }, (_, i) => samples[i * 3]);
  assert.equal(red.length, 150); assert.ok(red[10] < 10, "The opening must stay blue, never cropped or shifted");
  const hold = red.slice(32, 59), movement = red.slice(60, 121), finish = red.slice(123);
  assert.ok(Math.max(...hold) - Math.min(...hold) <= 4);
  assert.ok(movement[movement.length - 1] - movement[0] > 150);
  assert.ok(Math.max(...movement.slice(1).map((value, i) => Math.abs(value - movement[i]))) <= 8, "There must be no hard cut between recorded positions");
  assert.ok(Math.max(...finish) - Math.min(...finish) <= 4);
  const speech = run(["-i", result.subtitleAudioPath, "-ss", "2.5", "-t", "0.2", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
  let energy = 0; for (let offset = 0; offset < speech.length; offset += 4) energy += speech.readFloatLE(offset) ** 2;
  assert.ok(energy / (speech.length / 4) > .0001, "Cropping must not remove original demo speech");
  assert.ok((await stat(join(directory, "render/composition.filter"))).size > 0);
});
test("framing mismatch, excessive timeline, invalid coordinates and missing demo fail before output/transcription", async t => {
  const directory = await workspace(t), input = await inputs(directory);
  for (const [name, demoFraming] of [["aspect", { ...framing, width: .5 }], ["time", { ...framing, points: [[0, 0, 0], [9000, .3, 0]] }], ["bounds", { ...framing, points: [[0, .9, 0]] }]]) {
    const workDir = join(directory, name);
    await assert.rejects(composeExploreVideo({ ...input, demoFraming, workDir, tools }));
    await assert.rejects(stat(workDir), { code: "ENOENT" });
  }
  await assert.rejects(composeExploreVideo({ sourcePath: input.sourcePath, demoFraming: framing, workDir: join(directory, "missing"), tools }), /Add a demo/);
});
test("the maximum 512-point path renders through a file instead of an oversized shell argument", async t => {
  const directory = await workspace(t), input = await inputs(directory);
  const points = Array.from({ length: 512 }, (_, i) => [i * 7, i % 2 ? .6 : 0, 0]);
  const result = await composeExploreVideo({ ...input, demoFraming: { ...framing, points }, workDir: join(directory, "maximum"), tools });
  assert.ok((await stat(result.outputPath)).size > 0);
});

test("rotated phone footage supports a vertical pan in decoded display coordinates", async t => {
  const directory=await workspace(t), input=await inputs(directory);
  const opening=join(directory,"wide-opening.mp4"), rotated=join(directory,"rotated.mp4");
  run(["-n","-f","lavfi","-i","color=c=blue:s=256x128:r=30:d=1","-c:v","libx264","-pix_fmt","yuv420p",opening]);
  run(["-n","-display_rotation","90","-i",input.demoPath,"-c","copy",rotated]);
  const rotationProbe=JSON.parse(execFileSync(tools.ffprobe,["-v","error","-show_streams","-of","json",rotated],{windowsHide:true}));
  assert.ok(rotationProbe.streams.some(stream=>stream.side_data_list?.some(side=>Math.abs(side.rotation)===90)),"Fixture must contain real rotation metadata");
  const result=await composeExploreVideo({sourcePath:opening,demoPath:rotated,demoFraming:{version:1,width:1,height:1/3,points:[[0,0,0],[1000,0,0],[3000,0,2/3],[4000,0,2/3]]},workDir:join(directory,"rotated-render"),tools});
  assert.equal(result.width,256);assert.equal(result.height,128);assert.ok(Math.abs(result.durationMs-5000)<150);
  const pixels=run(["-i",result.outputPath,"-vf","format=rgb24,crop=1:1:128:64:exact=1","-an","-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
  const red=Array.from({length:pixels.length/3},(_,i)=>pixels[i*3]);
  assert.ok(red[10]<10);assert.ok(Math.abs(red[121]-red[60])>150);
  assert.ok(Math.max(...red.slice(61,122).map((v,i)=>Math.abs(v-red[i+60])))<=8);
});

test("non-square pixels are normalized before horizontal crop movement", async t => {
  const directory=await workspace(t), input=await inputs(directory);
  const opening=join(directory,"wide-opening.mp4"), anamorphic=join(directory,"anamorphic.mp4");
  run(["-n","-f","lavfi","-i","color=c=blue:s=256x128:r=30:d=1","-c:v","libx264","-pix_fmt","yuv420p",opening]);
  run(["-n","-i",input.demoPath,"-vf","setsar=2","-c:v","libx264","-pix_fmt","yuv420p","-c:a","copy",anamorphic]);
  const result=await composeExploreVideo({sourcePath:opening,demoPath:anamorphic,demoFraming:{version:1,width:2/3,height:1,points:[[0,0,0],[1000,0,0],[3000,1/3,0],[4000,1/3,0]]},workDir:join(directory,"sar-render"),tools});
  assert.equal(result.width,256);assert.equal(result.height,128);
  const pixels=run(["-i",result.outputPath,"-vf","format=rgb24,crop=1:1:128:64:exact=1","-an","-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
  const red=Array.from({length:pixels.length/3},(_,i)=>pixels[i*3]);
  assert.ok(red[10]<10);assert.ok(red[121]-red[60]>75);
  assert.ok(Math.max(...red.slice(61,122).map((v,i)=>Math.abs(v-red[i+60])))<=8);
});
