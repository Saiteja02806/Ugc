import type { HookTextLayoutVersion } from "@/lib/trending/hook-text-layout";
import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
} from "./wall-text-types.ts";

export type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
} from "./wall-text-types.ts";

export const trendingFeedFormats = [
  "carousel",
  "hook_video",
  "wall_text",
  "reaction",
] as const;

export type TrendingFeedFormat = (typeof trendingFeedFormats)[number];
export const trendingFeedDisplayOrder = [
  "reaction",
  "wall_text",
  "hook_video",
  "carousel",
] as const satisfies readonly TrendingFeedFormat[];
export type TrendingFeedItemReadiness = "preview_ready";
export type TrendingFeedItemSource = "carried" | "new";
export type TrendingFeedProviderState = "ready" | "unavailable";

export type TrendingCarouselSlide = {
  headline: string;
  renderedUrl: string | null;
  slideNumber: number;
  slideType: string | null;
  status: "failed" | "processing" | "ready";
  subtext: string | null;
};

export type TrendingCarouselCreative = {
  candidateIndex: number;
  carouselId: string;
  categorySlug: string | null;
  generationBatchId: string;
  projectId: string;
  readySlideCount: number;
  selectedAngle: string | null;
  slideCount: number;
  slides: TrendingCarouselSlide[];
  status: "completed" | "failed" | "processing";
  thumbnailUrl: string | null;
  updatedAt: string;
};

export type TrendingCarouselSourceRecord = TrendingCarouselCreative & {
  assignmentId: string;
  feedItemId: string;
  feedPosition: number;
  feedSource: TrendingFeedItemSource;
};

export type TrendingHookTextContent = {
  fontSize: number;
  hookTextFormatId: string | null;
  kind: "hook";
  layoutVersion?: HookTextLayoutVersion;
  lines: string[];
  patternId: string | null;
  writingFormatId: string;
  placement: "catalog" | "default";
  position: { x: number; y: number } | null;
  styleVersion:
    | "hook-overlay-v1"
    | "hook-overlay-v2"
    | "hook-overlay-v3"
    | "hook-overlay-v4-fixed-type";
  value: string;
};

export type TrendingHookVideoCreative = {
  aspectRatio: "9:16";
  durationSeconds: number;
  influencerId: string;
  influencerName: string;
  previewSessionEndpoint: string;
  sourceKind: "catalog" | "user";
  sourceDurationSeconds: number;
  text: TrendingHookTextContent;
  thumbnailUrl: string | null;
  title: string;
  trimEnd: number | null;
  trimStart: number;
  videoId: string;
};

export type TrendingHookVideoSourceRecord = TrendingHookVideoCreative & {
  assignmentId: string;
  creativeId: string;
  feedItemId: string;
  feedPosition: number;
  feedSource: TrendingFeedItemSource;
};

export type TrendingWallTextCreative = {
  aspectRatio: "9:16";
  audio: {
    assetDurationSeconds: number;
    assetId: string;
    audioUrl: string;
    cueStartSeconds: number;
    fadeOutSeconds: number;
    fitMode: "exact" | "trim" | "loop";
    matchingVersion: string;
    outputDurationSeconds: number;
    selectionId: string;
  };
  durationSeconds: number;
  layout: TrendingWallTextLayout;
  previewUrl: string;
  text: TrendingWallTextContent;
  thumbnailUrl: string | null;
  title: string;
};

export type TrendingWallTextSourceRecord = TrendingWallTextCreative & {
  assignmentId: string;
  creativeId: string;
  feedItemId: string;
  feedPosition: number;
  feedSource: TrendingFeedItemSource;
};

/**
 * Reaction previews are final 9:16 MP4s. Unlike Wall-of-text, their caption
 * and foreground were already flattened by the render worker, so the feed
 * must never recreate the composite in the browser.
 */
export type TrendingReactionCreative = {
  aspectRatio: "9:16";
  caption: string;
  clipAssetId: string;
  durationSeconds: number;
  mediaAssetId: string;
  previewUrl: string;
  primaryReaction: string;
  thumbnailUrl: string | null;
  title: string;
};

export type TrendingReactionSourceRecord = TrendingReactionCreative & {
  assignmentId: string;
  creativeId: string;
  feedItemId: string;
  feedPosition: number;
  feedSource: TrendingFeedItemSource;
};

type TrendingFeedItemBase<Format extends TrendingFeedFormat> = {
  assignmentId: string;
  creativeId: string;
  feedItemId: string;
  format: Format;
  id: string;
  position: number;
  readiness: TrendingFeedItemReadiness;
  source: TrendingFeedItemSource;
};

