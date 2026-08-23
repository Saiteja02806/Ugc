import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import {
  createHookVideoPreviewSession,
  getHookVideoPreviewCookieName,
  hasHookVideoPreviewSecret,
  HOOK_VIDEO_PREVIEW_TTL_SECONDS,
} from "@/lib/trending/hook-video-preview-session";
import { getLockedHookAudioForVideo } from "@/lib/trending/hook-audio-db";
import { resolveHookVideoSource } from "@/lib/trending/hook-video-sources";
import { isHookVideoSourceKind } from "@/lib/trending/hook-video-types";
import { isTrustedStorageUrl } from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreviewSessionBody = {
  influencerId?: unknown;
  sourceKind?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  if (!hasHookVideoPreviewSecret()) {
    return hookVideoJson(
      { error: "Protected previews are not configured.", ok: false },
      501,
    );
  }

  const body = (await request.json().catch(() => null)) as PreviewSessionBody | null;
  const influencerId =
    typeof body?.influencerId === "string" ? body.influencerId.trim() : "";

  if (!influencerId || !isHookVideoSourceKind(body?.sourceKind)) {
    return hookVideoJson(
      { error: "Choose an influencer video first.", ok: false },
      400,
    );
  }

  const { videoId } = await params;

  try {
    await resolveHookVideoSource({
      influencerId,
      sourceKind: body.sourceKind,
      userId: auth.user.uid,
      videoId,
    });
    const hookAudio =
      body.sourceKind === "catalog"
        ? await getLockedHookAudioForVideo({ hookVideoId: videoId })
        : null;

    if (hookAudio && !isTrustedStorageUrl(hookAudio.audioUrl)) {
      return hookVideoJson(
        {
          error: "The approved Hook sound is not available for preview.",
          ok: false,
        },
        409,
      );
    }

    const session = createHookVideoPreviewSession({
      influencerId,
      sourceKind: body.sourceKind,
      userId: auth.user.uid,
      videoId,
    });
    const response = hookVideoJson({
      expiresAt: session.expiresAt,
      hookAudio,
      ok: true,
      previewUrl: `/api/trending/hook-videos/preview/${encodeURIComponent(videoId)}`,
    });

    response.cookies.set(getHookVideoPreviewCookieName(videoId), session.token, {
      httpOnly: true,
      maxAge: HOOK_VIDEO_PREVIEW_TTL_SECONDS,
      path: `/api/trending/hook-videos/preview/${encodeURIComponent(videoId)}`,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    return hookVideoErrorResponse(error, "Could not create protected preview.");
  }
}
