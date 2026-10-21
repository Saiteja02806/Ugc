import assert from "node:assert/strict";
import test from "node:test";
import {
  approveHookKeyframeImage, createHookKeyframeDraft, hookKeyframeAnimationReadiness,
  hookKeyframeDraftStorageKey, hookKeyframeInputKey, readHookKeyframeDraft,
  recordHookKeyframeImage, serializeHookKeyframeDraft, updateHookKeyframeDraft,
  type HookKeyframeScope,
} from "./hook-keyframe-draft.ts";
import { compileReviewedHookKeyframeMotionPrompt, type HookMotionCatalogEntry, type HookMotionCompilation } from "./hook-keyframe-motion.ts";

const scope: HookKeyframeScope = { ownerId: "owner-a", draftId: "10c53909-72cd-4900-84bd-e3a81edbc399",
  referenceId: "43cc1dae0a6cfcb03e0a9333", sourceSha256: "a".repeat(64) };
const main = "1bbdffed-77c7-4e50-a1db-ccf8e523226e", support = "245420d6-848b-4b1d-812e-7c37b754e580";
const imageId = "3c9226b8-9613-4fb1-9dd1-e22388f71230";
const frame = { index: 0 as const, timeSeconds: 0 as const, width: 720, height: 1280, sha256: "b".repeat(64) };
function prepared() { return updateHookKeyframeDraft(createHookKeyframeDraft(scope), { sourceFrame: frame, imageAssetIds: [main, support], instructions: "Keep the source hairstyle." }); }
function generated() { const draft = prepared(); return recordHookKeyframeImage(draft, { assetId: imageId, inputKey: hookKeyframeInputKey(draft), promptVersion: 1 }); }
const duration = 4;
// This explicitly reviewed record exists only in this unit test. It promotes no
// production Hook and makes no claim about generated-media visual acceptance.
const motionFixture: HookMotionCatalogEntry = {
  catalogVersion: 1, referenceId: scope.referenceId, sourceSha256: scope.sourceSha256,
  displayTitle: "Unit fixture", sourceDurationSeconds: 4, sourceReviewedFrameCount: 120,
  sourceReviewMethod: "all_decoded_frames", sourceReviewNotes: "Unit fixture only.", sourceObservations: "A restrained surprised reaction.",
  motionReviewStatus: "reviewed_for_starting_frame", riskFlags: [],
  motionReview: { status: "reviewed_for_starting_frame", motionVersion: 1, startingFrameIndex: 0,
    supportedDurationsSeconds: [4, 6], reviewMethod: "source_observations_and_opening_frame",
    reviewNote: "Unit fixture only, not a qualified production record.", reviewedBy: "unit-test",
    reviewedAt: "2026-10-21T00:00:00.000Z", visualQualification: "not_tested",
    plan: { openingState: "The performer faces the lens with a relaxed expression.",
      beats: [{ phase: "opening", action: "Blink naturally." }, { phase: "middle", action: "Raise the eyebrows slightly." },
        { phase: "ending", action: "Hold a restrained surprised look." }], camera: "Keep the camera steady.",
      endingState: "The performer faces the lens with raised eyebrows.", constraints: ["Keep both hands outside the composition."] },
  },
};
function compileFixture(generateAudio = false) {
  const compiled = compileReviewedHookKeyframeMotionPrompt(motionFixture, { referenceId: scope.referenceId,
    sourceSha256: scope.sourceSha256, startingFrameIndex: 0, durationSeconds: duration, generateAudio });
  if (compiled.status !== "ready") throw new Error(`The explicit unit fixture should compile: ${compiled.reason}`);
  return compiled;
}
const motion = compileFixture();

