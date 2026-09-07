import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { updateBusinessProfileTrendingTimezone } from "@/lib/business-profiles/db";
import { FreeTrialAccessError } from "@/lib/billing/free-trial";
import { getPublicDailyFeedState } from "@/lib/trending/daily-feed-status";
import { loadTrendingFormat } from "@/lib/trending/format-isolation";
import {
  ensureTrendingDailyFeed,
  readTrendingDailyFeed,
} from "@/lib/trending/daily-feed";
import {
  buildTrendingDailyFormatPlan,
  resolveTrendingContentMixPreference,
  TRENDING_CONTENT_MIX_LIMITS,
  type TrendingContentAllocation,
} from "@/lib/trending/content-mix";
import {
  exposeTrendingDailyPackItems,
  getTrendingDailyPackReadiness,
  type TrendingDailyPackReadiness,
} from "@/lib/trending/daily-pack-readiness";
import {
  getAdditionalTrendingSlotsForUpgrade,
  getReservedTrendingDailyLimit,
} from "@/lib/trending/plan-upgrade-grant";
import {
  createCarouselTrendingFeedProvider,
  createUnavailableTrendingFeedProvider,
  type TrendingCarouselFeedItem,
  type TrendingFeedFormat,
  type TrendingFeedItem,
  type TrendingFeedProviderAvailability,
  type TrendingFeedProviderResult,
  type TrendingHookVideoFeedItem,
  type TrendingReactionFeedItem,
  type TrendingWallTextFeedItem,
} from "@/lib/trending/feed-items";
import { getTrendingReactionFeedProvider } from "@/lib/trending/reaction-feed";
import { enqueueTrendingReactionRefill } from "@/lib/reaction-format/generation-jobs";
import {
  getTrendingHookFeedProvider,
  prepareTrendingHookIdeas,
  TrendingHookPreparationError,
} from "@/lib/trending/trending-hook-feed";
import {
  enqueueTrendingWallTextRefill,
  getTrendingWallTextFeedProvider,
} from "@/lib/trending/trending-wall-text-feed";
import {
  attachDailyTrendingAssignments,
  ensureDailyTrendingFeedPlan,
  getDailyTrendingFeed,
  getDailyTrendingFeedForDate,
  getTrendingContentMixPreference,
  getTrendingLocalDate,
  getTrendingPlanEntitlement,
  markDailyTrendingFeedFormatsFailed,
  normalizeTrendingTimezone,
  reconcileDailyTrendingFeedSlotIntegrity,
  type DailyTrendingFeedRecord,
  type DailyTrendingFeedSlotRecord,
  type TrendingPlanEntitlement,
} from "@/lib/trending/unified-daily-feed-db";

export type UnifiedTrendingDailyFeedState =
  | "caught_up"
  | "failed"
  | "preparing"
  | "ready";

const inFlightDailyPackPreparations = new Map<string, Promise<void>>();

const NO_REVIEWED_HOOK_VIDEO_SOURCES_ERROR =
  "No reviewed vertical Hook video sources are available.";
const HOOK_SOURCE_UNAVAILABLE_MESSAGE =
  "The reviewed Hook video library has no usable vertical clips right now. Try again shortly.";
const LEGACY_HOOK_SELECTION_ERROR_MESSAGE =
  "No reviewed Hook videos with enough business evidence are available.";
const LEGACY_PENDING_SOURCE_JOBS_MESSAGE =
  "The daily pack is still waiting for one or more source jobs.";
const HOOK_GENERATION_RESTART_REQUIRED_MESSAGE =
  "Hook videos were not started. Generate them now to use the reviewed Hook video library.";

type MissingFormatPreparationResult = {
  failureMessage?: string;
  status: "coverage_shortfall" | "failed" | "scheduled";
};

type PublicTrendingDailyFeedFailure = {
  code: "hook_generation_restart_required" | "hook_source_unavailable" | "content_generation_failed";
  message: string;
};

