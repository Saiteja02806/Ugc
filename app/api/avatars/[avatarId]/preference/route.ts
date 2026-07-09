import {
  authenticateAvatarRequest,
  getAvatarStorageErrorResponse,
  getMissingAvatarRuntimeEnvVars,
  isAvatarReady,
  jsonResponse,
  readJsonBody,
  serializeAvatarAsset,
  serializeAvatarPreference,
} from "@/lib/avatars/avatar-api";
import {
  getAvatarAsset,
  getAvatarSelection,
  saveUserAvatarPreference,
} from "@/lib/avatars/avatar-storage";
import {
  getAvatarAssetId,
  validateAvatarTrimInput,
} from "@/lib/avatars/validation";

export const runtime = "nodejs";

type AvatarPreferenceRouteContext = {
  params: Promise<{
    avatarId: string;
  }>;
};

type PatchAvatarPreferenceBody = {
  isTrimmed?: unknown;
  trimEnd?: unknown;
  trimStart?: unknown;
};

export async function PATCH(
  request: Request,
  context: AvatarPreferenceRouteContext,
) {
  const auth = await authenticateAvatarRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingEnv = getMissingAvatarRuntimeEnvVars();

  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Avatar preference update is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  const body = await readJsonBody<PatchAvatarPreferenceBody>(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Send avatar preference details as JSON.",
      },
      400,
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

    const trim = validateAvatarTrimInput({
      durationSeconds: asset.duration_seconds,
      isTrimmed: body.isTrimmed,
      trimEnd: body.trimEnd,
      trimStart: body.trimStart,
    });

    if (!trim.ok) {
      return jsonResponse(
        {
          ok: false,
          error: trim.error,
        },
        400,
      );
    }

    const preference = await saveUserAvatarPreference({
      avatarAssetId: avatarId,
      trim: trim.value,
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      avatar: serializeAvatarAsset(asset),
      avatarSelection: getAvatarSelection(asset, preference),
      preference: serializeAvatarPreference(preference),
    });
  } catch (error) {
    console.error("Failed to save avatar preference:", error);

    return getAvatarStorageErrorResponse({
      error,
      fallbackMessage: "Could not save avatar preference.",
      notFoundMessage: "Avatar was not found.",
    });
  }
}
