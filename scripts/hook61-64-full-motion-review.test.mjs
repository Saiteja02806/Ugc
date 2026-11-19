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
  "61": {
    "include": [
      "head stays tipped back",
      "pink phone stays upright",
      "eyes remain closed beneath the hand"
    ],
    "exclude": [
      "raised eyes on the phone"
    ]
  },
  "62": {
    "include": [
      "In the final moment, the eyelids close again and remain closed at the end",
      "eyelids close again and remain closed at the end",
      "watch-wearing screen-left hand rises with its back toward the lens"
    ],
    "exclude": [
      "Finish with soft closed-lip smile and relaxed lowered gaze."
    ]
  },
  "63": {
    "include": [
      "fingertips stay beside the outer eye",
      "face gets smaller and more of the pillow and shirt come into view",
      "performer lifts the head off the pillow"
    ],
    "exclude": [
      "flowing tears run"
    ]
  },
  "64": {
    "include": [
      "eyes close once during the dip, then reopen wide toward the laptop on screen-left",
      "then reopen wide toward the laptop on screen-left",
      "back of the hand and fingernails visible",
      "extended screen-right arm moves the recording phone away and down"
    ],
    "exclude": []
  }
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