export async function readUnifiedTrendingDailyFeed(params: {
  includeHookVideos: boolean;
  includeWallText: boolean;
  profile: BusinessProfileRecord;
  timezone?: string | null;
  userId: string;
}) {
  const timezone = normalizeTrendingTimezone(
    params.timezone ?? params.profile.trendingTimezone,
  );
  const localDate = getTrendingLocalDate(timezone);
  const [preference, existingPlan] = await Promise.all([
    getTrendingContentMixPreference(params.userId),
    getDailyTrendingFeedForDate({ localDate, userId: params.userId }),
  ]);
  let entitlement: TrendingPlanEntitlement;
  let trialAccessBlocked = false;

  try {
    entitlement = await getTrendingPlanEntitlement(params.userId);
  } catch (error) {
    if (!(error instanceof FreeTrialAccessError) || !existingPlan) {
      throw error;
    }

    // A trial ending stops new preparation, without hiding content that was
    // already generated in the current daily pack.
    entitlement = getExistingFeedEntitlement(existingPlan.feed);
    trialAccessBlocked = true;
  }
  const effectivePreference = resolveTrendingContentMixPreference({
    planKey: entitlement.planKey,
    preference,
  });
  const dailyPlan = buildTrendingDailyFormatPlan({
    dailyLimit: entitlement.dailyLimit,
    localDate,
    mix: effectivePreference.mix,
  });

  if (!existingPlan) {
    return buildPreparingDailyFeed({
      allocation: dailyPlan.allocation,
      entitlement,
      localDate,
      mix: effectivePreference.mix,
      preferenceVersion: effectivePreference.preferenceVersion,
      timezone,
    });
  }

  const upgradeSlots = getAdditionalTrendingSlotsForUpgrade({
    currentPlanDailyLimit: entitlement.dailyLimit,
    currentPlanKey: entitlement.planKey,
    existingFeedPlanKey: existingPlan.feed.planKey,
  });
  const reservedAllocation = countReservedSlots(existingPlan.slots);
  const pinnedHookAssignmentIds = getReadyAssignmentIds({
    format: "hook_video",
    slots: existingPlan.slots,
  });
  const pinnedWallTextAssignmentIds = getReadyAssignmentIds({
    format: "wall_text",
    slots: existingPlan.slots,
  });
  const pinnedReactionAssignmentIds = getReadyAssignmentIds({
    format: "reaction",
    slots: existingPlan.slots,
  });
  const [carouselFeed, hookProvider, wallTextProvider, reactionProvider] =
    await Promise.all([
    reservedAllocation.carousel > 0
      ? loadTrendingFormat({
          load: () => readTrendingDailyFeed({
          dailyLimitOverride: reservedAllocation.carousel,
          profile: params.profile,
          timezone,
          userId: params.userId,
          }),
          fallback: null,
          onError: (error) => console.error("Could not read Carousel feed; other formats remain available", error),
        })
      : Promise.resolve(null),
    params.includeHookVideos && reservedAllocation.hook_video > 0
      ? getTrendingHookFeedProvider(params.profile, {
          pinnedAssignmentIds: pinnedHookAssignmentIds,
        })
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
            "hook_video",
            reservedAllocation.hook_video === 0
              ? "Hook Videos are disabled in this content mix."
              : "Hook Videos are not enabled for this environment.",
          ),
        ),
    params.includeWallText && reservedAllocation.wall_text > 0
      ? getTrendingWallTextFeedProvider(params.profile, {
          pinnedAssignmentIds: pinnedWallTextAssignmentIds,
        })
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
            "wall_text",
            reservedAllocation.wall_text === 0
              ? "Wall-of-text is disabled in this content mix."
              : "Wall-of-text is not enabled for this environment.",
        ),
      ),
    reservedAllocation.reaction > 0
      ? getTrendingReactionFeedProvider({
          businessProfileId: params.profile.id,
          businessProfileVersion: params.profile.profileVersion,
          pinnedAssignmentIds: pinnedReactionAssignmentIds,
          userId: params.userId,
        })
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingReactionFeedItem>(
            "reaction",
            "Reaction Reels are disabled in this content mix.",
          ),
        ),
  ]);
  const carouselProvider = carouselFeed
    ? createCarouselTrendingFeedProvider(carouselFeed.carousels)
    : createCarouselTrendingFeedProvider([]);
  const providers = [
    carouselProvider,
    hookProvider,
    wallTextProvider,
    reactionProvider,
  ] as const;
  const resolvedItems = buildSlotOrderedItems({
    providers,
    slots: existingPlan.slots,
  });
  const resolvedAssignmentIds = new Set(
    resolvedItems.map((item) => item.assignmentId),
  );
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: existingPlan.feed.dailyLimit,
    resolvedAssignmentIds,
    slots: existingPlan.slots,
  });
  const items = exposeTrendingDailyPackItems({
    items: resolvedItems,
  });
  const unresolvedByFormat = countUnresolvedSlots({
    resolvedAssignmentIds,
    slots: existingPlan.slots,
  });
  const responseReadiness =
    upgradeSlots > 0
      ? {
          ...readiness,
          pendingSlotCount: readiness.pendingSlotCount + upgradeSlots,
          ready: false,
          remainingCount: readiness.remainingCount + upgradeSlots,
        }
      : readiness;
  const state = getPublicDailyFeedState({
    items,
    readiness: responseReadiness,
  });
  const failure =
    state === "failed"
      ? getPublicDailyFeedFailure({
          error: existingPlan.feed.lastError,
          slots: existingPlan.slots,
        })
      : null;

  return {
    ...buildUnifiedDailyFeedResponse({
      allocation: reservedAllocation,
      entitlement,
      feedId: existingPlan.feed.id,
      items,
      localDate,
      mix: existingPlan.feed.mix,
      preferenceVersion: existingPlan.feed.preferenceVersion,
      readiness: responseReadiness,
      state,
      timezone,
      failure,
    }),
    formatAvailability: buildFormatAvailability({
      allocation: reservedAllocation,
      failedFormats: existingPlan.slots.filter((slot) => slot.state === "failed").map((slot) => slot.format),
      missingByFormat: unresolvedByFormat,
      preparationResults: new Map(),
    }),
    requiresPreparation:
      !trialAccessBlocked &&
      (upgradeSlots > 0 ||
        shouldPrepareDailyFeed({
          dailyLimit: existingPlan.feed.dailyLimit,
          items,
          readiness,
          slots: existingPlan.slots,
        })),
    upgradeRequired: trialAccessBlocked,
  };
}

