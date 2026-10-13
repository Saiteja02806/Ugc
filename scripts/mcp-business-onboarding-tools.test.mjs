import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { before, after, test, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

const savedFetch = globalThis.fetch;
const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BUSINESS_ONBOARDING_BACKGROUND_ENABLED", "BUSINESS_ONBOARDING_BACKGROUND_USER_IDS", "MCP_BUSINESS_ONBOARDING_WRITES_ENABLED"];
const envBefore = envNames.map(key=>[key,process.env[key]]);
Object.assign(process.env,{SUPABASE_URL:"https://onboarding-fixture.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"offline-fixture",BUSINESS_ONBOARDING_BACKGROUND_ENABLED:"true",MCP_BUSINESS_ONBOARDING_WRITES_ENABLED:"true"});
const db = new PGlite({extensions:{pgcrypto,uuid_ossp}});
let reads = [], outage = false, loseAck=false, dispatchFailure=false, dispatches=[], logoInspections=[];
mock.module("../lib/jobs/gcp-cloud-tasks.ts",{namedExports:{getMissingBackgroundJobCloudTasksEnvVars:()=>[],enqueueBackgroundJobCloudTask:()=>{throw Error("Unintended external task");},getBackgroundJobDispatchUrl:()=>"https://offline.invalid"}});
mock.module("../lib/jobs/background-job-service.ts",{namedExports:{
 dispatchQueuedBackgroundJobForRecovery:async job=>{dispatches.push(job.id);if(dispatchFailure)throw Error("offline-dispatch-secret");return job;},
 retryAndDispatchBackgroundJob:()=>{throw Error("Unintended retry");},createAndDispatchBackgroundJob:()=>{throw Error("Unintended creation");}
}});
mock.module("../lib/business-profiles/logo.ts",{namedExports:{inspectBusinessLogo:async({key,userId})=>{
 logoInspections.push({key,userId});const prefix=`business-profile-logos/${createHash("sha256").update(userId).digest("hex")}/`;
 if(!key.startsWith(prefix))throw Error("foreign-logo-secret");
 return {storageKey:key,url:"https://media.example.com/verified.png",mimeType:"image/png",fileSizeBytes:1024,width:128,height:128};
}}});
globalThis.fetch = async (input,init) => {
  const request = input instanceof Request ? input : new Request(input,init);
  const url = new URL(request.url);
  assert.equal(url.hostname,"onboarding-fixture.supabase.co");
  if(request.method==="POST") {
    const body=await request.json();assert.ok(body.p_user_id);reads.push({path:url.pathname,owner:body.p_user_id});
    if(outage)return Response.json({message:"private-service-token"},{status:500});
    try {
      if(url.pathname==="/rest/v1/rpc/mcp_read_business_onboarding") return Response.json((await db.query("select mcp_read_business_onboarding($1,$2) state",[body.p_user_id,body.p_background_enrolled])).rows[0].state);
      assert.equal(url.pathname,"/rest/v1/rpc/mcp_mutate_business_onboarding");
      const result=(await db.query("select mcp_mutate_business_onboarding($1,$2,$3::jsonb,$4::jsonb,$5) result",[body.p_user_id,body.p_request_id,JSON.stringify(body.p_input),JSON.stringify(body.p_prepared),body.p_background_enrolled])).rows[0].result;
      if(loseAck){loseAck=false;throw Error("lost-after-commit");}
      return Response.json(result);
    } catch(error){return Response.json({message:error.message,code:error.code??"P0001"},{status:400});}
  }
  assert.equal(request.method,"GET","read tools cannot make mutation/dispatch/provider requests");
  assert.ok(["business_profiles","business_onboarding_drafts","background_jobs","website_analyses","mcp_business_onboarding_requests"].includes(url.pathname.split("/").at(-1)));
  reads.push({path:url.pathname,params:url.searchParams});
  if (outage) return Response.json({message:"private-service-token"},{status:500});
  const table=url.pathname.split("/").at(-1),columns=url.searchParams.get("select")||"*";
  assert.ok(columns==="*"||/^[a-z_,]+$/.test(columns));
  const values=[],predicates=[];
  for (const key of ["user_id","id","job_type","source_job_id","request_id"]) {
    const filter=url.searchParams.get(key);
    if(filter){assert.ok(filter.startsWith("eq."));values.push(filter.slice(3));predicates.push(`${key}=$${values.length}`);}
  }
  const owner=url.searchParams.get("user_id");
  if(url.searchParams.get("limit")!=="0") assert.ok(owner?.startsWith("eq."),"every data read is owner-bound");
  const contained=url.searchParams.get("input_json");
  if(contained){assert.ok(contained.startsWith("cs."));values.push(contained.slice(3));predicates.push(`input_json @> $${values.length}::jsonb`);}
  const or=url.searchParams.get("or");
  if(or){const parts=or.match(/created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),request_id\.lt\.([^)]*)/);assert.ok(parts);assert.equal(parts[1],parts[2]);values.push(parts[1],parts[3]);predicates.push(`(created_at<$${values.length-1}::timestamptz or (created_at=$${values.length-1}::timestamptz and request_id<$${values.length}::uuid))`);}
  let sql=`select ${columns} from public.${table}`;
  if(predicates.length)sql+=` where ${predicates.join(" and ")}`;
  const order=url.searchParams.get("order");
  if(order){assert.match(order,/^created_at.desc(,(id|request_id).desc)?$/);sql+=" order by created_at desc"+(order.includes("request_id.desc")?",request_id desc":order.includes("id.desc")?",id desc":"");}
  const limit=url.searchParams.get("limit");
  if(limit){assert.match(limit,/^[0-9]+$/);values.push(Number(limit));sql+=` limit $${values.length}`;}
  try {
    const rows=(await db.query(`select to_jsonb(_row) data from (${sql}) _row`,values)).rows.map(row=>row.data);
    return Response.json(request.headers.get("accept")?.includes("vnd.pgrst.object") ? rows[0]??null : rows);
  } catch(error){return Response.json({message:error.message,code:error.code},{status:400});}
};
const {registerBusinessOnboardingMcpTools}=await import("../lib/mcp/business-onboarding-tools.ts");
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
async function call(name,owner,args={},scopes) {const result=await rpc("tools/call",{name,arguments:args},owner,scopes);return result.result??{isError:true,content:[{type:"text",text:JSON.stringify(result.error)}]};}
async function state(owner){const result=await call("get_business_onboarding",owner);assert.ok(!result.isError,JSON.stringify(result));return result.structuredContent;}
async function one(sql,values=[]) {return (await db.query(sql,values)).rows[0];}
async function mutate(owner,action,payload){return one("select * from public.mutate_business_onboarding_v1($1,$2,$3::jsonb)",[owner,action,JSON.stringify(payload)]);}
const source={intakeType:"manual",experience:"streamlined",businessName:"Saved name",description:"Organizes selected ideas into editable marketing plans."};
const analysis=buildManualBusinessAnalysis({businessName:"Analyzed name",category:"writing",mainProblem:"Slow planning",productSummary:"Organizes selected ideas into editable plans.",targetAudience:"Business owners",valueProps:"Reuse a saved plan"});
const owner=()=>`onboarding-${randomUUID()}`;


const args=(state,change,key=randomUUID())=>({request_id:key,expected_state:state.expected_state,change});
async function accepted(uid,input){const result=await call("mutate_business_onboarding",uid,input,["brand:write"]);assert.ok(!result.isError,JSON.stringify(result));return result.structuredContent;}
function code(result){assert.equal(result.isError,true,JSON.stringify(result));return JSON.parse(result.content[0].text).code;}
async function seed(uid=owner()) {await db.query("insert into business_profiles(user_id,intake_type,context_json,content_hash) values($1,'manual',$2::jsonb,$3)",[uid,JSON.stringify(analysis),createHash("sha256").update(JSON.stringify({analysis,intakeType:"manual"})).digest("hex")]);return uid;}

test("actual SDK accepts a durable background start and recovers a lost response without re-dispatch",async()=>{
 const uid=owner(),input=args(await state(uid),{action:"start",source});reads=[];dispatches=[];loseAck=true;
 const failed=await call("mutate_business_onboarding",uid,input,["brand:write"]);assert.equal(code(failed),"BUSINESS_ONBOARDING_UNAVAILABLE");
 const recovered=await call("get_business_onboarding_request",uid,{request_id:input.request_id});assert.ok(!recovered.isError,JSON.stringify(recovered));assert.equal(recovered.structuredContent.receipt.action,"start");
 const before=await state(uid),replay=await accepted(uid,input);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,recovered.structuredContent.receipt);assert.equal(dispatches.length,0);assert.deepEqual(await state(uid),before);
 assert.equal((await one("select count(*)::int n from background_jobs where user_id=$1",[uid])).n,1);
});
test("identity receipt stays historical after website edits and exact replay skips state/inspection",async()=>{
 const uid=owner();await accepted(uid,args(await state(uid),{action:"start",source}));
 const input=args(await state(uid),{action:"identity",business_name:"IDE exact name"}),first=await accepted(uid,input);
 const current=await state(uid);await mutate(uid,"identity",{draftId:current.draft.id,revision:current.draft.revision,businessName:"Website later name",logo:null});
 reads=[];const replay=await accepted(uid,input);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,first.receipt);assert.equal(reads.length,1);assert.equal(reads[0].path,"/rest/v1/mcp_business_onboarding_requests");assert.equal((await state(uid)).draft.business_name,"Website later name");
 const collision=await call("mutate_business_onboarding",uid,{...input,change:{...input.change,business_name:"Different input"}},["brand:write"]);assert.equal(code(collision),"REQUEST_CONFLICT");
});
test("legacy profile changes use shared normalization and survive completion dispatch failure",async()=>{
 const uid=await seed();await accepted(uid,args(await state(uid),{action:"identity",business_name:"My exact legacy identity"}));
 const read=await state(uid);assert.equal(read.mode,"legacy");assert.equal(read.profile.businessName,"My exact legacy identity");
 const input=args(read,{action:"submit",primary_goals:["generate_leads","increase_engagement"],timezone:"Asia/Calcutta"});dispatchFailure=true;
 let result;try{result=await accepted(uid,input);}finally{dispatchFailure=false;}
 assert.equal(result.receipt.accepted_state.profile.onboardingComplete,true);assert.deepEqual(result.receipt.accepted_state.profile.primaryGoals,["generate_leads","increase_engagement"]);assert.equal(result.receipt.job_ids.length,1);
 const job=await one("select status,input_json from background_jobs where id=$1",[result.receipt.job_ids[0]]);assert.equal(job.status,"queued");assert.equal(job.input_json.legacyFinalizeOnly,true);assert.equal((await accepted(uid,input)).replayed,true);
});
test("owned logo attachment is inspected once; omitted key preserves and null removes",async()=>{
 const uid=await seed(),key=`business-profile-logos/${createHash("sha256").update(uid).digest("hex")}/${randomUUID()}.png`;
 logoInspections=[];const input=args(await state(uid),{action:"identity",business_name:"Logo identity",logo_storage_key:key});
 const first=await accepted(uid,input);assert.equal(first.receipt.accepted_state.profile.logoStorageKey,key);assert.deepEqual(logoInspections,[{key,userId:uid}]);
 await accepted(uid,input);assert.equal(logoInspections.length,1);
 await accepted(uid,args(await state(uid),{action:"identity",business_name:"Preserved logo"}));assert.equal((await state(uid)).profile.logoStorageKey,key);
 const removed=await accepted(uid,args(await state(uid),{action:"identity",business_name:"Removed logo",logo_storage_key:null}));assert.equal(removed.receipt.accepted_state.profile.logoStorageKey,null);assert.equal(logoInspections.length,1);
 const before=await state(uid),bad=await call("mutate_business_onboarding",uid,args(before,{action:"identity",business_name:"Foreign",logo_storage_key:"business-profile-logos/foreign/a.png"}),["brand:write"]);assert.equal(code(bad),"INVALID_LOGO");assert.deepEqual(await state(uid),before);
});
test("request discovery is stably paged, owner-bound and usable after gate stops",async()=>{
 const uid=owner(),ids=[];let current=await state(uid);
 for(const change of [{action:"start",source},{action:"identity",business_name:"Saved name"},{action:"goals",primary_goals:["generate_leads"]}]){const input=args(current,change);ids.push(input.request_id);await accepted(uid,input);current=await state(uid);}
 await db.query("update mcp_business_onboarding_requests set created_at='2026-10-13T00:00:00.123456Z' where user_id=$1",[uid]);
 process.env.MCP_BUSINESS_ONBOARDING_WRITES_ENABLED="false";
 try{
  const first=(await call("list_business_onboarding_requests",uid,{limit:2})).structuredContent;assert.equal(first.items.length,2);assert.ok(first.next_cursor);
  const second=(await call("list_business_onboarding_requests",uid,{limit:2,cursor:first.next_cursor})).structuredContent;assert.equal(second.items.length,1);assert.equal(second.next_cursor,null);
  assert.deepEqual([...first.items,...second.items].map(item=>item.request_id),[...ids].sort().reverse());
  const foreign=await call("list_business_onboarding_requests",owner(),{limit:2,cursor:first.next_cursor});assert.equal(code(foreign),"INVALID_CURSOR");
  const missing=await call("get_business_onboarding_request",owner(),{request_id:ids[0]});assert.equal(code(missing),"NOT_FOUND");
  const disabled=await call("mutate_business_onboarding",uid,args(current,{action:"goals",primary_goals:[]}),["brand:write"]);assert.equal(code(disabled),"ONBOARDING_WRITES_DISABLED");
 }finally{process.env.MCP_BUSINESS_ONBOARDING_WRITES_ENABLED="true";}
});
test("stale state and missing brand-write scope cannot dispatch or accept a change",async()=>{
 const uid=owner(),initial=await state(uid);await accepted(uid,args(initial,{action:"start",source}));dispatches=[];
 const stale=await call("mutate_business_onboarding",uid,args(initial,{action:"start",source}),["brand:write"]);assert.equal(code(stale),"ONBOARDING_CONFLICT");assert.equal(dispatches.length,0);
 const denied=await call("mutate_business_onboarding",uid,args(await state(uid),{action:"goals",primary_goals:[]}));assert.equal(denied.isError,true);assert.equal(dispatches.length,0);
});

