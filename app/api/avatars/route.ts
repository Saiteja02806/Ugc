import {
  authenticateAvatarRequest,
  getMissingAvatarRuntimeEnvVars,
  jsonResponse,
  serializeAvatarWithPreference,
} from "@/lib/avatars/avatar-api";
import { listReadyAvatarAssetsWithPreferences } from "@/lib/avatars/avatar-storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateAvatarRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingEnv = getMissingAvatarRuntimeEnvVars();

  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Avatar list is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  try {
    const avatars = await listReadyAvatarAssetsWithPreferences({
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      avatars: avatars.map(serializeAvatarWithPreference),
    });
  } catch (error) {
    console.error("Failed to list avatar assets:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load avatars.",
      },
      500,
    );
  }
}
