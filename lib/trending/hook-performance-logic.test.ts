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

test("learning waits for enough attributed posts and never turns missing data into a preference", () => {
  assert.deepEqual(
    deriveHookPerformanceSignals([
      {
        attributedSalesAmount: null,
        attributedSalesCurrency: null,
        averageWatchTimeSeconds: null,
        campaignPurpose: "product_discovery",
        completionRate: null,
        conversionCount: null,
        observedPostCount: 2,
        patternId: "direct_capability",
        saveCount: null,
        shareCount: null,
        viewCount: null,
      },
      {
        attributedSalesAmount: null,
        attributedSalesCurrency: null,
        averageWatchTimeSeconds: null,
        campaignPurpose: "education",
        completionRate: null,
        conversionCount: null,
        observedPostCount: 4,
        patternId: "problem_observation",
        saveCount: null,
        shareCount: null,
        viewCount: null,
      },
    ]),
    {},
  );
});

test("learning prefers only patterns supported by real comparable outcomes", () => {
  const signals = deriveHookPerformanceSignals([
    {
      attributedSalesAmount: 120,
      attributedSalesCurrency: "USD",
      averageWatchTimeSeconds: 2.7,
      campaignPurpose: "product_discovery",
      completionRate: 0.8,
      conversionCount: 5,
      observedPostCount: 3,
      patternId: "direct_capability",
      saveCount: 12,
      shareCount: 20,
      viewCount: 100,
    },
    {
      attributedSalesAmount: 10,
      attributedSalesCurrency: "USD",
      averageWatchTimeSeconds: 1.1,
      campaignPurpose: "education",
      completionRate: 0.2,
      conversionCount: 0,
      observedPostCount: 3,
      patternId: "problem_observation",
      saveCount: 1,
      shareCount: 2,
      viewCount: 100,
    },
  ]);

  assert.deepEqual(signals.preferredPatternIds, ["direct_capability"]);
  assert.deepEqual(signals.preferredPurposes, ["product_discovery"]);
});

test("learning ignores sales amounts when attribution uses different currencies", () => {
  const signals = deriveHookPerformanceSignals([
    {
      attributedSalesAmount: 1000,
      attributedSalesCurrency: "USD",
      averageWatchTimeSeconds: null,
      campaignPurpose: "product_discovery",
      completionRate: null,
      conversionCount: null,
      observedPostCount: 3,
      patternId: "direct_capability",
      saveCount: null,
      shareCount: null,
      viewCount: 100,
    },
    {
      attributedSalesAmount: 1,
      attributedSalesCurrency: "EUR",
      averageWatchTimeSeconds: null,
      campaignPurpose: "education",
      completionRate: null,
      conversionCount: null,
      observedPostCount: 3,
      patternId: "problem_observation",
      saveCount: null,
      shareCount: null,
      viewCount: 100,
    },
  ]);

  assert.deepEqual(signals, {});
});
