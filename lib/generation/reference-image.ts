export const MAX_REFERENCE_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_REFERENCE_IMAGE_PIXELS = 64_000_000;
export const MAX_REFERENCE_IMAGE_SIDE = 16_384;

export const REFERENCE_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type ReferenceImageFileLike = {
  name: string;
  size: number;
  type: string;
};

export function getReferenceImageFileError(file: ReferenceImageFileLike) {
  const normalizedType = file.type.trim().toLowerCase();
  const extension = getFileExtension(file.name);

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "Choose a non-empty image file.";
  }

  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return "Choose an image smaller than 25 MB.";
  }

  if (!allowedExtensions.has(extension)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  if (normalizedType && !allowedMimeTypes.has(normalizedType)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  return null;
}

export function getReferenceImageDimensionsError(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "This image has invalid dimensions.";
  }

  if (
    width > MAX_REFERENCE_IMAGE_SIDE ||
    height > MAX_REFERENCE_IMAGE_SIDE ||
    width * height > MAX_REFERENCE_IMAGE_PIXELS
  ) {
    return "Choose an image no larger than 16,384 px per side or 64 megapixels.";
  }

  return null;
}

export function formatReferenceImageBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  const match = /\.[^.]+$/.exec(fileName.trim().toLowerCase());
  return match?.[0] ?? "";
}
