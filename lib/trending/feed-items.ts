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
] as const;

export type TrendingFeedFormat = (typeof trendingFeedFormats)[number];
export const trendingFeedDisplayOrder = [
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
  kind: "hook";
  lines: string[];
  patternId: string;
  placement: "center";
  styleVersion:
    | "hook-overlay-v1"
    | "hook-overlay-v2"
    | "hook-overlay-v3";
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

export type TrendingFeedItem =
  | TrendingCarouselFeedItem
  | TrendingHookVideoFeedItem
  | TrendingWallTextFeedItem;

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
    (formatOrder.get(first.format) ?? Number.MAX_SAFE_INTEGER) -
      (formatOrder.get(second.format) ?? Number.MAX_SAFE_INTEGER) ||
    first.position - second.position ||
    first.id.localeCompare(second.id)
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
