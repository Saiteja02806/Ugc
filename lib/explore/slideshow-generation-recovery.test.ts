import assert from "node:assert/strict";
import test from "node:test";
import { readSlideshowClarification, slideshowClarificationKey, slideshowClarificationMessages, slideshowClarificationMatches, slideshowClarificationScope, SLIDESHOW_CLARIFICATION_FALLBACK } from "./slideshow-generation-recovery.ts";

test("face photo identity, ordering and exact slide changes invalidate old missing-input feedback without changing no-face scopes", () => {
  const references = ["https://owned.test/source1", "https://owned.test/source4"];
  const old = slideshowClarificationScope(references, null);
  assert.equal(old, JSON.stringify({ references, regeneration: null }));
  const face = { influencer: { id: "face-a", referencePhotos: [{ id: "face-b" }] }, slideIds: ["slide-1"] };
  const scope = slideshowClarificationScope(references, null, face);
  for (const changed of [undefined, { ...face, slideIds: ["slide-4"] }, { ...face, influencer: { id: "face-b", referencePhotos: [{ id: "face-a" }] } }]) {
    assert.notEqual(slideshowClarificationScope(references, null, changed), scope);
  }
  assert.notEqual(old, scope);
});

test("planning explanations survive serialization and reject foreign, corrupt and oversized records", () => {
  const feedback = { version: 1, owner: "owner", scope: "source-five", prompt: "Use my screen on the laptop", items: ["Which screen?"] };
  assert.deepEqual(readSlideshowClarification(JSON.stringify(feedback), "owner"), feedback);
  for (const raw of [null, "{", "x".repeat(100_001), JSON.stringify({ ...feedback, owner: "other" }),
    JSON.stringify({ ...feedback, items: [] }), JSON.stringify({ ...feedback, items: [55] }),
    JSON.stringify({ ...feedback, items: ["x".repeat(501)] }), JSON.stringify({ ...feedback, version: 2 })]) {
    assert.equal(readSlideshowClarification(raw, "owner"), null);
  }
  assert.notEqual(slideshowClarificationKey("owner"), slideshowClarificationKey("other"));
});

test("English feedback remains precise; mixed-language questions use an honest English fallback", () => {
  const question = "Should Upload B be used on Source slide 1 or Source slide 2?";
  assert.deepEqual(slideshowClarificationMessages([question]), [question]);
  for (const fragment of ["背景", "背景を", "이미지", "фон"]) {
    assert.deepEqual(slideshowClarificationMessages([`Keep the ${fragment}. Which slide?`, `Keep ${fragment}.`]), [SLIDESHOW_CLARIFICATION_FALLBACK]);
  }
  assert.deepEqual(slideshowClarificationMessages(["Use José’s photo?", question, question]), ["Use José’s photo?", question]);
});

test("upload additions, removals, replacements and legacy feedback cannot diagnose the current images", () => {
  const a = "00000000-0000-4000-8000-000000000001", b = "00000000-0000-4000-8000-000000000002";
  const feedback = { version: 1 as const, owner: "owner", scope: "same-source", prompt: "Use my photos", items: ["Which face?"], imageIds: [a] };
  assert.equal(slideshowClarificationMatches(feedback, "same-source", [a]), true);
  for (const ids of [[], [b], [a, b]]) assert.equal(slideshowClarificationMatches(feedback, "same-source", ids), false);
  assert.equal(slideshowClarificationMatches(feedback, "other-source", [a]), false);
  assert.equal(slideshowClarificationMatches({ ...feedback, imageIds: undefined }, "same-source", [a]), false);
  assert.deepEqual(readSlideshowClarification(JSON.stringify(feedback), "owner"), feedback);
  for (const imageIds of [[a, a], [55], ["foreign"], "invalid"]) assert.equal(readSlideshowClarification(JSON.stringify({ ...feedback, imageIds }), "owner"), null);
});
