import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// Reuse an existing public recording. No provider, customer account or credits.
const root = new URL("../", import.meta.url);
const source = "public/marketing/showcase-part2/application-demo.mp4";
const destination = "public/marketing/guides/add-product-demo-excerpt.mp4";
const poster = "public/marketing/guides/add-product-demo-poster.jpg";
const startSeconds = 18;
const durationSeconds = 10;
await mkdir(new URL("public/marketing/guides/", root), { recursive: true });
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: fileURLToPath(root), encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}
function probe(path) {
  return JSON.parse(run(ffprobe.path, ["-v", "error", "-show_format", "-show_streams", "-of", "json", path]));
}
const sourceProbe = probe(source);
if (Number(sourceProbe.format.duration) < startSeconds + durationSeconds) throw new Error("Source recording is too short");
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(startSeconds), "-i", source, "-t", String(durationSeconds), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", destination]);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", "2", "-i", destination, "-frames:v", "1", "-update", "1", poster]);
const result = probe(destination);
const video = result.streams.find(stream => stream.codec_type === "video");
if (Math.abs(Number(result.format.duration) - durationSeconds) > 0.1 || result.streams.some(stream => stream.codec_type === "audio")) throw new Error("Unexpected excerpt duration or audio");
// Decode the complete MP4, not just its container metadata.
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", destination, "-f", "null", "-"]);
async function receipt(path) {
  const bytes = await readFile(new URL(path, root));
  return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
const evidence = {
  preparedOn: "2026-10-22",
  kind: "Local edit of an existing public UGC Pilot showcase recording",
  source: { ...await receipt(source), durationSeconds: Number(sourceProbe.format.duration), publicPath: source.replace(/^public/, ""), captureDate: "Not established; the recorded interface predates this guide update" },
  excerpt: { ...await receipt(destination), startSeconds, durationSeconds: Number(result.format.duration), width: video.width, height: video.height, hasAudio: false, fullDecodePassed: true },
  poster: await receipt(poster),
  limitations: ["Historical interface, not a fresh walkthrough or current production acceptance.", "Shows opening selection, demo attachment and entry into review; does not establish publication or customer outcomes.", "Trimmed locally using FFmpeg, not exported from the UGC Pilot editor.", "Fresh production capture was blocked by HTTP 402 DEPLOYMENT_DISABLED on both domains."]
};
await writeFile(new URL("docs/seo-product-demo-media-evidence-2026-10-22.json", root), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
