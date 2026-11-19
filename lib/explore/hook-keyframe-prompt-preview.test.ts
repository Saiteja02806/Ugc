import assert from "node:assert/strict";
import test from "node:test";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { hookKeyframeMotionCatalog, getHookKeyframeMotionPrompt } from "./hook-keyframe-motion.ts";
import { adoptCurrentTalkingHeadMotion, adoptCurrentWhatMotion, getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { getReferenceVideoPrompt } from "./reference-video-prompts.ts";
import { startingFrameWorkflowDirections } from "./starting-frame-workflow.ts";
import talkingSources from "./talking-head-source-manifest.json" with { type: "json" };
import publicMiddle from "./hook-middle-frame-public.json" with { type: "json" };
import notbeen2Motion from "./hook-notbeen2-motion.json" with { type: "json" };
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
    assert.match(audio.animationPrompt!, workflow === "talking_head" ? /Lip-sync the requested dialogue/ : /Do not add speech/);
  }
});

test("selected Hook supplies an image-only motion preview without importing the old video-reference prompt", () => {
  const preview = getHookKeyframePromptPreview(draft);
  assert.match(preview.directions, /OPENING STATE:[\s\S]*reclining/);
  assert.match(preview.animationPrompt!, /as frame 0 for 4s/);
  assert.match(preview.animationPrompt!, /SOUND SETTING: OFF/);
  assert.doesNotMatch(preview.animationPrompt!, /@Video|@Image|source video|original performance|replace the performer|supporting photo/);
  assert.equal(preview.status, "preparation_preview"); assert.equal(preview.canSubmitPaidAnimation, false);
  assert.equal(preview.needsMotionReview, true); assert.equal(preview.imagePrompt, null);
  assert.equal(getHookKeyframeMotionPrompt({ referenceId: id, sourceSha256: entry.sourceSha256, startingFrameIndex: 0, durationSeconds: 4, generateAudio: false }).status, "blocked");
});

