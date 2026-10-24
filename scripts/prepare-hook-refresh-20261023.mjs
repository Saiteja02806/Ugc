import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";
import { canonicalHookSource } from "../worker/src/lib/explore-instagram-source.ts";
import { buildHookAnimationPrompt, hookMotionPlanDirections } from "../lib/explore/hook-keyframe-motion.ts";
import { renderExploreReferenceAudio } from "../worker/dist/lib/explore-reference-audio-render.js";

const root = process.cwd(), source = "D:/hookswithlinks/notbeen";
const staging = path.join(root, ".tmp/hook-folder-refresh-20261023"), media = path.join(staging, "media");
const releasePath = "worker/src/lib/explore-hook-reference-oct23-refresh-release.json";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
if (fs.existsSync(releasePath) && read(releasePath).mediaStatus === "published") throw Error("Published refresh is immutable.");
if (read("lib/explore/reference-upload-batches.json").batches.some(batch => batch.id === "explore-20261023-hook-refresh")) throw Error("Refresh is already prepared; do not overwrite its source reviews.");
fs.mkdirSync(media, { recursive: true });
const inventory = read(path.join(staging, "inventory.json"));
const reviews = read("scripts/data/hook-refresh-oct23-reviews.json");
const previous = fs.readdirSync("worker/src/lib").filter(name => /^explore-hook-reference-.*release\.json$/.test(name) && name !== path.basename(releasePath))
  .flatMap(name => read("worker/src/lib/" + name).items ?? []);