function getExistingFeedEntitlement(
  feed: DailyTrendingFeedRecord,
): TrendingPlanEntitlement {
  const planKey =
    feed.planKey === "creator" ||
    feed.planKey === "pro" ||
    feed.planKey === "ultra_pro"
      ? feed.planKey
      : "free";

  return {
    dailyLimit: feed.dailyLimit,
    displayName:
      planKey === "creator" || planKey === "ultra_pro"
        ? "Growth"
        : planKey === "pro"
          ? "Starter"
          : "Free",
    planKey,
  };
}

export function prepareUnifiedTrendingDailyFeed(params: Parameters<
  typeof ensureUnifiedTrendingDailyFeed
>[0]) {
  const timezone = normalizeTrendingTimezone(
    params.timezone ?? params.profile.trendingTimezone,
  );
  const localDate = getTrendingLocalDate(timezone);
  const key = `${params.userId}:${localDate}`;
  const existing = inFlightDailyPackPreparations.get(key);

  if (existing) {
    return existing;
  }

  const preparation = ensureUnifiedTrendingDailyFeed(params)
    .then(() => undefined)
    .finally(() => {
      if (inFlightDailyPackPreparations.get(key) === preparation) {
        inFlightDailyPackPreparations.delete(key);
      }
    });

  inFlightDailyPackPreparations.set(key, preparation);
  return preparation;
}

function buildPreparingDailyFeed(params: {
  allocation: TrendingContentAllocation;
  entitlement: TrendingPlanEntitlement;
  localDate: string;
  mix: {
    carousel: number;
    hook_video: number;
    wall_text: number;
  };
  preferenceVersion: number;
  timezone: string;
}) {
  const readiness: TrendingDailyPackReadiness = {
    completedCount: 0,
    deliverableCount: 0,
    failedSlotCount: 0,
    pendingSlotCount: params.entitlement.dailyLimit,
    ready: false,
    remainingCount: params.entitlement.dailyLimit,
  };

  return {
    ...buildUnifiedDailyFeedResponse({
      allocation: params.allocation,
      entitlement: params.entitlement,
      feedId: null,
      items: [],
      localDate: params.localDate,
      mix: params.mix,
      preferenceVersion: params.preferenceVersion,
      readiness,
      state: "preparing",
      timezone: params.timezone,
    }),
    formatAvailability: buildFormatAvailability({
      allocation: params.allocation,
      missingByFormat: params.allocation,
      preparationResults: new Map(),
    }),
    requiresPreparation: true,
  };
}

