import "server-only";
import { Storage } from "@google-cloud/storage";
import { Readable } from "node:stream";
import { getGoogleServiceAccountCredentials } from "@/lib/gcp/credentials";

/** Explicit private reads only. Generic worker/catalog storage stays public. */
export function privateMediaBucketName() {
  const privateBucket = process.env.GCP_PRIVATE_MEDIA_BUCKET?.trim();
  const primary = process.env.GCP_STORAGE_BUCKET?.trim() || process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim();
  if (!privateBucket || privateBucket === primary) throw new Error("A separate private-media bucket is required.");
  return privateBucket;
}

export function validPrivateStorageKey(key: string) {
  if (!key || key !== key.trim() || key.startsWith("/") || /[:\\\u0000-\u001f]/.test(key) ||
      key.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid private-media key.");
  return key;
}

function privateFile(key: string) {
  const credentials = getGoogleServiceAccountCredentials();
  return new Storage({ ...(credentials ? { credentials } : {}),
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT })
    .bucket(privateMediaBucketName()).file(validPrivateStorageKey(key));
}

export async function privateMediaHead(key: string) {
  const [metadata] = await privateFile(key).getMetadata();
  return { ContentLength: Number(metadata.size), ContentType: metadata.contentType };
}

export async function privateMediaObject(params: { key: string; range?: string }) {
  const file = privateFile(params.key);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size <= 0 || !metadata.generation) throw new Error("Invalid private object.");
  let start = 0;
  let end = size - 1;
  if (params.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(params.range);
    if (!match || (!match[1] && !match[2])) throw new Error("Invalid media byte range.");
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
      throw new Error("Invalid media byte range.");
    }
  }
  const stream = file.bucket.file(file.name, { generation: metadata.generation }).createReadStream({ start, end });
  return { body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, size: end - start + 1,
    contentType: metadata.contentType, contentRange: params.range ? `bytes ${start}-${end}/${size}` : null };
}

/** Deliberately no upload/switch implementation yet: accidental activation must fail closed. */
export function assertPrivateMediaWritesDisabled() {
  if (process.env.PRIVATE_USER_MEDIA_ENABLED === "true") {
    throw new Error("Private-media uploads are not enabled until rollout acceptance is complete.");
  }
}
