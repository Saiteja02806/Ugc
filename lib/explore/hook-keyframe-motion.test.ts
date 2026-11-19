import { buildHookAnimationPrompt } from "./hook-keyframe-motion.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { getHookReferenceGalleryItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import notbeen2Plans from "./hook-notbeen2-motion.json" with { type: "json" };
import { referenceVideoPrompts } from "./reference-video-prompts.ts";
import {
  compileReviewedHookKeyframeMotionPrompt,
  getHookKeyframeMotionPrompt,
  getHookKeyframeMotionReviewDraft,
  getReclassifiedHookMotionReview,
  hookKeyframeMotionCatalog,
  hookMotionPlanDirections,
  type HookMotionCatalogEntry,
  type HookMotionInput,
  type HookMotionPlan,
} from "./hook-keyframe-motion.ts";

const simpleId = "explore-paired-hook-1280571372ff2cd67af995f3";
const simpleEntry = hookKeyframeMotionCatalog[simpleId];
const input: HookMotionInput = {
  referenceId: simpleId,
  sourceSha256: simpleEntry.sourceSha256,
  startingFrameIndex: 0,
  durationSeconds: 4,
  generateAudio: false,
};

// Only test fixtures are marked reviewed here; no production entry is promoted.
function fixture(plan?: HookMotionPlan): HookMotionCatalogEntry {
  return {
    ...simpleEntry,
    motionReviewStatus: "reviewed_for_starting_frame",
    motionReview: {
      status: "reviewed_for_starting_frame",
      motionVersion: 1,
      startingFrameIndex: 0,
      supportedDurationsSeconds: [4, 6],
      reviewMethod: "source_observations_and_opening_frame",
      reviewNote: "TEST FIXTURE ONLY. Static test of explicitly reviewed input, not actual opening-frame or generated-media qualification.",
      reviewedBy: "unit-test-fixture",
      reviewedAt: "2026-10-21T00:00:00.000Z",
      visualQualification: "not_tested",
      plan: plan ?? getHookKeyframeMotionReviewDraft(simpleId, simpleEntry.sourceSha256)!.candidatePlan!,
    },
  };
}

test("every active canonical reference has an exact source-bound motion review record", () => {
  const active = getHookReferenceGalleryItems();
  assert.equal(active.length, 129);
  assert.equal(active.some(row => row.id === "explore-paired-hook-ddcfb2950d40f37771058b73"), false);
  assert.equal(active.some(row => row.id === "explore-paired-hook-6070b6ecbe246d879ce0bdcb"), false);
  assert.ok(!active.some(row => row.id === "explore-paired-hook-e683292d4cd22b2a8b5a9cd8"));
  assert.equal(Object.keys(hookKeyframeMotionCatalog).length, 106);
  for (const hook of active) {
    const entry = hookKeyframeMotionCatalog[hook.id];
    const legacy = referenceVideoPrompts[hook.id];
    if (!entry) {
      const reviewed = getReclassifiedHookMotionReview(hook.id, hook.videoSha256, 0, active);
      assert.ok(reviewed?.candidatePlan, hook.id);
      assert.equal(reviewed.requiresDecision, false);
      assert.equal(reviewed.canSubmitPaidAnimation, false);
      assert.equal(getReclassifiedHookMotionReview(hook.id, "a".repeat(64), 0, active), undefined);
      continue;
    }
    assert.ok(entry, hook.id);
    if (hook.title === "Hook 89") {
      // Approved version B replaces the source; the previous catalog remains historical.
      assert.equal(hook.videoSha256, "f03490f0586a13dcc80a5319ca2035e246205d57980631e103ac4634ffa7545f");
      assert.notEqual(entry.sourceSha256, hook.videoSha256);
      const replacement = getHookKeyframeMotionReviewDraft(hook.id, hook.videoSha256);
      assert.ok(replacement?.candidatePlan);
      assert.equal(replacement.sourceSha256, hook.videoSha256);
      assert.equal(replacement.canSubmitPaidAnimation, false);
      continue;
    }
    assert.equal(entry.sourceSha256, hook.videoSha256);
    assert.equal(entry.sourceSha256, legacy.sourceSha256);
    assert.equal(entry.sourceDurationSeconds, hook.durationSeconds);
    assert.equal(entry.sourceObservations, legacy.performance);
    assert.equal(entry.sourceReviewMethod, "all_decoded_frames");
    assert.equal(entry.sourceReviewedFrameCount, legacy.reviewedFrameCount);
    assert.equal(entry.motionReviewStatus, "needs_motion_review");
    assert.equal(entry.motionReview, undefined);
    assert.deepEqual(getHookKeyframeMotionPrompt({ ...input, referenceId: hook.id, sourceSha256: hook.videoSha256 }), {
      status: "blocked", reason: "motion_review_required",
    });
  }
});

