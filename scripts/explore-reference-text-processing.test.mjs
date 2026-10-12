import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCAL_TEXT_PIPELINE_VERSION, assertTranscript, catalogueDraft, exactTranscript, proposeCaptionBlocks, shouldExtract } from "./explore-reference-text-processing.mjs";

const sha = "a".repeat(64);
const frame = (timestampMs, text) => ({ timestampMs, lines: text ? [{ text }] : [] });
const transcript = (frames, durationMs) => {
  const rawBlocks = exactTranscript(frames, durationMs);
  return { referenceId: "tutorial", slideId: null, sourceSha256: sha, format: "wall_text", pipelineVersion: LOCAL_TEXT_PIPELINE_VERSION, frames, durationMs, rawBlocks, proposedBlocks: proposeCaptionBlocks(rawBlocks) };
};
test("late tutorial captions survive more than twenty changing screens", () => {
  const frames = Array.from({ length: 24 }, (_, i) => frame(i * 250, `Tutorial step ${i + 1}`));
  frames.push(frame(6000, "4x damage & unlimited health\nin ACTION 🤯"));
  const source = assertTranscript(transcript(frames, 6260));
  assert.equal(source.rawBlocks.length, 25);
  assert.equal(source.rawBlocks.at(-1).text, frames.at(-1).lines[0].text);
  const draft = catalogueDraft(source);
  assert.deepEqual(draft.blocks, []);
  assert.match(draft.notes, /no partial transcript published/u);
  assert.equal(draft.status, "needs_review");
});
test("similar OCR duplicates retain every observed reading without approving", () => {
  const source = assertTranscript(transcript([frame(0, "Can do it by myself.. doesn’t want to"), frame(267, "Can do it by myseIf.. doesn’t want to"), frame(533, "Can do it by myself.. doesn’t want to")], 820));
  assert.equal(source.proposedBlocks.length, 1);
  assert.equal(source.proposedBlocks[0].variants.length, 3);
  assert.equal(source.proposedBlocks[0].requiresVisualCheck, true);
  assert.equal(source.proposedBlocks[0].endMs, 820);
  assert.equal(catalogueDraft(source).status, "needs_review");
});
test("number, currency, emoji and negation changes cannot be hidden as duplicates", () => {
  for (const [left, right] of [["$200/month from 25 to 65 at 8%", "$200/month from 25 to 65 at 9%"], ["$100 Million cash is your next choice", "€100 Million cash is your next choice"], ["bro rate my startup idea 💀🥀", "bro rate my startup idea 💀🌹"], ["You should never ask for help with this", "You should ask for help with this"]]) {
    assert.equal(transcript([frame(0, left), frame(250, right)], 500).proposedBlocks.length, 2, `${left} / ${right}`);
  }
});
test("a disappearing caption and later recurrence remain separate intervals", () => {
  const source = transcript([frame(0, "hello"), frame(250, ""), frame(500, "hello")], 800);
  assert.deepEqual(source.proposedBlocks.map(b => [b.startMs, b.endMs]), [[0, 250], [500, 800]]);
});
test("selective retries protect approved and no-text sources even with force", () => {
  for (const status of ["ready", "no_text"]) {
    const current = { status, sourceSha256: sha, blocks: [{ text: "Visually checked" }] };
    assert.equal(shouldExtract(current, { hash: sha }, { force: true, reextractUnreviewed: true }, null, "pipeline"), false);
    assert.strictEqual(catalogueDraft(transcript([frame(0, "garbled")], 500), current), current);
  }
  const current = { status: "needs_review", sourceSha256: sha };
  assert.equal(shouldExtract(current, { hash: sha }, {}, null, "pipeline"), false);
  assert.equal(shouldExtract(current, { hash: sha }, { reextractUnreviewed: true }, null, "pipeline"), true);
  const checkpoint = { status: "completed", sourceSha256: sha, pipelineHash: "pipeline" };
  assert.equal(shouldExtract(current, { hash: sha }, { reextractUnreviewed: true }, checkpoint, "pipeline"), false);
  assert.equal(shouldExtract(current, { hash: sha }, { reextractUnreviewed: true }, checkpoint, "changed"), true);
});
test("oversize copy is preserved completely and never silently shortened", () => {
  const source = transcript([frame(0, "x".repeat(6001))], 500);
  assert.equal(source.rawBlocks[0].text.length, 6001);
  assert.deepEqual(catalogueDraft(source).blocks, []);
});
test("corrupt transcript histories are rejected before saving", () => {
  const source = transcript([frame(0, "first"), frame(250, "second")], 500);
  source.proposedBlocks.pop();
  assert.throws(() => assertTranscript(source), /lost source observations/u);
  assert.throws(() => exactTranscript([frame(500, "late")], 500), /Invalid source frame interval/u);
});
