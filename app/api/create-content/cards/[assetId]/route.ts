import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CreateContentCardStorageError,
  getMissingCreateContentCardEnvVars,
  saveCreateContentCard,
} from "@/lib/create-content/card-storage";
import { isCreateContentVideo } from "@/lib/create-content/video-assets";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMediaAssetForOwner,
  serializeMediaAsset,
} from "@/lib/media/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_SCHEMA = z
  .object({
    expectedRevision: z.number().int().min(0),
    format: z.enum(["wall_text", "hook_text"]),
    position: z
      .object({
        x: z.number().finite().min(0.04).max(0.96),
        y: z.number().finite().min(0.04).max(0.96),
      })
      .strip(),
    text: z.string().trim().min(1).max(600),
  })
  .strip();

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireFirebaseUser(request);
    if (getMissingCreateContentCardEnvVars().length > 0) {
      return json(
        { error: "Create Content is temporarily unavailable.", ok: false },
        501,
      );
    }

    const assetId = z.string().uuid().safeParse((await context.params).assetId);
    const body = REQUEST_SCHEMA.safeParse(
      await request.json().catch(() => null),
    );

    if (!assetId.success || !body.success) {
      return json(
        { error: "Review the text and position before saving.", ok: false },
        400,
      );
    }

    const asset = await getMediaAssetForOwner({
      assetId: assetId.data,
      userId: user.uid,
    });
    if (!asset || !isCreateContentVideo(serializeMediaAsset(asset))) {
      return json(
        { error: "This Creative Assets video is no longer available.", ok: false },
        404,
      );
    }

    const card = await saveCreateContentCard({
      ...body.data,
      sourceMediaAssetId: assetId.data,
      userId: user.uid,
    });

    return json({ card, ok: true });
  } catch (error) {
    return errorResponse(error, "Could not save this Create Content card.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (
    error instanceof FirebaseAuthRequestError ||
    error instanceof CreateContentCardStorageError
  ) {
    return json({ error: error.message, ok: false }, error.status);
  }

  console.error(fallback, error);
  return json({ error: fallback, ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
