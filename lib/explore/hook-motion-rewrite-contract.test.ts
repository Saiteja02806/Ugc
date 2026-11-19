import assert from "node:assert/strict";
import test from "node:test";
import { parseHookMotionRewrite } from "./hook-motion-rewrite-contract.ts";
import { buildHookAnimationPrompt, getHookKeyframeMotionPrompt, getHookKeyframeMotionReviewDraft,
  hookKeyframeMotionCatalog, hookKeyframeMotionRewrites, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import { getReferenceVideoPrompt } from "./reference-video-prompts.ts";

// Static pose is supplied by the bound source/starting image after the reviewed
// compact-prompt change. Keep checking its reviewed record separately.
function reviewedScene(id: string) {
  const source = hookKeyframeMotionCatalog[id];
  const plan = getHookKeyframeMotionReviewDraft(id, source.sourceSha256)?.candidatePlan;
  assert.ok(plan, id);
  return JSON.stringify(plan);
}

test("all 106 rewrites bind to the exact canonical video and reviewed first-to-last frame evidence", () => {
  const sources = Object.values(hookKeyframeMotionCatalog);
  assert.equal(Object.keys(hookKeyframeMotionRewrites).length, 106);
  let reviewed = 0, decisions = 0;
  for (const source of sources) {
    const rewrite = hookKeyframeMotionRewrites[source.referenceId];
    assert.ok(rewrite, source.displayTitle); assert.ok(parseHookMotionRewrite(rewrite, source));
    assert.equal(rewrite.sourceSha256, source.sourceSha256);
    assert.equal(rewrite.review.sampledFrameIndices[0], 0);
    assert.equal(rewrite.review.sampledFrameIndices.at(-1), source.sourceReviewedFrameCount - 1);
    assert.equal(rewrite.review.frameCount, source.sourceReviewedFrameCount);
    assert.equal(rewrite.review.sourceFileSha256, source.sourceSha256);
    assert.equal(rewrite.review.visualQualification, "not_tested");
    const draft = getHookKeyframeMotionReviewDraft(source.referenceId, source.sourceSha256)!;
    assert.equal(draft.candidatePlan, rewrite.plan); assert.equal(draft.canSubmitPaidAnimation, false);
    assert.equal(getHookKeyframeMotionPrompt({ referenceId: source.referenceId, sourceSha256: source.sourceSha256,
      startingFrameIndex: 0, durationSeconds: 4, generateAudio: false }).status, "blocked");
    const durationSeconds = rewrite.previewDurationSeconds ?? 4;
    const prompt = buildHookAnimationPrompt({ directions: hookMotionPlanDirections(rewrite.plan), durationSeconds, generateAudio: false });
    assert.doesNotMatch(prompt, /@Video|@Image|original performance|source timing|supporting photos/);
    assert.match(prompt, /SOUND SETTING: OFF/);
    if (rewrite.review.status === "static_reviewed") { reviewed++; assert.deepEqual(rewrite.review.supportedDurationsSeconds, [durationSeconds]); }
    else { decisions++; assert.equal(draft.requiresDecision, true); assert.ok(rewrite.review.issues.length); assert.deepEqual(rewrite.review.supportedDurationsSeconds, []); }
  }
  assert.equal(reviewed, 104); assert.equal(decisions, 2);
});

test("unresolved historical sequences retain their source-bound decisions", () => {
  const actual = Object.values(hookKeyframeMotionRewrites).filter(item => item.review.status === "needs_decision")
    .map(item => hookKeyframeMotionCatalog[item.referenceId].displayTitle).sort();
  assert.deepEqual(actual, ["Hook 19", "Hook 84"]);
  const window = hookKeyframeMotionRewrites["explore-paired-hook-e683292d4cd22b2a8b5a9cd8"];
  assert.match(window.review.issues.join(" "), /no performer|no face/);
  const repeat = hookKeyframeMotionRewrites["explore-paired-hook-b7c86d6729a69666ddf46ed5"];
  assert.equal(repeat.review.status, "static_reviewed");
  assert.match(repeat.review.reviewNote, /User decision.*purple handled bottle/);
});

test("Hook 15 preserves the two-take sequence in its accepted eight-second prompt without qualifying paid generation", () => {
  const id = "explore-paired-hook-43cc1dae0a6cfcb03e0a9333", source = hookKeyframeMotionCatalog[id];
  const rewrite = hookKeyframeMotionRewrites[id];
  assert.equal(rewrite.previewDurationSeconds, 8);
  assert.deepEqual(rewrite.review.supportedDurationsSeconds, [8]);
  assert.equal(rewrite.review.visualQualification, "not_tested");
  assert.match(hookMotionPlanDirections(rewrite.plan), /one clean cut/);
  assert.match(hookMotionPlanDirections(rewrite.plan), /two-thirds/);
  assert.equal(parseHookMotionRewrite({ ...rewrite, previewDurationSeconds: 4 }, source), null);
  assert.equal(parseHookMotionRewrite({ ...rewrite, previewDurationSeconds: 16 }, source), null);
  assert.equal(getHookKeyframeMotionPrompt({ referenceId: id, sourceSha256: source.sourceSha256,
    startingFrameIndex: 0, durationSeconds: 8, generateAudio: false }).status, "blocked");
});

test("changed hashes, falsified frame samples and premature visual qualification cannot become trusted rewrite records", () => {
  const source = Object.values(hookKeyframeMotionCatalog)[0], good = hookKeyframeMotionRewrites[source.referenceId];
  for (const value of [
    { ...good, sourceSha256: "a".repeat(64) },
    { ...good, review: { ...good.review, sourceFileSha256: "b".repeat(64) } },
    { ...good, review: { ...good.review, sampledFrameIndices: [1, 20, source.sourceReviewedFrameCount - 1] } },
    { ...good, review: { ...good.review, sampledFrameIndices: [0, 30, 20, source.sourceReviewedFrameCount - 1] } },
    { ...good, review: { ...good.review, frameCount: source.sourceReviewedFrameCount + 1 } },
    { ...good, review: { ...good.review, visualQualification: "passed" } },
    { ...good, review: { ...good.review, status: "needs_decision", issues: [] } },
    { ...good, plan: { ...good.plan, beats: [null] } },
  ]) assert.equal(parseHookMotionRewrite(value, source), null);
  assert.equal(getHookKeyframeMotionReviewDraft(source.referenceId, "f".repeat(64)), undefined);
});

test("the two Hook46 entries retain different source bindings and independently written action sequences", () => {
  const sources = Object.values(hookKeyframeMotionCatalog).filter(source => source.displayTitle === "Hook 46");
  assert.equal(sources.length, 2);
  const plans = sources.map(source => hookKeyframeMotionRewrites[source.referenceId]);
  assert.notEqual(plans[0].sourceSha256, plans[1].sourceSha256);
  assert.notDeepEqual(plans[0].plan, plans[1].plan);
});

test("opening actions continue the already-started stretch and hand raise instead of resetting to an incompatible pose", () => {
  const stretch = hookKeyframeMotionRewrites["explore-paired-hook-d1d14b08f6dd4711ad166ded"].plan;
  assert.match(stretch.openingState, /fingers stay interlaced/);
  // Catalog Hook08: the expanded plan separates first-side stretch, hand switch,
  // opposite-side stretch and return to work. Do not expect the switch in beat2.
  assert.deepEqual(stretch.beats.map(beat => beat.phase), ["opening", "middle", "middle", "middle", "middle", "middle", "ending"]);
  const [forward, firstSide, firstHold, switchHands, oppositeHold, release, returnToWork] = stretch.beats;
  assert.match(forward.action, /fingers stay interlaced/);
  assert.match(forward.action, /arms stay forward/);
  assert.match(forward.action, /camera sees the palms/);
  assert.match(firstSide.action, /screen-left hand settles on top of the headphones/);
  assert.match(firstHold.action, /head stays tipped toward screen-left/);
  assert.match(switchHands.action, /screen-right hand settles on top of the headphones/);
  assert.match(oppositeHold.action, /head tips toward screen-right/);
  assert.match(release.action, /head comes back upright/);
  assert.match(returnToWork.action, /Both hands come down to the keyboard/);
  const cover = hookKeyframeMotionRewrites["explore-paired-hook-4463cc3d85f44ad6829ceb12"].plan;
  assert.match(cover.openingState, /already beginning to rise/);
  assert.match(cover.endingState, /hand covering the lips/);
});

test("Hooks 02, 03, and 04 keep the 2026-11-10 frame corrections", () => {
  const directions = (id: string) => hookMotionPlanDirections(hookKeyframeMotionRewrites[id].plan);
  const hook02 = directions("explore-paired-hook-7c53cba88343579e7e15c8b0");
  assert.match(hook02, /recording phone stays at one distance/);
  assert.match(hook02, /laptop lid leaves toward screen-right and stays out/);
  assert.match(hook02, /Draw the glasses forward off the face/);
  assert.doesNotMatch(hook02, /laptop low in the foreground/);
  const hook03 = directions("explore-paired-hook-ef59f4b5e69bc9e125f8ada7");
  assert.match(hook03, /leave the lens and settle toward screen-right/);
  assert.match(hook03, /move across toward screen-left/);
  assert.match(hook03, /finish toward screen-left with wide lids/);
  assert.match(hook03, /white shows under the iris/);
  assert.match(hook03, /She stays reclining/);
  assert.match(hook03, /eyes stay up toward screen-left/);
  assert.doesNotMatch(hook03, /eyes shift to screen-right|already up in the screen-right corner/);
  const hook04 = directions("explore-paired-hook-b43622d1486957644f3317e6");
  assert.match(hook04, /Keep palm against mouth, back of hand visible/);
  assert.match(hook04, /hand on the laptop side of her face/);
  assert.match(hook04, /screen-right hand reaches beyond the lens and picks up the recording phone/);
  assert.match(hook04, /She stays seated/);
  assert.doesNotMatch(hook04, /place its palm across the mouth/);
});

test("Hooks 05, 06, and 07 keep the 2026-11-10 frame corrections", () => {
  const directions = (id: string) => hookMotionPlanDirections(hookKeyframeMotionRewrites[id].plan);
  const hook05 = directions("explore-paired-hook-510f7a66546d25863c268477");
  assert.match(hook05, /brings the phone closer, enlarging the face/);
  assert.match(hook05, /more ceiling shows/);
  assert.match(hook05, /eyes leave the lens toward screen-right/);
  assert.doesNotMatch(hook05, /eyes leave the lens toward screen-left/);
  assert.match(hook05, /screen-right index finger/);
  assert.doesNotMatch(hook05, /camera sees the back of that hand/);
  const hook06 = directions("explore-paired-hook-55cb1594a04550147e829d7f");
  assert.match(hook06, /He stays seated and tips his head back/);
  assert.match(hook06, /eyes stay wide and look upward/);
  assert.match(hook06, /face gets smaller and the shoulders show/);
  assert.match(hook06, /screen-right hand/);
  const hook07 = directions("explore-paired-hook-2a74d53ba481fd0f99b84179");
  assert.match(hook07, /camera sees the back of that hand/);
  assert.match(hook07, /screen-left hand/);
  assert.match(hook07, /glasses stay on top of the head/);
  assert.match(hook07, /arm extended into the foreground brings the recording phone closer/);
  assert.match(hook07, /She stays seated/);
});

test("Hooks 08, 09, and 10 keep the 2026-11-10 frame corrections", () => {
  const directions = (id: string) => hookMotionPlanDirections(hookKeyframeMotionRewrites[id].plan);
  const hook08 = directions("explore-paired-hook-d1d14b08f6dd4711ad166ded");
  assert.match(hook08, /recording phone stays at one distance/);
  assert.match(hook08, /camera sees the palms/);
  assert.match(hook08, /arms stay forward/);
  assert.match(hook08, /head tips toward screen-left[\s\S]*head tips toward screen-right/);
  assert.match(hook08, /then reopen beneath lowered upper lids toward the laptop/);
  assert.match(hook08, /head tips toward screen-left/);
  assert.match(hook08, /She stays seated/);
  assert.match(hook08, /headphones stay on/);
  const hook09 = directions("explore-paired-hook-aa0caa002b6a92ad9226b26c");
  assert.match(hook09, /eyes stay up toward screen-left/);
  assert.match(hook09, /fingertips land vertically across the lips/);
  assert.match(hook09, /camera sees the backs of the fingers and hand/);
  assert.doesNotMatch(hook09, /camera sees the palm/);
  assert.match(hook09, /glasses stay on the head/);
  assert.doesNotMatch(hook09, /camera sees the back of that hand/);
  const hook10 = directions("explore-paired-hook-9ee299bb7c8ab66ad9387bbf");
  assert.match(hook10, /fingertips settle beside the lower lip/);
  assert.match(hook10, /camera sees the backs of the fingers and hand/);
  assert.doesNotMatch(hook10, /camera sees the palm/);
  assert.match(hook10, /lies flat on the upper chest/);
  assert.match(hook10, /camera sees the back of that hand/);
  assert.match(hook10, /eyes drop onto the lens/);
  assert.match(hook10, /She stays seated/);
});

test("Hooks 08 through 10 stay in the live recreation prompt, and Hooks 11, 12, and 14 keep the 2026-11-10 frame corrections", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook08 = live("explore-paired-hook-d1d14b08f6dd4711ad166ded");
  assert.match(hook08, /camera sees the palms/);
  assert.match(hook08, /arms stay forward/);
  assert.doesNotMatch(hook08, /wearing large white headphones|arms reach forward/);
  assert.match(hook08, /head tips toward screen-left[\s\S]*head tips toward screen-right/);
  assert.match(hook08, /then reopen beneath lowered upper lids toward the laptop/);
  assert.match(hook08, /head tips toward screen-left/);
  const hook09 = live("explore-paired-hook-aa0caa002b6a92ad9226b26c");
  assert.match(hook09, /eyes stay up toward screen-left/);
  assert.match(hook09, /fingertips land vertically across the lips/);
  assert.match(hook09, /camera sees the backs of the fingers and hand/);
  assert.doesNotMatch(hook09, /camera sees the palm/);
  const hook10 = live("explore-paired-hook-9ee299bb7c8ab66ad9387bbf");
  assert.match(hook10, /fingertips settle beside the lower lip/);
  assert.match(hook10, /lies flat on the upper chest/);
  assert.match(hook10, /eyes drop onto the lens/);
  const hook11 = live("explore-paired-hook-3a6a3f1380bf0260ec43bd78");
  assert.match(hook11, /eyes stay down toward the laptop on screen-right/);
  assert.match(hook11, /eyes rise from the laptop and settle wide on the lens/);
  assert.match(hook11, /Both hands stay on the earcups/);
  assert.match(hook11, /recording phone stays at one distance/);
  const hook12 = live("explore-paired-hook-03d314d5268b8c31ec390bf1");
  assert.match(hook12, /eyes open wide and look up while the mug is still at the lips/);
  assert.match(hook12, /thin trickle keeps falling from the lower lip into the mug/);
  assert.match(hook12, /eyes stay wide on the lens/);
  assert.doesNotMatch(hook12, /angled down|Lean slightly closer/);
  const hook14 = live("explore-paired-hook-4f4ca22ed141ee115d1eb913");
  assert.match(hook14, /camera sees the back of the hand and fingers/);
  assert.doesNotMatch(hook14, /camera sees the palm/);
  assert.match(hook14, /fingers stay together over the lips/);
  assert.match(hook14, /mouth opens into a toothy smile/);
  assert.doesNotMatch(hook14, /camera sees the back of that hand/);
});

