import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import path from 'node:path';
import {createJiti} from 'jiti';
const root=process.cwd(),dir=path.join(root,'.tmp/carousel-quality-experiment-2026-10-12');
const r=JSON.parse(readFileSync(path.join(dir,'results.json'),'utf8'));
if(!r.completedAt)throw new Error('Live run still in progress');
globalThis.fetch=async()=>{throw new Error('Analysis must remain offline');};
const jiti=createJiti(import.meta.url,{fsCache:false});
const s1=await jiti.import(path.join(dir,'control/worker/src/lib/carousel-llm-slide-plan.ts'));
const evidence=[];
const failed=[];
const visible=s=>[s.headline,s.body,...(s.listItems??s.list??[]),s.storyText,s.ctaText??s.cta].filter(Boolean).join('\n\n');
const summary=r.arms.flatMap(arm=>['structure_1','structure_2'].map(structure=>{
 const runs=r.runs.filter(x=>x.arm===arm&&x.structure===structure),calls=r.requests.filter(x=>x.arm===arm&&x.structure===structure),accepted=runs.flatMap(x=>x.accepted);
 return {arm,structure,requested:20,accepted:accepted.length,businesses:runs.map(x=>({business:x.business,accepted:x.accepted.length,requested:5,formats:x.assignments.map(a=>a.contentFormatId??a.storyFormatId)})),calls:calls.length,repairCalls:calls.filter(x=>!['carousel_content_batch','carousel_structure_2_story_batch'].includes(x.schema)).length,acceptedRepaired:accepted.filter(p=>p.validation?.repaired).length,tokens:calls.reduce((n,q)=>n+(q.usage?.total_tokens??0),0),observedBatchSeconds:runs.map(x=>({business:x.business,seconds:(Date.parse(x.completedAt)-Date.parse(x.startedAt))/1000})),firstPersonCovers:accepted.filter(p=>/\b(i|my|me)\b/i.test(p.slides[0].body??p.slides[0].headline??'')).length,personalBodyStories:accepted.filter(p=>p.slides.slice(1,5).some(s=>/\b(i|my|me)\b/i.test(s.body??''))).length};
}));
const samples=['# Live comparison samples — 12 October 2026','Three arms: current local writer, explicit evidence plus reader-scenario policy, and that policy plus lesson planning. These are actual provider outputs. Accepted text passed the relevant planner; no images or posts were generated. Editorial review is by the AI agent, not a human panel or TikTok audience.'];
for(const b of r.businesses)for(const structure of ['structure_1','structure_2'])for(const arm of r.arms){
 const run=r.runs.find(x=>x.business===b.id&&x.structure===structure&&x.arm===arm);
 samples.push('## '+[b.businessName,structure,arm].join(' / '),'Delivered: '+run.accepted.length+'/5.');
 for(const p of run.accepted){samples.push('### Accepted slot '+p.slot+' — '+p.format);for(const s of p.slides)samples.push('**Slide '+s.n+'**',visible(s));evidence.push({business:b.id,structure,arm,slot:p.slot,format:p.format,slides:p.slides});}
 for(const f of run.failures)failed.push({business:b.id,arm,structure,slot:f.slotIndex??null,error:f.message??f.error,issues:f.issues??null});
 if(structure==='structure_1'){
  const q=r.requests.find(q=>q.business===b.id&&q.arm===arm&&q.structure===structure&&q.schema==='carousel_content_batch'&&q.attempt===1&&q.response);
  if(q){const raw=JSON.parse(q.response);samples.push('### Initial drafts (not delivered unless separately accepted above)');for(const item of raw.items??[]){if(!item.plan){samples.push('Slot '+item.slotIndex+': '+item.status);continue;}const issues=s1.validateCarouselContentPlan(item.plan,b);samples.push('#### Draft slot '+item.slotIndex+' — '+(item.plan.contentStrategy?.contentFormatId??'unknown'),'Validation flags: '+[...new Set(issues.map(x=>x.code))].join(', '));for(const s of item.plan.slides)samples.push('**Slide '+s.slideNumber+'**',visible(s));}}
 }
}
const grammar=[];
for(const q of r.requests.filter(q=>q.structure==='structure_1'&&q.response)){
 let raw;try{raw=JSON.parse(q.response);}catch{continue;}
 const plans=q.schema==='carousel_content_batch'?(raw.items??[]).filter(x=>x.plan).map(x=>({slot:x.slotIndex,plan:x.plan})):raw.slides?[{slot:null,plan:raw}]:[];
 for(const p of plans){let issues;try{issues=s1.validateCarouselContentPlan(p.plan,r.businesses.find(b=>b.id===q.business));}catch(e){issues=[{code:'schema',message:e.message}];}grammar.push({request:q.index,business:q.business,arm:q.arm,attempt:q.attempt,slot:p.slot,issues});}
}
const setup=JSON.parse(readFileSync(path.join(dir,'setup-aborted-results.json'),'utf8'));
const duplicateSlides=[];
for(const business of r.businesses)for(const arm of r.arms){const groups=new Map();for(const p of evidence.filter(p=>p.business===business.id&&p.arm===arm&&p.structure==='structure_2'))for(const s of p.slides.slice(1)){const text=(s.body??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(!text)continue;groups.set(text,[...(groups.get(text)??[]),{slot:p.slot,slide:s.n}]);}for(const [text,occurrences] of groups)if(new Set(occurrences.map(x=>x.slot)).size>1)duplicateSlides.push({business:business.id,arm,text,occurrences});}
const metrics={startedAt:r.startedAt,completedAt:r.completedAt,versions:r.versions,summary,usage:r.usage,http200:r.requests.filter(x=>x.status===200).length,providerIds:r.requests.filter(x=>x.requestId&&x.completionId).length,transportErrors:r.requests.filter(x=>x.error).map(x=>({index:x.index,error:x.error})),unobservedInterruptedRequests:r.requests.filter(x=>!x.completedAt).map(x=>x.index),lengthFinishResponses:r.requests.filter(x=>x.finishReason==='length').map(x=>x.index),sourceVerification:r.sourceVerification,setupInterruption:{initiatedCalls:setup.requests.length,completedResponses:setup.requests.filter(x=>x.status===200).length,recordedTokens:setup.requests.reduce((n,x)=>n+(x.usage?.total_tokens??0),0),unobservedInFlightCalls:setup.requests.filter(x=>!x.completedAt).length,note:'Stopped before Structure 2 ran; kept separate from comparison outcomes. In-flight provider usage is not known.'},resume:r.resume?{...r.resume,previousRuns:undefined}:null,duplicateSlides,failures:failed,structure1DraftValidation:grammar,editorialMethod:'AI-agent reading of all 44 accepted stories plus rejected draft examples, not blinded human preference or measured social performance.'};
writeFileSync(path.join(root,'docs/carousel-copy-comparison-metrics-2026-10-12.json'),JSON.stringify(metrics,null,2));
writeFileSync(path.join(root,'docs/carousel-copy-comparison-samples-2026-10-12.md'),samples.join('\n\n'));
copyFileSync(path.join(dir,'results.json'),path.join(root,'docs/carousel-copy-comparison-provider-evidence-2026-10-12.json'));
writeFileSync(path.join(dir,'accepted-review.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({summary,usage:r.usage,sourceVerification:r.sourceVerification,failures:failed.length,setupInterruption:metrics.setupInterruption},null,2));