export type TrendingCarouselFeedItem =
  TrendingFeedItemBase<"carousel"> & {
    creative: TrendingCarouselCreative;
  };

export type TrendingHookVideoFeedItem =
  TrendingFeedItemBase<"hook_video"> & {
    creative: TrendingHookVideoCreative;
  };

export type TrendingWallTextFeedItem =
  TrendingFeedItemBase<"wall_text"> & {
    creative: TrendingWallTextCreative;
  };

export type TrendingReactionFeedItem = TrendingFeedItemBase<"reaction"> & {
  creative: TrendingReactionCreative;
};

export type TrendingFeedItem =
  | TrendingCarouselFeedItem
  | TrendingHookVideoFeedItem
  | TrendingWallTextFeedItem
  | TrendingReactionFeedItem;

export type TrendingFeedProviderAvailability = {
  format: TrendingFeedFormat;
  reason?: string;
  state: TrendingFeedProviderState;
};

export type TrendingFeedProviderResult<
  Item extends TrendingFeedItem = TrendingFeedItem,
> = TrendingFeedProviderAvailability & {
  items: Item[];
};

const formatOrder = new Map<TrendingFeedFormat, number>(
  trendingFeedDisplayOrder.map((format, index) => [format, index]),
);

export function compareTrendingFeedItems(
  first: TrendingFeedItem,
  second: TrendingFeedItem,
) {
  return (
    first.position - second.position ||
    (formatOrder.get(first.format) ?? Number.MAX_SAFE_INTEGER) -
      (formatOrder.get(second.format) ?? Number.MAX_SAFE_INTEGER) ||
    first.id.localeCompare(second.id)
  );
}

/**
 * Finds the active creative again after the feed has been refreshed.
 *
 * Feed decisions remove the decided item on the server, so an array position
 * is not stable across refreshes. The deck must follow the next item's stable
 * ID instead of reusing its old numeric offset.
 */
export function getTrendingFeedActiveItemIndex<Item>(
  items: readonly Item[],
  activeItemId: string | null,
  getItemId: (item: Item) => string,
) {
  if (!activeItemId) {
    return 0;
  }

  const index = items.findIndex((item) => getItemId(item) === activeItemId);

  return index >= 0 ? index : 0;
}

export function excludeDismissedTrendingFeedItems<Item>(
  items: readonly Item[],
  dismissedItemIds: ReadonlySet<string>,
  getItemId: (item: Item) => string,
) {
  return items.filter((item) => !dismissedItemIds.has(getItemId(item)));
}

/**
 * Removes items whose decision has already been made in this browser.
 *
 * This belongs to the feed state, rather than only the visible card deck:
 * opening a Hook composer temporarily unmounts the deck, but must never make
 * a previously swiped item visible again.
 */
export function excludeDecidedTrendingFeedItems<Item>(
  items: readonly Item[],
  decidedAssignmentIds: ReadonlySet<string>,
  getAssignmentId: (item: Item) => string,
) {
  return items.filter(
    (item) => !decidedAssignmentIds.has(getAssignmentId(item)),
  );
}

export function createCarouselTrendingFeedProvider(
  carousels: readonly TrendingCarouselSourceRecord[],
): TrendingFeedProviderResult<TrendingCarouselFeedItem> {
  return {
    format: "carousel",
    items: carousels
      .filter(isPreviewReadyCarousel)
      .map(toCarouselTrendingFeedItem),
    state: "ready",
  };
}

export function createHookTrendingFeedProvider(
  hooks: readonly TrendingHookVideoSourceRecord[],
): TrendingFeedProviderResult<TrendingHookVideoFeedItem> {
  return {
    format: "hook_video",
    items: hooks.map(toHookTrendingFeedItem),
    state: "ready",
  };
}

export function createWallTextTrendingFeedProvider(
  ideas: readonly TrendingWallTextSourceRecord[],
): TrendingFeedProviderResult<TrendingWallTextFeedItem> {
  return {
    format: "wall_text",
    items: ideas.map(toWallTextTrendingFeedItem),
    state: "ready",
  };
}

export function createReactionTrendingFeedProvider(
  ideas: readonly TrendingReactionSourceRecord[],
): TrendingFeedProviderResult<TrendingReactionFeedItem> {
  return {
    format: "reaction",
    items: ideas.map(toReactionTrendingFeedItem),
    state: "ready",
  };
}

export function createUnavailableTrendingFeedProvider<
  Item extends TrendingFeedItem = TrendingFeedItem,
