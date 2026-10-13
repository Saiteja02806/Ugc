import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { importDatabase,sourceAudio,reserveImport,completeImport,visualReservation,finishingSql } from "./mcp-audio-video-import-fixture.mjs";

test("audio import RPCs are service-only invoker functions with an empty search path",async()=>{
 const db=await importDatabase();try{
  const rows=(await db.query("select proname,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') a,has_function_privilege('authenticated',oid,'EXECUTE') b,has_function_privilege('service_role',oid,'EXECUTE') s from pg_proc where proname in ('mcp_reserve_audio_import','mcp_complete_audio_import')")).rows;
  assert.equal(rows.length,2);for(const row of rows){assert.deepEqual([row.prosecdef,row.a,row.b,row.s],[false,false,false,true]);assert.deepEqual(row.proconfig,['search_path=""']);}
  const source=await sourceAudio(db);await db.exec("set role anon");await assert.rejects(reserveImport(db,source),/permission denied/);await assert.rejects(db.query("select * from audio_assets"),/permission denied/);
 }finally{await db.close();}
});
test("foreign, reference, free-test, failed and changed sources cannot reserve a snapshot",async()=>{
 const db=await importDatabase();try{
  for(const options of [{owner:"bob"},{purpose:"reference"},{testOnly:true},{status:"deleted"},{status:"processing"}]){const source=await sourceAudio(db,options);await assert.rejects(reserveImport(db,source,{owner:"alice"}),/mcp_audio_source_unavailable/);}
  const source=await sourceAudio(db);await assert.rejects(reserveImport(db,source,{snapshot:{...sourceSnapshot(source),sha256:"b".repeat(64)}}),/mcp_audio_source_changed/);
  assert.equal((await db.query("select count(*)::int n from media_assets")).rows[0].n,0);
 }finally{await db.close();}
});
import { sourceSnapshot } from "./mcp-audio-video-import-fixture.mjs";
test("lost-response and concurrent replay retain one snapshot, original location and quota slot",async()=>{
 const db=await importDatabase();try{
  const source=await sourceAudio(db),request=randomUUID();await db.exec("set role service_role");
  const [a,b]=await Promise.all([reserveImport(db,source,{request}),reserveImport(db,source,{request,privateTarget:true})]);assert.equal(a.id,b.id);assert.equal(a.url,b.url);
  for(let i=0;i<4;i++)await visualReservation(db);
  assert.equal((await reserveImport(db,source,{request})).id,a.id);await assert.rejects(reserveImport(db,source),/mcp_upload_quota_exceeded/);
  await completeImport(db,a);assert.equal((await reserveImport(db,source)).collection,"audio");
 }finally{await db.close();}
});
test("audio and visual uploads share request uniqueness and byte limits",async()=>{
 const db=await importDatabase();try{
  const source=await sourceAudio(db),request=randomUUID();await visualReservation(db,{request});await assert.rejects(reserveImport(db,source,{request}),/mcp_audio_import_conflict/);
  const audioRequest=randomUUID();await reserveImport(db,source,{request:audioRequest});await assert.rejects(visualReservation(db,{request:audioRequest}),/mcp_upload_request_conflict/);
  await visualReservation(db,{size:262144000});await visualReservation(db,{size:262100000});await assert.rejects(reserveImport(db,source),/mcp_upload_quota_exceeded/);
 }finally{await db.close();}
});
test("completion binds owner, saved request, source proof, generation and playable duration",async()=>{
 const db=await importDatabase();try{
  const source=await sourceAudio(db),row=await reserveImport(db,source);
  for(const change of [{owner:"bob"},{request:randomUUID()},{snapshot:{...row.metadata.mcpAudioSnapshot,sha256:"b".repeat(64)}},{generation:""},{duration:6}])await assert.rejects(completeImport(db,row,change),/mcp_audio_import_(not_found|invalid)/);
  const ready=await completeImport(db,row);assert.equal(ready.status,"ready");assert.equal(ready.project_id,"explore-demo");assert.equal(ready.duration_seconds,1);
  assert.equal((await completeImport(db,row)).id,ready.id);await assert.rejects(completeImport(db,row,{generation:"2"}),/mcp_audio_import_conflict/);
  await db.query("update audio_assets set status='deleted' where id=$1",[source.id]);assert.equal((await reserveImport(db,source,{request:row.metadata.mcpUploadRequestKey})).id,row.id);
  await db.query("update media_assets set deleted_at=now() where id=$1",[row.id]);await assert.rejects(reserveImport(db,source,{request:row.metadata.mcpUploadRequestKey}),/mcp_audio_import_removed/);await assert.rejects(completeImport(db,row),/mcp_audio_import_removed/);
 }finally{await db.close();}
});
test("the existing cleanup lease protects pending audio copies from concurrent cleanup",async()=>{
 const db=await importDatabase();try{
  const row=await reserveImport(db,await sourceAudio(db));await db.query("update media_assets set deleted_at=now()-interval '20 minutes' where id=$1",[row.id]);
  const claim=async()=> (await db.query("select * from mcp_claim_deleted_upload_cleanup($1,$2,now()-interval '1 second',10)",["alice",randomUUID()])).rows;
  assert.deepEqual(await claim(),[]);await db.query("update media_assets set metadata=metadata || jsonb_build_object('mcpUploadUrlExpiresAt',now()-interval '2 minutes') where id=$1",[row.id]);assert.equal((await claim()).length,1);
 }finally{await db.close();}
});
test("the actual finisher SQL accepts an owned ready imported audio media ID and rejects the private/foreign ID",async()=>{
 const db=await importDatabase();try{
  await db.exec("create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,job_type text,status text,claim_token uuid);create function create_or_get_background_job_v1(text,jsonb,text,text,integer,text,text,text) returns jsonb language plpgsql as $$ declare j public.background_jobs;begin insert into public.background_jobs(user_id,job_type,status) values($8,$4,'queued') returning * into j;return jsonb_build_object('created',true,'job',to_jsonb(j));end;$$;");await db.exec(finishingSql());
  const source=await sourceAudio(db),audio=await completeImport(db,await reserveImport(db,source)),video=await visualReservation(db);await db.query("update media_assets set status='ready' where id=$1",[video.id]);
  const finish=async(audioId,owner="alice")=>(await db.query("select explore_create_video_finish($1,$2,$3,$4::jsonb) as finish",[owner,randomUUID(),"a".repeat(64),JSON.stringify({version:1,kind:"hook",sourceAssetId:video.id,backgroundAssetId:audioId})])).rows[0].finish;
  await assert.rejects(finish(source.id),/explore_finish_asset_unavailable/);await assert.rejects(finish(audio.id,"bob"),/explore_finish_asset_unavailable/);
  assert.equal((await finish(audio.id)).draft.backgroundAssetId,audio.id);
 }finally{await db.close();}
});