test("source changes and unknown IDs never use a generic animation fallback", () => {
  assert.deepEqual(getHookKeyframeMotionPrompt({ ...input, referenceId: "not-a-hook" }), { status: "blocked", reason: "unknown_reference" });
  assert.deepEqual(getHookKeyframeMotionPrompt({ ...input, sourceSha256: "a".repeat(64) }), { status: "blocked", reason: "source_hash_changed" });
  assert.equal(getHookKeyframeMotionReviewDraft(simpleId, "a".repeat(64)), undefined);
  assert.equal(getHookKeyframeMotionReviewDraft("not-a-hook", input.sourceSha256), undefined);
});

test("review candidates stay nonbillable and keep different glasses actions distinct", () => {
  const cases = [
    ["explore-paired-hook-7c53cba88343579e7e15c8b0", /(?:draw|pull) the glasses forward off the face/i, /do not place them on the head/i],
    ["explore-paired-hook-2a74d53ba481fd0f99b84179", /on(?:to)? (?:the )?top of (?:the )?head/i, /covers? (?:the )?(?:mouth|lips)|mouth is covered|palm meets the mouth/i],
    ["explore-paired-hook-892b0f65083c8cf03270a7c9", /glasses settle on the eyes/, /glasses stay on/i],
  ] as const;
  for (const [id, action, constraint] of cases) {
    const entry = hookKeyframeMotionCatalog[id];
    const draft = getHookKeyframeMotionReviewDraft(id, entry.sourceSha256)!;
    assert.equal(draft.status, "review_draft");
    assert.equal(draft.canSubmitPaidAnimation, false);
    assert.match(JSON.stringify(draft.candidatePlan), action);
    assert.match(JSON.stringify(draft.candidatePlan), constraint);
    assert.deepEqual(getHookKeyframeMotionPrompt({ ...input, referenceId: id, sourceSha256: entry.sourceSha256 }), {
      status: "blocked", reason: "motion_review_required",
    });
  }
});

test("window reveal, cuts, secondary people and partial faces have explicit review risks", () => {
  const cases = [
    ["explore-paired-hook-e683292d4cd22b2a8b5a9cd8", "no_person_in_opening_frame"],
    ["explore-paired-hook-43cc1dae0a6cfcb03e0a9333", "multiple_takes"],
    ["explore-paired-hook-d7a0b28cd22cc29d618a5a6d", "jump_cut"],
    ["explore-paired-hook-775bf4f0fc41f253d04663e2", "camera_reveals_unseen_scene"],
    ["explore-paired-hook-607bfccda5e91e0d8731fa94", "partial_face_crop"],
    ["explore-paired-hook-e5870158a2ad1494edc92741", "partial_face_crop"],
  ] as const;
  for (const [id, flag] of cases) assert.ok(hookKeyframeMotionCatalog[id].riskFlags.includes(flag), `${id}: ${flag}`);
});

test("duplicate Hook 46 display titles do not collide in the ID-bound catalog", () => {
  const hooks = Object.values(hookKeyframeMotionCatalog).filter(entry => entry.displayTitle === "Hook 46");
  assert.equal(hooks.length, 2);
  assert.notEqual(hooks[0].referenceId, hooks[1].referenceId);
  assert.notEqual(hooks[0].sourceSha256, hooks[1].sourceSha256);
  assert.ok(hooks.every(entry => entry.riskFlags.includes("duplicate_display_title")));
});

