import assert from "node:assert/strict";
import { createHash,randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
registerHooks({resolve(specifier,context,nextResolve){return nextResolve(specifier==="next/server"?"next/server.js":specifier,context);}});
import { Readable } from "node:stream";
import { beforeEach,afterEach,mock,test } from "node:test";
import { importDatabase,sourceAudio,wave,visualReservation } from "../../scripts/mcp-audio-video-import-fixture.mjs";
import { confirmToolResult } from "../../scripts/mcp-confirm-client.mjs";
let db,objects,calls,lostWrite,lostReserve,lostComplete,denyHead,corruptRead,beforeCopy,prevention;
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
process.env.NEXT_PUBLIC_SUPABASE_URL="https://offline-import.supabase.co";process.env.SUPABASE_SERVICE_ROLE_KEY="offline-import";
process.env.GCP_STORAGE_BUCKET="offline-public";process.env.GCP_STORAGE_PUBLIC_BASE_URL="https://storage.googleapis.com/offline-public";
process.env.MEDIA_DELIVERY_SIGNING_SECRET="offline-audio-import-secret-longer-than-thirty-two";
function builder(table){const filters=[];let update=null;let limit=null;const execute=async single=>{
 const params=[];const conditions=[];
 for(const [column,value,kind] of filters){
  if(kind==="is"){conditions.push(column+" is null");continue;}
  if(kind==="contains"){params.push(JSON.stringify(value));conditions.push(column+" @> $"+params.length+"::jsonb");continue;}
  if(kind==="in"){params.push(value);conditions.push(column+"=any($"+params.length+"::text[])");continue;}
  params.push(value);conditions.push(`${column.includes('->>')?"metadata->>'"+column.split('->>')[1]+"'":column}=$${params.length}`);
 }
 const where=conditions.join(" and ");
 if(update){const set=Object.entries(update).map(([key,value])=>{params.push(value);return key+"=$"+params.length;}).join(",");const rows=(await db.query(`update ${table} set ${set} where ${where} returning *`,params)).rows;return {data:single?rows[0]??null:rows,error:null};}
 const rows=(await db.query(`select * from ${table} where ${where}${limit?" limit "+limit:""}`,params)).rows;return {data:single?rows[0]??null:rows,error:null};
 };return {select(){return this;},eq(column,value){filters.push([column,value]);return this;},in(column,values){filters.push([column,values,"in"]);return this;},is(column,value){assert.equal(value,null);filters.push([column,value,"is"]);return this;},contains(column,value){filters.push([column,value,"contains"]);return this;},update(value){update=value;return this;},order(){return this;},limit(value){limit=value;return this;},then(resolve,reject){return execute(false).then(resolve,reject);},async maybeSingle(){
 calls.reads++;return execute(true);
}};}
const rpcArgs={mcp_reserve_audio_import:["p_user_id","p_request_id","p_source_id","p_asset_id","p_storage_key","p_url","p_private","p_snapshot"],mcp_lease_upload_url:["p_user_id","p_asset_id"],mcp_complete_audio_import:["p_user_id","p_request_id","p_asset_id","p_snapshot","p_generation","p_duration_seconds"]};
const store={from:builder,async rpc(name,args){calls.rpc.push(name);try{
 if(name==="mcp_claim_deleted_upload_cleanup")return {data:(await db.query("select * from mcp_claim_deleted_upload_cleanup($1,$2,$3,$4)",[args.p_user_id,args.p_claim_token,args.p_deleted_before,args.p_limit])).rows,error:null};
 if(name==="mcp_finish_deleted_upload_cleanup")return {data:(await db.query("select mcp_finish_deleted_upload_cleanup($1,$2,$3) result",[args.p_user_id,args.p_asset_id,args.p_claim_token])).rows[0].result,error:null};
 const keys=rpcArgs[name],values=keys.map(k=>k==="p_snapshot"?JSON.stringify(args[k]):args[k]);
 const data=(await db.query(`select ${name}(${keys.map((k,i)=>'$'+(i+1)+(k==='p_snapshot'?'::jsonb':'')).join(',')}) as asset`,values)).rows[0].asset;
 if(name==="mcp_reserve_audio_import"&&lostReserve){lostReserve=false;throw new Error("lost reservation acknowledgement");}
 if(name==="mcp_complete_audio_import"&&lostComplete){lostComplete=false;throw new Error("lost completion acknowledgement");}
 return {data,error:null};
 }catch(error){return {data:null,error:{message:error.message}};}}};
mock.module("@supabase/supabase-js",{namedExports:{createClient:()=>store}});
mock.module("../mcp/store.ts",{namedExports:{getMcpStore:()=>store}});
mock.module("../../worker/src/lib/audio-store.ts",{namedExports:{audioDb:()=>({from:builder}),privateAudioConfigured:()=>true,readPrivateAudio:async key=>{calls.sourceReads++;return objects.get("private-audio/"+key)?.bytes??wave();}}});
// Keep the actual transfer identity checks while avoiding its unrelated speech
// service imports. No source URL or private-provider credential is invented.
mock.module("./service.ts",{namedExports:{assertAudioUploadAccess:async()=>{},uploadAudioForOwner:async()=>{throw Error("not an upload");}}});
mock.module("../gcp/credentials.ts",{namedExports:{getGoogleServiceAccountCredentials:()=>undefined,getMissingVercelGcpCredentialEnvVars:()=>[]}});
class FakeFile{
 constructor(bucket,name,generation){this.bucket=bucket;this.name=name;this.generation=generation;}
 key(){return this.bucket.name+"/"+this.name;}
 async getMetadata(){calls.heads++;if(denyHead)throw Object.assign(Error("transient object outage"),{code:503});const row=objects.get(this.key());if(!row)throw Object.assign(Error("absent"),{code:404});return [row.metadata];}
 createReadStream(){const row=objects.get(this.key());assert.equal(String(this.generation),String(row.metadata.generation));return Readable.from([corruptRead?Buffer.alloc(row.bytes.length):row.bytes]);}
 async save(bytes,options){calls.writes++;if(!options.preconditionOpts){assert.equal(bytes.length,1);const row=(await db.query("select deleted_at from media_assets where storage_key=$1",[this.name])).rows[0];assert.ok(row.deleted_at);objects.set(this.key(),{bytes:Buffer.from(bytes),metadata:{size:"1",generation:"2",contentType:options.contentType}});return;}
 assert.equal(options.preconditionOpts.ifGenerationMatch,0);assert.equal(options.validation,"crc32c");await beforeCopy?.();
 if(objects.has(this.key()))throw Object.assign(Error("already created"),{code:412});objects.set(this.key(),{bytes:Buffer.from(bytes),metadata:{size:String(bytes.length),generation:"1",contentType:options.metadata.contentType,metadata:options.metadata.metadata}});if(lostWrite){lostWrite=false;throw Error("write acknowledgement lost");}}
}
class Storage{bucket(name){return {name,file(key,options){return new FakeFile(this,key,options?.generation);},async getMetadata(){return [{iamConfiguration:{publicAccessPrevention:prevention}}];}};}}
mock.module("@google-cloud/storage",{namedExports:{Storage}});
const {importAudioForVideo,getAudioVideoImportForOwner}=await import("./video-import.ts");
const {readAudioVideoSnapshot}=await import("./video-import-storage.ts");
const {registerMutationMcpTools}=await import("../mcp/mutation-tools.ts");
const {registerUploadRecoveryMcpTools}=await import("../mcp/upload-recovery-tools.ts");
const {registerAudioVideoImportMcpTools}=await import("../mcp/audio-video-import-tools.ts");
const tools=new Map();registerAudioVideoImportMcpTools({registerTool:(name,config,callback)=>tools.set(name,{config,callback})});
const visualTools=new Map();const visualServer={registerTool:(name,config,callback)=>visualTools.set(name,{config,callback})};registerMutationMcpTools(visualServer);registerUploadRecoveryMcpTools(visualServer);
async function visualCall(name,args,owner="alice"){const t=visualTools.get(name);return confirmToolResult(async(next)=>{const result=await t.callback(t.config.inputSchema.parse(next),{http:{authInfo:{scopes:["assets:read","assets:write"],extra:{firebaseUid:owner}}}});if(!result.isError)t.config.outputSchema.parse(result.structuredContent);return result;},args);}
beforeEach(async()=>{db=await importDatabase();objects=new Map();calls={reads:0,sourceReads:0,rpc:[],writes:0,heads:0};lostWrite=false;lostReserve=false;lostComplete=false;denyHead=false;corruptRead=false;beforeCopy=null;prevention="enforced";process.env.MCP_AUDIO_VIDEO_IMPORT_ENABLED="true";process.env.MCP_PRIVATE_UPLOADS_ENABLED="false";delete process.env.PRIVATE_USER_MEDIA_ENABLED;delete process.env.GCP_PRIVATE_MEDIA_BUCKET;});
afterEach(async()=>db.close());
const input=source=>({request_id:randomUUID(),source_audio_id:source.id});
async function media(request){return (await db.query("select * from media_assets where metadata->>'mcpUploadRequestKey'=$1",[request])).rows[0];}
test("real audio probe, SQL reservation and immutable copy return a ready finisher media ID; replay never copies again",async()=>{
 const source=await sourceAudio(db),args=input(source);const ready=await importAudioForVideo("alice",args);assert.equal(ready.state,"ready");assert.notEqual(ready.media_asset_id,source.id);assert.equal(calls.writes,1);
 const row=await media(args.request_id);assert.equal(row.collection,"audio");assert.equal(row.project_id,"explore-demo");assert.equal(row.metadata.mcpAudioSnapshot.sha256,hash(wave()));
 assert.deepEqual(await importAudioForVideo("alice",args),ready);assert.deepEqual(await getAudioVideoImportForOwner("alice",args.request_id),ready);assert.equal(calls.writes,1);
 assert.equal((await db.query("select object_key,status from audio_assets where id=$1",[source.id])).rows[0].status,"ready");assert.ok(!JSON.stringify(ready).includes("storage.googleapis"));
});
test("lost storage and SQL acknowledgements recover the same media identity without another copy",async()=>{
 const source=await sourceAudio(db),args=input(source);lostReserve=true;await assert.rejects(importAudioForVideo("alice",args),/could not be confirmed/);assert.equal((await getAudioVideoImportForOwner("alice",args.request_id)).state,"pending");
 const reserved=await media(args.request_id);assert.equal((await getAudioVideoImportForOwner("alice",args.request_id)).import_id,reserved.id);assert.equal((await getAudioVideoImportForOwner("alice",args.request_id)).media_asset_id,null);lostWrite=true;lostComplete=true;await assert.rejects(importAudioForVideo("alice",args),/could not be confirmed/);
 const done=await getAudioVideoImportForOwner("alice",args.request_id);assert.equal(done.state,"ready");assert.equal(done.media_asset_id,reserved.id);assert.equal(calls.writes,1);
 assert.deepEqual(await importAudioForVideo("alice",args),done);assert.equal(calls.writes,1);
});
test("free tests, voice references and foreign/removed sources are rejected before reservation or byte reads",async()=>{
 for(const options of [{owner:"bob"},{purpose:"reference"},{testOnly:true},{status:"deleted"}])await assert.rejects(importAudioForVideo("alice",input(await sourceAudio(db,options))),/own ready audio/);
 assert.equal(calls.sourceReads,0);assert.equal(calls.writes,0);assert.equal(calls.rpc.length,0);
});
test("gate disables new imports but accepted snapshots remain recoverable without generation or plan calls",async()=>{
 const source=await sourceAudio(db),args=input(source);lostReserve=true;await assert.rejects(importAudioForVideo("alice",args));process.env.MCP_AUDIO_VIDEO_IMPORT_ENABLED="false";
 await assert.rejects(importAudioForVideo("alice",input(source)),/not enabled/);const ready=await importAudioForVideo("alice",args);assert.equal(ready.state,"ready");assert.equal(calls.writes,1);
 await db.query("update audio_assets set status='deleted' where id=$1",[source.id]);assert.deepEqual(await importAudioForVideo("alice",args),ready);
});
test("a copied pending snapshot survives original deletion; an uncopied one never substitutes changed source bytes",async()=>{
 const source=await sourceAudio(db),args=input(source);beforeCopy=async()=>{await db.query("update audio_assets set status='deleted' where id=$1",[source.id]);};assert.equal((await importAudioForVideo("alice",args)).state,"ready");
 const other=await sourceAudio(db),next=input(other);lostReserve=true;await assert.rejects(importAudioForVideo("alice",next));await db.query("update audio_assets set checksum=$1 where id=$2",["b".repeat(64),other.id]);await assert.rejects(importAudioForVideo("alice",next),/Saved audio changed/);assert.equal(calls.writes,1);
});
test("invalid hash and unplayable source bytes cannot become ready or create a storage copy",async()=>{
 const source=await sourceAudio(db),args=input(source);objects.set("private-audio/"+source.object_key,{bytes:Buffer.alloc(wave().length)});await assert.rejects(importAudioForVideo("alice",args),/Saved audio changed/);
 const invalid=Buffer.alloc(100),second=await sourceAudio(db,{bytes:invalid});objects.set("private-audio/"+second.object_key,{bytes:invalid});await assert.rejects(importAudioForVideo("alice",input(second)),/Saved audio changed|playable|validation/);assert.equal(calls.writes,0);
});
test("transient storage head errors remain pending and never cause a replacement write",async()=>{
 const source=await sourceAudio(db),args=input(source);denyHead=true;await assert.rejects(importAudioForVideo("alice",args),/transient object outage/);assert.equal(calls.writes,0);assert.equal((await getAudioVideoImportForOwner("alice",args.request_id)).state,"pending");denyHead=false;assert.equal((await importAudioForVideo("alice",args)).state,"ready");
});
test("request collisions, changed selection, foreign reads and removed copies cannot expose or resurrect a snapshot",async()=>{
 const source=await sourceAudio(db),args=input(source),ready=await importAudioForVideo("alice",args);
 const foreign=await getAudioVideoImportForOwner("bob",args.request_id);assert.equal(foreign.state,"unconfirmed");assert.equal(foreign.import_id,null);await assert.rejects(importAudioForVideo("alice",{...args,source_audio_id:randomUUID()}),/another recording/);
 const ordinary=randomUUID();await visualReservation(db,{request:ordinary});await assert.rejects(importAudioForVideo("alice",{...args,request_id:ordinary}),/another upload/);
 await db.query("update media_assets set deleted_at=now() where id=$1",[ready.media_asset_id]);assert.equal((await getAudioVideoImportForOwner("alice",args.request_id)).state,"removed");await assert.rejects(importAudioForVideo("alice",args),/removed/);assert.equal(calls.writes,1);
});
test("snapshot checksum, generation pin and stored metadata are independently verified",async()=>{
 const source=await sourceAudio(db),args=input(source);await importAudioForVideo("alice",args);const row=await media(args.request_id),proof=row.metadata.mcpAudioSnapshot;corruptRead=true;await assert.rejects(readAudioVideoSnapshot(row,proof,args.request_id),/verification failed/);corruptRead=false;
 objects.get("offline-public/"+row.storage_key).metadata.metadata.mcpAudioRequest=randomUUID();await assert.rejects(readAudioVideoSnapshot(row,proof,args.request_id),/differs/);
});
test("private rollout creates only in the verified private bucket and replay retains location after its gate changes",async()=>{
 process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";process.env.GCP_PRIVATE_MEDIA_BUCKET="offline-private";const source=await sourceAudio(db),args=input(source);lostReserve=true;await assert.rejects(importAudioForVideo("alice",args));const row=await media(args.request_id);assert.equal(row.metadata.storageLocation,"private_user_media");
 process.env.MCP_PRIVATE_UPLOADS_ENABLED="false";await assert.rejects(importAudioForVideo("alice",args),/not enabled/);assert.equal(calls.writes,0);process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";const ready=await importAudioForVideo("alice",args);assert.equal(calls.writes,1);assert.ok(objects.has("offline-private/"+row.storage_key));process.env.MCP_PRIVATE_UPLOADS_ENABLED="false";assert.deepEqual(await importAudioForVideo("alice",args),ready);
});
test("new MCP adapters validate consent and reject forged inputs before any database or storage action",async()=>{
 for(const [name,tool] of tools){const args=name==="import_audio_for_video"?{request_id:randomUUID(),source_audio_id:randomUUID()}:{request_id:randomUUID()};
  for(const field of ["user_id","url","object_key","credits","test_only","mime_type"])assert.equal(tool.config.inputSchema.safeParse({...args,[field]:"forged"}).success,false);
  const result=await tool.callback(args,{http:{authInfo:{scopes:[],extra:{firebaseUid:"alice"}}}});assert.equal(JSON.parse(result.content[0].text).code,"INSUFFICIENT_SCOPE");
  const noAuth=await tool.callback(args,{});assert.equal(JSON.parse(noAuth.content[0].text).code,"UNAUTHENTICATED");
 }
 assert.equal(calls.reads,0);assert.equal(calls.writes,0);assert.equal(calls.rpc.length,0);
 const tool=tools.get("get_audio_video_import"),result=await tool.callback({request_id:randomUUID()},{http:{authInfo:{scopes:["assets:read"],extra:{firebaseUid:"alice"}}}});tool.config.outputSchema.parse(result.structuredContent);assert.equal(result.structuredContent.state,"unconfirmed");
});

test("the actual delete adapter removes pending/ready snapshots by import ID without deleting private audio",async()=>{
 const source=await sourceAudio(db),pending=input(source);lostReserve=true;await assert.rejects(importAudioForVideo("alice",pending));const receipt=await getAudioVideoImportForOwner("alice",pending.request_id);assert.ok(receipt.import_id);assert.equal(receipt.media_asset_id,null);
 assert.equal((await visualCall("delete_asset",{asset_id:receipt.import_id},"bob")).isError,true);assert.equal((await getAudioVideoImportForOwner("alice",pending.request_id)).state,"pending");
 assert.equal((await visualCall("delete_asset",{asset_id:receipt.import_id})).structuredContent.deleted,true);assert.equal((await getAudioVideoImportForOwner("alice",pending.request_id)).state,"removed");await assert.rejects(importAudioForVideo("alice",pending),/removed/);
 const ready=await importAudioForVideo("alice",input(source));const writes=calls.writes;assert.equal((await visualCall("delete_asset",{asset_id:ready.import_id})).structuredContent.deleted,true);assert.equal(calls.writes,writes);assert.equal((await db.query("select status from audio_assets where id=$1",[source.id])).rows[0].status,"ready");
});
test("ordinary visual upload discovery/renewal cannot expose or replace an audio snapshot",async()=>{
 const source=await sourceAudio(db),args=input(source);lostReserve=true;await assert.rejects(importAudioForVideo("alice",args));const row=await media(args.request_id);
 assert.equal((await visualCall("get_upload",{upload_id:row.id})).isError,true);assert.equal((await visualCall("renew_upload",{upload_id:row.id})).isError,true);assert.deepEqual((await visualCall("list_uploads",{status:"all"})).structuredContent.items,[]);
 const confirm=await visualCall("confirm_upload",{upload_id:row.id,width:640,height:640,duration_seconds:1});assert.equal(confirm.isError,true);assert.equal(calls.writes,0);assert.equal((await media(args.request_id)).status,"uploading");
});

test("canonical MIME aliases produce a playable editing copy, while mismatched containers are rejected",async()=>{
 const alias=await sourceAudio(db,{mime:"audio/x-wav"}),result=await importAudioForVideo("alice",input(alias));assert.equal((await db.query("select mime_type from media_assets where id=$1",[result.media_asset_id])).rows[0].mime_type,"audio/wav");
 const mismatched=await sourceAudio(db,{mime:"audio/mpeg"});await assert.rejects(importAudioForVideo("alice",input(mismatched)),/Saved audio changed/);assert.equal(calls.writes,1);
});
test("generated speech with its real MP3 container and generation identity becomes a separate ready editing copy",async()=>{
 const {createRequire}=await import("node:module"),{spawnSync}=await import("node:child_process"),require=createRequire(import.meta.url);
 const converted=spawnSync(require("ffmpeg-static"),["-v","error","-f","wav","-i","pipe:0","-f","mp3","pipe:1"],{input:wave(),windowsHide:true,maxBuffer:1024*1024});assert.equal(converted.status,0,String(converted.stderr));
 const {probeAudio}=await import("../../worker/src/lib/audio-media.ts");const duration=await probeAudio(converted.stdout,{ffmpeg:require("ffmpeg-static"),ffprobe:require("ffprobe-static").path});
 const source=await sourceAudio(db,{purpose:"generated",bytes:converted.stdout,mime:"audio/mpeg",duration});objects.set("private-audio/"+source.object_key,{bytes:converted.stdout});const args=input(source);
 const tool=tools.get("import_audio_for_video"),result=await tool.callback(args,{http:{authInfo:{scopes:["assets:write"],extra:{firebaseUid:"alice"}}}});tool.config.outputSchema.parse(result.structuredContent);assert.equal(result.isError,undefined);assert.equal(result.structuredContent.state,"ready");assert.notEqual(result.structuredContent.media_asset_id,source.id);assert.equal(calls.writes,1);
});
test("simultaneous import calls preserve one reservation and one immutable object",async()=>{
 const source=await sourceAudio(db),args=input(source);const [a,b]=await Promise.all([importAudioForVideo("alice",args),importAudioForVideo("alice",args)]);assert.deepEqual(a,b);
 assert.equal((await db.query("select count(*)::int n from media_assets")).rows[0].n,1);assert.equal([...objects.keys()].filter(k=>k.startsWith("offline-public/")).length,1);
});
test("private destination policy failure cannot reserve, write or fall back to public storage",async()=>{
 process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";process.env.GCP_PRIVATE_MEDIA_BUCKET="offline-private";prevention="inherited";await assert.rejects(importAudioForVideo("alice",input(await sourceAudio(db))),/access-policy check/);
 assert.equal(calls.writes,0);assert.equal((await db.query("select count(*)::int n from media_assets")).rows[0].n,0);assert.equal(objects.size,0);
});