test("background submission and reopening retain exact answers and reject silent writes to submitted setup",async()=>{
 const uid=owner();await accepted(uid,args(await state(uid),{action:"start",source}));
 await accepted(uid,args(await state(uid),{action:"identity",business_name:"Exact background identity"}));
 const submitted=await accepted(uid,args(await state(uid),{action:"submit",primary_goals:["generate_leads"],timezone:"UTC"}));
 assert.equal(submitted.receipt.accepted_state.draft.submitted,true);assert.equal(submitted.receipt.accepted_state.draft.completed,false);
 const current=await state(uid),blocked=await call("mutate_business_onboarding",uid,args(current,{action:"goals",primary_goals:["grow_views"]}),["brand:write"]);
 assert.equal(code(blocked),"ONBOARDING_SUBMITTED");assert.deepEqual(await state(uid),current);
 const reopened=await accepted(uid,args(current,{action:"edit"}));assert.equal(reopened.receipt.accepted_state.draft.submitted,false);assert.equal(reopened.receipt.accepted_state.draft.business_name,"Exact background identity");assert.deepEqual(reopened.receipt.accepted_state.draft.primary_goals,["generate_leads"]);
 const changed=await accepted(uid,args(await state(uid),{action:"goals",primary_goals:["grow_views"]}));assert.deepEqual(changed.receipt.accepted_state.draft.primary_goals,["grow_views"]);
});
