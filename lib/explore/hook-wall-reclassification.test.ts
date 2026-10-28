import assert from "node:assert/strict";
import test from "node:test";
import release from "../../worker/src/lib/explore-hook-wall-reclassification-release.json" with { type: "json" };
import sources from "./hook-wall-reclassification-text.json" with { type: "json" };
import { ReferenceTextSchema } from "./reference-text.ts";
import { getHookKeyframeMotionReviewDraft, getReclassifiedHookMotionReview, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import { buildStartingFrameAnimationPrompt } from "./starting-frame-workflow.ts";
import { remixTextPrompt } from "./remix-text-prompt.ts";

test("active reclassified Hooks bind exact source text and timed motion", () => {
  assert.equal(release.items.length, 3);
  for (const item of release.items) {
    const source = ReferenceTextSchema.parse(sources.items.find(entry => entry.referenceId === item.id));
    assert.equal(source.sourceSha256, item.videoSha256);
    assert.equal(source.format, "hook"); assert.equal(source.blocks.length, 1);
    assert.equal(source.blocks[0].endMs, Math.round(item.durationSeconds * 1000));
    const activeDraft = getHookKeyframeMotionReviewDraft(item.id, item.videoSha256, 0);
    assert.ok(activeDraft);
    assert.equal(activeDraft.canSubmitPaidAnimation, false);
    assert.ok(activeDraft.candidatePlan);
    assert.equal(getReclassifiedHookMotionReview(item.id, item.videoSha256, 0, []), undefined);
    assert.equal(getReclassifiedHookMotionReview(item.id, "f".repeat(64), 0, release.items), undefined);
    assert.equal(getReclassifiedHookMotionReview(item.id, item.videoSha256, 1, release.items), undefined);
    const candidate = getReclassifiedHookMotionReview(item.id, item.videoSha256, 0, release.items)!;
    assert.equal(candidate.canSubmitPaidAnimation, false);
    const directions = hookMotionPlanDirections(candidate.candidatePlan);
    const prompt = buildStartingFrameAnimationPrompt({ workflow: "hook", directions, durationSeconds: 4,
      generateAudio: false, removePhysicalText: true, actionDurationSeconds: Math.min(item.durationSeconds, 4) });
    assert.match(prompt, /SOUND SETTING: OFF/); assert.match(prompt, /OPENING STATE/);
    assert.match(remixTextPrompt(source, { businessName: "Example", productSummary: "Video tools" }, ""), /Example/);
  }
});
