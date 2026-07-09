import { uploadBufferToS3 } from "@/lib/storage/s3";

const CATEGORY_LIBRARY_PREFIX = "category-library";
const IMAGE_WEBP_CONTENT_TYPE = "image/webp";

function cleanPathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function buildCategoryImageAssetKeys(params: {
  assetId: string;
  categorySlug: string;
  visualBucketId?: string | null;
}) {
  const categorySlug = cleanPathPart(params.categorySlug);
  const assetId = cleanPathPart(params.assetId);
  const visualBucketId = params.visualBucketId
    ? cleanPathPart(params.visualBucketId)
    : "";
  const basePrefix = visualBucketId
    ? `${CATEGORY_LIBRARY_PREFIX}/${categorySlug}/${visualBucketId}/${assetId}`
    : `${CATEGORY_LIBRARY_PREFIX}/${categorySlug}/${assetId}`;

  return {
    baseKey: `${basePrefix}/base-1080x1350.webp`,
    thumbKey: `${basePrefix}/thumb-320x400.webp`,
  };
}

export async function uploadCategoryImageAsset(params: {
  assetId: string;
  baseBuffer: Buffer;
  categorySlug: string;
  thumbBuffer: Buffer;
  visualBucketId?: string | null;
}) {
  const keys = buildCategoryImageAssetKeys({
    assetId: params.assetId,
    categorySlug: params.categorySlug,
    visualBucketId: params.visualBucketId,
  });

  const [base, thumb] = await Promise.all([
    uploadBufferToS3({
      key: keys.baseKey,
      buffer: params.baseBuffer,
      contentType: IMAGE_WEBP_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    }),
    uploadBufferToS3({
      key: keys.thumbKey,
      buffer: params.thumbBuffer,
      contentType: IMAGE_WEBP_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    }),
  ]);

  return {
    baseS3Key: base.key,
    baseUrl: base.url,
    thumbS3Key: thumb.key,
    thumbUrl: thumb.url,
  };
}

export async function uploadRenderedCarouselSlide(params: {
  buffer: Buffer;
  carouselId: string;
  format: string;
  projectId: string;
  slideNumber: number;
  userId: string;
}) {
  const formatSlug = cleanPathPart(params.format.replace(":", "x"));
  const slideSlug = params.slideNumber.toString().padStart(2, "0");
  const key = [
    "carousels",
    "rendered",
    cleanPathPart(params.userId),
    cleanPathPart(params.projectId),
    cleanPathPart(params.carouselId),
    `slide-${slideSlug}-${formatSlug}.webp`,
  ].join("/");

  return uploadBufferToS3({
    key,
    buffer: params.buffer,
    contentType: IMAGE_WEBP_CONTENT_TYPE,
    cacheControl: "public, max-age=31536000, immutable",
  });
}
