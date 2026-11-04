/** Package real cached ASR. Hook selections remain drafts for user review. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const manifest = read(".tmp/talking-head-openai-2026-11-04/manifest.json");
const sources = read("lib/explore/talking-head-source-manifest.json").items;
const reviews = read("lib/explore/talking-head-hook-reviews.json");
const sourceIds = new Set(sources.map(source => source.id));
const completeIds = rows => rows.length === sourceIds.size && new Set(rows.map(row => row.referenceId)).size === sourceIds.size && rows.every(row => sourceIds.has(row.referenceId));
if (!Number.isInteger(reviews.version) || !completeIds(manifest.items) || !completeIds(reviews.items)) throw Error("The source, transcription and explicit hook-review catalogs must match completely.");
const items = manifest.items.map(row => {
  if (row.state !== "completed") throw Error("Every source must have a completed real transcription.");
  const canonical = sources.find(source => source.id === row.referenceId);
  if (!canonical || canonical.sourceSha256 !== row.sourceSha256) throw Error("Current catalog source changed.");
  const bytes = fs.readFileSync(row.responsePath);
  if (createHash("sha256").update(bytes).digest("hex") !== row.responseSha256) throw Error("Cached transcription changed.");
  const raw = JSON.parse(bytes);
  const review = reviews.items.find(item => item.referenceId === row.referenceId);
  if (!review || review.sourceSha256 !== row.sourceSha256 || review.transcriptSha256 !== row.responseSha256 || review.hookStartMs !== 0 || typeof review.hookText !== "string" || !review.hookText.trim() || !Number.isInteger(review.hookEndMs) || !(review.hookEndMs > 0 && review.hookEndMs <= row.durationMs) || !["cross_checked_draft", "needs_review"].includes(review.status) || typeof review.notes !== "string" || !review.notes.trim()) throw Error(`Missing or stale explicit hook review: ${row.referenceId}`);
  const hookText = review.hookText, endMs = review.hookEndMs;
  const hookWordCount = hookText.split(/\s+/u).length;
  const corrections = [];
  if (row.referenceId === "talking-katiemeidt8") { corrections.push("ChatGPT spelling corroborated by visible source captions; raw transcript preserved."); }
  if (row.referenceId === "talking-studywithsawyer") { corrections.push("ChatGPT spelling corroborated by the source caption at 4s; raw transcript preserved."); }
  if (row.referenceId === "talking-tessam-bible") { corrections.push("Opening 'God bless' corroborated by visible source captions; raw transcript preserved."); }
  const selectionSha256 = createHash("sha256").update(JSON.stringify({ version: reviews.version, sourceSha256: row.sourceSha256, transcriptSha256: row.responseSha256, hookText, hookStartMs: 0, hookEndMs: endMs })).digest("hex");
  return { referenceId: row.referenceId, sourceSha256: row.sourceSha256, durationMs: row.durationMs, provider: "openai", model: manifest.model, extractedAt: row.completedAt, transcriptSha256: row.responseSha256,
    fullText: raw.text, hookText, hookStartMs: 0, hookEndMs: endMs, review: review.status, corrections, selectionSha256, reviewNotes: review.notes,
    wordTimingWarnings: raw.words.filter(word => word.start === word.end).length, hookWordCount,
    segments: raw.segments.map(segment => ({ text: segment.text.trim(), startMs: Math.round(segment.start * 1000), endMs: Math.round(segment.end * 1000) })) };
});
atomicJsonSync("lib/explore/talking-head-transcripts.json", { version: 1, policy: "full-source-asr-plus-editable-hook-draft-v1", items });
console.log(JSON.stringify({ imported: items.length, crossCheckedDrafts: items.filter(item => item.review === "cross_checked_draft").length, sourceMediaChanged: false }));
