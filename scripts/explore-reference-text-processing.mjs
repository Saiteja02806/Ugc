import { createHash } from "node:crypto";

export const LOCAL_TEXT_PIPELINE_VERSION = "local-caption-review-v2";
export const textKey = item => JSON.stringify([item.referenceId, item.slideId]);
const normalize = text => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
const protectedTokens = text => (normalize(text).match(/\p{Sc}|\p{N}+(?:[.,]\p{N}+)*(?:\s*%)?|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\b(?:not|never|no|without)\b/gu) ?? []).join("|");

export function textSimilarity(left, right) {
  left = normalize(left); right = normalize(right);
  if (left === right) return 1;
  if (!left || !right) return 0;
  const pairs = text => { const bag = new Map(); for (let i = 0; i < text.length - 1; i++) { const pair = text.slice(i, i + 2); bag.set(pair, (bag.get(pair) ?? 0) + 1); } return bag; };
  const a = pairs(left), b = pairs(right); let common = 0;
  for (const [pair, count] of a) common += Math.min(count, b.get(pair) ?? 0);
  return 2 * common / Math.max(1, left.length + right.length - 2);
}

/** Full observation history is retained, even when an editor cannot use it. */
export function exactTranscript(frames, durationMs) {
  const blocks = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i], text = frame.lines.map(line => line.text).join("\n").trim();
    if (!text) continue;
    const startMs = durationMs === null ? null : frame.timestampMs;
    const endMs = durationMs === null ? null : Math.min(durationMs, frames[i + 1]?.timestampMs ?? durationMs);
    if (durationMs !== null && !(startMs >= 0 && endMs > startMs)) throw new Error("Invalid source frame interval.");
    const previous = blocks.at(-1);
    if (durationMs !== null && previous?.text === text && previous.endMs === startMs) { previous.endMs = endMs; previous.frameIndices.push(i); }
    else blocks.push({ text, startMs, endMs, frameIndices: [i] });
  }
  return blocks;
}

function bestObservedVariant(variants) {
  // Select an observed reading, never synthesize words or "correct" a number.
  const distinct = [...new Set(variants.map(v => v.text))];
  return distinct.map(text => ({ text, score: variants.reduce((sum, v) => sum + textSimilarity(text, v.text), 0) }))
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)[0]?.text ?? "";
}

/** Similarity produces review hypotheses. Conflicts remain explicit evidence. */
export function proposeCaptionBlocks(blocks) {
  const groups = [];
  for (const block of blocks) {
    const previous = groups.at(-1), anchor = previous?.variants[0]?.text;
    const contiguous = previous && block.startMs !== null && previous.endMs === block.startMs;
    const similar = anchor && textSimilarity(anchor, block.text) >= .92 && textSimilarity(previous.variants.at(-1).text, block.text) >= .92;
    // Keep changes to amounts, emojis and negation separate, however similar.
    if (contiguous && similar && protectedTokens(anchor) === protectedTokens(block.text)) {
      previous.endMs = block.endMs; previous.variants.push(block);
      previous.text = bestObservedVariant(previous.variants);
      previous.requiresVisualCheck ||= anchor !== block.text;
    } else groups.push({ text: block.text, startMs: block.startMs, endMs: block.endMs, requiresVisualCheck: false, variants: [block] });
  }
  return groups;
}

export function catalogueDraft(transcript, current, now = new Date().toISOString()) {
  if (current && current.status !== "needs_review") return current;
  const all = transcript.proposedBlocks.map(({ text, startMs, endMs }) => ({ text, startMs, endMs }));
  const overflow = all.length > 20 || all.some(b => b.text.length > 6000);
  return { referenceId: transcript.referenceId, slideId: transcript.slideId, sourceSha256: transcript.sourceSha256, format: transcript.format,
    status: "needs_review", blocks: overflow ? [] : all, extractedAt: now, model: "windows-ocr-en-US-v2",
    notes: `Local OCR v2; review policy: creator captions only. Complete ${transcript.rawBlocks.length}-block full-frame OCR retained in reference-text-transcripts.json. Similarity proposals are unapproved; verify captions, exclude UI and check emojis.${transcript.durationMs === null ? "" : " Source frame timestamps used; sampling up to 4fps, boundaries still approximate."}${overflow ? " Editor capacity exceeded; no partial transcript published. Review/consolidate the complete extraction." : ""}` };
}

export function shouldExtract(current, unit, options, checkpoint, pipelineHash) {
  if (current?.status !== undefined && current.status !== "needs_review") return false;
  if (current?.sourceSha256 === unit.hash && !options.reextractUnreviewed) return false;
  return !(checkpoint?.status === "completed" && checkpoint.sourceSha256 === unit.hash && checkpoint.pipelineHash === pipelineHash && !options.force);
}

export function assertTranscript(transcript) {
  if (!/^[a-f0-9]{64}$/u.test(transcript.sourceSha256) || transcript.pipelineVersion !== LOCAL_TEXT_PIPELINE_VERSION) throw new Error("Invalid transcript identity/version.");
  const raw = exactTranscript(transcript.frames, transcript.durationMs);
  if (JSON.stringify(raw) !== JSON.stringify(transcript.rawBlocks)) throw new Error("Lossless transcript does not match its observations.");
  if (JSON.stringify(transcript.proposedBlocks.flatMap(block => block.variants)) !== JSON.stringify(raw)) throw new Error("Duplicate proposals lost source observations.");
  if (transcript.frames.some((frame, i) => i && frame.timestampMs !== null && frame.timestampMs <= transcript.frames[i - 1].timestampMs)) throw new Error("Source timestamps must increase.");
  return transcript;
}

export function transcriptHash(transcript) {
  return createHash("sha256").update(JSON.stringify(transcript)).digest("hex");
}
