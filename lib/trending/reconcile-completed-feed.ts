import "server-only";
import { FreeTrialAccessError } from "@/lib/billing/free-trial";

import {
  getBusinessProfileForUser,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";

export type CompletedTrendingFeedReconciliation = {
  feedState: "caught_up" | "failed" | "preparing" | "ready" | null;
  feedId: string | null;
  pendingSlotCount: number;
  skipped: boolean;
};

/**
 * Continue the daily feed after a durable source job completes. A missing
 * profile/timezone is intentionally skipped: the first signed-in Trending
 * request establishes the user's local day and will prepare that feed.
 */
export async function reconcileCompletedTrendingFeedForUser(
  userId: string,
  dependencies = {
    getProfile: getBusinessProfileForUser,
    ensureFeed: ensureUnifiedTrendingDailyFeed,
  },
): Promise<CompletedTrendingFeedReconciliation> {
  const profile = await dependencies.getProfile(userId);

  if (!profile || !profile.trendingTimezone) {
    return { feedId: null, feedState: null, pendingSlotCount: 0, skipped: true };
  }

  let dailyFeed: Awaited<ReturnType<typeof ensureUnifiedTrendingDailyFeed>>;
  try {
    dailyFeed = await dependencies.ensureFeed({
    includeHookVideos: areTrendingHookVideosEnabled(),
    includeWallText: isWallTextEnabled(),
    profile: profile as BusinessProfileRecord,
    timezone: profile.trendingTimezone,
    userId,
    });
  } catch (error) {
    // Expired/exhausted access is a settled callback, not a provider outage.
    // Completing the outbox item prevents endless five-minute retries.
    // A later paid activation schedules its own prebuild.
    if (error instanceof FreeTrialAccessError) {
      return { feedId: null, feedState: null, pendingSlotCount: 0, skipped: true };
    }
    throw error;
  }

  return {
    feedState: dailyFeed.feed.state,
    feedId: dailyFeed.feed.id,
    pendingSlotCount: dailyFeed.feed.pendingSlotCount,
    skipped: false,
  };
}
