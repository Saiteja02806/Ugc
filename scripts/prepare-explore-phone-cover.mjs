// Render the owner's two phone-demo videos as a split, then two solo views.
// Original media is only read; all render and review files stay in the workspace.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const { values } = parseArgs({ options: {
  input: { type: "string" },
  output: { type: "string", default: "public/explore/covers" },
  temporary: { type: "string", default: ".tmp/explore-phone-cover" },
  "solo-width": { type: "string", default: "960" },
} });
if (!values.input || !ffmpeg) throw new Error("Pass --input with the format3 folder; ffmpeg-static is required.");
const input = path.resolve(values.input);
const output = path.resolve(values.output);
const temporary = path.resolve(values.temporary);
for (const destination of [output, temporary]) {
  const relative = path.relative(input, destination);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new Error("Outputs must be outside the source folder.");
  mkdirSync(destination, { recursive: true });
}
const WIDTH = 960;
const HEIGHT = 540;
const FPS = 24;
const SPLIT_FRAMES = 3 * FPS;
const SOLO_WIDTH = Number(values["solo-width"]);
if (!Number.isInteger(SOLO_WIDTH) || SOLO_WIDTH < 540 || SOLO_WIDTH > WIDTH || SOLO_WIDTH % 2) throw new Error("--solo-width must be an even number from 540 to 960.");
const basename = SOLO_WIDTH === WIDTH ? "creator-phone-v2" : "creator-phone-v1";
const clips = [
  { name: "video-1", source: "Influencer_presenting_productivi_20261002151259.mp4", splitStart: 4, splitFocus: 0.51, soloFocus: SOLO_WIDTH === WIDTH ? 0.43 : 0.515 },
  { name: "video-2", source: "final_opal.mp4", splitStart: 7, splitFocus: 0.58, soloFocus: SOLO_WIDTH === WIDTH ? 0.46 : 0.57 },
];
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Media preparation failed.");
  return result.stdout;
}
function probe(file) {
  return JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
}
function render(inputs, filters, frames, file, crf = "19") {
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...inputs,
    "-filter_complex_threads", "2", "-filter_complex", filters, "-map", "[out]", "-an",
    "-frames:v", String(frames), "-r", String(FPS), "-c:v", "libx264", "-preset", "fast",
    "-crf", crf, "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
  console.log(`Prepared ${path.basename(file)} (${frames} frames).`);
}
for (const clip of clips) {
  clip.file = path.join(input, clip.source);
  statSync(clip.file);
  const stream = probe(clip.file).streams.find((item) => item.codec_type === "video");
  clip.frames = Math.round(Number(stream.duration) * FPS);
  if (clip.frames < clip.splitStart * FPS + SPLIT_FRAMES) throw new Error(`${clip.source}: the opening app demonstration exceeds its duration.`);
}

// The two sharp canvases overlap across the entire slanted boundary. Their
// clipped rectangles cannot introduce blank wedges or duplicate backgrounds.
const split = path.join(temporary, "diagonal.mp4");
const filters = clips.map((clip, index) =>
  `[${index}:v]fps=${FPS},setpts=PTS-STARTPTS,scale=510:-2,crop=510:${HEIGHT}:0:ih*${clip.splitFocus}-oh/2,pad=${WIDTH}:${HEIGHT}:${index === 0 ? 0 : 450}:0:color=black[canvas${index}]`
);
filters.push(
  "[canvas1]format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(gte(X,510-60*Y/540),255,0)'[right]",
  "[canvas0][right]overlay=shortest=1,format=yuv420p[out]",
);
render(clips.flatMap((clip) => ["-ss", String(clip.splitStart), "-i", clip.file]), filters.join(";"), SPLIT_FRAMES, split);
const stages = [{ name: "diagonal", file: split, frames: SPLIT_FRAMES }];

for (const clip of clips) {
  const file = path.join(temporary, `${clip.name}.mp4`);
  // Fill the cover with a sharp crop centered on the creator and phone.
  // A narrower width remains available to reproduce the earlier inset study.
  const margin = SOLO_WIDTH < WIDTH ? `,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:0:color=0x111111` : "";
  const filter = `[0:v]fps=${FPS},trim=end_frame=${clip.frames},setpts=PTS-STARTPTS,scale=${SOLO_WIDTH}:-2,crop=${SOLO_WIDTH}:${HEIGHT}:0:ih*${clip.soloFocus}-oh/2${margin},format=yuv420p[out]`;
  render(["-i", clip.file], filter, clip.frames, file);
  stages.push({ name: clip.name, file, frames: clip.frames });
}

// Clean cuts keep the phone interfaces sharp. No still-frame holds, zooms or
// pause states are inserted, including at the return to the diagonal opening.
const list = path.join(temporary, "sequence.txt");
writeFileSync(list, stages.map((stage) => `file '${path.basename(stage.file)}'`).join("\n") + "\n");
const video = path.join(output, `${basename}.mp4`);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", list,
  "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
const totalFrames = stages.reduce((sum, stage) => sum + stage.frames, 0);
const result = probe(video);
const stream = result.streams.find((item) => item.codec_type === "video");
if (stream.width !== WIDTH || stream.height !== HEIGHT || Number(stream.nb_frames) !== totalFrames || result.streams.some((item) => item.codec_type === "audio")) throw new Error("Output dimensions, frame count or silent playback did not match.");
const bytes = readFileSync(video);
let fastStart = false;
for (let offset = 0; offset + 8 <= bytes.length;) {
  const size = bytes.readUInt32BE(offset);
  const type = bytes.toString("ascii", offset + 4, offset + 8);
  if (type === "moov") { fastStart = true; break; }
  if (type === "mdat" || size < 8) break;
  offset += size;
}
if (!fastStart) throw new Error("MP4 fast-start metadata is missing.");
const poster = path.join(output, `${basename}.webp`);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", video, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
let start = 0;
writeFileSync(path.join(output, `${basename}.json`), JSON.stringify({
  width: WIDTH, height: HEIGHT, fps: FPS, frames: totalFrames, duration: totalFrames / FPS,
  bytes: statSync(video).size, soloWidth: SOLO_WIDTH, framing: SOLO_WIDTH === WIDTH ? "edge-to-edge sharp crops" : "sharp crops with solid side margins",
  sources: clips.map(({ source, frames, splitStart }) => ({ source, frames, splitStart })),
  stages: stages.map(({ name, frames }) => { const stage = { name, frames, startFrame: start }; start += frames; return stage; }),
}, null, 2) + "\n");
console.log(`Verified ${totalFrames} frames: ${(totalFrames / FPS).toFixed(2)}s, ${(statSync(video).size / 1024 / 1024).toFixed(2)} MiB, silent, fast start.`);
