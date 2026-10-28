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
    assert.match(compiled, /takes hold of the recording phone/);
    assert.match(compiled, /Continue lifting and tilting the handheld phone/);
    assert.match(compiled, /small uneven shake/);
    assert.match(compiled, /Do not settle back into a centered desk shot/);
    assert.match(compiled, /completely silent/);
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
