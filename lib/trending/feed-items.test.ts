import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnifiedTrendingFeed,
  createCarouselTrendingFeedProvider,
  createCurrentTrendingFeedProviders,
  excludeDecidedTrendingFeedItems,
  excludeDismissedTrendingFeedItems,
  getTrendingFeedActiveItemIndex,
  getTrendingFeedProviderAvailability,
  isPreviewReadyCarousel,
  type TrendingCarouselSourceRecord,
  type TrendingFeedProviderResult,
  type TrendingHookVideoFeedItem,
  type TrendingWallTextFeedItem,
} from "./feed-items.ts";
import {
  parseTrendingHookVideosEnabled,
  resolveTrendingHookVideosEnabled,
} from "./hook-video-feature.ts";

test("keeps the next active creative stable when a decided item disappears during refresh", () => {
  const beforeDecision = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const refreshedAfterDecidingA = [{ id: "b" }, { id: "c" }];
  const optimisticallyVisible = excludeDismissedTrendingFeedItems(
    beforeDecision,
    new Set(["a"]),
    (item) => item.id,
  );

  assert.deepEqual(optimisticallyVisible, refreshedAfterDecidingA);
  assert.equal(
    getTrendingFeedActiveItemIndex(beforeDecision, "b", (item) => item.id),
    1,
  );
  assert.equal(
    getTrendingFeedActiveItemIndex(
      refreshedAfterDecidingA,
      "b",
      (item) => item.id,
    ),
    0,
  );
  assert.equal(
    getTrendingFeedActiveItemIndex(
      refreshedAfterDecidingA,
      "missing",
      (item) => item.id,
    ),
    0,
  );
});

test("keeps decided cards out of the parent feed when the swipe deck is replaced", () => {
  const feedBeforeOpeningHookComposer = [
    { assignmentId: "assignment-1", id: "item-1" },
    { assignmentId: "assignment-2", id: "item-2" },
    { assignmentId: "assignment-3", id: "item-3" },
  ];

  const feedAfterReturningFromHookComposer = excludeDecidedTrendingFeedItems(
    feedBeforeOpeningHookComposer,
    new Set(["assignment-1", "assignment-2"]),
    (item) => item.assignmentId,
  );

  assert.deepEqual(
    feedAfterReturningFromHookComposer.map((item) => item.id),
    ["item-3"],
  );
});

const carouselSource = {
  assignmentId: "assignment-1",
  candidateIndex: 0,
  carouselId: "carousel-1",
  categorySlug: "marketing-saas",
  feedItemId: "feed-item-1",
  feedPosition: 2,
  feedSource: "new",
  generationBatchId: "batch-1",
  projectId: "project-1",
  readySlideCount: 1,
  selectedAngle: "A clear angle",
  slideCount: 1,
  slides: [
    {
      headline: "A useful headline",
      renderedUrl: "https://cdn.example.com/slide.webp",
      slideNumber: 1,
      slideType: "hook",
      status: "ready",
      subtext: null,
    },
  ],
  status: "completed",
  thumbnailUrl: "https://cdn.example.com/thumb.webp",
  updatedAt: "2026-07-25T00:00:00.000Z",
} satisfies TrendingCarouselSourceRecord;

