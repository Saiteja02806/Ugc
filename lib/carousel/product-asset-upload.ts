import { buildPublicStorageUrl } from "@/lib/storage/storage";

export const CAROUSEL_PRODUCT_ASSET_UPLOAD_EXPIRES_SECONDS = 10 * 60;
export const MAX_CAROUSEL_PRODUCT_ASSET_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const CAROUSEL_PRODUCT_ASSET_CONTENT_TYPES = Array.from(
  IMAGE_EXTENSIONS.keys(),
);

export type CarouselProductAssetUploadTarget = {
  assetId: string;
  contentType: string;
  fileName: string;
  fileSize: number;
  libraryAssetId: string;
  publicUrl: string;
  storageKey: string;
};

export function createCarouselProductAssetUploadTarget(input: {
  assetId: string;
  businessProfileId: string;
  contentType: string;
  fileName: string;
  fileSize: number;
  userId: string;
}) {
  const contentType = input.contentType.trim().toLowerCase();
  const extension = IMAGE_EXTENSIONS.get(contentType);
  const fileName = input.fileName.trim();

  if (!extension) {
    return {
      error: "Upload a JPG, PNG, or WebP app screenshot.",
      ok: false as const,
      status: 400,
    };
  }
  if (!fileName || fileName.length > 255 || /[/\\\0]/u.test(fileName)) {
    return {
      error: "Choose a valid screenshot file without folder paths.",
      ok: false as const,
      status: 400,
    };
  }
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
    return {
      error: "The selected screenshot is empty or invalid.",
      ok: false as const,
      status: 400,
    };
  }
  if (input.fileSize > MAX_CAROUSEL_PRODUCT_ASSET_BYTES) {
    return {
      error: "The screenshot is too large. Maximum size is 25 MB.",
      ok: false as const,
      status: 413,
    };
  }

  const cleanUserId = cleanPathPart(input.userId);
  const assetIdPart = input.assetId.replace(/-/gu, "").toLowerCase();
  const storageKey =
    `carousels/product-assets/${cleanUserId}/${input.businessProfileId}/` +
    `${input.assetId}${extension}`;

  return {
    ok: true as const,
    target: {
      assetId: input.assetId,
      contentType,
      fileName,
      fileSize: input.fileSize,
      libraryAssetId: `product_${assetIdPart}`,
      publicUrl: buildPublicStorageUrl(storageKey),
      storageKey,
    } satisfies CarouselProductAssetUploadTarget,
  };
}

export function getCarouselProductAssetOrientation(width: number, height: number) {
  if (width === height) return "square" as const;
  return width > height ? ("landscape" as const) : ("portrait" as const);
}

function cleanPathPart(value: string) {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]/gu, "-")
      .replace(/-+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 96) || "user"
  );
}
