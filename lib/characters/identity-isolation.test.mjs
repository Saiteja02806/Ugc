import '../../scripts/worker-source-test-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import masks from '../../worker/src/lib/character-hair-masks.json' with { type: 'json' };
import fingerprints from './studio-image-fingerprints.json' with { type: 'json' };
import { HAIR_STYLES, DEFAULT_INFLUENCER_SELECTION } from './influencer-registry.ts';
import { characterIdentityInstructions } from './studio-selection.ts';
const { buildCharacterIdentityStageInput, buildCharacterIdentityStagePrompt, suppressCharacterReferenceFace,
  prepareReviewedCharacterHair, parseCharacterIdentityPipeline, generateCharacterIdentityImage, prepareStage2TraitImage } = await import('../../worker/src/lib/character-image-pipeline.ts');
const { createGenerationRequestFingerprint } = await import('../../worker/src/lib/generation-provider.ts');

test('every offered catalog hairstyle has a source-bound reviewed face region', () => {
  const styles = HAIR_STYLES.filter(t => t.imagePath);
  assert.deepEqual(Object.keys(masks.traits).sort(), styles.map(t => t.id).sort());
  for (const trait of styles) {
    const region = masks.traits[trait.id];
    assert.equal(region.sourceSha256, fingerprints[trait.imagePath]);
    assert.match(region.preparedSha256, /^[a-f0-9]{64}$/);
    assert.equal(region.ellipse.length, 5);
    assert(region.ellipse.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
  }
});

test('face suppression keeps full frame, fringe and long side strands while covering internal features', async () => {
  const input = await sharp({ create: { width: 100, height: 200, channels: 3, background: '#123456' } }).png().toBuffer();
  const masked = await suppressCharacterReferenceFace(input, [0.5, 0.4, 0.25, 0.25, 0.25]);
  const {data, info} = await sharp(masked).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width, 100); assert.equal(info.height, 200);
  const pixel = (x,y) => [...data.subarray((y*100+x)*info.channels,(y*100+x)*info.channels+3)];
  assert.deepEqual(pixel(50,80), [128,128,128]);
  for (const [x,y] of [[50,30],[10,80],[90,80],[10,190]]) assert.deepEqual(pixel(x,y), [18,52,86]);
  for (const region of [[0.5,0.4,0,0.25,0.25],[0.5,NaN,0.2,0.2,0.2]]) await assert.rejects(suppressCharacterReferenceFace(input,region));
});

test('new revision refuses corrupt, changed and unreviewed hairstyles before paid stages', async () => {
  const image = {data:'unreadable',mimeType:'image/jpeg'};
  await assert.rejects(prepareReviewedCharacterHair(image,'hair_textured_crop'), /does not match/);
  await assert.rejects(prepareReviewedCharacterHair(image,'unknown'), /no reviewed/);
  const pipeline={version:3,referenceProcessingVersion:1,identityReferenceIndex:0,instructions:'Identity',negativePrompt:'',traitReferences:[{index:1,role:'hairstyle',traitId:'hair_textured_crop'}]};
  await assert.rejects(generateCharacterIdentityImage({prompt:'Scene',aspectRatio:'9:16',referenceImages:[image,image],pipeline,
    runStage:()=>assert.fail('No provider stage allowed for an invalid reviewed reference')}), /does not match/);
  for (const patch of [{referenceProcessingVersion:2},{traitReferences:[{index:1,role:'hairstyle',traitId:'unknown'}]}]) assert.throws(()=>parseCharacterIdentityPipeline({...pipeline,...patch}));
});

test('both historical v2 identity variants reconstruct only their exact saved fingerprints', async () => {
  const png = await sharp({create:{width:90,height:160,channels:3,background:'#777777'}}).png().toBuffer();
  const image={data:png.toString('base64'),mimeType:'image/png'};
  const pipeline={version:2,identityReferenceIndex:0,instructions:'Frozen old instructions',negativePrompt:'earrings',traitReferences:[{index:1,role:'hairstyle'}]};
  const common={scene:png,aspectRatio:'9:16',referenceImages:[image,image],pipeline};
  const original=await buildCharacterIdentityStageInput(common);
  assert.deepEqual(original.referenceImages[2],image);
  assert.doesNotMatch(original.prompt,/This reference shows hair only/);
  const cropped={...original,prompt:buildCharacterIdentityStagePrompt(pipeline,true),referenceImages:[...original.referenceImages.slice(0,2),await prepareStage2TraitImage(image,'hairstyle')]};
  for(const input of [original,cropped]){
    const fp=createGenerationRequestFingerprint({version:1,stage:'identity',input});
    assert.deepEqual(await buildCharacterIdentityStageInput({...common,legacyIdentityFingerprint:fp}),input);
  }
  await assert.rejects(buildCharacterIdentityStageInput({...common,legacyIdentityFingerprint:'0'.repeat(64)}), /cannot be reconstructed/);
});

test('new identity instructions preserve unselected proportions while retaining selected overrides',()=>{
  const instructions=characterIdentityInstructions({...DEFAULT_INFLUENCER_SELECTION,eyeColorId:'eye_color_blue'});
  assert.match(instructions,/sky-blue/);assert.match(instructions,/selected eyelid shape and skin tone/);
  assert.match(instructions,/eye spacing, nose, lips and facial hair/);assert.match(instructions,/bare.*unpierced/);
});
