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
  "77": {
    "include": [
      "eyes remain closed",
      "screen-right hand lowers the upright pink phone",
      "recording camera stays fixed"
    ],
    "exclude": []
  },
  "78": {
    "include": [
      "palm already across the lips",
      "shoulders slip out of view",
      "Shift eyes toward lens"
    ],
    "exclude": []
  },
  "79": {
    "include": [
      "fingertips upright against the side of her nose and cheek",
      "part of her closed smile still visible on screen-left",
      "Return her gaze toward the lens"
    ],
    "exclude": []
  },
  "80": {
    "include": [
      "The same screen-left fingers continue easing down beside the cheek. Her mouth stays open in a smile. Her eyes stay open above screen-left.",
      "The same screen-left fingers continue easing down beside the cheek. Her mouth stays open in a smile. Her eyes stay open above screen-left.",
      "lift it clear of the mouth and pass it up in front of the face"
    ],
    "exclude": [
      "Hold the open-mouth smile with the fingers beside the cheek.",
      "Her eyes are open, with a small open-mouth smile and the fingers relaxed beside the cheek."
    ]
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
