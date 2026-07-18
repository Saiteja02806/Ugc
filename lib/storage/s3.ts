import { awsStorageProvider } from "./aws-s3.ts";
import { gcsStorageProvider } from "./gcs.ts";

import type { ObjectStorageProvider } from "./types.ts";

type CreatePresignedPutUrlParams = Parameters<
  ObjectStorageProvider["createSignedPutUrl"]
>[0];
type UploadBufferParams = Parameters<ObjectStorageProvider["uploadBuffer"]>[0];

export function getMissingStorageEnvVars() {
  return getStorageProvider().getMissingEnvVars();
}

export function isTrustedStorageUrl(url: string) {
  return getStorageProvider().isTrustedUrl(url);
}

export function buildDirectS3Url(key: string) {
  return getStorageProvider().buildDirectUrl(key);
}

export function buildCloudFrontUrl(key: string) {
  return getStorageProvider().buildPublicUrl(key);
}

export async function createPresignedPutUrl(
  params: CreatePresignedPutUrlParams,
) {
  return getStorageProvider().createSignedPutUrl(params);
}

export async function headS3Object(
  params: Parameters<ObjectStorageProvider["headObject"]>[0],
) {
  return getStorageProvider().headObject(params);
}

export async function getS3Object(
  params: Parameters<ObjectStorageProvider["getObject"]>[0],
) {
  return getStorageProvider().getObject(params);
}

export async function deleteS3Object(
  params: Parameters<ObjectStorageProvider["deleteObject"]>[0],
) {
  await getStorageProvider().deleteObject(params);
}

export async function uploadBufferToS3(params: UploadBufferParams) {
  return getStorageProvider().uploadBuffer(params);
}

export function getStorageProviderName() {
  return getStorageProvider().name;
}

function getStorageProvider(): ObjectStorageProvider {
  const configuredProvider = (
    process.env.STORAGE_PROVIDER ??
    process.env.UGC_STORAGE_PROVIDER ??
    "aws"
  )
    .trim()
    .toLowerCase();

  if (configuredProvider === "gcp" || configuredProvider === "gcs") {
    return gcsStorageProvider;
  }

  return awsStorageProvider;
}
