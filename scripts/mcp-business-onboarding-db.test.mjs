import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {randomUUID,createHash} from "node:crypto";
import {before,after,test} from "node:test";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import {uuid_ossp} from "@electric-sql/pglite/contrib/uuid_ossp";
import {buildManualBusinessAnalysis,applyBusinessProfileOnboardingContext,applyPrimaryGoals} from "../lib/business-profiles/schema.ts";
const db=new PGlite({extensions:{pgcrypto,uuid_ossp}});
before(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema extensions;");
 const root=new URL("../supabase/migrations/",import.meta.url);
 for(const file of (await readdir(root)).filter(f=>f.endsWith(".sql")).sort())await db.exec((await readFile(new URL(file,root),"utf8")).replaceAll("\r\n","\n"));
},{timeout:120000});
after(()=>db.close());
const user=()=>`onboarding-${randomUUID()}`;
const source={intakeType:"manual",experience:"streamlined",businessName:"Fixture",description:"Organizes selected ideas into editable marketing plans."};
const analysis=buildManualBusinessAnalysis({businessName:"Fixture",category:"writing",mainProblem:"Slow planning",productSummary:"Organizes selected ideas into editable plans.",targetAudience:"Business owners",valueProps:"Reuse a saved plan"});
const hash=context=>createHash("sha256").update(JSON.stringify({analysis:context,intakeType:"manual"})).digest("hex");
async function one(sql,args=[]){return (await db.query(sql,args)).rows[0];}
async function read(uid,enrolled=true){return (await one("select mcp_read_business_onboarding($1,$2) state",[uid,enrolled])).state;}
const fence=s=>({mode:s.mode,profile_revision:s.profile_revision,draft_id:s.draft?.id??null,draft_revision:s.draft?.revision??null});
const intent=(s,change)=>({expected_state:fence(s),change});
async function change(uid,raw,key=randomUUID(),prepared={},enrolled=true){return (await one("select mcp_mutate_business_onboarding($1,$2,$3::jsonb,$4::jsonb,$5) result",[uid,key,JSON.stringify(raw),JSON.stringify(prepared),enrolled])).result;}
async function start(uid=user(),enrolled=true){const result=await change(uid,intent(await read(uid,enrolled),{action:"start",source}),randomUUID(),{},enrolled);return {uid,result,state:await read(uid,enrolled)};}
async function seed(uid=user()) {await db.query("insert into business_profiles(user_id,intake_type,context_json,content_hash) values($1,'manual',$2::jsonb,$3)",[uid,JSON.stringify(analysis),hash(analysis)]);return {uid,state:await read(uid)};}
async function count(uid,table){assert.ok(["background_jobs","mcp_business_onboarding_requests"].includes(table));return (await one(`select count(*)::int n from ${table} where user_id=$1`,[uid])).n;}

