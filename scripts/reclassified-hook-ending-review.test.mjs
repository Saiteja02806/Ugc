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
  "reclassified06": {
    "id": "explore-paired-hook-d426f4a2248708f61298bf7f",
    "include": [
      "screen-right hand vertically beside the face",
      "upper lids sink almost shut and stay lowered through the finish",
      "restrained closed smile"
    ],
    "exclude": [
      "eyes soften and briefly close near the ending"
    ]
  },
  "reclassified28": {
    "id": "explore-paired-hook-0dd34d729ad756dbd87888cc",
    "include": [
      "fingertips at the hair and sides of the neck just below the ears",
      "lips settle into a compact purse",
      "eyes hold toward the lens with relaxed upper lids"
    ],
    "exclude": []
  },
  "reclassified59": {
    "id": "explore-paired-hook-6030a6af486760af6b5d64b1",
    "include": [
      "squeezing the eyes closed",
      "Lower that hand out of the face",
      "open the eyes wide and the mouth"
    ],
    "exclude": []
  }
};
for(const [number,{id,include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.id===id);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];
 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
