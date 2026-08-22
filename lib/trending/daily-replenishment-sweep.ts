import "server-only";

import { listBusinessProfilesForDailyReplenishment } from "@/lib/business-profiles/db";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";
import {
  advanceDailyCarouselReplenishmentCycle,
  claimDailyCarouselReplenishmentCycle,
} from "@/lib/trending/daily-replenishment-sweep-state";

export async function replenishTrendingCarouselFeedCyclePage(params: {
  limit: number;
  requestedCycleId: string;
}) {
  const checkpoint = await claimDailyCarouselReplenishmentCycle(
    params.requestedCycleId,
  );

  if (checkpoint.status === "completed") {
    return {
      cycleId: checkpoint.cycleId,
      cycleStatus: checkpoint.status,
      hasMore: false,
      nextCursor: null,
      pageCursor: checkpoint.cursor,
      processedCount: 0,
      results: [],
    };
  }

  const page = await replenishTrendingCarouselFeedPage({
    cursor: checkpoint.cursor,
    limit: params.limit,
  });
  const advancedCheckpoint = await advanceDailyCarouselReplenishmentCycle({
    completed: !page.hasMore,
    cycleId: checkpoint.cycleId,
    expectedCursor: checkpoint.cursor,
    nextCursor: page.nextCursor,
  });

  if (advancedCheckpoint.cycleId !== checkpoint.cycleId) {
    throw new Error("Daily Carousel replenishment cycle changed unexpectedly.");
  }

  return {
    cycleId: advancedCheckpoint.cycleId,
    cycleStatus: advancedCheckpoint.status,
    hasMore: advancedCheckpoint.status === "active",
    nextCursor:
      advancedCheckpoint.status === "active"
        ? advancedCheckpoint.cursor
        : null,
    pageCursor: checkpoint.cursor,
    processedCount: page.processedCount,
    results: page.results,
  };
}

export async function replenishTrendingCarouselFeedPage(params: {
  cursor?: string | null;
  limit: number;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit), 1), 10);
  const profiles = await listBusinessProfilesForDailyReplenishment({
    cursor: params.cursor,
    limit,
  });
  const results = await Promise.all(profiles.map(async (profile) => {
    try {
      if (!profile.trendingTimezone) {
        throw new Error("Trending timezone has not been initialized.");
      }

      const feed = await ensureUnifiedTrendingDailyFeed({
        includeHookVideos: areTrendingHookVideosEnabled(),
        includeWallText: isWallTextEnabled(),
        markItemsShown: false,
        profile,
        timezone: profile.trendingTimezone,
        userId: profile.userId,
      });

      return {
        assignedCount: feed.feed.assignedCount,
        localDate: feed.feed.localDate,
        ok: true as const,
        pendingSlotCount: feed.feed.pendingSlotCount,
        state: feed.feed.state,
        userId: profile.userId,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Daily Carousel replenishment failed.",
        ok: false as const,
        userId: profile.userId,
      };
    }
  }));

  return {
    hasMore: profiles.length === limit,
    nextCursor: profiles.at(-1)?.id ?? null,
    processedCount: profiles.length,
    results,
  };
}