test("batch 1 recreation previews use the corrected source-specific directions without replacing edits", () => {
  const cases = [
    ["explore-paired-hook-4585ee949081c4e5cd835cd3", /Do not withdraw the reaching arm back to the keyboard/],
    ["explore-paired-hook-ef59f4b5e69bc9e125f8ada7", /leave the lens and settle toward screen-right[\s\S]*move across toward screen-left/],
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

test("main/support photos label both stages; sound applies only to animation", () => {
  const d = updateHookKeyframeDraft(draft, { imageAssetIds: ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"], instructions: "Keep the same clothing." });
  const silent = getHookKeyframePromptPreview(d), soundOn = getHookKeyframePromptPreview(updateHookKeyframeDraft(d, { generateAudio: true }));
  assert.match(silent.imagePrompt!, /^Recreate Image1's original video opening/); assert.match(silent.imagePrompt!, /Image2 is the primary influencer face/);
  assert.match(silent.imagePrompt!, /supporting views of the SAME person/); assert.match(silent.imagePrompt!, /Keep the same clothing/);
  assert.equal(silent.imagePrompt, soundOn.imagePrompt); assert.equal(silent.directions, soundOn.directions);
  assert.match(soundOn.animationPrompt!, /SOUND SETTING: ON/); assert.doesNotMatch(soundOn.animationPrompt!, /SOUND SETTING: OFF/);
  assert.doesNotMatch(soundOn.imagePrompt!, /SOUND SETTING/);
  assert.match(soundOn.animationPrompt!, /Image 2=main face proportions/);
  assert.match(soundOn.animationPrompt!, /Image 3=same-person support/);
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
    assert.match(preview.directions, /PHASE \[0–/); assert.match(preview.directions, /ENDING:/);
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
    assert.match(preview.animationPrompt!, /as frame 0 for 8s/);
    assert.doesNotMatch(preview.animationPrompt!, /4-second/);
    assert.equal(preview.canSubmitPaidAnimation, false);
  }
  assert.equal(getHookKeyframePromptPreview(eight).requiresDecision, false);
});


test("Hooks45 80 86 select reviewed six-second source-speed prompts rather than old defaults", () => {
 for(const id of ["explore-paired-hook-322af5b0d5778b474cfcfdf4","explore-paired-hook-2e28e18f894e3ba7de367ced","explore-paired-hook-717396089efc644caf411c79"]){
  const entry=hookKeyframeMotionCatalog[id];const d=updateHookKeyframeDraft(createHookKeyframeDraft({...draft.scope,referenceId:id,sourceSha256:entry.sourceSha256}),{sourceFrame:{index:0,timeSeconds:0,width:720,height:1280,sha256:"b".repeat(64)}});
  const p=getHookKeyframePromptPreview(d,"hook",undefined,undefined,undefined,entry.sourceDurationSeconds);
  assert.equal(p.durationSeconds,6);assert.equal(p.requiresDecision,false);assert.equal(p.animationError,null);assert.match(p.animationPrompt!,/as frame 0 for 6s/);assert.match(p.animationPrompt!,/FINAL HOLD/);
  if(id.endsWith("caf411c79"))assert.match(p.directions,/eyelids lowering|lower the eyelids/);
 }
});


test("known 4s/5s sources preview their full timeline, with only a trailing hold for 4.3s",()=>{
 const opening=updateHookKeyframeDraft(draft,{sourceFrame:{index:0,timeSeconds:0,width:720,height:1280,sha256:"b".repeat(64)},motionInstructions:"OPENING: PHASE [0–0.5]: Raise the right hand.\nENDING: PHASE [0.5–1]: Cover the mouth and hold."});
 for(const source of [4,5,4.3]){
 const p=getHookKeyframePromptPreview(opening,"hook",undefined,undefined,undefined,source);assert.equal(p.durationSeconds,Math.ceil(source));assert.equal(p.animationError,null);
 assert.match(p.animationPrompt!,new RegExp("for "+Math.ceil(source)+"s"));
 if(source===4.3)assert.match(p.animationPrompt!,/FINAL HOLD 4.3–5s/);
 }
});

test("Hook 18 keeps its eye closure and camera shake near the observed source ending", () => {
  const referenceId = "explore-paired-hook-9ba74d76f7f3a3e0b55f3ebc";
  const source = hookKeyframeMotionCatalog[referenceId];
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId, sourceSha256: source.sourceSha256 }),
    { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.match(preview.animationPrompt!, /1\.39–1\.78s: The eyes close once, then open toward screen-left/);
  assert.match(preview.animationPrompt!, /1\.78–2\.17s:.*recording phone a small shake/);
  assert.match(preview.animationPrompt!, /FINAL HOLD 2\.17–3s/);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("batch 4 source timing keeps the laptop lift, glasses removal and final expression late", () => {
 const cases = [
  ["explore-paired-hook-59dee735a7c5d1643bc57127", /1\.93–2\.3s: The same hand tilts the lid more upright/],
  ["explore-paired-hook-43f2c2d266d23e3af05875d8", /2\.18–2\.57s: The same hand pulls the glasses/],
  ["explore-paired-hook-62f80506cbbedab0d340f863", /1\.09–1\.63s: The mouth stays open and the lips pull back/],
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
  ["explore-paired-hook-4ddf4d0f6dc4493f7eb6572f", /2–2.57s: The temple leaves the lips and hangs beside the chin/],
  ["explore-paired-hook-f24aeb3d18886faf62ca3b8c", /1\.13–1\.32s: The same hand lowers out of the picture/],
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
 assert.match(preview.animationPrompt!, /0\.33–0\.77s: The screen-left hand rises beside the cheek/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 46 late eye closure follows its source and leaves the other Hook 46 and user edits intact", () => {
 const id = "explore-paired-hook-318267dcb393c3e701c8c944";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /2–2\.24s: The same hand stays across the mouth\. The eyes close once/);
 assert.match(preview.animationPrompt!, /2\.24–2\.43s:.*The eyes open on the lens/);
 assert.match(preview.animationPrompt!, /hand stays across the mouth/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
 const otherId = "explore-paired-hook-4aa27111a23b04a6dd27717b";
 const other = hookKeyframeMotionCatalog[otherId];
 const otherOpening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: otherId, sourceSha256: other.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const otherPreview = getHookKeyframePromptPreview(otherOpening, "hook", undefined, undefined, undefined, other.sourceDurationSeconds);
 assert.match(otherPreview.animationPrompt!, /same hand leaves the mouth toward screen-right/);
 assert.doesNotMatch(otherPreview.animationPrompt!, /2–2\.24s: The same hand stays across the mouth\. The eyes close once/);
});

test("Hook 54 waits for the source close-up before the smile, preserving user edits", () => {
 const id = "explore-paired-hook-cdddd09fdd3b5a23d9949205";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.directions, /OPENING STATE: .*lips are slightly parted/);
 assert.doesNotMatch(preview.animationPrompt!, /OPENING STATE:/);
 assert.match(preview.animationPrompt!, /0–0\.18s: The lips hold their small opening/);
 assert.match(preview.animationPrompt!, /0\.41–0\.94s: The unseen hand brings the recording phone closer.*Stretch one what/);
 assert.match(preview.animationPrompt!, /0\.94–1\.77s: The corners lift into a small smile/);
 assert.deepEqual(preview.animationPrompt!.match(/\bwhat\b/gi), ["what"]);
 assert.match(preview.animationPrompt!, /FINAL HOLD 1\.77–3s/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hook 51 retains the late laptop lid lift without imposing an unseen opening angle", () => {
 const id = "explore-paired-hook-d7a0b28cd22cc29d618a5a6d";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /0–0\.1s: The fingers stay interlaced in front of the chest/);
 assert.match(preview.animationPrompt!, /0\.1–0\.7s: Both arms straighten over the laptop.*hands pass the edge of the frame/);
 assert.match(preview.animationPrompt!, /1\.15–2\.4s: Hard cut here/);
 assert.match(preview.animationPrompt!, /3\.01–3\.2s: As the other hand settles near the base, raise the visible laptop lid/);
 assert.doesNotMatch(preview.animationPrompt!, /partially open silver laptop/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hooks 52 and 53 preserve the first-frame pose before the source motion", () => {
  const getPreview = (suffix: string) => {
    const id = `explore-paired-hook-${suffix}`;
    const source = hookKeyframeMotionCatalog[id];
    const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }),
      { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false });
    const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
    assert.equal(preview.animationError, null);
    assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
    return preview;
  };
  const temples = getPreview("114b58d5c22018e273a346de");
  assert.match(temples.directions, /OPENING STATE: She is seated with both hands already braced at her temples.*eyes are closed and her mouth is open/);
  assert.match(temples.animationPrompt!, /0–0\.21s: Both hands stay at the temples/);
  assert.match(temples.animationPrompt!, /1\.11–1\.53s: Both hands leave the temples and sweep inward past the brow.*camera sees the backs of both hands/);
  assert.match(temples.animationPrompt!, /FINAL HOLD 3\.47–4s/);

  const closeup = getPreview("f216fd8e9397a7747a445ab7");
  assert.match(closeup.animationPrompt!, /0–0\.95s: The screen-left index finger stays at the lower lip.*lips stay slightly parted/);
  assert.match(closeup.animationPrompt!, /0\.95–1\.68s: .*unseen hand brings the recording phone closer.*Stretch one what/);
  assert.deepEqual(closeup.animationPrompt!.match(/\bwhat\b/gi), ["what"]);
  assert.match(closeup.animationPrompt!, /SOUND SETTING: OFF/);
});

test("Hook 59 retains the source mouth cover and later release without replacing edits", () => {
 const id = "explore-paired-hook-bfd6368d9fc52f44c6422a2b";
 const source = hookKeyframeMotionCatalog[id];
 const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: id, sourceSha256: source.sourceSha256 }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
 const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
 assert.match(preview.animationPrompt!, /0\.21–0\.34s: The screen-left hand rises diagonally.*fingertips touch the side of the nose.*open smile remains visible on screen-right/);
 assert.match(preview.animationPrompt!, /0\.89–1\.01s: The same hand leaves the nose and lowers out toward screen-left/);
 assert.match(preview.animationPrompt!, /1\.01–1\.41s: The unseen hand levels the recording phone slightly in the close view/);
 assert.doesNotMatch(preview.animationPrompt!, /closer again|palm rests against/);
 assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
});

test("Hooks 55–58 and 60 compile the observed prop, camera and hand changes in order", () => {
 for (const [title, chronology] of [
  ["Hook 55", /pen stays beside the cheek[\s\S]+phone a little closer[\s\S]+pen slips out of view at screen-left[\s\S]+fingertips come to rest on the temple[\s\S]+FINAL HOLD 4\.7–5s/],
  ["Hook 56", /back of the hand toward the lens[\s\S]+palm settles diagonally against the lips[\s\S]+draws the recording phone back[\s\S]+The wider view holds/],
  ["Hook 57", /lifts the upright red can[\s\S]+lowers the can below the bottom edge[\s\S]+tips it up slightly[\s\S]+same screen-left hand rises empty[\s\S]+teeth remain visible/],
  ["Hook 58", /phone closer[\s\S]+phone back slightly[\s\S]+passes across the forehead[\s\S]+same hand slides down over the nose[\s\S]+eyes stay closed/],
  ["Hook 60", /palm settles on the mouth[\s\S]+0\.41–2s: The palm stays on the mouth[\s\S]+2–2\.13s: The same hand leaves the lips and reaches out[\s\S]+settles along the bottom edge/],
 ] as const) {
  const source = Object.values(hookKeyframeMotionCatalog).find(entry => entry.displayTitle === title)!;
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }),
   { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.equal(preview.animationError, null, title);
  assert.match(preview.animationPrompt!, chronology, title);
  assert.match(preview.animationPrompt!, /SOUND SETTING: OFF/, title);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "" })).directions, "", title);
 }
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
  if (id.includes("20446a")) {
   assert.match(preview.animationPrompt!, /recording phone eases back[\s\S]+Release fingertip contact[\s\S]+performer lifts the head off the pillow/);
   assert.match(preview.animationPrompt!, /1\.95–2\.31s: The phone continues shifting/);
  }
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "My own movement." })).directions, "My own movement.");
 }
});

