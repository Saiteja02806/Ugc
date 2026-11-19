import assert from 'node:assert/strict';import test from 'node:test';
import release from '../worker/src/lib/explore-hook-reference-new-batch-release.json' with {type:'json'};
import {getRecreateReferences,getRecreateReference} from '../lib/explore/recreate-catalog.ts';
import {getReferenceText} from '../lib/explore/reference-text-store.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import {getHookKeyframeMotionReviewDraft} from '../lib/explore/hook-keyframe-motion.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
process.env.GCP_STORAGE_BUCKET??='ugcsaas-media';process.env.GCP_STORAGE_PUBLIC_BASE_URL??='https://storage.googleapis.com/ugcsaas-media';
const id='explore-paired-hook-6365d336034633aa5070eb48',hash='f03490f0586a13dcc80a5319ca2035e246205d57980631e103ac4634ffa7545f',oldHash='8d6da45511c764b5c094712c4cd1d7ac0c8f367dff6bf72435da68dad934f245';
test('Hook89 uses approved B without a duplicate and binds source timing through both Recreate paths',()=>{
 const item=release.items.find(r=>r.id===id);assert.equal(item.videoSha256,hash);assert.equal(item.durationSeconds,2.633008);assert.equal(item.title,'Hook 89');
 const cards=getRecreateReferences().filter(r=>r.sourceUrl===item.sourceUrl);assert.equal(cards.length,1);assert.equal(cards[0].id,id);assert.equal(cards[0].archived,undefined);const card=getRecreateReference(id);assert.ok(card);assert.ok(card.videoUrl.endsWith(hash+'.mp4'));
 const text=getReferenceText(id,null,'hook');assert.equal(text.sourceSha256,hash);assert.equal(text.blocks[0].endMs,2633);
 const review=getHookKeyframeMotionReviewDraft(id,hash,0);assert.equal(review.sourceDurationSeconds,item.durationSeconds);assert.match(review.candidatePlan.beats[0].action,/Hold the open-mouth smile/);
 const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:id,sourceSha256:hash}),{sourceFrame:{index:0,timeSeconds:0,width:576,height:1024,sha256:'4fe5a7993965d94b2bd4b513f8e10d076c692d2f914553f0bd6ea6a4a4b113d7'},generateAudio:false});const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,item.durationSeconds);assert.equal(preview.animationError,null);assert.match(preview.animationPrompt,/screen-right hand rises/);assert.match(preview.animationPrompt,/FINAL HOLD 2\.63–3s/);
 const prompt=getReferenceVideoPrompt(id,card.videoUrl);assert.match(prompt,/0\.4–0\.8s/);assert.match(prompt,/screen-right hand rises/);assert.doesNotMatch(prompt,/2\.9s/);assert.equal(getReferenceVideoPrompt(id,'https://source.test/'+oldHash+'.mp4'),undefined);
 assert.ok(getHookKeyframeMotionReviewDraft(id,oldHash,0)?.candidatePlan,'Historical motion review remains available');
});
