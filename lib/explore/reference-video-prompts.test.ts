import assert from 'node:assert/strict';
import test from 'node:test';
import { getHookKeyframeMotionReviewDraft, hookKeyframeMotionCatalog } from './hook-keyframe-motion.ts';
import { getCuratedHookFrame } from '../../worker/src/lib/hook-curated-frames.ts';
import { getReferenceVideoPrompt, referenceVideoPrompts, REFERENCE_TEXT_REMOVAL } from './reference-video-prompts.ts';

test('pilot prompts bind to exact source files, contain text removal and exclude a fixed influencer', () => {
  for (const [id, entry] of Object.entries(referenceVideoPrompts)) {
    const prompt = getReferenceVideoPrompt(id, `https://example.test/${entry.sourceSha256}.mp4`);
    assert.ok(prompt?.includes(REFERENCE_TEXT_REMOVAL));
    const source = hookKeyframeMotionCatalog[id];
    const frame = source && getCuratedHookFrame(id, source.sourceSha256);
    const reviewed = source && getHookKeyframeMotionReviewDraft(id, source.sourceSha256, frame?.index ?? 0);
    if (reviewed?.candidatePlan) {
      assert.ok(prompt?.includes(reviewed.candidatePlan.openingState), `${id} uses current reviewed opening`);
      assert.ok(prompt?.includes(reviewed.candidatePlan.endingState), `${id} retains reviewed ending`);
      assert.doesNotMatch(prompt!, /PHASE \[/);
    } else assert.ok(prompt?.includes(entry.performance), `${id} retains its reviewed performance`);
    if(entry.reviewMethod==='all_decoded_frames') {
      assert.ok(entry.reviewedFrameCount!>0);
      assert.ok(entry.reviewNotes?.trim());
    }
    assert.doesNotMatch(prompt!, /olive-green|1\. REFERENCE|2\. OBSERVED/);
    assert.equal(getReferenceVideoPrompt(id, 'https://example.test/replaced.mp4'), undefined);
    assert.equal(getReferenceVideoPrompt(id, undefined), undefined);
  }
  assert.equal(getReferenceVideoPrompt('unreviewed', 'https://example.test/video.mp4'), undefined);
});