function buildUnifiedDailyFeedResponse(params: {
  allocation: TrendingContentAllocation;
  entitlement: TrendingPlanEntitlement;
  feedId: string | null;
  failure?: PublicTrendingDailyFeedFailure | null;
  items: TrendingFeedItem[];
  localDate: string;
  mix: {
    carousel: number;
    hook_video: number;
    wall_text: number;
  };
  preferenceVersion: number;
  readiness: TrendingDailyPackReadiness;
  state: UnifiedTrendingDailyFeedState;
  timezone: string;
}) {
  return {
    carousels: params.items
      .filter(
        (item): item is TrendingCarouselFeedItem => item.format === "carousel",
      )
      .map((item) => ({
        ...item.creative,
        assignmentId: item.assignmentId,
        feedItemId: item.feedItemId,
        feedPosition: item.position,
        feedSource: item.source,
      })),
    contentMix: {
      allocation: params.allocation,
      limits: { ...TRENDING_CONTENT_MIX_LIMITS },
      preferenceVersion: params.preferenceVersion,
      percentages: params.mix,
    },
    entitlement: {
      dailyCarouselLimit: params.allocation.carousel,
      dailyTrendingLimit: params.entitlement.dailyLimit,
      displayName: params.entitlement.displayName,
      planKey: params.entitlement.planKey,
    },
    feed: {
      assignedCount: params.items.length + params.readiness.completedCount,
      completedCount: params.readiness.completedCount,
      failure: params.failure ?? null,
      id: params.feedId,
      localDate: params.localDate,
      pendingSlotCount: params.readiness.pendingSlotCount,
      remainingCount: params.readiness.remainingCount,
      state: params.state,
      timezone: params.timezone,
    },
    items: params.items,
  };
}

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
  const [entitlement, preference, existingPlan] = await Promise.all([
    getTrendingPlanEntitlement(params.userId),
    getTrendingContentMixPreference(params.userId),
    getDailyTrendingFeedForDate({ localDate, userId: params.userId }),
  ]);
  const effectivePreference = resolveTrendingContentMixPreference({
    planKey: entitlement.planKey,
    preference,
  });
  const dailyPlan = buildTrendingDailyFormatPlan({
    dailyLimit: entitlement.dailyLimit,
    localDate,
    mix: effectivePreference.mix,
  });
  const upgradeSlots = existingPlan
    ? getAdditionalTrendingSlotsForUpgrade({
        currentPlanDailyLimit: entitlement.dailyLimit,
        currentPlanKey: entitlement.planKey,
        existingFeedPlanKey: existingPlan.feed.planKey,
      })
    : 0;
  const existingFormats = existingPlan
    ? getStoredDailyFeedFormats({
        localDate,
        plan: existingPlan,
      })
    : [];
  const plannedFormats = existingPlan
    ? upgradeSlots > 0
      ? [...existingFormats, ...dailyPlan.formats]
      : existingFormats
    : dailyPlan.formats;
  const reservedEntitlement = {
    ...entitlement,
    dailyLimit: getReservedTrendingDailyLimit({
      currentPlanDailyLimit: entitlement.dailyLimit,
      existingFeedDailyLimit: existingPlan?.feed.dailyLimit,
      upgradeSlots,
    }),
  };
  const initialPlan = await ensureDailyTrendingFeedPlan({
    businessProfileId: params.profile.id,
    businessProfileVersion: params.profile.profileVersion,
    entitlement: reservedEntitlement,
    formats: plannedFormats,
    localDate,
    preference: effectivePreference,
    timezone,
    userId: params.userId,
  });
  const reservedAllocation = countReservedSlots(initialPlan.slots);
  const [carouselProvider, hookProvider, wallTextProvider, reactionProvider] =
    await loadProviders({
      allocation: reservedAllocation,
      includeHookVideos: params.includeHookVideos,
      includeWallText: params.includeWallText,
      markItemsShown: params.markItemsShown,
      profile: params.profile,
      slots: initialPlan.slots,
      timezone,
      userId: params.userId,
    });

  await reconcileDailyTrendingFeedSlotIntegrity({
    feedId: initialPlan.feed.id,
    hookVideoAssignmentIds: hookProvider.items.map((item) => item.assignmentId),
    hookVideoProviderResolved: hookProvider.state === "ready",
    reactionAssignmentIds: reactionProvider.items.map((item) => item.assignmentId),
    reactionProviderResolved: reactionProvider.state === "ready",
    wallTextAssignmentIds: wallTextProvider.items.map((item) => item.assignmentId),
    wallTextProviderResolved: wallTextProvider.state === "ready",
  });

  await attachDailyTrendingAssignments({
    carouselAssignmentIds: carouselProvider.items.map((item) => item.assignmentId),
    feedId: initialPlan.feed.id,
    hookVideoAssignmentIds: hookProvider.items.map((item) => item.assignmentId),
    reactionAssignmentIds: reactionProvider.items.map((item) => item.assignmentId),
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
      reaction: reactionProvider.items.length,
      wall_text: wallTextProvider.items.length,
    },
    includeHookVideos: params.includeHookVideos,
    includeWallText: params.includeWallText,
    missingByFormat,
    profile: params.profile,
    reactionDailyFeedKey: attachedPlan.feed.wallTextRetryKey
      ? `${attachedPlan.feed.id}:retry-${attachedPlan.feed.wallTextRetryKey}`
      : attachedPlan.feed.id,
    wallTextDailyFeedKey: attachedPlan.feed.id,
    wallTextRecoveryKey: attachedPlan.feed.wallTextRetryKey,
  });
  const resolvedItems = buildSlotOrderedItems({
    providers: [carouselProvider, hookProvider, wallTextProvider, reactionProvider],
    slots: attachedPlan.slots,
  });
  const resolvedAssignmentIds = new Set(
    resolvedItems.map((item) => item.assignmentId),
  );
  const readiness = getTrendingDailyPackReadiness({
    dailyLimit: attachedPlan.feed.dailyLimit,
    resolvedAssignmentIds,
    slots: attachedPlan.slots,
  });
  const items = exposeTrendingDailyPackItems({
    items: resolvedItems,
  });
  const unresolvedByFormat = countUnresolvedSlots({
    resolvedAssignmentIds,
    slots: attachedPlan.slots,
  });
  const terminalFailureFormats = getTerminalPreparationFailureFormats({
      hookProvider,
      includeHookVideos: params.includeHookVideos,
      includeWallText: params.includeWallText,
      missingByFormat,
      preparationResults,
      reactionProvider,
      unresolvedByFormat,
      wallTextProvider,
    });
  const state = getPublicDailyFeedState({
    items,
    readiness,
    terminalFailure: terminalFailureFormats.length > 0,
  });

  if (terminalFailureFormats.length > 0) {
    await markDailyTrendingFeedFormatsFailed({
      feedId: attachedPlan.feed.id,
      formats: terminalFailureFormats,
      message: getTerminalPreparationFailureMessage({
        formats: terminalFailureFormats,
        preparationResults,
      }),
    });
  }

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
      limits: { ...TRENDING_CONTENT_MIX_LIMITS },
      preferenceVersion: effectivePreference.preferenceVersion,
      percentages: attachedPlan.feed.mix,
    },
    entitlement: {
      dailyCarouselLimit: reservedAllocation.carousel,
      dailyTrendingLimit: entitlement.dailyLimit,
      displayName: entitlement.displayName,
      planKey: entitlement.planKey,
    },
    feed: {
      assignedCount: resolvedItems.length + readiness.completedCount,
      completedCount: readiness.completedCount,
      id: attachedPlan.feed.id,
      localDate,
      pendingSlotCount: readiness.pendingSlotCount,
      remainingCount: readiness.remainingCount,
      state,
      timezone,
    },
    formatAvailability: buildFormatAvailability({
      allocation: reservedAllocation,
      missingByFormat: unresolvedByFormat,
      preparationResults,
    }),
    items,
  };
}

