import assert from "node:assert/strict";
import test from "node:test";

import {
  CAROUSEL_FORMAT_MULTIPLIER_MAX,
  deriveCarouselPerformanceSignals,
  getInstagramCarouselPerformanceObservations,
  type CarouselPerformanceAggregate,
} from "./performance-logic.ts";

test("extracts only real Instagram carousel observations", () => {
  const observations = getInstagramCarouselPerformanceObservations([
    {
      accountName: "Account",
      accountUsername: "account",
      connectionId: "connection-1",
      items: [
        {
          accountName: "Account",
          accountUsername: "account",
          caption: null,
          connectionId: "connection-1",
          contentType: "carousel",
          id: "carousel-1",
          mediaType: "CAROUSEL_ALBUM",
          metrics: {
            comments: 4,
            interactions: 20,
            likes: 12,
            reach: 800,
            saves: 7,
            shares: 3,
            views: 1_000,
          },
          permalink: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          thumbnailUrl: null,
        },
        {
          accountName: "Account",
          accountUsername: "account",
          caption: null,
          connectionId: "connection-1",
          contentType: "reel",
          id: "reel-1",
          mediaType: "VIDEO",
          metrics: {
            comments: 2,
            interactions: 10,
            likes: 8,
            reach: 600,
            saves: 2,
            shares: 2,
            views: 900,
          },
          permalink: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          thumbnailUrl: null,
        },
      ],
      lastSyncedAt: "2026-08-08T00:15:00.000Z",
      message: null,
      status: "ready",
    },
  ]);

  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0], {
    observedAt: "2026-08-08T00:15:00.000Z",
    platform: "instagram",
    platformPostId: "carousel-1",
    publishedAt: "2026-08-01T00:00:00.000Z",
    socialConnectionId: "connection-1",
    viewCount: 1_000,
  });
});

test("waits for four evaluated posts and at least two comparable formats", () => {
  assert.deepEqual(
    deriveCarouselPerformanceSignals([
      aggregate({
        contentFormatId: "list",
        evaluatedPostCount: 3,
        medianViewCount: 3_000,
      }),
      aggregate({
        contentFormatId: "comparison",
        evaluatedPostCount: 4,
        medianViewCount: 2_000,
      }),
    ]),
    {},
  );
});

test("boosts every consistent performer without creating one winner", () => {
  const signals = deriveCarouselPerformanceSignals([
    aggregate({
      averageViewCount: 3_000,
      contentFormatId: "list",
      medianViewCount: 3_000,
      viewStandardDeviation: 120,
    }),
    aggregate({
      averageViewCount: 2_000,
      contentFormatId: "comparison",
      medianViewCount: 2_000,
      viewStandardDeviation: 90,
    }),
    aggregate({
      averageViewCount: 1_000,
      contentFormatId: "checklist",
      medianViewCount: 1_000,
      viewStandardDeviation: 60,
    }),
  ]);

  const formatMultipliers = signals.formatMultipliers ?? {};
  assert.ok((formatMultipliers.list ?? 0) > 1);
  assert.ok((formatMultipliers.comparison ?? 0) > 1);
  assert.ok(
    (formatMultipliers.list ?? 0) > (formatMultipliers.comparison ?? 0),
  );
  assert.ok(
    (formatMultipliers.list ?? 0) <= CAROUSEL_FORMAT_MULTIPLIER_MAX,
  );
});

test("a viral outlier does not overpower a consistently strong format", () => {
  const signals = deriveCarouselPerformanceSignals([
    aggregate({
      averageViewCount: 1_250,
      contentFormatId: "mistakes",
      medianViewCount: 1_000,
      viewStandardDeviation: 1_200,
    }),
    aggregate({
      averageViewCount: 1_050,
      contentFormatId: "how_to",
      medianViewCount: 1_050,
      viewStandardDeviation: 80,
    }),
  ]);

  assert.ok(
    (signals.formatMultipliers?.how_to ?? 0) >
      (signals.formatMultipliers?.mistakes ?? 0),
  );
});

test("hook families are compared only inside the same format", () => {
  const signals = deriveCarouselPerformanceSignals([
    aggregate({ contentFormatId: "comparison", medianViewCount: 2_000 }),
    aggregate({ contentFormatId: "list", medianViewCount: 1_000 }),
    aggregate({
      averageViewCount: 2_500,
      contentFormatId: "comparison",
      hookFamilyId: "comparison",
      medianViewCount: 2_500,
      scope: "format_hook",
    }),
    aggregate({
      averageViewCount: 1_500,
      contentFormatId: "comparison",
      hookFamilyId: "question",
      medianViewCount: 1_500,
      scope: "format_hook",
    }),
  ]);

  const comparisonHooks =
    signals.hookFamilyMultipliers?.comparison ?? {};
  assert.ok((comparisonHooks.comparison ?? 0) > 1);
  assert.ok(
    (comparisonHooks.comparison ?? 0) > (comparisonHooks.question ?? 0),
  );
});

function aggregate(
  overrides: Partial<CarouselPerformanceAggregate>,
): CarouselPerformanceAggregate {
  return {
    averageViewCount: 1_000,
    baselineMedianViewCount: 1_000,
    contentFormatId: "list",
    evaluatedPostCount: 4,
    hookFamilyId: null,
    medianViewCount: 1_000,
    scope: "format",
    viewStandardDeviation: 50,
    ...overrides,
  };
}
