import assert from "node:assert/strict";
import test from "node:test";
import { parseHookMotionRewrite } from "./hook-motion-rewrite-contract.ts";
import { buildHookAnimationPrompt, getHookKeyframeMotionPrompt, getHookKeyframeMotionReviewDraft,
  hookKeyframeMotionCatalog, hookKeyframeMotionRewrites, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";

test("all 98 rewrites bind to the exact canonical video and reviewed first-to-last frame evidence", () => {
  const sources = Object.values(hookKeyframeMotionCatalog);
  assert.equal(Object.keys(hookKeyframeMotionRewrites).length, 98);
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
  assert.equal(reviewed, 88); assert.equal(decisions, 10);
});

test("ten remaining ambiguous sequences retain explicit source-bound decisions rather than silently changing the scene or timing", () => {
  const actual = Object.values(hookKeyframeMotionRewrites).filter(item => item.review.status === "needs_decision")
    .map(item => hookKeyframeMotionCatalog[item.referenceId].displayTitle).sort();
  assert.deepEqual(actual, ["Hook 19", "Hook 22", "Hook 28", "Hook 39", "Hook 51", "Hook 57", "Hook 64", "Hook 72", "Hook 83", "Hook 84"]);
  const window = hookKeyframeMotionRewrites["explore-paired-hook-e683292d4cd22b2a8b5a9cd8"];
  assert.match(window.review.issues.join(" "), /no performer|no face/);
  const repeat = hookKeyframeMotionRewrites["explore-paired-hook-b7c86d6729a69666ddf46ed5"];
  assert.match(repeat.review.issues.join(" "), /timing|shorter|repeated/);
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
  assert.match(stretch.openingState, /already interlaced/);
  assert.match(stretch.beats[0].action, /already-joined palms/);
  assert.match(stretch.beats[1].action, /Release the joined hands/);
  assert.match(stretch.beats[1].action, /opposite hand/);
  const cover = hookKeyframeMotionRewrites["explore-paired-hook-4463cc3d85f44ad6829ceb12"].plan;
  assert.match(cover.openingState, /already beginning to rise/);
  assert.match(cover.endingState, /hand covering the lips/);
});
