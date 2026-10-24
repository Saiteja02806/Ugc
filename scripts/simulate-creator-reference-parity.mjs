import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {getCreatorAccounts,getCreatorAccountText,getCreatorAccountSource,readCreatorStartingFrame,creatorAccountDirections} from '../lib/explore/creator-accounts.ts';
import {getHookSourceFrame} from '../lib/explore/hook-source-frame.ts';
import {getCuratedHookFrame} from '../worker/src/lib/hook-curated-frames.ts';
import {createHookKeyframeDraft,updateHookKeyframeDraft,hookKeyframeInputKey,recordHookKeyframeImage,approveHookKeyframeImage,serializeHookKeyframeDraft,readHookKeyframeDraft} from '../lib/explore/hook-keyframe-draft.ts';
import {createHookKeyframeCheckpoint,verifiedHookKeyframeJob} from '../lib/explore/hook-keyframe-client.ts';
import {getHookKeyframePromptPreview} from '../lib/explore/hook-keyframe-prompt-preview.ts';
import {parseHookKeyframeGenerationReceipt,hookKeyframeGenerationInputKey,hookKeyframePromptSha256,isHookKeyframeImageInput,hookKeyframeProviderImageLabels} from '../worker/src/lib/hook-keyframe-generation-contract.ts';
import {creatorSceneCanonicalUrl,resolveCreatorSceneDelivery} from '../worker/src/lib/creator-scene-delivery.ts';
import {GET as providerScene} from '../app/api/explore/creator-scene/[...path]/route.ts';
import {ReferenceTextSchema} from '../lib/explore/reference-text.ts';
import {resolveRemixSource} from '../lib/explore/remix-source.ts';

