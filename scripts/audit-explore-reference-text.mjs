// Read-only source/text audit. Never changes readiness or calls a provider.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffprobe from "ffprobe-static";
import { sourceInventory } from "./explore-reference-text-inventory.mjs";
import { ReferenceTextSchema } from "../lib/explore/reference-text.ts";
import { assertTranscript } from "./explore-reference-text-processing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(root, "lib/explore/reference-text-catalog.json"), "utf8"));
const inventory = sourceInventory();
const transcriptPath = path.join(root, "lib/explore/reference-text-transcripts.json");
const transcripts = new Map((existsSync(transcriptPath) ? JSON.parse(readFileSync(transcriptPath, "utf8")).items : []).map(item => [JSON.stringify([item.referenceId, item.slideId]), item]));
const sources = new Map([".tmp/explore-catalog/media", ".tmp/explore-paired-references/media"].flatMap(directory => {
  const absolute = path.join(root, directory);
  return existsSync(absolute) ? readdirSync(absolute).flatMap(f => {
    const original = f.match(/^([a-f0-9]{64})\.(?:mp4|jpg|jpeg|png|webp)$/iu);
    return original ? [[original[1], path.join(absolute, f)]] : [];
  }) : [];
}));
const identity = (ref, slide) => JSON.stringify([ref, slide]);
const expected = new Map(inventory.flatMap(ref => ref.units.map(unit => [identity(ref.referenceId, unit.slideId), { ...unit, format: ref.format }])));
const normalized = text => text.toLowerCase().replace(/[^a-z0-9]/g, "");
function similarity(a, b) {
  a = normalized(a); b = normalized(b);
  if (!a || !b) return 0;
  const pairs = value => { const result = new Map(); for (let i = 0; i < value.length - 1; i++) { const pair = value.slice(i, i + 2); result.set(pair, (result.get(pair) ?? 0) + 1); } return result; };
  const left = pairs(a), right = pairs(b);
  let common = 0; for (const [pair, count] of left) common += Math.min(count, right.get(pair) ?? 0);
  return 2 * common / Math.max(1, a.length + b.length - 2);
}
const seen = new Set();
const rows = catalog.items.map(item => {
  const key = identity(item.referenceId, item.slideId), unit = expected.get(key);
  const errors = [];
  if (!ReferenceTextSchema.safeParse(item).success) errors.push("invalid-schema");
  if (seen.has(key)) errors.push("duplicate-identity"); seen.add(key);
  if (!unit || unit.hash !== item.sourceSha256 || unit.format !== item.format) errors.push("source-mapping-mismatch");
  const source = sources.get(item.sourceSha256);
  if (!source) errors.push("missing-local-original");
  else if (createHash("sha256").update(readFileSync(source)).digest("hex") !== item.sourceSha256) errors.push("source-bytes-mismatch");
  const directory = path.join(root, ".tmp/explore-reference-text-local", item.sourceSha256);
  const transcript = transcripts.get(key);
  if (transcript) {
    try { assertTranscript(transcript); } catch { errors.push("invalid-lossless-transcript"); }
    if (transcript.sourceSha256 !== item.sourceSha256) errors.push("transcript-source-mismatch");
  }
  const rawPath = transcript ? path.join(root, transcript.rawOcrPath) : path.join(directory, "ocr.json");
  const raw = existsSync(rawPath) ? JSON.parse(readFileSync(rawPath, "utf8")) : [];
  if (!raw.length) errors.push("missing-raw-ocr");
  if (transcript && existsSync(rawPath) && createHash("sha256").update(readFileSync(rawPath)).digest("hex") !== transcript.rawOcrSha256) errors.push("raw-ocr-bytes-mismatch");
  const frames = transcript ? transcript.frames.map(frame => ({ path: path.join(root, frame.path), timestampMs: frame.timestampMs, text: frame.lines.map(line => line.text).join("\n").trim() })) : raw.map((frame, i) => ({ path: frame.path, timestampMs: item.format === "slideshow" ? null : i * 500, text: frame.lines.map(line => line.text).join("\n").trim() }));
  const rawBlocks = [];
  for (let i = 0; i < frames.length; i++) {
    if (!frames[i].text) continue;
    const previous = rawBlocks.at(-1);
    if (previous?.text === frames[i].text && previous.lastFrame === i - 1) previous.lastFrame = i;
    else rawBlocks.push({ text: frames[i].text, firstFrame: i, lastFrame: i });
  }
  let nearIdenticalTransitions = 0;
  for (let i = 1; i < rawBlocks.length; i++) if (rawBlocks[i].text !== rawBlocks[i - 1].text && similarity(rawBlocks[i].text, rawBlocks[i - 1].text) >= .90) nearIdenticalTransitions++;
  const flags = [];
  if (!item.blocks.length && item.status !== "no_text") flags.push("empty-extraction");
  if (item.status === "no_text") flags.push("confirmed-no-eligible-text");
  const draftBlocks = transcript?.proposedBlocks ?? rawBlocks;
  if (draftBlocks.length > 20 || draftBlocks.some(b => b.text.length > 6000)) flags.push("editor-capacity-review");
  if (nearIdenticalTransitions >= 3) flags.push("possible-duplicate-fragments");
  let durationMs = null;
  if (item.format !== "slideshow" && source) {
    durationMs = Math.round(Number(JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_entries", "format=duration", "-of", "json", source], { encoding: "utf8" })).format.duration) * 1000);
    flags.push("approximate-video-timing");
    if (item.blocks.some(b => b.endMs > durationMs)) errors.push("timing-outside-source");
  }
  const priority = item.status !== "needs_review" ? "reviewed" : flags.includes("empty-extraction") || flags.includes("editor-capacity-review") ? "high" : flags.includes("possible-duplicate-fragments") ? "medium" : "standard";
  return { referenceId: item.referenceId, slideId: item.slideId, sourceSha256: item.sourceSha256, format: item.format, status: item.status, priority, errors, flags, savedBlocks: item.blocks, rawBlockCount: rawBlocks.length, frameCount: frames.length, emptyFrameCount: frames.filter(f => !f.text).length, nearIdenticalTransitions, durationMs, source, preview: frames[0]?.path, rawPath, frames, completeBlocks: transcript?.rawBlocks ?? [], proposedBlocks: transcript?.proposedBlocks ?? [], alternateReadings: transcript?.alternateReadings.map(reading => ({ ...reading, path: path.join(root, reading.path) })) ?? [], pipelineVersion: transcript?.pipelineVersion ?? "legacy-2fps" };
});
const result = {
  generatedAt: new Date().toISOString(),
  scope: "All catalogue identities and original source bytes checked. V2 retains every sampled OCR observation and actual sampled frame timestamps, with no transcript block limit. Legacy videos use 2fps; V2 samples at up to 4fps plus the final source frame. OCR hints do not establish accuracy; video boundaries remain approximate until visually checked.",
  summary: { references: inventory.length, expectedUnits: expected.size, savedUnits: rows.length, missingEntries: [...expected.keys()].filter(key => !seen.has(key)).length, structuralErrors: rows.reduce((sum, row) => sum + row.errors.length, 0), status: {}, priority: {}, flags: {} },
  rows,
};
for (const row of rows) {
  result.summary.status[row.status] = (result.summary.status[row.status] ?? 0) + 1;
  result.summary.priority[row.priority] = (result.summary.priority[row.priority] ?? 0) + 1;
  for (const flag of row.flags) result.summary.flags[flag] = (result.summary.flags[flag] ?? 0) + 1;
}
mkdirSync(path.join(root, ".tmp/remix-text-audit"), { recursive: true });
writeFileSync(path.join(root, ".tmp/remix-text-audit/audit.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary, null, 2));
for (const row of rows.filter(r => r.priority === "high")) console.log(JSON.stringify({ referenceId: row.referenceId, slideId: row.slideId, hash: row.sourceSha256, flags: row.flags, rawBlocks: row.rawBlockCount }));
