import { Storage } from "@google-cloud/storage";
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ExploreFinishError, exploreFinishOutputKey, EXPLORE_RENDER_VERSION } from "./explore-finishing-contract.js";
import type { ExploreFinishReceipt } from "./explore-finishing-store.js";

const MAX_OUTPUT_BYTES = 250 * 1024 * 1024;
function httpsBase(base: string) {
  try {
    const url = new URL(base.includes("://") ? base : `https://${base}`);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("invalid base");
    return url.toString().replace(/\/$/,"");
  } catch { throw new ExploreFinishError("Finished videos require a valid HTTPS storage base URL.",503); }
}

function validateOutput(raw: unknown, receipt: ExploreFinishReceipt, key: string, bytes: number): Record<string,unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ExploreFinishError("The stored video receipt is invalid.",409);
  const output = raw as Record<string,unknown>;
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_OUTPUT_BYTES || output.storageKey !== key || output.fileSizeBytes !== bytes ||
      typeof output.url !== "string" || typeof output.durationSeconds !== "number" || !Number.isFinite(output.durationSeconds) || output.durationSeconds <= 0 ||
      output.durationSeconds > (receipt.draft.subtitles ? 60 : 240) || !Number.isSafeInteger(output.width) || !Number.isSafeInteger(output.height) ||
      (output.width as number) < 64 || (output.width as number) > 4096 || (output.height as number) < 64 || (output.height as number) > 4096 ||
      !["9:16","16:9","1:1","4:5","other"].includes(String(output.ratio))) throw new ExploreFinishError("The stored video receipt is invalid.",409);
  try {
    const url = new URL(output.url);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("invalid output URL");
  } catch { throw new ExploreFinishError("The stored video URL is invalid.",409); }
  return output;
}

/** ADC in the GCP worker. No arbitrary URLs or client-selected buckets. */
export class ExploreFinishingStorage {
  constructor(private readonly storage = new Storage()) {}
  private bucket() {
    const bucket = process.env.GCP_STORAGE_BUCKET?.trim() || process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim();
    if (!bucket) throw new ExploreFinishError("Finished-video storage is not configured.",503);
    return this.storage.bucket(bucket);
  }
  async download(key: string, destination: string, maxBytes: number) {
    if (!key || key.startsWith("/") || key.includes("..") || /[:\\\u0000-\u001f]/.test(key)) throw new ExploreFinishError("Invalid saved-media storage key.");
    const file = this.bucket().file(key);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes || !metadata.generation) throw new ExploreFinishError("The selected media is empty or exceeds its size limit.",413);
    let received = 0;
    const bounded = new Transform({ transform(chunk: Buffer,_encoding,callback) {
      received += chunk.length;
      callback(received > maxBytes ? new ExploreFinishError("The media download exceeded its size limit.",413) : null,chunk);
    } });
    await pipeline(this.bucket().file(key,{ generation:metadata.generation }).createReadStream(),bounded,createWriteStream(destination,{ flags:"wx" }));
    if (received !== size) throw new ExploreFinishError("The selected media changed while downloading.",409);
  }
  private outputFile(receipt: ExploreFinishReceipt) { return this.bucket().file(exploreFinishOutputKey(receipt.output_asset_id)); }
  async existing(receipt: ExploreFinishReceipt) {
    const file = this.outputFile(receipt);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const saved = metadata.metadata;
    if (metadata.contentType !== "video/mp4" || saved?.ownerId !== receipt.user_id || saved?.requestKey !== receipt.request_key ||
        saved?.fingerprint !== receipt.fingerprint || saved?.renderer !== EXPLORE_RENDER_VERSION || typeof saved.output !== "string") throw new ExploreFinishError("The stored finished video belongs to different work.",409);
    let output: unknown;
    try { output = JSON.parse(saved.output); } catch { throw new ExploreFinishError("The stored video receipt is invalid.",409); }
    return validateOutput(output,receipt,file.name,Number(metadata.size));
  }
  async upload(receipt: ExploreFinishReceipt, outputPath: string, details: { durationSeconds:number; width:number; height:number; ratio:string; metadata:Record<string,unknown> }) {
    const file = this.outputFile(receipt);
    const bytes = (await stat(outputPath)).size;
    if (!bytes || bytes > MAX_OUTPUT_BYTES) throw new ExploreFinishError("The finished output exceeds the video size limit.",413);
    const base = process.env.GCP_STORAGE_PUBLIC_BASE_URL?.trim() || process.env.GCS_PUBLIC_BASE_URL?.trim();
    if (!base) throw new ExploreFinishError("The finished-video URL is not configured.",503);
    const output = validateOutput({ ...details,fileSizeBytes:bytes,storageKey:file.name,url:`${httpsBase(base)}/${file.name}` },receipt,file.name,bytes);
    try {
      await this.bucket().upload(outputPath,{ destination:file.name,resumable:false,preconditionOpts:{ ifGenerationMatch:0 },metadata:{
        contentType:"video/mp4",cacheControl:"public,max-age=31536000,immutable",
        metadata:{ ownerId:receipt.user_id,requestKey:receipt.request_key,fingerprint:receipt.fingerprint,renderer:EXPLORE_RENDER_VERSION,output:JSON.stringify(output) },
      } });
    } catch (error) {
      // A concurrent successful upload may have won. Verify its provenance;
      // never overwrite it or publish a different request's object.
      if ((error as { code?:unknown }).code === 412) {
        const existing = await this.existing(receipt);
        if (existing) return existing;
      }
      throw error;
    }
    return output;
  }
}
