import assert from 'node:assert/strict';import test from 'node:test';
import release from '../worker/src/lib/explore-hook-notbeen3-release.json' with {type:'json'};
import {getRecreateReferences} from '../lib/explore/recreate-catalog.ts';
import {getReferenceText} from '../lib/explore/reference-text-store.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import {getHookKeyframeMotionReviewDraft} from '../lib/explore/hook-keyframe-motion.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
process.env.GCP_STORAGE_BUCKET??='ugcsaas-media';process.env.GCP_STORAGE_PUBLIC_BASE_URL??='https://storage.googleapis.com/ugcsaas-media';
for(const[id,hash,title,duration,frameCount]of[
 ['explore-paired-hook-0c9e57769a98cec980e726a1','333b1b0996c162bdfee7bf1ee6fd0ea889a74cafb9635c46246f74198e63908e','Hook 126',2.267,68],
 ['explore-paired-hook-a557969f8da32f3985ecf55e','6e59800db5d9ffa36e95645fe64cd5e8125e04cfb2a0177db1b3afae9c71c817','Hook 130',2.9,87],
])test(`${title} binds the approved trimmed source and complete motion through gallery, captions and both Recreate paths`,()=>{
 const row=release.items.find(r=>r.id===id);assert.equal(row.videoSha256,hash);assert.equal(row.title,title);assert.equal(row.durationSeconds,duration);
 const cards=getRecreateReferences().filter(r=>r.id===id);assert.equal(cards.length,1);const card=cards[0];assert.ok(card.videoUrl.endsWith(hash+'.mp4'));assert.equal(card.durationSeconds,duration);assert.equal(card.isNew,true);
 const text=getReferenceText(id,null,'hook');assert.equal(text.sourceSha256,hash);assert.equal(text.blocks[0].endMs,Math.round(duration*1000));
 const review=getHookKeyframeMotionReviewDraft(id,hash,0);assert.equal(review.sourceDurationSeconds,duration);assert.ok(review.candidatePlan);assert.match(review.sourceObservations,new RegExp(String(frameCount)));
 const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:id,sourceSha256:hash}),{sourceFrame:{index:0,timeSeconds:0,width:720,height:1280,sha256:'a'.repeat(64)},generateAudio:false});const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);assert.equal(preview.animationError,null);assert.ok(preview.animationPrompt.includes(review.candidatePlan.endingState));assert.ok(getReferenceVideoPrompt(id,card.videoUrl).includes(review.candidatePlan.endingState));
 assert.doesNotMatch(preview.animationPrompt,/black opening|laptop cutaway|cut to.*laptop/i);
 if(title==='Hook 126')assert.match(preview.animationPrompt,/Hold the raised forearm/);
 else assert.match(preview.animationPrompt,/head bowed.*hand covering the eyes/s);
});
