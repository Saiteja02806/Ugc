import {
  authenticateAvatarRequest,
  getAvatarStorageErrorResponse,
  getMissingAvatarRuntimeEnvVars,
  isAvatarReady,
  jsonResponse,
  serializeAvatarAsset,
  serializeAvatarPreference,
} from "@/lib/avatars/avatar-api";
import {
  getAvatarAsset,
  getAvatarSelection,
  markUserAvatarUsed,
} from "@/lib/avatars/avatar-storage";
import { getAvatarAssetId } from "@/lib/avatars/validation";

export const runtime = "nodejs";

type AvatarUseRouteContext = {
  params: Promise<{
    avatarId: string;
  }>;
};

export async function POST(request: Request, context: AvatarUseRouteContext) {
  const auth = await authenticateAvatarRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingEnv = getMissingAvatarRuntimeEnvVars();

  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Avatar use is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  const avatarId = getAvatarAssetId((await context.params).avatarId);

  if (!avatarId) {
    return jsonResponse(
      {
        ok: false,
        error: "Avatar ID is required.",
      },
      400,
    );
  }

  try {
    const asset = await getAvatarAsset(avatarId);

    if (!isAvatarReady(asset)) {
      return jsonResponse(
        {
          ok: false,
          error: "Avatar is not ready to use.",
        },
        409,
      );
    }

    const preference = await markUserAvatarUsed({
      avatarAssetId: avatarId,
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      avatar: serializeAvatarAsset(asset),
      avatarSelection: getAvatarSelection(asset, preference),
      preference: serializeAvatarPreference(preference),
    });
  } catch (error) {
    console.error("Failed to mark avatar as used:", error);

    return getAvatarStorageErrorResponse({
      error,
      fallbackMessage: "Could not use avatar.",
      notFoundMessage: "Avatar was not found.",
    });
  }
}
