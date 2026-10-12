import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
async function setup() {
 const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
 const baseline=readFileSync(new URL("../supabase/migrations/20260829093001_production_baseline_v1.sql",import.meta.url),"utf8");
 const start=baseline.indexOf('CREATE TABLE "public"."media_assets" (');
 await db.exec(baseline.slice(start,baseline.indexOf("\n);",start)+3));
 await db.exec("alter table media_assets enable row level security; grant all on media_assets to service_role;");
 for(const file of ["20260928151747_mcp_upload_quota.sql","20261011171055_mcp_upload_recovery.sql","20261012105853_mcp_private_upload.sql"])
  await db.exec(readFileSync(new URL("../supabase/migrations/"+file,import.meta.url),"utf8"));
 return db;
}
async function reserve(db,{owner="owner",request=randomUUID(),asset=randomUUID(),privateUpload=true,url,fingerprint="a".repeat(64)}={}) {
 const key=`media/${owner}/video/${asset}.mp4`;
 return (await db.query(`select ${privateUpload ? "mcp_reserve_private_upload" : "mcp_reserve_upload"}($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as asset`,
  [owner,request,fingerprint,asset,"video","upload","hook.mp4",1024,"video/mp4",key,"Hook",url??`https://storage.googleapis.com/offline-private/${key}`])).rows[0].asset;
}
test("private location and durable canonical URL are committed with one stable request and shared quota",async()=>{
 const db=await setup();try{
  await db.exec("set role service_role");
  const request=randomUUID();
  const [first,replay]=await Promise.all([reserve(db,{request}),reserve(db,{request})]);
  assert.equal(first.id,replay.id);assert.equal(first.metadata.storageLocation,"private_user_media");
  assert.equal(first.url,replay.url);assert.equal(first.storage_key,replay.storage_key);
  for(let i=0;i<4;i++)await reserve(db,{privateUpload:i%2===0});
  await assert.rejects(reserve(db),/mcp_upload_quota_exceeded/);
  assert.equal((await reserve(db,{request})).id,first.id);
 }finally{await db.close();}
});
test("rollout replay never retags a public object or relocates a private object",async()=>{
 const db=await setup();try{
  const request=randomUUID(),p=await reserve(db,{request,privateUpload:false,url:"https://cdn.example.test/old-public.mp4"});
  const replay=await reserve(db,{request});
  assert.equal(replay.id,p.id);assert.equal(replay.url,p.url);assert.equal(replay.metadata.storageLocation,undefined);
  const privateRequest=randomUUID(),v=await reserve(db,{request:privateRequest});
  const offReplay=await reserve(db,{request:privateRequest,privateUpload:false});
  assert.equal(offReplay.url,v.url);assert.equal(offReplay.metadata.storageLocation,"private_user_media");
  const lease=(await db.query("select mcp_lease_upload_url($1,$2) as asset",["owner",v.id])).rows[0].asset;
  assert.equal(lease.metadata.storageLocation,"private_user_media");assert.equal(lease.storage_key,v.storage_key);
 }finally{await db.close();}
});
test("foreign/deleted/conflicting input cannot mutate the original receipt; malformed private URL rolls back the reservation",async()=>{
 const db=await setup();try{
  const request=randomUUID(),a=await reserve(db,{request});
  assert.notEqual((await reserve(db,{owner:"other",request})).id,a.id);
  await assert.rejects(reserve(db,{request,fingerprint:"b".repeat(64)}),/mcp_upload_request_conflict/);
  await db.query("update media_assets set deleted_at=now() where id=$1",[a.id]);
  await assert.rejects(reserve(db,{request}),/mcp_upload_deleted/);
  const before=(await db.query("select count(*)::int as n from media_assets")).rows[0].n;
  for(const url of ["https://foreign.test/media/file.mp4","https://storage.googleapis.com/private/media/wrong.mp4"])
   await assert.rejects(reserve(db,{url}),/mcp_upload_input_invalid/);
  assert.equal((await db.query("select count(*)::int as n from media_assets")).rows[0].n,before);
 }finally{await db.close();}
});
test("private reservation RPC is invoker-only with no public role execution",async()=>{
 const db=await setup();try{
  const [r]=(await db.query("select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon,has_function_privilege('authenticated',oid,'execute') as auth,has_function_privilege('service_role',oid,'execute') as service from pg_proc where proname='mcp_reserve_private_upload'")).rows;
  assert.deepEqual([r.prosecdef,r.anon,r.auth,r.service],[false,false,false,true]);
  assert.ok(r.proconfig.some(v=>v.startsWith("search_path=")));
 }finally{await db.close();}
});
