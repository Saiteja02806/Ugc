import { Storage } from "@google-cloud/storage";

type UploadBufferToStorageParams = {
  buffer: Buffer;
  cacheControl?: string;
  contentType: string;
  key: string;
};

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

let storageClient: Storage | null = null;

export async function uploadBufferToStorage(
  params: UploadBufferToStorageParams,
) {
  const config = getGcsStorageConfig();
  const cleanKey = cleanStorageKey(params.key);
  const file = getStorageClient(config.projectId)
    .bucket(config.bucket)
    .file(cleanKey);

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

export async function getStoredObject(key: string) {
  const config = getGcsStorageConfig();
  const cleanKey = cleanStorageKey(key);
  const file = getStorageClient(config.projectId)
    .bucket(config.bucket)
    .file(cleanKey);
  const [exists] = await file.exists();

  if (!exists) {
    return null;
  }

  return {
    key: cleanKey,
    url: buildGcsPublicUrl(config.publicBaseUrl, cleanKey),
  };
}

export async function downloadStoredObjectBuffer(key: string) {
  const config = getGcsStorageConfig();
  const cleanKey = cleanStorageKey(key);
  const [buffer] = await getStorageClient(config.projectId)
    .bucket(config.bucket)
    .file(cleanKey)
    .download();

  return buffer;
}

export function getStorageProviderName() {
  return "gcp" as const;
}

function getStorageClient(projectId?: string) {
  if (!storageClient) {
    storageClient = new Storage({
      ...(projectId ? { projectId } : {}),
    });
  }

  return storageClient;
}

function buildGcsPublicUrl(baseUrl: string, key: string) {
  const baseUrlWithScheme = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : `https://${baseUrl}`;
  const cleanBaseUrl = baseUrlWithScheme.replace(/\/$/, "");

  return `${cleanBaseUrl}/${cleanStorageKey(key)}`;
}

function cleanStorageKey(key: string) {
  return key.replace(/^\//, "");
}

function getGcsStorageConfig() {
  return {
    bucket: getRequiredEnvAlias(
      "GCP_STORAGE_BUCKET",
      "GOOGLE_CLOUD_STORAGE_BUCKET",
    ),
    projectId: getOptionalEnvAlias("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT"),
    publicBaseUrl: getRequiredEnvAlias(
      "GCP_STORAGE_PUBLIC_BASE_URL",
      "GCS_PUBLIC_BASE_URL",
    ),
  };
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