test("Hooks 15, 16, and 17 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook15 = live("explore-paired-hook-43cc1dae0a6cfcb03e0a9333");
  assert.match(hook15, /eyes open and look up toward screen-right/);
  assert.match(hook15, /camera sees the palms/);
  assert.match(hook15, /deliberate hard cut/);
  assert.match(hook15, /brings the recording phone closer, so the face grows/);
  assert.doesNotMatch(hook15, /camera sees the back of that hand/);
  const hook16 = live("explore-paired-hook-be7df3868a7b06024c0a90d1");
  assert.match(hook16, /face grows/);
  assert.match(hook16, /settle toward screen-right/);
  assert.match(hook16, /fingertips land diagonally across the lips/);
  assert.match(hook16, /camera sees the back of the hand and fingers/);
  assert.doesNotMatch(hook16, /camera sees the palm/);
  const hook17 = live("explore-paired-hook-b0aead788c4930565401371b");
  assert.match(hook17, /eyes look up toward screen-left/);
  assert.doesNotMatch(hook17, /eyes look up toward screen-right/);
  assert.match(hook17, /camera sees the back of the hand and fingers/);
  assert.doesNotMatch(hook17, /camera sees the palm/);
  assert.match(hook17, /mouth opens into a toothy smile/);
  assert.match(hook17, /cap stays on/);
  assert.doesNotMatch(hook17, /Glance screen-left/);
});

