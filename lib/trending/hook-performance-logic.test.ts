import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveHookPerformanceSignals,
  getInstagramHookPerformanceObservations,
  getTikTokHookPerformanceObservations,
} from "./hook-performance-logic.ts";

test("Instagram Hook observations preserve real metrics and leave unavailable outcomes empty", () => {
  const observations = getInstagramHookPerformanceObservations([
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
          contentType: "reel",
          id: "media-1",
          mediaType: "VIDEO",
          metrics: {
            comments: 3,
            interactions: 15,
            likes: 10,
            reach: 90,
            saves: 2,
            shares: 4,
            views: 100,
          },
          permalink: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          thumbnailUrl: null,
        },
      ],
      lastSyncedAt: "2026-08-03T10:00:00.000Z",
      message: null,
      status: "ready",
    },
  ]);

  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.shareCount, 4);
  assert.equal(observations[0]?.viewCount, 100);
  assert.equal(observations[0]?.watchTimeSeconds, null);
  assert.equal(observations[0]?.completionRate, null);
  assert.equal(observations[0]?.conversionCount, null);
  assert.equal(observations[0]?.attributedSalesAmount, null);
});

test("TikTok Hook observations do not manufacture watch or sales data", () => {
  const observations = getTikTokHookPerformanceObservations([
    {
      accountName: null,
      accountUsername: null,
      connectionId: "connection-2",
      lastSyncedAt: "2026-08-03T10:00:00.000Z",
      message: null,
      status: "ready",
      videos: [
        {
          commentCount: 1,
          coverImageUrl: null,
          createdAt: null,
          description: null,
          id: "video-1",
          likeCount: 5,
          shareCount: 2,
          shareUrl: null,
          title: null,
          viewCount: 50,
        },
      ],
    },
  ]);

  assert.deepEqual(
    {
      completionRate: observations[0]?.completionRate,
      conversions: observations[0]?.conversionCount,
      sales: observations[0]?.attributedSalesAmount,
      shares: observations[0]?.shareCount,
      watchTime: observations[0]?.watchTimeSeconds,
    },
    {
      completionRate: null,
      conversions: null,
      sales: null,
      shares: 2,
      watchTime: null,
    },
  );
});

test("unavailable accounts are not treated as performance evidence", () => {
  assert.deepEqual(
    getInstagramHookPerformanceObservations([
      {
        accountName: null,
        accountUsername: null,
        connectionId: "connection-3",
        items: [],
        lastSyncedAt: null,
        message: "Reconnect",
        status: "permission_missing",
      },
    ]),
    [],
  );
});

test("one strong Instagram-view result gets only a modest temporary validation boost", () => {
  const signals = deriveHookPerformanceSignals([
    {
      campaignPurpose: "product_discovery",
      hookTextFormatId: "GF_001",
      lastGeneratedAt: "2026-08-12T00:00:00.000Z",
      medianViews: 2_000,
      publishedResultCount: 1,
      recentViewCounts: [2_000],
      timesGenerated: 1,
    },
    {
      campaignPurpose: "education",
      hookTextFormatId: "GF_002",
      lastGeneratedAt: "2026-08-11T00:00:00.000Z",
      medianViews: 1_000,
      publishedResultCount: 1,
      recentViewCounts: [1_000],
      timesGenerated: 1,
    },
  ]);
  const strong = signals.formatSignals?.find(
    (signal) => signal.formatId === "GF_001",
  );

  assert.equal(strong?.temporaryBoost, 0.08);
  assert.equal(strong?.selectionWeight, 1);
});

test("repeated results create a gradual durable weight and use the median over one spike", () => {
  const signals = deriveHookPerformanceSignals([
    {
      campaignPurpose: "product_discovery",
      hookTextFormatId: "GF_001",
      lastGeneratedAt: null,
      medianViews: 3_000,
      publishedResultCount: 5,
      recentViewCounts: [2_800, 3_000, 3_100, 2_950, 3_200],
      timesGenerated: 6,
    },
    {
      campaignPurpose: "education",
      hookTextFormatId: "GF_003",
      lastGeneratedAt: null,
      medianViews: 1_050,
      publishedResultCount: 4,
      recentViewCounts: [900, 1_000, 1_100, 3_000],
      timesGenerated: 4,
    },
  ]);
  const consistent = signals.formatSignals?.find(
    (signal) => signal.formatId === "GF_001",
  );
  const spike = signals.formatSignals?.find(
    (signal) => signal.formatId === "GF_003",
  );

  assert.ok((consistent?.selectionWeight ?? 0) > 1);
  assert.equal(consistent?.temporaryBoost, 0);
  assert.ok(
    (consistent?.selectionWeight ?? 0) >
      (spike?.selectionWeight ?? 0),
  );
  assert.ok((consistent?.selectionWeight ?? 0) <= 1.3);
  assert.ok((spike?.selectionWeight ?? 0) >= 0.8);
});

test("uses the bounded database learning scores when the RPC returns them", () => {
  const signals = deriveHookPerformanceSignals([
    {
      campaignPurpose: "product_discovery",
      hookTextFormatId: "GF_006",
      lastGeneratedAt: null,
      medianViews: 2_000,
      publishedResultCount: 1,
      recentViewCounts: [2_000],
      selectionWeight: 1.04,
      temporaryBoost: 0.08,
      timesGenerated: 2,
    },
  ]);

  assert.deepEqual(signals.formatSignals?.[0], {
    formatId: "GF_006",
    lastGeneratedAt: null,
    publishedResultCount: 1,
    selectionWeight: 1.04,
    temporaryBoost: 0.08,
    timesGenerated: 2,
  });
});

test("invalid and historical pattern IDs do not enter Global-format learning", () => {
  assert.deepEqual(
    deriveHookPerformanceSignals([
      {
        campaignPurpose: "product_discovery",
        hookTextFormatId: "direct_capability",
        lastGeneratedAt: null,
        medianViews: 99_999,
        publishedResultCount: 10,
        recentViewCounts: [99_999],
        timesGenerated: 10,
      },
    ]),
    { formatSignals: [] },
  );
});