function shouldPrepareDailyFeed(params: {
  dailyLimit: number;
  items: readonly TrendingFeedItem[];
  readiness: TrendingDailyPackReadiness;
  slots: readonly DailyTrendingFeedSlotRecord[];
}) {
  return (
    params.slots.length !== params.dailyLimit ||
    params.readiness.pendingSlotCount > 0 ||
    (params.items.length === 0 && params.readiness.failedSlotCount > 0)
  );
}

function getTerminalPreparationFailureFormats(params: {
  hookProvider: TrendingFeedProviderResult<TrendingHookVideoFeedItem>;
  includeHookVideos: boolean;
  includeWallText: boolean;
  missingByFormat: TrendingContentAllocation;
  preparationResults: Map<
    "hook_video" | "reaction" | "wall_text",
    MissingFormatPreparationResult
  >;
  reactionProvider: TrendingFeedProviderResult<TrendingReactionFeedItem>;
  unresolvedByFormat: TrendingContentAllocation;
  wallTextProvider: TrendingFeedProviderResult<TrendingWallTextFeedItem>;
}) {
  const hookFailed =
      params.unresolvedByFormat.hook_video > 0 &&
    (!params.includeHookVideos ||
      params.preparationResults.get("hook_video")?.status === "failed" ||
      (params.missingByFormat.hook_video === 0 &&
        params.hookProvider.state === "unavailable"));
  const wallTextFailed =
      params.unresolvedByFormat.wall_text > 0 &&
    (!params.includeWallText ||
      params.preparationResults.get("wall_text")?.status === "failed" ||
      (params.missingByFormat.wall_text === 0 &&
        params.wallTextProvider.state === "unavailable"));
  const reactionFailed =
    params.unresolvedByFormat.reaction > 0 &&
    (params.preparationResults.get("reaction")?.status === "coverage_shortfall" ||
      params.preparationResults.get("reaction")?.status === "failed" ||
      (params.missingByFormat.reaction === 0 &&
        params.reactionProvider.state === "unavailable"));

  return [
    ...(hookFailed ? ["hook_video" as const] : []),
    ...(wallTextFailed ? ["wall_text" as const] : []),
    ...(reactionFailed ? ["reaction" as const] : []),
  ];
}

