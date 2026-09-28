import type { MediaAssetRow } from "@/lib/media/media-storage";
import { createMediaUploadTarget, getAllowedContentTypes, getMaxUploadBytes } from "@/lib/media/media-upload";
import type { MediaCollection, MediaRatio } from "@/lib/media/types";
import type { StorageHeadObjectResult } from "@/lib/storage/types";

export class UploadValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type McpUploadConfirmation = {
  width: number;
  height: number;
  durationSeconds?: number;
};

export const MCP_UPLOAD_METADATA_KEY = "mcpUpload";

export function isMcpUpload(asset: MediaAssetRow) {
  const metadata = asset.metadata;
  return !!metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
    metadata[MCP_UPLOAD_METADATA_KEY] === true;
}

export function assertMcpUploadConfirmable(asset: MediaAssetRow) {
  if (!isMcpUpload(asset) ||
      (asset.source_type !== "upload" && asset.source_type !== "influencer_upload")) {
    throw new UploadValidationError("NOT_FOUND", "Upload not found.");
  }
  if (asset.status !== "uploading" && asset.status !== "ready") {
    throw new UploadValidationError("UPLOAD_NOT_READY", "This upload cannot be confirmed.");
  }
}

/** Reuses the website upload target rules while preserving MCP error codes. */
export function prepareMcpUploadTarget(input: {
  collection: MediaCollection;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  title?: string;
  userId: string;
}) {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!getAllowedContentTypes(input.collection).includes(mimeType)) {
    throw new UploadValidationError("UNSUPPORTED_MEDIA_TYPE", "The file type is not supported for this collection.");
  }
  if (input.title !== undefined && (!input.title.trim() || input.title.trim().length > 140)) {
    throw new UploadValidationError("INVALID_INPUT", "The upload title must be 1 to 140 characters.");
  }
  const prepared = createMediaUploadTarget({
    collection: input.collection,
    contentType: mimeType,
    fileName: input.fileName,
    fileSize: input.fileSizeBytes,
    title: input.title,
    userId: input.userId,
  });
  if (!prepared.ok) {
    throw new UploadValidationError(
      prepared.status === 413 ? "FILE_TOO_LARGE" : "INVALID_INPUT",
      prepared.error,
    );
  }
  return prepared.target;
}

/** Validates an owned MCP upload before any status change is attempted. */
export function validateMcpUploadConfirmation(params: {
  asset: MediaAssetRow;
  object: StorageHeadObjectResult;
  input: McpUploadConfirmation;
}) {
  const { asset, object, input } = params;
  assertMcpUploadConfirmable(asset);
  if (!Number.isSafeInteger(input.width) || input.width <= 0 ||
      !Number.isSafeInteger(input.height) || input.height <= 0) {
    throw new UploadValidationError("INVALID_INPUT", "Positive media dimensions are required.");
  }
  const objectType = object.ContentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const objectSize = object.ContentLength ?? 0;
  if (!getAllowedContentTypes(asset.collection).includes(objectType)) {
    throw new UploadValidationError("UNSUPPORTED_MEDIA_TYPE", "The uploaded file type is not supported.");
  }
  if (objectSize > getMaxUploadBytes(asset.collection)) {
    throw new UploadValidationError("FILE_TOO_LARGE", "The uploaded file exceeds the size limit.");
  }
  if (!Number.isSafeInteger(objectSize) || objectSize <= 0) {
    throw new UploadValidationError("UPLOAD_NOT_READY", "The uploaded file is empty or unavailable.");
  }
  if (objectType !== asset.mime_type || objectSize !== asset.file_size_bytes) {
    throw new UploadValidationError("UPLOAD_MISMATCH", "The uploaded file differs from the reserved media record.");
  }
  const durationSeconds = asset.collection === "image" ? null : input.durationSeconds;
  if (asset.collection !== "image" &&
      (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw new UploadValidationError("INVALID_INPUT", "A positive video duration is required.");
  }
  if (asset.collection === "image" && input.durationSeconds !== undefined) {
    throw new UploadValidationError("INVALID_INPUT", "Image uploads do not have a video duration.");
  }
  if (asset.status === "ready" && (asset.width !== input.width || asset.height !== input.height ||
      asset.duration_seconds !== durationSeconds)) {
    throw new UploadValidationError("UPLOAD_MISMATCH", "The saved media dimensions or duration differ from this confirmation.");
  }

  return {
    alreadyReady: asset.status === "ready",
    durationSeconds,
    ratio: ratioForDimensions(input.width, input.height),
  };
}

function ratioForDimensions(width: number, height: number): MediaRatio {
  const value = width / height;
  const ratios = [
    ["9:16", 9 / 16], ["1:1", 1], ["4:5", 4 / 5], ["16:9", 16 / 9],
  ] as const;
  return ratios.find(([, expected]) => Math.abs(value - expected) <= 0.03)?.[0] ?? "other";
}