test("Hooks 61, 62, 64 and 65 compile the corrected motion from frame zero", () => {
 for (const [title, chronology] of [
  ["Hook 61", /pink phone stays upright[\s\S]+head starts tipping back[\s\S]+overhead hand lowers flat across the forehead/],
  ["Hook 62", /palm settles diagonally over the mouth[\s\S]+phone closer[\s\S]+phone back[\s\S]+hand leaves the mouth/],
  ["Hook 64", /extended screen-right arm moves[\s\S]+phone away and down[\s\S]+phone settles lower and slightly farther away[\s\S]+fingertips settle on the table/],
  ["Hook 65", /hand rises toward the open mouth with its back toward the lens[\s\S]+palm settles against the mouth[\s\S]+tips the recording phone up slightly[\s\S]+brief flare washes across and clears/],
 ] as const) {
  const source = Object.values(hookKeyframeMotionCatalog).find(entry => entry.displayTitle === title)!;
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }),
   { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.equal(preview.animationError, null, title);
  assert.match(preview.animationPrompt!, chronology, title);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "Use my motion." })).directions, "Use my motion.", title);
  if (title === "Hook 64") assert.match(getReferenceVideoPrompt(source.referenceId, `https://source.test/${source.sourceSha256}.mp4`)!, chronology);
 }
});

