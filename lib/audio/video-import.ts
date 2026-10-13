import "server-only";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { z } from "zod";
import { audioDb, privateAudioConfigured, readPrivateAudio } from "@/worker/src/lib/audio-store";
import { AudioError } from "@/worker/src/lib/audio-contract";
import { probeAudio } from "@/worker/src/lib/audio-media";
import { cleanupDeletedMcpUploadsForAccount } from "@/lib/mcp/upload-store";
import { getMcpStore } from "@/lib/mcp/store";
import { createMediaUploadTarget, mediaUploadOwnerPath } from "@/lib/media/media-upload";
import type { MediaAssetRow } from "@/lib/media/media-storage";
import { privateMcpUploadsSelected, privateMcpUploadTarget } from "@/lib/mcp/upload-storage";
import { checkedAudioTransferAsset, audioContainerMatches, audioTransferReadiness } from "./transfer";
import { readAudioVideoSnapshot, writeAudioVideoSnapshot } from "./video-import-storage";

const requestId=z.uuid();
export const audioVideoImportInput=z.strictObject({request_id:requestId,source_audio_id:z.uuid()});
export const audioVideoImportResult=z.strictObject({request_id:requestId,confirmed:z.boolean(),
  source_audio_id:z.uuid().nullable(),import_id:z.uuid().nullable(),state:z.enum(["unconfirmed","pending","ready","removed"]),
  media_asset_id:z.uuid().nullable(),duration_seconds:z.number().positive().nullable()});
const snapshotSchema=z.strictObject({sha256:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().min(32).max(12*1024*1024),
  mime_type:z.string(),duration_seconds:z.number().positive().max(180),object_identity:z.string().regex(/^[a-f0-9]{64}$/)});
