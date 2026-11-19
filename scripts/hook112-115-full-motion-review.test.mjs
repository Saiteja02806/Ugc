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
  "112": {
    "include": [
      "Move the upright index slightly outward toward screen-right",
      "lower the pointing finger",
      "hand rests in a loose curl beside the screen-right shoulder"
    ],
    "exclude": []
  },
  "113": {
    "include": [
      "Lower the hand away from the mouth",
      "Do not cover the mouth again",
      "hand is out of view"
    ],
    "exclude": []
  },
  "114": {
    "include": [
      "Return the gaze up toward screen-right and hold",
      "Return attention nearer the lens",
      "hands remain below the frame"
    ],
    "exclude": []
  },
  "115": {
    "include": [
      "small tooth-visible smile and narrowed pleased eyes",
      "phone in the walking hand keeps bobbing"
    ],
    "exclude": []
  }
};
for(const [number,{include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];if(number==='112'){assert.ok(prompts[0].includes('0.27–0.77s:'));assert.ok(prompts[0].includes('0.77–1.37s:'));assert.ok(!prompts[0].includes('0.47–0.87s:'));}
 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 // Preview normalizes phase fractions to hundredths before scaling to 3.1s.
 // Explicit source duration and the catalog fallback both preserve source speed.
 if(number==='112')for(const prompt of prompts.slice(1)){
  assert.ok(prompt.includes('0.28–0.78s:'));
  assert.ok(prompt.includes('0.78–1.36s:'));
  assert.ok(prompt.includes('3.1–4s:'));
  assert.ok(!prompt.includes('0.47–0.87s:'));
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
