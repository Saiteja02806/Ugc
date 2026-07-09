import {
  authenticateAvatarRequest,
  getAvatarStorageErrorResponse,
  getMissingAvatarRuntimeEnvVars,
  jsonResponse,
  serializeAvatarWithPreference,
} from "@/lib/avatars/avatar-api";
import { getAvatarAssetWithPreference } from "@/lib/avatars/avatar-storage";
import { getAvatarAssetId } from "@/lib/avatars/validation";

export const runtime = "nodejs";

type AvatarRouteContext = {
  params: Promise<{
    avatarId: string;
  }>;
};

export async function GET(request: Request, context: AvatarRouteContext) {
  const auth = await authenticateAvatarRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingEnv = getMissingAvatarRuntimeEnvVars();

  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Avatar lookup is missing required server environment variables.",
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
    const avatar = await getAvatarAssetWithPreference({
      avatarAssetId: avatarId,
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      avatar: serializeAvatarWithPreference(avatar),
    });
  } catch (error) {
    console.error("Failed to load avatar asset:", error);

    return getAvatarStorageErrorResponse({
      error,
      fallbackMessage: "Could not load avatar.",
      notFoundMessage: "Avatar was not found.",
    });
  }
}
