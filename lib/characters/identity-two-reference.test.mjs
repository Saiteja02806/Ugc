import '../../scripts/worker-source-test-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { DEFAULT_INFLUENCER_SELECTION, findTraitById } from './influencer-registry.ts';
import { characterFaceOnlyInstructions, compileStudioSelection } from './studio-selection.ts';
const { buildCharacterIdentityStageInput, generateCharacterIdentityImage, parseCharacterIdentityPipeline } = await import('../../worker/src/lib/character-image-pipeline.ts');

test('new scene/primary stage retains selected traits and negatives while excluding every other portrait', async () => {
  const selection = { ...DEFAULT_INFLUENCER_SELECTION, characterTypeId: 'char_extreme', hairStyleId: 'hair_textured_crop',
    hairColorId: 'hair_color_platinum', eyeColorId: 'eye_color_blue', accessoryIds: [] };
  const compiled = compileStudioSelection(selection, 'red glasses, readable text');
  const pipeline = { version: 4, identityReferenceIndex: 0, instructions: characterFaceOnlyInstructions(selection), negativePrompt: compiled.negativePrompt };
  const scene = await sharp({ create: { width: 90, height: 160, channels: 3, background: '#777777' } }).png().toBuffer();
  // Any additional reference, including an unreadable haircut portrait, belongs only to stage 1.
  const references = ['initial-owned-primary', 'hair-other-person', 'accessory-other-person'].map(data => ({ data, mimeType: 'image/jpeg' }));
  const seen = [];
  await generateCharacterIdentityImage({ prompt: compiled.prompt, aspectRatio: '9:16', referenceImages: references, pipeline,
    runStage: async (stage, input, action) => {
      seen.push({ stage, input });
      return stage === 'harmonize' ? action() : { buffer: scene, model: 'fixture' };
    } });
  assert.deepEqual(seen.map(entry => entry.stage), ['scene', 'identity', 'harmonize']);
  assert.deepEqual(seen[0].input.referenceImages, references);
  assert.equal(seen[0].input.prompt, compiled.prompt);
  assert.deepEqual(seen[1].input.referenceImages, [{ data: scene.toString('base64'), mimeType: 'image/png' }, references[0]]);
  const prompt = seen[1].input.prompt;
  assert.match(prompt, /Exactly two images/);
  assert.match(prompt, /ONLY facial identity authority/);
  assert.match(prompt, /sky-blue eyes/);
  assert.match(prompt, /Keep Image 1's hairstyle and hair color/);
  assert.match(prompt, /Textured Crop/);
  assert.match(prompt, /Platinum Ash/);
  assert.match(prompt, /bare with natural unpierced earlobes/);
  assert(prompt.endsWith(`Negative constraints: Avoid ${compiled.negativePrompt}.`));
  assert.doesNotMatch(prompt, /Image 3|selected haircut reference|Correct the scene hairstyle|Neutral patches/);
  for (const [field, id] of Object.entries(selection)) {
    if (field === 'accessoryIds' || ['characterTypeId', 'headShapeId', 'eyeShapeId', 'eyeColorId', 'skinToneId', 'framing'].includes(field)) continue;
    assert(prompt.includes(findTraitById(id).label), `Selected ${field} must remain in instructions`);
  }
});

test('two-reference stage preserves selected accessory objects and explicit facial overrides', async () => {
  const selection = { ...DEFAULT_INFLUENCER_SELECTION, headShapeId: 'head_square', accessoryIds: ['accessory_headphones'] };
  const instructions = characterFaceOnlyInstructions(selection);
  assert(instructions.includes(findTraitById(selection.headShapeId).promptSnippet));
  assert(instructions.includes(findTraitById(selection.accessoryIds[0]).promptSnippet));
  assert.match(instructions, /Preserve the selected accessories in Image 1/);
  assert.match(instructions, /selected eyelid shape and skin tone/);
  assert.doesNotMatch(instructions, /Remove all accessories|bare with natural unpierced/);
  const pipeline = { version: 4, identityReferenceIndex: 0, instructions, negativePrompt: '' };
  const input = await buildCharacterIdentityStageInput({ scene: Buffer.from('saved-scene'), aspectRatio: '9:16',
    referenceImages: [{ data: 'uploaded-primary', mimeType: 'image/png' }, { data: 'headphones-wearer', mimeType: 'image/jpeg' }], pipeline });
  assert.equal(input.referenceImages.length, 2);
  assert.equal(input.referenceImages[1].data, 'uploaded-primary');
});

test('two-reference revision rejects extra trait metadata and missing primary before paid stages', async () => {
  const pipeline = { version: 4, identityReferenceIndex: 0, instructions: 'Preserve primary', negativePrompt: '' };
  assert.deepEqual(parseCharacterIdentityPipeline(pipeline), pipeline);
  for (const patch of [{ traitReferences: [] }, { traitReferences: [{ index: 1, role: 'hairstyle' }] },
    { referenceProcessingVersion: 1 }, { identityReferenceIndex: 1 }, { version: 5 }]) {
    assert.throws(() => parseCharacterIdentityPipeline({ ...pipeline, ...patch }));
  }
  await assert.rejects(generateCharacterIdentityImage({ prompt: 'Scene', aspectRatio: '9:16', referenceImages: [], pipeline,
    runStage: () => assert.fail('Missing primary must not spend') }), /primary character face/);
});
