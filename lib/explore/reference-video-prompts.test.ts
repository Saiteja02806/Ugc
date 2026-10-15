import assert from 'node:assert/strict';
import test from 'node:test';
import { getReferenceVideoPrompt, referenceVideoPrompts, REFERENCE_TEXT_REMOVAL } from './reference-video-prompts.ts';

test('pilot prompts bind to exact source files, contain text removal and exclude a fixed influencer', () => {
  for (const [id, entry] of Object.entries(referenceVideoPrompts)) {
    const prompt = getReferenceVideoPrompt(id, `https://example.test/${entry.sourceSha256}.mp4`);
    assert.ok(prompt?.includes(REFERENCE_TEXT_REMOVAL));
    assert.match(prompt!, /Follow the original/);
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