test("Hooks 66, 68 and 70 compile the corrected gaze, hand hold and camera sequence", () => {
 for (const [title, chronology] of [
  ["Hook 66", /chin stays on the cuff-covered fist[\s\S]+lids close briefly, then reopen looking up toward screen-left[\s\S]+eyes close briefly, then return toward the lens/],
  ["Hook 68", /screen-left fingers slide across the lips horizontally[\s\S]+fingertips meeting across the mouth[\s\S]+mouth is already open behind the fingers[\s\S]+both hands lower just below the lips/i],
  ["Hook 70", /tips the recording phone upward[\s\S]+ceiling lights and vent enter[\s\S]+look up toward screen-right[\s\S]+brings the recording phone closer/],
 ] as const) {
  const source = Object.values(hookKeyframeMotionCatalog).find(entry => entry.displayTitle === title)!;
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }),
   { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.equal(preview.animationError, null, title);
  assert.match(preview.animationPrompt!, chronology, title);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "" })).directions, "", title);
 }
});

test("Hooks 71–74 preserve the opening hold and compile the observed contacts and gaze", () => {
 for (const [title, chronology] of [
  ["Hook 71", /screen-right palm stays over the mouth[\s\S]+hand leaves the mouth[\s\S]+recording phone closer[\s\S]+lifts the head away from the pillow/],
  ["Hook 72", /lips relax and remain slightly parted[\s\S]+tongue comes toward the same fingertips again[\s\S]+tilts the recording phone up/],
  ["Hook 73", /hand leaves the brow and passes down in front of the face[\s\S]+same palm settles against the lips[\s\S]+glance toward screen-left, then return to the lens/],
  ["Hook 74", /already-rising screen-right hand finishes its reach[\s\S]+palm settles against the lips[\s\S]+reopen down toward screen-right[\s\S]+eyes return to the lens/],
 ] as const) {
  const source = Object.values(hookKeyframeMotionCatalog).find(entry => entry.displayTitle === title)!;
  const opening = updateHookKeyframeDraft(createHookKeyframeDraft({ ...draft.scope, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }),
   { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false });
  const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
  assert.equal(preview.animationError, null, title);
  assert.match(preview.animationPrompt!, chronology, title);
  assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: "" })).directions, "", title);
  if (title === "Hook 72") assert.ok(preview.animationPrompt!.length <= 2_500);
  if (title === "Hook 71") assert.match(getReferenceVideoPrompt(source.referenceId, `https://source.test/${source.sourceSha256}.mp4`)!, chronology);
 }
});

