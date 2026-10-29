import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGeneratedMotionPhases, formatMotionPromptTimes } from "./motion-phase-display.ts";
import { retimeSourceMotionDirections } from "./hook-middle-frame-motion.ts";
import { getWallReferenceMotion } from "./wall-money-motion.ts";
import wall from "./wall-reference-motion-catalog.json" with { type: "json" };
import { getReferenceVideoPrompt, referenceVideoPrompts } from "./reference-video-prompts.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { createHookKeyframeDraft } from "./hook-keyframe-draft.ts";

test("generated Hook phase markers are concise, ordered and retain every action", () => {
  const input = "PHASE [0–0.144444444444]: glasses\nPHASE [0.144444444444–0.277777777778]: nose\nPHASE [0.277777777778–0.5]: look\nPHASE [0.5–0.922222222222]: hold\nPHASE [0.922222222222–1]: end";
  const result = formatGeneratedMotionPhases(input);
  assert.match(result, /PHASE \[0–0.14\]: glasses/);
  assert.match(result, /PHASE \[0.92–1\]: end/);
  assert.doesNotMatch(result, /\d+\.\d{3}/);
  assert.doesNotThrow(() => retimeSourceMotionDirections(result, 4));
});

test("short adjacent phases remain distinct after rounding", () => {
  const text = "PHASE [0–0.004]: a\nPHASE [0.004–0.006]: b\nPHASE [0.006–1]: c";
  const result = formatGeneratedMotionPhases(text);
  assert.match(result, /PHASE \[0.01–0.02\]: b/);
  assert.doesNotThrow(() => retimeSourceMotionDirections(result, 4));
});

test("saved instructions format timing without changing prose, identifiers or original", () => {
  const original = "PHASE [0–0.144444444]: blink\nPHASE [0.144444444–1]: smile\nHold from 1.2345–2.3456s for 2.3456 seconds. Version 1.2345 and https://example.test/1.2345 remain.";
  const formatted = formatMotionPromptTimes(original);
  assert.match(formatted, /PHASE \[0–0.14\]/);
  assert.match(formatted, /1.23–2.35s for 2.35 seconds/);
  assert.match(formatted, /Version 1.2345 and https:\/\/example.test\/1.2345/);
  assert.match(original, /0.144444444/);
});

test("reviewed Wall prompts use concise valid phase markers", () => {
  for (const entry of wall.entries) {
    const text = getWallReferenceMotion(entry.referenceId, entry.sourceSha256);
    if (!text) continue;
    const formatted = formatGeneratedMotionPhases(text);
    assert.doesNotMatch(formatted, /PHASE \[[^\]]*\d\.\d{3}/, entry.referenceId);
    assert.doesNotThrow(() => retimeSourceMotionDirections(formatted, 4), entry.referenceId);
  }
});

test("saved Hook and Wall starting-frame drafts display concise times without changing storage", () => {
  const original = "PHASE [0–0.144444444]: blink\nPHASE [0.144444444–1]: finish";
  const draft = { ...createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: "test", sourceSha256: "a".repeat(64) }), motionInstructions: original };
  for (const format of ["hook", "wall_text"] as const) {
    const preview = getHookKeyframePromptPreview(draft, format);
    assert.match(preview.directions, /PHASE \[0–0.14\]/);
    assert.equal(preview.animationError, null);
    assert.equal(draft.motionInstructions, original);
  }
});

test("reference-video prompts contain no long decimal timing values", () => {
  for (const [id, row] of Object.entries(referenceVideoPrompts)) {
    const prompt = getReferenceVideoPrompt(id, `https://example.test/${row.sourceSha256}.mp4`);
    if (prompt) assert.doesNotMatch(prompt, /\d+\.\d{3,}(?=\s*(?:s\b|seconds?\b|-seconds?\b|[–-]\s*\d))/i, id);
  }
  for (const row of wall.entries) {
    const prompt = getReferenceVideoPrompt(row.referenceId, `https://example.test/${row.sourceSha256}.mp4`);
    if (prompt) assert.doesNotMatch(prompt, /\d+\.\d{3,}(?=\s*(?:s\b|seconds?\b|-seconds?\b|[–-]\s*\d))/i, row.referenceId);
  }
});
