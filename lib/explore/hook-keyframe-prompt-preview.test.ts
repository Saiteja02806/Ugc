import assert from "node:assert/strict";
import test from "node:test";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { hookKeyframeMotionCatalog, getHookKeyframeMotionPrompt } from "./hook-keyframe-motion.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import publicMiddle from "./hook-middle-frame-public.json" with { type: "json" };
import { buildSourceMotionDirections, type MiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { formatGeneratedMotionPhases } from "./motion-phase-display.ts";

const id = "explore-paired-hook-ef59f4b5e69bc9e125f8ada7", entry = hookKeyframeMotionCatalog[id];
const draft = createHookKeyframeDraft({ ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId: id, sourceSha256: entry.sourceSha256 });

test("Talking Head and Wall preview their own ready animation directions without Hook motion grammar", () => {
  for (const workflow of ["talking_head", "wall_text"] as const) {
    const preview = getHookKeyframePromptPreview(draft, workflow);
    assert.equal(preview.animationError, null); assert.equal(preview.requiresDecision, false);
    assert.equal(preview.durationSeconds, 4); assert.ok(preview.animationPrompt);
    assert.match(preview.directions, workflow === "talking_head" ? /user's own spoken script/ : /editable text overlay/);
    const audio = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { generateAudio: true }), workflow);
    assert.match(audio.animationPrompt!, workflow === "talking_head" ? /Generate the user's requested speech/ : /Do not add speech/);
  }
});

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
  assert.match(silent.imagePrompt!, /^Create one photorealistic original-opening/); assert.match(silent.imagePrompt!, /Image2 and later images/);
  assert.match(silent.imagePrompt!, /supporting identity photos/); assert.match(silent.imagePrompt!, /Keep the same clothing/);
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

test("every former public middle-frame case uses its full reviewed timeline at the original opening, while edits stay authoritative", () => {
  assert.equal(publicMiddle.entries.length, 21);
  for (const entry of publicMiddle.entries) {
    const source = createHookKeyframeDraft({ ...draft.scope, referenceId: entry.referenceId, sourceSha256: entry.sourceSha256 });
    const opening = updateHookKeyframeDraft(source, { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
    const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, entry.sourceDurationSeconds);
    assert.equal(preview.suggestedDirections, formatGeneratedMotionPhases(buildSourceMotionDirections(entry as MiddleFrameMotionEntry)));
    assert.match(preview.directions, /PHASE \[0–/); assert.match(preview.directions, /ENDING STATE:/);
    assert.ok(preview.animationPrompt, `${entry.referenceId}: ${preview.animationError}`);
    const edited = getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." }));
    assert.equal(edited.directions, "My own movement.");
  }
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


test("Hooks45 80 86 select reviewed six-second source-speed prompts rather than old defaults", () => {
 for(const id of ["explore-paired-hook-322af5b0d5778b474cfcfdf4","explore-paired-hook-2e28e18f894e3ba7de367ced","explore-paired-hook-717396089efc644caf411c79"]){
  const entry=hookKeyframeMotionCatalog[id];const d=updateHookKeyframeDraft(createHookKeyframeDraft({...draft.scope,referenceId:id,sourceSha256:entry.sourceSha256}),{sourceFrame:{index:0,timeSeconds:0,width:720,height:1280,sha256:"b".repeat(64)}});
  const p=getHookKeyframePromptPreview(d,"hook",undefined,undefined,undefined,entry.sourceDurationSeconds);
  assert.equal(p.durationSeconds,6);assert.equal(p.requiresDecision,false);assert.equal(p.animationError,null);assert.match(p.animationPrompt!,/6-second video/);assert.match(p.animationPrompt!,/FINAL HOLD/);
  if(id.endsWith("caf411c79"))assert.match(p.directions,/eyelids lowering|lower the eyelids/);
 }
});


test("known 4s/5s sources preview their full timeline, with only a trailing hold for 4.3s",()=>{
 const opening=updateHookKeyframeDraft(draft,{sourceFrame:{index:0,timeSeconds:0,width:720,height:1280,sha256:"b".repeat(64)},motionInstructions:"OPENING: PHASE [0–0.5]: Raise the right hand.\nENDING: PHASE [0.5–1]: Cover the mouth and hold."});
 for(const source of [4,5,4.3]){
 const p=getHookKeyframePromptPreview(opening,"hook",undefined,undefined,undefined,source);assert.equal(p.durationSeconds,Math.ceil(source));assert.equal(p.animationError,null);
 assert.match(p.animationPrompt!,new RegExp(Math.ceil(source)+"-second video"));
 if(source===4.3)assert.match(p.animationPrompt!,/FINAL HOLD 4.3–5s/);
 }
});
