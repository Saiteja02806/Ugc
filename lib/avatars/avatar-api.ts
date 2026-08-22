import "server-only";

import { NextResponse } from "next/server";

import type {
  AvatarAssetRow,
  AvatarAssetWithPreference,
  UserAvatarPreferenceRow,
} from "@/lib/avatars/types";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";

import {
  getAvatarSelection,
  getMissingAvatarStorageEnvVars,
} from "./avatar-storage";

export type AuthenticatedAvatarRequest =
  | {
      ok: true;
      user: VerifiedFirebaseUser;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function authenticateAvatarRequest(
  request: Request,
): Promise<AuthenticatedAvatarRequest> {
  try {
    return {
      ok: true,
      user: await requireFirebaseUser(request),
    };
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              error.status === 401
                ? "Sign in before managing avatars."
                : error.message,
          },
          error.status,
        ),
      };
    }

    console.error("Failed to verify avatar requester:", error);

    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error: "Could not verify your sign-in session.",
        },
        500,
      ),
    };
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function getMissingAvatarRuntimeEnvVars() {
  return getMissingAvatarStorageEnvVars();
}

export async function readJsonBody<TBody>(request: Request) {
  try {
    return (await request.json()) as TBody;
  } catch {
    return null;
  }
}

export function serializeAvatarWithPreference(
  avatar: AvatarAssetWithPreference,
) {
  return {
    asset: serializeAvatarAsset(avatar.asset),
    avatarSelection: getAvatarSelection(avatar.asset, avatar.preference),
    preference: serializeAvatarPreference(avatar.preference),
  };
}

export function serializeAvatarAsset(asset: AvatarAssetRow) {
  return {
    avatarType: asset.avatar_type,
    createdAt: asset.created_at,
    description: asset.description,
    durationSeconds: asset.duration_seconds,
    height: asset.height,
    id: asset.id,
    influencerKey: asset.influencer_key,
    metadata: asset.metadata,
    name: asset.name,
    ratio: asset.ratio,
    sourceVideoUrl: asset.source_video_url,
    status: asset.status,
    thumbnailUrl: asset.thumbnail_url,
    updatedAt: asset.updated_at,
    visualGroup: asset.visual_group,
    width: asset.width,
  };
}

export function serializeAvatarPreference(
  preference: UserAvatarPreferenceRow | null,
) {
  if (!preference) {
    return null;
  }

  return {
    avatarAssetId: preference.avatar_asset_id,
    id: preference.id,
    isTrimmed: preference.is_trimmed,
    lastUsedAt: preference.last_used_at,
    trimEnd: preference.trim_end,
    trimStart: preference.trim_start,
    updatedAt: preference.updated_at,
  };
}

export function getAvatarStorageErrorResponse(params: {
  error: unknown;
  fallbackMessage: string;
  notFoundMessage: string;
  notFoundStatus?: number;
}) {
  const isNotFound = isAvatarNotFoundError(params.error);

  return jsonResponse(
    {
      ok: false,
      error: isNotFound ? params.notFoundMessage : params.fallbackMessage,
    },
    isNotFound ? params.notFoundStatus ?? 404 : 500,
  );
}

export function isAvatarReady(asset: AvatarAssetRow) {
  return asset.status === "ready" && asset.deleted_at === null;
}

function isAvatarNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const storageError = error as {
    code?: string;
    message?: string;
  };

  return (
    storageError.code === "PGRST116" ||
    storageError.message?.includes("0 rows") === true ||
    storageError.message?.includes("JSON object requested") === true
  );
}
