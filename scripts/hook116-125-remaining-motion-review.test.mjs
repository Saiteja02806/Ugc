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
 116:{include:['Put the glasses on and leave them on through the ending','glasses and one eye fill the frame']},
 117:{include:['Bring the eyes nearer the lens and hold','Return the eyes toward the laptop on screen-left','release it onto the desk beside the notebook','The pen stays on the desk','back of that hand visible','mouth parted and brows drawn'],exclude:['Lift the pen-holding hand slightly','Keep the pen with the other hand until it leaves view']},
 121:{include:['Lower the screen-right hand from the chin','Hold the open mouth and the direct look','mouth open, the eyes toward the lens']},
 123:{include:['upper lids to thin slits','close the eyelids again through the final frame','eyelids finish closed']},
 124:{include:['form it only this once','Leave the glasses off','eyes look down']},
 125:{include:['form it only this once','squinting smile on a smaller face']}
};
for(const [number,{include,exclude=[]}]of Object.entries(checks))test(`Hook ${number}: source-reviewed performance reaches both Recreate prompt consumers`,()=>{
 const r=getHookReferenceReleaseItems().find(r=>r.title===`Hook ${number}`);assert.ok(r);
 const card=getRecreateReference(r.id);assert.ok(card);
 const prompts=[getReferenceVideoPrompt(r.id,card.videoUrl)];
 if(number==='116')for(const time of ['2.27–2.37s:','2.37–3s:'])assert.ok(prompts[0].includes(time),time);
 if(number==='117')for(const time of ['1.5–1.9s:','1.9–2.17s:','2.17–2.57s:','2.57–2.9s:'])assert.ok(prompts[0].includes(time),time);
 if(number==='123')for(const time of ['0.53–0.7s:','1.3–1.47s:'])assert.ok(prompts[0].includes(time),time);
 if(number==='121'){assert.equal(r.durationSeconds,2.6);assert.equal(r.videoSha256,'8caa12e6de5bc31c4d5393369bb6635dde87918dc2e146ac048b286afee56cf4');}
 for(const duration of [r.durationSeconds,undefined]){
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:r.id,sourceSha256:r.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:r.width,height:r.height,sha256:'a'.repeat(64)},generateAudio:false});
  const preview=getHookKeyframePromptPreview(draft,'hook',undefined,undefined,undefined,duration);
  assert.equal(preview.animationError,null);assert.equal(preview.canSubmitPaidAnimation,false);assert.equal(preview.sourceMatched,true);prompts.push(preview.animationPrompt);
 }
 for(const prompt of prompts){assert.ok(prompt);for(const phrase of include)assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),`Hook ${number} lost ${phrase}`);for(const phrase of exclude)assert.ok(!prompt.includes(phrase),`Hook ${number} retained ${phrase}`);if(number==='123')assert.equal((prompt.match(/upper lids to thin slits/g)??[]).length,2);}
});
