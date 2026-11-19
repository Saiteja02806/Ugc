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
  "97": {
    "include": [
      "Glance screen-left and hold with very wide eyes",
      "Continue the handheld approach into a very tight low-angle off-center crop"
    ],
    "exclude": []
  },
  "98": {
    "include": [
      "Roll the gaze upward toward screen-left and hold with open lids",
      "Briefly close the eyes again, then reopen them looking forward",
      "Lower the magenta-cased phone below the picture"
    ],
    "exclude": []
  },
  "99": {
    "include": [
      "Hold the hand against the mouth continuously",
      "lower that same hand away from the mouth",
      "Keep the open-mouth reaction toward the lens through the final frame"
    ],
    "exclude": []
  },
  "100": {
    "include": [
      "Blink once, retaining the sideward gaze",
      "Blink once while still facing screen-right",
      "Blink once again",
      "Turn gaze/head back toward screen-right"
    ],
    "exclude": []
  }
};
for(const [number,{include,exclude}]of Object.entries(checks))test(`Hook ${number}: reviewed motion reaches both Recreate compilers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];if(number==='97'){assert.ok(prompts[0].includes('1.7–2.17s: Glance'));assert.ok(prompts[0].includes('2.17–2.5s: Return'));}
 if(number==='98'){assert.ok(prompts[0].includes('2.07–2.23s: Briefly close the eyes again'));assert.ok(prompts[0].includes('2.23–2.4s: Lower the magenta-cased phone'));assert.ok(prompts[0].includes('2.4–3.63s: The unseen hand brings'));}
 if(number==='100'){for(const range of ['0.27–0.51s','0.51–0.67s','0.73–0.92s'])assert.ok(prompts[0].includes(range));}

 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} retained ${phrase}`);}
});