type Snapshot=z.infer<typeof snapshotSchema>;
const require=createRequire(import.meta.url);
const binaries=()=>({ffprobe:(require("ffprobe-static") as {path:string}).path,ffmpeg:require("ffmpeg-static") as string});
function metadata(row:MediaAssetRow){return row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata:{};}
function unavailable():never{throw new AudioError("Audio import could not be confirmed. Preserve the request ID and check it before trying again.",503);}
function checkRow(row:MediaAssetRow,owner:string,request:string){
  const m=metadata(row);
  if(row.user_id!==owner||m.mcpUploadRequestKey!==request||m.mcpAudioImport!==true||m.mcpUpload!==true||row.collection!=="audio"||
    row.source_type!=="upload"||row.project_id!=="explore-demo"||row.source_record_id!==row.id||!z.uuid().safeParse(m.mcpAudioSourceId).success)unavailable();
  const parsed=snapshotSchema.safeParse(m.mcpAudioSnapshot);if(!parsed.success)unavailable();
  const source=parsed.data;
  const canonical=({"audio/mp3":"audio/mpeg","audio/x-wav":"audio/wav","audio/x-m4a":"audio/mp4"} as Record<string,string>)[source.mime_type]??source.mime_type;
  const extension=({"audio/mpeg":"mp3","audio/wav":"wav","audio/mp4":"m4a","audio/ogg":"ogg","audio/webm":"webm"} as Record<string,string>)[canonical];
  if(!extension||row.storage_key!==`media/${mediaUploadOwnerPath(owner)}/audio/${row.id}.${extension}`||row.file_size_bytes!==source.size||row.mime_type!==canonical)unavailable();
  if(row.status==="ready"&&(!/^[1-9][0-9]{0,30}$/.test(String(m.mcpAudioObjectGeneration))||!Number.isFinite(Number(row.duration_seconds))||Number(row.duration_seconds)<=0||Math.abs(Number(row.duration_seconds)-source.duration_seconds)>0.25))unavailable();
  return source;
}
async function find(owner:string,request:string){
  const {data,error}=await getMcpStore().from("media_assets").select("*").eq("user_id",owner)
    .eq("metadata->>mcpUpload","true").eq("metadata->>mcpUploadRequestKey",request).maybeSingle();
  if(error)unavailable();
  if(data&&metadata(data).mcpAudioImport!==true)throw new AudioError("This request ID belongs to another upload.",409);
  if(data)checkRow(data,owner,request);return data as MediaAssetRow|null;
}
function summary(request:string,row:MediaAssetRow|null){
  if(!row)return audioVideoImportResult.parse({request_id:request,confirmed:false,source_audio_id:null,import_id:null,state:"unconfirmed",media_asset_id:null,duration_seconds:null});
  const removed=Boolean(row.deleted_at),ready=!removed&&row.status==="ready";
  return audioVideoImportResult.parse({request_id:request,confirmed:true,source_audio_id:metadata(row).mcpAudioSourceId,import_id:row.id,
    state:removed?"removed":ready?"ready":"pending",media_asset_id:ready?row.id:null,duration_seconds:ready?Number(row.duration_seconds):null});
}
async function rpc(name:string,args:Record<string,unknown>){
  const {data,error}=await getMcpStore().rpc(name,args);
  if(error){const message=error.message??"";
    if(/mcp_audio_import_conflict|mcp_audio_source_changed/.test(message))throw new AudioError("The saved audio import differs from this request.",409);
    if(/mcp_audio_import_removed|mcp_upload_not_found/.test(message))throw new AudioError("This audio import was removed.",409);
    if(message.includes("mcp_audio_source_unavailable"))throw new AudioError("Select your own ready audio. Free tests and voice references cannot be attached to videos.",403);
    if(message.includes("mcp_upload_quota_exceeded"))throw new AudioError("Confirm or remove an unfinished upload before importing another recording.",429);
    unavailable();
  }
  if(!data||typeof data!=="object"||Array.isArray(data))unavailable();return data as MediaAssetRow;
}
async function sourceRow(owner:string,id:string){
  const {data,error}=await audioDb().from("audio_assets").select("*").eq("user_id",owner).eq("id",id).maybeSingle();
  if(error)unavailable();
  if(!data||data.user_id!==owner||data.status!=="ready"||data.test_only!==false||!["generated","exact"].includes(data.purpose))
    throw new AudioError("Select your own ready audio. Free tests and voice references cannot be attached to videos.",403);
  const checked=checkedAudioTransferAsset(data);
  const snapshot=snapshotSchema.parse({sha256:checked.hash,size:checked.size,mime_type:data.mime_type,duration_seconds:Number(data.duration_seconds),object_identity:checked.object_identity});
  return {row:data,snapshot,type:checked.type};
}
export function audioVideoImportReadiness(){return process.env.MCP_AUDIO_VIDEO_IMPORT_ENABLED==="true"&&privateAudioConfigured()&&audioTransferReadiness().upload;}
export async function getAudioVideoImportForOwner(owner:string,request:string){requestId.parse(request);return summary(request,await find(owner,request));}
async function validateBytes(bytes:Uint8Array,snapshot:Snapshot){
  const mime=({"audio/mp3":"audio/mpeg","audio/x-wav":"audio/wav","audio/x-m4a":"audio/mp4"} as Record<string,string>)[snapshot.mime_type]??snapshot.mime_type;
  if(bytes.length!==snapshot.size||!audioContainerMatches(bytes,mime)||createHash("sha256").update(bytes).digest("hex")!==snapshot.sha256)throw new AudioError("Saved audio changed. Preserve the import request ID.",409);
  const duration=await probeAudio(bytes,binaries());if(Math.abs(duration-snapshot.duration_seconds)>0.25)throw new AudioError("Saved audio duration changed.",409);
  return duration;
}
export async function importAudioForVideo(owner:string,input:z.infer<typeof audioVideoImportInput>){
  audioVideoImportInput.parse(input);
  let row=await find(owner,input.request_id);
  if(row){if(metadata(row).mcpAudioSourceId!==input.source_audio_id)throw new AudioError("This request ID belongs to another recording.",409);
    if(row.deleted_at)throw new AudioError("This audio import was removed.",409);if(row.status==="ready")return summary(input.request_id,row);
  }else{
    if(!audioVideoImportReadiness())throw new AudioError("New audio imports are not enabled or configured.",503);
    const source=await sourceRow(owner,input.source_audio_id);
    await cleanupDeletedMcpUploadsForAccount(owner);
    const target=createMediaUploadTarget({collection:"audio",contentType:source.type,fileName:`saved-audio-${input.source_audio_id}.audio`,fileSize:source.snapshot.size,userId:owner,title:source.row.name});
    if(!target.ok)throw new AudioError("Audio snapshot destination could not be prepared.",503);
    const privateTarget=privateMcpUploadsSelected();
    row=await rpc("mcp_reserve_audio_import",{p_user_id:owner,p_request_id:input.request_id,p_source_id:input.source_audio_id,
      p_asset_id:target.target.assetId,p_storage_key:target.target.key,p_url:privateTarget?await privateMcpUploadTarget(target.target.key):target.target.publicUrl,
      p_private:privateTarget,p_snapshot:source.snapshot});
  }
  let snapshot=checkRow(row,owner,input.request_id);
  if(row.deleted_at)throw new AudioError("This audio import was removed.",409);
  if(row.status==="ready")return summary(input.request_id,row);
  if(row.status!=="uploading")unavailable();
  const original=row;
  try{row=await rpc("mcp_lease_upload_url",{p_user_id:owner,p_asset_id:row.id});}
  catch(error){const recovered=await find(owner,input.request_id);if(recovered?.id===original.id&&!recovered.deleted_at&&recovered.status==="ready")return summary(input.request_id,recovered);throw error;}
  const leased=checkRow(row,owner,input.request_id);
  if(row.id!==original.id||row.storage_key!==original.storage_key||row.url!==original.url||
    JSON.stringify(leased)!==JSON.stringify(snapshot)||row.deleted_at||row.status!=="uploading")unavailable();
  snapshot=leased;
  let object=await readAudioVideoSnapshot(row,snapshot,input.request_id);
  if(!object){
    const source=await sourceRow(owner,input.source_audio_id);
    if(JSON.stringify(source.snapshot)!==JSON.stringify(snapshot))throw new AudioError("Saved audio changed. Preserve this import request ID.",409);
    const bytes=await readPrivateAudio(source.row.object_key);
    await validateBytes(bytes,snapshot);
    object=await writeAudioVideoSnapshot(row,bytes,snapshot,input.request_id);
  }
  const duration=await validateBytes(object.bytes,snapshot);
  const completed=await rpc("mcp_complete_audio_import",{p_user_id:owner,p_request_id:input.request_id,p_asset_id:row.id,
    p_snapshot:snapshot,p_generation:object.generation,p_duration_seconds:duration});
  checkRow(completed,owner,input.request_id);
  if(completed.id!==row.id||completed.status!=="ready"||completed.deleted_at)unavailable();
  return summary(input.request_id,completed);
}
