import { CRC32C, Storage } from "@google-cloud/storage";
import { privateMediaBucket } from "./private-media.js";
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { ExploreFinishError, exploreFinishOutputKey, EXPLORE_RENDER_VERSION } from "./explore-finishing-contract.js";
import type { ExploreFinishReceipt } from "./explore-finishing-store.js";
import { referenceAudioBaseStorageKey } from "./explore-reference-soundtrack.js";

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
  constructor(private readonly storage = new Storage(), private readonly readMedia?: (url: string, signal?: AbortSignal) => Promise<Readable>) {}
  private bucket(location: "primary" | "private_user_media" = "primary") {
    if (location === "private_user_media") return this.storage.bucket(privateMediaBucket());
    const bucket = process.env.GCP_STORAGE_BUCKET?.trim() || process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim();
    if (!bucket) throw new ExploreFinishError("Finished-video storage is not configured.",503);
    return this.storage.bucket(bucket);
  }
  async download(key: string, destination: string, maxBytes: number, location: "primary" | "private_user_media" = "primary", signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!key || key.startsWith("/") || key.includes("..") || /[:\\\u0000-\u001f]/.test(key)) throw new ExploreFinishError("Invalid saved-media storage key.");
    const bucket = this.bucket(location), file = bucket.file(key);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes || !metadata.generation) throw new ExploreFinishError("The selected media is empty or exceeds its size limit.",413);
    signal?.throwIfAborted();
    let received = 0;
    const checksum = new CRC32C();
    const bounded = new Transform({ transform(chunk: Buffer,_encoding,callback) {
      received += chunk.length;
      checksum.update(chunk);
      callback(received > maxBytes ? new ExploreFinishError("The media download exceeded its size limit.",413) : null,chunk);
    } });
    // Authenticate directly through the same ADC client. The SDK's media
    // reader nests several pipelines and over-attaches stream listeners.
    // URLs are constructed from the configured bucket and validated key,
    // never from user-supplied media URLs or metadata links.
    const url = new URL(`${this.storage.apiEndpoint ?? "https://storage.googleapis.com"}/storage/v1/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(key)}`);
    url.searchParams.set("alt", "media"); url.searchParams.set("generation", String(metadata.generation));
    const input = this.readMedia ? await this.readMedia(url.toString(), signal)
      : (await this.storage.authClient.request<Readable>({ url: url.toString(), responseType: "stream", signal, headers: { "Accept-Encoding": "identity" } })).data;
    await pipeline(input,bounded,createWriteStream(destination,{ flags:"wx" }), { signal });
    if (received !== size) throw new ExploreFinishError("The selected media changed while downloading.",409);
    if (metadata.crc32c && !checksum.validate(metadata.crc32c)) throw new ExploreFinishError("The media download failed its checksum check.",409);
  }
  private outputFile(receipt: ExploreFinishReceipt) { return this.bucket().file(exploreFinishOutputKey(receipt.output_asset_id)); }
  private async verifyAudioBase(receipt: ExploreFinishReceipt, key: string) {
    if (key !== referenceAudioBaseStorageKey(receipt.output_asset_id)) throw new ExploreFinishError("Invalid reference audio base.", 409);
    const [metadata] = await this.bucket().file(key).getMetadata();
    const bytes = Number(metadata.size), saved = metadata.metadata;
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_OUTPUT_BYTES || metadata.contentType !== "video/mp4" ||
      saved?.ownerId !== receipt.user_id || saved?.requestKey !== receipt.request_key || saved?.fingerprint !== receipt.fingerprint || saved?.renderer !== EXPLORE_RENDER_VERSION || saved?.referenceAudioBase !== "true") {
      throw new ExploreFinishError("The reference audio base belongs to different work.", 409);
    }
  }
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
    const validated = validateOutput(output,receipt,file.name,Number(metadata.size));
    const details = validated.metadata as { referenceSoundtrack?: { cleanStorageKey?: unknown } } | undefined;
    if (details?.referenceSoundtrack) {
      if (typeof details.referenceSoundtrack.cleanStorageKey !== "string") throw new ExploreFinishError("The reference audio base is unconfirmed.", 409);
      await this.verifyAudioBase(receipt, details.referenceSoundtrack.cleanStorageKey);
    }
    return validated;
  }
  async upload(receipt: ExploreFinishReceipt, outputPath: string, details: { durationSeconds:number; width:number; height:number; ratio:string; metadata:Record<string,unknown>; referenceAudioBasePath?: string }) {
    const file = this.outputFile(receipt);
    const bytes = (await stat(outputPath)).size;
    if (!bytes || bytes > MAX_OUTPUT_BYTES) throw new ExploreFinishError("The finished output exceeds the video size limit.",413);
    const base = process.env.GCP_STORAGE_PUBLIC_BASE_URL?.trim() || process.env.GCS_PUBLIC_BASE_URL?.trim();
    if (!base) throw new ExploreFinishError("The finished-video URL is not configured.",503);
    const { referenceAudioBasePath, ...publishedDetails } = details;
    const output = validateOutput({ ...publishedDetails,fileSizeBytes:bytes,storageKey:file.name,url:`${httpsBase(base)}/${file.name}` },receipt,file.name,bytes);
    if (details.metadata.referenceSoundtrack && !referenceAudioBasePath) throw new ExploreFinishError("The reference audio base is required before publication.", 409);
    const soundtrack = details.metadata.referenceSoundtrack as { cleanStorageKey?: unknown } | undefined;
    if (soundtrack && soundtrack.cleanStorageKey !== referenceAudioBaseStorageKey(receipt.output_asset_id)) throw new ExploreFinishError("The reference audio base belongs to another video.", 409);
    if (referenceAudioBasePath) {
      const key = referenceAudioBaseStorageKey(receipt.output_asset_id), cleanBytes = (await stat(referenceAudioBasePath)).size;
      if (!cleanBytes || cleanBytes > MAX_OUTPUT_BYTES) throw new ExploreFinishError("The audio base exceeds the video size limit.", 413);
      try {
        await this.bucket().upload(referenceAudioBasePath, { destination: key, resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: {
          contentType: "video/mp4", cacheControl: "public,max-age=31536000,immutable",
          metadata: { ownerId: receipt.user_id, requestKey: receipt.request_key, fingerprint: receipt.fingerprint, renderer: EXPLORE_RENDER_VERSION, referenceAudioBase: "true" },
        } });
      } catch (error) { if ((error as { code?: unknown }).code !== 412) throw error; }
      await this.verifyAudioBase(receipt, key);
    }
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