test("Hooks 18, 19, and 20 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook18 = live("explore-paired-hook-9ba74d76f7f3a3e0b55f3ebc");
  assert.match(hook18, /camera sees the back of the hand and fingers/);
  assert.doesNotMatch(hook18, /camera sees the palm/);
  assert.match(hook18, /screen-right eye narrows/);
  assert.match(hook18, /gaze stays toward screen-left/);
  assert.match(hook18, /recording phone a small shake, briefly blurring the picture/);
  assert.match(hook18, /Both eyes finish open toward screen-left/);
  assert.doesNotMatch(hook18, /skeptical|concerned|natural shake/);
  const hook19 = live("explore-paired-hook-e683292d4cd22b2a8b5a9cd8");
  assert.match(hook19, /recording phone turns away from the window/);
  assert.match(hook19, /arm stays extended toward the camera/);
  assert.match(hook19, /mouth stays a closed smile/);
  assert.match(hook19, /headphones stay around her neck/);
  assert.match(hook19, /head tips toward screen-right, then comes back nearer upright/);
  assert.match(hook19, /eyes briefly close, then reopen toward the lens/);
  assert.match(hook19, /lips part to show the teeth in the final moments/);
  assert.doesNotMatch(hook19, /natural wobble/);
  const hook20 = live("explore-paired-hook-f1afdb3229e127c8b6563087");
  assert.match(reviewedScene("explore-paired-hook-f1afdb3229e127c8b6563087"), /hands are already up beside the face/);
  assert.match(hook20, /camera sees the backs of the hands and fingers/);
  assert.doesNotMatch(hook20, /camera sees the palms/);
  assert.doesNotMatch(hook20, /rising toward the mouth/);
  assert.match(hook20, /eyes stay wide toward screen-left/);
  assert.match(hook20, /hands stay behind the head/);
  assert.match(hook20, /recording phone stays at one distance/);
  assert.doesNotMatch(hook20, /disbelief|back of that hand/);
});