test("preparation remains silent and cannot animate before image generation and explicit approval", () => {
  const draft = prepared();
  assert.equal(draft.generateAudio, false);
  assert.equal(hookKeyframeAnimationReadiness(draft, motion, duration).ready, false);
  assert.equal(hookKeyframeAnimationReadiness(generated(), motion, duration).ready, false);
  assert.throws(() => approveHookKeyframeImage(draft));
  const approved = approveHookKeyframeImage(generated());
  assert.equal(hookKeyframeAnimationReadiness(approved, motion, duration).ready, true);
  assert.equal(hookKeyframeAnimationReadiness(approved, null, duration).ready, false);
  assert.equal(hookKeyframeAnimationReadiness(approved, { status: "blocked", reason: "motion_review_required" }, duration).ready, false);
  assert.equal(hookKeyframeAnimationReadiness(approved, { ...motion, sourceSha256: "c".repeat(64) }, duration).ready, false);
});

test("actual compiled motion must match the selected frame, duration and sound without accepting old review declarations", () => {
  const approved = approveHookKeyframeImage(generated());
  for (const changed of [
    { ...motion, referenceId: "another-reference" },
    { ...motion, startingFrameIndex: 1 },
    { ...motion, durationSeconds: 6 },
    { ...motion, generateAudio: true },
    { ...motion, prompt: "  \n " },
    { ...motion, motionVersion: 2 } as unknown as HookMotionCompilation,
    { referenceId: scope.referenceId, sourceSha256: scope.sourceSha256, version: 1, status: "reviewed" } as unknown as HookMotionCompilation,
  ]) assert.equal(hookKeyframeAnimationReadiness(approved, changed, duration).ready, false);
  assert.equal(hookKeyframeAnimationReadiness(approved, motion, 6).ready, false);
  assert.equal(hookKeyframeAnimationReadiness(approved, motion, NaN).ready, false);
  const soundOn = updateHookKeyframeDraft(approved, { generateAudio: true });
  assert.equal(hookKeyframeAnimationReadiness(soundOn, motion, duration).ready, false);
  assert.equal(hookKeyframeAnimationReadiness(soundOn, compileFixture(true), duration).ready, true);
  const unreviewed = compileReviewedHookKeyframeMotionPrompt({ ...motionFixture, motionReviewStatus: "needs_motion_review", motionReview: undefined },
    { referenceId: scope.referenceId, sourceSha256: scope.sourceSha256, startingFrameIndex: 0, durationSeconds: duration, generateAudio: false });
  assert.equal(unreviewed.status, "blocked");
  assert.equal(hookKeyframeAnimationReadiness(approved, unreviewed, duration).ready, false);
});

test("changing the main/support order, instructions or source frame invalidates the old generated image and approval", () => {
  const approved = approveHookKeyframeImage(generated());
  for (const patch of [
    { imageAssetIds: [support, main] },
    { imageAssetIds: [main] },
    { instructions: "Keep the clothing, change only the face." },
    { sourceFrame: { ...frame, sha256: "c".repeat(64) } },
    { sourceFrame: null },
  ]) {
    const changed = updateHookKeyframeDraft(approved, patch);
    assert.equal(changed.generatedImage, null);
    assert.equal(changed.approval, null);
    assert.equal(hookKeyframeAnimationReadiness(changed, motion, duration).ready, false);
  }
  assert.deepEqual(approved.imageAssetIds, [main, support]);
  assert.equal(approved.approval?.assetId, imageId);
});

test("sound choice and no-op updates preserve the still-image checkpoint", () => {
  const approved = approveHookKeyframeImage(generated());
  const same = updateHookKeyframeDraft(approved, { imageAssetIds: [...approved.imageAssetIds], sourceFrame: { ...frame } });
  assert.deepEqual(same.approval, approved.approval);
  const sound = updateHookKeyframeDraft(approved, { generateAudio: true });
  assert.equal(sound.generateAudio, true);
  assert.deepEqual(sound.approval, approved.approval);
});

