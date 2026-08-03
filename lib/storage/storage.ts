import { gcsStorageProvider } from "./gcs.ts";

import type { ObjectStorageProvider } from "./types.ts";

type CreateSignedPutUrlParams = Parameters<
  ObjectStorageProvider["createSignedPutUrl"]
>[0];
type UploadBufferParams = Parameters<ObjectStorageProvider["uploadBuffer"]>[0];

export function getMissingStorageEnvVars() {
  return gcsStorageProvider.getMissingEnvVars();
}

export function isTrustedStorageUrl(url: string) {
  return gcsStorageProvider.isTrustedUrl(url);
}

export function buildDirectStorageUrl(key: string) {
  return gcsStorageProvider.buildDirectUrl(key);
}

export function buildPublicStorageUrl(key: string) {
  return gcsStorageProvider.buildPublicUrl(key);
}

export async function createSignedPutUrl(params: CreateSignedPutUrlParams) {
  return gcsStorageProvider.createSignedPutUrl(params);
}

export async function headStorageObject(
  params: Parameters<ObjectStorageProvider["headObject"]>[0],
) {
  return gcsStorageProvider.headObject(params);
}

export async function getStorageObject(
  params: Parameters<ObjectStorageProvider["getObject"]>[0],
) {
  return gcsStorageProvider.getObject(params);
}

export async function deleteStorageObject(
  params: Parameters<ObjectStorageProvider["deleteObject"]>[0],
) {
  await gcsStorageProvider.deleteObject(params);
}

export async function uploadBufferToStorage(params: UploadBufferParams) {
  return gcsStorageProvider.uploadBuffer(params);
}

export function getStorageProviderName() {
  return gcsStorageProvider.name;
}