test("Hooks 21, 22, and 23 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook21 = live("explore-paired-hook-17d1208ac2c327913bb321ab");
  assert.match(hook21, /camera sees the back of the hand and fingers/);
  assert.doesNotMatch(hook21, /camera sees the palm/);
  assert.match(hook21, /eyes stay wide toward screen-right/);
  assert.match(hook21, /brings the recording phone closer, so the face grows/);
  assert.doesNotMatch(hook21, /natural drift|surprised/);
  const hook22 = live("explore-paired-hook-11f2baa840d10b65bc4c4dee");
  assert.match(hook22, /screen-left hand draws the glasses/);
  assert.match(hook22, /brings the recording phone closer, so the face grows and the laptop leaves/);
  assert.match(hook22, /camera sees the back of that hand/);
  assert.match(hook22, /glasses stay in that hand/);
  assert.doesNotMatch(hook22, /filming device/);
  const hook23 = live("explore-paired-hook-59dee735a7c5d1643bc57127");
  assert.match(reviewedScene("explore-paired-hook-59dee735a7c5d1643bc57127"), /already in front of the chest/);
  assert.match(hook23, /palms turn toward the lens/);
  assert.doesNotMatch(hook23, /hands are low/);
  assert.match(hook23, /eyes stay closed/);
  assert.match(hook23, /screen-right hand rests on the upper edge/);
  assert.match(hook23, /recording phone stays at one distance/);
  assert.doesNotMatch(hook23, /surprised/);
});

