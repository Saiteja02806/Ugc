import { Storage } from "@google-cloud/storage";
import { Readable } from "node:stream";

import {
  getGoogleServiceAccountCredentials,
  getMissingVercelGcpCredentialEnvVars,
} from "../gcp/credentials.ts";
import type {
  CreateSignedPutUrlParams,
  GetStorageObjectParams,
  ObjectStorageProvider,
  StorageGetObjectResult,
  StorageObjectKeyParams,
  UploadBufferParams,
} from "./types.ts";

type GcsStorageConfig = {
  bucket: string;
  projectId?: string;
  publicBaseUrl: string;
};

type GcsRange = {
  contentLength?: number;
  contentRange?: string;
  end?: number;
  start?: number;
};

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

let storageClient: Storage | null = null;

function getEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getRequiredEnv(names: string[]) {
  const value = getEnv(names);

  if (!value) {
    throw new Error(`Missing ${names[0]}`);
  }

  return value;
}

function getStorageConfig(): GcsStorageConfig {
  return {
    bucket: getRequiredEnv(["GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET"]),
    projectId: getEnv(["GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT"]),
    publicBaseUrl: getRequiredEnv([
      "GCP_STORAGE_PUBLIC_BASE_URL",
      "GCS_PUBLIC_BASE_URL",
    ]),
  };
}

function getStorageClient(config: GcsStorageConfig) {
  if (!storageClient) {
    const credentials = getGoogleServiceAccountCredentials();

    storageClient = new Storage({
      ...(credentials ? { credentials } : {}),
      ...(config.projectId ? { projectId: config.projectId } : {}),
    });
  }

  return storageClient;
}

function getMissingEnvVars() {
  const missing: string[] = [];

  if (!getEnv(["GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET"])) {
    missing.push("GCP_STORAGE_BUCKET");
  }

  if (!getEnv(["GCP_STORAGE_PUBLIC_BASE_URL", "GCS_PUBLIC_BASE_URL"])) {
    missing.push("GCP_STORAGE_PUBLIC_BASE_URL");
  }

  missing.push(...getMissingVercelGcpCredentialEnvVars());

  return missing;
}

