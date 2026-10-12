import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
export const migration="20261012135219_mcp_audio_video_import.sql";
const sql=name=>readFileSync(new URL("../supabase/migrations/"+name,import.meta.url),"utf8");
export async function importDatabase(){
  const db=new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
  const baseline=sql("20260829093001_production_baseline_v1.sql"),start=baseline.indexOf('CREATE TABLE "public"."media_assets" (');assert.ok(start>=0);
  await db.exec(baseline.slice(start,baseline.indexOf("\n);",start)+3));
  await db.exec(sql("20260930153000_ai_studio_audio_references.sql"));
  const audio=sql("20261001120000_audio_generation.sql"),a=audio.indexOf("create table public.audio_assets (");assert.ok(a>=0);
  await db.exec(audio.slice(a,audio.indexOf("\n);",a)+3));
  await db.exec("alter table media_assets enable row level security;alter table audio_assets enable row level security;grant all on media_assets,audio_assets to service_role;");
  for(const file of ["20260928151747_mcp_upload_quota.sql","20261011171055_mcp_upload_recovery.sql",migration])await db.exec(sql(file));
  return db;
}
export function wave(){const bytes=Buffer.alloc(32044);bytes.write("RIFF",0);bytes.writeUInt32LE(32036,4);bytes.write("WAVEfmt ",8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write("data",36);bytes.writeUInt32LE(32000,40);return bytes;}
export async function sourceAudio(db,{owner="alice",purpose="exact",status="ready",testOnly=false,bytes=wave(),mime="audio/wav",duration=1}={}){
  const id=randomUUID(),key=`${encodeURIComponent(owner)}/${id}/${purpose==="generated"?"final.mp3":"recording-"+randomUUID()}`,hash=createHash("sha256").update(bytes).digest("hex");
  await db.query("insert into audio_assets(id,user_id,name,purpose,object_key,mime_type,size_bytes,duration_seconds,checksum,status,test_only) values($1,$2,'Saved narration',$3,$4,$9,$5,$10,$6,$7,$8)",[id,owner,purpose,key,bytes.length,hash,status,testOnly,mime,duration]);
  if(purpose==="generated")await db.query("update audio_assets set generation_id=id where id=$1",[id]);
  return (await db.query("select * from audio_assets where id=$1",[id])).rows[0];
}
export function sourceSnapshot(row){return {sha256:row.checksum,size:row.size_bytes,mime_type:row.mime_type,duration_seconds:Number(row.duration_seconds),object_identity:createHash("sha256").update(row.object_key).digest("hex")};}
export async function reserveImport(db,source,{owner=source.user_id,request=randomUUID(),asset=randomUUID(),privateTarget=false,snapshot=sourceSnapshot(source)}={}){
  const key=`media/${owner}/audio/${asset}.wav`;
  return (await db.query("select mcp_reserve_audio_import($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as asset",[owner,request,source.id,asset,key,`https://storage.googleapis.com/${privateTarget?"private":"public"}/${key}`,privateTarget,JSON.stringify(snapshot)])).rows[0].asset;
}
export async function completeImport(db,row,{owner=row.user_id,request=row.metadata.mcpUploadRequestKey,snapshot=row.metadata.mcpAudioSnapshot,generation="1",duration=1}={}){
  return (await db.query("select mcp_complete_audio_import($1,$2,$3,$4::jsonb,$5,$6) as asset",[owner,request,row.id,JSON.stringify(snapshot),generation,duration])).rows[0].asset;
}
export async function visualReservation(db,{owner="alice",request=randomUUID(),size=1024}={}){const id=randomUUID();
 return (await db.query("select mcp_reserve_upload($1,$2,$3,$4,'video','upload','hook.mp4',$5,'video/mp4',$6,'Hook',$7) as asset",[owner,request,"a".repeat(64),id,size,`media/${owner}/video/${id}.mp4`,`https://example.test/${id}.mp4`])).rows[0].asset;
}
// The import acceptance test exercises actual finishing receipts/asset guards.
// Its unrelated renderer-lease patch needs the full worker ledger, so omit it.
export const finishingSql=()=>sql("20261004053418_explore_video_finishing.sql").split("-- Extend the CURRENT")[0];
