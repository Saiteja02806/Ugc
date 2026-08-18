import { createHash, randomUUID } from "node:crypto";

import sharp from "sharp";
import { z } from "zod";

import {
  archiveCarouselProductAsset,
  CarouselProductAssetConflictError,
  completeCarouselProductAssetUpload,
  createCarouselProductAssetUpload,
  findCarouselProductAssetByHash,
  getCarouselGeneration,
  getCarouselProductAssetUpload,
  listCarouselProductAssets,
} from "@/lib/carousel/db";
import { resolveCarouselImageLibraryCategory } from "@/lib/carousel/image-library-category";
import {
  CAROUSEL_PRODUCT_ASSET_CONTENT_TYPES,
  CAROUSEL_PRODUCT_ASSET_UPLOAD_EXPIRES_SECONDS,
  createCarouselProductAssetUploadTarget,
  getCarouselProductAssetOrientation,
  MAX_CAROUSEL_PRODUCT_ASSET_BYTES,
} from "@/lib/carousel/product-asset-upload";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createSignedPutUrl,
  deleteStorageObject,
  getMissingStorageEnvVars,
  getStorageObject,
  headStorageObject,
} from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAROUSEL_ID_SCHEMA = z.string().uuid();
const CREATE_SCHEMA = z
  .object({
    carouselId: CAROUSEL_ID_SCHEMA,
    contentType: z.string().trim().min(1).max(120),
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive(),
  })
  .strict();
const COMPLETE_SCHEMA = z
  .object({
    assetId: z.string().uuid(),
    carouselId: CAROUSEL_ID_SCHEMA,
    storageKey: z.string().trim().min(1).max(1_000),
  })
  .strict();
const DELETE_SCHEMA = z
  .object({
    assetId: z.string().uuid(),
    carouselId: CAROUSEL_ID_SCHEMA,
  })
  .strict();

class CarouselProductAssetRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CarouselProductAssetRequestError";
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const url = new URL(request.url);
    const carouselId = CAROUSEL_ID_SCHEMA.safeParse(
      url.searchParams.get("carouselId"),
    );

    if (!carouselId.success) {
      throw new CarouselProductAssetRequestError(
        "Choose a valid Carousel before loading app screenshots.",
        400,
      );
    }

    const scope = await getOwnedCarouselScope(carouselId.data, user.uid);
    const assets = await listCarouselProductAssets(scope);

    return json({ assets, ok: true });
  } catch (error) {
    return requestError(error, "Could not load app screenshots.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const parsed = CREATE_SCHEMA.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new CarouselProductAssetRequestError(
        "Send a valid screenshot name, type, and size.",
        400,
      );
    }

    const missingStorage = getMissingStorageEnvVars();
    if (missingStorage.length > 0) {
      throw new Error(
        `Carousel app screenshot upload is not configured: ${missingStorage.join(", ")}`,
      );
    }

    const scope = await getOwnedCarouselScope(parsed.data.carouselId, user.uid);
    const targetResult = createCarouselProductAssetUploadTarget({
      assetId: randomUUID(),
      businessProfileId: scope.businessProfileId,
      contentType: parsed.data.contentType,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      userId: user.uid,
    });

    if (!targetResult.ok) {
      throw new CarouselProductAssetRequestError(
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
      businessProfileId: scope.businessProfileId,
      categorySlug: scope.categorySlug,
      fileName: target.fileName,
      libraryAssetId: target.libraryAssetId,
      mimeType: target.contentType,
      publicUrl: target.publicUrl,
      storageKey: target.storageKey,
    });

    return json({
      assetId: target.assetId,
      expiresInSeconds: CAROUSEL_PRODUCT_ASSET_UPLOAD_EXPIRES_SECONDS,
      ok: true,
      requiredHeaders: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": target.contentType,
      },
      storageKey: target.storageKey,
      uploadUrl,
    });
  } catch (error) {
    return requestError(error, "Could not prepare this app screenshot upload.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const parsed = COMPLETE_SCHEMA.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new CarouselProductAssetRequestError(
        "The app screenshot upload record is invalid.",
        400,
      );
    }

    const scope = await getOwnedCarouselScope(parsed.data.carouselId, user.uid);
    const upload = await getCarouselProductAssetUpload({
      assetId: parsed.data.assetId,
      ...scope,
    });

    if (!upload) {
      throw new CarouselProductAssetRequestError(
        "App screenshot upload was not found.",
        404,
      );
    }
    if (
      upload.status !== "processing" ||
      upload.storageKey !== normalizeStorageKey(parsed.data.storageKey)
    ) {
      throw new CarouselProductAssetRequestError(
        "This uploaded file does not belong to the pending app screenshot.",
        409,
      );
    }

    const inspected = await inspectUploadedScreenshot(upload.storageKey);
    const existing = await findCarouselProductAssetByHash({
      ...scope,
      sha256: inspected.sha256,
    });

    if (existing) {
      await discardPendingUpload({
        assetId: upload.id,
        storageKey: upload.storageKey,
        ...scope,
      });
      return json({ asset: existing, deduplicated: true, ok: true });
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
        width: inspected.width,
        ...scope,
      });

      return json({ asset, deduplicated: false, ok: true });
    } catch (error) {
      if (!(error instanceof CarouselProductAssetConflictError)) {
        throw error;
      }

      const racedAsset = await findCarouselProductAssetByHash({
        ...scope,
        sha256: inspected.sha256,
      });
      if (!racedAsset) throw error;

      await discardPendingUpload({
        assetId: upload.id,
        storageKey: upload.storageKey,
        ...scope,
      });
      return json({ asset: racedAsset, deduplicated: true, ok: true });
    }
  } catch (error) {
    return requestError(error, "Could not verify this app screenshot upload.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const parsed = DELETE_SCHEMA.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new CarouselProductAssetRequestError(
        "Choose a valid app screenshot to remove.",
        400,
      );
    }

    const scope = await getOwnedCarouselScope(parsed.data.carouselId, user.uid);
    const asset = await getCarouselProductAssetUpload({
      assetId: parsed.data.assetId,
      ...scope,
    });
    if (!asset) {
      throw new CarouselProductAssetRequestError(
        "App screenshot was not found.",
        404,
      );
    }
    const archived = await archiveCarouselProductAsset({
      assetId: parsed.data.assetId,
      ...scope,
    });

    if (!archived) {
      throw new CarouselProductAssetRequestError(
        "App screenshot was not found.",
        404,
      );
    }
    if (asset.status === "processing") {
      await deleteStorageObject({ key: asset.storageKey }).catch(
        () => undefined,
      );
    }

    return json({ ok: true });
  } catch (error) {
    return requestError(error, "Could not remove this app screenshot.");
  }
}

