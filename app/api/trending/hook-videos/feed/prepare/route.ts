import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import {
  prepareTrendingHookIdeas,
  TrendingHookPreparationError,
} from "@/lib/trending/trending-hook-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!areTrendingHookVideosEnabled(request)) {
    return hookVideoJson(
      {
        code: "feature_unavailable",
        error: "Hook ideas are not available.",
        ok: false,
      },
      404,
    );
  }

  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const profile = await getBusinessProfileForUser(auth.user.uid);

    if (!profile) {
      return hookVideoJson(
        {
          code: "business_profile_required",
          error: "Complete your business profile before preparing Hook ideas.",
          ok: false,
        },
        409,
      );
    }

    const ideas = await prepareTrendingHookIdeas(profile);

    return hookVideoJson({ ideaCount: ideas.length, ok: true });
  } catch (error) {
    if (error instanceof TrendingHookPreparationError) {
      return hookVideoJson({ error: error.message, ok: false }, error.status);
    }

    if (
      error instanceof Error &&
      error.message === "OpenAI is not configured."
    ) {
      return hookVideoJson(
        { error: "Hook idea generation is not configured.", ok: false },
        501,
      );
    }

    return hookVideoErrorResponse(error, "Could not prepare Trending Hook ideas.");
  }
}
