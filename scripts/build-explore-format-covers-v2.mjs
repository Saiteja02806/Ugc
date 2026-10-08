import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// Original media is read-only. Versioned covers keep previous renders available.
const source = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: node scripts/build-explore-format-covers-v2.mjs <format2 folder>");
const destination = path.resolve("public/explore/covers");
const staging = path.resolve(".tmp/explore-format-covers");
for (const directory of [destination, staging]) {
  const relative = path.relative(source, directory);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new Error("Outputs must stay outside the original source folder.");
  mkdirSync(directory, { recursive: true });
}
const temporary = mkdtempSync(path.join(staging, "v2-"));
const WIDTH = 960, HEIGHT = 540, FPS = 24, ZOOM_FRAMES = 8, SLIDE_FRAMES = 36;
const sources = [];
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
function record(relative) {
  const file = path.join(source, relative);
  const bytes = readFileSync(file);
  sources.push({ file: relative.replaceAll("\\", "/"), bytes: bytes.length, sha256: hash(file) });
  return file;
}
function run(args) {
  return execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true, encoding: "utf8" });
}
function probe(file) {
  return JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file], { windowsHide: true, encoding: "utf8" }));
}
function frame(focus) {
  return `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}:0:max(0\\,min(ih-oh\\,ih*${focus}-oh/2)),setsar=1`;
}
function zoomAfter(frames) {
  // Match the older Recreate cover: a brief zoom after the complete example,
  // followed by a clean cut to the next example at its original scale.
  return `tpad=stop=${ZOOM_FRAMES}:stop_mode=clone,scale=1920:1080,zoompan=z='1+0.22*pow(max(0,min(1,(on-${frames}+1)/${ZOOM_FRAMES})),2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}`;
}
function encode(input, frames, focus, zoom, file) {
  const extra = zoom ? ZOOM_FRAMES : 0;
  run([...input, "-filter_threads", "2", "-vf", `fps=${FPS},tpad=stop=1:stop_mode=clone,trim=end_frame=${frames},setpts=PTS-STARTPTS,${frame(focus)}${zoom ? `,${zoomAfter(frames)}` : ""},format=yuv420p`,
    "-frames:v", String(frames + extra), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-movflags", "+faststart", file]);
  return frames + extra;
}

// Validate and hash the complete source set before any media preparation.
const groups = [
  { name: "hook-video-v2", posterTime: .25, clips: [{ file: "hook.mp4", focus: .44 }, { file: "hook1.mp4", focus: .38 }] },
  { name: "wall-of-text-v2", posterTime: 2, clips: [{ file: "WOT.mp4", focus: .56 }, { file: "WOT_2-Vmake.mp4", focus: .25 }] },
  { name: "slideshows-v2", posterTime: 0, decks: [
    { folder: "slideshows", focus: [.62, .56, .58, .5, .5, .47] },
    { folder: "slideshows (2)", focus: [.66, .58, .53, .55] },
  ] },
];
for (const group of groups) {
  for (const clip of group.clips ?? []) {
    clip.input = record(clip.file);
    const stream = probe(clip.input).streams.find(item => item.codec_type === "video");
    clip.duration = Number(stream?.duration);
    if (!Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Missing video duration: ${clip.file}`);
    clip.contentFrames = Math.ceil(clip.duration * FPS);
  }
  if (group.decks) group.slides = group.decks.flatMap(({ folder, focus }) => {
    const files = readdirSync(path.join(source, folder)).filter(file => /^\d+\.jpe?g$/i.test(file))
      .sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
    if (files.length !== focus.length) throw new Error(`Unexpected slide count in ${folder}; review the cover framing.`);
    return files.map((file, index) => ({ file: `${folder}/${file}`, input: record(path.join(folder, file)), focus: focus[index], contentFrames: SLIDE_FRAMES, zoom: index === files.length - 1 }));
  });
}
const covers = [];
for (const group of groups) {
  const stages = [];
  for (const [index, item] of (group.clips ?? group.slides).entries()) {
    const file = `${group.name}-${index}.mp4`;
    const frames = encode(group.clips ? ["-i", item.input] : ["-loop", "1", "-i", item.input], item.contentFrames, item.focus, Boolean(group.clips || item.zoom), path.join(temporary, file));
    stages.push({ source: item.file.replaceAll("\\", "/"), file, focus: item.focus, sourceDuration: item.duration, contentFrames: item.contentFrames, frames });
  }
  const list = path.join(temporary, `${group.name}.txt`);
  writeFileSync(list, stages.map(stage => `file '${stage.file}'`).join("\n") + "\n");
  const output = path.join(temporary, `${group.name}.mp4`);
  run(["-f", "concat", "-safe", "1", "-i", list, "-c", "copy", "-an", "-movflags", "+faststart", output]);
  const video = probe(output);
  const stream = video.streams.find(item => item.codec_type === "video");
  const frames = stages.reduce((count, stage) => count + stage.frames, 0);
  if (stream?.width !== WIDTH || stream?.height !== HEIGHT || Number(stream.nb_frames) !== frames || video.streams.some(item => item.codec_type === "audio")) throw new Error(`Invalid cover dimensions, frame count or audio: ${group.name}`);
  const bytes = readFileSync(output);
  if (bytes.indexOf(Buffer.from("moov")) > bytes.indexOf(Buffer.from("mdat"))) throw new Error(`Fast-start metadata missing: ${group.name}`);
  const poster = path.join(temporary, `${group.name}.webp`);
  run(["-ss", String(group.posterTime), "-i", output, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
  covers.push({ name: group.name, frames, duration: frames / FPS, bytes: bytes.length, posterTime: group.posterTime, stages });
  console.log(`Prepared ${group.name}: ${frames} frames, ${(frames / FPS).toFixed(2)}s, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB.`);
}
// Check every original again, then publish the validated renders together.
for (const entry of sources) if (hash(path.join(source, entry.file)) !== entry.sha256) throw new Error(`Original source changed: ${entry.file}`);
for (const cover of covers) for (const extension of ["mp4", "webp"]) copyFileSync(path.join(temporary, `${cover.name}.${extension}`), path.join(destination, `${cover.name}.${extension}`));
writeFileSync(path.join(destination, "format-covers-v2.json"), JSON.stringify({ version: 2, width: WIDTH, height: HEIGHT, fps: FPS, layout: "one example at a time, edge-to-edge crops", fullVideoDuration: true, zoomFrames: ZOOM_FRAMES, slideFrames: SLIDE_FRAMES, covers, sources }, null, 2) + "\n");
console.log(`Verified three silent fast-start covers and ${sources.length} unchanged original files.`);