test("animation directions are independently saved and older drafts default to the Hook suggestion", () => {
  const approved = approveHookKeyframeImage(generated());
  const edited = updateHookKeyframeDraft(approved, { motionInstructions: "Blink, widen the eyes, then hold the gaze." });
  assert.equal(edited.instructions, approved.instructions);
  assert.deepEqual(edited.approval, approved.approval, "Changing motion does not require another paid starting image");
  assert.equal(hookKeyframeAnimationReadiness(edited, motion, duration).ready, false, "The old motion receipt cannot approve new custom directions");
  assert.equal(readHookKeyframeDraft(serializeHookKeyframeDraft(edited), scope)?.motionInstructions, edited.motionInstructions);
  const previous = JSON.parse(serializeHookKeyframeDraft(approved)); delete previous.motionInstructions;
  assert.equal(readHookKeyframeDraft(JSON.stringify(previous), scope)?.motionInstructions, null);
  assert.equal(updateHookKeyframeDraft(edited, { motionInstructions: "" }).motionInstructions, "");
  assert.equal(updateHookKeyframeDraft(edited, { motionInstructions: null }).motionInstructions, null);
  assert.throws(() => updateHookKeyframeDraft(edited, { motionInstructions: "x".repeat(6001) }));
  assert.throws(() => updateHookKeyframeDraft(edited, { motionInstructions: "blink\u0000" }));
});

test("saved preparation is bound to owner, workflow draft, canonical reference and exact source hash", () => {
  const draft = approveHookKeyframeImage(generated()), raw = serializeHookKeyframeDraft(draft);
  assert.deepEqual(readHookKeyframeDraft(raw, scope), draft);
  for (const changed of [
    { ...scope, ownerId: "owner-b" },
    { ...scope, draftId: "d70a0956-bd9b-42af-a95f-ec627a85f165" },
    { ...scope, referenceId: "another-hook" },
    { ...scope, sourceSha256: "d".repeat(64) },
  ]) assert.throws(() => readHookKeyframeDraft(raw, changed), /source or saved inputs changed/i);
  assert.notEqual(hookKeyframeDraftStorageKey(scope.ownerId, scope.draftId, scope.referenceId), hookKeyframeDraftStorageKey("owner-b", scope.draftId, scope.referenceId));
  assert.equal(readHookKeyframeDraft(null, scope), null);
});

test("persistence rejects URLs, unknown fields, oversized JSON and forged stale checkpoints", () => {
  const draft = prepared();
  assert.doesNotMatch(serializeHookKeyframeDraft(draft), /https?:|blob:|data:/);
  for (const value of [
    { ...draft, sourceUrl: "https://example.com/source.mp4" },
    { ...draft, scope: { ...scope, url: "https://example.com" } },
    { ...draft, imageAssetIds: ["blob:local-image"] },
    { ...draft, generatedImage: { assetId: imageId, inputKey: "old-source", promptVersion: 1 } },
    { ...draft, approval: { assetId: imageId, inputKey: hookKeyframeInputKey(draft) } },
    { ...draft, sourceFrame: { ...frame, index: 1 } },
  ]) assert.throws(() => readHookKeyframeDraft(JSON.stringify(value), scope));
  assert.throws(() => readHookKeyframeDraft(" ".repeat(24_001), scope));
  assert.throws(() => readHookKeyframeDraft("not-json", scope));
  assert.throws(() => recordHookKeyframeImage(draft, { assetId: main, inputKey: hookKeyframeInputKey(draft), promptVersion: 1 }));
});

test("distinct uploaded/owned image IDs keep the main photo explicit without silently truncating selection", () => {
  const draft = prepared();
  assert.throws(() => updateHookKeyframeDraft(draft, { imageAssetIds: [main, main.toUpperCase()] }));
  assert.throws(() => updateHookKeyframeDraft(draft, { imageAssetIds: Array.from({ length: 6 }, (_, i) => `${i}bbdffed-77c7-4e50-a1db-ccf8e523226e`) }));
  assert.throws(() => updateHookKeyframeDraft(draft, { instructions: "x".repeat(2_001) }));
  assert.throws(() => updateHookKeyframeDraft(draft, { instructions: "hello\u0000" }));
  const cleared = updateHookKeyframeDraft(draft, { imageAssetIds: [] });
  assert.equal(hookKeyframeAnimationReadiness(cleared, motion, duration).ready, false);
  assert.throws(() => recordHookKeyframeImage(cleared, { assetId: imageId, inputKey: hookKeyframeInputKey(cleared), promptVersion: 1 }));
});
