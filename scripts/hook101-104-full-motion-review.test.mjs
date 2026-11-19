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
  "101": {
    "include": [
      "Briefly close and reopen the eyes, keeping the same hand contact",
      "Briefly close and reopen the eyes again",
      "Hold the near-frontal face and gaze near the lens with open lids"
    ],
    "exclude": []
  },
  "102": {
    "include": [
      "Slide the same hand toward the chin. Briefly close and reopen the eyes again",
      "Glance upward screen-left with open lids",
      "Return the gaze nearer the lens while retaining the open smile"
    ],
    "exclude": []
  },
  "103": {
    "include": [
      "maintain the can grip without drinking",
      "Lower the can and hand fully below the main face area",
      "eyes wide and mouth open, glasses still on"
    ],
    "exclude": []
  },
  "104": {
    "include": [
      "The screen-left palm meets the lips",
      "backs of the ringed fingers and yellow nails facing the lens",
      "Her wide eyes hold near the lens"
    ],
    "exclude": []
  }
};
for(const [number,{include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];if(number==='101'){assert.ok(prompts[0].includes('2.6–2.73s: Briefly close'));assert.ok(prompts[0].includes('3.3–3.5s: Turn the head back'));}
 if(number==='102'){assert.ok(prompts[0].includes('1.73–1.9s: Briefly close'));assert.ok(prompts[0].includes('2.03–2.13s: Slide'));assert.ok(prompts[0].includes('2.4–2.55s: Return'));}

 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