function cleanGcsKey(key: string) {
  return key.replace(/^\//, "");
}

function formatPublicUrl(baseUrl: string, key: string) {
  const baseUrlWithScheme = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : `https://${baseUrl}`;
  const cleanBaseUrl = baseUrlWithScheme.replace(/\/$/, "");
  const cleanKey = cleanGcsKey(key);

  return `${cleanBaseUrl}/${cleanKey}`;
}

function buildDirectUrl(key: string) {
  const bucket = getRequiredEnv(["GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET"]);
  const cleanKey = cleanGcsKey(key);

  return `https://storage.googleapis.com/${bucket}/${cleanKey}`;
}

function buildPublicUrl(key: string) {
  const config = getStorageConfig();

  return formatPublicUrl(config.publicBaseUrl, key);
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

  const config = getPartialConfig();
  const hostname = parsedUrl.hostname.toLowerCase();
  const publicHostname = config.publicBaseUrl
    ? getHostnameFromDomain(config.publicBaseUrl)
    : null;

  if (
    publicHostname &&
    hostname === publicHostname &&
    isWithinConfiguredPublicBase(parsedUrl, config.publicBaseUrl)
  ) {
    return true;
  }

  if (!config.bucket) {
    return false;
  }

  const bucket = config.bucket.toLowerCase();

  if (hostname === `${bucket}.storage.googleapis.com`) {
    return true;
  }

  if (hostname === "storage.googleapis.com") {
    const firstPathSegment = parsedUrl.pathname
      .split("/")
      .filter(Boolean)[0]
      ?.toLowerCase();

    return firstPathSegment === bucket;
  }

  return false;
}

async function createSignedPutUrl(params: CreateSignedPutUrlParams) {
  const config = getStorageConfig();
  const cleanKey = cleanGcsKey(params.key);
  const file = getStorageClient(config).bucket(config.bucket).file(cleanKey);
  const extensionHeaders = params.cacheControl
    ? { "cache-control": params.cacheControl }
    : undefined;

  const [url] = await file.getSignedUrl({
    action: "write",
    contentType: params.contentType,
    expires: Date.now() + (params.expiresInSeconds ?? 600) * 1000,
    ...(extensionHeaders ? { extensionHeaders } : {}),
    version: "v4",
  });

  return url;
}

async function headObject(params: StorageObjectKeyParams) {
  const config = getStorageConfig();
  const cleanKey = cleanGcsKey(params.key);
  const file = getStorageClient(config).bucket(config.bucket).file(cleanKey);

  try {
    const [metadata] = await file.getMetadata();

    return {
      ContentLength: parseContentLength(metadata.size),
      ContentType: metadata.contentType,
    };
  } catch (error) {
    throw normalizeGcsError(error, cleanKey);
  }
}

async function getObject(
  params: GetStorageObjectParams,
): Promise<StorageGetObjectResult> {
  const config = getStorageConfig();
  const cleanKey = cleanGcsKey(params.key);
  const file = getStorageClient(config).bucket(config.bucket).file(cleanKey);

  try {
    const [metadata] = await file.getMetadata();
    const totalLength = parseContentLength(metadata.size);
    const range = parseRange(params.range, totalLength);
    const nodeStream = file.createReadStream({
      ...(range.start !== undefined ? { start: range.start } : {}),
      ...(range.end !== undefined ? { end: range.end } : {}),
    });

    return {
      Body: {
        transformToWebStream: () =>
          Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
      },
      ContentLength: range.contentLength ?? totalLength,
      ContentRange: range.contentRange,
      ContentType: metadata.contentType,
    };
  } catch (error) {
    throw normalizeGcsError(error, cleanKey);
  }
}

async function deleteObject(params: StorageObjectKeyParams) {
  const config = getStorageConfig();
  const cleanKey = cleanGcsKey(params.key);
  const file = getStorageClient(config).bucket(config.bucket).file(cleanKey);

  try {
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    throw normalizeGcsError(error, cleanKey);
  }
}

async function uploadBuffer(params: UploadBufferParams) {
  const config = getStorageConfig();
  const cleanKey = cleanGcsKey(params.key);
  const file = getStorageClient(config).bucket(config.bucket).file(cleanKey);

  await file.save(params.buffer, {
    contentType: params.contentType,
    metadata: {
      cacheControl: params.cacheControl ?? DEFAULT_CACHE_CONTROL,
    },
    resumable: false,
  });

  return {
    key: cleanKey,
    url: formatPublicUrl(config.publicBaseUrl, cleanKey),
  };
}

function getPartialConfig() {
  return {
    bucket: getEnv(["GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET"]),
    publicBaseUrl: getEnv(["GCP_STORAGE_PUBLIC_BASE_URL", "GCS_PUBLIC_BASE_URL"]),
  };
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

function isWithinConfiguredPublicBase(parsedUrl: URL, publicBaseUrl?: string) {
  if (!publicBaseUrl) {
    return false;
  }

  try {
    const baseUrl = new URL(
      /^https?:\/\//i.test(publicBaseUrl)
        ? publicBaseUrl
        : `https://${publicBaseUrl}`,
    );
    const basePath = baseUrl.pathname.replace(/\/+$/, "");

    if (!basePath) {
      return true;
    }

    return (
      parsedUrl.pathname === basePath ||
      parsedUrl.pathname.startsWith(`${basePath}/`)
    );
  } catch {
    return false;
  }
}

function parseContentLength(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function parseRange(rangeHeader: string | undefined, totalLength: number | undefined): GcsRange {
  if (!rangeHeader || totalLength === undefined) {
    return {};
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

  if (!match) {
    return {};
  }

  const [, rawStart, rawEnd] = match;
  let start: number | undefined = rawStart ? Number(rawStart) : undefined;
  let end: number | undefined = rawEnd ? Number(rawEnd) : undefined;

  if (start === undefined && end === undefined) {
    return {};
  }

  if (start === undefined && end !== undefined) {
    const suffixLength = Math.max(0, end);
    start = Math.max(totalLength - suffixLength, 0);
    end = totalLength > 0 ? totalLength - 1 : 0;
  } else if (start !== undefined && end === undefined) {
    end = totalLength > 0 ? totalLength - 1 : start;
  }

  if (
    start === undefined ||
    end === undefined ||
    start < 0 ||
    end < start ||
    start >= totalLength
  ) {
    return {};
  }

  end = Math.min(end, totalLength - 1);

  return {
    contentLength: end - start + 1,
    contentRange: `bytes ${start}-${end}/${totalLength}`,
    end,
    start,
  };
}

function normalizeGcsError(error: unknown, key: string) {
  if (isGcsNotFoundError(error)) {
    const notFoundError = new Error(`Object not found: ${key}`) as Error & {
      $metadata: { httpStatusCode: number };
      Code: string;
      code: string;
    };

    notFoundError.name = "NoSuchKey";
    notFoundError.Code = "NoSuchKey";
    notFoundError.code = "NoSuchKey";
    notFoundError.$metadata = { httpStatusCode: 404 };

    return notFoundError;
  }

  return error;
}

function isGcsNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 404
  );
}

export const gcsStorageProvider: ObjectStorageProvider = {
  name: "gcp",
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
