import assert from "node:assert/strict";
import { confirmToolResult } from "./mcp-confirm-client.mjs";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

const savedFetch = globalThis.fetch;
const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BUSINESS_ONBOARDING_BACKGROUND_ENABLED", "BUSINESS_ONBOARDING_BACKGROUND_USER_IDS", "MCP_BUSINESS_ONBOARDING_WRITES_ENABLED"];
const envBefore = envNames.map(key=>[key,process.env[key]]);
Object.assign(process.env,{SUPABASE_URL:"https://onboarding-fixture.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"offline-fixture",BUSINESS_ONBOARDING_BACKGROUND_ENABLED:"true",MCP_BUSINESS_ONBOARDING_WRITES_ENABLED:"false"});
const db = new PGlite({extensions:{pgcrypto,uuid_ossp}});
let reads = [], outage = false;
globalThis.fetch = async (input,init) => {
  const request = input instanceof Request ? input : new Request(input,init);
  const url = new URL(request.url);
  assert.equal(url.hostname,"onboarding-fixture.supabase.co");
  if(request.method==="POST") {
    assert.equal(url.pathname,"/rest/v1/rpc/mcp_read_business_onboarding","read tools cannot mutate/dispatch/call providers");
    const body=await request.json();assert.ok(body.p_user_id);reads.push({path:url.pathname,owner:body.p_user_id});
    if(outage)return Response.json({message:"private-service-token"},{status:500});
    const state=(await db.query("select mcp_read_business_onboarding($1,$2) state",[body.p_user_id,body.p_background_enrolled])).rows[0].state;
    return Response.json(state);
  }
  assert.equal(request.method,"GET","read tools cannot make mutation/dispatch/provider requests");
  assert.ok(["business_profiles","business_onboarding_drafts","background_jobs","website_analyses"].includes(url.pathname.split("/").at(-1)));
  reads.push({path:url.pathname,params:url.searchParams});
  if (outage) return Response.json({message:"private-service-token"},{status:500});
  const table=url.pathname.split("/").at(-1),columns=url.searchParams.get("select")||"*";
  assert.ok(columns==="*"||/^[a-z_,]+$/.test(columns));
  const values=[],predicates=[];
  for (const key of ["user_id","id","job_type","source_job_id"]) {
    const filter=url.searchParams.get(key);
    if(filter){assert.ok(filter.startsWith("eq."));values.push(filter.slice(3));predicates.push(`${key}=$${values.length}`);}
  }
  const owner=url.searchParams.get("user_id");
  if(url.searchParams.get("limit")!=="0") assert.ok(owner?.startsWith("eq."),"every data read is owner-bound");
  const contained=url.searchParams.get("input_json");
  if(contained){assert.ok(contained.startsWith("cs."));values.push(contained.slice(3));predicates.push(`input_json @> $${values.length}::jsonb`);}
  let sql=`select ${columns} from public.${table}`;
  if(predicates.length)sql+=` where ${predicates.join(" and ")}`;
  const order=url.searchParams.get("order");
  if(order){assert.match(order,/^created_at.desc(,id.desc)?$/);sql+=" order by created_at desc"+(order.includes("id.desc")?",id desc":"");}
  const limit=url.searchParams.get("limit");
  if(limit){assert.match(limit,/^[0-9]+$/);values.push(Number(limit));sql+=` limit $${values.length}`;}
  try {
    const rows=(await db.query(sql,values)).rows;
    return Response.json(request.headers.get("accept")?.includes("vnd.pgrst.object") ? rows[0]??null : rows);
  } catch(error){return Response.json({message:error.message,code:error.code},{status:400});}
};
const {registerBusinessOnboardingMcpTools,registeredBusinessOnboardingMcpTools}=await import("../lib/mcp/business-onboarding-tools.ts");
const {onboardingSourceSchema,onboardingChangeSchema}=await import("../lib/mcp/business-onboarding-contract.ts");
const {BusinessProfileSetupInputSchema}=await import("../lib/business-profiles/setup.ts");
const {buildManualBusinessAnalysis}=await import("../lib/business-profiles/schema.ts");
const handler=createMcpHandler(()=>{const server=new McpServer({name:"fixture",version:"1"});registerBusinessOnboardingMcpTools(server);return server;},{legacy:"stateless"});
before(async()=>{
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;");
  const root=new URL("../supabase/migrations/",import.meta.url);
  for(const file of (await readdir(root)).filter(name=>name.endsWith(".sql")).sort()) {
    try {await db.exec((await readFile(new URL(file,root),"utf8")).replaceAll("\r\n","\n"));}
    catch(error){throw new Error(`Canonical migration ${file}: ${error.message}`);}
  }
},{timeout:120000});
after(async()=>{globalThis.fetch=savedFetch;for(const[key,value]of envBefore){if(value===undefined)delete process.env[key];else process.env[key]=value;}await db.close();});
async function rpc(method,params,owner,scopes=["brand:read"]) {
  const response=await handler.fetch(new Request("https://mcp.getugcpilot.com/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}),{authInfo:{token:"fixture",clientId:"fixture",scopes,extra:owner?{firebaseUid:owner}:{}}});
  const text=await response.text(),line=text.split("\n").find(value=>value.startsWith("data: "));return JSON.parse(line?line.slice(6):text);
}
async function call(name,owner,args={},scopes) {return confirmToolResult(async(next)=>{const result=await rpc("tools/call",{name,arguments:next},owner,scopes);return result.result??{isError:true,content:[{type:"text",text:JSON.stringify(result.error)}]};},args);}
async function state(owner){const result=await call("get_business_onboarding",owner);assert.ok(!result.isError,JSON.stringify(result));return result.structuredContent;}
async function one(sql,values=[]) {return (await db.query(sql,values)).rows[0];}
async function mutate(owner,action,payload){return one("select * from public.mutate_business_onboarding_v1($1,$2,$3::jsonb)",[owner,action,JSON.stringify(payload)]);}
const source={intakeType:"manual",experience:"streamlined",businessName:"Saved name",description:"Organizes selected ideas into editable marketing plans."};
const analysis=buildManualBusinessAnalysis({businessName:"Analyzed name",category:"writing",mainProblem:"Slow planning",productSummary:"Organizes selected ideas into editable plans.",targetAudience:"Business owners",valueProps:"Reuse a saved plan"});
const owner=()=>`onboarding-${randomUUID()}`;
const payload=(draft,extra={})=>({draftId:draft.id,revision:draft.revision,sourceRevision:draft.source_revision,...extra});

test("real SDK discovers five scoped onboarding tools; capabilities make no HTTP calls",async()=>{
  const tools=(await rpc("tools/list",{},owner())).result.tools;
  assert.deepEqual(tools.map(tool=>tool.name).sort(),[...registeredBusinessOnboardingMcpTools].sort());
  for(const tool of tools){const write=tool.name==="mutate_business_onboarding";assert.equal(tool.annotations.readOnlyHint,!write);assert.equal(tool.annotations.openWorldHint,write);assert.deepEqual(tool._meta.securitySchemes[0].scopes,[write?"brand:write":"brand:read"]);}
  reads=[];const result=await call("get_business_onboarding_capabilities",owner());assert.equal(result.structuredContent.write_tools_available,true);assert.equal(result.structuredContent.write_enabled,false);assert.equal(result.structuredContent.background_enrolled,true);assert.equal(reads.length,0);
});
test("new enrolled account has background mode without starting a draft or job",async()=>{
  const uid=owner();assert.deepEqual(await state(uid),{mode:"background",expected_state:{mode:"background",profile_revision:null,draft_id:null,draft_revision:null},profile:null,draft:null,legacy_setup_jobs:[]});
  assert.equal((await one("select count(*)::int n from background_jobs where user_id=$1",[uid])).n,0);
});
test("disabled enrollment retains legacy behavior for an empty account",async()=>{
  process.env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED="false";
  try{assert.equal((await state(owner())).mode,"legacy");}finally{process.env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED="true";}
});
test("legacy profile uses the shared completion rules and never exposes owner/internal context",async()=>{
  const uid=owner();await db.query("insert into business_profiles(user_id,intake_type,context_json,content_hash,onboarding_status,onboarding_version,onboarding_step,primary_goals,onboarding_completed_at) values($1,'manual',$2,'completed-fixture','completed',2,2,'{}',now())",[uid,analysis]);
  const before=await one("select * from business_profiles where user_id=$1",[uid]);
  const result=await state(uid);assert.equal(result.mode,"legacy");assert.equal(result.profile.onboardingComplete,false);assert.equal(result.profile.onboardingStatus,"incomplete");assert.deepEqual(result.profile.onboardingMissingFields,["primaryGoals"]);
  assert.ok(!JSON.stringify(result).includes(uid));assert.equal("context" in result.profile,false);
  assert.deepEqual(await one("select * from business_profiles where user_id=$1",[uid]),before);
});
test("legacy setup recovery is owner/operation bound and capped at the newest 20",async()=>{
  const uid=owner(),other=owner();
  for(let n=0;n<23;n++)await db.query("select create_or_get_background_job_v1($1,$2,$3,'media_analysis',3,'default-project','ai-generation',$4)",[randomUUID(),{operation:"business_profile_setup",private_secret:"hidden-input"},"hidden-reference",uid]);
  await db.query("select create_or_get_background_job_v1($1,$2,$3,'media_analysis',3,'default-project','ai-generation',$4)",[randomUUID(),{operation:"unrelated"},"hidden-reference",uid]);
  await db.query("select create_or_get_background_job_v1($1,$2,$3,'media_analysis',3,'default-project','ai-generation',$4)",[randomUUID(),{operation:"business_profile_setup"},"hidden-reference",other]);
  const result=await state(uid);assert.equal(result.mode,"legacy");assert.equal(result.profile,null);assert.equal(result.legacy_setup_jobs.length,20);assert.equal(new Set(result.legacy_setup_jobs.map(job=>job.id)).size,20);assert.ok(!JSON.stringify(result).includes("hidden"));
  const ids=(await db.query("select id from background_jobs where user_id=$1 and input_json @> '{\"operation\":\"business_profile_setup\"}' order by created_at desc,id desc limit 20",[uid])).rows.map(row=>row.id);
  assert.deepEqual(result.legacy_setup_jobs.map(job=>job.id),ids);
});
test("persisted background draft survives stopped enrollment and returns saved progress",async()=>{
  const uid=owner();let draft=await mutate(uid,"start",{requestKey:randomUUID(),input:source});
  draft=await mutate(uid,"identity",payload(draft,{businessName:"User's exact name",logo:null}));
  draft=await mutate(uid,"goals",payload(draft,{primaryGoals:["generate_leads"]}));
  const before=await one("select * from business_onboarding_drafts where user_id=$1",[uid]);
  process.env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED="false";
  try{
    const result=await state(uid);assert.equal(result.mode,"background");assert.equal(result.draft.business_name,"User's exact name");assert.deepEqual(result.draft.primary_goals,["generate_leads"]);assert.equal(result.draft.analysis_job.id,draft.source_job_id);assert.equal(result.draft.revision,draft.revision);assert.deepEqual(result.draft.source,source);
    assert.equal(result.draft.analysis_ready,false);assert.equal(result.draft.submitted,false);assert.equal(result.draft.finalization_job,null);assert.deepEqual(result.legacy_setup_jobs,[]);
    assert.deepEqual(await one("select * from business_onboarding_drafts where user_id=$1",[uid]),before);
    const stranger=await state(owner());assert.equal(stranger.draft,null);assert.ok(!JSON.stringify(stranger).includes(draft.id));
  }finally{process.env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED="true";}
});
test("submitted answers plus saved analysis reveal the exact durable finalization job",async()=>{
  const uid=owner();let draft=await mutate(uid,"start",{requestKey:randomUUID(),input:source});
  draft=await mutate(uid,"identity",payload(draft,{businessName:"Exact name",logo:null}));
  draft=await mutate(uid,"submit",payload(draft,{primaryGoals:["generate_leads"],timezone:"Asia/Calcutta"}));
  const stored=await one("insert into website_analyses(user_id,project_id,source_job_id,source_type,analysis_json,confidence) values($1,'default-project',$2,'manual',$3,'high') returning id",[uid,draft.source_job_id,analysis]);
  draft=await mutate(uid,"attach",payload(draft,{jobId:draft.source_job_id,analysisId:stored.id}));
  const result=await state(uid);assert.equal(result.draft.submitted,true);assert.equal(result.draft.analysis_ready,true);assert.equal(result.draft.suggested_name,analysis.businessName);assert.equal(result.draft.finalization_job.id,draft.finalization_job_id);assert.equal(result.draft.completed,false);
  const before=await one("select count(*)::int n from background_jobs where user_id=$1",[uid]);await state(uid);assert.deepEqual(await one("select count(*)::int n from background_jobs where user_id=$1",[uid]),before);
});
test("missing consent/principal and forged owner arguments are rejected before data access",async()=>{
  for(const [uid,args,scopes]of [[undefined,{},["brand:read"]],[owner(),{},[]],[owner(),{user_id:"victim"},["brand:read"]]]){reads=[];const result=await call("get_business_onboarding",uid,args,scopes);assert.equal(result.isError,true);assert.equal(reads.length,0);}
});
test("storage failures are retryable without leaking service errors",async()=>{
  outage=true;try{const result=await call("get_business_onboarding",owner());assert.equal(result.isError,true);const failure=JSON.parse(result.content[0].text);assert.equal(failure.code,"BUSINESS_ONBOARDING_UNAVAILABLE");assert.equal(failure.retryable,true);assert.ok(!JSON.stringify(result).includes("private-service-token"));}finally{outage=false;}
});
test("strict intent contracts preserve all four website sources and reject privilege overrides",()=>{
  const sources=[{intakeType:"website",websiteUrl:"https://example.com"},{intakeType:"mobile_app_ai_prompt",aiIdeContext:"Product facts from my IDE"},{intakeType:"manual",manual:{businessName:"Name",category:"writing",mainProblem:"Slow planning",productSummary:"Organizes selected ideas into editable plans.",targetAudience:"Business owners",valueProps:"Reuse a plan"}},source];
  for(const value of sources){assert.deepEqual(onboardingSourceSchema.parse(value),BusinessProfileSetupInputSchema.parse(value));assert.equal(onboardingSourceSchema.safeParse({...value,userId:"victim"}).success,false);assert.equal(onboardingChangeSchema.safeParse({action:"start",source:value}).success,true);}
  assert.equal(onboardingChangeSchema.safeParse({action:"submit",primary_goals:[],timezone:"UTC"}).success,false);
  assert.equal(onboardingChangeSchema.safeParse({action:"submit",primary_goals:["generate_leads"],timezone:"not-a-timezone"}).success,false);
  assert.equal(onboardingChangeSchema.safeParse({action:"goals",primary_goals:["generate_leads","generate_leads"]}).success,false);
  assert.equal(onboardingChangeSchema.safeParse({action:"finalize",analysis}).success,false);
});

test("disabled onboarding writes reject valid intent before storage or dispatch",async()=>{
  reads=[];const result=await call("mutate_business_onboarding",owner(),{request_id:randomUUID(),expected_state:{mode:"background",profile_revision:null,draft_id:null,draft_revision:null},change:{action:"start",source}},["brand:write"]);
  assert.equal(result.isError,true);assert.equal(JSON.parse(result.content[0].text).code,"ONBOARDING_WRITES_DISABLED");assert.equal(reads.length,0);
});
