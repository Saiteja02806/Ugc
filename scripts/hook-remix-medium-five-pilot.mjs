/* Explicit five-call experiment. No app receipts, review calls or deployment. */
import fs from "node:fs";
import path from "node:path";
import { createHash,randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { RemixOutputSchema,validateRemixOutput } from "../lib/explore/reference-text.ts";
import { hookRemixResult } from "../lib/explore/hook-remix-source.ts";
import { hookBrandRemixSystemPrompt,HOOK_BRAND_REMIX_PROMPT_VERSION } from "../lib/explore/hook-remix-brand-prompt.ts";
import { remixTextPrompt } from "../lib/explore/remix-text-prompt.ts";

const mode=process.argv[2];
if(process.argv.length!==3||!["--prepare","--run"].includes(mode))throw Error("Use --prepare or --run for exactly five authorized generation calls.");
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const saved=read("docs/hook-remix-quality-samples-2026-10-23.json").records;
const recent=read("docs/hook-remix-recent-audit-evidence-2026-10-24.json").records;
const context=read(".tmp/hook-remix-pilot-context.json");
const ids=["32c168f2","c752e103","2d0fd0e9","20850ea9","292d844b"];
const cases=ids.map(id=>{
  const row=[...recent,...saved].find(record=>record.request_key.startsWith(id));
  if(!row)throw Error("Missing original saved example: "+id);
  const {source}=hookRemixResult(row.output,row.source);
  return {savedRequestKey:row.request_key,source,system:hookBrandRemixSystemPrompt(source),user:remixTextPrompt(source,context.business_context,"")};
});
const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inputs={model:context.model,reasoningEffort:"medium",promptVersion:HOOK_BRAND_REMIX_PROMPT_VERSION,maxCompletionTokens:4000,contextDigest:hash(context.business_context),cases};
const dir=path.resolve(".tmp/hook-remix-medium-five-2026-10-24"),manifestPath=path.join(dir,"manifest.json");
const write=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n");
fs.mkdirSync(dir,{recursive:true});
let manifest;
if(fs.existsSync(manifestPath)){
  manifest=read(manifestPath);
  if(manifest.inputDigest!==hash(inputs))throw Error("Frozen experiment differs; do not overwrite or repeat its requests.");
}else{
  manifest={createdAt:new Date().toISOString(),inputDigest:hash(inputs),...inputs,requests:cases.map(row=>({savedRequestKey:row.savedRequestKey,requestId:randomUUID(),state:"planned"}))};
  write(manifestPath,manifest);
}
if(mode==="--prepare")console.log(JSON.stringify({plannedRequests:5,model:inputs.model,reasoningEffort:inputs.reasoningEffort,promptVersion:inputs.promptVersion,inputDigest:manifest.inputDigest}));
else {
  nextEnv.loadEnvConfig(process.cwd());
  if(!process.env.OPENAI_API_KEY?.trim())throw Error("Configured provider credential unavailable; no call sent.");
  const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:60000});
  for(const request of manifest.requests){
    if(request.state==="completed")continue;
    if(request.state!=="planned")throw Error("Existing uncertain request must not be automatically repeated.");
    const row=cases.find(item=>item.savedRequestKey===request.savedRequestKey);
    Object.assign(request,{state:"uncertain",startedAt:new Date().toISOString()});write(manifestPath,manifest);
    const start=Date.now();
    try{
      const result=await ai.chat.completions.create({model:inputs.model,reasoning_effort:"medium",max_completion_tokens:4000,
        messages:[{role:"system",content:row.system},{role:"user",content:row.user}],response_format:zodResponseFormat(RemixOutputSchema,"reference_text_remix")},
        {headers:{"X-Client-Request-Id":request.requestId}});
      Object.assign(request,{state:"completed",providerResponseId:result.id,providerModel:result.model,completedAt:new Date().toISOString(),latencyMs:Date.now()-start,
        usage:result.usage,rawContent:result.choices[0]?.message.content??null,finishReason:result.choices[0]?.finish_reason,refusal:result.choices[0]?.message.refusal??null});
      write(manifestPath,manifest);
      try{request.output=validateRemixOutput(JSON.parse(request.rawContent),row.source);request.validationError=null;}
      catch(error){request.validationError=error.message;}
      write(manifestPath,manifest);
      console.log(JSON.stringify({source:request.savedRequestKey.slice(0,8),valid:!request.validationError,output:request.output??null,validationError:request.validationError}));
    }catch(error){request.error={name:error.name,status:error.status??null,code:error.code??null};write(manifestPath,manifest);throw Error(`Request ${request.requestId} is unresolved; no automatic retry.`);}
  }
  const results=cases.map(row=>({...row,result:manifest.requests.find(request=>request.savedRequestKey===row.savedRequestKey)}));
  const summary={completedCalls:manifest.requests.filter(request=>request.state==="completed").length,validOutputs:manifest.requests.filter(request=>request.output&&!request.validationError).length,
    totalTokens:manifest.requests.reduce((sum,request)=>sum+(request.usage?.total_tokens??0),0),reviewerCalls:0};
  write("docs/hook-remix-medium-five-results-2026-10-24.json",{createdAt:manifest.createdAt,completedAt:new Date().toISOString(),inputDigest:manifest.inputDigest,
    method:"Five paid generation-only requests with the current local v8 prompt, medium reasoning, original saved UGCPilot business context and five saved sources. No reviewer, retries, new controls, app receipt writes or deployment. One sample per case; no causal quality claim.",
    model:inputs.model,reasoningEffort:inputs.reasoningEffort,promptVersion:inputs.promptVersion,contextDigest:inputs.contextDigest,summary,results});
  console.log(JSON.stringify(summary));
}
