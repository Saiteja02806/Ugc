// Prepare the verified native After Effects render for the local Explore cover.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const { values } = parseArgs({ options: {
  render: { type: "string" },
  output: { type: "string", default: "public/explore/covers" },
  preview: { type: "string", default: "design/explore-hook-motion/Preview" },
  version: { type: "string", default: "v4" },
  timeline: { type: "string" },
} });
if (!values.render || !ffmpeg) throw new Error("Pass --render with the completed After Effects MP4.");
if (!["v4", "v5", "v6"].includes(values.version)) throw new Error("Supported versions are v4, v5 and v6.");
if (values.version !== "v4" && !values.timeline) throw new Error("Pass --timeline with the current composition manifest.");
const source = path.resolve(values.render);
const output = path.resolve(values.output);
const preview = path.resolve(values.preview);
for (const folder of [output, preview]) mkdirSync(folder, { recursive: true });
const video = path.join(output, `create-hook-${values.version}.mp4`);
const poster = path.join(output, `create-hook-${values.version}.webp`);
if (source === video) throw new Error("The prepared output cannot replace its source render.");
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Media preparation failed.");
  return result.stdout;
}
function probe(file) {
  return JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file]));
}
function check(streams, silent) {
  const stream = streams.find((item) => item.codec_type === "video");
  if (!stream || stream.width !== 960 || stream.height !== 540 || Number(stream.nb_frames) !== 404 || stream.r_frame_rate !== "24/1") {
    throw new Error("The cover must contain 404 frames at 24 fps and 960x540.");
  }
  if (silent && streams.some((item) => item.codec_type === "audio")) throw new Error("The prepared cover must be silent.");
}
check(probe(source).streams, false);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map", "0:v:0", "-an", "-frames:v", "404", "-r", "24",
  "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
check(probe(video).streams, true);
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
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", "1.25", "-i", video, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
const previous = JSON.parse(readFileSync(path.join(output, "create-hook-v3.json"), "utf8"));
const reordered = values.timeline ? JSON.parse(readFileSync(values.timeline, "utf8")) : null;
if (reordered && (reordered.frames !== 404 || reordered.fps !== 24 || reordered.demo.startFrame !== 96 || reordered.demo.endFrame !== 156)) {
  throw new Error("The timeline must keep 404 frames and the 60-frame demonstration at 4 seconds.");
}
writeFileSync(path.join(output, `create-hook-${values.version}.json`), JSON.stringify({
  ...previous, video: path.basename(video), poster: path.basename(poster), bytes: statSync(video).size,
  // Inspecting the decoded plate found its demo cut one frame after the older
  // manifest's rounded time. The native title is aligned to these actual frames.
  demo: { ...previous.demo, startFrame: 259, endFrame: 319 },
  captions: previous.captions.map((caption) => caption.text === "Add your own demo"
    ? { ...caption, start: 259 / 24, end: 319 / 24 } : caption),
  captionStyle: "native editorial kinetic type, Bodoni Black Italic keywords and Georgia supporting text",
  motion: {
    editor: "After Effects", project: "design/explore-hook-motion/Explore Hook Cover — Editorial Motion v4.aep",
    nativeRenderTemplate: "H.264 - Match Render Settings - 40 Mbps", numericKeys: 35,
    keyword: "left-to-right outline-to-fill reveal over 0.5 seconds, 94% to 100% settle",
    supportingText: "short per-character rise and opacity reveal", sourceTextEditable: true,
    demoDuration: 2.5, fonts: ["BodoniMTBlack-Italic", "Georgia-Italic", "Georgia"],
  },
  ...(reordered ? { stages: reordered.stages, demo: reordered.demo, captions: reordered.captions, motion: reordered.motion } : {}),
}, null, 2) + "\n");
copyFileSync(video, path.join(preview, path.basename(video)));
copyFileSync(poster, path.join(preview, path.basename(poster)));
console.log(`Verified silent native-motion cover: 404 frames, 16.83s, ${(statSync(video).size / 1024 / 1024).toFixed(2)} MiB, fast start, full decode.`);
