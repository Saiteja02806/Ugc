// Package a completed native After Effects render for the Explore development cover.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const { values } = parseArgs({ options: {
  render: { type: "string" },
  timeline: { type: "string", default: "design/explore-phone-motion/timeline-v3.json" },
  output: { type: "string", default: "public/explore/covers" },
  preview: { type: "string", default: "design/explore-phone-motion/Preview" },
} });
if (!values.render || !ffmpeg) throw new Error("Pass --render with the completed native After Effects MP4.");
const source = path.resolve(values.render);
const timeline = JSON.parse(readFileSync(values.timeline, "utf8"));
if (timeline.width !== 960 || timeline.height !== 540 || timeline.fps !== 24 ||
    !Number.isInteger(timeline.frames) || timeline.frames < 1 ||
    Math.abs(timeline.frames / timeline.fps - timeline.duration) > 0.00001) {
  throw new Error("The timeline must be 960x540 at 24 fps with an integral frame count matching its duration.");
}
const output = path.resolve(values.output);
const preview = path.resolve(values.preview);
const basename = timeline.basename ?? "creator-phone-v3";
if (!/^creator-phone-v[1-9]\d*$/.test(basename)) throw new Error("Use a versioned creator-phone basename.");
const posterTime = timeline.posterTime ?? 1.25;
if (!Number.isFinite(posterTime) || posterTime < 0 || posterTime >= timeline.duration) {
  throw new Error("The poster time must be within the cover duration.");
}
const video = path.join(output, basename + ".mp4");
const poster = path.join(output, basename + ".webp");
if (source === video) throw new Error("The output cannot replace the native source render.");
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Media preparation failed.");
  return result.stdout;
}
function check(file, silent) {
  const data = JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file]));
  const stream = data.streams.find((entry) => entry.codec_type === "video");
  if (!stream || stream.width !== 960 || stream.height !== 540 || stream.r_frame_rate !== "24/1" || Number(stream.nb_frames) !== timeline.frames) {
    throw new Error(`The cover must contain ${timeline.frames} frames at 24 fps and 960x540.`);
  }
  if (silent && data.streams.some((entry) => entry.codec_type === "audio")) throw new Error("The web cover must be silent.");
}
check(source, false);
for (const folder of [output, preview]) mkdirSync(folder, { recursive: true });
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map", "0:v:0", "-an",
  "-frames:v", String(timeline.frames), "-r", "24", "-c:v", "libx264", "-preset", "fast", "-crf", "20",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
check(video, true);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", video, "-map", "0:v:0", "-f", "null", "-"]);
const bytes = readFileSync(video);
let fastStart = false;
for (let offset = 0; offset + 8 <= bytes.length;) {
  const size = bytes.readUInt32BE(offset);
  const type = bytes.toString("ascii", offset + 4, offset + 8);
  if (type === "moov") { fastStart = true; break; }
  if (type === "mdat" || size < 8) break;
  offset += size;
}
if (!fastStart) throw new Error("Fast-start metadata is missing.");
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(posterTime), "-i", video,
  "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
writeFileSync(path.join(output, basename + ".json"), JSON.stringify({
  ...timeline, video: basename + ".mp4", poster: basename + ".webp", bytes: statSync(video).size,
  silent: true, fastStart: true, fullDecodeVerified: true,
}, null, 2) + "\n");
copyFileSync(video, path.join(preview, basename + ".mp4"));
copyFileSync(poster, path.join(preview, basename + ".webp"));
console.log(`Verified phone cover: ${timeline.frames} frames, ${timeline.duration}s, silent, fast start, full decode; ` + (bytes.length / 1024 / 1024).toFixed(2) + " MiB.");
