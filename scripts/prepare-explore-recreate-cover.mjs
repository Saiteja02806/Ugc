// Prepare the six supplied Recreate examples in their requested order.
// Reads source media only; rendering and review files stay in the workspace.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const { values } = parseArgs({ options: {
  input: { type: "string" },
  output: { type: "string", default: "public/explore/covers" },
  temporary: { type: "string", default: ".tmp/explore-recreate-cover" },
  name: { type: "string", default: "recreate-v2" },
  "wall-text-1-focus": { type: "string", default: "0.56" },
  "wall-text-2-focus": { type: "string", default: "0.5" },
} });
if (!values.input || !ffmpeg) throw new Error("Pass --input with the format2 folder; ffmpeg-static is required.");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.name)) throw new Error("Pass --name as a lowercase asset name without a file extension.");
const wallTextFocus = ["wall-text-1-focus", "wall-text-2-focus"].map((key) => {
  const focus = Number(values[key]);
  if (!Number.isFinite(focus) || focus < 0 || focus > 1) throw new Error(`${key} must be a number between 0 and 1.`);
  return focus;
});
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
const ZOOM_FRAMES = 8;
const SLIDE_FRAMES = 29;
const clips = [
  { name: "hook-1", source: "hook.mp4", focus: 0.44 },
  { name: "hook-2", source: "hook1.mp4", focus: 0.38 },
  { name: "wall-of-text-1", source: "WOT_1-Vmake.mp4", focus: wallTextFocus[0] },
  { name: "wall-of-text-2", source: "WOT_2-Vmake.mp4", focus: wallTextFocus[1] },
];
const decks = [
  { name: "slideshow-1", folder: "1", focus: [0.5, 0.48, 0.45, 0.5] },
  { name: "slideshow-2", folder: "New folder", focus: [0.7, 0.5, 0.64, 0.35, 0.35, 0.35] },
];
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Media preparation failed.");
  return result.stdout;
}
function probe(file) {
  return JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
}
function encode(inputs, filter, frames, file, crf = "19") {
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...inputs,
    "-filter_threads", "2", "-vf", filter, "-an", "-frames:v", String(frames),
    "-r", String(FPS), "-c:v", "libx264", "-preset", "fast", "-crf", crf,
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
  console.log(`Prepared ${path.basename(file)} (${frames} frames).`);
}
function zoomAfter(frames) {
  // Preserve the complete example, then animate its last frame from 100% to
  // 122% in eight frames. The next example starts at normal size on a clean cut.
  return `tpad=stop=${ZOOM_FRAMES}:stop_mode=clone,scale=1920:1080,zoompan=z='1+0.22*pow(max(0,min(1,(on-${frames}+1)/${ZOOM_FRAMES})),2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}`;
}
const stages = [];
// Validate the entire supplied set before rendering.
clips.forEach((clip) => statSync(path.join(input, clip.source)));
for (const deck of decks) {
  deck.slides = readdirSync(path.join(input, deck.folder)).filter((name) => /\.jpe?g$/i.test(name)).sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
  if (deck.slides.length !== deck.focus.length) throw new Error(`${deck.folder}: unexpected slide count.`);
}

for (const clip of clips) {
  const source = path.join(input, clip.source);
  const stream = probe(source).streams.find((item) => item.codec_type === "video");
  const frames = Math.round(Number(stream.duration) * FPS);
  const framing = `scale=${WIDTH}:-2,crop=${WIDTH}:${HEIGHT}:0:ih*${clip.focus}-oh/2`;
  const file = path.join(temporary, `${clip.name}.mp4`);
  encode(["-i", source], `fps=${FPS},trim=end_frame=${frames},setpts=PTS-STARTPTS,${framing},${zoomAfter(frames)}`, frames + ZOOM_FRAMES, file);
  stages.push({ name: clip.name, source: clip.source, focus: clip.focus, file, contentFrames: frames, frames: frames + ZOOM_FRAMES });
}

for (const deck of decks) {
  const slides = [];
  for (const [index, name] of deck.slides.entries()) {
    const last = index === deck.slides.length - 1;
    const frames = SLIDE_FRAMES + (last ? ZOOM_FRAMES : 0);
    const file = path.join(temporary, `${deck.name}-slide-${index + 1}.mp4`);
    const filter = `fps=${FPS},trim=end_frame=${SLIDE_FRAMES},setpts=PTS-STARTPTS,scale=${WIDTH}:-2,crop=${WIDTH}:${HEIGHT}:0:ih*${deck.focus[index]}-oh/2${last ? `,${zoomAfter(SLIDE_FRAMES)}` : ""}`;
    encode(["-loop", "1", "-i", path.join(input, deck.folder, name)], filter, frames, file);
    slides.push({ name, file, frames });
  }
  // A concat demuxer keeps image order without introducing crossfades or gaps.
  const list = path.join(temporary, `${deck.name}.txt`);
  writeFileSync(list, slides.map((slide) => `file '${path.basename(slide.file)}'`).join("\n") + "\n");
  const file = path.join(temporary, `${deck.name}.mp4`);
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", list, "-c", "copy", "-an", "-movflags", "+faststart", file]);
  stages.push({ name: deck.name, source: deck.folder, file, slides: deck.slides, contentFrames: SLIDE_FRAMES * deck.slides.length, frames: slides.reduce((sum, slide) => sum + slide.frames, 0) });
}

const list = path.join(temporary, "sequence.txt");
writeFileSync(list, stages.map((stage) => `file '${path.basename(stage.file)}'`).join("\n") + "\n");
const video = path.join(output, `${values.name}.mp4`);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", list, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
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
const poster = path.join(output, `${values.name}.webp`);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", video, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
let start = 0;
writeFileSync(path.join(output, `${values.name}.json`), JSON.stringify({
  width: WIDTH, height: HEIGHT, fps: FPS, frames: totalFrames, duration: totalFrames / FPS,
  bytes: statSync(video).size, zoomFrames: ZOOM_FRAMES, zoomScale: 1.22, slideFrames: SLIDE_FRAMES, framing: "edge-to-edge sharp crops",
  stages: stages.map(({ name, source, focus, slides, contentFrames, frames }) => { const entry = { name, source, focus, slides, contentFrames, frames, startFrame: start }; start += frames; return entry; }),
}, null, 2) + "\n");
console.log(`Verified ${totalFrames} frames: ${(totalFrames / FPS).toFixed(2)}s, ${(statSync(video).size / 1024 / 1024).toFixed(2)} MiB, silent, fast start.`);
