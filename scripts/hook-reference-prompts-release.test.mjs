import assert from 'node:assert/strict';
import test from 'node:test';
import { getRecreateReferences } from '../lib/explore/recreate-catalog.ts';
import { getReferenceText } from '../lib/explore/reference-text-store.ts';
import { referenceVideoPrompts, REFERENCE_TEXT_REMOVAL } from '../lib/explore/reference-video-prompts.ts';
import sceneRelease from './data/hook-reference-scene-release.json' with { type: 'json' };

// Catalogue URL construction needs a public host, never storage credentials.
process.env.GCP_STORAGE_BUCKET ??= 'hook-release-fixture';
process.env.GCP_STORAGE_PUBLIC_BASE_URL ??= 'https://hook-release-fixture.example.test';

test('every active Hook resolves its reviewed prompt and matching Remix source', () => {
  const hooks = getRecreateReferences().filter(reference => reference.format === 'hook' && !reference.archived);
  assert.equal(hooks.length, 107);
  assert.equal(Object.keys(referenceVideoPrompts).length, hooks.length);
  let ready = 0;
  for (const hook of hooks) {
    const review = referenceVideoPrompts[hook.id];
    assert.equal(review.reviewMethod, 'all_decoded_frames');
    assert.ok(review.reviewedFrameCount > 0);
    assert.ok(hook.generationPrompt.includes(review.performance));
    assert.ok(hook.generationPrompt.includes(REFERENCE_TEXT_REMOVAL));
    const source = getReferenceText(hook.id, null, 'hook');
    assert.equal(source.referenceId, hook.id);
    assert.equal(source.sourceSha256, review.sourceSha256);
    assert.ok(['ready', 'no_text'].includes(source.status));
    const trimmed = sceneRelease.items.find(item => item.id === hook.id);
    if (trimmed) {
      assert.equal(source.sourceSha256, trimmed.replacement.videoSha256);
      assert.equal(review.reviewedFrameCount, trimmed.replacement.frames);
      assert.match(source.notes, /Scene cleanup approved by user/);
    } else assert.ok(source.notes.includes(`all ${review.reviewedFrameCount} decoded frames`), hook.id);
    if (source.status === 'ready') ready++;
    else assert.deepEqual(source.blocks, []);
  }
  assert.equal(ready, 105);
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
