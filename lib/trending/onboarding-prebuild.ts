import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";

export async function prebuildTrendingAfterOnboarding(params: {
  includeHookVideos: boolean;
  profile: BusinessProfileRecord;
  timezone: string;
}) {
  try {
    const feed = await ensureUnifiedTrendingDailyFeed({
      includeHookVideos: params.includeHookVideos,
      includeWallText: isWallTextEnabled(),
      markItemsShown: false,
      profile: params.profile,
      timezone: params.timezone,
      userId: params.profile.userId,
    });

    return [
      {
        format: "daily_feed" as const,
        pendingSlotCount: feed.feed.pendingSlotCount,
        status: "scheduled" as const,
      },
    ];
  } catch (error) {
    console.error("Could not prebuild the combined Trending feed:", error);

    return [{ format: "daily_feed" as const, status: "failed" as const }];
  }
}
