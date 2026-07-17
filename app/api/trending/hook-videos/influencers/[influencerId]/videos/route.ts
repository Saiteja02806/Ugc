import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { listHookInfluencerVideos } from "@/lib/trending/hook-video-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ influencerId: string }> },
) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { influencerId } = await params;

  try {
    return hookVideoJson({
      ok: true,
      videos: await listHookInfluencerVideos({
        influencerId,
        userId: auth.user.uid,
      }),
    });
  } catch (error) {
    return hookVideoErrorResponse(error, "Could not load influencer videos.");
  }
}
