import "server-only";

import { createHash, randomUUID } from "node:crypto";

import sharp from "sharp";

import {
  archiveCarouselProductAsset,
  CarouselProductAssetConflictError,
  completeCarouselProductAssetUpload,
  createCarouselProductAssetUpload,
  findCarouselProductAssetByHash,
  getCarouselGeneration,
  getCarouselProductAssetUpload,
  listCarouselProductAssets,
  type CarouselProductAsset,
} from "@/lib/carousel/db";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import {
  resolveCarouselImageLibraryCategory,
  type CarouselImageLibraryCategory,
} from "@/lib/carousel/image-library-category";
import {
  CAROUSEL_PRODUCT_ASSET_CONTENT_TYPES,
  CAROUSEL_PRODUCT_ASSET_UPLOAD_EXPIRES_SECONDS,
  createCarouselProductAssetUploadTarget,
  getCarouselProductAssetOrientation,
  MAX_CAROUSEL_PRODUCT_ASSET_BYTES,
} from "@/lib/carousel/product-asset-upload";
import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { isBusinessProfileOnboardingComplete } from "@/lib/business-profiles/onboarding-access";
import {
  createSignedPutUrl,
  deleteStorageObject,
  getMissingStorageEnvVars,
  getStorageObject,
  headStorageObject,
} from "@/lib/storage/storage";

export type CarouselProductAssetScope = {
  businessProfileId: string;
  categorySlug: CarouselImageLibraryCategory;
};

export type CarouselProductAssetUploadSource =
  | "settings_app_screenshots"
  | "trending_carousel_editor";

export class CarouselProductAssetServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CarouselProductAssetServiceError";
  }
}

export async function getCarouselProductAssetScopeForCarousel(input: {
  carouselId: string;
  userId: string;
}): Promise<CarouselProductAssetScope> {
  const generation = await getCarouselGeneration(input.carouselId);

  if (
    !generation ||
    generation.userId !== input.userId ||
    generation.status !== "completed"
  ) {
    throw new CarouselProductAssetServiceError(
      "This Carousel is not available for app screenshot management.",
      404,
    );
  }
  if (!generation.businessProfileId) {
    throw new CarouselProductAssetServiceError(
      "This Carousel is not connected to an active workspace.",
      409,
    );
  }

  let categorySlug: CarouselImageLibraryCategory;
  try {
    categorySlug = resolveCarouselImageLibraryCategory({
      categorySlug: generation.categorySlug,
    });
  } catch {
    throw new CarouselProductAssetServiceError(
      "This Carousel does not use an active app screenshot category.",
      409,
    );
  }

  return {
    businessProfileId: generation.businessProfileId,
    categorySlug,
  };
}

export async function getCarouselProductAssetScopeForSettings(
  userId: string,
): Promise<CarouselProductAssetScope> {
  const profile = await getBusinessProfileForUser(userId);

  if (!profile || !isBusinessProfileOnboardingComplete(profile)) {
    throw new CarouselProductAssetServiceError(
      "Finish workspace setup before adding app screenshots.",
      409,
    );
  }

  try {
    const category = resolveCarouselCategoryProfile({
      category: profile.context.category,
      pexelsImageQueries: profile.context.pexelsImageQueries,
      productSummary: profile.context.productSummary,
      valueProps: profile.context.valueProps,
      visualKeywords: profile.context.visualKeywords,
    });

    return {
      businessProfileId: profile.id,
      categorySlug: resolveCarouselImageLibraryCategory({
        category: profile.context.category,
        categorySlug: category.categorySlug,
        productSummary: profile.context.productSummary,
        valueProps: profile.context.valueProps,
        visualKeywords: profile.context.visualKeywords,
      }),
    };
  } catch {
    throw new CarouselProductAssetServiceError(
      "App screenshots are not available for this workspace category yet.",
      409,
    );
  }
}

export async function listScopedCarouselProductAssets(
  scope: CarouselProductAssetScope,
) {
  return listCarouselProductAssets(scope);
}

export async function prepareCarouselProductAssetUpload(input: {
  contentType: string;
  fileName: string;
  fileSize: number;
  scope: CarouselProductAssetScope;
  source: CarouselProductAssetUploadSource;
  userId: string;
}) {
  const missingStorage = getMissingStorageEnvVars();
  if (missingStorage.length > 0) {
    throw new Error(
      `Carousel app screenshot upload is not configured: ${missingStorage.join(", ")}`,
    );
  }

  const targetResult = createCarouselProductAssetUploadTarget({
    assetId: randomUUID(),
    businessProfileId: input.scope.businessProfileId,
    contentType: input.contentType,
    fileName: input.fileName,
    fileSize: input.fileSize,
    userId: input.userId,
  });

  if (!targetResult.ok) {
    throw new CarouselProductAssetServiceError(
      targetResult.error,
      targetResult.status,
    );
  }

  const target = targetResult.target;
  const uploadUrl = await createSignedPutUrl({
    cacheControl: "public, max-age=31536000, immutable",
    contentType: target.contentType,
    expiresInSeconds: CAROUSEL_PRODUCT_ASSET_UPLOAD_EXPIRES_SECONDS,
    key: target.storageKey,
  });

  await createCarouselProductAssetUpload({
    assetId: target.assetId,
    businessProfileId: input.scope.businessProfileId,
    categorySlug: input.scope.categorySlug,
    fileName: target.fileName,
    libraryAssetId: target.libraryAssetId,
    mimeType: target.contentType,
    publicUrl: target.publicUrl,
    source: input.source,
    storageKey: target.storageKey,
  });

  return {
    assetId: target.assetId,
    expiresInSeconds: CAROUSEL_PRODUCT_ASSET_UPLOAD_EXPIRES_SECONDS,
    requiredHeaders: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": target.contentType,
    },
    storageKey: target.storageKey,
    uploadUrl,
  };
}

