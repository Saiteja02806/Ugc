/* Reviewer-only follow-up: no draft regeneration, no runtime invocation. */
import fs from "node:fs";
import path from "node:path";
import { createHash,randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { HookRemixReviewSchema,hookRemixReviewPayload,acceptHookRemixReview } from "../lib/explore/hook-remix-quality.ts";
import { HOOK_REMIX_CALIBRATED_REVIEW_VERSION,HOOK_REMIX_CALIBRATED_REVIEW_PROMPT } from "../lib/explore/hook-remix-quality-policy.ts";
import { assessHookRemixFixture } from "../lib/explore/hook-remix-eval.ts";

const mode=process.argv[2];
if(process.argv.length!==3||!["--prepare","--run"].includes(mode))throw Error("Use --prepare or the separately authorized --run for 23 reviewer calls.");
const original=JSON.parse(fs.readFileSync("docs/hook-remix-quality-pilot-results-2026-10-24.json","utf8"));
const fixture=JSON.parse(fs.readFileSync("lib/explore/fixtures/hook-remix-quality-v1.json","utf8"));
const cases=original.results.filter(row=>row.draft.state==="completed").map(row=>({...row,
  expect:fixture.cases.find(test=>test.id===row.id).expect,
  reviewerUser:hookRemixReviewPayload(row.source,row.context,row.instructions,row.draft.output)}));
if(cases.length!==23)throw Error("Expected 23 completed original drafts. The unresolved draft must not be resubmitted.");
const inputs={model:original.model,reasoning:"medium",maxCompletionTokens:4000,reviewVersion:HOOK_REMIX_CALIBRATED_REVIEW_VERSION,reviewSystem:HOOK_REMIX_CALIBRATED_REVIEW_PROMPT,cases};
const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dir=path.resolve(".tmp/hook-remix-quality-calibrated-v2"),file=path.join(dir,"manifest.json");
const write=(target,value)=>fs.writeFileSync(target,JSON.stringify(value,null,2)+"\n");
fs.mkdirSync(dir,{recursive:true});
let manifest;
if(fs.existsSync(file)){manifest=JSON.parse(fs.readFileSync(file,"utf8"));if(manifest.inputDigest!==hash(inputs))throw Error("Frozen follow-up inputs changed; existing requests cannot be replayed.");}
else {manifest={createdAt:new Date().toISOString(),inputDigest:hash(inputs),...inputs,requests:cases.map(row=>({caseId:row.id,requestId:randomUUID(),state:"planned"}))};write(file,manifest);}
if(mode==="--prepare")console.log(JSON.stringify({cases:23,additionalMaxProviderCalls:23,originalDraftsReused:true,inputDigest:manifest.inputDigest}));
else {
  nextEnv.loadEnvConfig(process.cwd());
  if(!process.env.OPENAI_API_KEY?.trim())throw Error("Existing configured credential unavailable; no request sent.");
  const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:60000});
  for(const request of manifest.requests){
    if(request.state==="completed")continue;
    if(request.state!=="planned")throw Error("Existing unresolved follow-up must not be automatically repeated.");
    const row=cases.find(item=>item.id===request.caseId);
    Object.assign(request,{state:"uncertain",startedAt:new Date().toISOString()});write(file,manifest);
    const start=Date.now();
    try {
      // Save the raw response before validating so malformed copy cannot erase request evidence.
      const completion=await ai.chat.completions.create({model:inputs.model,reasoning_effort:"medium",max_completion_tokens:4000,
        messages:[{role:"system",content:inputs.reviewSystem},{role:"user",content:row.reviewerUser}],
        response_format:zodResponseFormat(HookRemixReviewSchema,"hook_remix_review")},{headers:{"X-Client-Request-Id":request.requestId}});
      Object.assign(request,{state:"completed",completedAt:new Date().toISOString(),latencyMs:Date.now()-start,providerResponseId:completion.id,
        providerModel:completion.model,usage:completion.usage,finishReason:completion.choices[0]?.finish_reason,rawContent:completion.choices[0]?.message.content??null,refusal:completion.choices[0]?.message.refusal??null});
      write(file,manifest);
      try {
        request.output=HookRemixReviewSchema.parse(JSON.parse(request.rawContent));
        request.acceptance={accepted:true,...acceptHookRemixReview(request.output,row.source,row.context,row.instructions,row.draft.output)};
      }catch(error){request.acceptance={accepted:false,code:error.code??error.message};}
      write(file,manifest);
      console.log(JSON.stringify({case:row.id,accepted:request.acceptance.accepted,decision:request.output?.decision,output:request.output?.output,reason:request.output?.reason}));
    }catch(error){request.error={name:error.name,status:error.status??null,code:error.code??null};write(file,manifest);throw Error(`Follow-up ${request.requestId} unresolved; no automatic retry.`);}
  }
  const results=cases.map(row=>{
    const calibrated=manifest.requests.find(request=>request.caseId===row.id);
    return {...row,baselineCheckCorrected:assessHookRemixFixture(row.draft.output,row.source,row.expect),
      originalReviewCheckCorrected:assessHookRemixFixture(row.review.acceptance?.accepted?row.review.acceptance.output:null,row.source,row.expect),calibrated,
      calibratedCheck:assessHookRemixFixture(calibrated.acceptance?.accepted?calibrated.acceptance.output:null,row.source,row.expect)};
  });
  const summary={resolvedCases:23,originalUnresolvedDraft:1,additionalCompletedCalls:manifest.requests.filter(r=>r.state==="completed").length,
    baselinePass:results.filter(r=>r.baselineCheckCorrected.pass).length,originalReviewPassCorrected:results.filter(r=>r.originalReviewCheckCorrected.pass).length,
    calibratedPass:results.filter(r=>r.calibratedCheck.pass).length,calibratedBlocked:results.filter(r=>!r.calibrated.acceptance.accepted).length,
    calibratedDeliveredFailures:results.filter(r=>r.calibrated.acceptance.accepted&&!r.calibratedCheck.pass).length,
    baselinePassingRegressions:results.filter(r=>r.baselineCheckCorrected.pass&&!r.calibratedCheck.pass).map(r=>r.id),
    repairedBaselineFailures:results.filter(r=>!r.baselineCheckCorrected.pass&&r.calibratedCheck.pass).map(r=>r.id),
    totalTokens:manifest.requests.reduce((sum,r)=>sum+(r.usage?.total_tokens??0),0)};
  write("docs/hook-remix-quality-calibrated-results-2026-10-24.json",{createdAt:manifest.createdAt,completedAt:new Date().toISOString(),inputDigest:manifest.inputDigest,reviewSystem:inputs.reviewSystem,method:"23 additional reviewer-only calls on exact frozen drafts from the first pilot. No draft regeneration or replay of the unresolved source. Calibration examples target observed regressions; this is an in-sample comparison, not a held-out or production reliability estimate. One scorer bug corrected transparently; original artifacts unchanged.",model:inputs.model,summary,results});
  console.log(JSON.stringify(summary));
}