async function getOwnedCarouselScope(carouselId: string, userId: string) {
  const generation = await getCarouselGeneration(carouselId);

  if (
    !generation ||
    generation.userId !== userId ||
    generation.status !== "completed"
  ) {
    throw new CarouselProductAssetRequestError(
      "This Carousel is not available for app screenshot management.",
      404,
    );
  }
  if (!generation.businessProfileId) {
    throw new CarouselProductAssetRequestError(
      "This Carousel is not connected to a Business Profile.",
      409,
    );
  }

  let categorySlug: ReturnType<typeof resolveCarouselImageLibraryCategory>;
  try {
    categorySlug = resolveCarouselImageLibraryCategory({
      categorySlug: generation.categorySlug,
    });
  } catch {
    throw new CarouselProductAssetRequestError(
      "This Carousel does not use an active app screenshot category.",
      409,
    );
  }

  return {
    businessProfileId: generation.businessProfileId,
    categorySlug,
  };
}

async function inspectUploadedScreenshot(storageKey: string) {
  const head = await headStorageObject({ key: storageKey });
  const contentType =
    head.ContentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const fileSize = head.ContentLength ?? 0;

  if (!CAROUSEL_PRODUCT_ASSET_CONTENT_TYPES.includes(contentType)) {
    throw new CarouselProductAssetRequestError(
      "The uploaded file is not a JPG, PNG, or WebP image.",
      422,
    );
  }
  if (fileSize <= 0 || fileSize > MAX_CAROUSEL_PRODUCT_ASSET_BYTES) {
    throw new CarouselProductAssetRequestError(
      "The uploaded screenshot is empty or exceeds 25 MB.",
      fileSize > MAX_CAROUSEL_PRODUCT_ASSET_BYTES ? 413 : 422,
    );
  }

  const object = await getStorageObject({ key: storageKey });
  if (!object.Body) {
    throw new CarouselProductAssetRequestError(
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
    throw new CarouselProductAssetRequestError(
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

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

function requestError(error: unknown, fallback: string) {
  const status =
    error instanceof FirebaseAuthRequestError ||
    error instanceof CarouselProductAssetRequestError
      ? error.status
      : error instanceof CarouselProductAssetConflictError
        ? 409
        : 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return json(
    {
      error:
        error instanceof FirebaseAuthRequestError ||
        error instanceof CarouselProductAssetRequestError ||
        error instanceof CarouselProductAssetConflictError
          ? error.message
          : fallback,
      ok: false,
    },
    status,
  );
}
