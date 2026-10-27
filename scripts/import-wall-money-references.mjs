import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import nextEnv from "@next/env";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";
import { ReferenceTextSchema } from "../lib/explore/reference-text.ts";

// Dedicated additive release: never rescan or rewrite the published paired catalog.
const releasePath = "worker/src/lib/explore-wall-money-reference-release.json";
const stage = ".tmp/wall-money-review-2026-10-26/media";
const receiptPath = ".tmp/wall-money-review-2026-10-26/publication-receipt.json";
const reviews = JSON.parse(fs.readFileSync("lib/explore/wall-money-reference-prompts.json", "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const probe = file => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8", windowsHide: true }));
const objects = new Map();
fs.mkdirSync(stage, { recursive: true });
function asset(bytes, extension, contentType) {
  const sha256 = hash(bytes), file = `${sha256}.${extension}`, key = `explore/paired-references/v1/${file}`;
  fs.writeFileSync(path.join(stage, file), bytes);
  objects.set(key, { key, sha256, contentType, bytes });
  return { key, sha256 };
}
const existing = JSON.parse(fs.readFileSync("worker/src/lib/explore-paired-reference-catalog.json", "utf8"));
const items = [];
for (const [index, row] of reviews.entries.entries()) {
  const dir = path.dirname(row.sourcePath), files = fs.readdirSync(dir);
  const links = files.filter(file => file.endsWith(".txt"));
  if (links.length !== 1 || fs.readFileSync(path.join(dir, links[0]), "utf8").replace(/^\uFEFF/, "").trim() !== row.sourceUrl) throw Error("Reviewed source link changed.");
  const audios = files.filter(file => file.endsWith(".mp3"));
  if (audios.length !== 1) throw Error("Expected exactly one paired MP3.");
  const audioPath = path.join(dir, audios[0]);
  const videoBytes = fs.readFileSync(row.sourcePath), audioBytes = fs.readFileSync(audioPath);
  if (hash(videoBytes) !== row.sourceSha256 || !audioBytes.length) throw Error("Reviewed source changed.");
  const expectedId = `explore-paired-wall_text-${hash(`${hash(videoBytes)}:${hash(audioBytes)}`).slice(0, 24)}`;
  if (row.referenceId !== expectedId || existing.items.some(item => item.id === expectedId || item.videoSha256 === row.sourceSha256)) throw Error("Changed pairing or duplicate published video.");
  for (const file of [row.sourcePath, audioPath]) execFileSync(ffmpeg, ["-v", "error", "-xerror", "-i", file, "-f", "null", "-"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const video = asset(videoBytes, "mp4", "video/mp4"), audio = asset(audioBytes, "mp3", "audio/mpeg");
  const posterBytes = execFileSync(ffmpeg, ["-v", "error", "-i", row.sourcePath, "-frames:v", "1", "-vf", "scale=360:-2", "-f", "image2pipe", "-vcodec", "png", "-"], { windowsHide: true, maxBuffer: 5e6 });
  const poster = asset(await sharp(posterBytes).webp({ quality: 85 }).toBuffer(), "webp", "image/webp");
  const previewPath = path.join(stage, `preview-${index}.mp4`);
  // Match existing paired previews: native video plus its supplied MP3 from zero.
  execFileSync(ffmpeg, ["-y", "-v", "error", "-i", row.sourcePath, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-t", String(row.sourceDurationSeconds), "-movflags", "+faststart", previewPath], { windowsHide: true });
  const preview = asset(fs.readFileSync(previewPath), "mp4", "video/mp4");
  const info = probe(row.sourcePath).streams.find(s => s.codec_type === "video");
  items.push({ id: expectedId, format: "wall_text", title: `Investing & Money ${String(index + 1).padStart(2, "0")}`,
    category: "investing-money", categoryLabel: "Investing & Money", sourceUrl: row.sourceUrl, sourcePlatform: "tiktok",
    videoStorageKey: video.key, videoSha256: video.sha256, audioStorageKey: audio.key, audioSha256: audio.sha256,
    posterStorageKey: poster.key, posterSha256: poster.sha256, previewStorageKey: preview.key, previewSha256: preview.sha256,
    durationSeconds: row.sourceDurationSeconds, audioDurationSeconds: Number(probe(audioPath).format.duration),
    width: info.width, height: info.height, audioTitle: audios[0], sourceFolder: `notbeen_investing and money category/${path.basename(dir)}` });
}
if (new Set(items.map(item => item.id)).size !== 6) throw Error("Expected six unique reviewed pairs.");
const prior = fs.existsSync(releasePath) ? JSON.parse(fs.readFileSync(releasePath, "utf8")) : null;
if (prior && JSON.stringify(prior.items) !== JSON.stringify(items)) throw Error("Release differs; preserve prior mappings.");
atomicJsonSync(releasePath, { version: 1, mediaStatus: prior?.mediaStatus ?? "staged", items });
const textFile = "lib/explore/reference-text-catalog.json", batchFile = "lib/explore/reference-upload-batches.json";
const frozenText = fs.readFileSync(textFile, "utf8"), frozenBatch = fs.readFileSync(batchFile, "utf8");
const text = JSON.parse(frozenText), batches = JSON.parse(frozenBatch);
for (const row of reviews.entries) {
  const record = ReferenceTextSchema.parse({ referenceId: row.referenceId, slideId: null, sourceSha256: row.sourceSha256, format: "wall_text", status: "ready",
    blocks: [{ text: row.exactText, startMs: row.textStartMs, endMs: row.textEndMs }], extractedAt: "2026-10-27T00:00:00.000Z", model: "manual-visual-review",
    notes: `All ${row.sourceFrameCount} decoded thumbnails reviewed through final picture; caption checked on native opening. Source wording retained as reference copy, not verified financial claims. No generated-output acceptance.` });
  const old = text.items.find(item => item.referenceId === row.referenceId && item.slideId === null);
  if (old && JSON.stringify(old) !== JSON.stringify(record)) throw Error("Existing text differs.");
  if (!old) text.items.push(record);
}
const batchId = "explore-20261027-wall-money";
const oldBatch = batches.batches.find(batch => batch.id === batchId);
const batch = oldBatch ?? { id: batchId, format: "wall_text", sequence: Math.max(0, ...batches.batches.filter(b => b.format === "wall_text").map(b => b.sequence)) + 1, status: "staged", referenceIds: items.map(item => item.id) };
if (JSON.stringify(batch.referenceIds) !== JSON.stringify(items.map(item => item.id))) throw Error("Batch membership changed.");
if (!oldBatch) batches.batches.push(batch);
console.log(JSON.stringify({ mode: process.argv.includes("--execute") ? "upload" : "dry-run", references: items.length, objects: objects.size, bytes: [...objects.values()].reduce((n, o) => n + o.bytes.length, 0), category: "Investing & Money" }));
if (!process.argv.includes("--execute")) {
  atomicJsonSync(textFile, text); atomicJsonSync(batchFile, batches);
  console.log("Staged local catalog/text/batch only; no remote writes.");
  process.exit(0);
}
nextEnv.loadEnvConfig(process.cwd());
const { headStorageObject, getStorageObject, uploadBufferToStorage, buildPublicStorageUrl } = await import("../lib/storage/storage.ts");
// Optional use of the already-authenticated CLI account. Token stays in memory;
// this does not replace ADC, persist credentials or change project permissions.
let cliToken;
if (process.argv.includes("--gcloud-auth")) {
  cliToken = execFileSync(process.platform === "win32" ? "gcloud.cmd" : "gcloud", ["auth", "print-access-token", "--quiet"], { encoding: "utf8", windowsHide: true, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!cliToken || /\s/.test(cliToken)) throw Error("CLI did not supply one access token.");
}
async function cliRequest(key, query = "", init = {}) {
  const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(process.env.GCP_STORAGE_BUCKET)}/o/${encodeURIComponent(key)}${query}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${cliToken}` } });
  if (!response.ok) throw Object.assign(Error(`Storage read failed HTTP ${response.status}.`), { code: response.status });
  return response;
}
async function verify(o) {
  const head = cliToken ? await cliRequest(o.key).then(r => r.json()).then(m => ({ ContentLength: Number(m.size), ContentType: m.contentType })) : await headStorageObject({ key: o.key });
  if (head.ContentLength !== o.bytes.length || head.ContentType?.split(";")[0] !== o.contentType) throw Error("Stored metadata mismatch.");
  const bytes = cliToken ? await cliRequest(o.key, "?alt=media").then(async r => Buffer.from(await r.arrayBuffer())) : await getStorageObject({ key: o.key }).then(async response => Buffer.from(await new Response(response.Body.transformToWebStream()).arrayBuffer()));
  if (hash(bytes) !== o.sha256 || bytes.length !== o.bytes.length) throw Error("Stored bytes mismatch.");
  const publicResponse = await fetch(buildPublicStorageUrl(o.key));
  if (!publicResponse.ok || hash(Buffer.from(await publicResponse.arrayBuffer())) !== o.sha256) throw Error("Public readback mismatch.");
}
let uploaded = 0;
for (const o of objects.values()) {
  try { await verify(o); }
  catch (error) {
    if (![404, "NoSuchKey", "NotFound"].includes(error.code) && error.$metadata?.httpStatusCode !== 404) throw error;
    if (cliToken) {
      const boundary = "ugc_wall_money_immutable_upload";
      const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: o.key, contentType: o.contentType, cacheControl: "public, max-age=31536000, immutable" })}\r\n--${boundary}\r\nContent-Type: ${o.contentType}\r\n\r\n`), o.bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(process.env.GCP_STORAGE_BUCKET)}/o?uploadType=multipart&ifGenerationMatch=0`, { method: "POST", headers: { Authorization: `Bearer ${cliToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      if (!response.ok) throw Error(`Immutable storage upload failed HTTP ${response.status}.`);
    }
    else await uploadBufferToStorage({ key: o.key, buffer: o.bytes, contentType: o.contentType, cacheControl: "public, max-age=31536000, immutable" });
    uploaded++; await verify(o);
  }
  console.log(`Verified ${o.key}`);
}
if (fs.readFileSync(textFile, "utf8") !== frozenText || fs.readFileSync(batchFile, "utf8") !== frozenBatch) throw Error("Catalog changed during upload; no activation.");
batch.status = "published";
atomicJsonSync(textFile, text); atomicJsonSync(batchFile, batches);
atomicJsonSync(releasePath, { version: 1, mediaStatus: "published", items });
atomicJsonSync(receiptPath, { verifiedAt: new Date().toISOString(), uploaded, verifiedObjects: objects.size, references: items.map(item => item.id), websiteDeployed: false, workerDeployed: false });
console.log("Immutable media verified; local release activated. Website/worker deployment remains separate.");
