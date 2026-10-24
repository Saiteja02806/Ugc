// Isolated one-request diagnostic. Never creates application jobs or DB records.
// Local receipt prevents a repeated paid POST after interruption or lost reply.
import { randomUUID, createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Storage } from "@google-cloud/storage";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { buildReapiVideoRequest, generateReapiVideoBuffer } from "../worker/dist/lib/reapi-video.js";
import { silenceGeneratedVideo } from "../worker/dist/lib/explore-generated-reference-audio.js";
import { assertVideoEditDuration } from "../worker/dist/lib/video-reference-input.js";

const mode = process.argv[2];
if (!["--preflight", "--submit-approved-once", "--recover-existing"].includes(mode)) throw new Error("Choose an explicit preflight, approved one-time submission, or saved-task recovery.");
const folder = resolve("outputs/seedance-edit-test-2026-10-21");
const receiptPath = join(folder, "paid-test-receipt.json");
const manifest = JSON.parse(await readFile(join(folder, "preflight.json"), "utf8"));
const proposal = JSON.parse(await readFile(join(folder, "proposed-request.json"), "utf8"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const emit = value => console.log(JSON.stringify(value));
async function savedJson(path) { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
let receipt = await savedJson(receiptPath);
async function save() { await writeFile(`${receiptPath}.tmp`, JSON.stringify(receipt, null, 2) + "\n"); await rename(`${receiptPath}.tmp`, receiptPath); }
const sourceBytes = await readFile(manifest.testFile);
if (sha(sourceBytes) !== manifest.testSha256 || manifest.testSeconds !== 4 || manifest.testFrames !== 120) throw new Error("Approved source does not match preflight.");
const images = [];
for (const image of manifest.images) {
  const bytes = await readFile(join(folder, image.filename));
  if (sha(bytes) !== image.sha256) throw new Error("Approved portrait changed.");
  images.push({ ...image, buffer: bytes });
}
if (images.length !== 6 || proposal.resolution !== "720p" || proposal.content_filter !== false || proposal.generate_audio !== false || proposal.omni_reference_task_type !== "edit" || proposal.duration !== -1 || proposal.size !== "adaptive") throw new Error("Proposed request is outside approval.");
const sourceInfo = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_format", "-show_streams", "-of", "json", manifest.testFile], { encoding: "utf8", windowsHide: true }));
if (Number(sourceInfo.format.duration) !== 4 || sourceInfo.streams.some(s => s.codec_type === "audio")) throw new Error("Source is not four seconds and silent.");
const credential = process.env.REAPI_API_KEY || (() => {
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", "gcloud.cmd secrets versions access 1 --secret=reapi-api-key --project=ugcsaas"], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  if (result.status !== 0 || !result.stdout?.trim()) throw new Error("Could not read the existing configured ReAPI credential.");
  return result.stdout.trim();
})();
const bucketName = process.env.GCP_STORAGE_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
const baseUrl = process.env.GCP_STORAGE_PUBLIC_BASE_URL || process.env.GCS_PUBLIC_BASE_URL;
if (!bucketName || !baseUrl) throw new Error("Configured media storage is unavailable.");
const bucket = new Storage({ projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT }).bucket(bucketName);
await bucket.getMetadata();
if (mode === "--preflight") {
  emit({ status: "preflight-passed", sourceSeconds: 4, photos: images.length, providerCredentialAvailable: true, configuredStorageAccessible: true, existingTaskId: receipt?.providerTaskId ?? null, paidPosts: receipt?.paidPosts ?? 0, databaseWrites: 0 });
  process.exit(0);
}
if (receipt?.status === "completed") { emit({ status: receipt.status, taskId: receipt.providerTaskId, finalFile: receipt.finalFile, paidPosts: receipt.paidPosts }); process.exit(0); }
if (receipt?.submissionStartedAt && !receipt.providerTaskId) throw new Error("A previous submission is uncertain. Refusing another paid request; recover the original task first.");
if (mode === "--recover-existing" && !receipt?.providerTaskId) throw new Error("No accepted task is saved to recover.");
if (receipt?.status === "failed") throw new Error("The single approved task failed. No new paid submission is authorized.");
receipt ??= { version: 1, testId: randomUUID(), status: "preparing", paidPosts: 0, databaseWrites: 0,
  approval: { model: "seedance_2_5", provider: "reapi", resolution: "720p", targetSeconds: 4, generateAudio: false, photos: 6, expectedCostUsd: 1.288, maximumBudgetUsd: 8.05, automaticRetries: 0 }, uploads: [], sourceSha256: manifest.testSha256, imageSha256s: images.map(image => image.sha256) };
await save();
if (!receipt.providerTaskId && !receipt.request) {
  async function upload(filename, bytes, contentType) {
    const previous = receipt.uploads.find(upload => upload.filename === filename);
    if (previous) return previous.url;
    const key = `diagnostics/seedance-edit/${receipt.testId}/${filename}`;
    await bucket.file(key).save(bytes, { resumable: false, validation: "crc32c", contentType, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: "private, max-age=3600" } });
    const url = `${baseUrl.replace(/\/$/, "")}/${key}`;
    receipt.uploads.push({ filename, key, url, sha256: sha(bytes), bytes: bytes.length }); await save();
    // Verify the exact immutable bytes that the model can fetch, not just a HEAD.
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== sha(bytes)) throw new Error("Provider-readable upload failed exact-byte verification.");
    emit({ status: "verified-input-upload", filename, bytes: bytes.length });
    return url;
  }
  const videoUrl = await upload("test-source-four-seconds-silent.mp4", sourceBytes, "video/mp4");
  const imageUrls = [];
  for (const image of images) imageUrls.push(await upload(image.filename, image.buffer, "image/png"));
  const input = { model: "seedance_2_5", prompt: proposal.prompt, aspectRatio: "9:16", durationSeconds: 4, resolution: "720p", generateAudio: false,
    referenceVideoMode: "edit", referenceVideoDurationSeconds: 4, referenceVideoUrl: videoUrl, referenceImageUrls: imageUrls };
  receipt.input = input; receipt.request = buildReapiVideoRequest(input);
  receipt.requestSha256 = sha(Buffer.from(JSON.stringify(receipt.request))); await save();
}
let seenStatus;
const fetchImpl = async (url, init = {}) => {
  if (init.method === "POST") {
    if (mode !== "--submit-approved-once" || receipt.submissionStartedAt || receipt.paidPosts !== 0 || String(url) !== "https://reapi.ai/api/v1/videos/generations" || init.body !== JSON.stringify(receipt.request)) throw new Error("Refusing an additional or changed paid submission.");
    receipt.submissionStartedAt = new Date().toISOString(); receipt.paidPosts = 1; receipt.status = "submitting"; await save();
    emit({ status: "submitting-one-approved-request", model: receipt.request.model, sourceSeconds: 4, photos: 6, sound: false });
  }
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(init.method === "POST" ? 120_000 : 60_000) });
  if (String(url).startsWith("https://reapi.ai/api/v1/tasks/")) {
    try {
      const task = await response.clone().json();
      receipt.lastCheckedAt = new Date().toISOString(); receipt.providerStatus = task.status;
      if (task.status === "failed") receipt.providerFailure = task.error;
      await writeFile(join(folder, "latest-provider-task.json"), JSON.stringify(task, null, 2) + "\n"); await save();
      if (task.status !== seenStatus) { seenStatus = task.status; emit({ status: "provider-status", taskId: receipt.providerTaskId, providerStatus: task.status }); }
    } catch { /* The adapter handles malformed/network provider responses safely. */ }
  }
  return response;
};
try {
  const raw = await generateReapiVideoBuffer({ ...receipt.input, providerOperationId: receipt.providerTaskId,
    onOperationCreated: async id => { receipt.providerTaskId = id; receipt.status = "accepted"; receipt.acceptedAt = new Date().toISOString(); await save(); emit({ status: "saved-task-id", taskId: id }); },
    onOperationSucceeded: async (id, url, usage) => { receipt.providerTaskId = id; receipt.providerOutputUrl = url; receipt.usage = usage; receipt.status = "provider-completed"; await save(); },
  }, { apiKey: credential, fetchImpl, pollIntervalMs: 20_000, timeoutMs: 24 * 60_000 });
  const rawPath = join(folder, "seedance-generated-raw.mp4");
  await writeFile(rawPath, raw); receipt.rawFile = rawPath; await save();
  process.env.FFMPEG_PATH = ffmpeg;
  const final = await silenceGeneratedVideo(raw);
  const finalPath = join(folder, "seedance-generated-silent.mp4"); await writeFile(finalPath, final);
  receipt.finalFile = finalPath; receipt.outputSha256 = sha(final); receipt.outputBytes = final.length;
  const info = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_format", "-show_streams", "-of", "json", finalPath], { encoding: "utf8", windowsHide: true }));
  receipt.output = { durationSeconds: Number(info.format.duration), streams: info.streams.map(s => ({ type: s.codec_type, width: s.width, height: s.height, fps: s.avg_frame_rate, frames: s.nb_frames })) };
  try { receipt.measuredDurationSeconds = assertVideoEditDuration(final, 4); receipt.timelinePassed = true; } catch { receipt.timelinePassed = false; }
  receipt.silencePassed = !info.streams.some(s => s.codec_type === "audio");
  receipt.status = "completed"; receipt.completedAt = new Date().toISOString(); await save();
  emit({ status: receipt.status, taskId: receipt.providerTaskId, finalFile: finalPath, output: receipt.output, usage: receipt.usage, timelinePassed: receipt.timelinePassed, silencePassed: receipt.silencePassed, paidPosts: receipt.paidPosts, databaseWrites: 0 });
} catch (error) {
  receipt.status = error?.code === "REAPI.GENERATION_FAILED" || receipt.providerStatus === "failed" ? "failed" : receipt.providerTaskId ? "recoverable-existing-task" : receipt.submissionStartedAt ? "submission-uncertain" : "not-submitted";
  receipt.lastError = { name: error?.name, code: error?.code, message: "Provider test did not finish; use the saved task receipt. No automatic paid retry." }; await save();
  emit({ status: receipt.status, taskId: receipt.providerTaskId ?? null, paidPosts: receipt.paidPosts, errorCode: error?.code ?? null });
  process.exitCode = 1;
}