test("Hooks 24, 25, and 26 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook24 = live("explore-paired-hook-43f2c2d266d23e3af05875d8");
  assert.match(hook24, /screen-left fingertips stay on the outer corner/);
  assert.match(hook24, /eyes stay wide toward screen-left/);
  assert.match(hook24, /lips round into a small opening/);
  assert.match(hook24, /pulls the glasses forward off the eyes and toward screen-left/);
  assert.match(hook24, /recording phone stays at one distance/);
  assert.equal(hook24.split("what").length - 1, 1);
  const hook25 = live("explore-paired-hook-62f80506cbbedab0d340f863");
  assert.match(hook25, /back of the screen-left hand and the palm side of the screen-right hand/);
  assert.doesNotMatch(hook25, /camera sees the palms/);
  assert.match(hook25, /eyes leave the laptop and settle wide on the lens/);
  assert.match(hook25, /lips pull back, so the teeth show/);
  assert.match(hook25, /recording phone stays at one distance/);
  assert.doesNotMatch(hook25, /disbelief|incredulous/);
  const hook26 = live("explore-paired-hook-09c4e9b5de6a85f0f4c371da");
  assert.match(hook26, /screen-left fingertips stay on the outer corner/);
  assert.match(hook26, /pulls the sunglasses forward off the eyes and toward screen-left/);
  assert.match(hook26, /eyes open wide toward screen-left, then settle wide on the lens/);
  assert.match(hook26, /teeth and tongue visible inside/);
  assert.doesNotMatch(hook26, /eyes open wide toward screen-right/);
  assert.match(hook26, /recording phone stays at one distance/);
  assert.equal(hook26.split("what").length - 1, 1);
  assert.doesNotMatch(hook26, /Lean toward camera|incredulous/);
});