function countUnresolvedSlots(params: {
  resolvedAssignmentIds: ReadonlySet<string>;
  slots: DailyTrendingFeedSlotRecord[];
}) {
  const counts: TrendingContentAllocation = {
    carousel: 0,
    hook_video: 0,
    reaction: 0,
    wall_text: 0,
  };

  for (const slot of params.slots) {
    if (slot.state === "decided") {
      continue;
    }

    if (
      slot.state !== "ready" ||
      !slot.assignmentId ||
      !params.resolvedAssignmentIds.has(slot.assignmentId)
    ) {
      counts[slot.format] += 1;
    }
  }

  return counts;
}

function countReservedSlots(slots: DailyTrendingFeedSlotRecord[]) {
  const counts: TrendingContentAllocation = {
    carousel: 0,
    hook_video: 0,
    reaction: 0,
    wall_text: 0,
  };

  for (const slot of slots) {
    counts[slot.format] += 1;
  }

  return counts;
}

function getTerminalPreparationFailureMessage(params: {
  formats: Array<"hook_video" | "reaction" | "wall_text">;
  preparationResults: Map<
    "hook_video" | "reaction" | "wall_text",
    MissingFormatPreparationResult
  >;
}) {
  for (const format of params.formats) {
    const message = params.preparationResults.get(format)?.failureMessage;

    if (message) {
      return message;
    }
  }

  return "One or more reserved Trending formats could not be prepared.";
}

function getReadyAssignmentIds(params: {
  format: TrendingFeedFormat;
  slots: readonly DailyTrendingFeedSlotRecord[];
}) {
  return params.slots.flatMap((slot) =>
    slot.format === params.format && slot.state === "ready" && slot.assignmentId
      ? [slot.assignmentId]
      : [],
  );
}

function getStoredDailyFeedFormats(params: {
  localDate: string;
  plan: {
    feed: Pick<DailyTrendingFeedRecord, "dailyLimit" | "mix">;
    slots: readonly DailyTrendingFeedSlotRecord[];
  };
}) {
  const fallback = buildTrendingDailyFormatPlan({
    dailyLimit: params.plan.feed.dailyLimit,
    localDate: params.localDate,
    mix: params.plan.feed.mix,
  }).formats;
  const formatByPosition = new Map(
    params.plan.slots.map((slot) => [slot.position, slot.format]),
  );

  return fallback.map(
    (format, index) => formatByPosition.get(index + 1) ?? format,
  );
}

