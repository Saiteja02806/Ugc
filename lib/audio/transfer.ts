import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { z } from "zod";
import { audioDb, privateAudioConfigured, readPrivateAudio } from "@/worker/src/lib/audio-store";
import { audioObjectPrefix, AudioError, AUDIO_MAX_UPLOAD_BYTES, AUDIO_MAX_OUTPUT_BYTES } from "@/worker/src/lib/audio-contract";
import { probeAudio } from "@/worker/src/lib/audio-media";
import { validatePrivateAudioKey } from "@/worker/src/lib/audio-storage";
import { assertAudioUploadAccess, uploadAudioForOwner } from "./service";

const mime=z.enum(["audio/mpeg","audio/wav","audio/mp4","audio/ogg","audio/webm"]);
const sha=z.string().regex(/^[a-f0-9]{64}$/);
export const audioUploadInput=z.strictObject({request_id:z.uuid().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),file_name:z.string().min(1).max(100).regex(/^[^/\\\0]+$/),
  mime_type:mime,file_size_bytes:z.number().int().min(32).max(AUDIO_MAX_UPLOAD_BYTES),sha256:sha,purpose:z.enum(["exact","reference"])});
type UploadInput=z.infer<typeof audioUploadInput>;
const common={v:z.literal(1),owner:z.string().min(1).max(128),expires:z.number().int().positive()};
const uploadToken=z.strictObject({...common,mode:z.literal("upload"),input:audioUploadInput});
const downloadToken=z.strictObject({...common,mode:z.literal("download"),asset_id:z.uuid(),sha256:sha,
  size:z.number().int().positive().max(AUDIO_MAX_OUTPUT_BYTES),mime_type:mime,object_identity:sha});
const tokenSchema=z.discriminatedUnion("mode",[uploadToken,downloadToken]);
type Token=z.infer<typeof tokenSchema>;
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex"};
const require=createRequire(import.meta.url);
function binaries(){return {ffprobe:(require("ffprobe-static") as {path:string}).path,ffmpeg:require("ffmpeg-static") as string};}
function signingSecret(){const value=process.env.MEDIA_DELIVERY_SIGNING_SECRET?.trim();if(!value||value.length<32)throw new AudioError("Audio transfer signing is not configured.",503);return value;}
function appOrigin(){const url=new URL(process.env.APP_BASE_URL?.trim()||process.env.NEXT_PUBLIC_APP_URL?.trim()||"https://getugcpilot.com");
  if(url.protocol!=="https:"||url.username||url.password||url.port)throw new AudioError("Audio transfers require an HTTPS application origin.",503);return url.origin;}
export function audioTransferReadiness(){
  let download=false,upload=false;
  try{signingSecret();appOrigin();download=privateAudioConfigured();const tools=binaries();upload=download&&existsSync(tools.ffprobe)&&existsSync(tools.ffmpeg);}catch{}
  return {download,upload};
}
function signature(body:string){return createHmac("sha256",signingSecret()).update(`ugc-audio-transfer:v1:${body}`).digest("hex");}
export function signAudioTransferToken(value:Token){const body=Buffer.from(JSON.stringify(tokenSchema.parse(value))).toString("base64url");return `${body}.${signature(body)}`;}
export function verifyAudioTransferToken(value:string|null,mode:Token["mode"],now=Date.now()):Token|null{
  if(!value||value.length>4096)return null;
  const [body,received,extra]=value.split(".");if(extra||!body||!/^[A-Za-z0-9_-]+$/.test(body)||!received||!/^[a-f0-9]{64}$/.test(received))return null;
  try{const expected=Buffer.from(signature(body),"hex");if(!timingSafeEqual(expected,Buffer.from(received,"hex")))return null;
    const parsed=tokenSchema.safeParse(JSON.parse(Buffer.from(body,"base64url").toString("utf8")));if(!parsed.success)return null;
    const seconds=Math.floor(now/1000),token=parsed.data;
    return token.mode===mode&&token.expires>seconds&&token.expires<=seconds+600?token:null;
  }catch{return null;}
}
function expires(){return Math.floor(Date.now()/1000)+300;}
function checksum(bytes:Uint8Array){return createHash("sha256").update(bytes).digest("hex");}
function canonicalMime(value:string){return ({"audio/mp3":"audio/mpeg","audio/x-wav":"audio/wav","audio/x-m4a":"audio/mp4"} as Record<string,string>)[value]??value;}
export function audioContainerMatches(bytes:Uint8Array,type:string){const b=Buffer.from(bytes);return type==="audio/wav"?b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WAVE":
  type==="audio/ogg"?b.toString("ascii",0,4)==="OggS":type==="audio/mp4"?b.toString("ascii",4,8)==="ftyp":
  type==="audio/webm"?b.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&b.includes(Buffer.from("webm")):
  type==="audio/mpeg"&&(b.toString("ascii",0,3)==="ID3"||b[0]===255&&(b[1]&224)===224);}
async function assetRow(owner:string,id:string){const {data,error}=await audioDb().from("audio_assets").select("*").eq("user_id",owner).eq("id",id).maybeSingle();
  if(error)throw new AudioError("Audio transfer status is unavailable.",503);return data&&data.user_id===owner?data:null;}
