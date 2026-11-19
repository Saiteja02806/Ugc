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
  "41": {
    "include": [
      "back of the hand and fingernails visible",
      "hand releases the lips and lowers beside the cheek",
      "lips briefly purse, then reopen",
      "eyes hold very wide on the lens",
      "recording phone closer until the face fills most"
    ],
    "exclude": [
      "camera sees the palm",
      "index finger stays on the lips",
      "face stays the same size"
    ]
  },
  "42": {
    "include": [
      "camera sees the back of the hand, rings and fingernails",
      "eyes leave the lens and settle toward screen-left",
      "holding very wide beneath raised brows"
    ],
    "exclude": [
      "camera sees the palm",
      "eyes leave the lens and settle toward screen-right"
    ]
  },
  "43": {
    "include": [
      "jaw lifts and the lips settle into a smaller rounded opening",
      "eyes stay directed toward the tablet with open lids"
    ],
    "exclude": [
      "mouth stays wide open again",
      "mouth holds wide open"
    ]
  },
  "44": {
    "include": [
      "joined hands turn palms outward",
      "camera sees the palms of the joined hands",
      "resume alternating finger presses",
      "fingers continue typing",
      "eyes stay down toward the laptop with lowered upper lids"
    ],
    "exclude": [
      "backs of the hands"
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