test("Hooks 27, 29, and 30 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook27 = live("explore-paired-hook-4ddf4d0f6dc4493f7eb6572f");
  assert.match(hook27, /temple stays between the lips/);
  assert.match(hook27, /lips purse around the temple/);
  assert.match(hook27, /temple leaves the lips and hangs beside the chin toward screen-right/);
  assert.match(hook27, /mouth opens wide/);
  assert.match(hook27, /eyes stay wide toward screen-left/);
  assert.match(hook27, /recording phone stays at one distance/);
  // User reconfirmed one silent WHAT on 17 November, preserving the reviewed release.
  assert.equal(hook27.split("what").length - 1, 1);
  assert.match(hook27, /land the T only at the end/);
  const hook29 = live("explore-paired-hook-761c394a83c7b4c06e35e262");
  assert.match(hook29, /eyes leave the laptop and settle on the lens/);
  assert.match(hook29, /screen-right hand leaves the keyboard/);
  assert.match(hook29, /index finger rises in front of the chest/);
  assert.match(hook29, /camera sees the palm/);
  assert.match(hook29, /index finger curls/);
  assert.match(hook29, /eyes close once/);
  assert.match(hook29, /recording phone stays at one distance/);
  assert.doesNotMatch(hook29, /skeptical|cautioning/);
  const hook30 = live("explore-paired-hook-9309a041061ae5abc6970d52");
  assert.match(hook30, /camera sees the back of that hand/);
  assert.match(hook30, /same hand slides down to the chin/);
  assert.match(hook30, /brings the recording phone closer, so the face grows/);
  assert.match(hook30, /eyes stay wide, settled slightly toward screen-left/);
  assert.doesNotMatch(hook30, /disbelief/);
});

test("Hooks 31, 32, and 33 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook31 = live("explore-paired-hook-14b3c195d4648bd1793f8d50");
  assert.match(hook31, /screen-right hand cups the lower mouth and cheek/);
  assert.match(hook31, /camera sees the back of the hand and fingers/);
  assert.match(hook31, /eyes settle toward screen-left/);
  assert.match(hook31, /eyes settle on the lens/);
  assert.match(hook31, /eyes return to the lens/);
  assert.match(reviewedScene("explore-paired-hook-14b3c195d4648bd1793f8d50"), /glasses stay on the head/);
  assert.match(hook31, /recording phone stays at one distance/);
  assert.doesNotMatch(hook31, /delighted|amused|frightened/);
  const hook32 = live("explore-paired-hook-df58806df2ea040df347f267");
  assert.match(hook32, /screen-right hand reaches the outer corner/);
  assert.match(hook32, /lifts the glasses onto the head/);
  assert.match(hook32, /eyes settle toward screen-right/);
  assert.match(hook32, /camera sees the backs of the hands and pink fingernails/);
  assert.match(hook32, /fingertips cover the nose and the mouth/);
  assert.match(hook32, /screen-left hand stays across the mouth/);
  assert.match(hook32, /after the blink/);
  assert.doesNotMatch(hook32, /emotional|natural handheld/);
  const hook33 = live("explore-paired-hook-f24aeb3d18886faf62ca3b8c");
  assert.match(reviewedScene("explore-paired-hook-f24aeb3d18886faf62ca3b8c"), /screen-right hand rests across the top of the glasses/);
  assert.match(hook33, /lifts the glasses onto the head/);
  assert.match(hook33, /eyes stay wide and up toward screen-left/);
  assert.match(hook33, /teeth show/);
  assert.match(hook33, /hand lowers out of the picture/);
  assert.match(hook33, /recording phone stays at one distance/);
  assert.doesNotMatch(hook33, /astonished|delighted/);
});

test("Hooks 34, 35, and 36 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook34 = live("explore-paired-hook-d4e7dafbab7e65e9a2505ce0");
  assert.match(hook34, /She stays seated/);
  assert.match(reviewedScene("explore-paired-hook-d4e7dafbab7e65e9a2505ce0"), /laptop stays on screen-right/);
  assert.match(hook34, /Both hands rise to the earcups/);
  assert.match(hook34, /headband passes in front of the face/);
  assert.match(hook34, /screen-left hand leaves them/);
  assert.match(hook34, /opens and spreads the fingers/);
  assert.match(hook34, /recording phone stays at one distance/);
  assert.doesNotMatch(hook34, /skeptical|dismissive|puzzled/);
  const hook35 = live("explore-paired-hook-bdc5af5aedfac3ddb93b4348");
  assert.match(hook35, /camera sees the back of that hand/);
  assert.match(hook35, /slides from the mouth onto the screen-right cheek/);
  assert.match(hook35, /fingertips rest under the screen-left eye/);
  assert.match(hook35, /eyes look up toward screen-right/);
  assert.match(hook35, /recording phone stays at one distance/);
  assert.doesNotMatch(hook35, /distressed|sad pout|tearful/);
  const hook36 = live("explore-paired-hook-f1b5421be14d24803539be89");
  assert.match(hook36, /screen-left hand rises beside the cheek/);
  assert.match(hook36, /palm turns upward/);
  assert.match(hook36, /camera sees the palm/);
  assert.match(hook36, /eyes stay slightly toward screen-left/);
  assert.match(hook36, /recording phone stays at one distance/);
  assert.doesNotMatch(hook36, /skeptical|questioning/);
});

