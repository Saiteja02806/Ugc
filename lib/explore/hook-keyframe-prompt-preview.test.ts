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

test("batch 1 recreation previews use the corrected source-specific directions without replacing edits", () => {
  const cases = [
    ["explore-paired-hook-4585ee949081c4e5cd835cd3", /arm remains extended toward the camera/],
    ["explore-paired-hook-ef59f4b5e69bc9e125f8ada7", /glance toward screen-right, then shift the eyes toward screen-left/],
    ["explore-paired-hook-510f7a66546d25863c268477", /raised index finger in front of the face/],
  ] as const;
  for (const [referenceId, expected] of cases) {
    const source = hookKeyframeMotionCatalog[referenceId];
    const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId, sourceSha256: source.sourceSha256 }),
      { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
    const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
    assert.match(preview.directions, expected);
    assert.match(preview.animationPrompt!, expected);
    assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
  }
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

test("Hook 18 keeps its eye closure and camera shake near the observed source ending", () => {
  const referenceId = "explore-paired-hook-9ba74d76f7f3a3e0b55f3ebc";
  const source = hookKeyframeMotionCatalog[referenceId];
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId, sourceSha256: source.sourceSha256 }),
    { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.match(preview.animationPrompt!, /1\.39–1\.78s: Briefly close and reopen/);
  assert.match(preview.animationPrompt!, /1\.78–2\.17s:.*viewpoint shakes/);
  assert.match(preview.animationPrompt!, /FINAL HOLD 2\.17–3s/);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("batch 4 source timing keeps the laptop lift, glasses removal and final expression late", () => {
 const cases = [
  ["explore-paired-hook-59dee735a7c5d1643bc57127", /1\.93–2\.3s: Tilt the laptop lid/],
  ["explore-paired-hook-43f2c2d266d23e3af05875d8", /2\.18–2\.57s: Pull the glasses/],
  ["explore-paired-hook-62f80506cbbedab0d340f863", /1\.09–1\.63s: Narrow the mouth/],
 ] as const;
 for (const [referenceId, expected] of cases) {
  const source = hookKeyframeMotionCatalog[referenceId];
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.match(preview.animationPrompt!, expected);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
 }
});

test("batch 5 glasses actions retain the source pauses and respect user edits", () => {
 const cases = [
  ["explore-paired-hook-4ddf4d0f6dc4493f7eb6572f", /2\.1–2\.57s: Move the glasses temple away/],
  ["explore-paired-hook-f24aeb3d18886faf62ca3b8c", /1\.13–1\.32s: Release the glasses/],
 ] as const;
 for (const [referenceId, expected] of cases) {
  const source = hookKeyframeMotionCatalog[referenceId];
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.match(preview.animationPrompt!, expected);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
 }
});

test("Hook 36 local preview retains the pause before its questioning gesture", () => {
 const referenceId = "explore-paired-hook-f1b5421be14d24803539be89";
 const source = hookKeyframeMotionCatalog[referenceId];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /0\.33–0\.77s: Lift the hand/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 46 late eye closure follows its source and leaves the other Hook 46 and user edits intact", () => {
 const id = "explore-paired-hook-318267dcb393c3e701c8c944";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /1\.97–2\.07s: Briefly close eyes/);
 assert.match(preview.animationPrompt!, /2\.07–2\.19s: Reopen eyes/);
 assert.match(preview.animationPrompt!, /mouth is already covered/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
 const otherId = "explore-paired-hook-4aa27111a23b04a6dd27717b";
 const other = hookKeyframeMotionCatalog[otherId];
 const otherOpening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: otherId, sourceSha256: other.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const otherPreview = getHookKeyframePromptPreview(otherOpening, "hook", undefined, undefined, undefined, other.sourceDurationSeconds);
 assert.match(otherPreview.animationPrompt!, /Lower hand away from mouth/);
 assert.doesNotMatch(otherPreview.animationPrompt!, /1\.97–2\.07s: Briefly close eyes/);
});

test("Hook 54 waits for the source close-up before the smile, preserving user edits", () => {
 const id = "explore-paired-hook-cdddd09fdd3b5a23d9949205";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /0\.41–0\.76s: Keep the questioning pursed expression/);
 assert.match(preview.animationPrompt!, /0\.76–1\.02s: As the view tightens/);
 assert.match(preview.animationPrompt!, /FINAL HOLD 1\.77–3s/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 51 retains the late laptop lid lift without imposing an unseen opening angle", () => {
 const id = "explore-paired-hook-d7a0b28cd22cc29d618a5a6d";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /3\.01–3\.2s: As the other hand settles near the base, raise the visible laptop lid/);
 assert.doesNotMatch(preview.animationPrompt!, /partially open silver laptop/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 59 retains the source mouth cover and later release without replacing edits", () => {
 const id = "explore-paired-hook-bfd6368d9fc52f44c6422a2b";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /0\.21–0\.34s: Raise screen-left hand/);
 assert.match(preview.animationPrompt!, /0\.89–1\.01s: Lower hand/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("batch 11 keeps Hook 63 moving through the source ending and Hook 68 hand contact grounded", () => {
 for (const [id, pattern] of [
  ["explore-paired-hook-20446a41b05ed3e9fdb6af95", /1\.39–1\.53s: Release fingertip contact/],
  ["explore-paired-hook-ac9ab2b1ecf8c6ab095fcc82", /fingertips meeting across the mouth/],
 ] as const) {
  const source = hookKeyframeMotionCatalog[id];
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.match(preview.animationPrompt!, pattern);
  if (id.includes("20446a")) assert.match(preview.animationPrompt!, /1\.95–2\.31s: Continue moving/);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
 }
});

test("Hook 69 keeps the late second eye narrowing before the final smile", () => {
 const id = "explore-paired-hook-c7ffd19dc027af1ff4034aeb", source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /Narrow eyes briefly again/);
 assert.doesNotMatch(preview.animationPrompt!, /1\.2–1\.52s: Look up screen-right/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 90 retains the later eye widening and temple release without replacing user edits", () => {
 const id = "explore-paired-hook-349e499826f7491d91f6b712", source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.ok(preview.animationPrompt, "corrected plan must remain admitted by the rewrite contract");
 assert.match(preview.animationPrompt, /0\.69–0\.92s: Blink again, then reopen and widen/);
 assert.match(preview.animationPrompt, /1\.43–2\.48s: Alternate the lens-directed stare with several brief blinks/);
 assert.match(preview.animationPrompt, /2\.48–2\.67s: Close the eyes briefly as the fingertips leave the temple/);
 assert.match(preview.animationPrompt, /FINAL HOLD 4\.6–5s/);
 assert.doesNotMatch(preview.animationPrompt, /1\.84–2\.44s: Blink again, then lower hand/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 105 continues the head tilt and laptop gaze through its real source ending", () => {
 const id = "explore-paired-hook-3cddc94937cdb32947f9e0c2", source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.ok(preview.animationPrompt);
 assert.match(preview.animationPrompt, /1\.39–1\.63s: Lower the eyelids and gaze toward the laptop/);
 assert.match(preview.animationPrompt, /1\.63–1\.83s: Ease the head slightly back toward upright/);
 assert.match(preview.animationPrompt, /FINAL HOLD 1\.83–3s/);
 assert.doesNotMatch(preview.animationPrompt, /1\.12–1\.83s: Sustain/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("final public references keep the real last blink and avoid inventing a palm-facing gesture", () => {
 for (const [id, expected] of [
  ["explore-paired-hook-c15a0f9f2a7c4a28d5330825", /0\.88–1s: Begin a soft blink/],
  ["explore-paired-hook-d426f4a2248708f61298bf7f", /hand vertically beside the face, fingers pointing upward/],
 ] as const) {
  const source = id.includes("c15a0f") ? hookKeyframeMotionCatalog[id] : { sourceSha256: "d426f4a2248708f61298bf7fc9a57500c3201811b2680509013680d177d40a1f", sourceDurationSeconds: 3.3 };
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.match(preview.animationPrompt!, expected);
  assert.doesNotMatch(preview.animationPrompt!, /palm toward the camera/);
  assert.equal(getHookKeyframePromptPreview({ ...opening, motionInstructions: "My own movement." }).directions, "My own movement.");
 }
});
