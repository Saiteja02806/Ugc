// Offline preparation only. No upload, credentials, database or provider access.
// Run after worker:build with node --experimental-transform-types.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import { buildReapiVideoRequest } from "../worker/dist/lib/reapi-video.js";
import { buildExploreGenerationInstructions } from "../lib/explore/generation-input-instructions.ts";

const source = "C:/Users/chund/Downloads/csdss.mp4";
const imageRoot = "D:/influncer 1 library";
const portraits = [
  "Softly Lit Neutral Bedroom Portrait.png",
  "ChatGPT Image Oct 20, 2026, 04_35_16 PM-4.png",
  "ChatGPT Image Oct 20, 2026, 04_35_34 PM-1.png",
  "ChatGPT Image Oct 20, 2026, 04_35_38 PM-3.png",
  "ChatGPT Image Oct 20, 2026, 04_35_35 PM-2.png",
  "ChatGPT Image Oct 20, 2026, 04_35_15 PM-3.png",
];
const out = resolve("outputs/seedance-edit-test-2026-10-21");
await mkdir(out, { recursive: true });
const run = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, maxBuffer: 32 * 1024 ** 2 });
const probe = file => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8", windowsHide: true }));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const originalBytes = await readFile(source), originalHash = sha(originalBytes);
const original = probe(source), stream = original.streams.find(s => s.codec_type === "video");
if (stream.avg_frame_rate !== "30/1" || Number(stream.nb_frames) !== 104) throw new Error("Source changed; re-review the approved final-frame hold before preparing.");
await copyFile(source, join(out, "original-csdss.mp4"));
const paddedPath = join(out, "test-source-four-seconds-silent.mp4");
// Lossless H.264 preserves the 104 decoded source pictures. Only this test
// copy gets the approved 16-frame final-frame hold and has audio removed.
run(["-y", "-i", source, "-map", "0:v:0", "-vf", "tpad=stop_mode=clone:stop_duration=0.534", "-frames:v", "120", "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", paddedPath]);
const frames = file => run(["-i", file, "-map", "0:v:0", "-f", "framemd5", "pipe:1"]).toString().split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => line.split(",").at(-1).trim());
const sourceFrames = frames(source), testFrames = frames(paddedPath), padded = probe(paddedPath);
if (testFrames.length !== 120 || sourceFrames.some((hash, i) => testFrames[i] !== hash) ||
    testFrames.slice(104).some(hash => hash !== sourceFrames.at(-1)) || padded.streams.some(s => s.codec_type === "audio") || Number(padded.format.duration) !== 4) throw new Error("Test copy failed picture, hold, duration or silence verification.");
const images = [];
for (const [index, name] of portraits.entries()) {
  const from = join(imageRoot, name), filename = `image-${index + 1}.png`;
  const bytes = await readFile(from), info = await sharp(bytes).metadata();
  if (bytes.length >= 20 * 1024 ** 2) throw new Error("Portrait exceeds app upload limit.");
  await copyFile(from, join(out, filename));
  images.push({ role: index === 0 ? "main face" : `supporting ${index}`, source: from, filename, sha256: sha(bytes), bytes: bytes.length, width: info.width, height: info.height });
}
const sampleFrames = [0, 13, 26, 39, 52, 65, 78, 91, 103];
const tiles = [];
for (const [i, frame] of sampleFrames.entries()) {
  const png = run(["-i", source, "-vf", `select=eq(n\\,${frame}),scale=180:320`, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]);
  tiles.push({ input: png, left: i % 3 * 180, top: Math.floor(i / 3) * 320 });
}
await sharp({ create: { width: 540, height: 960, channels: 3, background: "#222222" } }).composite(tiles).jpeg({ quality: 90 }).toFile(join(out, "source-contact-sheet.jpg"));
const faceTiles = await Promise.all(images.map(async (image, i) => ({ input: await sharp(join(out, image.filename)).resize(224, 280).toBuffer(), left: i % 3 * 224, top: Math.floor(i / 3) * 280 })));
await sharp({ create: { width: 672, height: 560, channels: 3, background: "#222222" } }).composite(faceTiles).jpeg({ quality: 92 }).toFile(join(out, "ordered-face-photos.jpg"));
const instruction = "Replace the performer's face using the main face photo and supporting views of that same person. Retain the video's performance, expressions, clothing, hairstyle, scene, camera movement, lighting and timing. Remove creator-added on-screen text and reconstruct the scene behind it. Do not add text or audio.";
const roles = buildExploreGenerationInstructions({ model: "seedance_2_5", personPhotos: true, imageCount: 6, hasVideo: true, referenceVideoMode: "edit", generateAudio: false });
const request = buildReapiVideoRequest({ model: "seedance_2_5", prompt: `${roles.instructions}\n\n${instruction}`, aspectRatio: "9:16", durationSeconds: 4, resolution: "720p", generateAudio: false, referenceVideoMode: "edit", referenceVideoDurationSeconds: 4,
  referenceVideoUrl: "https://test-assets.invalid/test-source-four-seconds-silent.mp4", referenceImageUrls: images.map(image => `https://test-assets.invalid/${image.filename}`) });
await writeFile(join(out, "proposed-request.json"), JSON.stringify(request, null, 2) + "\n");
const manifest = { status: "offline-prepared-not-submitted", source, originalSha256: originalHash, originalSeconds: Number(stream.duration), originalFrames: sourceFrames.length,
  testFile: paddedPath, testSha256: sha(await readFile(paddedPath)), testSeconds: 4, testFrames: testFrames.length, appendedLastFrameCopies: 16,
  retainedSourcePicturesVerifiedExactly: true, silent: true, images,
  urlNote: "Reserved .invalid placeholders; actual provider-readable upload URLs must replace them before any submission. No assets uploaded.",
  pricingEstimate: { currency: "USD", rateUpperBoundPerBillableSecond: 0.161, source: "https://reapi.ai/models/seedance-2-5", verifiedDate: "2026-10-21", expectedBillableSeconds: 8, expectedCostUpperEstimate: 1.288, autoDurationReserveBillableSeconds: 50, temporaryReserveUpperEstimate: 8.05, note: "720p video-input rate, source+output with minimum; settlement depends on delivered duration. App credit estimate is separately 16, not a provider credit quote." } };
if (sha(await readFile(source)) !== originalHash) throw new Error("Original source changed during preparation.");
await writeFile(join(out, "preflight.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ status: manifest.status, out, sourceSeconds: manifest.originalSeconds, testSeconds: 4, unchangedOriginal: true, exactRetainedPictures: sourceFrames.length, finalFrameCopies: 16, orderedPhotos: images.length }));