test("explicit review compiles a self-contained fixed-duration prompt without a video or portrait reference", () => {
  const result = compileReviewedHookKeyframeMotionPrompt(fixture(), input);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.visualQualification, "not_tested");
  assert.equal(result.durationSeconds, 4);
  assert.match(result.prompt, /approved image as frame 0 for 4s/);
  assert.match(result.prompt, /Keep its face, hair, clothes, light and scene/);
  assert.match(result.prompt, /The lips stay parted/);
  assert.match(result.prompt, /The hands stay outside the picture/);
  assert.match(result.prompt, /SOUND SETTING: OFF/);
  assert.match(result.prompt, /SOUND SETTING: OFF. Silent/u);
  assert.doesNotMatch(result.prompt, /@Video|@Image|source video|source duration|original performance|supporting photos|reference person|swap/);
  assert.equal("videoUrl" in result, false);
  assert.equal("portraitUrls" in result, false);
});

test("duration and opening pose changes require their own review", () => {
  assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(fixture(), { ...input, startingFrameIndex: 12 }), {
    status: "blocked", reason: "opening_frame_not_reviewed",
  });
  assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(fixture(), { ...input, durationSeconds: 5 }), {
    status: "blocked", reason: "duration_not_reviewed",
  });
  for (const durationSeconds of [3, 4.5, 16, NaN]) {
    assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(fixture(), { ...input, durationSeconds }), {
      status: "blocked", reason: "duration_not_reviewed",
    });
  }
  const result = compileReviewedHookKeyframeMotionPrompt(fixture(), { ...input, durationSeconds: 6 });
  assert.equal(result.status, "ready");
  if (result.status === "ready") assert.match(result.prompt, /as frame 0 for 6s/);
});

test("sound ON removes forced-silence instructions without changing motion or claiming a visual pass", () => {
  const result = compileReviewedHookKeyframeMotionPrompt(fixture(), { ...input, generateAudio: true });
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.match(result.prompt, /SOUND SETTING: ON/);
  assert.doesNotMatch(result.prompt, /completely silent|SOUND SETTING: OFF/);
  assert.equal(result.generateAudio, true);
  assert.equal(result.visualQualification, "not_tested");
});

test("a source-dependent or contradictory action cannot be promoted by setting a review flag", () => {
  const badActions = [
    "Follow the original timing.", "Match the source's small hand movements.",
    "Use @Video 1 for performance.", "Use @Image 1 as a main face.",
    "Swap the face using the supporting photos.", "Replace the performer's facial identity.",
    "Lower the hand after four seconds.", "Generate music and dialogue.",
    "Remove the captions and text from the video.",
  ];
  for (const action of badActions) {
    const reviewed = fixture();
    reviewed.motionReview!.plan = { ...reviewed.motionReview!.plan, beats: [{ phase: "opening", action }] };
    assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(reviewed, input), {
      status: "blocked", reason: "source_dependent_motion",
    }, action);
  }
});

test("malformed or temporally reversed review data fails closed", () => {
  const noDurations = fixture();
  noDurations.motionReview!.supportedDurationsSeconds = undefined as unknown as number[];
  assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(noDurations, input), { status: "blocked", reason: "invalid_review" });
  const noNote = fixture();
  noNote.motionReview!.reviewNote = " ";
  assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(noNote, input), { status: "blocked", reason: "invalid_review" });
  const reversed = fixture();
  reversed.motionReview!.plan = { ...reversed.motionReview!.plan, beats: [
    { phase: "ending", action: "Hold the smile." }, { phase: "opening", action: "Blink." },
  ] };
  assert.deepEqual(compileReviewedHookKeyframeMotionPrompt(reversed, input), { status: "blocked", reason: "invalid_review" });
});