globalThis.fetch=async()=>assert.fail('No provider, database, or live network call is allowed');
process.env.CREATOR_REFERENCE_SIGNING_SECRET='offline-audit-only-test-key-at-least-32-characters';
const actor={uid:'audit-owner',email:'vtu19403@veltech.edu.in',emailVerified:true};
const uuid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const candidates=getCreatorAccounts(actor).flatMap(account=>account.items.map(item=>({...getCreatorAccountSource(item.id).startingFrame,referenceId:item.id})));fs.mkdirSync('.tmp/creator-parity-audit',{recursive:true});
const report=[];
for(const account of getCreatorAccounts(actor))for(const item of account.items){
 const frame=await getHookSourceFrame(item.id),scope={ownerId:actor.uid,draftId:uuid(1),referenceId:item.id,sourceSha256:item.sourceSha256};
 assert.equal(frame.sourceSha256,item.sourceSha256);
 const directions=[];
 for(const imageModel of ['gemini_3_pro','nano_banana_2','seedream_5_pro']){
  let draft=updateHookKeyframeDraft(createHookKeyframeDraft(scope),{imageModel,sourceFrame:{index:frame.frameIndex,timeSeconds:frame.frameTimeSeconds,sha256:frame.frameSha256,width:frame.width,height:frame.height},imageAssetIds:[uuid(2)],instructions:'Keep the approved scene.'});
  const preview=getHookKeyframePromptPreview(draft,'hook',item.generationPrompt);assert.equal(preview.animationError,null);assert.ok(preview.animationPrompt);
  const partial={version:draft.version,imageModel,ownerId:actor.uid,draftId:scope.draftId,referenceId:item.id,sourceSha256:item.sourceSha256,sourceFrame:draft.sourceFrame,personImageAssetIds:draft.imageAssetIds,instructions:draft.instructions};
  const receipt={...partial,purpose:'hook_starting_frame',promptVersion:4,inputKey:hookKeyframeGenerationInputKey(partial),promptSha256:hookKeyframePromptSha256(preview.imagePrompt)};
  assert.ok(parseHookKeyframeGenerationReceipt(receipt));
  const scene=creatorSceneCanonicalUrl(receipt),urls=[scene,'https://owned.example/face.png'];assert.ok(isHookKeyframeImageInput({receipt,ownerId:actor.uid,model:imageModel,aspectRatio:'9:16',prompt:preview.imagePrompt,referenceImageUrl:scene,referenceImageUrls:urls}));
  const response=await providerScene(new Request(resolveCreatorSceneDelivery(scene,receipt)));assert.equal(response.status,200);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),frame.frameSha256);
  const checkpoint=createHookKeyframeCheckpoint(draft,uuid(3));
  const job=verifiedHookKeyframeJob({id:uuid(4),status:'completed',isTerminal:true,error:null,receipt,output:{mediaAssetId:uuid(5),url:'https://owned.example/generated.png',width:720,height:1280}},checkpoint);
  draft=recordHookKeyframeImage(draft,{assetId:job.output.mediaAssetId,inputKey:hookKeyframeInputKey(draft),promptVersion:4});draft=approveHookKeyframeImage(draft);
  assert.equal(readHookKeyframeDraft(serializeHookKeyframeDraft(draft),scope).approval.assetId,uuid(5));
  assert.ok(hookKeyframeProviderImageLabels(1,4)[0].includes('VISUAL_REFERENCE'));
  directions.push({imageModel,imagePromptCharacters:preview.imagePrompt.length,motionPromptCharacters:preview.animationPrompt.length,sourceMatched:preview.sourceMatched,frameReceiptVersion:receipt.version,providerSceneMatches:true,approvalRoundTrip:true});
 }
 const original=getCreatorAccountSource(item.id),legacyFrame=await readCreatorStartingFrame(item.id,original.posterSha256);
 assert.equal(legacyFrame.frame.index,0);assert.equal(legacyFrame.frame.sha256,original.posterSha256);
 const legacyPartial={version:2,imageModel:'gemini_3_pro',ownerId:actor.uid,draftId:scope.draftId,referenceId:item.id,sourceSha256:item.sourceSha256,sourceFrame:legacyFrame.frame,personImageAssetIds:[uuid(2)],instructions:''};
 const legacyReceipt={...legacyPartial,purpose:'hook_starting_frame',promptVersion:4,inputKey:hookKeyframeGenerationInputKey(legacyPartial),promptSha256:'a'.repeat(64)};
 assert.ok(parseHookKeyframeGenerationReceipt(legacyReceipt));
 const legacyResponse=await providerScene(new Request(resolveCreatorSceneDelivery(creatorSceneCanonicalUrl(legacyReceipt),legacyReceipt)));assert.equal(legacyResponse.status,200);
 assert.equal(createHash('sha256').update(Buffer.from(await legacyResponse.arrayBuffer())).digest('hex'),original.posterSha256);
 assert.ok(creatorAccountDirections(item.id,item.sourceSha256,0,original.posterSha256));
 const caption=ReferenceTextSchema.parse(getCreatorAccountText(item.id,actor));assert.equal(caption.sourceSha256,item.sourceSha256);
 assert.equal(getCreatorAccountText(item.id,{...actor,email:'other@example.com'}),null);
 assert.equal(resolveRemixSource({format:'hook',referenceId:item.id,sourceUrl:'blob:old-browser'},[{...item,videoUrl:'blob:new-browser'}],'hook').reference.id,item.id);
 const candidate=candidates.find(x=>x.referenceId===item.id),raw={version:3,imageModel:'gemini_3_pro',ownerId:actor.uid,draftId:scope.draftId,referenceId:item.id,sourceSha256:item.sourceSha256,sourceFrame:{index:candidate.index,timeSeconds:candidate.timeSeconds,sha256:candidate.sha256,width:candidate.width,height:candidate.height},personImageAssetIds:[uuid(2)],instructions:'Keep the approved scene.'};
 const trial={...raw,purpose:'hook_starting_frame',promptVersion:4,inputKey:hookKeyframeGenerationInputKey(raw),promptSha256:'a'.repeat(64)};
 report.push({referenceId:item.id,actualFrameIndex:frame.frameIndex,actualFrameSha256:frame.frameSha256,curatedFrameRegistered:Boolean(getCuratedHookFrame(item.id,item.sourceSha256)),recommendedFrameIndex:candidate.index,recommendedFrameAcceptedByWorker:Boolean(parseHookKeyframeGenerationReceipt(trial)),captionCharacters:caption.blocks[0].text.length,models:directions});
}
const summary={ranAt:new Date().toISOString(),networkCalls:0,paidCalls:0,references:report.length,modelScenarios:report.reduce((n,x)=>n+x.models.length,0),results:report};
fs.writeFileSync('.tmp/creator-parity-audit/simulation.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({references:summary.references,modelScenarios:summary.modelScenarios,nonzeroRecommendations:report.filter(x=>x.recommendedFrameIndex>0).length,registeredPrivateFrames:report.filter(x=>x.curatedFrameRegistered).length,acceptedRecommendedFrames:report.filter(x=>x.recommendedFrameAcceptedByWorker).length,networkCalls:0,paidCalls:0}));
