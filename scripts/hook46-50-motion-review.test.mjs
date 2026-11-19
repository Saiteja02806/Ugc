import assert from 'node:assert/strict';
import test from 'node:test';
import {getHookReferenceReleaseItems,getHookReferenceGalleryItems} from '../worker/src/lib/explore-hook-reference-release.ts';
import {getRecreateReference} from '../lib/explore/recreate-catalog.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
process.env.GCP_STORAGE_BUCKET??='ugcsaas-media';
process.env.GCP_STORAGE_PUBLIC_BASE_URL??='https://storage.googleapis.com/ugcsaas-media';
const checks={
  "47": {
    "id": "explore-paired-hook-892b0f65083c8cf03270a7c9",
    "include": [
      "eyes briefly close once after the glasses settle",
      "reopen on the lens and hold with slightly narrowed lids"
    ],
    "exclude": []
  },
  "49": {
    "id": "explore-paired-hook-ac9df55efb6be6e2fefbcf0e",
    "include": [
      "jaw eases upward",
      "tight teeth-showing grimace",
      "eyes narrow further beneath tightly furrowed brows",
      "The one word has finished"
    ],
    "exclude": []
  },
  "46-glasses": {
    "id": "explore-paired-hook-4aa27111a23b04a6dd27717b",
    "include": [
      "recording phone closer, so the face grows into a tighter close-up",
      "screen-left upper lid more lowered than the other",
      "lips hold a small closed smile"
    ],
    "exclude": [
      "face stays the same size"
    ]
  },
  "48-excluded": {
    "id": "explore-paired-hook-6070b6ecbe246d879ce0bdcb",
    "include": [
      "resume alternating finger presses",
      "eyes open and settle above the lens",
      "fingers continue typing"
    ],
    "exclude": [
      "eyes open on the lens"
    ]
  }
};
for(const [number,{id,include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.id===id);assert.ok(r);
 const card=getRecreateReference(r.id);if(number!=='48-excluded')assert.ok(card);assert.equal(getHookReferenceGalleryItems().some(v=>v.id===r.id),number!=='48-excluded');
 const prompts=[getReferenceVideoPrompt(r.id,card?.videoUrl??`https://source.test/${r.videoSha256}.mp4`)];
 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);if(number==='49')assert.equal(prompt.split('start the W').length-1,1,'one what articulation');for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