test("source-speed candidate keeps source event times, complete ending and remaining final hold", () => {
  const directions="OPENING: sip\nPHASE [0–0.5]: lower the mug\nPHASE [0.5–1]: widen eyes and hold";
  const prompt=buildHookAnimationPrompt({directions,durationSeconds:3,actionDurationSeconds:73/30,generateAudio:false,removePhysicalText:true});
  assert.match(prompt,/0–1\.22s/);assert.match(prompt,/1\.22–2\.43s/);assert.match(prompt,/FINAL HOLD 2\.43–3s/);
  assert.match(prompt,/cleaned surfaces plain; no captions, letters, logos or watermarks/);assert.doesNotMatch(prompt,/Keep physical object text/);
  const old=buildHookAnimationPrompt({directions,durationSeconds:3,generateAudio:false});assert.match(old,/1\.5–3s/);assert.doesNotMatch(old,/FINAL HOLD/);
});

test("the two notbeen2 what clips stretch one what once and the other new clips do not name it", () => {
  const whatIds = new Set([
    "explore-paired-hook-4554cba41f382eeaaf0b6569",
    "explore-paired-hook-37ff10bf5f70a58eb9cd263b",
  ]);
  assert.equal(notbeen2Plans.entries.length, 18);
  const active = getHookReferenceGalleryItems();
  for (const entry of notbeen2Plans.entries) {
    const text = JSON.stringify(entry.plan);
    const count = text.match(/\bwhat\b/gi)?.length ?? 0;
    if (whatIds.has(entry.referenceId)) {
      assert.equal(count, 1, entry.referenceId);
      assert.match(text, /form it only this once/);
      assert.match(text, /Do not form that word a second time/);
    } else assert.equal(count, 0, entry.referenceId);
    const draft = getHookKeyframeMotionReviewDraft(entry.referenceId, entry.sourceSha256, 0);
    assert.ok(draft?.candidatePlan, entry.referenceId);
    const durationSeconds = Math.min(30, Math.max(3, Math.ceil(entry.sourceDurationSeconds - 0.001)));
    assert.doesNotThrow(() => buildHookAnimationPrompt({
      directions: hookMotionPlanDirections(draft.candidatePlan!),
      durationSeconds,
      actionDurationSeconds: Math.min(entry.sourceDurationSeconds, durationSeconds),
      generateAudio: false,
      removePhysicalText: true,
    }), entry.referenceId);
    assert.equal(active.some(item => item.id === entry.referenceId && item.videoSha256 === entry.sourceSha256), true);
  }
  assert.equal(active.some(item => item.sourceUrl === "https://www.tiktok.com/@taliameals/video/7680426189508431118"), false);
});

