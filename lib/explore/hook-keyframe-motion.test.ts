import assert from "node:assert/strict";
import test from "node:test";
import { getHookReferenceGalleryItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import octoberBatch from "../../worker/src/lib/explore-hook-reference-oct23-release.json" with { type: "json" };
import octoberRefresh from "../../worker/src/lib/explore-hook-reference-oct23-refresh-release.json" with { type: "json" };
import { referenceVideoPrompts } from "./reference-video-prompts.ts";
import {
  compileReviewedHookKeyframeMotionPrompt,
  getHookKeyframeMotionPrompt,
  getHookKeyframeMotionReviewDraft,
  hookKeyframeMotionCatalog,
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
  assert.equal(active.length, 95 + (octoberBatch.mediaStatus === "published" && octoberBatch.activation === "active" ? 1 : 0) + (octoberRefresh.mediaStatus === "published" && octoberRefresh.activation === "active" ? 8 : 0));
  assert.equal(Object.keys(hookKeyframeMotionCatalog).length, 107);
  for (const hook of active) {
    const entry = hookKeyframeMotionCatalog[hook.id];
    const legacy = referenceVideoPrompts[hook.id];
    assert.ok(entry, hook.id);
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
    ["explore-paired-hook-7c53cba88343579e7e15c8b0", /(?:draw|pull) the glasses forward off the face/, /do not place them on the head/i],
    ["explore-paired-hook-2a74d53ba481fd0f99b84179", /onto the top of the head/, /covers the mouth|mouth is covered/],
    ["explore-paired-hook-892b0f65083c8cf03270a7c9", /(?:down and back|down) onto the nose/, /do not.*(?:remov|revers)/i],
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
    ["explore-paired-hook-917cba028b9bc9cfda3e9f9b", "secondary_person_reveal"],
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
  assert.match(result.prompt, /approved starting image into a 4-second video/);
  assert.match(result.prompt, /facial features and proportions/);
  assert.match(result.prompt, /restrained surprised look/);
  assert.match(result.prompt, /Keep (?:both |the )?hands outside the (?:frame|picture)/);
  assert.match(result.prompt, /SOUND SETTING: OFF/);
  assert.match(result.prompt, /completely silent video/);
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
  if (result.status === "ready") assert.match(result.prompt, /6-second video/);
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