export async function completeScopedCarouselProductAssetUpload(input: {
  assetId: string;
  scope: CarouselProductAssetScope;
  source: CarouselProductAssetUploadSource;
  storageKey: string;
}): Promise<{ asset: CarouselProductAsset; deduplicated: boolean }> {
  const upload = await getCarouselProductAssetUpload({
    assetId: input.assetId,
    ...input.scope,
  });

  if (!upload) {
    throw new CarouselProductAssetServiceError(
      "App screenshot upload was not found.",
      404,
    );
  }
  if (
    upload.status !== "processing" ||
    upload.storageKey !== normalizeStorageKey(input.storageKey)
  ) {
    throw new CarouselProductAssetServiceError(
      "This uploaded file does not belong to the pending app screenshot.",
      409,
    );
  }

  const inspected = await inspectUploadedScreenshot(upload.storageKey);
  const existing = await findCarouselProductAssetByHash({
    ...input.scope,
    sha256: inspected.sha256,
  });

  if (existing) {
    await discardPendingUpload({
      assetId: upload.id,
      storageKey: upload.storageKey,
      ...input.scope,
    });
    return { asset: existing, deduplicated: true };
  }

  try {
    const asset = await completeCarouselProductAssetUpload({
      assetId: upload.id,
      fileSize: inspected.fileSize,
      height: inspected.height,
      mimeType: inspected.contentType,
      orientation: getCarouselProductAssetOrientation(
        inspected.width,
        inspected.height,
      ),
      sha256: inspected.sha256,
      source: input.source,
      width: inspected.width,
      ...input.scope,
    });

    return { asset, deduplicated: false };
  } catch (error) {
    if (!(error instanceof CarouselProductAssetConflictError)) {
      throw error;
    }

    const racedAsset = await findCarouselProductAssetByHash({
      ...input.scope,
      sha256: inspected.sha256,
    });
    if (!racedAsset) throw error;

    await discardPendingUpload({
      assetId: upload.id,
      storageKey: upload.storageKey,
      ...input.scope,
    });
    return { asset: racedAsset, deduplicated: true };
  }
}

export async function removeScopedCarouselProductAsset(input: {
  assetId: string;
  scope: CarouselProductAssetScope;
}) {
  const asset = await getCarouselProductAssetUpload({
    assetId: input.assetId,
    ...input.scope,
  });

  if (!asset) {
    throw new CarouselProductAssetServiceError(
      "App screenshot was not found.",
      404,
    );
  }

  const archived = await archiveCarouselProductAsset({
    assetId: input.assetId,
    ...input.scope,
  });

  if (!archived) {
    throw new CarouselProductAssetServiceError(
      "App screenshot was not found.",
      404,
    );
  }
  if (asset.status === "processing") {
    await deleteStorageObject({ key: asset.storageKey }).catch(
      () => undefined,
    );
  }
}

async function inspectUploadedScreenshot(storageKey: string) {
  const head = await headStorageObject({ key: storageKey });
  const contentType =
    head.ContentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const fileSize = head.ContentLength ?? 0;

  if (!CAROUSEL_PRODUCT_ASSET_CONTENT_TYPES.includes(contentType)) {
    throw new CarouselProductAssetServiceError(
      "The uploaded file is not a JPG, PNG, or WebP image.",
      422,
    );
  }
  if (fileSize <= 0 || fileSize > MAX_CAROUSEL_PRODUCT_ASSET_BYTES) {
    throw new CarouselProductAssetServiceError(
      "The uploaded screenshot is empty or exceeds 25 MB.",
      fileSize > MAX_CAROUSEL_PRODUCT_ASSET_BYTES ? 413 : 422,
    );
  }

  const object = await getStorageObject({ key: storageKey });
  if (!object.Body) {
    throw new CarouselProductAssetServiceError(
      "The uploaded screenshot could not be read.",
      422,
    );
  }

  const buffer = Buffer.from(
    await new Response(object.Body.transformToWebStream()).arrayBuffer(),
  );
  const metadata = await sharp(buffer, {
    limitInputPixels: 80_000_000,
  }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new CarouselProductAssetServiceError(
      "The uploaded screenshot has no readable image dimensions.",
      422,
    );
  }

  return {
    contentType,
    fileSize,
    height,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    width,
  };
}

async function discardPendingUpload(input: {
  assetId: string;
  businessProfileId: string;
  categorySlug: string;
  storageKey: string;
}) {
  await archiveCarouselProductAsset(input);
  await deleteStorageObject({ key: input.storageKey }).catch(() => undefined);
}

function normalizeStorageKey(value: string) {
  return value.trim().replace(/^\/+/, "");
}
