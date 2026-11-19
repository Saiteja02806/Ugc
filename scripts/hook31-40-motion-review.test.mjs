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
  "31": {
    "include": [
      "screen-right hand cups the lower mouth and cheek",
      "camera sees the back of the hand and fingers",
      "eyes return to the lens and hold with slightly lowered upper lids"
    ],
    "exclude": [
      "camera sees the palm",
      "screen-left hand stays across the mouth",
      "eyes settle toward screen-right"
    ]
  },
  "32": {
    "include": [
      "backs of the hands and pink fingernails",
      "screen-right hand lowers after the blink",
      "eyes open again, settle slightly toward screen-right"
    ],
    "exclude": [
      "camera sees the palms",
      "camera sees that palm"
    ]
  },
  "34": {
    "include": [
      "opens and spreads the fingers",
      "palm visible",
      "holding narrowed under drawn-together brows",
      "small, slightly rounded opening"
    ],
    "exclude": [
      "index finger points",
      "other fingers stay curled"
    ]
  },
  "35": {
    "include": [
      "fingertips rest under the screen-left eye",
      "slightly downturned corners",
      "screen-left eyelid narrows at the fingertip contact"
    ],
    "exclude": []
  },
  "38": {
    "include": [
      "head rocks back toward upright",
      "slight remaining screen-right tilt"
    ],
    "exclude": [
      "stops tilted that way",
      "head stays tilted toward screen-left"
    ]
  },
  "39": {
    "include": [
      "lips purse briefly, then release into a small rounded open mouth",
      "eyes stay very wide on the lens"
    ],
    "exclude": [
      "lips purse and stay pursed",
      "lips stay pursed"
    ]
  },
  "40": {
    "include": [
      "eyes return to the lens and hold with open lids",
      "brows draw up and together",
      "small rounded opening"
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