const objects = new Map(), items = [], checks = [], texts = [], observations = [], rewrites = [], skipped = [];
const probe = file => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8", windowsHide: true }));
function stage(bytes, extension, contentType) {
  const sha256 = hash(bytes), file = `${sha256}.${extension}`, key = `explore/paired-references/v1/${file}`;
  fs.writeFileSync(path.join(media, file), bytes);
  objects.set(key, { key, sha256, file, bytes: bytes.length, contentType });
  return { sha256, key, file };
}
for (const review of reviews.items) {
  const row = inventory.find(item => item.folder === review.folder);
  if (!row) throw Error("Missing inspected source folder.");
  const folder = path.join(source, review.folder), candidates = row.files.filter(file => file.name.startsWith("muted_") && file.name.endsWith(".mp4"));
  if (candidates.length !== 1) throw Error("Choose exactly one reaction-only video.");
  const candidate = candidates[0], sourcePath = path.join(folder, candidate.name), videoBytes = fs.readFileSync(sourcePath);
  if (hash(videoBytes) !== candidate.sha256) throw Error("Source changed after inspection.");
  if (candidate.matches.length) throw Error("Source video already imported.");
  const info = probe(sourcePath), stream = info.streams.find(item => item.codec_type === "video");
  if (!stream || info.streams.some(item => item.codec_type === "audio") || Number(stream.nb_read_frames) !== candidate.frames) throw Error("Reaction source changed.");
  const durationSeconds = Number(stream.duration), frameCount = Number(stream.nb_read_frames);
  const sourceLink = canonicalHookSource(fs.readFileSync(path.join(folder, "New Text Document.txt"), "utf8"));
  if (!sourceLink) throw Error("Invalid source post.");
  const samePost = previous.find(item => canonicalHookSource(item.sourceUrl ?? item.instagramUrl)?.url === sourceLink.url);
  if (samePost) {
    skipped.push({ folder: review.folder, reason: "Source post already registered; retain its existing identity and trim.", existingReferenceId: samePost.id, sourceUrl: sourceLink.url });
    continue;
  }
  const audioFiles = row.files.filter(file => file.name.endsWith(".mp3"));
  let audioPath, audioOrigin;
  if (review.folder === "New folder (2)") {
    const track = read(path.join(staging, "default-track.json"));
    if (track.id !== "hook_audio_006") throw Error("Unapproved default track.");
    audioPath = path.join(staging, "default-background.mp3");
    audioOrigin = { kind: "approved_default", id: track.id, url: track.audioUrl, userDecision: "Use default background music" };
  } else if (audioFiles.length === 1) {
    audioPath = path.join(folder, audioFiles[0].name);
    if (hash(fs.readFileSync(audioPath)) !== audioFiles[0].sha256) throw Error("Supplied audio changed.");
    audioOrigin = { kind: "supplied_mp3", file: audioPath };
  } else {
    const original = row.files.find(file => file.name.startsWith("ssstik") && file.audio);
    if (!original) throw Error("Missing supplied audio.");
    const originalPath = path.join(folder, original.name);
    if (hash(fs.readFileSync(originalPath)) !== original.sha256) throw Error("Full source changed.");
    audioPath = path.join(staging, `reaction-audio-${review.folder.match(/\d+/)[0]}.mp3`);
    // Retain only the reaction's audio interval; later product-demo narration stays out.
    execFileSync(ffmpeg, ["-y", "-v", "error", "-i", originalPath, "-t", String(durationSeconds), "-vn", "-c:a", "libmp3lame", "-q:a", "2", audioPath], { windowsHide: true });
    audioOrigin = { kind: "supplied_reaction_interval", file: originalPath, sourceSha256: original.sha256, startSeconds: 0, endSeconds: durationSeconds };
  }
  const audioInfo = probe(audioPath), audioDurationSeconds = Number(audioInfo.format.duration);
  if (!audioInfo.streams.some(item => item.codec_type === "audio") || audioDurationSeconds < durationSeconds - .05) throw Error("Missing or too-short audio.");
  const video = stage(videoBytes, "mp4", "video/mp4"), audio = stage(fs.readFileSync(audioPath), "mp3", "audio/mpeg");
  const id = `explore-paired-hook-${hash(`${video.sha256}:${audio.sha256}`).slice(0, 24)}`;
  if (previous.some(item => item.id === id || item.videoSha256 === video.sha256 || canonicalHookSource(item.sourceUrl ?? item.instagramUrl)?.url === sourceLink.url)) throw Error("Duplicate reference identity or source post.");
  const posterBytes = execFileSync(ffmpeg, ["-v", "error", "-i", sourcePath, "-frames:v", "1", "-vf", "scale=360:-2", "-f", "image2pipe", "-vcodec", "png", "-"], { windowsHide: true, maxBuffer: 5e6 });
  const poster = stage(await sharp(posterBytes).webp({ quality: 85 }).toBuffer(), "webp", "image/webp");
  const workDir = fs.mkdtempSync(path.join(staging, "preview-"));
  const rendered = await renderExploreReferenceAudio({ sourcePath, audioPath, workDir, volume: .2, replaceOriginal: true, tools: { ffmpeg, ffprobe: ffprobe.path } });
  const preview = stage(fs.readFileSync(rendered.outputPath), "mp4", "video/mp4");
  const pixelHash = file => hash(execFileSync(ffmpeg, ["-v", "error", "-i", file, "-map", "0:v:0", "-f", "hash", "-hash", "sha256", "-"], { windowsHide: true }));
  if (pixelHash(sourcePath) !== pixelHash(rendered.outputPath)) throw Error("Soundtrack preview altered video frames.");
  const item = { id, format: "hook", title: `Hook ${100 + items.length}`, sourceUrl: sourceLink.url, sourcePlatform: sourceLink.platform,
    videoStorageKey: video.key, audioStorageKey: audio.key, posterStorageKey: poster.key, previewStorageKey: preview.key,
    videoSha256: video.sha256, audioSha256: audio.sha256, posterSha256: poster.sha256, previewSha256: preview.sha256,
    durationSeconds, audioDurationSeconds, width: stream.width, height: stream.height,
    audioTitle: audioOrigin.kind === "approved_default" ? "Default background music" : audioOrigin.kind === "supplied_mp3" ? path.basename(audioPath) : "Original reaction audio", sourceFolder: review.folder };
  items.push(item);
  const now = new Date().toISOString(), performance = [review.openingState, ...review.actions, review.camera, review.endingState, ...review.constraints].join(" ");
  texts.push({ referenceId: id, slideId: null, sourceSha256: video.sha256, format: "hook", status: "ready", blocks: [{ text: review.text, startMs: 0, endMs: Math.ceil(durationSeconds * 1000) }], extractedAt: now, model: "manual-visual-review", notes: `Caption visually checked across all ${frameCount} decoded frames of the supplied reaction-only clip. Full download's later content is excluded. Timing covers the retained clip; source claims are not fact-checked.` });
  observations.push({ referenceId: id, version: 2, sourceSha256: video.sha256, reviewMethod: "all_decoded_frames", reviewedFrameCount: frameCount,
    reviewNotes: `All ${frameCount} decoded frames inspected chronologically, including opening and ending. Reaction-only source preserved byte-for-byte; preview copies identical decoded video pixels and adds registered audio. No generated output tested.`, performance });
  const plan = { openingState: review.openingState, beats: review.actions.map((action, index) => ({ phase: ["opening", "middle", "ending"][index], action })), camera: review.camera, endingState: review.endingState, constraints: review.constraints };
  buildHookAnimationPrompt({ directions: hookMotionPlanDirections(plan), durationSeconds: 4, generateAudio: false });
  const motion = { catalogVersion: 1, referenceId: id, sourceSha256: video.sha256, displayTitle: item.title, sourceDurationSeconds: durationSeconds,
    sourceReviewedFrameCount: frameCount, sourceReviewMethod: "all_decoded_frames", sourceReviewNotes: observations.at(-1).reviewNotes,
    sourceObservations: performance, motionReviewStatus: "needs_motion_review", riskFlags: review.risks };
  const rewrite = { referenceId: id, sourceSha256: video.sha256, plan, review: { status: "static_reviewed", startingFrameIndex: 0, supportedDurationsSeconds: [4], method: "canonical_frames_and_prior_notes",
    sampledFrameIndices: Array.from({ length: frameCount }, (_, index) => index), frameCount,
    reviewNote: `All ${frameCount} retained frames reviewed. Four-second motion preview adapts the ${durationSeconds}-second action using proportionate holds; it does not claim identical timing, generated facial fidelity or paid-animation approval.`, issues: [], sourceFileSha256: video.sha256, visualQualification: "not_tested" } };
  rewrites.push({ motion, rewrite });
  checks.push({ folder: review.folder, id, sourcePath, sourceSha256: video.sha256, frames: frameCount, durationSeconds, audioOrigin,
    audioSha256: audio.sha256, previewPixelsExact: true, sheets: candidate.sheets, sourceUrl: sourceLink.url });
  console.log(JSON.stringify({ folder: review.folder, id, frames: frameCount, audio: audioOrigin.kind }));
}
atomicJsonSync(releasePath, { version: 1, mediaStatus: "staged", activation: "pending", excludedReferenceIds: [], items });
atomicJsonSync("lib/explore/hook-reference-oct23-refresh-prompts.json", { version: 1, entries: observations });
atomicJsonSync(path.join(staging, "reviews.json"), { version: 1, texts, rewrites, checks, skipped });
atomicJsonSync(path.join(staging, "upload-manifest.json"), { version: 1, releasePath, batchId: "explore-20261023-hook-refresh", objects: [...objects.values()], checks, skipped });
const batches = read("lib/explore/reference-upload-batches.json");
if (batches.batches.some(batch => batch.id === "explore-20261023-hook-refresh")) throw Error("Refresh batch already registered.");
batches.batches.push({ id: "explore-20261023-hook-refresh", format: "hook", sequence: Math.max(...batches.batches.filter(batch => batch.format === "hook").map(batch => batch.sequence)) + 1, status: "staged", referenceIds: items.map(item => item.id) });
atomicJsonSync("lib/explore/reference-upload-batches.json", batches);
for (const [file, key, records] of [["lib/explore/reference-text-catalog.json", "items", texts], ["lib/explore/hook-keyframe-motion-catalog.json", "entries", rewrites.map(value => value.motion)], ["lib/explore/hook-keyframe-motion-plans-c.json", "entries", rewrites.map(value => value.rewrite)]]) {
  const value = read(file);
  if (records.some(record => value[key].some(existing => existing.referenceId === record.referenceId))) throw Error("Review already registered; do not overwrite.");
  value[key].push(...records); atomicJsonSync(file, value);
}
console.log(JSON.stringify({ hooks: items.length, objects: objects.size, bytes: [...objects.values()].reduce((n, object) => n + object.bytes, 0), frames: checks.reduce((n, check) => n + check.frames, 0) }));