test("fresh Recreate uses the source-checked motion for Hooks 76–80", () => {
  const cases = [
    ["Hook 76", 4, /recording phone back[\s\S]+palm lifts from below the lip[\s\S]+Hold the wider framing[\s\S]+brings the recording phone closer[\s\S]+eyes dip slightly and narrow/],
    ["Hook 77", 3, /tip her head back[\s\S]+lowers the upright pink phone[\s\S]+fingertips slide along the brow/i],
    ["Hook 78", 3, /palm already across the lips[\s\S]+eyes hold screen-right[\s\S]+shoulders slip out of view[\s\S]+Shift eyes toward lens/],
    ["Hook 79", 3, /starts to uncurl[\s\S]+fingertips upright against the side of her nose and cheek[\s\S]+gaze lands screen-right[\s\S]+Close eyes briefly[\s\S]+Return her gaze toward the lens/],
    ["Hook 80", 6, /Hold the starting pose with her cheek on her hand[\s\S]+palm from the cheek and across the lips[\s\S]+lift it clear of the mouth[\s\S]+fingertips beside the screen-left temple[\s\S]+fingers relax a little down beside the cheek/],
  ] as const;
  for (const [title, duration, chronology] of cases) {
    const source = Object.values(hookKeyframeMotionCatalog).find(entry => entry.displayTitle === title)!;
    const opening = updateHookKeyframeDraft(
      createHookKeyframeDraft({ ...draft.scope, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }),
      { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false },
    );
    const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
    assert.equal(preview.animationError, null, title);
    assert.equal(preview.requiresDecision, false, title);
    assert.equal(preview.durationSeconds, duration, title);
    assert.match(preview.animationPrompt!, chronology, title);
    assert.match(preview.animationPrompt!, /SOUND SETTING: OFF/, title);
    assert.ok(preview.animationPrompt!.length <= 2_500, title);
    assert.match(getReferenceVideoPrompt(source.referenceId, `https://source.test/${source.sourceSha256}.mp4`)!, chronology, title);
    assert.equal(getReferenceVideoPrompt(source.referenceId, "https://source.test/replacement.mp4"), undefined, title);
    for (const saved of ["", "My own movement."]) {
      assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: saved })).directions, saved, title);
    }
  }
});

