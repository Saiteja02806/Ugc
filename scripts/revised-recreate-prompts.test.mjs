import assert from 'node:assert/strict';
import test from 'node:test';
import {getHookReferenceGalleryItems} from '../worker/src/lib/explore-hook-reference-release.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
import {getCreatorAccountSource,creatorAccountDirections} from '../lib/explore/creator-accounts.ts';
import {readCreatorPrivateJson} from '../lib/explore/creator-private-files.ts';

test('every active public reference selects a complete revised frame-zero timed prompt; saved edits win',()=>{
 const rows=getHookReferenceGalleryItems();assert.equal(rows.length,107);
 for(const row of rows){
  const d=updateHookKeyframeDraft(createHookKeyframeDraft({ownerId:'owner',draftId:'00000000-0000-4000-8000-000000000001',referenceId:row.id,sourceSha256:row.videoSha256}),{sourceFrame:{index:0,timeSeconds:0,width:row.width,height:row.height,sha256:'b'.repeat(64)}});
  const p=getHookKeyframePromptPreview(d,'hook',undefined,undefined,undefined,row.durationSeconds);
  assert.match(p.directions,/PHASE \[0(?:\.0+)?–/);assert.match(p.directions,/ENDING STATE:/);assert.equal(p.animationError,null,row.id);assert.ok(p.animationPrompt,row.id);
  assert.equal(getHookKeyframePromptPreview({...d,motionInstructions:'My exact edit.'}).directions,'My exact edit.');
  if(row.id==='explore-paired-hook-11f2baa840d10b65bc4c4dee'){
   assert.equal(p.requiresDecision,false);assert.deepEqual(p.decisionIssues,[]);assert.match(p.directions,/creator’s right hand/);assert.match(p.directions,/still holding the glasses/);
  }
 }
});

test('all twelve local private records resolve reviewed original-opening directions; invalid bindings cannot fall back',()=>{
 const reviews=readCreatorPrivateJson('creator-account-reviews.json',{items:[]});assert.equal(reviews.items.length,12,'requires local reviewed private package');
 for(const row of reviews.items){
  const source=getCreatorAccountSource(row.id);assert.ok(source);
  const directions=creatorAccountDirections(row.id,row.sourceSha256,0,source.posterSha256,true);
  assert.match(directions,/PHASE \[0(?:\.0+)?–/);assert.match(directions,/ENDING STATE:/);
  assert.equal(creatorAccountDirections(row.id,'f'.repeat(64),0,source.posterSha256,true),undefined);
  assert.equal(creatorAccountDirections(row.id,row.sourceSha256,0,'f'.repeat(64),true),undefined);
 }
});
