import approvedNovemberBatch from "../worker/src/lib/explore-hook-notbeen3-release.json" with { type: "json" };
import { assertReviewedMotion } from "./assert-reviewed-motion.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { getRecreateReferences } from '../lib/explore/recreate-catalog.ts';
import { getReferenceText } from '../lib/explore/reference-text-store.ts';
import { referenceVideoPrompts, REFERENCE_TEXT_REMOVAL } from '../lib/explore/reference-video-prompts.ts';
import { getHookKeyframeMotionReviewDraft } from '../lib/explore/hook-keyframe-motion.ts';
import { getCuratedHookFrame } from '../worker/src/lib/hook-curated-frames.ts';
import sceneRelease from './data/hook-reference-scene-release.json' with { type: 'json' };

// Catalogue URL construction needs a public host, never storage credentials.
process.env.GCP_STORAGE_BUCKET ??= 'hook-release-fixture';
process.env.GCP_STORAGE_PUBLIC_BASE_URL ??= 'https://hook-release-fixture.example.test';

test('every active Hook resolves its reviewed prompt and matching Remix source', () => {
  const hooks = getRecreateReferences().filter(reference => reference.format === 'hook' && !reference.archived);
  assert.equal(hooks.length, 129);
  assert.equal(hooks.some(reference => reference.id === "explore-paired-hook-ddcfb2950d40f37771058b73"), false);
  assert.equal(hooks.some(reference => reference.id === "explore-paired-hook-6070b6ecbe246d879ce0bdcb"), false);
  assert.equal(Object.keys(referenceVideoPrompts).length, 135, "historical prompt identities remain available");
  let ready = 0;
  for (const hook of hooks) {
    const historical = referenceVideoPrompts[hook.id];
    // Version B was approved on November 11; preserve the old review separately.
    const review = hook.id === "explore-paired-hook-6365d336034633aa5070eb48"
      ? { ...historical, sourceSha256: "f03490f0586a13dcc80a5319ca2035e246205d57980631e103ac4634ffa7545f", reviewedFrameCount: 77 }
      : historical;
    assert.equal(review.reviewMethod, 'all_decoded_frames');
    assert.ok(review.reviewedFrameCount > 0);
    const selected = getCuratedHookFrame(hook.id, review.sourceSha256);
    const motion = getHookKeyframeMotionReviewDraft(hook.id, review.sourceSha256, selected?.index ?? 0);
    assert.ok(motion?.candidatePlan, hook.id);
    assertReviewedMotion(hook.generationPrompt, motion.candidatePlan, hook.id);
    assert.ok(hook.generationPrompt.includes(REFERENCE_TEXT_REMOVAL));
    const source = getReferenceText(hook.id, null, 'hook');
    assert.equal(source.referenceId, hook.id);
    assert.equal(source.sourceSha256, review.sourceSha256);
    assert.ok(['ready', 'no_text'].includes(source.status));
    const trimmed = sceneRelease.items.find(item => item.id === hook.id);
    if (trimmed && trimmed.replacement.videoSha256 === review.sourceSha256) {
      assert.equal(source.sourceSha256, trimmed.replacement.videoSha256);
      assert.equal(review.reviewedFrameCount, trimmed.replacement.frames);
      assert.match(source.notes, /Scene cleanup approved by user/);
    } else if (hook.id === "explore-paired-hook-6365d336034633aa5070eb48") {
      assert.match(source.notes, /Motion checked through final frame/);
      assert.equal(source.blocks[0].endMs, 2633);
    } else if (approvedNovemberBatch.items.some(item => item.id === hook.id)) {
      const approved = approvedNovemberBatch.items.find(item => item.id === hook.id);
      assert.equal(source.sourceSha256, approved.videoSha256);
      const approvedTrimFrames = { "Hook 126": 68, "Hook 130": 87 };
      if (approved.title in approvedTrimFrames) {
        assert.equal(review.reviewedFrameCount, approvedTrimFrames[approved.title]);
        assert.match(source.notes, /Motion checked through final frame/);
      } else assert.match(source.notes, new RegExp(`all ${review.reviewedFrameCount} (?:retained )?decoded frames`, "i"));
    } else assert.ok(new RegExp(`all ${review.reviewedFrameCount} (?:retained )?decoded frames`, "i").test(source.notes), hook.id);
    if (source.status === 'ready') ready++;
    else assert.deepEqual(source.blocks, []);
  }
  assert.equal(ready, 127);
});

const firstThree = [
  ['explore-paired-hook-4585ee949081c4e5cd835cd3', 'Computer Science students!!\nThis website is EVERYTHING'],
  ['explore-paired-hook-7c53cba88343579e7e15c8b0', 'editors, get ready to\nwash dishes for $100/mo 💀🤡'],
  ['explore-paired-hook-ef59f4b5e69bc9e125f8ada7', '3 years of video editing\nand NOW i find this??? 😳'],
];
for (const [id, text] of firstThree) {
  test(`initial Hook ${id} exposes its actual caption through the Remix resolver`, () => {
    const source = getReferenceText(id, null, 'hook');
    assert.equal(source.status, 'ready');
    assert.equal(source.blocks[0].text, text);
    assert.throws(() => getReferenceText(id, null, 'wall_text'));
  });
}

test('Hooks 4 and 5 also expose source captions through the same resolver', () => {
  const hooks = getRecreateReferences().filter(reference => reference.format === 'hook' && !reference.archived);
  for (const hook of hooks.slice(3, 5)) {
    const source = getReferenceText(hook.id, null, 'hook');
    assert.equal(source.status, 'ready');
    assert.ok(source.blocks[0].text.trim());
    assert.equal(source.sourceSha256, referenceVideoPrompts[hook.id].sourceSha256);
  }
});
