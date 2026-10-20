import test from "node:test";
import assert from "node:assert/strict";
import { scoreSubtitleBenchmark } from "./subtitle-benchmark.mjs";
const ref = { sourceSha256: "test-hash", durationMs: 2000, reviewStatus: "human-checked", reviewer: "Test fixture", checkedAt: "2026-10-01",
  words: [{ text: "Hello,", startMs: 100, endMs: 400 }, { text: "world.", startMs: 500, endMs: 900 }] };
test("measures boundary bias independently of correct text", () => {
  const result = scoreSubtitleBenchmark({ sourceSha256: "test-hash", words: [{ text: "hello", startMs: 200, endMs: 500 }, { text: "WORLD", startMs: 600, endMs: 1000 }] }, ref);
  assert.equal(result.transcription.wer, 0);
  assert.equal(result.timing.allBoundaries.meanSignedMs, 100);
  assert.equal(result.timing.allBoundaries.p95AbsoluteMs, 100);
});
test("charges recognition mistakes and excludes them from matched timing statistics", () => {
  const result = scoreSubtitleBenchmark({ sourceSha256: "test-hash", words: [{ text: "hello", startMs: 100, endMs: 400 }, { text: "moon", startMs: 500, endMs: 900 }] }, ref);
  assert.equal(result.transcription.substitutions, 1);
  assert.equal(result.transcription.wer, 0.5);
  assert.equal(result.timing.matchedWords, 1);
  assert.equal(result.timing.excludedReferenceWords, 1);
  assert.equal(result.meetsProvisionalTolerance, false);
});
test("tracks insertions and deletions", () => {
  const deletion = scoreSubtitleBenchmark({ sourceSha256: "test-hash", words: [ref.words[0]] }, ref);
  assert.equal(deletion.transcription.deletions, 1);
  const insertion = scoreSubtitleBenchmark({ sourceSha256: "test-hash", words: [...ref.words, { text: "extra", startMs: 1000, endMs: 1100 }] }, ref);
  assert.equal(insertion.transcription.insertions, 1);
});
test("rejects unchecked references, source mismatches and malformed timing", () => {
  const prediction = { sourceSha256: "test-hash", words: ref.words };
  assert.throws(() => scoreSubtitleBenchmark(prediction, { ...ref, reviewStatus: "pending" }), /human-checked/);
  assert.throws(() => scoreSubtitleBenchmark({ ...prediction, sourceSha256: "different" }, ref), /hashes/);
  assert.throws(() => scoreSubtitleBenchmark(prediction, { ...ref, words: [{ text: "Hello", startMs: null, endMs: null }] }), /Invalid/);
});
