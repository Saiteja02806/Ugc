import '../../scripts/worker-source-test-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { DEFAULT_INFLUENCER_SELECTION } from './influencer-registry.ts';
import { characterIdentityInstructions, compileStudioSelection } from './studio-selection.ts';
const { buildCharacterIdentityStagePrompt, generateCharacterIdentityImage, parseCharacterIdentityPipeline, prepareStage2TraitImage } = await import('../../worker/src/lib/character-image-pipeline.ts');

test('character identity stages isolate the primary face and retain independent trait overrides', async () => {
  const selection = { ...DEFAULT_INFLUENCER_SELECTION, eyeColorId: 'eye_color_blue', hairColorId: 'hair_color_platinum' };
  const pipeline = { version: 1, identityReferenceIndex: 0, instructions: characterIdentityInstructions(selection), negativePrompt: compileStudioSelection(selection).negativePrompt };
  const prompt = buildCharacterIdentityStagePrompt(pipeline);
  assert.match(prompt, /ONLY facial identity authority/);
  assert.match(prompt, /moustache/);
  assert.match(prompt, /sky-blue eyes/);
  assert.match(prompt, /bare.*unpierced earlobes/);
  assert.doesNotMatch(prompt, /Copy.*iris color|preserve.*jewelry/);
  const png = await sharp({ create: { width: 90, height: 160, channels: 3, background: '#777777' } }).png().toBuffer();
  const references = ['primary-face', 'ethnicity-other-person', 'hairstyle-other-person'].map(data => ({ data, mimeType: 'image/png' }));
  const stages = [];
  const result = await generateCharacterIdentityImage({ prompt: 'selected full composition', aspectRatio: '9:16', referenceImages: references, pipeline,
    runStage: async (stage, input, action) => { stages.push({ stage, input }); return stage === 'harmonize' ? action() : { buffer: png, model: 'fixture' }; } });
  assert.deepEqual(stages.map(s => s.stage), ['scene', 'identity', 'harmonize']);
  assert.deepEqual(stages[0].input.referenceImages, references);
  assert.equal(stages[1].input.referenceImages.length, 2);
  assert.deepEqual(stages[1].input.referenceImages[1], references[0]);
  assert.equal(stages[1].input.referenceImages[0].data, png.toString('base64'));
  assert.equal((await sharp(result.buffer).metadata()).width, 90);
  for (const invalid of [null, {}, { ...pipeline, version: 2 }, { ...pipeline, identityReferenceIndex: 2 }]) assert.throws(() => parseCharacterIdentityPipeline(invalid));
});

test('stage 2 uses selected hair/accessory references with explicit roles and rejects missing inputs before paid stages', async () => {
  const selection = { ...DEFAULT_INFLUENCER_SELECTION, hairStyleId: 'hair_textured_crop', hairColorId: 'hair_color_platinum', accessoryIds: ['accessory_headphones'] };
  const pipeline = { version: 2, identityReferenceIndex: 0, instructions: characterIdentityInstructions(selection), negativePrompt: compileStudioSelection(selection).negativePrompt,
    traitReferences: [{ index: 2, role: 'hairstyle' }, { index: 3, role: 'accessory' }] };
  const prompt = buildCharacterIdentityStagePrompt(pipeline);
  assert.match(prompt, /Image 3 supplies ONLY the selected hairstyle/);
  assert.match(prompt, /Image 4 supplies ONLY the selected accessory/);
  assert.match(prompt, /Apply and retain every selected accessory/);
  assert.match(prompt, /Correct the scene hairstyle/);
  assert.doesNotMatch(prompt, /Change only the face|hair already established|clothing, hair and lighting/);
  assert.match(characterIdentityInstructions(DEFAULT_INFLUENCER_SELECTION), /Preserve the primary identity photo's hairstyle/);
  const png = await sharp({ create: { width: 90, height: 160, channels: 3, background: '#777777' } }).png().toBuffer();
  const references = ['face', 'unrelated-person', 'hair', 'headphones'].map(data => ({ data, mimeType: 'image/png' }));
  const stages = [];
  await generateCharacterIdentityImage({ prompt: 'unchanged scene', aspectRatio: '9:16', referenceImages: references, pipeline,
    runStage: async (stage, input, action) => { stages.push({ stage, input }); return stage === 'harmonize' ? action() : { buffer: png, model: 'fixture' }; } });
  assert.deepEqual(stages[0].input.referenceImages, references);
  assert.deepEqual(stages[1].input.referenceImages.slice(1), [references[0], references[2], references[3]]);
  for (const traitReferences of [[{ index: 0, role: 'hairstyle' }], [{ index: 2, role: 'face' }], [{ index: 2, role: 'hairstyle' }, { index: 2, role: 'accessory' }]]) {
    assert.throws(() => parseCharacterIdentityPipeline({ ...pipeline, traitReferences }));
  }
  await assert.rejects(generateCharacterIdentityImage({ prompt: '', aspectRatio: '9:16', referenceImages: references.slice(0, 2), pipeline,
    runStage: () => { assert.fail('No paid stage may start with a missing trait reference'); } }), /Missing selected/);
});

test('legacy crop remains reconstructable while new instructions retain selected eye/skin overrides', async () => {
  const instructions = characterIdentityInstructions(DEFAULT_INFLUENCER_SELECTION);
  assert.match(instructions, /Preserve the primary identity photo\'s distinctive facial proportions/);
  assert.match(instructions, /selected eyelid shape and skin tone/);
  assert.match(instructions, /matte skin finish/);

  const fullPortraitPng = await sharp({ create: { width: 100, height: 200, channels: 3, background: '#333333' } }).png().toBuffer();
  const hairInput = { data: fullPortraitPng.toString('base64'), mimeType: 'image/png' };
  const preparedHair = await prepareStage2TraitImage(hairInput, 'hairstyle');
  const croppedMeta = await sharp(Buffer.from(preparedHair.data, 'base64')).metadata();
  assert.equal(croppedMeta.width, 100);
  assert.equal(croppedMeta.height, 70);

  const accessoryInput = { data: fullPortraitPng.toString('base64'), mimeType: 'image/png' };
  const preparedAccessory = await prepareStage2TraitImage(accessoryInput, 'accessory');
  assert.equal(preparedAccessory.data, accessoryInput.data);
});