test("Hooks 37, 38, and 39 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook37 = live("explore-paired-hook-1280571372ff2cd67af995f3");
  assert.match(hook37, /recording phone stays straight/);
  assert.match(reviewedScene("explore-paired-hook-1280571372ff2cd67af995f3"), /head is already slightly tilted toward screen-left/);
  assert.match(reviewedScene("explore-paired-hook-1280571372ff2cd67af995f3"), /eyes are toward screen-left, off the lens/);
  assert.match(hook37, /head stays slightly tilted toward screen-left/);
  assert.match(hook37, /lips part/);
  assert.match(hook37, /head comes level/);
  assert.match(hook37, /eyes settle on the lens/);
  assert.match(hook37, /head tilts toward screen-left again/);
  assert.match(hook37, /eyes leave the lens and settle toward screen-left/);
  assert.match(hook37, /hands stay outside the picture/);
  assert.doesNotMatch(hook37, /surprise|stays upright/);
  const hook38 = live("explore-paired-hook-21d7d65d41c97e6ebbb5a13e");
  assert.match(hook38, /head stays tilted toward screen-right/);
  assert.match(hook38, /eyes stay down toward the tablet on screen-right/);
  assert.match(hook38, /mouth closes into a small smile/);
  assert.match(hook38, /head rocks back toward upright/);
  assert.match(hook38, /settle back down on the tablet/);
  assert.match(hook38, /recording phone stays at one distance/);
  assert.doesNotMatch(hook38, /settle on the lens|knowing/);
  const hook39 = live("explore-paired-hook-99ff813ebc24c61f1c92828e");
  assert.match(hook39, /screen-left fingertips hold the upper corner/);
  assert.match(hook39, /Her head lowers/);
  assert.match(hook39, /mouth opens much wider/);
  assert.match(hook39, /head rocks toward screen-right, then toward screen-left/);
  assert.match(hook39, /up toward screen-right, then up toward screen-left/);
  assert.match(hook39, /fingertips return and rest on the forehead/);
  assert.match(hook39, /lips purse briefly, then release into a small rounded open mouth/);
  assert.match(hook39, /unseen hand brings the recording phone closer/);
  assert.doesNotMatch(hook39, /surprise|begin parting the lips again/);
});

test("Hooks 40, 41, and 42 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook40 = live("explore-paired-hook-ccc00a7b185156ed25e1af37");
  assert.match(hook40, /She stays seated/);
  assert.match(reviewedScene("explore-paired-hook-ccc00a7b185156ed25e1af37"), /tablet stays on screen-right/);
  assert.match(hook40, /leans forward toward the lens/);
  assert.match(hook40, /keeps the pink stylus upright/);
  assert.match(hook40, /camera sees the palm/);
  assert.match(hook40, /screen-left hand stays low/);
  assert.match(hook40, /eyes return to the lens and hold with open lids/);
  assert.doesNotMatch(hook40, /skeptical|puzzled|questioning/);
  const hook41 = live("explore-paired-hook-5947060ace44a6f7366de20c");
  assert.match(hook41, /utensil lowers out of the picture/);
  assert.match(hook41, /eyes look up toward screen-left/);
  assert.match(hook41, /screen-right hand rises/);
  assert.match(hook41, /back of the hand and fingernails visible/);
  assert.match(hook41, /hand releases the lips and lowers beside the cheek/);
  assert.match(hook41, /headphones stay on/);
  assert.doesNotMatch(hook41, /disbelief|Lower the hand/);
  const hook42 = live("explore-paired-hook-2575e61e1f8151761d13e032");
  assert.match(hook42, /lifts the glasses onto the head/);
  assert.match(hook42, /camera sees the back of the hand/);
  assert.match(hook42, /eyes leave the lens and settle toward screen-left/);
  assert.match(hook42, /glasses stay on the head/);
  assert.match(hook42, /recording phone stays at one distance/);
  assert.doesNotMatch(hook42, /screen-left again|natural shifts/);
});

