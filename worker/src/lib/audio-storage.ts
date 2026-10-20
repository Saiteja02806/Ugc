import { createHash } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { AUDIO_MAX_OUTPUT_BYTES, AUDIO_UPLOAD_TYPES, AudioError } from "./audio-contract.ts";
import { RetryableJobError } from "../retryable-job-error.ts";

type Credentials = { client_email: string; private_key: string };
let credentials: (() => Credentials | undefined) | undefined;
// The app supplies its existing validated Vercel credentials; workers use ADC.
export function setPrivateAudioCredentials(read: () => Credentials | undefined) { credentials = read; }
export function privateAudioConfigured() {
  const name = process.env.GCP_PRIVATE_AUDIO_BUCKET?.trim();
  return Boolean(name && name !== (process.env.GCP_STORAGE_BUCKET ?? process.env.GOOGLE_CLOUD_STORAGE_BUCKET)?.trim());
}
export function validatePrivateAudioKey(key: string) {
  if (typeof key !== "string" || key.length > 1024 || key.includes("..") || !/^[A-Za-z0-9_%!.'()*~-]+\/[0-9a-f-]{36}\/(?:final\.mp3|recording-[0-9a-f-]{36}|chunks\/[0-9]{1,4}\.mp3)$/.test(key)) throw new AudioError("Invalid private audio identity.");
  return key;
}
export class PrivateAudioStorage {
  private verifiedUntil = 0;
  constructor(private readonly client: Storage, private readonly bucketName: string) {}
  private async bucket() {
    const bucket = this.client.bucket(this.bucketName);
    if (Date.now() >= this.verifiedUntil) {
      const [metadata] = await bucket.getMetadata();
      // Do not rely on the name "private": reject buckets that permit public IAM.
      if (metadata.iamConfiguration?.publicAccessPrevention !== "enforced") throw new AudioError("Private audio requires a GCP bucket with public access prevention enforced.", 503);
      this.verifiedUntil = Date.now() + 60000;
    }
    return bucket;
  }
  async read(key: string): Promise<Uint8Array | null> {
    validatePrivateAudioKey(key);
    try {
      const bucket = await this.bucket(), file = bucket.file(key);
      let metadata;
      try { [metadata] = await file.getMetadata(); } catch (e) { if ((e as { code?: number }).code === 404) return null; throw e; }
      const size = Number(metadata.size);
      if (!Number.isSafeInteger(size) || size < 1 || size > AUDIO_MAX_OUTPUT_BYTES || !metadata.generation) throw new AudioError("The private audio file is unsupported.");
      const pinned = bucket.file(key, { generation: metadata.generation });
      const chunks: Buffer[] = []; let total = 0;
      for await (const chunk of pinned.createReadStream({ validation: "crc32c" })) {
        const bytes = Buffer.from(chunk as Uint8Array); total += bytes.length;
        if (total > size || total > AUDIO_MAX_OUTPUT_BYTES) throw new AudioError("The private audio file exceeded its limit.");
        chunks.push(bytes);
      }
      if (total !== size) throw new AudioError("The private audio download is incomplete.", 503);
      return Buffer.concat(chunks);
    } catch (e) {
      if (e instanceof AudioError) throw e;
      throw new RetryableJobError("Private audio storage is temporarily unavailable.", { code: "audio_storage_unavailable", retryAfterSeconds: 30 });
    }
  }
  async save(key: string, bytes: Uint8Array, contentType = "audio/mpeg") {
    validatePrivateAudioKey(key);
    if (!bytes.length || bytes.length > AUDIO_MAX_OUTPUT_BYTES || !AUDIO_UPLOAD_TYPES.includes(contentType)) throw new AudioError("Unsupported private audio file.");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    try {
      const file = (await this.bucket()).file(key);
      try { await file.save(Buffer.from(bytes), { resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: "private, no-store", metadata: { checksum } } }); }
      catch (e) {
        if ((e as { code?: number }).code !== 412) throw e;
        const [metadata] = await file.getMetadata();
        if (metadata.metadata?.checksum !== checksum || Number(metadata.size) !== bytes.length || metadata.contentType !== contentType) throw new AudioError("A different audio object already uses this identity.", 409);
      }
    } catch (e) {
      if (e instanceof AudioError) throw e;
      throw new RetryableJobError("The audio file may be saved. Recover it before another provider submission.", { code: "audio_storage_unavailable", retryAfterSeconds: 30 });
    }
  }
  async remove(keys: string[]) {
    if (keys.length > 10000) throw new AudioError("Too many audio objects to clean up.");
    keys.forEach(validatePrivateAudioKey);
    const bucket = await this.bucket();
    for (const key of keys) await bucket.file(key).delete({ ignoreNotFound: true });
  }
}
let storage: PrivateAudioStorage | null = null;
function configured() {
  if (!privateAudioConfigured()) throw new AudioError("Configure a separate private GCP audio bucket.", 503);
  return storage ??= new PrivateAudioStorage(new Storage({ projectId: process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT, ...(credentials ? { credentials: credentials() } : {}) }), process.env.GCP_PRIVATE_AUDIO_BUCKET!.trim());
}
export const savePrivateAudio = (key: string, bytes: Uint8Array, type?: string) => configured().save(key, bytes, type);
export const readOptionalPrivateAudio = (key: string) => configured().read(key);
export async function readPrivateAudio(key: string) { const bytes = await readOptionalPrivateAudio(key); if (!bytes) throw new AudioError("Audio not found.", 404); return bytes; }
export const deletePrivateAudio = (keys: string[]) => configured().remove(keys);
