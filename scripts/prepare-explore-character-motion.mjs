// Package and verify the completed native After Effects character-cover render.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

const { values } = parseArgs({ options: {
  render: { type: "string" },
  output: { type: "string" },
  version: { type: "string", default: "2" },
} });
if (!values.render || !ffmpeg) throw new Error("Pass --render with the completed native AE MP4.");
if (!["2", "3"].includes(values.version)) throw new Error("Use --version 2 or 3 for the authored timeline.");
const version = Number(values.version);
const name = `ai-character-v${version}`;
const source = path.resolve(values.render);
const output = path.resolve(values.output || (version === 3 ? "design/explore-character-motion/Preview/v3" : "design/explore-character-motion/Preview"));
const video = path.join(output, `${name}.mp4`);
if (source === video) throw new Error("Keep the native source render separate from the web preview.");
mkdirSync(output, { recursive: true });
const expected = { width: 960, height: 540, fps: 24, frames: 288, duration: 12 };
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Media verification failed.");
  return result.stdout;
}
function inspect(file, silent) {
  const data = JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file]));
  const stream = data.streams.find(entry => entry.codec_type === "video");
  if (!stream || stream.width !== expected.width || stream.height !== expected.height ||
      stream.r_frame_rate !== "24/1" || Number(stream.nb_frames) !== expected.frames ||
      Math.abs(Number(stream.duration) - expected.duration) > 0.01) {
    throw new Error("Expected a complete 12-second, 288-frame, 960x540 render at 24 fps.");
  }
  if (silent && data.streams.some(entry => entry.codec_type === "audio")) throw new Error("The cover must be silent.");
  return stream;
}
inspect(source, false);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map", "0:v:0", "-an",
  "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
inspect(video, true);
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
if (!fastStart) throw new Error("Fast-start metadata must precede the video data.");
const times = version === 3
  ? [0, .3, .65, 1.4, 2.6, 2.85, 3, 3.2, 3.65, 4.1, 4.45, 5.3, 6.35,
    6.65, 7.15, 7.6, 8.2, 9.2, 9.7, 10, 10.35, 10.7, 11.5, 287 / 24]
  : [0, 0.3, 0.65, 1.4, 2.6, 2.88, 3, 3.12, 3.5, 4.8, 6.2, 6.38, 6.5,
    6.62, 6.95, 7.8, 9.2, 9.38, 9.5, 9.62, 10.2, 10.7, 11.5, 287 / 24];
const tiles = [];
for (let i = 0; i < times.length; i++) {
  const file = path.join(output, `review-frame-${String(i).padStart(2, "0")}.png`);
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(times[i]), "-i", video, "-frames:v", "1", file]);
  const picture = await sharp(file).resize(320, 180).png().toBuffer();
  const label = Buffer.from(`<svg width="320" height="24"><rect width="320" height="24" fill="#151515"/><text x="10" y="17" fill="white" font-family="Arial" font-size="13">${times[i].toFixed(3)} s</text></svg>`);
  tiles.push({ input: picture, left: (i % 4) * 320, top: Math.floor(i / 4) * 204 });
  tiles.push({ input: label, left: (i % 4) * 320, top: Math.floor(i / 4) * 204 + 180 });
}
await sharp({ create: { width: 1280, height: Math.ceil(times.length / 4) * 204, channels: 3, background: "#1f1f1f" } })
  .composite(tiles).jpeg({ quality: 91 }).toFile(path.join(output, `storyboard-v${version}.jpg`));
await sharp(path.join(output, "review-frame-03.png")).webp({ quality: 90 }).toFile(path.join(output, `${name}.webp`));
const projectFile = version === 3 ? "Explore AI Character — Identity in Motion v3.aep" : "Explore AI Character — Build Use Grow v2.aep";
const manifest = {
  version, ...expected, source: path.basename(source), video: path.basename(video),
  project: path.relative(output, path.resolve("design/explore-character-motion", projectFile)).replaceAll("\\", "/"), poster: `${name}.webp`,
  bytes: statSync(video).size, sha256: createHash("sha256").update(bytes).digest("hex"),
  silent: true, fastStart, fullDecodeVerified: true,
  chapters: version === 3 ? [{ start: 0, end: 3, text: "Create your own character" },
    { start: 3, end: 6.55, text: "One character. More possibilities" },
    { start: 6.55, end: 9.82, text: "Make your content recognizable" },
    { start: 9.82, end: 12, text: "Fold back into the original identity" }]
    : [{ start: 0, end: 3, text: "Build your AI character" },
    { start: 3, end: 6.5, text: "Use it in your content" },
    { start: 6.5, end: 9.5, text: "Grow your presence" },
    { start: 9.5, end: 12, text: "Return to character assembly" }],
  reviewTimes: times,
};
writeFileSync(path.join(output, `${name}.json`), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ ...expected, bytes: manifest.bytes, silent: true, fastStart, fullDecodeVerified: true }));
