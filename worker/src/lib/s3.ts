import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";

type UploadBufferToS3Params = {
  buffer: Buffer;
  cacheControl?: string;
  contentType: string;
  key: string;
};

type StorageProviderName = "aws" | "gcp";

type GcsStorageConfig = {
  bucket: string;
  projectId?: string;
  publicBaseUrl: string;
};

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

let s3Client: S3Client | null = null;
let gcsClient: Storage | null = null;

export async function uploadBufferToS3(params: UploadBufferToS3Params) {
  if (getStorageProviderName() === "gcp") {
    return uploadBufferToGcs(params);
  }

  return uploadBufferToAwsS3(params);
}

async function uploadBufferToAwsS3(params: UploadBufferToS3Params) {
  const bucket = getRequiredEnv("AWS_S3_BUCKET");
  const cleanKey = cleanS3Key(params.key);

  await getS3Client().send(
    new PutObjectCommand({
      Body: params.buffer,
      Bucket: bucket,
      CacheControl:
        params.cacheControl ?? DEFAULT_CACHE_CONTROL,
      ContentType: params.contentType,
      Key: cleanKey,
    }),
  );

  return {
    key: cleanKey,
    url: buildCloudFrontUrl(cleanKey),
  };
}

async function uploadBufferToGcs(params: UploadBufferToS3Params) {
  const config = getGcsStorageConfig();
  const cleanKey = cleanS3Key(params.key);
  const file = getGcsClient(config).bucket(config.bucket).file(cleanKey);

  await file.save(params.buffer, {
    contentType: params.contentType,
    metadata: {
      cacheControl: params.cacheControl ?? DEFAULT_CACHE_CONTROL,
    },
    resumable: false,
  });

  return {
    key: cleanKey,
    url: buildGcsPublicUrl(config.publicBaseUrl, cleanKey),
  };
}

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getRequiredEnv("AWS_REGION"),
    });
  }

  return s3Client;
}

function getGcsClient(config: GcsStorageConfig) {
  if (!gcsClient) {
    gcsClient = new Storage({
      ...(config.projectId ? { projectId: config.projectId } : {}),
    });
  }

  return gcsClient;
}

function buildCloudFrontUrl(key: string) {
  const domain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(domain)
    ? domain
    : `https://${domain}`;
  const cleanDomain = domainWithScheme.replace(/\/$/, "");

  return `${cleanDomain}/${cleanS3Key(key)}`;
}

function buildGcsPublicUrl(baseUrl: string, key: string) {
  const baseUrlWithScheme = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : `https://${baseUrl}`;
  const cleanBaseUrl = baseUrlWithScheme.replace(/\/$/, "");

  return `${cleanBaseUrl}/${cleanS3Key(key)}`;
}

function cleanS3Key(key: string) {
  return key.replace(/^\//, "");
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getGcsStorageConfig(): GcsStorageConfig {
  return {
    bucket: getRequiredEnvAlias("GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET"),
    projectId: getOptionalEnvAlias("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT"),
    publicBaseUrl: getRequiredEnvAlias(
      "GCP_STORAGE_PUBLIC_BASE_URL",
      "GCS_PUBLIC_BASE_URL",
    ),
  };
}

function getStorageProviderName(): StorageProviderName {
  const configuredProvider = (
    process.env.STORAGE_PROVIDER ??
    process.env.UGC_STORAGE_PROVIDER ??
    "aws"
  )
    .trim()
    .toLowerCase();

  return configuredProvider === "gcp" || configuredProvider === "gcs"
    ? "gcp"
    : "aws";
}

function getOptionalEnvAlias(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getRequiredEnvAlias(...names: string[]) {
  const value = getOptionalEnvAlias(...names);

  if (!value) {
    throw new Error(`Missing ${names[0]}`);
  }

  return value;
}
