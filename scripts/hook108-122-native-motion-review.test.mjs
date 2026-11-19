import assert from 'node:assert/strict';
import test from 'node:test';
import {getHookReferenceReleaseItems} from '../worker/src/lib/explore-hook-reference-release.ts';
import {getRecreateReference} from '../lib/explore/recreate-catalog.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
process.env.GCP_STORAGE_BUCKET??='ugcsaas-media';process.env.GCP_STORAGE_PUBLIC_BASE_URL??='https://storage.googleapis.com/ugcsaas-media';
const checks={
 108:{include:['same hand continuous from the temple to the mouth','upper lids stay down and the gaze stays lowered']},
 109:{include:['both shoulders remain visible','fingers ease to the side of the nose and the upper lip','smile shows beside the fingers'],exclude:['shoulders leave','shoulders have left']},
 110:{include:['blue chair edge still in view','eyes looking slightly upward','jaw still open'],exclude:['shoulders and the chair leave']},
 111:{include:['hoodie-covered shoulders remain visible','mouth opens into a wide smile','eyes return to the lens'],exclude:['shoulders leave']},
 118:{include:['shoulders and upper chest remain visible','chest square to the lens','back of the screen-right hand across the mouth'],exclude:['shoulders leave']},
 119:{include:['Bring the eyes toward the lens and hold them wide','laptop is gone','eyes stay wide above it']},
 120:{include:['palm below the mouth','shoulder edges still visible','eyes slightly screen-right of the lens','small smile'],exclude:['palm stays against the mouth','shoulders leave','face fills the frame']},
 122:{include:['eyes are open again and settle toward the lens','mouth is slightly open','tablet is gone']}
};
for(const [number,{include,exclude=[]}]of Object.entries(checks))test(`Hook ${number}: native-reviewed crop and performance reach both Recreate consumers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];
 if(number==='118')assert.ok(prompts[0].includes('0.47–2s:'));
 if(number==='119')assert.ok(prompts[0].includes('0.73–1.5s:'));
 if(number==='120')for(const time of ['0.17–0.47s:','0.9–1.3s:','1.3–1.7s:'])assert.ok(prompts[0].includes(time),time);
 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const p=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);assert.equal(p.animationError,null);assert.equal(p.sourceMatched,true);assert.equal(p.canSubmitPaidAnimation,false);prompts.push(p.animationPrompt);
 }
 for(const p of prompts){assert.ok(p);for(const phrase of include)assert.ok(p.toLowerCase().includes(phrase.toLowerCase()),`${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!p.toLowerCase().includes(phrase.toLowerCase()),`${number} retained ${phrase}`);}
});
