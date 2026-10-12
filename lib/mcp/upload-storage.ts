import "server-only";
import { Storage } from "@google-cloud/storage";
import { getGoogleServiceAccountCredentials } from "@/lib/gcp/credentials";
import type { MediaAssetRow } from "@/lib/media/media-storage";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";
import { privateMediaBucketName, privateMediaHead, validPrivateStorageKey, assertPrivateMediaIdentity } from "@/lib/media/private-media-storage";
import { createSignedPutUrl, headStorageObject, uploadBufferToStorage, deleteStorageObject } from "@/lib/storage/storage";
import { ToolFailure } from "./read-tools";

/** This gate applies to MCP only. The website's staged cutover stays unchanged. */
export function privateMcpUploadsSelected() {
  if (process.env.MCP_PRIVATE_UPLOADS_ENABLED === "true") {
    assertPrivateMcpWritesEnabled();
    return true;
  }
  if (process.env.PRIVATE_USER_MEDIA_ENABLED === "true") assertPrivateMcpWritesEnabled();
  return false;
}
function assertPrivateMcpWritesEnabled() {
  if (process.env.MCP_PRIVATE_UPLOADS_ENABLED !== "true")
    throw new ToolFailure("PRIVATE_UPLOAD_UNAVAILABLE", "Private media upload is not enabled. Existing reservations can still be read and confirmed.");
  privateMediaBucketName();
}
function storageClient() {
  const credentials = getGoogleServiceAccountCredentials();
  return new Storage({ ...(credentials ? { credentials } : {}),
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT });
}
async function privateWriteBucket() {
  assertPrivateMcpWritesEnabled();
  const bucket = storageClient().bucket(privateMediaBucketName());
  // No IAM mutation, public fallback, or inference from an unverified inherited policy.
  const [metadata] = await bucket.getMetadata();
  if (metadata.iamConfiguration?.publicAccessPrevention !== "enforced")
    throw new ToolFailure("PRIVATE_UPLOAD_UNAVAILABLE", "The private upload destination has not passed its access-policy check.");
  return bucket;
}
export async function privateMcpUploadTarget(key: string) {
  const safeKey = validPrivateStorageKey(key);
  if (!process.env.MEDIA_DELIVERY_SIGNING_SECRET?.trim() || process.env.MEDIA_DELIVERY_SIGNING_SECRET.trim().length < 32)
    throw new ToolFailure("PRIVATE_UPLOAD_UNAVAILABLE", "Private media delivery is not configured.");
  const app = new URL(process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://getugcpilot.com");
  if (app.protocol !== "https:" || app.username || app.password)
    throw new ToolFailure("PRIVATE_UPLOAD_UNAVAILABLE", "Private media delivery requires the configured HTTPS application.");
  await privateWriteBucket();
  return `https://storage.googleapis.com/${privateMediaBucketName()}/${safeKey}`;
}
export async function signMcpUpload(row: MediaAssetRow, seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600 || !row.file_size_bytes || !row.mime_type)
    throw new Error("Invalid upload lease.");
  if (!isPrivateUserMedia(row)) return createSignedPutUrl({ key: row.storage_key,
    contentType: row.mime_type, maxBytes: row.file_size_bytes, createOnly: true, expiresInSeconds: seconds });
  assertPrivateMediaIdentity(row.storage_key,row.url);
  const bucket = await privateWriteBucket();
  const [url] = await bucket.file(validPrivateStorageKey(row.storage_key)).getSignedUrl({
    action: "write", version: "v4", contentType: row.mime_type, expires: Date.now() + seconds * 1000,
    extensionHeaders: { "x-goog-content-length-range": `1,${row.file_size_bytes}`, "x-goog-if-generation-match": "0" },
  });
  return url;
}
export async function headMcpUpload(row: MediaAssetRow) {
  if (!isPrivateUserMedia(row)) return headStorageObject({ key: row.storage_key });
  assertPrivateMediaIdentity(row.storage_key,row.url);
  try { return await privateMediaHead(row.storage_key); }
  catch (error) {
    if ((error as {code?:unknown})?.code === 404) throw Object.assign(new Error("Object not found"), {name:"NoSuchKey"});
    throw error;
  }
}
function assertDeletedReservation(row: MediaAssetRow) {
  if (row.status !== "uploading" || !row.deleted_at || !row.metadata || typeof row.metadata !== "object" ||
      Array.isArray(row.metadata) || row.metadata.mcpUpload !== true)
    throw new Error("Only a deleted MCP reservation can be cleaned up.");
}
export async function sealMcpUpload(row: MediaAssetRow, bytes: Buffer) {
  assertDeletedReservation(row);
  if (!isPrivateUserMedia(row)) return uploadBufferToStorage({ key: row.storage_key, buffer: bytes,
    contentType: "application/octet-stream", cacheControl: "no-store" });
  assertPrivateMediaIdentity(row.storage_key,row.url);
  const bucket = await privateWriteBucket();
  const file = bucket.file(validPrivateStorageKey(row.storage_key));
  // Only called after owner-scoped soft deletion. Pin an existing generation,
  // or occupy a missing key, so concurrent cleanup never overwrites a newer object.
  let generation: string | number = 0;
  try {
    const [metadata] = await file.getMetadata();
    if (!metadata.generation) throw new Error("Missing private object generation");
    generation = metadata.generation;
  } catch (error) { if ((error as {code?:unknown})?.code !== 404) throw error; }
  await file.save(bytes, {resumable:false,validation:"crc32c",preconditionOpts:{ifGenerationMatch:generation},
    metadata:{contentType:"application/octet-stream",cacheControl:"private, no-store"}});
}
export async function removeMcpUpload(row: MediaAssetRow) {
  assertDeletedReservation(row);
  if (!isPrivateUserMedia(row)) return deleteStorageObject({ key: row.storage_key });
  assertPrivateMediaIdentity(row.storage_key,row.url);
  const bucket = await privateWriteBucket();
  const file = bucket.file(validPrivateStorageKey(row.storage_key));
  try {
    const [metadata] = await file.getMetadata();
    if (!metadata.generation) throw new Error("Missing private cleanup generation");
    await file.delete({ifGenerationMatch:metadata.generation,ignoreNotFound:true});
  } catch (error) { if ((error as {code?:unknown})?.code !== 404) throw error; }
}
