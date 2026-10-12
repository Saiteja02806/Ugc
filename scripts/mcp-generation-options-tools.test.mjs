import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after,beforeEach,mock,test } from "node:test";
import { McpServer,createMcpHandler } from "@modelcontextprotocol/server";
import { advancedDb,reserve } from "./mcp-advanced-generation-fixture.mjs";
const local=file=>new URL(file,import.meta.url);
const db=await advancedDb();after(()=>db.close());
const assets=new Map(),jobs=new Map();
let free=false,planError=false,missing=false,failAt=0,lostAck=false,dispatches=0,creations=0,reads=0;
class McpGenerationJobError extends Error {constructor(code,message){super(message);this.code=code;}}
class FirebaseAuthRequestError extends Error {status=401;}
class BillingAccessError extends Error {status=402;}
mock.method(globalThis,"fetch",()=>assert.fail("Offline fixture must not contact production/provider"));
mock.module(local("../lib/billing/subscription-db.ts"),{namedExports:{
 getUserSubscription:async(owner,opts)=>{assert.equal(owner,"owner-a");assert.equal(opts.refreshCredits,false);assert.equal(typeof opts.initializeFreeCredits,"boolean");if(planError)throw new Error("private billing diagnostic");return {isActive:!free,freeGenerationCredits:{granted:free?2:0}};},
 getGenerationCreditCost:(kind,duration=1)=>kind==="image"?1:duration*4,
 BillingAccessError, reserveBillingCredits:()=>assert.fail("Must use one atomic transaction"),releaseBillingCredits:()=>assert.fail("Shared adapter must not release a frozen transaction"),deliverBillingUsageForJob:async()=>{},
}});
mock.module(local("../lib/queues/job-queue.ts"),{namedExports:{getMissingJobQueueEnvVars:()=>missing?["QUEUE"]:[]}});
mock.module(local("../lib/ai-studio/server-access.ts"),{namedExports:{requireAIStudioProUser:()=>assert.fail("MCP must not authenticate through Firebase HTTP")}});
mock.module(local("../lib/firebase/server-auth.ts"),{namedExports:{FirebaseAuthRequestError}});
mock.module(local("../lib/explore/hook-video-library.ts"),{namedExports:{isExploreHookVideoId:id=>id==="hook-fixture"}});
mock.module(local("../lib/explore/wall-text-video-library.ts"),{namedExports:{isExploreWallTextVideoId:id=>id==="wall-fixture"}});
mock.module(local("../lib/explore/generation-video-reference.ts"),{namedExports:{resolveGalleryGenerationVideo:async(id,format)=>{assert.equal(id,"hook-fixture");assert.equal(format,"hook");return {url:"https://owned-media.example.test/gallery.mp4",durationSeconds:6.25};}}});
mock.module(local("../lib/media/media-reference.ts"),{namedExports:{canonicalMediaReference:async(value,owner)=>{assert.equal(owner,"owner-a");return value;},isTrustedMediaReferenceUrl:url=>new URL(url).hostname==="owned-media.example.test"}});
mock.module(local("../lib/media/media-storage.ts"),{namedExports:{getMediaAssetForOwner:async({assetId,userId})=>{reads++;assert.equal(userId,"owner-a");return assets.get(assetId)??null;},listMediaAssetsPage:async()=>({items:[],next_cursor:null})}});
mock.module(local("../lib/jobs/background-jobs.ts"),{namedExports:{
 McpGenerationJobError,getMissingBackgroundJobStorageEnvVars:()=>missing?["DB"]:[],getBackgroundJobById:async()=>null,
 getBackgroundJobForUser:async()=>null,getBackgroundJobByIdempotencyKey:async(key,scope)=>{assert(scope.userId);const row=jobs.get(key);return row&&row.userId===scope.userId&&row.jobType===scope.jobType?row:null;},
}});
mock.module(local("../lib/jobs/background-job-service.ts"),{namedExports:{
 createAndDispatchBackgroundJob:()=>assert.fail("Website submission path must not run"),
 dispatchQueuedBackgroundJobForRecovery:async job=>{if(job.status==="queued"&&!job.queueMessageId){dispatches++;job.queueMessageId="fixture-delivery";}return job;},
 createAndDispatchReservedMcpGenerationJob:async args=>{
 assert.equal(args.advanced,true);creations++;
 if(failAt&&args.input.batchIndex===failAt)throw new Error("private SQL diagnostic");
 let result;try{result=await reserve(db,{owner:args.userId,key:args.idempotencyKey,kind:args.jobType==="generate_image"?"image":"video",amount:args.amount,hash:args.fingerprint,input:args.input});}
 catch(error){if(error.message.includes("mcp_generation_idempotency_conflict"))throw new McpGenerationJobError("IDEMPOTENCY_CONFLICT","This request ID belongs to different work.");throw error;}
 const row=jobs.get(args.idempotencyKey)??{id:result.job.id,userId:result.job.user_id,jobType:result.job.job_type,idempotencyKey:args.idempotencyKey,input:result.job.input_json,status:"queued",queueMessageId:null};
 jobs.set(args.idempotencyKey,row);
 if(lostAck){lostAck=false;throw new Error("lost acknowledgement private diagnostic");}
 dispatches++;row.queueMessageId="fixture-delivery";return row;
 },
}});
const {registerGenerationOptionsMcpTools}=await import("../lib/mcp/generation-options-tools.ts");
const handler=createMcpHandler(()=>{const server=new McpServer({name:"advanced-fixture",version:"1.0.0"});registerGenerationOptionsMcpTools(server);return server;},{legacy:"stateless"});
const resource=new URL("https://mcp.getugcpilot.com/mcp");let seq=0;
async function call(name,args={},scopes=["generation:write","jobs:read","account:read"],owner="owner-a"){
 const response=await handler.fetch(new Request(resource,{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream","mcp-protocol-version":"2025-06-18"},body:JSON.stringify({jsonrpc:"2.0",id:++seq,method:"tools/call",params:{name,arguments:args}})}),{authInfo:{token:"fixture",clientId:"fixture",scopes,resource,extra:{firebaseUid:owner}}});
 const raw=await response.text();const line=raw.split("\n").find(s=>s.startsWith("data: "));const parsed=JSON.parse(line?line.slice(6):raw);return parsed.result??parsed;
}
const value=result=>result.structuredContent??JSON.parse(result.content[0].text);
const good=async(name,args)=>{const result=await call(name,args);assert.equal(result.isError,undefined,JSON.stringify(result));assert(!result.error);return value(result);};
const bad=async(name,args,code)=>{const result=await call(name,args);assert(result.isError||result.error);if(code)assert.equal(value(result).code,code);return result;};
const video=(extra={})=>({prompt:"My exact requested narration",client_request_id:randomUUID(),model:"google_omni",resolution:"1080p",duration_seconds:10,aspect_ratio:"9:16",...extra});
const image=(extra={})=>({prompt:"My exact requested visual",client_request_id:randomUUID(),model:"seedream_5_pro",aspect_ratio:"4:5",...extra});
function asset(kind,extra={}){const id=randomUUID();const row={id,user_id:"owner-a",deleted_at:null,status:"ready",collection:kind,mime_type:`${kind}/${kind==="image"?"png":kind==="audio"?"mpeg":"mp4"}`,file_size_bytes:1000,duration_seconds:kind==="image"?null:2.8,url:`https://owned-media.example.test/${id}.${kind==="image"?"png":"mp4"}`,...extra};assets.set(id,row);return row;}
beforeEach(()=>{process.env.MCP_ADVANCED_GENERATION_ENABLED="true";process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE="true";process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN="true";free=false;planError=false;missing=false;failAt=0;lostAck=false;dispatches=0;creations=0;reads=0;assets.clear();jobs.clear();});
test("read options uses actual models, quality/durations and read-only plan lookup",async()=>{
 const options=await good("get_generation_options");assert.equal(options.creation_available,true);assert.equal(creations,0);assert.equal(dispatches,0);
 assert.equal(options.video_models.length,4);assert.deepEqual(options.video_models.find(m=>m.id==="wan_3_0").resolutions,["480p","720p","1080p"]);
 process.env.MCP_ADVANCED_GENERATION_ENABLED="false";assert.equal((await good("get_generation_options")).creation_available,false);
 await bad("generate_video_with_options",video(),"GENERATION_NOT_ENABLED");assert.equal(creations,0);
});
test("all selected video models reach the shared validator and atomic real SQL with duration pricing",async()=>{
 for(const [model,resolution,duration_seconds] of [["google_omni","1080p",10],["kling_3_0","720p",15],["seedance_2_5","480p",30],["wan_3_0","1080p",2]]){
 const args=video({model,resolution,duration_seconds,count:2});const result=await good("generate_video_with_options",args);assert.equal(result.jobs.length,2);
 const rows=[...jobs.values()].filter(row=>row.input.mcpClientRequestId===args.client_request_id);assert(rows.every(row=>row.input.model===model&&row.input.durationSeconds===duration_seconds&&row.input.resolution===resolution&&row.input.hookIdea===args.prompt));
 assert.deepEqual((await db.query('select amount from billing_credit_reservations where idempotency_key=$1',[rows[0].idempotencyKey])).rows[0],{amount:duration_seconds*4});
 }
});
test("model-specific rejected quality/duration/reference/prompt does not reserve or dispatch",async()=>{
 for(const extra of [{model:"kling_3_0",resolution:"1080p"},{model:"google_omni",duration_seconds:30},{model:"kling_3_0",duration_seconds:11},{model:"seedance_2_5",duration_seconds:3},{model:"kling_3_0",prompt:"x".repeat(2501)},{model:"wan_3_0",prompt:"x".repeat(10001)}])await bad("generate_video_with_options",video(extra),"INVALID_GENERATION_INPUT");
 assert.equal(creations,0);assert.equal(dispatches,0);
});
test("owned multiple image/audio/video references are frozen in order; foreign assets fail before billing",async()=>{
 const a=asset("image"),b=asset("image"),audio=asset("audio"),clip=asset("video");
 const args=video({model:"seedance_2_5",resolution:"720p",reference_image_asset_ids:[a.id,b.id],reference_audio_asset_ids:[audio.id],reference_video_asset_id:clip.id});
 await good("generate_video_with_options",args);const row=[...jobs.values()][0];assert.deepEqual(row.input.referenceImageUrls,[a.url,b.url]);assert.deepEqual(row.input.referenceAudioAssetIds,[audio.id]);assert.equal(row.input.referenceVideoDurationSeconds,2.8);
 const foreign=asset("image",{user_id:"other"});const before=creations;await bad("generate_video_with_options",video({reference_image_asset_ids:[foreign.id]}),"REFERENCE_NOT_FOUND");assert.equal(creations,before);
});
test("slideshow layout/attachment/edit-target roles use the same image validator and existing source",async()=>{
 const style=asset("image"),attachment=asset("image"),target=asset("image");
 await good("generate_image_with_options",image({format:"slideshow",model:"gpt_image_2_5",reference_image_asset_ids:[style.id],attached_image_asset_ids:[attachment.id],regeneration_image_asset_id:target.id,count:2}));
 const rows=[...jobs.values()];assert.equal(rows.length,2);for(const row of rows){assert.deepEqual(row.input.referenceImageUrls,[style.url,attachment.url,target.url]);assert.deepEqual(row.input.slideshowReferenceContract,{version:2,styleReferenceIndices:[1],attachmentReferenceIndices:[2],regenerationReferenceIndex:3});}
});
test("lost acknowledgement recovers by UUID and matching replay after gates/plan/references change",async()=>{
 const ref=asset("image"),args=image({reference_image_asset_ids:[ref.id]});lostAck=true;
 await bad("generate_image_with_options",args,"GENERATION_UNAVAILABLE");assert.equal(jobs.size,1);assert.equal(dispatches,0);
 process.env.MCP_ADVANCED_GENERATION_ENABLED="false";planError=true;assets.clear();
 const recovered=await good("get_generation_request",{kind:"image",client_request_id:args.client_request_id});assert.equal(recovered.confirmed,true);assert.equal(dispatches,0);assert(!JSON.stringify(recovered).includes("private"));
 const replay=await good("generate_image_with_options",args);assert.equal(replay.jobs[0].job_id,recovered.jobs[0].job_id);assert.equal(creations,1);assert.equal(dispatches,1);
 await bad("generate_image_with_options",{...args,prompt:"Different request"},"IDEMPOTENCY_CONFLICT");assert.equal(dispatches,1);
});
test("partial batches recover existing children and continue identical intent without duplicate credits",async()=>{
 const args=video({count:2});failAt=2;const first=await good("generate_video_with_options",args);assert.equal(first.partial,true);assert.equal(first.jobs.length,1);
 const read=await good("get_generation_request",{kind:"video",client_request_id:args.client_request_id});assert.equal(read.partial,true);
 failAt=0;const replay=await good("generate_video_with_options",args);assert.equal(replay.partial,false);assert.equal(replay.jobs.length,2);assert.equal(replay.jobs[0].job_id,first.jobs[0].job_id);
 assert.equal((await db.query('select count(*)::int as n from billing_credit_reservations where idempotency_key=any($1::text[])',[[...jobs.keys()]])).rows[0].n,2);
});
test("scope and strict reference input checks reject before data reads",async()=>{
 const result=await call("generate_video_with_options",video(),["jobs:read"]);assert(result.isError||result.error||result._meta?.["mcp/www_authenticate"]);
 await bad("generate_video_with_options",video({reference_url:"https://attacker.test/file"}));const ref=asset("image");await bad("generate_video_with_options",video({reference_image_asset_ids:[ref.id,ref.id]}));assert.equal(reads,0);assert.equal(creations,0);
});
test("gallery references use measured server duration, not caller timing",async()=>{
 const args=video({format:"hook",use_gallery_video_reference:true,reference_id:"hook-fixture",duration_seconds:3});await good("generate_video_with_options",args);const row=[...jobs.values()][0];assert.equal(row.input.durationSeconds,7);assert.equal(row.input.referenceVideoDurationSeconds,6.25);assert.equal(row.input.referenceVideoMode,"edit");
});

test("capabilities distinguish format limits and provider/model availability",async()=>{
 process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE="false";
 const result=await good("get_generation_options");assert.equal(result.video_models.find(m=>m.id==="seedance_2_5").available,false);
 const omni=result.video_models.find(m=>m.id==="google_omni");assert.equal(omni.format_limits.find(f=>f.format==="ai_studio").max_video_references,0);
 assert.equal(omni.format_limits.find(f=>f.format==="hook").max_edit_video_seconds,10);
 assert.equal(result.image_models.find(m=>m.id==="nano_banana_2").format_limits.find(f=>f.format==="ai_studio").max_total_references,1);
 await bad("generate_video_with_options",video({model:"seedance_2_5",resolution:"720p"}),"GENERATION_UNAVAILABLE");assert.equal(creations,0);
});
test("foreign request lookup and unknown private audio IDs reveal no records",async()=>{
 const args=image();await good("generate_image_with_options",args);
 const foreign=await call("get_generation_request",{kind:"image",client_request_id:args.client_request_id},["jobs:read"],"owner-b");assert.equal(value(foreign).confirmed,false);assert.deepEqual(value(foreign).jobs,[]);
 const before=creations;await bad("generate_video_with_options",video({model:"seedance_2_5",resolution:"720p",reference_audio_asset_ids:[randomUUID()]}),"REFERENCE_NOT_FOUND");assert.equal(creations,before);
});
test("all batch siblings validate before any matching replay dispatch",async()=>{
 const args=video({count:2});await good("generate_video_with_options",args);
 for(const row of jobs.values())row.queueMessageId=null;
 [...jobs.values()][1].input.mcpRequestFingerprint="b".repeat(64);
 const before=dispatches;await bad("generate_video_with_options",args,"IDEMPOTENCY_CONFLICT");assert.equal(dispatches,before);
});
test("uppercase UUIDs normalize and concurrent identical submissions reuse the transaction",async()=>{
 const args=image({client_request_id:randomUUID().toUpperCase()});
 const results=await Promise.all([good("generate_image_with_options",args),good("generate_image_with_options",{...args,client_request_id:args.client_request_id.toLowerCase()})]);assert.equal(results[0].jobs[0].job_id,results[1].jobs[0].job_id);assert.equal(jobs.size,1);
});
test("long Omni narration remains exact and a free credited request is admitted without changing V1",async()=>{
 const args=video({prompt:"Exact narration ".repeat(1000)});await good("generate_video_with_options",args);assert.equal([...jobs.values()][0].input.hookIdea,args.prompt.trim());
 free=true;await good("generate_image_with_options",image());
});

test("partial retry cannot silently change the resolved reference snapshot or price",async()=>{
 const ref=asset("image"),args=image({count:2,reference_image_asset_ids:[ref.id]});failAt=2;
 const first=await good("generate_image_with_options",args);assert.equal(first.partial,true);
 failAt=0;ref.url="https://owned-media.example.test/replaced.png";
 await bad("generate_image_with_options",args,"IDEMPOTENCY_CONFLICT");assert.equal(jobs.size,1);
});

test("partial recovery rejects changed reference metadata even with the same URL",async()=>{
 const ref=asset("image"),args=image({count:2,reference_image_asset_ids:[ref.id]});failAt=2;
 assert.equal((await good("generate_image_with_options",args)).partial,true);
 failAt=0;ref.file_size_bytes=2000;
 await bad("generate_image_with_options",args,"IDEMPOTENCY_CONFLICT");assert.equal(jobs.size,1);
});
