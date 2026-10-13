import "server-only";
import { createHash } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";
import { getGoogleServiceAccountCredentials } from "@/lib/gcp/credentials";
import type { MediaAssetRow } from "@/lib/media/media-storage";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";
import { assertPrivateMediaIdentity, privateMediaBucketName, validPrivateStorageKey } from "@/lib/media/private-media-storage";
import { buildPublicStorageUrl } from "@/lib/storage/storage";
import { privateMcpUploadTarget } from "@/lib/mcp/upload-storage";
import { AudioError, AUDIO_MAX_OUTPUT_BYTES } from "@/worker/src/lib/audio-contract";

type Snapshot = {sha256:string;size:number};
function fileFor(row:MediaAssetRow) {
  const key=validPrivateStorageKey(row.storage_key);
  let bucket:string;
  if(isPrivateUserMedia(row)){assertPrivateMediaIdentity(key,row.url);bucket=privateMediaBucketName();}
  else {
    bucket=(process.env.GCP_STORAGE_BUCKET||process.env.GOOGLE_CLOUD_STORAGE_BUCKET)?.trim()||"";
    if(!bucket||row.url!==buildPublicStorageUrl(key))throw new AudioError("Audio snapshot storage identity changed.",503);
  }
  const credentials=getGoogleServiceAccountCredentials();
  return new Storage({...(credentials?{credentials}:{}),projectId:process.env.GCP_PROJECT_ID||process.env.GOOGLE_CLOUD_PROJECT,retryOptions:{totalTimeout:120,maxRetries:2,maxRetryDelay:30}}).bucket(bucket).file(key);
}
async function boundedBytes(file:File,size:number){
  const stream=file.createReadStream(),parts:Buffer[]=[];let received=0;
  const timeout=setTimeout(()=>stream.destroy(new AudioError("Audio snapshot read timed out.",503)),120000);
  try {for await(const part of stream){const bytes=Buffer.from(part);received+=bytes.length;
    if(received>size)throw new AudioError("Audio snapshot verification failed.",503);parts.push(bytes);}
  }finally{clearTimeout(timeout);stream.destroy();}
  if(received!==size)throw new AudioError("Audio snapshot verification failed.",503);
  return Buffer.concat(parts);
}
/** Pin the immutable generation before reading; only a real 404 means absent. */
export async function readAudioVideoSnapshot(row:MediaAssetRow,snapshot:Snapshot,request:string){
  if(!Number.isSafeInteger(snapshot.size)||snapshot.size<32||snapshot.size>AUDIO_MAX_OUTPUT_BYTES)throw new AudioError("Audio snapshot size is unavailable.",503);
  const file=fileFor(row);
  let metadata;
  try{[metadata]=await file.getMetadata();}catch(error){if((error as {code?:unknown})?.code===404)return null;throw error;}
  if(!metadata.generation||Number(metadata.size)!==snapshot.size||metadata.contentType!==row.mime_type||
    metadata.metadata?.sha256!==snapshot.sha256||metadata.metadata?.mcpAudioRequest!==request)
    throw new AudioError("Audio snapshot storage differs from the saved request.",409);
  const bytes=await boundedBytes(file.bucket.file(file.name,{generation:metadata.generation}),snapshot.size);
  if(createHash("sha256").update(bytes).digest("hex")!==snapshot.sha256)throw new AudioError("Audio snapshot verification failed.",503);
  return {bytes,generation:String(metadata.generation)};
}
/** Never replace a snapshot, including after an interrupted write. */
export async function writeAudioVideoSnapshot(row:MediaAssetRow,bytes:Uint8Array,snapshot:Snapshot,request:string){
  if(bytes.length!==snapshot.size||createHash("sha256").update(bytes).digest("hex")!==snapshot.sha256)
    throw new AudioError("Audio snapshot input changed.",409);
  if(isPrivateUserMedia(row))await privateMcpUploadTarget(row.storage_key);
  const file=fileFor(row);
  try{await file.save(Buffer.from(bytes),{resumable:false,timeout:120000,validation:"crc32c",preconditionOpts:{ifGenerationMatch:0},
    metadata:{contentType:row.mime_type,cacheControl:isPrivateUserMedia(row)?"private, no-store":"public, max-age=31536000, immutable",
      metadata:{sha256:snapshot.sha256,mcpAudioRequest:request}}});
  }catch(error){
    // A lost acknowledgement may already have committed. Check this exact key,
    // never allocate another or overwrite the recorded generation.
    const recovered=await readAudioVideoSnapshot(row,snapshot,request);if(recovered)return recovered;throw error;
  }
  const result=await readAudioVideoSnapshot(row,snapshot,request);
  if(!result)throw new AudioError("Audio snapshot could not be confirmed. Check the saved request ID.",503);
  return result;
}
