import assert from "node:assert/strict";
import test from "node:test";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { hookKeyframeMotionCatalog, getHookKeyframeMotionPrompt } from "./hook-keyframe-motion.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";

const id = "explore-paired-hook-ef59f4b5e69bc9e125f8ada7", entry = hookKeyframeMotionCatalog[id];
const draft = createHookKeyframeDraft({ ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId: id, sourceSha256: entry.sourceSha256 });

test("selected Hook supplies an image-only motion preview without importing the old video-reference prompt", () => {
  const preview = getHookKeyframePromptPreview(draft);
  assert.match(preview.directions, /OPENING STATE:[\s\S]*reclining/);
  assert.match(preview.animationPrompt!, /4-second video/);
  assert.match(preview.animationPrompt!, /SOUND SETTING: OFF/);
  assert.doesNotMatch(preview.animationPrompt!, /@Video|@Image|source video|original performance|replace the performer|supporting photo/);
  assert.equal(preview.status, "preparation_preview"); assert.equal(preview.canSubmitPaidAnimation, false);
  assert.equal(preview.needsMotionReview, true); assert.equal(preview.imagePrompt, null);
  assert.equal(getHookKeyframeMotionPrompt({ referenceId: id, sourceSha256: entry.sourceSha256, startingFrameIndex: 0, durationSeconds: 4, generateAudio: false }).status, "blocked");
});

test("main/support photos apply only to the image stage; sound applies only to animation", () => {
  const d = updateHookKeyframeDraft(draft, { imageAssetIds: ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"], instructions: "Keep the same clothing." });
  const silent = getHookKeyframePromptPreview(d), soundOn = getHookKeyframePromptPreview(updateHookKeyframeDraft(d, { generateAudio: true }));
  assert.match(silent.imagePrompt!, /^Generate a new photograph of my influencer/); assert.match(silent.imagePrompt!, /Image 2 is the main face/);
  assert.match(silent.imagePrompt!, /Image 3/); assert.match(silent.imagePrompt!, /Keep the same clothing/);
  assert.equal(silent.imagePrompt, soundOn.imagePrompt); assert.equal(silent.directions, soundOn.directions);
  assert.match(soundOn.animationPrompt!, /SOUND SETTING: ON/); assert.doesNotMatch(soundOn.animationPrompt!, /SOUND SETTING: OFF/);
  assert.doesNotMatch(soundOn.animationPrompt!, /Image 2|Image 3|Keep the same clothing/);
});

test("explicit motion edits survive auto-fill, remain nonbillable and can be restored to the suggestion", () => {
  const text = "Blink naturally, then glance sideways and hold the gaze.";
  const edited = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { motionInstructions: text }));
  assert.equal(edited.directions, text); assert.equal(edited.customized, true); assert.equal(edited.canSubmitPaidAnimation, false);
  const blank = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { motionInstructions: "" }));
  assert.equal(blank.directions, ""); assert.equal(blank.animationPrompt, null);
  const restored = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { motionInstructions: null }));
  assert.equal(restored.directions, restored.suggestedDirections); assert.equal(restored.customized, false);
});

test("video-dependent edits and contradictory duration/audio commands show an error rather than an apparently ready prompt", () => {
  for (const text of ["Follow the original video.", "Swap the face from @Image 1.", "Add music.", "Wait four seconds then blink."]) {
    const preview = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { motionInstructions: text }));
    assert.equal(preview.animationPrompt, null); assert.match(preview.animationError!, /Describe visible actions directly/);
    assert.equal(preview.canSubmitPaidAnimation, false);
  }
});

test("a changed source hash never auto-fills a prompt from an earlier video", () => {
  const preview = getHookKeyframePromptPreview(createHookKeyframeDraft({ ...draft.scope, sourceSha256: "f".repeat(64) }));
  assert.equal(preview.sourceMatched, false); assert.equal(preview.suggestedDirections, ""); assert.equal(preview.animationPrompt, null);
});

test("Hook 15 auto-fills the requested eight-second variant, including after motion and sound edits", () => {
  const id = "explore-paired-hook-43cc1dae0a6cfcb03e0a9333", source = hookKeyframeMotionCatalog[id];
  const eight = createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 });
  for (const value of [eight, updateHookKeyframeDraft(eight, { motionInstructions: "Blink gently and hold a faint smile.", generateAudio: true })]) {
    const preview = getHookKeyframePromptPreview(value);
    assert.equal(preview.durationSeconds, 8);
    assert.match(preview.animationPrompt!, /8-second video/);
    assert.doesNotMatch(preview.animationPrompt!, /4-second/);
    assert.equal(preview.canSubmitPaidAnimation, false);
  }
  assert.equal(getHookKeyframePromptPreview(eight).requiresDecision, false);
});
