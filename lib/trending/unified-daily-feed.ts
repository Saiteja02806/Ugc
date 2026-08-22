import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { updateBusinessProfileTrendingTimezone } from "@/lib/business-profiles/db";
import { ensureTrendingDailyFeed } from "@/lib/trending/daily-feed";
import {
  buildTrendingDailyFormatPlan,
  type TrendingContentAllocation,
} from "@/lib/trending/content-mix";
import {
  createCarouselTrendingFeedProvider,
  createUnavailableTrendingFeedProvider,
  type TrendingCarouselFeedItem,
  type TrendingFeedItem,
  type TrendingFeedProviderAvailability,
  type TrendingFeedProviderResult,
  type TrendingHookVideoFeedItem,
  type TrendingWallTextFeedItem,
} from "@/lib/trending/feed-items";
import { getTrendingHookFeedProvider, prepareTrendingHookIdeas } from "@/lib/trending/trending-hook-feed";
import {
  enqueueTrendingWallTextRefill,
  getTrendingWallTextFeedProvider,
} from "@/lib/trending/trending-wall-text-feed";
import {
  attachDailyTrendingAssignments,
  ensureDailyTrendingFeedPlan,
  getDailyTrendingFeed,
  getTrendingContentMixPreference,
  getTrendingLocalDate,
  getTrendingPlanEntitlement,
  normalizeTrendingTimezone,
  type DailyTrendingFeedSlotRecord,
} from "@/lib/trending/unified-daily-feed-db";

export type UnifiedTrendingDailyFeedState =
  | "caught_up"
  | "preparing"
  | "ready";

export async function ensureUnifiedTrendingDailyFeed(params: {
  includeHookVideos: boolean;
  includeWallText: boolean;
  markItemsShown?: boolean;
  profile: BusinessProfileRecord;
  timezone?: string | null;
  userId: string;
}) {
  const timezone = normalizeTrendingTimezone(
    params.timezone ?? params.profile.trendingTimezone,
  );

  if (params.profile.trendingTimezone !== timezone) {
    await updateBusinessProfileTrendingTimezone({
      profileId: params.profile.id,
      timezone,
    });
  }

  const localDate = getTrendingLocalDate(timezone);
  const [entitlement, preference] = await Promise.all([
    getTrendingPlanEntitlement(params.userId),
    getTrendingContentMixPreference(params.userId),
  ]);
  const dailyPlan = buildTrendingDailyFormatPlan({
    dailyLimit: entitlement.dailyLimit,
    localDate,
    mix: preference.mix,
  });
  const initialPlan = await ensureDailyTrendingFeedPlan({
    businessProfileId: params.profile.id,
    businessProfileVersion: params.profile.profileVersion,
    entitlement,
    formats: dailyPlan.formats,
    localDate,
    preference,
    timezone,
    userId: params.userId,
  });
  const reservedAllocation = countReservedSlots(initialPlan.slots);
  const [carouselProvider, hookProvider, wallTextProvider] = await loadProviders({
    allocation: reservedAllocation,
    includeHookVideos: params.includeHookVideos,
    includeWallText: params.includeWallText,
    markItemsShown: params.markItemsShown,
    profile: params.profile,
    timezone,
    userId: params.userId,
  });

  await attachDailyTrendingAssignments({
    carouselAssignmentIds: carouselProvider.items.map((item) => item.assignmentId),
    feedId: initialPlan.feed.id,
    hookVideoAssignmentIds: hookProvider.items.map((item) => item.assignmentId),
    wallTextAssignmentIds: wallTextProvider.items.map((item) => item.assignmentId),
  });

  const attachedPlan = await getDailyTrendingFeed(
    initialPlan.feed.id,
    params.userId,
  );
  const missingByFormat = countMissingSlots(attachedPlan.slots);
  const preparationResults = await prepareMissingFormats({
    currentCounts: {
      carousel: carouselProvider.items.length,
      hook_video: hookProvider.items.length,
      wall_text: wallTextProvider.items.length,
    },
    includeHookVideos: params.includeHookVideos,
    includeWallText: params.includeWallText,
    missingByFormat,
    profile: params.profile,
  });
  const items = buildSlotOrderedItems({
    providers: [carouselProvider, hookProvider, wallTextProvider],
    slots: attachedPlan.slots,
  });
  const decidedCount = attachedPlan.slots.filter(
    (slot) => slot.state === "decided",
  ).length;
  const pendingSlotCount = attachedPlan.slots.filter(
    (slot) => slot.state === "planned" || slot.state === "preparing" || slot.state === "failed",
  ).length;
  const state: UnifiedTrendingDailyFeedState =
    decidedCount >= attachedPlan.feed.dailyLimit
      ? "caught_up"
      : pendingSlotCount > 0
        ? "preparing"
        : "ready";

  return {
    carousels: items
      .filter((item): item is TrendingCarouselFeedItem => item.format === "carousel")
      .map((item) => ({
        ...item.creative,
        assignmentId: item.assignmentId,
        feedItemId: item.feedItemId,
        feedPosition: item.position,
        feedSource: item.source,
      })),
    contentMix: {
      allocation: reservedAllocation,
      limits: { carousel: 100, hook_video: 50, wall_text: 50 },
      preferenceVersion: preference.preferenceVersion,
      percentages: attachedPlan.feed.mix,
    },
    entitlement: {
      dailyCarouselLimit: reservedAllocation.carousel,
      dailyTrendingLimit: entitlement.dailyLimit,
      displayName: entitlement.displayName,
      planKey: entitlement.planKey,
    },
    feed: {
      assignedCount: attachedPlan.slots.filter(
        (slot) => slot.state === "ready" || slot.state === "decided",
      ).length,
      completedCount: decidedCount,
      id: attachedPlan.feed.id,
      localDate,
      pendingSlotCount,
      remainingCount: Math.max(entitlement.dailyLimit - decidedCount, 0),
      state,
      timezone,
    },
    formatAvailability: buildFormatAvailability({
      allocation: reservedAllocation,
      missingByFormat,
      preparationResults,
    }),
    items,
  };
}

