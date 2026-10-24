/* Explicit bounded experiment; never run by the normal test suite. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ReferenceTextSchema, RemixOutputSchema, validateRemixOutput } from "../lib/explore/reference-text.ts";
import { hookBrandRemixSystemPrompt } from "../lib/explore/hook-remix-brand-prompt.ts";
import { remixTextPrompt } from "../lib/explore/remix-text-prompt.ts";
import { HookRemixReviewSchema, HOOK_REMIX_REVIEW_PROMPT, hookRemixReviewPayload, acceptHookRemixReview } from "../lib/explore/hook-remix-quality.ts";

const mode=process.argv[2];
if(process.argv.length!==3||!["--prepare","--run","--continue-unaffected"].includes(mode))throw Error("Use --prepare, --run or --continue-unaffected for the bounded 48-call comparison.");
const dir=path.resolve(".tmp/hook-remix-quality-v1"),manifestFile=path.join(dir,"manifest.json");
const fixture=JSON.parse(fs.readFileSync("lib/explore/fixtures/hook-remix-quality-v1.json","utf8"));
const saved=JSON.parse(fs.readFileSync(".tmp/hook-remix-pilot-context.json","utf8"));
const hash=value=>createHash("sha256").update(typeof value==="string"?value:JSON.stringify(value)).digest("hex");
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");
const cases=fixture.cases.map(row=>{
  const context=fixture.contexts[row.context].savedContextFile?saved.business_context:fixture.contexts[row.context];
  const source=ReferenceTextSchema.parse({referenceId:`eval:${row.id}`,slideId:null,sourceSha256:hash(row.blocks),format:"hook",status:"ready",
    blocks:row.blocks.map((text,index)=>({text,startMs:index*4000/row.blocks.length,endMs:(index+1)*4000/row.blocks.length})),extractedAt:"2026-10-24T00:00:00.000Z",model:"authored-evaluation-fixture",notes:"Explicit test text; not a customer media extraction."});
  return {...row,context,source,draftSystem:hookBrandRemixSystemPrompt(source),draftUser:remixTextPrompt(source,context,row.instructions)};
});
if(cases.length!==24||new Set(cases.map(row=>row.id)).size!==24)throw Error("Expected 24 unique frozen cases.");
const inputs={model:saved.model,draftReasoning:"low",reviewReasoning:"medium",maxCompletionTokens:4000,reviewSystem:HOOK_REMIX_REVIEW_PROMPT,cases};
fs.mkdirSync(dir,{recursive:true});
let manifest;
if(fs.existsSync(manifestFile)){
  manifest=JSON.parse(fs.readFileSync(manifestFile,"utf8"));
  if(manifest.inputDigest!==hash(inputs))throw Error("Frozen inputs changed; preserve this experiment rather than replaying it.");
}else{
  manifest={createdAt:new Date().toISOString(),inputDigest:hash(inputs),maxProviderCalls:48,...inputs,
    requests:cases.flatMap(row=>["draft","review"].map(phase=>({caseId:row.id,phase,requestId:randomUUID(),state:"planned"})))};
  write(manifestFile,manifest);
}
if(mode==="--prepare"){
  console.log(JSON.stringify({cases:24,contexts:Object.keys(fixture.contexts).length,maxProviderCalls:48,inputDigest:manifest.inputDigest}));
}else{
  nextEnv.loadEnvConfig(process.cwd());
  if(!process.env.OPENAI_API_KEY?.trim())throw Error("Missing configured provider credential; no call sent.");
  const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:60000});
  for(const row of cases){
    for(const phase of ["draft","review"]){
      const request=manifest.requests.find(r=>r.caseId===row.id&&r.phase===phase);
      if(request.state==="completed")continue;
      if(mode==="--continue-unaffected"&&request.state==="uncertain"){
        if(phase==="draft"){
          const skipped=manifest.requests.find(r=>r.caseId===row.id&&r.phase==="review");
          if(skipped.state==="planned")Object.assign(skipped,{state:"not_submitted",reason:"Original draft result unresolved; no replacement submitted."});
          write(manifestFile,manifest);
        }
        console.log(JSON.stringify({case:row.id,phase,state:request.state,action:"left unresolved; continuing independent planned cases only"}));
        break;
      }
      if(request.state!=="planned")throw Error(`Request ${request.requestId} is ${request.state}; no automatic resubmission.`);
      const draft=manifest.requests.find(r=>r.caseId===row.id&&r.phase==="draft");
      if(phase==="review"&&!RemixOutputSchema.safeParse(draft.output).success){Object.assign(request,{state:"not_submitted",reason:"Draft was not a usable parsed result."});write(manifestFile,manifest);break;}
      const system=phase==="draft"?row.draftSystem:inputs.reviewSystem;
      const user=phase==="draft"?row.draftUser:hookRemixReviewPayload(row.source,row.context,row.instructions,RemixOutputSchema.parse(draft.output));
      Object.assign(request,{state:"uncertain",startedAt:new Date().toISOString(),system,user});
      write(manifestFile,manifest);
      const started=Date.now();
      try{
        const completion=await ai.chat.completions.parse({model:inputs.model,reasoning_effort:phase==="draft"?"low":"medium",max_completion_tokens:4000,
          messages:[{role:"system",content:system},{role:"user",content:user}],response_format:zodResponseFormat(phase==="draft"?RemixOutputSchema:HookRemixReviewSchema,phase==="draft"?"reference_text_remix":"hook_remix_review")},
          {headers:{"X-Client-Request-Id":request.requestId}});
        const output=completion.choices[0]?.message.parsed;
        Object.assign(request,{state:"completed",output,completedAt:new Date().toISOString(),latencyMs:Date.now()-started,providerResponseId:completion.id,providerModel:completion.model,usage:completion.usage,finishReason:completion.choices[0]?.finish_reason});
        if(phase==="review"){
          try{const accepted=acceptHookRemixReview(output,row.source,row.context,row.instructions,draft.output);request.acceptance={accepted:true,output:accepted.output};}
          catch(error){request.acceptance={accepted:false,code:error.code??error.message};}
        }
        write(manifestFile,manifest);
        console.log(JSON.stringify({case:row.id,phase,latencyMs:request.latencyMs,accepted:request.acceptance?.accepted,output:phase==="draft"?output:output?.output,reason:phase==="review"?output?.reason:undefined}));
      }catch(error){
        request.error={name:error.name,status:error.status??null,code:error.code??null,message:String(error.message).replace(/sk-[\w-]+/gu,"[redacted]").slice(0,1000)};
        write(manifestFile,manifest);
        throw Error(`Incomplete provider result for ${request.requestId}; state saved, no automatic retry.`);
      }
    }
  }
  function assess(output,row){
    if(!output)return {pass:false,failures:["not_delivered"]};
    const failures=[];
    try{validateRemixOutput(output,row.source);}catch{failures.push("structure_or_length");}
    const text=output.blocks.join("\n");
    const expected=row.expect;
    if(expected.brand&&!text.includes(expected.brand))failures.push("expected_brand");
    for(const pattern of expected.required??[])if(!new RegExp(pattern,"iu").test(text))failures.push("missing:"+pattern);
    for(const pattern of expected.requiredAny??[])if(!new RegExp(pattern,"iu").test(text))failures.push("missing_any:"+pattern);
    for(const pattern of expected.forbidden??[])if(new RegExp(pattern,"iu").test(text))failures.push("forbidden:"+pattern);
    if(expected.unchanged&&JSON.stringify(output.blocks)!==JSON.stringify(row.blocks))failures.push("unnecessary_source_rewrite");
    if(expected.lineCount&&text.split("\n").length!==expected.lineCount)failures.push("line_count");
    return {pass:failures.length===0,failures};
  }
  const results=cases.map(row=>{
    const draft=manifest.requests.find(r=>r.caseId===row.id&&r.phase==="draft"),review=manifest.requests.find(r=>r.caseId===row.id&&r.phase==="review");
    return {...row,draft,review,baselineCheck:assess(draft.output,row),reviewedCheck:assess(review.acceptance?.accepted?review.acceptance.output:null,row)};
  });
  const summary={cases:24,completedCalls:manifest.requests.filter(r=>r.state==="completed").length,
    baselinePass:results.filter(r=>r.baselineCheck.pass).length,reviewedPass:results.filter(r=>r.reviewedCheck.pass).length,
    unresolvedCalls:manifest.requests.filter(r=>r.state==="uncertain").length,notSubmitted:manifest.requests.filter(r=>r.state==="not_submitted").length,
    reviewedBlocked:results.filter(r=>r.review.acceptance&&!r.review.acceptance.accepted).length,reviewedDeliveredFailures:results.filter(r=>r.review.acceptance?.accepted&&!r.reviewedCheck.pass).length,
    repairs:results.filter(r=>r.review.acceptance?.accepted&&r.review.output.decision==="revise").length,
    tokens:manifest.requests.reduce((sum,r)=>sum+(r.usage?.total_tokens??0),0)};
  write("docs/hook-remix-quality-pilot-results-2026-10-24.json",{createdAt:manifest.createdAt,completedAt:new Date().toISOString(),inputDigest:manifest.inputDigest,method:fixture.description,model:inputs.model,summary,results});
  console.log(JSON.stringify(summary));
}