>(
  format: Exclude<TrendingFeedFormat, "carousel">,
  reason: string,
): TrendingFeedProviderResult<Item> {
  return {
    format,
    items: [],
    reason,
    state: "unavailable",
  };
}

export function createCurrentTrendingFeedProviders(
  carousels: readonly TrendingCarouselSourceRecord[],
  hookProvider: TrendingFeedProviderResult<TrendingHookVideoFeedItem> =
    createUnavailableTrendingFeedProvider(
      "hook_video",
      "Hook ideas are being prepared from the business profile.",
    ),
  wallTextProvider: TrendingFeedProviderResult<TrendingWallTextFeedItem> =
    createUnavailableTrendingFeedProvider(
      "wall_text",
      "Wall-of-text ideas are being prepared from the business profile.",
    ),
  options: { includeHookVideos?: boolean } = {},
): TrendingFeedProviderResult[] {
  return [
    createCarouselTrendingFeedProvider(carousels),
    ...(options.includeHookVideos === false ? [] : [hookProvider]),
    wallTextProvider,
  ];
}

export function buildUnifiedTrendingFeed(
  providers: readonly TrendingFeedProviderResult[],
) {
  const itemById = new Map<string, TrendingFeedItem>();

  for (const provider of providers) {
    if (provider.state !== "ready") {
      continue;
    }

    for (const item of provider.items) {
      if (
        item.format !== provider.format ||
        item.readiness !== "preview_ready" ||
        itemById.has(item.id)
      ) {
        continue;
      }

      itemById.set(item.id, item);
    }
  }

  return [...itemById.values()].sort(compareTrendingFeedItems);
}

export function getTrendingFeedProviderAvailability(
  providers: readonly TrendingFeedProviderResult[],
): TrendingFeedProviderAvailability[] {
  return providers.map(({ format, reason, state }) => ({
    format,
    ...(reason ? { reason } : {}),
    state,
  }));
}

export function isCarouselTrendingFeedItem(
  item: TrendingFeedItem,
): item is TrendingCarouselFeedItem {
  return item.format === "carousel";
}

export function isPreviewReadyCarousel(
  carousel: TrendingCarouselCreative,
): boolean {
  return (
    carousel.status === "completed" &&
    carousel.slideCount > 0 &&
    carousel.slides.filter(
      (slide) => slide.status === "ready" && Boolean(slide.renderedUrl),
    ).length === carousel.slideCount
  );
}

function toCarouselTrendingFeedItem(
  carousel: TrendingCarouselSourceRecord,
): TrendingCarouselFeedItem {
  const {
    assignmentId,
    feedItemId,
    feedPosition,
    feedSource,
    ...creative
  } = carousel;

  return {
    assignmentId,
    creative,
    creativeId: creative.carouselId,
    feedItemId,
    format: "carousel",
    id: `carousel:${feedItemId}`,
    position: feedPosition,
    readiness: "preview_ready",
    source: feedSource,
  };
}

function toHookTrendingFeedItem(
  hook: TrendingHookVideoSourceRecord,
): TrendingHookVideoFeedItem {
  const {
    assignmentId,
    creativeId,
    feedItemId,
    feedPosition,
    feedSource,
    ...creative
  } = hook;

  return {
    assignmentId,
    creative,
    creativeId,
    feedItemId,
    format: "hook_video",
    id: `hook_video:${feedItemId}`,
    position: feedPosition,
    readiness: "preview_ready",
    source: feedSource,
  };
}

function toWallTextTrendingFeedItem(
  idea: TrendingWallTextSourceRecord,
): TrendingWallTextFeedItem {
  const {
    assignmentId,
    creativeId,
    feedItemId,
    feedPosition,
    feedSource,
    ...creative
  } = idea;

  return {
    assignmentId,
    creative,
    creativeId,
    feedItemId,
    format: "wall_text",
    id: `wall_text:${feedItemId}`,
    position: feedPosition,
    readiness: "preview_ready",
    source: feedSource,
  };
}

function toReactionTrendingFeedItem(
  idea: TrendingReactionSourceRecord,
): TrendingReactionFeedItem {
  const {
    assignmentId,
    creativeId,
    feedItemId,
    feedPosition,
    feedSource,
    ...creative
  } = idea;

  return {
    assignmentId,
    creative: {
      ...creative,
      aspectRatio: "9:16",
    },
    creativeId,
    feedItemId,
    format: "reaction",
    id: `reaction:${feedItemId}`,
    position: feedPosition,
    readiness: "preview_ready",
    source: feedSource,
  };
}
