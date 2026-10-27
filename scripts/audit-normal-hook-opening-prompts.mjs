/** Offline prompt audit. Does not rewrite catalogues or call providers. */
import { writeFile } from 'node:fs/promises';
import { getHookReferenceGalleryItems } from '../worker/src/lib/explore-hook-reference-release.ts';
import { getCuratedHookFrame } from '../worker/src/lib/hook-curated-frames.ts';
import { hookKeyframeMotionCatalog, hookKeyframeMotionRewrites, getHookKeyframeMotionReviewDraft, hookMotionPlanDirections, buildHookAnimationPrompt } from '../lib/explore/hook-keyframe-motion.ts';
import { createHookKeyframeDraft, updateHookKeyframeDraft } from '../lib/explore/hook-keyframe-draft.ts';
import { getHookKeyframePromptPreview } from '../lib/explore/hook-keyframe-prompt-preview.ts';
import { getCreatorAccounts, getCreatorAccountSource } from '../lib/explore/creator-accounts.ts';
import { readCreatorPrivateJson } from '../lib/explore/creator-private-files.ts';
const output=process.argv[2];if(!output)throw Error('Supply explicit audit output path');
const user={email:'vtu19403@veltech.edu.in',emailVerified:true};
const rows=[];
for(const item of getHookReferenceGalleryItems().filter(i=>!getCuratedHookFrame(i.id,i.videoSha256))){
 const evidence=hookKeyframeMotionCatalog[item.id],rewrite=hookKeyframeMotionRewrites[item.id];
 const scope={ownerId:'offline-audit',draftId:'11111111-1111-4111-8111-111111111111',referenceId:item.id,sourceSha256:item.videoSha256};
 const draft=createHookKeyframeDraft(scope),preview=getHookKeyframePromptPreview(draft);
 const imagePreview=getHookKeyframePromptPreview(updateHookKeyframeDraft(draft,{imageAssetIds:['22222222-2222-4222-8222-222222222222']}));
 if(!imagePreview.imagePrompt||!imagePreview.imagePrompt.includes('Image 1')||!imagePreview.imagePrompt.includes('Image 2'))throw Error('Normal image role contract unavailable');
 const plan=getHookKeyframeMotionReviewDraft(item.id,item.videoSha256,0)?.candidatePlan;
 const directions=plan?hookMotionPlanDirections(plan):'';
 const compilations=[3,4,8,10].map(duration=>{try{const prompt=buildHookAnimationPrompt({directions,durationSeconds:duration,generateAudio:false});return{duration,status:'compiles',characters:prompt.length,declaresOutputDuration:prompt.includes(`${duration}-second video`),hasNumericActions:/PHASE \[|(?:\d+(?:\.\d+)?)\s*[–-]\s*(?:\d+(?:\.\d+)?)s:/.test(directions)};}catch(error){return{duration,status:'blocked',message:error.message};}});
 const custom=updateHookKeyframeDraft(draft,{motionInstructions:'My deliberate slow gaze and small blink.'});
 rows.push({dataset:'public',referenceId:item.id,currentTitle:item.title,sourceSha256:item.videoSha256,sourceDurationSeconds:item.durationSeconds,sourceHashMatchesEvidence:evidence?.sourceSha256===item.videoSha256,sourceHashMatchesRewrite:rewrite?.sourceSha256===item.videoSha256,status:rewrite?.review.status??'missing',issues:rewrite?.review.issues??[],openingDefined:Boolean(plan?.openingState),endingDefined:Boolean(plan?.endingState),cameraDefined:Boolean(plan?.camera),numericActionTimeline:compilations.some(c=>c.hasNumericActions),imagePromptCharacters:imagePreview.imagePrompt.length,imagePromptHasLaterAnchorRole:/CLARITY ANCHOR|Image 3 is the selected influencer/.test(imagePreview.imagePrompt),phaseCount:plan?.beats.length??0,previewBlocked:Boolean(preview.animationError||preview.requiresDecision),previewDurationSeconds:preview.durationSeconds,customTextPreserved:getHookKeyframePromptPreview(custom).directions===custom.motionInstructions,compilations,visualQualification:'not_tested'});
}
const reviews=readCreatorPrivateJson('creator-account-reviews.json',{items:[]});
for(const item of getCreatorAccounts(user).flatMap(a=>a.items).filter(i=>i.startingFrame.index===0)){
 const source=getCreatorAccountSource(item.id),review=reviews.items.find(r=>r.id===item.id);
 const compilations=[3,4,8,10].map(duration=>{try{return{duration,status:'compiles',characters:buildHookAnimationPrompt({directions:item.generationPrompt,durationSeconds:duration,generateAudio:false}).length};}catch(error){return{duration,status:'blocked',message:error.message};}});
 rows.push({dataset:'private',referenceId:item.id,currentTitle:item.id,sourceSha256:item.sourceSha256,sourceDurationSeconds:item.durationSeconds,sourceHashMatchesEvidence:review?.sourceSha256===source.sourceSha256,status:'legacy_four_sample_review',numericActionTimeline:/PHASE \[|\d+\s*[–-]\s*\d+s:/.test(item.generationPrompt),compilations,visualQualification:'not_tested'});
}
if(rows.filter(r=>r.dataset==='public').length!==83||rows.filter(r=>r.dataset==='private').length!==2)throw Error('Normal-case inventory changed');
const result={date:'2026-10-26',method:'Current source/hash-bound plan and actual prompt compiler audit. Fresh visual inspection is separately recorded; structural compilation is not visual fidelity.',publicCount:83,privateCount:2,publicReviewed:rows.filter(r=>r.dataset==='public'&&r.status==='static_reviewed').length,publicNeedsDecision:rows.filter(r=>r.status==='needs_decision').length,numericActionTimelines:rows.filter(r=>r.numericActionTimeline).length,providerCalls:0,rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({publicCount:result.publicCount,privateCount:result.privateCount,publicReviewed:result.publicReviewed,publicNeedsDecision:result.publicNeedsDecision,numericActionTimelines:result.numericActionTimelines,sourceHashMismatches:rows.filter(r=>r.sourceHashMatchesEvidence===false||r.sourceHashMatchesRewrite===false).length,manualEditsPreserved:rows.filter(r=>r.dataset==='public').every(r=>r.customTextPreserved),output}));