export function checkedAudioTransferAsset(row:Record<string,unknown>){
  const type=mime.parse(canonicalMime(String(row.mime_type))),size=Number(row.size_bytes),hash=sha.parse(row.checksum);
  if(!Number.isSafeInteger(size)||size<32||size>AUDIO_MAX_OUTPUT_BYTES||typeof row.object_key!=="string"||typeof row.user_id!=="string"||typeof row.id!=="string")throw new AudioError("Audio transfer metadata is unavailable.",503);
  validatePrivateAudioKey(row.object_key);
  const prefix=audioObjectPrefix(row.user_id,row.purpose==="generated"?String(row.generation_id):row.id);
  if(!row.object_key.startsWith(`${prefix}/`)||row.purpose==="generated"&&(row.generation_id!==row.id||row.object_key!==`${prefix}/final.mp3`))throw new AudioError("Audio transfer identity is unavailable.",503);
  return {type,size,hash,object_identity:checksum(Buffer.from(row.object_key))};
}
export async function getAudioDownloadForOwner(owner:string,id:string){
  const row=await assetRow(owner,id);if(!row||row.status!=="ready")return null;
  if(!audioTransferReadiness().download)return null;
  const checked=checkedAudioTransferAsset(row),expiry=expires();
  const token=signAudioTransferToken({v:1,mode:"download",owner,asset_id:id,expires:expiry,sha256:checked.hash,size:checked.size,mime_type:checked.type,object_identity:checked.object_identity});
  const url=new URL(`/api/audio/delivery/${id}`,appOrigin());url.searchParams.set("token",token);
  return {url:url.toString(),expires_at:new Date(expiry*1000).toISOString(),mime_type:checked.type,file_size_bytes:checked.size,sha256:checked.hash};
}
export async function createAudioUploadForOwner(owner:string,input:UploadInput){
  audioUploadInput.parse(input);await assertAudioUploadAccess(owner);
  if(!audioTransferReadiness().upload)throw new AudioError("Audio upload transfer is not configured.",503);
  const existing=await assetRow(owner,input.request_id);
  if(existing&&(existing.status==="deleted"||existing.checksum!==input.sha256||existing.purpose!==input.purpose||existing.name!==input.file_name||
    canonicalMime(existing.mime_type)!==input.mime_type||Number(existing.size_bytes)!==input.file_size_bytes))throw new AudioError("This upload ID belongs to another or removed recording.",409);
  const expiry=expires(),token=signAudioTransferToken({v:1,mode:"upload",owner,expires:expiry,input});
  const url=new URL("/api/audio/transfer",appOrigin());url.searchParams.set("token",token);
  return {request_id:input.request_id,url:url.toString(),method:"POST" as const,headers:{"Content-Type":input.mime_type},expires_at:new Date(expiry*1000).toISOString()};
}
async function boundedBody(request:Request,expected:number){
  const length=request.headers.get("content-length");if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==expected))throw new AudioError("Audio transfer size does not match the approved file.",400);
  if(!request.body)throw new AudioError("Audio file bytes are required.");const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
    if(size>expected||size>AUDIO_MAX_UPLOAD_BYTES)throw new AudioError("Audio transfer exceeds the approved size.",413);chunks.push(next.value);}
  }finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  if(size!==expected)throw new AudioError("The audio transfer is incomplete.",400);return new Uint8Array(Buffer.concat(chunks));
}
function failed(error:unknown){return Response.json({error:error instanceof AudioError?error.message:"Audio transfer is unavailable. Preserve the request ID and check its status."},
  {status:error instanceof AudioError?error.status:503,headers});}
export async function handleAudioTransferUpload(request:Request){
  try{const token=verifyAudioTransferToken(new URL(request.url).searchParams.get("token"),"upload");if(!token||token.mode!=="upload")throw new AudioError("Audio transfer link is invalid or expired.",403);
    const input=token.input,type=request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase();if(type!==input.mime_type)throw new AudioError("Audio transfer MIME type does not match the approved file.");
    await assertAudioUploadAccess(token.owner);
    const bytes=await boundedBody(request,input.file_size_bytes);if(checksum(bytes)!==input.sha256||!audioContainerMatches(bytes,input.mime_type))throw new AudioError("Audio bytes do not match the approved file.");
    await probeAudio(bytes,binaries());
    const form=new FormData();form.set("file",new File([bytes],input.file_name,{type:input.mime_type}));form.set("purpose",input.purpose);form.set("requestKey",input.request_id);
    const result=await uploadAudioForOwner(token.owner,async()=>form);
    return Response.json({request_id:input.request_id,generation_id:result.id,asset_id:result.assetId},{status:202,headers});
  }catch(error){return failed(error);}
}
export async function handleAudioTransferDownload(request:Request,assetId:string){
  try{const token=verifyAudioTransferToken(new URL(request.url).searchParams.get("token"),"download");if(!token||token.mode!=="download"||token.asset_id!==assetId)throw new AudioError("Audio transfer link is invalid or expired.",403);
    const row=await assetRow(token.owner,assetId);if(!row||row.status!=="ready")throw new AudioError("Audio not found.",404);
    const checked=checkedAudioTransferAsset(row);if(checked.hash!==token.sha256||checked.size!==token.size||checked.type!==token.mime_type||checked.object_identity!==token.object_identity)throw new AudioError("The audio changed. Retrieve a fresh download link.",409);
    const bytes=await readPrivateAudio(row.object_key);if(bytes.length!==token.size||checksum(bytes)!==token.sha256||!audioContainerMatches(bytes,token.mime_type))throw new AudioError("Audio download verification failed.",503);
    const extension=({"audio/mpeg":"mp3","audio/wav":"wav","audio/mp4":"m4a","audio/ogg":"ogg","audio/webm":"webm"} as Record<string,string>)[token.mime_type];
    return new Response(bytes as Uint8Array<ArrayBuffer>,{headers:{...headers,"Content-Type":token.mime_type,"Content-Length":String(bytes.length),"Content-Disposition":`attachment; filename="${row.test_only?"free-test-":""}audio.${extension}"`}});
  }catch(error){return failed(error);}
}