test("background start atomically accepts one owned draft/job/receipt; exact replay is immutable",async()=>{
 const uid=user(),raw=intent(await read(uid),{action:"start",source}),key=randomUUID();
 const first=await change(uid,raw,key),after=await read(uid),again=await change(uid,raw,key);
 assert.equal(first.replayed,false);assert.equal(again.replayed,true);assert.deepEqual(first.receipt,again.receipt);
 assert.equal(first.receipt.snapshot.draft.source_input.description,source.description);assert.equal(first.receipt.job_ids.length,1);
 assert.equal(await count(uid,"background_jobs"),1);assert.equal(await count(uid,"mcp_business_onboarding_requests"),1);
 assert.deepEqual(await read(uid),after);
 await assert.rejects(change(uid,{...raw,change:{action:"start",source:{...source,businessName:"Changed"}}},key),/request_conflict/);
});
test("lost acknowledgement replay cannot restore old identity or overwrite a later website edit",async()=>{
 const {uid,state}=await start(),key=randomUUID(),raw=intent(state,{action:"identity",business_name:"First exact name"});
 const first=await change(uid,raw,key);
 const d=(await read(uid)).draft;
 await db.query("select mutate_business_onboarding_v1($1,'identity',$2::jsonb)",[uid,JSON.stringify({draftId:d.id,revision:d.revision,businessName:"Later website name",logo:null})]);
 const current=await read(uid),replay=await change(uid,raw,key);
 assert.deepEqual(replay.receipt,first.receipt);assert.equal(replay.receipt.snapshot.draft.business_name,"First exact name");
 assert.equal((await read(uid)).draft.business_name,"Later website name");assert.deepEqual(await read(uid),current);
 await assert.rejects(change(uid,intent(state,{action:"goals",primary_goals:["generate_leads"]})),/revision_conflict/);
});
test("UUID namespace and snapshots remain isolated across owners in both saved modes",async()=>{
 const key=randomUUID(),a=user(),b=user();
 const left=await change(a,intent(await read(a,false),{action:"start",source}),key,{},false);
 const right=await change(b,intent(await read(b,false),{action:"start",source}),key,{},false);
 assert.notEqual(left.receipt.job_ids[0],right.receipt.job_ids[0]);
 assert.equal(left.receipt.mode,"legacy");assert.equal(right.receipt.mode,"legacy");
 assert.equal((await one("select user_id from background_jobs where id=$1",[left.receipt.job_ids[0]])).user_id,a);
 assert.equal((await one("select user_id from background_jobs where id=$1",[right.receipt.job_ids[0]])).user_id,b);
 assert.equal(await count(a,"mcp_business_onboarding_requests"),1);assert.equal(await count(b,"mcp_business_onboarding_requests"),1);
});
test("background source replacement fences late workers while retaining identity/goals",async()=>{
 const {uid,state}=await start();await change(uid,intent(state,{action:"identity",business_name:"Saved identity"}));
 await change(uid,intent(await read(uid),{action:"goals",primary_goals:["generate_leads"]}));
 const before=await read(uid);
 await change(uid,intent(before,{action:"start",source:{...source,businessName:"New source"}}));
 const after=await read(uid);assert.equal(after.draft.business_name,"Saved identity");assert.deepEqual(after.draft.primary_goals,["generate_leads"]);
 assert.equal(after.draft.source_revision,before.draft.source_revision+1);assert.notEqual(after.draft.source_job_id,before.draft.source_job_id);
 const late=(await one("select * from mutate_business_onboarding_v1($1,'attach',$2::jsonb)",[uid,JSON.stringify({draftId:before.draft.id,sourceRevision:before.draft.source_revision,jobId:before.draft.source_job_id,analysisId:randomUUID()})]));assert.equal(late.analysis_id,null);
});
test("empty/duplicate goals, invalid timezone and foreign logo cannot accept a partial submission",async()=>{
 const {uid,state}=await start();await change(uid,intent(state,{action:"identity",business_name:"Exact identity"}));
 const before=await read(uid),receipts=await count(uid,"mcp_business_onboarding_requests"),jobs=await count(uid,"background_jobs");
 for(const c of [{action:"submit",primary_goals:[],timezone:"UTC"},{action:"submit",primary_goals:["generate_leads"],timezone:"invalid-zone"},{action:"goals",primary_goals:["generate_leads","generate_leads"]}])await assert.rejects(change(uid,intent(before,c)));
 await assert.rejects(change(uid,intent(before,{action:"identity",business_name:"Forged logo",logo_storage_key:"business-profile-logos/foreign/a.png"}),randomUUID(),{logo:{storageKey:"business-profile-logos/foreign/a.png"}}),/invalid/);
 assert.deepEqual(await read(uid),before);assert.equal(await count(uid,"mcp_business_onboarding_requests"),receipts);assert.equal(await count(uid,"background_jobs"),jobs);
});
test("legacy identity/goals share normalization and exact full-row fences",async()=>{
 const {uid,state}=await seed();const context=applyBusinessProfileOnboardingContext(analysis,{businessName:"Exact name"});
 const result=await change(uid,intent(state,{action:"identity",business_name:"Exact name"}),randomUUID(),{context,content_hash:hash(context)});
 assert.equal(result.receipt.mode,"legacy");const next=await read(uid);assert.deepEqual(next.profile.context_json,context);assert.equal(next.profile.profile_version,state.profile.profile_version+1);
 await change(uid,intent(next,{action:"goals",primary_goals:["generate_leads","increase_engagement"]}));
 const current=await read(uid);assert.deepEqual(current.profile.primary_goals,["generate_leads","increase_engagement"]);assert.equal(current.profile.profile_version,next.profile.profile_version);
 await assert.rejects(change(uid,intent(next,{action:"goals",primary_goals:[]})),/revision_conflict/);
 const before=await read(uid);await db.query("update business_profiles set preparation_status='failed',preparation_error='Website state changed' where user_id=$1",[uid]);
 await assert.rejects(change(uid,intent(before,{action:"goals",primary_goals:["grow_views"]})),/revision_conflict/);
});
test("legacy completion atomically updates access state and queues one existing worker-type preparation",async()=>{
 const {uid,state}=await seed(),context=applyPrimaryGoals(analysis,["generate_leads"]),raw=intent(state,{action:"submit",primary_goals:["generate_leads"],timezone:"Asia/Calcutta"}),key=randomUUID();
 const result=await change(uid,raw,key,{context,content_hash:hash(context)}),current=await read(uid);
 assert.equal(current.profile.onboarding_status,"completed");assert.equal(current.profile.onboarding_version,3);assert.equal(current.profile.onboarding_step,3);assert.ok(current.profile.onboarding_completed_at);
 assert.deepEqual(current.profile.context_json,context);assert.equal(result.receipt.job_ids.length,1);
 const job=await one("select * from background_jobs where id=$1",[result.receipt.job_ids[0]]);assert.equal(job.job_type,"media_analysis");assert.equal(job.input_json.legacyFinalizeOnly,true);assert.equal(job.input_json.userId,uid);assert.equal(job.input_json.profileVersion,current.profile.profile_version);assert.equal(job.input_json.timezone,"Asia/Calcutta");
 assert.equal((await change(uid,raw,key,{})).replayed,true);assert.equal(await count(uid,"background_jobs"),1);
 await assert.rejects(change(uid,intent(current,{action:"goals",primary_goals:["grow_views"]})),/already_completed/);
});
test("queue insertion failure rolls back legacy completion, profile version and receipt",async()=>{
 const {uid,state}=await seed();await db.exec("create function public.onboarding_test_queue_failure() returns trigger language plpgsql as $$begin if new.input_json->>'legacyFinalizeOnly'='true' then raise exception 'fixture_queue_failure';end if;return new;end;$$;create trigger onboarding_test_queue_failure before insert on background_jobs for each row execute function onboarding_test_queue_failure();");
 try{const context=applyPrimaryGoals(analysis,["generate_leads"]);await assert.rejects(change(uid,intent(state,{action:"submit",primary_goals:["generate_leads"],timezone:"UTC"}),randomUUID(),{context,content_hash:hash(context)}),/fixture_queue_failure/);assert.deepEqual(await read(uid),state);assert.equal(await count(uid,"mcp_business_onboarding_requests"),0);assert.equal(await count(uid,"background_jobs"),0);}
 finally{await db.exec("drop trigger onboarding_test_queue_failure on background_jobs;drop function onboarding_test_queue_failure();");}
});
test("legacy active source is recovered instead of creating duplicate pending analyses",async()=>{
 const {uid}=await start(user(),false);const current=await read(uid,false);
 await assert.rejects(change(uid,intent(current,{action:"start",source:{...source,businessName:"Another source"}}),randomUUID(),{},false),/source_active/);
 assert.equal(await count(uid,"background_jobs"),1);
 await assert.rejects(change(uid,intent(current,{action:"edit"}),randomUUID(),{},false),/not_found|unsupported/);
});
test("receipt permissions stay append-only under broad defaults; anonymous callers cannot execute",async()=>{
 assert.equal((await one("select relrowsecurity enabled from pg_class where oid='public.mcp_business_onboarding_requests'::regclass")).enabled,true);
 for(const role of ["anon","authenticated"]){assert.equal((await one("select has_table_privilege($1,'public.mcp_business_onboarding_requests','SELECT') allowed",[role])).allowed,false);assert.equal((await one("select has_function_privilege($1,'public.mcp_mutate_business_onboarding(text,uuid,jsonb,jsonb,boolean)','EXECUTE') allowed",[role])).allowed,false);assert.equal((await one("select has_function_privilege($1,'public.mcp_read_business_onboarding(text,boolean)','EXECUTE') allowed",[role])).allowed,false);}
 for(const privilege of ["UPDATE","DELETE","TRUNCATE"]){assert.equal((await one("select has_table_privilege('service_role','public.mcp_business_onboarding_requests',$1) allowed",[privilege])).allowed,false);}
 const uid=user(),raw=intent(await read(uid),{action:"start",source});await db.exec("set role service_role");try{await change(uid,raw);}finally{await db.exec("reset role");}
 assert.equal(await count(uid,"mcp_business_onboarding_requests"),1);
});

