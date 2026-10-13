import "server-only";
import { z } from "zod";
import { audioDb } from "@/worker/src/lib/audio-store";
import { AudioError, AUDIO_MAX_CHARACTERS, type AudioVoice } from "@/worker/src/lib/audio-contract";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { audioTransferReadiness } from "./transfer";
import { audioVideoImportReadiness } from "./video-import";
import { getAudioBootstrapForOwner } from "./service";
import { decodeAssetCursor, encodeAssetCursor } from "@/lib/mcp/asset-cursor";

export const audioAssetSchema = z.strictObject({ id:z.uuid(), name:z.string(), purpose:z.enum(["generated","exact","reference"]),
  status:z.string(), duration_seconds:z.number().positive().nullable(), created_at:z.iso.datetime({offset:true}),
  generation_id:z.uuid().nullable(), test_only:z.boolean(), usable_for_video:z.boolean() });
export const audioGenerationSchema = z.strictObject({ id:z.uuid(), request_id:z.uuid(), kind:z.enum(["speech","clone","upload"]),
  name:z.string(), status:z.string(), created_at:z.iso.datetime({offset:true}), job_id:z.uuid(),
  test_only:z.boolean(), credits:z.number().int().nonnegative(), voice_profile_id:z.uuid().nullable(), output_asset_ids:z.array(z.uuid()).max(1) });