async function loadProviders(params: {
  allocation: TrendingContentAllocation;
  includeHookVideos: boolean;
  includeWallText: boolean;
  markItemsShown?: boolean;
  profile: BusinessProfileRecord;
  slots: DailyTrendingFeedSlotRecord[];
  timezone: string;
  userId: string;
}) {
  const pinnedHookAssignmentIds = getReadyAssignmentIds({
    format: "hook_video",
    slots: params.slots,
  });
  const pinnedWallTextAssignmentIds = getReadyAssignmentIds({
    format: "wall_text",
    slots: params.slots,
  });
  const pinnedReactionAssignmentIds = getReadyAssignmentIds({
    format: "reaction",
    slots: params.slots,
  });
  const [carouselDailyFeed, hookProvider, wallTextProvider, reactionProvider] =
    await Promise.all([
    params.allocation.carousel > 0
      ? loadTrendingFormat({
          load: () => ensureTrendingDailyFeed({
          dailyLimitOverride: params.allocation.carousel,
          markItemsShown: params.markItemsShown,
          profile: params.profile,
          timezone: params.timezone,
          userId: params.userId,
          }),
          fallback: null,
          onError: (error) => console.error("Could not prepare Carousel feed; continuing other formats", error),
        })
      : Promise.resolve(null),
    params.includeHookVideos && params.allocation.hook_video > 0
      ? getTrendingHookFeedProvider(params.profile, {
          pinnedAssignmentIds: pinnedHookAssignmentIds,
        })
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
            "hook_video",
            params.allocation.hook_video === 0
              ? "Hook Videos are disabled in this content mix."
              : "Hook Videos are not enabled for this environment.",
          ),
        ),
    params.includeWallText && params.allocation.wall_text > 0
      ? getTrendingWallTextFeedProvider(params.profile, {
          pinnedAssignmentIds: pinnedWallTextAssignmentIds,
        })
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
            "wall_text",
            params.allocation.wall_text === 0
              ? "Wall-of-text is disabled in this content mix."
              : "Wall-of-text is not enabled for this environment.",
        ),
      ),
    params.allocation.reaction > 0
      ? getTrendingReactionFeedProvider({
          businessProfileId: params.profile.id,
          businessProfileVersion: params.profile.profileVersion,
          pinnedAssignmentIds: pinnedReactionAssignmentIds,
          userId: params.userId,
        })
      : Promise.resolve(
          createUnavailableTrendingFeedProvider<TrendingReactionFeedItem>(
            "reaction",
            "Reaction Reels are disabled in this content mix.",
          ),
        ),
  ]);
  return [
    carouselDailyFeed
      ? createCarouselTrendingFeedProvider(carouselDailyFeed.carousels)
      : ({ format: "carousel", items: [], state: "ready" } satisfies TrendingFeedProviderResult<TrendingCarouselFeedItem>),
    hookProvider,
    wallTextProvider,
    reactionProvider,
  ] as const;
}

async function prepareMissingFormats(params: {
  currentCounts: TrendingContentAllocation;
  includeHookVideos: boolean;
  includeWallText: boolean;
  missingByFormat: TrendingContentAllocation;
  profile: BusinessProfileRecord;
  reactionDailyFeedKey: string;
  wallTextDailyFeedKey: string;
  wallTextRecoveryKey?: string | null;
}) {
  const results = new Map<
    "hook_video" | "reaction" | "wall_text",
    MissingFormatPreparationResult
  >();
  const tasks: Promise<void>[] = [];

  if (params.includeHookVideos && params.missingByFormat.hook_video > 0) {
    tasks.push(
      prepareTrendingHookIdeas(params.profile, {
        mode: "refill",
        targetActive:
          params.currentCounts.hook_video + params.missingByFormat.hook_video,
      })
        .then(() => {
          results.set("hook_video", { status: "scheduled" });
        })
        .catch((error) => {
          console.error("Could not prepare reserved Hook Video positions:", error);
          results.set("hook_video", {
            failureMessage: getHookPreparationFailureMessage(error),
            status: "failed",
          });
        }),
    );
  }

  if (params.includeWallText && params.missingByFormat.wall_text > 0) {
    tasks.push(
      enqueueTrendingWallTextRefill(params.profile, {
        // A regular refill needs a stable key for this daily feed. Without it,
        // the same profile/count key can resolve to a completed job from an
        // earlier day and leave this feed's reserved slots unassigned.
        recoveryKey:
          params.wallTextRecoveryKey ?? params.wallTextDailyFeedKey,
        targetActive:
          params.currentCounts.wall_text + params.missingByFormat.wall_text,
      })
        .then((result) => {
          results.set(
            "wall_text",
            result.status === "failed"
              ? {
                  failureMessage:
                    "Wall-of-text content could not be prepared. Try again shortly.",
                  status: "failed",
                }
              : { status: "scheduled" },
          );
        })
        .catch((error) => {
          console.error("Could not prepare reserved Wall-of-text positions:", error);
          results.set("wall_text", {
            failureMessage:
              "Wall-of-text content could not be prepared. Try again shortly.",
            status: "failed",
          });
        }),
    );
  }

  if (params.missingByFormat.reaction > 0) {
    // The planner and renderer make final owner-scoped MP4s in the worker.
    // The raw catalog is never treated as a browser-side Trending fallback.
    tasks.push(
      enqueueTrendingReactionRefill(params.profile, {
        currentActiveCount: params.currentCounts.reaction,
        dailyFeedKey: params.reactionDailyFeedKey,
        requestedCount: params.missingByFormat.reaction,
      })
        .then((result) => {
          results.set(
            "reaction",
            result.kind === "coverage_shortfall"
              ? {
                  failureMessage: result.message,
                  status: "coverage_shortfall",
                }
              : result.job.status === "failed"
              ? {
                  failureMessage: "Reaction Reels could not be prepared. Try again shortly.",
                  status: "failed",
                }
              : { status: "scheduled" },
          );
        })
        .catch((error) => {
          console.error("Could not prepare reserved Reaction Reel positions:", error);
          results.set("reaction", {
            failureMessage: "Reaction Reels could not be prepared. Try again shortly.",
            status: "failed",
          });
        }),
    );
  }

  await Promise.all(tasks);
  return results;
}

