import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
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
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return hookVideoJson(
        {
          code: onboardingGate?.code ?? "onboarding_required",
          error:
            onboardingGate?.message ??
            "Complete the required business onboarding before using Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    const preparation = await prepareTrendingHookIdeas(profile);

    return hookVideoJson(
      {
        ...preparation,
        ok: true,
      },
      preparation.status === "ready" ? 200 : 202,
    );
  } catch (error) {
    if (error instanceof TrendingHookPreparationError) {
      return hookVideoJson({ error: error.message, ok: false }, error.status);
    }

    return hookVideoErrorResponse(error, "Could not prepare Trending Hook ideas.");
  }
}
