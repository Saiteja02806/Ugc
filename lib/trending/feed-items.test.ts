import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnifiedTrendingFeed,
  createCarouselTrendingFeedProvider,
  createCurrentTrendingFeedProviders,
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

test("enables Hook videos only for an explicit true server value", () => {
  assert.equal(parseTrendingHookVideosEnabled("true"), true);
  assert.equal(parseTrendingHookVideosEnabled(" TRUE "), true);
  assert.equal(parseTrendingHookVideosEnabled("1"), false);
  assert.equal(parseTrendingHookVideosEnabled("false"), false);
  assert.equal(parseTrendingHookVideosEnabled(undefined), false);
});

test("always hides Hook videos on the real production deployment", () => {
  assert.equal(
    resolveTrendingHookVideosEnabled({
      deploymentEnvironment: "production",
      featureFlag: "true",
      requestUrl: "https://preview.example.com/api/trending/feed",
    }),
    false,
  );
  assert.equal(
    resolveTrendingHookVideosEnabled({
      deploymentEnvironment: "preview",
      featureFlag: "true",
      requestUrl: "https://getugcpilot.com/api/trending/feed",
    }),
    false,
  );
  assert.equal(
    resolveTrendingHookVideosEnabled({
      featureFlag: "true",
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

test("combines preview-ready providers in stable feed order without duplicates", () => {
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
        kind: "hook",
        placement: "center",
        styleVersion: "hook-overlay-v1",
        value: "A business-profile Hook",
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
      durationSeconds: 15,
      previewUrl: "https://cdn.example.com/wall.mp4",
      text: {
        blocks: [
          {
            id: "headline",
            text: "Readable wall-of-text copy",
          },
        ],
        kind: "wall_text",
        layoutVersion: "wall-text-overlay-v1",
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
