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
  "93": {
    "include": [
      "Lower the hand away from lips to chest",
      "Her screen-right hand lifts from chest level",
      "Hold the forehead contact and open smile"
    ],
    "exclude": []
  },
  "94": {
    "include": [
      "Close and reopen the eyes, lowering the gaze slightly",
      "Briefly lower the upper lids, then reopen them",
      "lift the gaze upward toward screen-left again"
    ],
    "exclude": [
      "Briefly blink again"
    ]
  },
  "95": {
    "include": [
      "do not bring the hand across the mouth",
      "Briefly blink and reopen into the upward off-camera stare"
    ],
    "exclude": []
  },
  "96": {
    "include": [
      "Briefly close and reopen the eyes before the hands lower",
      "Lower both hands together from mouth toward chin/chest",
      "Palms together at chest, mouth open"
    ],
    "exclude": []
  }
};
for(const [number,{include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];if(number==='93'){assert.ok(prompts[0].includes('1.17–1.43s: Lower'));assert.ok(prompts[0].includes('1.93–2.3s: Her screen-right'));}
 if(number==='94'){assert.ok(prompts[0].includes('2.4–2.67s: Keep the head'));assert.ok(prompts[0].includes('2.93–3.07s: Briefly lower'));}
 if(number==='96'){assert.ok(prompts[0].includes('0.6–0.81s: Keep both hands'));}

 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