test("Hooks 43, 44, and 45 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const hook43 = live("explore-paired-hook-7715be59e01c9ee80a3bb018");
  assert.match(reviewedScene("explore-paired-hook-7715be59e01c9ee80a3bb018"), /She stays seated/);
  assert.match(reviewedScene("explore-paired-hook-7715be59e01c9ee80a3bb018"), /tablet stays on screen-right/);
  assert.match(hook43, /mouth opens wide/);
  assert.match(hook43, /screen-left index finger stays pointing down/);
  assert.match(hook43, /recording phone stays at one distance/);
  assert.doesNotMatch(hook43, /delighted|pleased/);
  const hook44 = live("explore-paired-hook-643978050b8b91c838ce4985");
  assert.match(hook44, /She stays seated/);
  assert.match(hook44, /camera sees the palms of the joined hands/);
  assert.match(hook44, /head tilts toward screen-right/);
  assert.match(hook44, /Both hands return to the keyboard/);
  assert.match(hook44, /recording phone stays at one distance/);
  assert.doesNotMatch(hook44, /backs of the hands|screen-left while/);
  const hook45 = live("explore-paired-hook-322af5b0d5778b474cfcfdf4");
  assert.match(hook45, /screen-right hand raises the amber glass/);
  assert.match(hook45, /one drink/);
  assert.match(hook45, /glass stays upright/);
  assert.match(hook45, /thin strand hangs from the lower lip/);
  assert.match(hook45, /eyes stay on the tablet/);
  assert.doesNotMatch(hook45, /puzzled|4\.333/);
});

test("Hooks 46 and 47 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const reclining = live("explore-paired-hook-318267dcb393c3e701c8c944");
  assert.match(reclining, /She stays reclined/);
  assert.match(reclining, /camera sees the back of that hand/);
  assert.match(reclining, /eyes close once/);
  assert.match(reclining, /recording phone stays at one distance/);
  assert.doesNotMatch(reclining, /amused|already/);
  const glasses = live("explore-paired-hook-4aa27111a23b04a6dd27717b");
  assert.match(glasses, /glasses stay on/);
  assert.match(glasses, /camera sees the knuckles/);
  assert.match(glasses, /leaves the mouth toward screen-right/);
  assert.match(glasses, /lips hold a small closed smile/);
  assert.doesNotMatch(glasses, /uneasy|pained|amused/);
  const on = live("explore-paired-hook-892b0f65083c8cf03270a7c9");
  assert.match(reviewedScene("explore-paired-hook-892b0f65083c8cf03270a7c9"), /glasses stay off the eyes/);
  assert.match(reviewedScene("explore-paired-hook-892b0f65083c8cf03270a7c9"), /in front of the forehead/);
  assert.match(on, /glasses settle on the eyes/);
  assert.match(on, /fingertips stay at the screen-right corner/);
  assert.doesNotMatch(on, /incredulous|mouth\/nose/);
});

test("Hooks 48, 49, and 50 keep the 2026-11-10 frame corrections in the live prompt", () => {
  const live = (id: string) => {
    const source = hookKeyframeMotionCatalog[id];
    const prompt = getReferenceVideoPrompt(id, `https://source.test/${source.sourceSha256}.mp4`);
    assert.ok(prompt, id);
    return prompt;
  };
  const stretch = live("explore-paired-hook-6070b6ecbe246d879ce0bdcb");
  assert.match(stretch, /She stays seated/);
  assert.match(stretch, /push the interlaced hands straight toward the lens/);
  assert.match(stretch, /until the hands are large/);
  assert.match(stretch, /joined wrists turn so the camera sees the palms/);
  assert.match(stretch, /head tilts toward screen-left/);
  assert.match(stretch, /head tilts toward screen-right/);
  assert.match(stretch, /Both hands return to the keyboard/);
  assert.match(stretch, /headphones stay on/);
  assert.doesNotMatch(stretch, /wearing over-ear|surprised/);
  const glasses = live("explore-paired-hook-ac9df55efb6be6e2fefbcf0e");
  assert.match(glasses, /glasses stay on/);
  assert.match(glasses, /0\.4–1\.23s: Both hands rise/);
  assert.match(glasses, /pull them forward off the face/);
  assert.match(glasses, /eyes stay toward screen-right/);
  assert.match(glasses, /mouth opens and the teeth show/);
  assert.match(glasses, /Stretch one what/);
  assert.doesNotMatch(glasses, /incredulous|skeptical|wearing/);
  const lip = live("explore-paired-hook-c8b971f4cea086703e106c92");
  assert.match(lip, /head stays turned toward screen-left/);
  assert.match(lip, /screen-left index fingertip stays on the lower lip/);
  assert.match(lip, /head turns slowly toward the lens/);
  assert.match(lip, /recording phone stays straight/);
  assert.match(lip, /eyes settle wide on the lens/);
  assert.doesNotMatch(lip, /surprised|incredulous/);
});