const assetColumns="id,user_id,name,purpose,status,duration_seconds,created_at,generation_id,test_only";
const requestColumns="id,user_id,request_key,kind,name,status,created_at,job_id,test_only,credits,output_asset_id,source_asset_id,voice_profile_id";
type AssetRow={id:string;user_id:string;name:string;purpose:string;status:string;duration_seconds:number|string|null;created_at:string;generation_id:string|null;test_only:boolean};
type RequestRow={id:string;user_id:string;request_key:string;kind:string;name:string;status:string;created_at:string;job_id:string;test_only:boolean;credits:number;output_asset_id:string|null;source_asset_id:string|null;voice_profile_id:string|null};
function unavailable():never {throw new AudioError("Audio history could not be loaded. Preserve the request ID and check again.",503);}
function assetSummary(row:AssetRow) {
  return audioAssetSchema.parse({id:row.id,name:row.name,purpose:row.purpose,status:row.status,
    duration_seconds:row.duration_seconds===null?null:Number(row.duration_seconds),created_at:row.created_at,
    generation_id:row.generation_id,test_only:row.test_only,
    usable_for_video:row.status==="ready"&&!row.test_only&&row.purpose!=="reference"});
}
export async function getAudioAssetForOwner(owner:string,id:string) {
  const {data,error}=await audioDb().from("audio_assets").select(assetColumns).eq("user_id",owner).eq("id",id).neq("status","deleted").maybeSingle();
  if(error)unavailable();if(!data||data.user_id!==owner)throw new AudioError("Audio not found.",404);
  return assetSummary(data);
}
async function requestSummary(row:RequestRow,owner:string) {
  if(row.user_id!==owner)unavailable();
  const job=await getBackgroundJobForUser({userId:owner,jobId:row.job_id});
  const input=job?.input&&typeof job.input==="object"&&!Array.isArray(job.input)?job.input:{};
  if(!job||job.userId!==owner||job.jobType!=="generate_audio"||job.idempotencyKey!==`audio:${row.request_key}`||input.audioRequestId!==row.id)unavailable();
  const output_asset_ids:string[]=[];
  if(row.status==="completed"&&job.status==="completed"&&row.output_asset_id) {
    const {data,error}=await audioDb().from("audio_assets").select(assetColumns).eq("user_id",owner).eq("id",row.output_asset_id).eq("status","ready").maybeSingle();
    if(error)unavailable();
    if(data&&data.user_id===owner&&(row.kind==="speech"&&data.id===row.id&&data.generation_id===row.id&&data.purpose==="generated"&&data.test_only===row.test_only||
      row.kind==="upload"&&data.id===row.source_asset_id&&["exact","reference"].includes(data.purpose)))output_asset_ids.push(data.id);
  }
  let voice_profile_id:string|null=null;
  if(row.kind==="clone"&&row.status==="completed"&&job.status==="completed"&&row.voice_profile_id===row.id){
    const {data,error}=await audioDb().from("audio_voice_profiles").select("id,user_id,status,source_asset_id").eq("user_id",owner).eq("id",row.voice_profile_id).eq("source_asset_id",row.source_asset_id).in("status",["ready","verification_required"]).maybeSingle();
    if(error)unavailable();if(data&&data.user_id===owner&&data.source_asset_id===row.source_asset_id)voice_profile_id=data.id;
  }
  return audioGenerationSchema.parse({id:row.id,request_id:row.request_key,kind:row.kind,name:row.name,status:row.status,
    created_at:row.created_at,job_id:job.id,test_only:row.test_only,credits:row.credits,voice_profile_id,output_asset_ids});
}
export async function getAudioGenerationForOwner(owner:string,key:string) {
  const {data,error}=await audioDb().from("audio_generation_requests").select(requestColumns).eq("user_id",owner).eq("request_key",key).maybeSingle();
  if(error)unavailable();return {request_id:key,confirmed:Boolean(data),generation:data?await requestSummary(data,owner):null};
}
export async function listAudioForOwner(owner:string,kind:"assets"|"generations",limit:number,cursor?:string) {
  const collection=`audio-${kind}`,after=cursor?decodeAssetCursor(cursor):null;
  if(cursor&&(!after||after.user_id!==owner||after.collection!==collection||after.source_type!==null||after.query!==null))
    throw new AudioError("The audio cursor does not match this account or collection.",400,"invalid_cursor");
  let query=audioDb().from(kind==="assets"?"audio_assets":"audio_generation_requests").select(kind==="assets"?assetColumns:requestColumns).eq("user_id",owner);
  if(kind==="assets")query=query.neq("status","deleted");
  if(after)query=query.or(`created_at.lt.${after.updated_at},and(created_at.eq.${after.updated_at},id.lt.${after.id})`);
  const {data,error}=await query.order("created_at",{ascending:false}).order("id",{ascending:false}).limit(limit+1).returns<Array<AssetRow|RequestRow>>();
  if(error)unavailable();
  const rows=data??[];if(rows.some(row=>row.user_id!==owner))unavailable();
  const page=rows.slice(0,limit),last=page.at(-1);
  const next_cursor=rows.length>limit&&last?encodeAssetCursor({v:1,user_id:owner,collection,source_type:null,query:null,updated_at:last.created_at,id:last.id}):null;
  if(kind==="assets")return {items:page.map(row=>assetSummary(row as AssetRow)),next_cursor};
  return {items:await Promise.all(page.map(row=>requestSummary(row as RequestRow,owner))),next_cursor};
}
export function safeVoice(voice:AudioVoice) {
  // Do not expose arbitrary provider URLs or private-reference storage. Existing
  // samples need a separate authenticated binary adapter before MCP can fetch them.
  return {id:voice.id,name:voice.name,description:voice.description,labels:voice.labels,category:voice.category,
    private:voice.private,available:voice.available,profile_id:voice.profileId??null};
}
export async function getAudioCapabilitiesForOwner(owner:string) {
  const data=await getAudioBootstrapForOwner(owner,{refreshVerification:false});
  const transfer=audioTransferReadiness();
  return {generation_available:data.canGenerate&&!getMissingJobQueueEnvVars(["generate_audio"]).length,
    generation_access:data.generationAccess,credit_cost_per_1000_characters:data.creditCostPer1000,max_characters:AUDIO_MAX_CHARACTERS,
    speeds:{minimum:0.8,maximum:1.2},models:data.models,catalogue_source:data.catalogueSource??"account",
    upload_available:data.canUpload&&transfer.upload&&!getMissingJobQueueEnvVars(["generate_audio"]).length,download_available:transfer.download,voice_clone_available:false,video_import_available:audioVideoImportReadiness(),
    message:data.message??"Voice cloning is still in development. Check video_import_available before creating an editing snapshot."};
}
export async function listAudioVoicesForOwner(owner:string) {
  const data=await getAudioBootstrapForOwner(owner,{refreshVerification:false});
  return {items:data.voices.map(safeVoice),catalogue_source:data.catalogueSource??"account",message:data.message};
}
