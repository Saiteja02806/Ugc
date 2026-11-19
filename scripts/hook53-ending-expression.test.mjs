import assert from 'node:assert/strict';import test from 'node:test';
import {getRecreateReference} from '../lib/explore/recreate-catalog.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import {getHookKeyframeMotionReviewDraft} from '../lib/explore/hook-keyframe-motion.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
process.env.GCP_STORAGE_BUCKET??='ugcsaas-media';process.env.GCP_STORAGE_PUBLIC_BASE_URL??='https://storage.googleapis.com/ugcsaas-media';
const id='explore-paired-hook-f216fd8e9397a7747a445ab7',hash='dfe8041f9e9ecd561fbdffd3eb3100ef1cfed6b6cdc464a03b5d42b5f8c9cd92';
function check(prompt){assert.match(prompt,/Let the brief tooth-showing smile soften/);assert.match(prompt,/mouth corners relax and the lips remain slightly parted/);assert.match(prompt,/brows drawn together and the eyes slightly narrowed toward the lens/);assert.match(prompt,/screen-left index finger stays beside the lower lip/);assert.match(prompt,/Hold this final questioning expression in the tighter crop/);assert.doesNotMatch(prompt,/restrained skeptical smile holds|Let smile settle slightly/);}
test('Hook53 source-video Recreate sends the final questioning expression instead of holding the peak smile',()=>{
 const card=getRecreateReference(id);assert.ok(card.videoUrl.endsWith(hash+'.mp4'));check(getReferenceVideoPrompt(id,card.videoUrl));
 assert.equal(getReferenceVideoPrompt(id,'https://wrong.test/'+'a'.repeat(64)+'.mp4'),undefined);
});
test('Hook53 starting-frame Recreate carries the softened ending into its extra-time hold and preserves the opening and single what',()=>{
 const review=getHookKeyframeMotionReviewDraft(id,hash,0);assert.ok(review.candidatePlan);
 for(const sourceDurationSeconds of [2.8,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:id,sourceSha256:hash}),{sourceFrame:{index:0,timeSeconds:0,width:720,height:1280,sha256:'a'.repeat(64)},generateAudio:false});
  const p=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,sourceDurationSeconds);assert.equal(p.animationError,null);check(p.animationPrompt);
  check(p.animationPrompt);assert.match(p.animationPrompt,/FINAL HOLD/);assert.match(p.animationPrompt,/completed ending pose, expression/);
  assert.match(p.animationPrompt,/index finger stays at the lower lip/);assert.equal((p.animationPrompt.match(/\bwhat\b/gi)??[]).length,1);
 }
});
