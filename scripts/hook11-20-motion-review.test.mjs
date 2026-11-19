import assert from 'node:assert/strict';
import test from 'node:test';
import {getHookReferenceReleaseItems} from '../worker/src/lib/explore-hook-reference-release.ts';
import {getRecreateReference} from '../lib/explore/recreate-catalog.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
process.env.GCP_STORAGE_BUCKET??='ugcsaas-media';
process.env.GCP_STORAGE_PUBLIC_BASE_URL??='https://storage.googleapis.com/ugcsaas-media';
const checks={
 '14':{include:['palm meets the mouth','camera sees the back of the hand and fingers','mouth is open in a toothy smile'],exclude:['camera sees the palm']},
 '16':{include:['back of the hand and fingers toward the lens','eyes return to the lens','smile shows beside the fingers'],exclude:['camera sees the palm']},
 '17':{include:['eyes look up toward screen-left with open lids','camera sees the back of the hand and fingers','mouth is open in a toothy smile'],exclude:['eyes look up toward screen-right','camera sees the palm']},
 '18':{include:['Both eyes reopen wider toward screen-left','Both eyes finish open toward screen-left','lips stay pressed','back of the hand and fingers'],exclude:['camera sees the palm']},
 '19':{include:['head tips toward screen-right, then comes back nearer upright','eyes briefly close, then reopen toward the lens','lips part to show the teeth in the final moments','broader tooth-showing smile'],exclude:['head tips toward screen-left']},
 '20':{include:['camera sees the backs of the hands and fingers','palms meet the face','camera sees the backs of the hands and fingers','Both hands stay behind the head'],exclude:['camera sees the palms','palms face the lens']},
};
for(const [number,{include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];
 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
