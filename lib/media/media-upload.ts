import type { MediaCollection } from "@/lib/media/types";
import { buildCloudFrontUrl } from "@/lib/storage/s3";

export const MEDIA_UPLOAD_EXPIRES_IN_SECONDS = 10 * 60;
export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024;

const imageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const videoTypes = new Map([
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
]);

export type MediaUploadTarget = {
  assetId: string;
  cloudFrontUrl: string;
  collection: MediaCollection;
  contentType: string;
  extension: string;
  fileName: string;
  fileSize: number;
  key: string;
  title: string;
};

export function createMediaUploadTarget(input: {
  collection: MediaCollection;
  contentType: string;
  fileName: string;
  fileSize: number;
  title?: string;
  userId: string;
}) {
  const contentType = input.contentType.trim().toLowerCase();
  const fileName = input.fileName.trim();
  const extension = getExpectedExtension(input.collection, contentType);
  const maxBytes = input.collection === "image" ? MAX_IMAGE_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES;

  if (!extension) {
    return {
      error:
        input.collection === "image"
          ? "Upload a JPG, PNG, or WebP image."
          : "Upload an MP4, MOV, or WebM video.",
      ok: false as const,
      status: 400,
    };
  }

  if (!fileName || fileName.length > 255 || /[/\\\0]/.test(fileName)) {
    return {
      error: "Choose a valid file name without folder paths.",
      ok: false as const,
      status: 400,
    };
  }

  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
    return {
      error: "The selected file is empty or invalid.",
      ok: false as const,
      status: 400,
    };
  }

  if (input.fileSize > maxBytes) {
    return {
      error: `The file is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      ok: false as const,
      status: 413,
    };
  }

  const assetId = crypto.randomUUID();
  const cleanUserId = cleanPathPart(input.userId);
  const key = `media/${cleanUserId}/${input.collection}/${assetId}${extension}`;
  const fallbackTitle = fileName.replace(/\.[^.]+$/, "").trim() || "Untitled media";

  return {
    ok: true as const,
    target: {
      assetId,
      cloudFrontUrl: buildCloudFrontUrl(key),
      collection: input.collection,
      contentType,
      extension,
      fileName,
      fileSize: input.fileSize,
      key,
      title: input.title?.trim().slice(0, 140) || fallbackTitle.slice(0, 140),
    } satisfies MediaUploadTarget,
  };
}

export function getAllowedContentTypes(collection: MediaCollection) {
  return collection === "image" ? Array.from(imageTypes.keys()) : Array.from(videoTypes.keys());
}

export function getMaxUploadBytes(collection: MediaCollection) {
  return collection === "image" ? MAX_IMAGE_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES;
}

function getExpectedExtension(collection: MediaCollection, contentType: string) {
  return collection === "image"
    ? imageTypes.get(contentType) ?? null
    : videoTypes.get(contentType) ?? null;
}

function cleanPathPart(value: string) {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || "user"
  );
}