function countReservedSlots(slots: DailyTrendingFeedSlotRecord[]) {
  const counts: TrendingContentAllocation = {
    carousel: 0,
    hook_video: 0,
    wall_text: 0,
  };

  for (const slot of slots) {
    counts[slot.format] += 1;
  }

  return counts;
}

async function loadProviders(params: {
  allocation: TrendingContentAllocation;
  includeHookVideos: boolean;
  includeWallText: boolean;
  markItemsShown?: boolean;
  profile: BusinessProfileRecord;
  timezone: string;
  userId: string;
}) {
  const [carouselDailyFeed, hookProvider, wallTextProvider] = await Promise.all([
    params.allocation.carousel > 0
      ? ensureTrendingDailyFeed({
          dailyLimitOverride: params.allocation.carousel,
          markItemsShown: params.markItemsShown,
          profile: params.profile,
          timezone: params.timezone,
          userId: params.userId,
        })
      : Promise.resolve(null),
    params.includeHookVideos && params.allocation.hook_video > 0
      ? getTrendingHookFeedProvider(params.profile)
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
            "hook_video",
            params.allocation.hook_video === 0
              ? "Hook Videos are disabled in this content mix."
              : "Hook Videos are not enabled for this environment.",
          ),
        ),
    params.includeWallText && params.allocation.wall_text > 0
      ? getTrendingWallTextFeedProvider(params.profile)
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
            "wall_text",
            params.allocation.wall_text === 0
              ? "Wall-of-text is disabled in this content mix."
              : "Wall-of-text is not enabled for this environment.",
          ),
        ),
  ]);

  return [
    carouselDailyFeed
      ? createCarouselTrendingFeedProvider(carouselDailyFeed.carousels)
      : ({ format: "carousel", items: [], state: "ready" } satisfies TrendingFeedProviderResult<TrendingCarouselFeedItem>),
    hookProvider,
    wallTextProvider,
  ] as const;
}

