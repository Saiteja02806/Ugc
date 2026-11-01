import assert from "node:assert/strict";
import test from "node:test";
import candidates from "../../docs/prompt-reviews/reviewed-prompt-candidates-2026-10-26.json" with { type: "json" };
import { buildHookAnimationPrompt, getHookKeyframeMotionReviewDraft, hookKeyframeMotionCatalog, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { getPublicMiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import {
  getReferenceVideoPrompt,
  parseReferenceVideoReviewMethod,
} from "./reference-video-prompts.ts";
import { buildHookFullRecreationOpeningImagePrompt, buildHookKeyframeImagePrompt } from "./hook-keyframe-image-prompt.ts";

test("all 104 reviewed public references resolve the corrected source-bound directions in both recreation routes", () => {
  const rows = candidates.rows.filter(row => !row.referenceId.startsWith("creator-"));
  assert.equal(rows.length, 104);
  for (const row of rows) {
    const source = hookKeyframeMotionCatalog[row.referenceId];
    assert.equal(source.sourceSha256, row.sourceSha256);
    const frame = getCuratedHookFrame(row.referenceId, row.sourceSha256);
    const draft = getHookKeyframeMotionReviewDraft(row.referenceId, row.sourceSha256, frame?.index ?? 0)!;
    assert.ok(draft.candidatePlan, row.referenceId);
    assert.equal(draft.canSubmitPaidAnimation, false, "Selecting a reviewed prompt does not submit generation");
    // Candidate snapshots remain historical evidence. A later frame review can
    // strengthen the active source-bound plan without rewriting that snapshot.
    if ("candidatePlan" in row && row.route === "normal") {
      assert.ok(row.candidatePlan?.openingState.length);
    }
    const middle = frame && getPublicMiddleFrameMotionEntry(row.referenceId, row.sourceSha256, frame.index);
    const image = middle
      ? buildHookFullRecreationOpeningImagePrompt({ referenceId: row.referenceId, sourceSha256: row.sourceSha256, personImageCount: 1 }).prompt
      : buildHookKeyframeImagePrompt({ referenceId: row.referenceId, sourceSha256: row.sourceSha256, sourceFrameIndex: 0, personImageCount: 1 }).prompt;
    assert.ok(image.length > 100);
    const directions = hookMotionPlanDirections(draft.candidatePlan);
    for (const durationSeconds of [3, 4, 8, 10, 15]) {
      const compiled = buildHookAnimationPrompt({ directions, durationSeconds, generateAudio: false });
      assert.doesNotMatch(compiled, /PHASE \[/, row.referenceId);
      assert.ok(compiled.includes(draft.candidatePlan.endingState));
    }
    const direct = getReferenceVideoPrompt(row.referenceId, `https://source.test/${row.sourceSha256}.mp4`)!;
    assert.ok(direct.includes(draft.candidatePlan.endingState));
    assert.equal(getReferenceVideoPrompt(row.referenceId, "https://source.test/replaced.mp4"), undefined);
    assert.equal(getHookKeyframeMotionReviewDraft(row.referenceId, "0".repeat(64), frame?.index ?? 0), undefined);
  }
});

test("Hook 01 keeps phone pickup and continued final shake at every animation duration", () => {
  const id = "explore-paired-hook-4585ee949081c4e5cd835cd3";
  const source = hookKeyframeMotionCatalog[id];
  const plan = getHookKeyframeMotionReviewDraft(id, source.sourceSha256)!.candidatePlan!;
  const directions = hookMotionPlanDirections(plan);
  for (const durationSeconds of [3, 4, 8]) {
    const compiled = buildHookAnimationPrompt({ directions, durationSeconds, generateAudio: false });
    assert.match(compiled, /arm remains extended toward the camera/);
    assert.match(compiled, /Continue lifting and tilting the handheld viewpoint/);
    assert.doesNotMatch(compiled, /takes hold of the recording phone/);
    assert.match(compiled, /small uneven shake/);
    assert.match(compiled, /Do not settle back into a centered desk shot/);
    assert.match(compiled, /completely silent/);
  }
});

test("batch 1 preserves source-bound endings and avoids asserting unseen contact", () => {
  const ids = ["explore-paired-hook-4585ee949081c4e5cd835cd3", "explore-paired-hook-7c53cba88343579e7e15c8b0", "explore-paired-hook-ef59f4b5e69bc9e125f8ada7", "explore-paired-hook-b43622d1486957644f3317e6", "explore-paired-hook-510f7a66546d25863c268477", "explore-paired-hook-55cb1594a04550147e829d7f"];
  for (const id of ids) {
    const source = hookKeyframeMotionCatalog[id];
    const plan = getHookKeyframeMotionReviewDraft(id, source.sourceSha256, 0)?.candidatePlan;
    assert.ok(plan, id);
    const durationSeconds = Math.max(4, Math.ceil(source.sourceDurationSeconds));
    const compiled = buildHookAnimationPrompt({ directions: hookMotionPlanDirections(plan), durationSeconds, actionDurationSeconds: source.sourceDurationSeconds, generateAudio: false });
    assert.ok(compiled.includes(plan.endingState), id);
    assert.doesNotMatch(compiled, /PHASE \[/, id);
    assert.equal(getHookKeyframeMotionReviewDraft(id, "0".repeat(64), 0), undefined);
    if (id === ids[2]) assert.match(compiled, /glance toward screen-right, then shift the eyes toward screen-left/);
    if (id === ids[4]) {
      assert.match(compiled, /raised index finger in front of the face/);
      assert.doesNotMatch(compiled, /finger separate from the lips/);
      assert.match(compiled, /Do not add a sip/);
    }
  }
});

test("manually authored motion is used verbatim apart from the existing wrapper", () => {
  const directions = "My deliberate gaze and a small blink. Keep my chosen pause.";
  const compiled = buildHookAnimationPrompt({ directions, durationSeconds: 3, generateAudio: false });
  assert.ok(compiled.includes(directions));
  assert.doesNotMatch(compiled, /recording phone/);
});

test("reviewed prompt metadata accepts only the two supported review methods", () => {
  assert.equal(parseReferenceVideoReviewMethod("all_decoded_frames"), "all_decoded_frames");
  assert.equal(parseReferenceVideoReviewMethod("sampled_frames"), "sampled_frames");
  assert.throws(
    () => parseReferenceVideoReviewMethod("manual-contact-sheet-and-file-validation"),
    /Unsupported reference-video review method/,
  );
});