async function storeAnalysis(uid,jobId) {
  return (await one("insert into website_analyses(user_id,project_id,source_job_id,source_type,analysis_json,confidence,source_context) values($1,'default-project',$2,'manual',$3::jsonb,'high','Exact source') returning id",[uid,jobId,JSON.stringify(analysis)])).id;
}
async function commitAnalysis(uid,jobId,analysisId) {return (await one("select mcp_commit_legacy_onboarding_analysis($1,$2,$3,$4::jsonb,$5) result",[uid,jobId,analysisId,JSON.stringify(analysis),hash(analysis)])).result;}
test("MCP legacy source commits exactly once; later identity edits survive callback replay",async()=>{
 const {uid,result}=await start(user(),false),jobId=result.receipt.job_ids[0];
 await db.query("update background_jobs set status='processing' where id=$1",[jobId]);
 const analysisId=await storeAnalysis(uid,jobId),first=await commitAnalysis(uid,jobId,analysisId);
 assert.equal(first.changed,true);assert.equal(first.profile.onboarding_status,"incomplete");assert.equal(first.profile.onboarding_step,2);
 const current=await read(uid,false),edited=applyBusinessProfileOnboardingContext(analysis,{businessName:"Later exact identity"});
 await change(uid,intent(current,{action:"identity",business_name:"Later exact identity"}),randomUUID(),{context:edited,content_hash:hash(edited)},false);
 const before=await read(uid,false),replay=await commitAnalysis(uid,jobId,analysisId);
 assert.equal(replay.changed,false);assert.equal(replay.profile.context_json.businessName,"Later exact identity");assert.deepEqual(await read(uid,false),before);
});
test("newer saved profile changes fence a pending MCP analysis result",async()=>{
 const {uid}=await seed();const started=await change(uid,intent(await read(uid,false),{action:"start",source}),randomUUID(),{},false),jobId=started.receipt.job_ids[0];
 await db.query("update background_jobs set status='processing' where id=$1",[jobId]);const analysisId=await storeAnalysis(uid,jobId);
 await db.query("update business_profiles set primary_goals=array['grow_views'],updated_at=now() where user_id=$1",[uid]);
 const before=await read(uid,false),result=await commitAnalysis(uid,jobId,analysisId);
 assert.equal(result.skipped,"superseded");assert.deepEqual(await read(uid,false),before);
});
test("cancelled or replaced website analyses cannot persist a late profile",async()=>{
 const uid=user(),job=(await one("select create_or_get_background_job_v1($1,$2::jsonb,'fixture','media_analysis',3,'default-project','ai-generation',$3) result",[randomUUID(),JSON.stringify({...source,operation:"business_profile_setup",userId:uid}),uid])).result.job;
 await db.query("update background_jobs set status='processing' where id=$1",[job.id]);const analysisId=await storeAnalysis(uid,job.id);
 const newer=(await one("select create_or_get_background_job_v1($1,$2::jsonb,'fixture','media_analysis',3,'default-project','ai-generation',$3) result",[randomUUID(),JSON.stringify({...source,operation:"business_profile_setup",userId:uid}),uid])).result.job;
 await db.query("update background_jobs set created_at=created_at+interval '1 second' where id=$1",[newer.id]);
 assert.equal((await commitAnalysis(uid,job.id,analysisId)).skipped,"superseded");assert.equal((await read(uid,false)).profile,null);
 await db.query("update background_jobs set status='cancelled' where id=$1",[newer.id]);const newerAnalysis=await storeAnalysis(uid,newer.id);
 assert.equal((await commitAnalysis(uid,newer.id,newerAnalysis)).skipped,"superseded");assert.equal((await read(uid,false)).profile,null);
});
test("legacy callback rejects a stored analysis belonging to another owner",async()=>{
 const {uid,result}=await start(user(),false),jobId=result.receipt.job_ids[0];await db.query("update background_jobs set status='processing' where id=$1",[jobId]);
 const analysisId=await storeAnalysis(user(),jobId);await assert.rejects(commitAnalysis(uid,jobId,analysisId),/analysis_mismatch/);assert.equal((await read(uid,false)).profile,null);
});
