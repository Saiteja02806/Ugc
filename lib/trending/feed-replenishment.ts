import "server-only";

import {
  getBusinessProfileForUser,
  isBusinessProfileOnboardingComplete,
} from "@/lib/business-profiles/db";
import { prepareTrendingHookIdeas } from "@/lib/trending/trending-hook-feed";
import { enqueueTrendingWallTextRefill } from "@/lib/trending/trending-wall-text-feed";

export const TRENDING_GENERATED_FORMAT_ACTIVE_TARGET = 6;

export async function replenishTrendingFormatAfterDecision(params: {
  format: "carousel" | "hook_video" | "wall_text";
  userId: string;
}) {
  if (params.format === "carousel") {
    return { status: "not_applicable" as const };
  }

  const profile = await getBusinessProfileForUser(params.userId);

  if (!profile || !isBusinessProfileOnboardingComplete(profile)) {
    return { status: "profile_unavailable" as const };
  }

  if (params.format === "hook_video") {
    const result = await prepareTrendingHookIdeas(profile, {
      mode: "refill",
      targetActive: TRENDING_GENERATED_FORMAT_ACTIVE_TARGET,
    });

    return {
      activeCount: result.ideaCount,
      exhausted: result.exhausted,
      jobId: result.jobId,
      status: result.status,
    };
  }

  return enqueueTrendingWallTextRefill(profile, {
    targetActive: TRENDING_GENERATED_FORMAT_ACTIVE_TARGET,
  });
}
