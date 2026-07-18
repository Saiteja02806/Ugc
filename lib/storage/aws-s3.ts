import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  CreateSignedPutUrlParams,
  GetStorageObjectParams,
  ObjectStorageProvider,
  StorageGetObjectResult,
  StorageObjectKeyParams,
  UploadBufferParams,
} from "./types.ts";

type StorageConfig = {
  accessKeyId: string;
  bucket: string;
  cloudfrontDomain: string;
  region: string;
  secretAccessKey: string;
};

let s3Client: S3Client | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getStorageConfig(): StorageConfig {
  return {
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    bucket: getRequiredEnv("AWS_S3_BUCKET"),
    cloudfrontDomain: getRequiredEnv("CLOUDFRONT_DOMAIN"),
    region: getRequiredEnv("AWS_REGION"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  };
}

function getS3Client(config: StorageConfig) {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return s3Client;
}

function cleanS3Key(key: string) {
  return key.replace(/^\//, "");
}

function formatCloudFrontUrl(domain: string, key: string) {
  const domainWithScheme = /^https?:\/\//i.test(domain)
    ? domain
    : `https://${domain}`;
  const cleanDomain = domainWithScheme.replace(/\/$/, "");
  const cleanKey = cleanS3Key(key);

  return `${cleanDomain}/${cleanKey}`;
}

function getMissingEnvVars() {
  return [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET",
    "CLOUDFRONT_DOMAIN",
  ].filter((name) => !process.env[name]);
}

function isTrustedUrl(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const cloudfrontHostname = getCloudFrontHostname();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();

  if (cloudfrontHostname && hostname === cloudfrontHostname) {
    return true;
  }

  if (!bucket || !region) {
    return false;
  }

  if (
    hostname === `${bucket}.s3.${region}.amazonaws.com`.toLowerCase() ||
    hostname === `${bucket}.s3.amazonaws.com`.toLowerCase()
  ) {
    return true;
  }

  if (hostname === `s3.${region}.amazonaws.com`.toLowerCase()) {
    const firstPathSegment = parsedUrl.pathname
      .split("/")
      .filter(Boolean)[0];

    return firstPathSegment === bucket;
  }

  return false;
}

function buildDirectUrl(key: string) {
  const bucket = getRequiredEnv("AWS_S3_BUCKET");
  const region = getRequiredEnv("AWS_REGION");
  const cleanKey = cleanS3Key(key);

  return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
}

function buildPublicUrl(key: string) {
  const config = getStorageConfig();

  return formatCloudFrontUrl(config.cloudfrontDomain, key);
}

async function createSignedPutUrl(params: CreateSignedPutUrlParams) {
  const config = getStorageConfig();
  const cleanKey = cleanS3Key(params.key);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: cleanKey,
    ContentType: params.contentType,
    ...(params.cacheControl ? { CacheControl: params.cacheControl } : {}),
  });

  return getSignedUrl(getS3Client(config), command, {
    expiresIn: params.expiresInSeconds ?? 600,
  });
}

async function headObject(params: StorageObjectKeyParams) {
  const config = getStorageConfig();
  const cleanKey = cleanS3Key(params.key);

  return getS3Client(config).send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
    }),
  );
}

async function getObject(
  params: GetStorageObjectParams,
): Promise<StorageGetObjectResult> {
  const config = getStorageConfig();
  const cleanKey = cleanS3Key(params.key);
  const result = await getS3Client(config).send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
      ...(params.range ? { Range: params.range } : {}),
    }),
  );

  return {
    Body: result.Body as StorageGetObjectResult["Body"],
    ContentLength: result.ContentLength,
    ContentRange: result.ContentRange,
    ContentType: result.ContentType,
  };
}

async function deleteObject(params: StorageObjectKeyParams) {
  const config = getStorageConfig();
  const cleanKey = cleanS3Key(params.key);

  await getS3Client(config).send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
    }),
  );
}

async function uploadBuffer(params: UploadBufferParams) {
  const config = getStorageConfig();
  const cleanKey = cleanS3Key(params.key);

  await getS3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl:
        params.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );

  return {
    key: cleanKey,
    url: formatCloudFrontUrl(config.cloudfrontDomain, cleanKey),
  };
}

function getCloudFrontHostname() {
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN?.trim();

  return cloudfrontDomain ? getHostnameFromDomain(cloudfrontDomain) : null;
}

function getHostnameFromDomain(domain: string) {
  try {
    const domainWithScheme = /^https?:\/\//i.test(domain)
      ? domain
      : `https://${domain}`;

    return new URL(domainWithScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const awsStorageProvider: ObjectStorageProvider = {
  name: "aws",
  getMissingEnvVars,
  isTrustedUrl,
  buildDirectUrl,
  buildPublicUrl,
  createSignedPutUrl,
  headObject,
  getObject,
  deleteObject,
  uploadBuffer,
};
