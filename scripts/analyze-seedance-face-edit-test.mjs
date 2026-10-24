// Local output verification and contact sheets; no model calls or network.
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

const folder = resolve("outputs/seedance-edit-test-2026-10-21");
const receipt = JSON.parse(await readFile(join(folder, "paid-test-receipt.json"), "utf8"));
if (receipt.status !== "completed" || !receipt.finalFile) throw new Error("The paid task is not collected yet.");
const run = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, maxBuffer: 64 * 1024 ** 2 });
const probe = path => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_format", "-show_streams", "-of", "json", path], { encoding: "utf8", windowsHide: true }));
const source = join(folder, "test-source-four-seconds-silent.mp4"), generated = receipt.finalFile;
const sourceInfo = probe(source), generatedInfo = probe(generated);
const videoStream = generatedInfo.streams.find(stream => stream.codec_type === "video");
const count = Number(videoStream.nb_frames);
if (!count || count > 1000) throw new Error("Unexpected frame count; inspect before extracting.");
const thumb = (path, filter) => run(["-i", path, "-vf", `${filter},scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2:color=black`, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]);
const pages = [];
for (let start = 0; start < count; start += 24) {
  const tiles = [];
  for (let frame = start; frame < Math.min(start + 24, count); frame++) {
    const i = frame - start;
    tiles.push({ input: thumb(generated, `select=eq(n\\,${frame})`), left: i % 6 * 180, top: Math.floor(i / 6) * 344 });
    const label = `<svg width="180" height="24"><rect width="180" height="24" fill="#171717"/><text x="8" y="17" fill="white" font-size="14">Generated frame ${frame + 1}</text></svg>`;
    tiles.push({ input: Buffer.from(label), left: i % 6 * 180, top: Math.floor(i / 6) * 344 + 320 });
  }
  const name = `generated-frames-${String(start + 1).padStart(3, "0")}-${String(Math.min(start + 24, count)).padStart(3, "0")}.jpg`;
  await sharp({ create: { width: 1080, height: 1376, channels: 3, background: "#171717" } }).composite(tiles).jpeg({ quality: 92 }).toFile(join(folder, name));
  pages.push(name);
}
const moments = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const comparison = [];
for (const [i, second] of moments.entries()) {
  for (const [j, path] of [source, generated].entries()) {
    const png = run(["-ss", String(second), "-i", path, "-vf", "scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2:color=black", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]);
    comparison.push({ input: png, left: i % 4 * 360 + j * 180, top: Math.floor(i / 4) * 344 });
    const label = `<svg width="180" height="24"><rect width="180" height="24" fill="#171717"/><text x="8" y="17" fill="white" font-size="14">${j ? "Generated" : "Source"} ${second.toFixed(1)}s</text></svg>`;
    comparison.push({ input: Buffer.from(label), left: i % 4 * 360 + j * 180, top: Math.floor(i / 4) * 344 + 320 });
  }
}
await sharp({ create: { width: 1440, height: 688, channels: 3, background: "#171717" } }).composite(comparison).jpeg({ quality: 94 }).toFile(join(folder, "source-generated-timing-comparison.jpg"));
const frameHashes = path => run(["-i", path, "-map", "0:v:0", "-f", "framemd5", "pipe:1"]).toString();
const rawInfo = probe(receipt.rawFile);
const audit = { taskId: receipt.providerTaskId, paidPosts: receipt.paidPosts, databaseWrites: receipt.databaseWrites,
  providerCostUsd: receipt.usage?.costUsd ?? null, sourceSeconds: Number(sourceInfo.format.duration), generatedSeconds: Number(generatedInfo.format.duration),
  timelinePassed: receipt.timelinePassed, silent: !generatedInfo.streams.some(stream => stream.codec_type === "audio"),
  providerReturnedAudio: rawInfo.streams.some(stream => stream.codec_type === "audio"),
  picturesAndTimestampsPreservedDuringSilencing: frameHashes(receipt.rawFile) === frameHashes(generated),
  generatedFrames: count, width: videoStream.width, height: videoStream.height, fps: videoStream.avg_frame_rate,
  sourceFileSha256: createHash("sha256").update(await readFile(source)).digest("hex"), generatedFileSha256: createHash("sha256").update(await readFile(generated)).digest("hex"),
  frameReviewPages: pages, visualConclusion: "Pending visual inspection; hashes, duration and silence do not establish facial fidelity." };
await writeFile(join(folder, "output-technical-audit.json"), JSON.stringify(audit, null, 2) + "\n");
console.log(JSON.stringify(audit, null, 2));
