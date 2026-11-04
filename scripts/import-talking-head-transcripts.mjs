/** Package real cached ASR. Hook selections remain drafts for user review. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const manifest = read(".tmp/talking-head-openai-2026-11-04/manifest.json");
const sources = read("lib/explore/talking-head-source-manifest.json").items;
const ends = {
  "talking-warm-story": "travel wherever.",
  "talking-car-explainer": "until i quit",
  "talking-sophia-designsthings": "ridiculously easy.",
  "talking-emmgr4c3": "I'll show you.",
  "talking-tessam-bible": "Listen to this.",
  "talking-websites-explainer": "knowing about.",
  "talking-katiemeidt8": "So let me show you.",
  "talking-studyfetchlauren": "Let me show you.",
  "talking-studywithsab": "so here's how I study in the most efficient way.",
  "talking-studywithsawyer": "in college",
  "talking-mumtipswithginny": "just guessing,",
  "talking-car-story-full": "but that part is optional.",
  "talking-room-explainer-full": "Trust me.",
};
const crossChecked = new Set(["talking-websites-explainer", "talking-studyfetchlauren", "talking-studywithsab"]);
const items = manifest.items.map(row => {
  if (row.state !== "completed") throw Error("Every source must have a completed real transcription.");
  const canonical = sources.find(source => source.id === row.referenceId);
  if (!canonical || canonical.sourceSha256 !== row.sourceSha256) throw Error("Current catalog source changed.");
  const bytes = fs.readFileSync(row.responsePath);
  if (createHash("sha256").update(bytes).digest("hex") !== row.responseSha256) throw Error("Cached transcription changed.");
  const raw = JSON.parse(bytes), ending = ends[row.referenceId];
  const index = ending ? raw.text.toLowerCase().indexOf(ending.toLowerCase()) : -1;
  if (ending && index < 0) throw Error(`Hook selection needs review: ${row.referenceId}`);
  let hookText = ending ? raw.text.slice(0, index + ending.length).trim() : raw.text.trim();
  const hookWordCount = hookText.split(/\s+/u).length;
  // ASR words may split hyphens/names; match the selected token prefix, not an
  // assumed uniform words-per-second timeline. Explicit pilot ends are checked.
  const pilotEnds = { "talking-websites-explainer": 2740, "talking-studyfetchlauren": 10860, "talking-studywithsab": 44380 };
  const normalized = text => text.toLowerCase().replace(/[^a-z0-9]/gu, "");
  const target = normalized(hookText); let prefix = "", endMs = 0;
  for (const word of raw.words) { prefix += normalized(word.word); endMs = Math.round(word.end * 1000); if (prefix.length >= target.length) break; }
  endMs = pilotEnds[row.referenceId] ?? Math.min(row.durationMs, endMs);
  if (!(endMs > 0 && endMs <= row.durationMs)) throw Error("Invalid hook boundary.");
  const corrections = [];
  if (row.referenceId === "talking-katiemeidt8") { hookText = hookText.replaceAll("ChatGBT", "ChatGPT"); corrections.push("ChatGPT spelling corroborated by visible source captions; raw transcript preserved."); }
  if (row.referenceId === "talking-studywithsawyer") { hookText = hookText.replaceAll("chatubt", "ChatGPT"); corrections.push("ChatGPT spelling corroborated by the source caption at 4s; raw transcript preserved."); }
  if (row.referenceId === "talking-tessam-bible") { hookText = hookText.replace(/^God blessed/u, "God bless"); corrections.push("Opening 'God bless' corroborated by visible source captions; raw transcript preserved."); }
  return { referenceId: row.referenceId, sourceSha256: row.sourceSha256, durationMs: row.durationMs, provider: "openai", model: manifest.model, extractedAt: row.completedAt, transcriptSha256: row.responseSha256,
    fullText: raw.text, hookText, hookStartMs: 0, hookEndMs: endMs, review: crossChecked.has(row.referenceId) ? "cross_checked_draft" : "draft", corrections,
    wordTimingWarnings: raw.words.filter(word => word.start === word.end).length, hookWordCount,
    segments: raw.segments.map(segment => ({ text: segment.text.trim(), startMs: Math.round(segment.start * 1000), endMs: Math.round(segment.end * 1000) })) };
});
atomicJsonSync("lib/explore/talking-head-transcripts.json", { version: 1, policy: "full-source-asr-plus-editable-hook-draft-v1", items });
console.log(JSON.stringify({ imported: items.length, crossCheckedDrafts: items.filter(item => item.review === "cross_checked_draft").length, sourceMediaChanged: false }));
