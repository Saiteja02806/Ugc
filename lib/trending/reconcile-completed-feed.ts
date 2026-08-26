import "server-only";

import {
  getBusinessProfileForUser,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";

export type CompletedTrendingFeedReconciliation = {
  feedId: string | null;
  skipped: boolean;
};

/**
 * Continue the daily feed after a durable source job completes. A missing
 * profile/timezone is intentionally skipped: the first signed-in Trending
 * request establishes the user's local day and will prepare that feed.
 */
export async function reconcileCompletedTrendingFeedForUser(
  userId: string,
): Promise<CompletedTrendingFeedReconciliation> {
  const profile = await getBusinessProfileForUser(userId);

  if (!profile || !profile.trendingTimezone) {
    return { feedId: null, skipped: true };
  }

  const dailyFeed = await ensureUnifiedTrendingDailyFeed({
    includeHookVideos: areTrendingHookVideosEnabled(),
    includeWallText: isWallTextEnabled(),
    profile: profile as BusinessProfileRecord,
    timezone: profile.trendingTimezone,
    userId,
  });

  return {
    feedId: dailyFeed.feed.id,
    skipped: false,
  };
}
