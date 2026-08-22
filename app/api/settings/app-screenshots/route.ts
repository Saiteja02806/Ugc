import { z } from "zod";

import { CarouselProductAssetConflictError } from "@/lib/carousel/db";
import {
  CarouselProductAssetServiceError,
  completeScopedCarouselProductAssetUpload,
  getCarouselProductAssetScopeForSettings,
  listScopedCarouselProductAssets,
  prepareCarouselProductAssetUpload,
  removeScopedCarouselProductAsset,
} from "@/lib/carousel/product-asset-service";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATE_SCHEMA = z
  .object({
    contentType: z.string().trim().min(1).max(120),
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive(),
  })
  .strict();
const COMPLETE_SCHEMA = z
  .object({
    assetId: z.string().uuid(),
    storageKey: z.string().trim().min(1).max(1_000),
  })
  .strict();
const DELETE_SCHEMA = z.object({ assetId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const scope = await getCarouselProductAssetScopeForSettings(user.uid);
    const assets = await listScopedCarouselProductAssets(scope);

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
      throw new CarouselProductAssetServiceError(
        "Send a valid screenshot name, type, and size.",
        400,
      );
    }

    const scope = await getCarouselProductAssetScopeForSettings(user.uid);
    const prepared = await prepareCarouselProductAssetUpload({
      contentType: parsed.data.contentType,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      scope,
      source: "settings_app_screenshots",
      userId: user.uid,
    });

    return json({ ...prepared, ok: true });
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
      throw new CarouselProductAssetServiceError(
        "The app screenshot upload record is invalid.",
        400,
      );
    }

    const scope = await getCarouselProductAssetScopeForSettings(user.uid);
    const completed = await completeScopedCarouselProductAssetUpload({
      assetId: parsed.data.assetId,
      scope,
      source: "settings_app_screenshots",
      storageKey: parsed.data.storageKey,
    });

    return json({ ...completed, ok: true });
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
      throw new CarouselProductAssetServiceError(
        "Choose a valid app screenshot to remove.",
        400,
      );
    }

    const scope = await getCarouselProductAssetScopeForSettings(user.uid);
    await removeScopedCarouselProductAsset({
      assetId: parsed.data.assetId,
      scope,
    });

    return json({ ok: true });
  } catch (error) {
    return requestError(error, "Could not remove this app screenshot.");
  }
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
    error instanceof CarouselProductAssetServiceError
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
        error instanceof CarouselProductAssetServiceError ||
        error instanceof CarouselProductAssetConflictError
          ? error.message
          : fallback,
      ok: false,
    },
    status,
  );
}