test("remaining Hook corrections reach both Recreate lookups and preserve saved directions", () => {
  const cases = [
    ["Hook 81", /recording phone closer and tips it up[\s\S]+same screen-left palm returns across the lips/],
    ["Hook 82", /face grows and sits lower beneath more ceiling[\s\S]+palm settles against the lips/],
    ["Hook 84", /Close the eyes slowly once[\s\S]+a second time[\s\S]+a third time[\s\S]+Ease the brow tension/],
    ["Hook 87", /back of the ringed hand[\s\S]+tips the recording phone up[\s\S]+briefly lowers the phone angle/],
    ["Hook 88", /ring and back of the hand[\s\S]+face grows and shifts toward the lower-left/],
    ["Hook 93", /screen-right hand lifts[\s\S]+backs of the fingers visible[\s\S]+recording phone up, showing more ceiling/],
    ["Hook 104", /recording phone closer and tips it up[\s\S]+palm meets the lips[\s\S]+She stays seated/],
    ["Hook 121", /draws it farther away[\s\S]+face smaller and lower/],
    ["Hook 123", /fingertips stay against the forehead[\s\S]+close the eyelids again through the final frame/],
  ] as const;
  for (const [title, chronology] of cases) {
    const source = [...Object.values(hookKeyframeMotionCatalog), ...notbeen2Motion.entries].find(entry => entry.displayTitle === title)!;
    const opening = updateHookKeyframeDraft(
      createHookKeyframeDraft({ ...draft.scope, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }),
      { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) }, generateAudio: false },
    );
    const preview = getHookKeyframePromptPreview(opening, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
    assert.equal(preview.animationError, null, title);
    assert.equal(preview.requiresDecision, title === "Hook 84", title);
    assert.match(preview.animationPrompt!, chronology, title);
    assert.match(getReferenceVideoPrompt(source.referenceId, `https://source.test/${source.sourceSha256}.mp4`)!, chronology, title);
    assert.equal(getReferenceVideoPrompt(source.referenceId, "https://source.test/replacement.mp4"), undefined, title);
    for (const saved of ["", "My own movement."]) {
      assert.equal(getHookKeyframePromptPreview(updateHookKeyframeDraft(opening, { motionInstructions: saved })).directions, saved, title);
    }
    if (title === "Hook 121") assert.doesNotMatch(preview.directions, /comes closer|brings it closer/);
    if (title === "Hook 123") assert.doesNotMatch(preview.directions, /away from the forehead|back onto the forehead/);
    if (title === "Hook 104") assert.ok(preview.animationPrompt!.length <= 2_500);
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

test("five reviewed mouth performances survive both sound modes and explicit user edits", () => {
  const ids = ["11f2baa840d10b65bc4c4dee", "43f2c2d266d23e3af05875d8", "09c4e9b5de6a85f0f4c371da", "4ddf4d0f6dc4493f7eb6572f", "f216fd8e9397a7747a445ab7"];
  for (const suffix of ids) {
    const referenceId = "explore-paired-hook-" + suffix;
    const source = hookKeyframeMotionCatalog[referenceId];
    const base = createHookKeyframeDraft({ownerId:"owner", draftId:"11111111-1111-4111-8111-111111111111", referenceId, sourceSha256:source.sourceSha256});
    const previews = [false,true].map(generateAudio => getHookKeyframePromptPreview({...base,generateAudio}, "hook", undefined, undefined, undefined, source.sourceDurationSeconds));
    assert.equal(previews[0].directions,previews[1].directions);
    for (const preview of previews) {
      assert.equal(preview.animationError,null);
      assert.match(preview.directions,/lips|lip purse/);
      assert.doesNotMatch(preview.animationPrompt!,/PHASE \[/);
    }
    assert.match(previews[0].animationPrompt!,/retain timed lips, jaw and word articulation/);
    assert.match(previews[1].animationPrompt!,/Sync supplied words once, else a brief nonverbal reaction/);
    for (const motionInstructions of ["My deliberate movement.", ""]) {
      assert.equal(getHookKeyframePromptPreview({...base,motionInstructions}).directions,motionInstructions);
    }
  }
});

test("WHAT hooks stretch one what and do not ask the mouth to form it again", () => {
  const ids = ["43f2c2d266d23e3af05875d8", "09c4e9b5de6a85f0f4c371da", "4ddf4d0f6dc4493f7eb6572f", "f216fd8e9397a7747a445ab7", "cdddd09fdd3b5a23d9949205"];
  for (const suffix of ids) {
    const referenceId = "explore-paired-hook-" + suffix;
    const source = hookKeyframeMotionCatalog[referenceId];
    const base = createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId, sourceSha256: source.sourceSha256 });
    const preview = getHookKeyframePromptPreview(base, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
    assert.equal(preview.animationError, null);
    assert.deepEqual(preview.directions.match(/\bwhat\b/gi), ["what"]);
    assert.match(preview.directions, /Stretch one what/);
    assert.match(preview.directions, /form it only this once/);
    assert.match(preview.directions, /keep the AH open and held/);
    assert.doesNotMatch(preview.directions, /form that one word|mouth the word what|no voice is produced|Open the mouth again|mouth opens in surprise/);
  }
  const hook26Plan = hookKeyframeMotionCatalog["explore-paired-hook-09c4e9b5de6a85f0f4c371da"];
  const unframed26 = getHookKeyframePromptPreview(createHookKeyframeDraft({
    ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111",
    referenceId: "explore-paired-hook-09c4e9b5de6a85f0f4c371da", sourceSha256: hook26Plan.sourceSha256,
  }), "hook", undefined, undefined, undefined, hook26Plan.sourceDurationSeconds);
  assert.match(unframed26.directions, /The sunglasses stay on/);
  assert.match(unframed26.directions, /The lips round into a small opening/);
  assert.match(unframed26.directions, /face shape, not another word/);
  const hook26 = hookKeyframeMotionCatalog["explore-paired-hook-09c4e9b5de6a85f0f4c371da"];
  const framed = getHookKeyframePromptPreview(updateHookKeyframeDraft(createHookKeyframeDraft({
    ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111",
    referenceId: "explore-paired-hook-09c4e9b5de6a85f0f4c371da", sourceSha256: hook26.sourceSha256,
  }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } }), "hook", undefined, undefined, undefined, hook26.sourceDurationSeconds);
  assert.equal(framed.animationError, null);
  assert.match(framed.directions, /The sunglasses stay on/);
  assert.deepEqual(framed.directions.match(/\bwhat\b/gi), ["what"]);
  assert.match(framed.directions, /form it only this once/);
  assert.match(framed.directions, /face shape, not another word/);
  assert.doesNotMatch(framed.directions, /mouth the word what|form that one word|mouth opens in surprise|Open the mouth again/);
  for (const suffix of ids) {
    const referenceId = "explore-paired-hook-" + suffix;
    const source = hookKeyframeMotionCatalog[referenceId];
    const recreate = getReferenceVideoPrompt(referenceId, `https://example.test/${source.sourceSha256}.mp4`);
    assert.ok(recreate);
    assert.equal(recreate.match(/\bwhat\b/gi)?.length, 1);
    assert.match(recreate, /form it only this once/);
    assert.doesNotMatch(recreate, /Open the mouth again|mouth opens in surprise|form that one word/);
  }
  const stale = "PHASE [0–0.34]: Silently mouth the word what: the lips and jaw visibly form that one word, and no voice is produced.";
  const refreshed = adoptCurrentWhatMotion(stale, "explore-paired-hook-f216fd8e9397a7747a445ab7", hookKeyframeMotionCatalog["explore-paired-hook-f216fd8e9397a7747a445ab7"].sourceSha256);
  assert.match(refreshed, /form it only this once/);
  assert.equal(refreshed.match(/\bwhat\b/gi)?.length, 1);
  assert.equal(adoptCurrentWhatMotion("My own movement.", "explore-paired-hook-f216fd8e9397a7747a445ab7", hookKeyframeMotionCatalog["explore-paired-hook-f216fd8e9397a7747a445ab7"].sourceSha256), "My own movement.");
});

test("Talking Head Recreate sends the selected clip's scene prompt", () => {
  const generic = startingFrameWorkflowDirections("talking_head");
  for (const referenceId of ["talking-kamile-car-what", "talking-carla-eatsss-hook-v2", "talking-taliameals-hook-v2"]) {
    const sourceSha256 = talkingSources.items.find(item => item.id === referenceId)!.sourceSha256;
    const draft = createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId, sourceSha256 });
    const preview = getHookKeyframePromptPreview(draft, "talking_head");
    assert.equal(preview.animationError, null);
    assert.match(preview.directions, /Hold the approved opening/);
    assert.doesNotMatch(preview.directions, /subtle gestures and a stable composition/);
    assert.match(preview.animationPrompt!, /Hold the approved opening/);
    assert.match(preview.animationPrompt!, /Follow only the user's own script|user's own spoken message|speak the user's own script/);
    const withPhoto = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { imageAssetIds: ["11111111-1111-4111-8111-111111111111"] }), "talking_head");
    assert.match(withPhoto.animationPrompt!, /Use Image 1 for the scene/);
    assert.match(withPhoto.animationPrompt!, /Hold the approved opening/);
    assert.equal(getHookKeyframePromptPreview({ ...draft, motionInstructions: "My own movement." }, "talking_head").directions, "My own movement.");
    const refreshed = adoptCurrentTalkingHeadMotion(generic, referenceId, sourceSha256);
    assert.match(refreshed, /Hold the approved opening/);
    assert.equal(adoptCurrentTalkingHeadMotion("My own movement.", referenceId, sourceSha256), "My own movement.");
  }
  const car = talkingSources.items.find(item => item.id === "talking-kamile-car-what")!;
  const mismatch = getHookKeyframePromptPreview(createHookKeyframeDraft({
    ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: car.id, sourceSha256: "0".repeat(64),
  }), "talking_head");
  assert.match(mismatch.directions, /subtle gestures and a stable composition/);
  assert.equal(adoptCurrentTalkingHeadMotion(generic, car.id, "0".repeat(64)), generic);
});