async function prepareMissingFormats(params: {
  currentCounts: TrendingContentAllocation;
  includeHookVideos: boolean;
  includeWallText: boolean;
  missingByFormat: TrendingContentAllocation;
  profile: BusinessProfileRecord;
}) {
  const results = new Map<"hook_video" | "wall_text", "failed" | "scheduled">();
  const tasks: Promise<void>[] = [];

  if (params.includeHookVideos && params.missingByFormat.hook_video > 0) {
    tasks.push(
      prepareTrendingHookIdeas(params.profile, {
        mode: "refill",
        targetActive:
          params.currentCounts.hook_video + params.missingByFormat.hook_video,
      })
        .then(() => {
          results.set("hook_video", "scheduled");
        })
        .catch((error) => {
          console.error("Could not prepare reserved Hook Video positions:", error);
          results.set("hook_video", "failed");
        }),
    );
  }

  if (params.includeWallText && params.missingByFormat.wall_text > 0) {
    tasks.push(
      enqueueTrendingWallTextRefill(params.profile, {
        targetActive:
          params.currentCounts.wall_text + params.missingByFormat.wall_text,
      })
        .then(() => {
          results.set("wall_text", "scheduled");
        })
        .catch((error) => {
          console.error("Could not prepare reserved Wall-of-text positions:", error);
          results.set("wall_text", "failed");
        }),
    );
  }

  await Promise.all(tasks);
  return results;
}

function countMissingSlots(slots: DailyTrendingFeedSlotRecord[]) {
  const counts: TrendingContentAllocation = {
    carousel: 0,
    hook_video: 0,
    wall_text: 0,
  };

  for (const slot of slots) {
    if (
      !slot.assignmentId &&
      (slot.state === "planned" || slot.state === "preparing" || slot.state === "failed")
    ) {
      counts[slot.format] += 1;
    }
  }

  return counts;
}

function buildSlotOrderedItems(params: {
  providers: readonly TrendingFeedProviderResult[];
  slots: DailyTrendingFeedSlotRecord[];
}) {
  const itemByAssignmentId = new Map<string, TrendingFeedItem>();

  for (const provider of params.providers) {
    for (const item of provider.items) {
      itemByAssignmentId.set(item.assignmentId, item);
    }
  }

  return params.slots.flatMap((slot) => {
    if (slot.state !== "ready" || !slot.assignmentId) {
      return [];
    }

    const item = itemByAssignmentId.get(slot.assignmentId);

    if (!item || item.format !== slot.format) {
      return [];
    }

    return [
      {
        ...item,
        feedItemId: slot.id,
        id: `${item.format}:${slot.id}`,
        position: slot.position,
        source: slot.source,
      } satisfies TrendingFeedItem,
    ];
  });
}

function buildFormatAvailability(params: {
  allocation: TrendingContentAllocation;
  missingByFormat: TrendingContentAllocation;
  preparationResults: Map<"hook_video" | "wall_text", "failed" | "scheduled">;
}): TrendingFeedProviderAvailability[] {
  return (["carousel", "wall_text", "hook_video"] as const).map((format) => {
    if (params.allocation[format] === 0) {
      return { format, reason: "Disabled in the saved content mix.", state: "ready" as const };
    }

    if (params.missingByFormat[format] === 0) {
      return { format, state: "ready" as const };
    }

    const failed = format !== "carousel" && params.preparationResults.get(format) === "failed";
    return {
      format,
      reason: failed
        ? "Reserved content could not be prepared. Try again shortly."
        : "Reserved content is being prepared in the background.",
      state: "unavailable" as const,
    };
  });
}
