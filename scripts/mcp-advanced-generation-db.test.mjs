import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after,test } from "node:test";
import { advancedDb,reserve } from "./mcp-advanced-generation-fixture.mjs";
const db=await advancedDb();after(()=>db.close());
let counter=0;
const key=(kind="video")=>`mcp:${kind}:${(++counter).toString(16).padStart(64,"0")}:1`;
function input(overrides={}) {return {mcpSource:"ugc-pilot-cloud-mcp",mcpRequestFingerprint:"a".repeat(64),
 mcpGenerationContract:"advanced-v1",mcpValidatedInputFingerprint:"c".repeat(64),mcpClientRequestId:randomUUID(),userId:"owner-a",projectId:"ai-studio",
 batchIndex:1,batchSize:1,promptMode:"direct",hookIdea:"Exact user instruction",model:"google_omni",resolution:"1080p",durationSeconds:10,aspectRatio:"9:16",...overrides};}
test("new function is service-only invoker and does not replace strict V1",async()=>{
 const row=(await db.query(`select p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p where proname='mcp_create_reserved_advanced_generation_job'`)).rows[0];
 assert.deepEqual(row,{prosecdef:false,proconfig:['search_path=""'],anon:false,authenticated:false,service:true});
 await db.exec('set role service_role');
 try{assert.equal((await reserve(db,{key:key(),input:input()})).created,true);}finally{await db.exec('reset role');}
 for(const role of ['anon','authenticated']) {await db.exec(`set role ${role}`);try{await assert.rejects(reserve(db,{key:key(),input:input()}),/permission denied/);}finally{await db.exec('reset role');}}
 await assert.rejects(db.query("select public.mcp_create_reserved_generation_job($1,$2,'generate_hook_video',40,$3,$4::jsonb,'ai-generation')",['owner-a',key(),'a'.repeat(64),JSON.stringify(input({model:'kling_3_0',durationSeconds:15,resolution:'720p'}))]),/mcp_generation_input_invalid/);
});
test("all four model contracts reserve once and matching concurrency recovers one job",async()=>{
 for(const [model,resolution,durationSeconds] of [['google_omni','1080p',10],['kling_3_0','720p',15],['seedance_2_5','480p',30],['wan_3_0','1080p',2]]) {
 const args={key:key(),input:input({model,resolution,durationSeconds}),amount:durationSeconds*4};
 const results=await Promise.all([reserve(db,args),reserve(db,args)]);assert.equal(results[0].job.id,results[1].job.id);
 assert.equal(results.filter(r=>r.created).length,1);
 const counts=(await db.query('select (select count(*)::int from background_jobs where idempotency_key=$1) as jobs,(select count(*)::int from billing_credit_reservations where idempotency_key=$1) as credits',[args.key])).rows[0];assert.deepEqual(counts,{jobs:1,credits:1});
 }
});
test("invalid ownership, model, duration, quality, batch or workflow cannot reserve",async()=>{
 for(const change of [{userId:'foreign'},{projectId:'other'},{mcpGenerationContract:'v1'},{batchSize:'1'},{batchIndex:2},{durationSeconds:10.5},{durationSeconds:null},{durationSeconds:'10'},{model:'other'},
 {model:'google_omni',resolution:'480p'},{model:'kling_3_0',durationSeconds:20},{model:'seedance_2_5',durationSeconds:3},{model:'seedance_2_5',resolution:'1080p'},
 {exploreFormat:'slideshow'},{model:'kling_3_0',exploreFormat:'hook'},{hookIdea:''},{aspectRatio:'1:1'}]) {
 const k=key();await assert.rejects(reserve(db,{key:k,input:input(change)}));assert.equal((await db.query('select count(*)::int as n from billing_credit_reservations where idempotency_key=$1',[k])).rows[0].n,0);
 }
});
test("different fingerprints and orphan reservations reject; failed insertion rolls back credits",async()=>{
 const args={key:key(),input:input()};await reserve(db,args);
 await assert.rejects(reserve(db,{...args,hash:'b'.repeat(64),input:{...args.input,mcpRequestFingerprint:'b'.repeat(64)}}),/mcp_generation_idempotency_conflict/);
 const orphan=key();await db.query("insert into billing_credit_reservations(user_id,idempotency_key,job_type,amount,credit_period_start) values('owner-a',$1,'generate_hook_video',1,now())",[orphan]);
 await assert.rejects(reserve(db,{key:orphan,input:input()}),/mcp_generation_reservation_conflict/);
 const bad=key('image');await assert.rejects(reserve(db,{key:bad,kind:'image',amount:5,input:input({prompt:'reject-job',model:'nano_banana_2'})}),/background_jobs_reject_prompt_check/);
 assert.equal((await db.query('select count(*)::int as n from billing_credit_reservations where idempotency_key=$1',[bad])).rows[0].n,0);
});
test("current free-credit wrapper enforces allowance atomically and preserves replay",async()=>{
 const k=key('image');const args={owner:'free-owner',key:k,kind:'image',amount:1,input:input({userId:'free-owner',model:'nano_banana_2',prompt:'Free requested image'})};
 const first=await reserve(db,args);assert.equal((await reserve(db,args)).job.id,first.job.id);
 assert.equal((await db.query("select reserved_credits from free_generation_credit_balances where user_id='free-owner'")).rows[0].reserved_credits,1);
 await assert.rejects(reserve(db,{...args,key:key('image'),amount:100000}),/insufficient_billing_credits/);
});

test("new sibling cannot change the frozen reference fingerprint after a partial batch",async()=>{
 const firstKey=key();const firstInput=input({batchSize:2});await reserve(db,{key:firstKey,input:firstInput});
 const secondKey=firstKey.slice(0,-1)+"2";
 await assert.rejects(reserve(db,{key:secondKey,input:{...firstInput,batchIndex:2,mcpValidatedInputFingerprint:"d".repeat(64)}}),/mcp_generation_idempotency_conflict/);
 assert.equal((await db.query('select count(*)::int as n from billing_credit_reservations where idempotency_key=$1',[secondKey])).rows[0].n,0);
 const second=await reserve(db,{key:secondKey,input:{...firstInput,batchIndex:2}});assert.equal(second.created,true);
});
