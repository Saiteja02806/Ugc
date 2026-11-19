import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getHookReferenceReleaseItems} from '../worker/src/lib/explore-hook-reference-release.ts';
import {canonicalHookSource} from '../worker/src/lib/explore-instagram-source.ts';
import {getRecreateReference,getRecreateReferences} from '../lib/explore/recreate-catalog.ts';
import {getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
import release from '../worker/src/lib/explore-hook-notbeen3-release.json' with {type:'json'};
import motion from '../lib/explore/hook-notbeen3-motion.json' with {type:'json'};
import text from '../lib/explore/hook-notbeen3-text.json' with {type:'json'};
import frames from '../lib/explore/talking-head-frames.json' with {type:'json'};
import {validateHookAdditionRelease} from './hook-reference-addition-release-readiness.mjs';
import {getReclassifiedHookMotionReview,hookMotionPlanDirections,buildHookAnimationPrompt} from '../lib/explore/hook-keyframe-motion.ts';
import {getTalkingHeadReferences} from '../lib/explore/talking-head-reference-catalog.ts';
import {getTalkingHeadScript} from '../lib/explore/talking-head-script-store.ts';
import {getAdditionalStartingFrameSources} from '../lib/explore/starting-frame-reference-source.ts';
import {createHookOpeningSourceFrameService,decodeHookFirstFrame} from '../lib/explore/hook-source-frame.ts';
import {createStoredHookFrames,hookSourceFrameIndexKey} from '../lib/explore/hook-source-frame-store.ts';
import {hookKeyframeSnapshotKey} from '../worker/src/lib/hook-keyframe-generation-contract.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
import {buildTalkingHeadPromptExport} from '../lib/explore/talking-head-prompt.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
const additions=[['talking-nicki-kitchen-reaction','Oh my gosh, are you kidding me?'],['talking-lowlight-instagram-what','What?']];

test('notbeen3 Hook media and captions are hash-bound and all staged motion plans compile',()=>{
 assert.equal(release.items.length,7);
 const ready=validateHookAdditionRelease(release,text);assert.equal(ready.eligible.length,7);
 const existing=getHookReferenceReleaseItems().filter(old=>!release.items.some(item=>item.id===old.id));
 for(const item of release.items){
  assert.equal(existing.some(old=>old.id===item.id || old.videoSha256===item.videoSha256 || canonicalHookSource(old.sourceUrl??old.instagramUrl)?.url===item.sourceUrl),false,"Do not add a second card for an existing post");
  const published=getRecreateReference(item.id);assert.ok(published,"Published card must resolve");
  assert.ok(getReferenceVideoPrompt(item.id,published.videoUrl).includes(motion.entries.find(r=>r.referenceId===item.id).plan.endingState));
  const entry=motion.entries.find(r=>r.referenceId===item.id);assert.equal(entry.sourceSha256,item.videoSha256);
  const review=getReclassifiedHookMotionReview(item.id,item.videoSha256,0,release.items);assert.ok(review?.candidatePlan);
  const directions=hookMotionPlanDirections(review.candidatePlan);const prompt=buildHookAnimationPrompt({directions,durationSeconds:Math.ceil(item.durationSeconds),actionDurationSeconds:item.durationSeconds,generateAudio:false,maxDurationSeconds:30});assert.ok(prompt.includes(entry.plan.endingState));
  assert.equal(getReclassifiedHookMotionReview(item.id,'a'.repeat(64),0,release.items),undefined);
  assert.equal(getReclassifiedHookMotionReview(item.id,item.videoSha256,1,release.items),undefined);
  assert.doesNotMatch(directions,/\d+\s*%|\bmomentum\b/i);
 }
});

test('new Talking Heads resolve in their own gallery with matching speech and source-specific Recreate prompts',()=>{
 for(const [id,words]of additions){
  const row=getTalkingHeadReferences().find(r=>r.id===id),source=getTalkingHeadScript(id),frame=frames.items.find(r=>r.id===id);assert.ok(row&&frame);
  assert.equal(sha(readFileSync('public'+row.videoUrl)),row.sourceSha256);assert.equal(source.sourceSha256,row.sourceSha256);assert.equal(source.hookText,words);assert.equal(frame.sourceSha256,row.sourceSha256);assert.ok(row.durationSeconds<4);
  const draft=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:id,sourceSha256:row.sourceSha256}),{sourceFrame:{index:0,timeSeconds:0,width:frame.width,height:frame.height,sha256:frame.frameSha256},generateAudio:true});
  const preview=getHookKeyframePromptPreview(draft,'talking_head');assert.equal(preview.animationError,null);assert.ok(preview.animationPrompt.includes(words));assert.ok(preview.animationPrompt.includes('Start with its pose and composition'));
  const exportPrompt=buildTalkingHeadPromptExport({script:'My business words.',sourceReviewed:true,sceneDirections:preview.directions,selectionSha256:source.selectionSha256,hookEndMs:source.hookEndMs});assert.ok(exportPrompt.text.includes('My business words.'));assert.ok(exportPrompt.text.includes('overrides any conflicting dialogue'));
  assert.equal(release.items.some(r=>r.id===id),false);
 }
});

test('new prepared Talking Head openings match decoded source0 and load cold without decoding MP4',async()=>{
 const sources=getAdditionalStartingFrameSources();
 for(const[id]of additions){
  const frame=frames.items.find(r=>r.id===id),source=sources.find(r=>r.id===id);assert.equal(source.videoSha256,frame.sourceSha256);const png=readFileSync('public'+frame.path);assert.equal(sha(png),frame.frameSha256);
  const decoded=await decodeHookFirstFrame(readFileSync('public'+source.localFile));assert.ok(decoded.equals(png));
  const index={version:1,extractor:'frame0-png-v1',sourceSha256:frame.sourceSha256,frameSha256:frame.frameSha256,width:frame.width,height:frame.height};const key=hookKeyframeSnapshotKey({sourceSha256:frame.sourceSha256,sourceFrame:{index:0,timeSeconds:0,sha256:frame.frameSha256,width:frame.width,height:frame.height}});const objects=new Map([[hookSourceFrameIndexKey(frame.sourceSha256),Buffer.from(JSON.stringify(index))],[key,png]]);
  const store=createStoredHookFrames({read:async k=>objects.get(k)??null,create:async()=>assert.fail('Cold read must not write')});
  const opening=createHookOpeningSourceFrameService({items:()=>[source],readStoredFrame:store.read,download:async()=>assert.fail('Must not download MP4'),decode:async()=>assert.fail('Must not decode MP4')});const result=await opening(id);assert.equal(result.frameSha256,frame.frameSha256);assert.equal(result.frameTimeSeconds,0);
 }
});

test('activated notbeen3 references appear only in the correct galleries with their own latest New batches',()=>{
 const hooks=getRecreateReferences().filter(r=>r.format==='hook');
 assert.equal(hooks.length,129);
 assert.deepEqual(new Set(hooks.filter(r=>r.isNew).map(r=>r.id)),new Set(release.items.map(r=>r.id)));
 for(const row of release.items)assert.equal(hooks.filter(r=>r.id===row.id).length,1);
 const talking=getTalkingHeadReferences();
 assert.deepEqual(new Set(talking.filter(r=>r.isNew).map(r=>r.id)),new Set(additions.map(([id])=>id)));
 assert.equal(talking.some(r=>release.items.some(h=>h.id===r.id)),false);
 assert.equal(hooks.some(r=>additions.some(([id])=>id===r.id)),false);
});