function getHookPreparationFailureMessage(error: unknown) {
  if (error instanceof TrendingHookPreparationError) {
    if (error.message === NO_REVIEWED_HOOK_VIDEO_SOURCES_ERROR) {
      return HOOK_SOURCE_UNAVAILABLE_MESSAGE;
    }

    return error.message;
  }

  return "Hook videos could not be prepared. Try again shortly.";
}

export function getPublicDailyFeedFailure(params: {
  error: string | null;
  slots: readonly DailyTrendingFeedSlotRecord[];
}): PublicTrendingDailyFeedFailure | null {
  const hasUnstartedFailedHookSlots = hasUnassignedFailedHookSlot(params.slots);

  if (
    hasUnstartedFailedHookSlots &&
    (params.error === LEGACY_PENDING_SOURCE_JOBS_MESSAGE ||
      params.error === LEGACY_HOOK_SELECTION_ERROR_MESSAGE)
  ) {
    return {
      code: "hook_generation_restart_required",
      message: HOOK_GENERATION_RESTART_REQUIRED_MESSAGE,
    };
  }

  if (params.error === HOOK_SOURCE_UNAVAILABLE_MESSAGE) {
    return {
      code: "hook_source_unavailable",
      message: HOOK_SOURCE_UNAVAILABLE_MESSAGE,
    };
  }

  return {
    code: "content_generation_failed",
    message: "Some daily content could not be prepared. Your ready content is available; try again to recover the missing pieces.",
  };
}

function hasUnassignedFailedHookSlot(
  slots: readonly DailyTrendingFeedSlotRecord[],
) {
  return slots.some(
    (slot) =>
      slot.format === "hook_video" &&
      slot.state === "failed" &&
      !slot.assignmentId,
  );
}

function countMissingSlots(slots: DailyTrendingFeedSlotRecord[]) {
  const counts: TrendingContentAllocation = {
    carousel: 0,
    hook_video: 0,
    reaction: 0,
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
        source: item.source,
      } satisfies TrendingFeedItem,
    ];
  });
}

function buildFormatAvailability(params: {
  allocation: TrendingContentAllocation;
  failedFormats?: readonly TrendingFeedFormat[];
  missingByFormat: TrendingContentAllocation;
  preparationResults: Map<
    "hook_video" | "reaction" | "wall_text",
    MissingFormatPreparationResult
  >;
}): TrendingFeedProviderAvailability[] {
  return (["carousel", "wall_text", "hook_video", "reaction"] as const).map((format) => {
    if (params.allocation[format] === 0) {
      return { format, reason: "Disabled in the saved content mix.", state: "ready" as const };
    }

    if (params.missingByFormat[format] === 0) {
      return { format, state: "ready" as const };
    }

    const preparation =
      format === "carousel" ? undefined : params.preparationResults.get(format);
    const failed =
      params.failedFormats?.includes(format) ||
      preparation?.status === "failed" ||
      preparation?.status === "coverage_shortfall";
    return {
      format,
      reason: failed
        ? preparation?.failureMessage ??
          "Reserved content could not be prepared. Try again shortly."
        : "Reserved content is being prepared in the background.",
      state: "unavailable" as const,
    };
  });
}
