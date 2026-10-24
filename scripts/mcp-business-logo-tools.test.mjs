import assert from "node:assert/strict";
import { confirmToolResult } from "./mcp-confirm-client.mjs";
import {readFile,readdir} from "node:fs/promises";
import {randomUUID,createHash} from "node:crypto";
import {before,after,test,mock} from "node:test";
import sharp from "sharp";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import {uuid_ossp} from "@electric-sql/pglite/contrib/uuid_ossp";
import {createMcpHandler,McpServer} from "@modelcontextprotocol/server";
let requests=[],signs=[],objects=new Map(),loseAck=false,outage=false,storageFail=false;
const originalFetch=globalThis.fetch,keys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","MCP_BUSINESS_MEDIA_WRITES_ENABLED"],oldEnv=keys.map(key=>[key,process.env[key]]);
Object.assign(process.env,{SUPABASE_URL:"https://logo-fixture.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"offline-fixture",MCP_BUSINESS_MEDIA_WRITES_ENABLED:"true"});
mock.module("../lib/storage/storage.ts",{namedExports:{
 getMissingStorageEnvVars:()=>[],buildPublicStorageUrl:key=>`https://media.example.com/${key}`,buildDirectStorageUrl:key=>`https://media.example.com/${key}`,isTrustedStorageUrl:()=>true,getStorageProviderName:()=>"gcp",
 createSignedPutUrl:async input=>{signs.push(input);if(storageFail)throw Error("private-signing-key");return "https://storage.googleapis.com/offline-logo?X-Goog-Signature=ephemeral";},
 headStorageObject:async({key})=>{if(storageFail)throw Error("private-storage-key");const bytes=objects.get(key);if(!bytes)throw Object.assign(Error("not found"),{name:"NoSuchKey"});return {ContentLength:bytes.length,ContentType:"image/png"};},
 getStorageObject:async({key})=>{const bytes=objects.get(key);if(!bytes)throw Object.assign(Error("not found"),{name:"NoSuchKey"});return {ContentLength:bytes.length,ContentType:"image/png",Body:{transformToWebStream:()=>new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})}};},
 createSignedDownloadUrl:()=>{throw Error("Unexpected download");},deleteStorageObject:()=>{throw Error("Unexpected deletion");},uploadBufferToStorage:()=>{throw Error("Unexpected media rewrite");},
}});
const db=new PGlite({extensions:{pgcrypto,uuid_ossp}});
globalThis.fetch=async(input,init)=>{
 const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);assert.equal(url.hostname,"logo-fixture.supabase.co");requests.push({path:url.pathname,method:request.method});
 if(outage)return Response.json({message:"private-db-key"},{status:500});
 if(request.method==="POST"){
  const body=await request.json();assert.ok(body.p_user_id);let sql,args;
  if(url.pathname.endsWith("/mcp_reserve_business_logo")){sql="select mcp_reserve_business_logo($1,$2,$3::jsonb,$4) result";args=[body.p_user_id,body.p_request_id,JSON.stringify(body.p_input),body.p_key];}
  else if(url.pathname.endsWith("/mcp_lease_business_logo")){sql="select mcp_lease_business_logo($1,$2) result";args=[body.p_user_id,body.p_upload_id];}
  else {assert.ok(url.pathname.endsWith("/mcp_confirm_business_logo"));sql="select mcp_confirm_business_logo($1,$2,$3::jsonb,$4) result";args=[body.p_user_id,body.p_upload_id,JSON.stringify(body.p_logo),body.p_sha256];}
  try{const result=(await db.query(sql,args)).rows[0].result;if(loseAck){loseAck=false;return Response.json({message:"lost-after-commit"},{status:500});}return Response.json(result);}catch(error){return Response.json({message:error.message,code:error.code},{status:400});}
 }
 assert.equal(request.method,"GET");assert.equal(url.pathname,"/rest/v1/mcp_business_logo_uploads");const uid=url.searchParams.get("user_id");assert.ok(uid?.startsWith("eq."));const args=[uid.slice(3)];let sql="select * from mcp_business_logo_uploads where user_id=$1";
 for(const column of ["id","request_id"]){const filter=url.searchParams.get(column);if(filter){assert.ok(filter.startsWith("eq."));args.push(filter.slice(3));sql+=` and ${column}=$${args.length}`;}}
 const or=url.searchParams.get("or");if(or){const match=or.match(/created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]*)/);assert.ok(match);assert.equal(match[1],match[2]);args.push(match[1],match[3]);sql+=` and (created_at<$${args.length-1}::timestamptz or (created_at=$${args.length-1}::timestamptz and id<$${args.length}::uuid))`;}
 sql+=" order by created_at desc,id desc";const limit=url.searchParams.get("limit");if(limit){args.push(Number(limit));sql+=` limit $${args.length}`;}
 const rows=(await db.query(`select to_jsonb(_r) data from (${sql}) _r`,args)).rows.map(row=>row.data);return Response.json(request.headers.get("accept")?.includes("vnd.pgrst.object")?rows[0]??null:rows);
};
const {registerBusinessLogoMcpTools,registeredBusinessLogoMcpTools}=await import("../lib/mcp/business-logo-tools.ts");
const {inspectBusinessLogoWithChecksum}=await import("../lib/business-profiles/logo.ts");
const handler=createMcpHandler(()=>{const server=new McpServer({name:"fixture",version:"1"});registerBusinessLogoMcpTools(server);return server;},{legacy:"stateless"});
let png;
before(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema extensions;");
 const root=new URL("../supabase/migrations/",import.meta.url);
 for(const file of (await readdir(root)).filter(f=>f.endsWith(".sql")).sort())await db.exec((await readFile(new URL(file,root),"utf8")).replaceAll("\r\n","\n"));
 png=await sharp({create:{width:128,height:128,channels:3,background:"#a14261"}}).png().toBuffer();
},{timeout:120000});
after(async()=>{globalThis.fetch=originalFetch;for(const[key,value]of oldEnv){if(value===undefined)delete process.env[key];else process.env[key]=value;}await db.close();});
const owner=()=>`logo-owner-${randomUUID()}`;
const intent=(bytes=png,key=randomUUID())=>({request_id:key,file_name:"brand-logo.png",mime_type:"image/png",file_size_bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
async function rpc(method,params,uid,scopes=["brand:read","brand:write"]){const response=await handler.fetch(new Request("https://mcp.getugcpilot.com/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}),{authInfo:{token:"fixture",clientId:"fixture",scopes,extra:{firebaseUid:uid}}});const text=await response.text(),line=text.split("\n").find(line=>line.startsWith("data: "));return JSON.parse(line?line.slice(6):text);}
async function call(name,args,uid,scopes){return confirmToolResult(async(next)=>{const body=await rpc("tools/call",{name,arguments:next},uid,scopes);return body.result??{isError:true,content:[{type:"text",text:JSON.stringify(body.error)}]};},args);}
function ok(result){assert.ok(!result.isError,JSON.stringify(result));return result.structuredContent;}
function code(result){assert.equal(result.isError,true,JSON.stringify(result));return JSON.parse(result.content[0].text).code;}
async function one(sql,args=[]){return (await db.query(sql,args)).rows[0];}
async function reserve(uid=owner(),input=intent()){return {uid,input,result:ok(await call("create_business_logo_upload",input,uid))};}
async function stored(id){return one("select * from mcp_business_logo_uploads where id=$1",[id]);}

test("six actual SDK registrations have explicit brand scopes and pure limits",async()=>{
 const uid=owner(),tools=(await rpc("tools/list",{},uid)).result.tools;assert.deepEqual(tools.map(tool=>tool.name).sort(),[...registeredBusinessLogoMcpTools].sort());
 for(const tool of tools){assert.equal(tool.annotations.openWorldHint,false);assert.deepEqual(tool._meta.securitySchemes[0].scopes,[tool.annotations.readOnlyHint?"brand:read":"brand:write"]);}
 requests=[];signs=[];const cap=ok(await call("get_business_logo_upload_capabilities",{},uid));assert.equal(cap.max_bytes,2097152);assert.equal(cap.max_dimension,4096);assert.equal(cap.schema_verification_required,true);assert.equal(requests.length,0);assert.equal(signs.length,0);
});
test("reservation is durable before any URL; lost response recovers and exact replay cannot duplicate",async()=>{
 const uid=owner(),input=intent();signs=[];loseAck=true;assert.equal(code(await call("create_business_logo_upload",input,uid)),"LOGO_UPLOAD_UNAVAILABLE");
 const recovered=ok(await call("get_business_logo_upload",{request_id:input.request_id},uid)).upload;assert.equal(recovered.status,"uploading");assert.equal(recovered.logo,null);assert.equal(signs.length,0);
 const replay=ok(await call("create_business_logo_upload",input,uid));assert.equal(replay.replayed,true);assert.equal(replay.upload.upload_id,recovered.upload_id);
 assert.equal(code(await call("create_business_logo_upload",{...input,file_name:"different.png"},uid)),"REQUEST_CONFLICT");assert.equal((await one("select count(*)::int n from mcp_business_logo_uploads where user_id=$1",[uid])).n,1);
});
test("renew signs create-only bounded PUT and does not issue a replacement if bytes exist",async()=>{
 const {uid,result}=await reserve(),id=result.upload.upload_id;signs=[];const lease=ok(await call("renew_business_logo_upload",{upload_id:id},uid));
 assert.equal(lease.upload_id,id);assert.equal(lease.required_headers["x-goog-if-generation-match"],"0");assert.equal(lease.required_headers["x-goog-content-length-range"],`1,${png.length}`);assert.equal(signs[0].createOnly,true);assert.equal(signs[0].maxBytes,png.length);assert.ok(signs[0].expiresInSeconds<=600);
 objects.set((await stored(id)).storage_key,png);assert.equal(code(await call("renew_business_logo_upload",{upload_id:id},uid)),"UPLOAD_ALREADY_TRANSFERRED");assert.equal(signs.length,1);
});
test("actual image decoding and checksum confirmation returns an owned logo without attaching it",async()=>{
 const {uid,result}=await reserve(),id=result.upload.upload_id,row=await stored(id);objects.set(row.storage_key,png);
 const confirmed=ok(await call("confirm_business_logo_upload",{upload_id:id},uid)).upload;assert.equal(confirmed.status,"ready");assert.equal(confirmed.logo.storageKey,row.storage_key);assert.equal(confirmed.logo.width,128);assert.equal(confirmed.logo.mimeType,"image/png");
 const replay=ok(await call("confirm_business_logo_upload",{upload_id:id},uid)).upload;assert.deepEqual(replay,confirmed);assert.equal((await one("select count(*)::int n from business_profiles where user_id=$1",[uid])).n,0);
 await assert.rejects(db.query("update mcp_business_logo_uploads set status='uploading' where id=$1",[id]),/immutable/);
 await assert.rejects(db.query("update mcp_business_logo_uploads set input_json=input_json||'{\"sha256\":\"other\"}' where id=$1",[id]),/immutable/);
});
test("missing, different and invalid image bytes cannot become ready",async()=>{
 const {uid,result}=await reserve(),id=result.upload.upload_id,row=await stored(id);
 assert.equal(code(await call("confirm_business_logo_upload",{upload_id:id},uid)),"UPLOAD_NOT_TRANSFERRED");
 objects.set(row.storage_key,Buffer.from(png));objects.get(row.storage_key)[0]=0;assert.equal(code(await call("confirm_business_logo_upload",{upload_id:id},uid)),"UPLOAD_MISMATCH");assert.equal((await stored(id)).status,"uploading");
 objects.set(row.storage_key,png);const invalidExpected={mimeType:"image/png",fileSizeBytes:png.length,sha256:"0".repeat(64)};
 await assert.rejects(inspectBusinessLogoWithChecksum({key:row.storage_key,userId:uid,expected:invalidExpected}),/differs/);
 const small=await sharp({create:{width:32,height:32,channels:3,background:"red"}}).png().toBuffer(),other=await reserve(uid,intent(small));objects.set((await stored(other.result.upload.upload_id)).storage_key,small);
 assert.equal(code(await call("confirm_business_logo_upload",{upload_id:other.result.upload.upload_id},uid)),"UPLOAD_MISMATCH");
});
test("confirmation lost after commit is recovered without another image transfer",async()=>{
 const {uid,result}=await reserve(),id=result.upload.upload_id;objects.set((await stored(id)).storage_key,png);loseAck=true;
 assert.equal(code(await call("confirm_business_logo_upload",{upload_id:id},uid)),"LOGO_UPLOAD_UNAVAILABLE");assert.equal(ok(await call("get_business_logo_upload",{upload_id:id},uid)).upload.status,"ready");assert.equal(ok(await call("confirm_business_logo_upload",{upload_id:id},uid)).upload.status,"ready");
});
test("owner-bound history preserves timestamp precision and rejects another account's cursor",async()=>{
 const uid=owner();for(let n=0;n<3;n++)await reserve(uid);
 await db.query("update mcp_business_logo_uploads set created_at=created_at where user_id=$1",[uid]);
 const first=ok(await call("list_business_logo_uploads",{limit:2},uid)),second=ok(await call("list_business_logo_uploads",{limit:2,cursor:first.next_cursor},uid));assert.equal(first.items.length,2);assert.equal(second.items.length,1);assert.equal(second.next_cursor,null);
 assert.equal(code(await call("list_business_logo_uploads",{limit:2,cursor:first.next_cursor},owner())),"INVALID_CURSOR");assert.equal(code(await call("get_business_logo_upload",{upload_id:first.items[0].upload_id},owner())),"NOT_FOUND");
});
test("gate and missing write consent reject before reservation/signing; reads still recover",async()=>{
 const {uid,result}=await reserve();requests=[];signs=[];process.env.MCP_BUSINESS_MEDIA_WRITES_ENABLED="false";
 try{assert.equal(code(await call("create_business_logo_upload",intent(),uid)),"BUSINESS_MEDIA_WRITES_DISABLED");assert.equal(requests.length,0);assert.equal(signs.length,0);assert.equal(ok(await call("get_business_logo_upload",{upload_id:result.upload.upload_id},uid)).upload.status,"uploading");}finally{process.env.MCP_BUSINESS_MEDIA_WRITES_ENABLED="true";}
 requests=[];assert.equal((await call("create_business_logo_upload",intent(),uid,["brand:read"])).isError,true);assert.equal(requests.length,0);
});
test("signing failures keep the original reservation; expired renewal does not create another",async()=>{
 const {uid,result}=await reserve(),id=result.upload.upload_id;storageFail=true;
 try{assert.equal(code(await call("renew_business_logo_upload",{upload_id:id},uid)),"STORAGE_UNAVAILABLE");}finally{storageFail=false;}
 await db.exec("begin;alter table mcp_business_logo_uploads disable trigger guard_mcp_business_logo_upload;");try{await db.query("update mcp_business_logo_uploads set created_at=now()-interval '25 hours' where id=$1",[id]);await db.exec("alter table mcp_business_logo_uploads enable trigger guard_mcp_business_logo_upload;commit;");}catch(error){await db.exec("rollback");throw error;}
 assert.equal(code(await call("renew_business_logo_upload",{upload_id:id},uid)),"UPLOAD_LINK_EXPIRED");objects.set((await stored(id)).storage_key,png);assert.equal(ok(await call("confirm_business_logo_upload",{upload_id:id},uid)).upload.status,"ready");
});
test("service-only permissions block direct clients and foreign confirmations",async()=>{
 for(const role of ["anon","authenticated"]){assert.equal((await one("select has_table_privilege($1,'public.mcp_business_logo_uploads','SELECT') allowed",[role])).allowed,false);assert.equal((await one("select has_function_privilege($1,'public.mcp_reserve_business_logo(text,uuid,jsonb,text)','EXECUTE') allowed",[role])).allowed,false);}
 assert.equal((await one("select relrowsecurity enabled from pg_class where oid='public.mcp_business_logo_uploads'::regclass")).enabled,true);
 const {uid,result}=await reserve(),id=result.upload.upload_id;assert.equal(code(await call("confirm_business_logo_upload",{upload_id:id},owner())),"NOT_FOUND");await assert.rejects(db.query("select mcp_confirm_business_logo($1,$2,$3::jsonb,$4)",[uid,id,JSON.stringify({storageKey:"foreign",fileSizeBytes:png.length,mimeType:"image/png",width:128,height:128,url:"https://media.example.com/a.png"}),intent().sha256]),/mismatch/);
});

test("pending MCP logo cannot attach through website or MCP identity writes; verified one can",async()=>{
 const {uid,result}=await reserve(),id=result.upload.upload_id,row=await stored(id),logo={storageKey:row.storage_key,url:`https://media.example.com/${row.storage_key}`,mimeType:"image/png",fileSizeBytes:png.length,width:128,height:128};
 const d=(await one("select * from mutate_business_onboarding_v1($1,'start',$2::jsonb)",[uid,JSON.stringify({requestKey:randomUUID(),input:{intakeType:"manual",experience:"streamlined",businessName:"Logo fixture",description:"Organizes exact saved marketing plans for businesses."}})]));
 const identity={draftId:d.id,revision:d.revision,businessName:"Same exact name",logo};
 await assert.rejects(db.query("select mutate_business_onboarding_v1($1,'identity',$2::jsonb)",[uid,JSON.stringify(identity)]),/attachment_not_verified/);
 objects.set(row.storage_key,png);ok(await call("confirm_business_logo_upload",{upload_id:id},uid));
 const accepted=await one("select * from mutate_business_onboarding_v1($1,'identity',$2::jsonb)",[uid,JSON.stringify(identity)]);assert.deepEqual(accepted.logo,logo);assert.equal(accepted.business_name,"Same exact name");
});
test("twenty pending logo quota is serialized per owner and replay stays recoverable at quota",async()=>{
 const uid=owner(),first=await reserve(uid);for(let n=1;n<20;n++)await reserve(uid);
 assert.equal(code(await call("create_business_logo_upload",intent(),uid)),"UPLOAD_QUOTA_EXCEEDED");assert.equal(ok(await call("create_business_logo_upload",first.input,uid)).replayed,true);
 const other=await reserve(owner(),first.input);assert.notEqual(other.result.upload.upload_id,first.result.upload.upload_id);
});