test("notbeen2 distance changes name the recording phone and the contradicted endings do not keep a departed prop", () => {
  const byTitle = new Map(notbeen2Plans.entries.map(entry => [entry.displayTitle, entry.plan]));
  const phoneMove = ["Hook 108", "Hook 109", "Hook 110", "Hook 111", "Hook 113", "Hook 115", "Hook 116", "Hook 117", "Hook 118", "Hook 119", "Hook 120", "Hook 121", "Hook 122", "Hook 125"];
  for (const title of phoneMove) {
    const camera = byTitle.get(title)?.camera ?? "";
    assert.match(camera, /recording phone/, title);
    assert.match(camera, /digital zoom/, title);
  }
  assert.match(byTitle.get("Hook 124")?.camera ?? "", /recording phone stays at one distance/);
  assert.match(byTitle.get("Hook 119")?.endingState ?? "", /laptop is gone/);
  assert.match(JSON.stringify(byTitle.get("Hook 119")), /camera sees the back of that hand/);
  assert.match(JSON.stringify(byTitle.get("Hook 119")), /face grows and the laptop leaves/);
  assert.doesNotMatch(JSON.stringify(byTitle.get("Hook 119")), /Keep the laptop/);
  assert.match(byTitle.get("Hook 122")?.endingState ?? "", /tablet is gone/);
  assert.doesNotMatch(JSON.stringify(byTitle.get("Hook 122")), /tablet remains/);
  const hook118 = JSON.stringify(byTitle.get("Hook 118"));
  assert.match(hook118, /camera sees the back of that hand/);
  assert.match(hook118, /rises toward the mouth already turned/);
  assert.match(hook118, /stops seated, with her chest square to the lens/);
  assert.match(hook118, /screen-right hand/);
  assert.match(hook118, /face grows while the shoulders and upper chest remain visible/);
  assert.doesNotMatch(hook118, /surprised|palm toward the lens/);
  const hook120 = JSON.stringify(byTitle.get("Hook 120"));
  assert.match(hook120, /fingertips on the lips/);
  assert.match(hook120, /camera sees the back of that hand/);
  assert.match(hook120, /closer face, with shoulder edges still visible/);
  assert.match(hook120, /leave the lens and settle toward screen-left/);
  assert.doesNotMatch(hook120, /small eye changes|palm toward the lens/);
  const hook122 = JSON.stringify(byTitle.get("Hook 122"));
  assert.match(hook122, /camera sees the back of that hand/);
  assert.match(hook122, /screen-left hand/);
  assert.match(hook122, /face grows and the tablet leaves/);
  assert.match(hook122, /eyes close/);
  assert.doesNotMatch(hook122, /palm toward the lens/);
  assert.match(byTitle.get("Hook 125")?.camera ?? "", /pushes the phone away/);
  assert.match(byTitle.get("Hook 111")?.camera ?? "", /comes closer while the hand covers the mouth/);
  const hook108 = JSON.stringify(byTitle.get("Hook 108"));
  assert.match(hook108, /camera sees the side of that hand/);
  assert.match(hook108, /camera sees the back of that hand/);
  assert.match(hook108, /face gets smaller and the shoulders enter/);
  assert.match(hook108, /ceiling opens/);
  assert.match(hook108, /upper lids stay down/);
  assert.doesNotMatch(hook108, /palm toward the lens|fills the lower half of the picture/);
  const hook111 = JSON.stringify(byTitle.get("Hook 111"));
  assert.match(hook111, /camera sees the back of that hand/);
  assert.match(hook111, /comes closer while the hand covers the mouth/);
  assert.match(hook111, /look up toward screen-right/);
  assert.match(hook111, /eases the recording phone slightly back/);
  assert.match(hook111, /glasses on the crown/);
  assert.doesNotMatch(hook111, /palm toward the lens|fills the lower half of the picture/);
  const hook109 = JSON.stringify(byTitle.get("Hook 109"));
  assert.match(hook109, /screen-left hand lays the curled fingers across the mouth/);
  assert.match(hook109, /palm stays against the mouth/);
  assert.match(hook109, /camera sees the back of that hand/);
  assert.match(hook109, /eyes stay open/);
  assert.match(hook109, /face grows while both shoulders remain visible/);
  assert.doesNotMatch(hook109, /toward the lens until the palm fills/);
  assert.doesNotMatch(hook109, /screen-right hand/);
  assert.equal(byTitle.get("Hook 112")?.camera, "Almost fixed close reclining selfie, with only small natural drift.");
  assert.equal(byTitle.get("Hook 114")?.camera, "Almost static handheld selfie, with only tiny drift. No late zoom and no cut.");
  assert.equal(byTitle.get("Hook 123")?.camera, "A steady close selfie.");
});

test("Hook animation labels the first identity photo as the main face identity", () => {
  const one = buildHookAnimationPrompt({ directions: "Look at the camera.", durationSeconds: 4, generateAudio: false, identityPhotoCount: 1 });
  assert.match(one, /Image 2=main face proportions/);
  assert.doesNotMatch(one, /same-person support/);
  const two = buildHookAnimationPrompt({ directions: "Look at the camera.", durationSeconds: 4, generateAudio: false, identityPhotoCount: 2 });
  assert.match(two, /Image 2=main face proportions/);
  assert.match(two, /Image 3=same-person support/);
  assert.match(two, /Identity only; Image 1 sets hair, clothes, light, scene and pose/);
});