test("maps a ready Carousel source record into the unified feed contract", () => {
  const provider = createCarouselTrendingFeedProvider([carouselSource]);

  assert.equal(provider.format, "carousel");
  assert.equal(provider.state, "ready");
  assert.deepEqual(provider.items, [
    {
      assignmentId: "assignment-1",
      creative: {
        candidateIndex: 0,
        carouselId: "carousel-1",
        categorySlug: "marketing-saas",
        generationBatchId: "batch-1",
        projectId: "project-1",
        readySlideCount: 1,
        selectedAngle: "A clear angle",
        slideCount: 1,
        slides: carouselSource.slides,
        status: "completed",
        thumbnailUrl: "https://cdn.example.com/thumb.webp",
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
      creativeId: "carousel-1",
      feedItemId: "feed-item-1",
      format: "carousel",
      id: "carousel:feed-item-1",
      position: 2,
      readiness: "preview_ready",
      source: "new",
    },
  ]);
});

test("does not expose an unfinished Carousel as a preview-ready feed item", () => {
  const processingCarousel = {
    ...carouselSource,
    carouselId: "carousel-processing",
    readySlideCount: 0,
    slides: carouselSource.slides.map((slide) => ({
      ...slide,
      renderedUrl: null,
      status: "processing" as const,
    })),
    status: "processing" as const,
  };

  assert.equal(isPreviewReadyCarousel(processingCarousel), false);
  assert.deepEqual(
    createCarouselTrendingFeedProvider([processingCarousel]).items,
    [],
  );
});

test("keeps incomplete format providers out of the current unified feed", () => {
  const providers = createCurrentTrendingFeedProviders([carouselSource]);
  const items = buildUnifiedTrendingFeed(providers);
  const availability = getTrendingFeedProviderAvailability(providers);

  assert.deepEqual(items.map((item) => item.format), ["carousel"]);
  assert.deepEqual(
    availability.map(({ format, state }) => ({ format, state })),
    [
      { format: "carousel", state: "ready" },
      { format: "hook_video", state: "unavailable" },
      { format: "wall_text", state: "unavailable" },
    ],
  );
});

test("omits the Hook provider when the server feature is disabled", () => {
  const providers = createCurrentTrendingFeedProviders(
    [carouselSource],
    undefined,
    undefined,
    { includeHookVideos: false },
  );

  assert.deepEqual(
    getTrendingFeedProviderAvailability(providers).map(
      ({ format, state }) => ({ format, state }),
    ),
    [
      { format: "carousel", state: "ready" },
      { format: "wall_text", state: "unavailable" },
    ],
  );
});

test("enables Hook videos by default and preserves an explicit kill switch", () => {
  assert.equal(parseTrendingHookVideosEnabled("true"), true);
  assert.equal(parseTrendingHookVideosEnabled(" TRUE "), true);
  assert.equal(parseTrendingHookVideosEnabled("1"), true);
  assert.equal(parseTrendingHookVideosEnabled("false"), false);
  assert.equal(parseTrendingHookVideosEnabled(undefined), true);
});

test("allows the explicit Hook flag to control production safely", () => {
  assert.equal(
    resolveTrendingHookVideosEnabled({
      deploymentEnvironment: "production",
      featureFlag: "true",
      requestUrl: "https://preview.example.com/api/trending/feed",
    }),
    true,
  );
  assert.equal(
    resolveTrendingHookVideosEnabled({
      deploymentEnvironment: "preview",
      featureFlag: "true",
      requestUrl: "https://getugcpilot.com/api/trending/feed",
    }),
    true,
  );
  assert.equal(
    resolveTrendingHookVideosEnabled({
      featureFlag: "false",
      requestUrl: "https://www.getugcpilot.com/api/trending/feed",
    }),
    false,
  );
});

test("allows explicitly enabled Hook videos on localhost for testing", () => {
  assert.equal(
    resolveTrendingHookVideosEnabled({
      deploymentEnvironment: "development",
      featureFlag: "true",
      requestUrl: "http://127.0.0.1:4173/api/trending/feed",
    }),
    true,
  );
  assert.equal(
    resolveTrendingHookVideosEnabled({
      featureFlag: "false",
      requestUrl: "http://localhost:4173/api/trending/feed",
    }),
    false,
  );
});

test("orders preview-ready items by persisted feed position without duplicates", () => {
  const hookItem = {
    assignmentId: "assignment-hook",
    creative: {
      aspectRatio: "9:16",
      durationSeconds: 8,
      influencerId: "influencer-1",
      influencerName: "Ava",
      previewSessionEndpoint:
        "/api/trending/hook-videos/videos/hook-1/preview-session",
      sourceDurationSeconds: 8,
      sourceKind: "catalog",
      text: {
        fontSize: 52,
        hookTextFormatId: null,
        kind: "hook",
        lines: ["A business-profile Hook"],
        patternId: "direct_capability",
        placement: "catalog",
        position: { x: 0.5, y: 0.15 },
        styleVersion: "hook-overlay-v1",
        value: "A business-profile Hook",
        writingFormatId: "direct_capability",
      },
      thumbnailUrl: null,
      title: "Hook creative",
      trimEnd: null,
      trimStart: 0,
      videoId: "hook-1",
    },
    creativeId: "hook-1",
    feedItemId: "feed-hook",
    format: "hook_video",
    id: "hook_video:feed-hook",
    position: 1,
    readiness: "preview_ready",
    source: "new",
  } satisfies TrendingHookVideoFeedItem;
  const wallTextItem = {
    assignmentId: "assignment-wall",
    creative: {
      aspectRatio: "9:16",
      audio: {
        assetDurationSeconds: 12.5,
        assetId: "audio_001_segment_01",
        audioUrl: "https://cdn.example.com/wall-audio.mp3",
        cueStartSeconds: 0,
        fadeOutSeconds: 0.2,
        fitMode: "trim",
        matchingVersion: "wall-audio-match-v1",
        outputDurationSeconds: 6.016,
        selectionId: "selection-wall-1",
      },
      durationSeconds: 6.016,
      layout: {
        alignment: "center",
        placement: "upper-middle",
        placementSource: "face-analysis",
        safeArea: {
          bottom: 460 / 1920,
          left: 120 / 1080,
          right: 200 / 1080,
          top: 280 / 1920,
        },
        textBox: {
          height: 480 / 1920,
          width: 620 / 1080,
          x: 230 / 1080,
          y: 560 / 1920,
        },
        version: "wall-text-layout-v4",
      },
      previewUrl: "https://cdn.example.com/wall.mp4",
      text: {
        fullText:
          "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
        kind: "wall_text",
        layoutVersion: "wall-text-overlay-v4",
        pattern: "situation_discovery",
        segments: [
          {
            lines: ["I logged every meal"],
            role: "lead",
          },
          {
            lines: ["but skipped drinks", "oil and small bites."],
            role: "support",
          },
          {
            lines: ["Those missing details", "quietly changed", "the final total."],
            role: "closing",
          },
        ],
      },
      thumbnailUrl: null,
      title: "Wall-of-text creative",
    },
    creativeId: "wall-1",
    feedItemId: "feed-wall",
    format: "wall_text",
    id: "wall_text:feed-wall",
    position: 3,
    readiness: "preview_ready",
    source: "carried",
  } satisfies TrendingWallTextFeedItem;
  const providers: TrendingFeedProviderResult[] = [
    createCarouselTrendingFeedProvider([carouselSource]),
    {
      format: "hook_video",
      items: [hookItem, hookItem],
      state: "ready",
    },
    {
      format: "wall_text",
      items: [wallTextItem],
      state: "ready",
    },
  ];

  assert.deepEqual(
    buildUnifiedTrendingFeed(providers).map((item) => item.id),
    ["hook_video:feed-hook", "carousel:feed-item-1", "wall_text:feed-wall"],
  );
});

test("keeps each format in its own persisted position order", () => {
  const laterCarousel = {
    ...carouselSource,
    assignmentId: "assignment-2",
    carouselId: "carousel-2",
    feedItemId: "feed-item-2",
    feedPosition: 9,
  } satisfies TrendingCarouselSourceRecord;
  const earlierCarousel = {
    ...carouselSource,
    assignmentId: "assignment-3",
    carouselId: "carousel-3",
    feedItemId: "feed-item-3",
    feedPosition: 1,
  } satisfies TrendingCarouselSourceRecord;

  assert.deepEqual(
    buildUnifiedTrendingFeed([
      createCarouselTrendingFeedProvider([laterCarousel, earlierCarousel]),
    ]).map((item) => item.id),
    ["carousel:feed-item-3", "carousel:feed-item-2"],
  );
});
