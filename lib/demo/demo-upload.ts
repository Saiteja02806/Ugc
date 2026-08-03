import { buildPublicStorageUrl } from "@/lib/storage/storage";

export const MAX_DEMO_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MIN_DEMO_DURATION_SECONDS = 1;
export const MAX_DEMO_DURATION_SECONDS = 60;
export const DEMO_UPLOAD_URL_EXPIRES_IN_SECONDS = 10 * 60;
export const RAW_DEMO_STORAGE_PREFIX = "demos/raw";

export const ALLOWED_DEMO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const ALLOWED_DEMO_EXTENSIONS = [".mp4", ".mov", ".webm"] as const;

export type DemoContentType = (typeof ALLOWED_DEMO_CONTENT_TYPES)[number];
export type DemoFileExtension = (typeof ALLOWED_DEMO_EXTENSIONS)[number];

export type DemoUploadInput = {
  userId: string;
  projectId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
};

export type DemoUploadTarget = {
  demoId: string;
  userId: string;
  projectId: string;
  fileName: string;
  contentType: DemoContentType;
  fileSize: number;
  extension: DemoFileExtension;
  key: string;
  publicUrl: string;
};

export type DemoKeyValidationInput = {
  userId: string;
  projectId: string;
  key: string;
  demoId?: string;
};

export type DemoUploadValidationResult =
  | {
      ok: true;
      target: DemoUploadTarget;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 413;
    };

export type DemoKeyValidationResult =
  | {
      ok: true;
      key: string;
    }
  | {
      ok: false;
      error: string;
      status: 400;
    };

type NormalizedDemoUploadInput = {
  userId: string;
  projectId: string;
  fileName: string;
  contentType: DemoContentType;
  fileSize: number;
  extension: DemoFileExtension;
};

const DEMO_EXTENSION_BY_CONTENT_TYPE: Record<
  DemoContentType,
  DemoFileExtension
> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;

function errorResult(error: string): { ok: false; error: string; status: 400 };
function errorResult(
  error: string,
  status: 413,
): { ok: false; error: string; status: 413 };
function errorResult(error: string, status: 400 | 413 = 400) {
  return {
    ok: false,
    error,
    status,
  };
}

function isDemoContentType(value: string): value is DemoContentType {
  return ALLOWED_DEMO_CONTENT_TYPES.includes(value as DemoContentType);
}

function isDemoExtension(value: string): value is DemoFileExtension {
  return ALLOWED_DEMO_EXTENSIONS.includes(value as DemoFileExtension);
}

function normalizePathSegment(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    return errorResult(`${label} is required.`);
  }

  if (!SAFE_PATH_SEGMENT_PATTERN.test(normalized)) {
    return errorResult(
      `${label} must contain only letters, numbers, hyphens, and underscores.`,
    );
  }

  return {
    ok: true as const,
    value: normalized,
  };
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function validateFileName(fileName: string) {
  const normalized = fileName.trim();

  if (!normalized) {
    return errorResult("Demo video file name is required.");
  }

  if (normalized.length > 255) {
    return errorResult("Demo video file name is too long.");
  }

  if (/[/\\\0]/.test(normalized)) {
    return errorResult("Demo video file name must not include a path.");
  }

  const extension = getFileExtension(normalized);

  if (!extension || !isDemoExtension(extension)) {
    return errorResult("Demo video must be an MP4, MOV, or WebM file.");
  }

  return {
    ok: true as const,
    fileName: normalized,
    extension,
  };
}

function validateDemoUploadInput(
  input: DemoUploadInput,
):
  | {
      ok: true;
      value: NormalizedDemoUploadInput;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 413;
    } {
  const userId = normalizePathSegment(input.userId, "User ID");

  if (!userId.ok) {
    return userId;
  }

  const projectId = normalizePathSegment(input.projectId, "Project ID");

  if (!projectId.ok) {
    return projectId;
  }

  const fileName = validateFileName(input.fileName);

  if (!fileName.ok) {
    return fileName;
  }

  const contentType = input.contentType.trim().toLowerCase();

  if (!isDemoContentType(contentType)) {
    return errorResult("Demo video must be MP4, MOV, or WebM.");
  }

  const expectedExtension = DEMO_EXTENSION_BY_CONTENT_TYPE[contentType];

  if (fileName.extension !== expectedExtension) {
    return errorResult(
      `Demo video file extension must match ${contentType}. Expected ${expectedExtension}.`,
    );
  }

  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return errorResult("Demo video file size must be greater than 0.");
  }

  if (!Number.isInteger(input.fileSize)) {
    return errorResult("Demo video file size must be an integer.");
  }

  if (input.fileSize > MAX_DEMO_UPLOAD_BYTES) {
    return errorResult(
      "Demo video is too large. Maximum size is 100 MB.",
      413,
    );
  }

  return {
    ok: true,
    value: {
      userId: userId.value,
      projectId: projectId.value,
      fileName: fileName.fileName,
      contentType,
      fileSize: input.fileSize,
      extension: fileName.extension,
    },
  };
}

export function buildRawDemoKeyPrefix(params: {
  userId: string;
  projectId: string;
}) {
  return `${RAW_DEMO_STORAGE_PREFIX}/${params.userId}/${params.projectId}/`;
}

export function buildRawDemoStorageKey(params: {
  userId: string;
  projectId: string;
  demoId: string;
  extension: DemoFileExtension;
}) {
  return `${buildRawDemoKeyPrefix(params)}${params.demoId}${params.extension}`;
}

export function createDemoUploadTarget(
  input: DemoUploadInput,
): DemoUploadValidationResult {
  const validation = validateDemoUploadInput(input);

  if (!validation.ok) {
    return validation;
  }

  const demoId = crypto.randomUUID();
  const key = buildRawDemoStorageKey({
    userId: validation.value.userId,
    projectId: validation.value.projectId,
    demoId,
    extension: validation.value.extension,
  });

  return {
    ok: true,
    target: {
      demoId,
      key,
      publicUrl: buildPublicStorageUrl(key),
      ...validation.value,
    },
  };
}

export function validateRawDemoKeyForOwner(
  input: DemoKeyValidationInput,
): DemoKeyValidationResult {
  const userId = normalizePathSegment(input.userId, "User ID");

  if (!userId.ok) {
    return userId;
  }

  const projectId = normalizePathSegment(input.projectId, "Project ID");

  if (!projectId.ok) {
    return projectId;
  }

  const cleanKey = input.key.trim().replace(/^\//, "");
  const expectedPrefix = buildRawDemoKeyPrefix({
    userId: userId.value,
    projectId: projectId.value,
  });

  if (!cleanKey.startsWith(expectedPrefix)) {
    return errorResult("Demo video key is outside the allowed project path.");
  }

  const fileName = cleanKey.slice(expectedPrefix.length);

  if (!fileName || fileName.includes("/")) {
    return errorResult("Demo video key must point to a raw demo file.");
  }

  const extension = getFileExtension(fileName);

  if (!extension || !isDemoExtension(extension)) {
    return errorResult("Demo video key must point to an MP4, MOV, or WebM file.");
  }

  if (input.demoId) {
    const demoId = normalizePathSegment(input.demoId, "Demo ID");

    if (!demoId.ok) {
      return demoId;
    }

    if (fileName !== `${demoId.value}${extension}`) {
      return errorResult("Demo video key does not match the demo ID.");
    }
  }

  return {
    ok: true,
    key: cleanKey,
  };
}
