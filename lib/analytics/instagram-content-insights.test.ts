import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  aggregateInstagramContentPerformanceByPublishedDate,
  buildInstagramContentPerformanceTrend,
  filterAndSortInstagramContent,
  flattenReadyInstagramContentAccounts,
  groupInstagramContentByPublishedDate,
  getInstagramContentTitle,
  getInstagramInteractionRate,
  mergeInstagramContentItems,
  mergeInstagramContentMetrics,
  normalizeInstagramMedia,
  normalizeInstagramMediaInsights,
  summarizeInstagramContentPerformance,
  type InstagramContentAccount,
  type InstagramContentItem,
} from "./instagram-content-insights.ts";

const instagramContentSource = readFileSync(
  new URL("./instagram-content.ts", import.meta.url),
  "utf8",
);
const analyticsWorkspaceSource = readFileSync(
  new URL(
    "../../components/analytics/instagram-analytics-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

const account = {
  accountName: "North Studio",
  accountUsername: "northstudio",
  connectionId: "connection-1",
};

test("normalizes Instagram media and identifies reels, carousels, and posts", () => {
  const items = normalizeInstagramMedia(
    {
      data: [
        {
          caption: "A Reel hook",
          comments_count: 4,
          id: "reel-1",
          like_count: 18,
          media_product_type: "REELS",
          media_type: "VIDEO",
          permalink: "https://www.instagram.com/reel/example/",
          thumbnail_url: "https://cdn.example.com/reel.jpg",
          timestamp: "2026-07-24T10:00:00+0000",
        },
        {
          caption: "Carousel opener",
          id: "carousel-1",
          media_type: "CAROUSEL_ALBUM",
          media_url: "https://cdn.example.com/carousel.jpg",
          timestamp: "2026-07-23T10:00:00+0000",
        },
        {
          id: "post-1",
          media_type: "IMAGE",
          timestamp: "2026-07-22T10:00:00+0000",
        },
      ],
    },
    account,
  );

  assert.deepEqual(
    items.map((item) => item.contentType),
    ["reel", "carousel", "post"],
  );
  assert.deepEqual(items[0]?.metrics, {
    comments: 4,
    interactions: null,
    likes: 18,
    reach: null,
    saves: null,
    shares: null,
    views: null,
  });
  assert.equal(items[1]?.thumbnailUrl, "https://cdn.example.com/carousel.jpg");
});

test("normalizes media insight values while preserving unavailable metrics", () => {
  const insights = normalizeInstagramMediaInsights({
    data: [
      { name: "views", values: [{ value: "120" }] },
      { name: "reach", total_value: { value: 90 } },
      { name: "total_interactions", values: [{ value: 0 }] },
      { name: "saved", values: [] },
    ],
  });

  assert.deepEqual(insights, {
    interactions: 0,
    reach: 90,
    saves: null,
    shares: null,
    views: 120,
  });
});

test("merges media insights without overwriting real like and comment counts", () => {
  const item = createItem({
    metrics: {
      comments: 7,
      interactions: null,
      likes: 21,
      reach: null,
      saves: null,
      shares: null,
      views: null,
    },
  });

  assert.deepEqual(
    mergeInstagramContentMetrics(item, {
      interactions: 8,
      reach: 80,
      saves: 3,
      shares: 2,
      views: 100,
    }).metrics,
    {
      comments: 7,
      interactions: 8,
      likes: 21,
      reach: 80,
      saves: 3,
      shares: 2,
      views: 100,
    },
  );
});

test("keeps feed media and adds a missing published post only once", () => {
  const feedItem = createItem({
    id: "media-from-feed",
    publishedAt: "2026-08-09T09:00:00.000Z",
  });
  const fetchedPublishedItem = createItem({
    id: "media-from-schedule",
    publishedAt: "2026-08-09T09:03:00.000Z",
  });

  assert.deepEqual(
    mergeInstagramContentItems(
      [feedItem],
      [feedItem, fetchedPublishedItem],
    ).map((item) => item.id),
    ["media-from-schedule", "media-from-feed"],
  );
});

test("does not invent empty rows when Meta cannot return a saved post", () => {
  assert.doesNotMatch(instagramContentSource, /unavailable:/);
  assert.doesNotMatch(
    instagramContentSource,
    /createUnavailablePublishedInstagramItem/,
  );
  assert.match(
    instagramContentSource,
    /mergeInstagramContentItems\(params\.feedItems, availableItems\)/,
  );
});

test("shows visible-post totals in a real publish-date chart", () => {
  assert.match(analyticsWorkspaceSource, /label="Post views"/);
  assert.match(
    analyticsWorkspaceSource,
    /buildInstagramContentPerformanceTrend\(/,
  );
  assert.match(analyticsWorkspaceSource, /groupedByPublishDate/);
  assert.match(
    analyticsWorkspaceSource,
    /Deleted or\s+unavailable posts are not counted/,
  );
  assert.doesNotMatch(
    analyticsWorkspaceSource,
    /InstagramPerformancePeriodTotal/,
  );
});

test("summarizes only content returned by ready Instagram accounts", () => {
  const readyItems = [
    createItem({
      id: "visible-reel",
      metrics: {
        ...emptyMetrics(),
        interactions: 2,
        reach: 122,
        views: 165,
      },
    }),
    createItem({
      id: "visible-new-reel",
      metrics: {
        ...emptyMetrics(),
        interactions: 0,
        reach: 1,
        views: 3,
      },
    }),
  ];
  const accounts: InstagramContentAccount[] = [
    {
      ...account,
      items: readyItems,
      lastSyncedAt: "2026-08-09T00:00:00.000Z",
      message: null,
      status: "ready",
    },
    {
      ...account,
      connectionId: "unavailable-account",
      items: [
        createItem({
          id: "must-not-count",
          metrics: { ...emptyMetrics(), views: 999 },
        }),
      ],
      lastSyncedAt: null,
      message: "Unavailable",
      status: "error",
    },
  ];

  assert.deepEqual(summarizeInstagramContentPerformance(accounts), {
    interactions: 2,
    posts: 2,
    reach: 123,
    views: 168,
  });
});

test("builds the visible-content graph using the viewer's publish date", () => {
  const accounts: InstagramContentAccount[] = [
    {
      ...account,
      items: [
        createItem({
          id: "after-local-midnight",
          metrics: {
            ...emptyMetrics(),
            interactions: 0,
            reach: 1,
            views: 3,
          },
          publishedAt: "2026-08-08T19:57:20.000Z",
        }),
      ],
      lastSyncedAt: "2026-08-09T00:00:00.000Z",
      message: null,
      status: "ready",
    },
  ];

  assert.deepEqual(
    buildInstagramContentPerformanceTrend({
      accounts,
      dateKeys: ["2026-08-08", "2026-08-09"],
      getPublishedDateKey: () => "2026-08-09",
    }),
    [
      {
        date: "2026-08-08",
        interactions: null,
        reach: null,
        views: null,
      },
      {
        date: "2026-08-09",
        interactions: 0,
        reach: 1,
        views: 3,
      },
    ],
  );
});

test("filters content and sorts unavailable metrics last", () => {
  const items = [
    createItem({
      contentType: "reel",
      id: "reel-null",
      metrics: { ...emptyMetrics(), views: null },
      publishedAt: "2026-07-26T10:00:00.000Z",
    }),
    createItem({
      contentType: "reel",
      id: "reel-high",
      metrics: { ...emptyMetrics(), views: 90 },
      publishedAt: "2026-07-24T10:00:00.000Z",
    }),
    createItem({
      contentType: "carousel",
      id: "carousel",
      metrics: { ...emptyMetrics(), views: 200 },
      publishedAt: "2026-07-25T10:00:00.000Z",
    }),
    createItem({
      contentType: "reel",
      id: "reel-low",
      metrics: { ...emptyMetrics(), views: 10 },
      publishedAt: "2026-07-25T10:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    filterAndSortInstagramContent({
      filter: "reel",
      items,
      sort: "views",
    }).map((item) => item.id),
    ["reel-high", "reel-low", "reel-null"],
  );
});

test("flattens only ready accounts for multi-account workspaces", () => {
  const accounts: InstagramContentAccount[] = [
    {
      ...account,
      items: [createItem({ id: "ready-1" })],
      lastSyncedAt: "2026-07-26T12:00:00.000Z",
      message: null,
      status: "ready",
    },
    {
      accountName: "South Studio",
      accountUsername: "southstudio",
      connectionId: "connection-2",
      items: [createItem({ id: "hidden-1" })],
      lastSyncedAt: null,
      message: "Reconnect Instagram.",
      status: "permission_missing",
    },
  ];

  assert.deepEqual(
    flattenReadyInstagramContentAccounts(accounts).map((item) => item.id),
    ["ready-1"],
  );
});

test("groups real content performance by publish date", () => {
  const accounts: InstagramContentAccount[] = [
    {
      ...account,
      items: [
        createItem({
          id: "first",
          metrics: {
            ...emptyMetrics(),
            interactions: 3,
            reach: 20,
            views: 30,
          },
          publishedAt: "2026-07-25T10:00:00.000Z",
        }),
        createItem({
          id: "second",
          metrics: {
            ...emptyMetrics(),
            interactions: 2,
            reach: null,
            views: 12,
          },
          publishedAt: "2026-07-25T18:00:00.000Z",
        }),
        createItem({
          id: "third",
          metrics: {
            ...emptyMetrics(),
            interactions: 1,
            reach: 8,
            views: null,
          },
          publishedAt: "2026-07-26T10:00:00.000Z",
        }),
      ],
      lastSyncedAt: "2026-07-26T12:00:00.000Z",
      message: null,
      status: "ready",
    },
  ];

  assert.deepEqual(
    aggregateInstagramContentPerformanceByPublishedDate(accounts),
    [
      {
        date: "2026-07-25",
        interactions: 5,
        reach: 20,
        views: 42,
      },
      {
        date: "2026-07-26",
        interactions: 1,
        reach: 8,
        views: null,
      },
    ],
  );
});

test("groups exact content records by publish date for graph markers", () => {
  const accounts: InstagramContentAccount[] = [
    {
      ...account,
      items: [
        createItem({
          id: "morning",
          publishedAt: "2026-07-25T08:00:00.000Z",
        }),
        createItem({
          id: "evening",
          publishedAt: "2026-07-25T18:00:00.000Z",
        }),
        createItem({
          id: "next-day",
          publishedAt: "2026-07-26T10:00:00.000Z",
        }),
      ],
      lastSyncedAt: "2026-07-26T12:00:00.000Z",
      message: null,
      status: "ready",
    },
    {
      accountName: "South Studio",
      accountUsername: "southstudio",
      connectionId: "connection-2",
      items: [
        createItem({
          connectionId: "connection-2",
          id: "not-ready",
          publishedAt: "2026-07-25T20:00:00.000Z",
        }),
      ],
      lastSyncedAt: null,
      message: "Reconnect Instagram.",
      status: "permission_missing",
    },
  ];

  assert.deepEqual(
    groupInstagramContentByPublishedDate(accounts).map((group) => ({
      date: group.date,
      ids: group.items.map((item) => item.id),
    })),
    [
      { date: "2026-07-25", ids: ["evening", "morning"] },
      { date: "2026-07-26", ids: ["next-day"] },
    ],
  );
});

test("calculates interaction rate only when the denominator is available", () => {
  assert.equal(
    getInstagramInteractionRate({
      ...emptyMetrics(),
      interactions: 20,
      reach: 80,
    }),
    25,
  );
  assert.equal(
    getInstagramInteractionRate({
      ...emptyMetrics(),
      interactions: 0,
      reach: 0,
    }),
    null,
  );
  assert.equal(
    getInstagramInteractionRate({
      ...emptyMetrics(),
      interactions: null,
      reach: 80,
    }),
    null,
  );
});

test("uses the first caption line as the content title", () => {
  assert.equal(
    getInstagramContentTitle(
      createItem({ caption: "The hook line\nMore caption detail" }),
    ),
    "The hook line",
  );
  assert.equal(
    getInstagramContentTitle(
      createItem({ caption: null, contentType: "carousel" }),
    ),
    "Instagram carousel",
  );
});

function createItem(
  overrides: Partial<InstagramContentItem> = {},
): InstagramContentItem {
  return {
    ...account,
    caption: "Default caption",
    contentType: "post",
    id: "post-1",
    mediaType: "IMAGE",
    metrics: emptyMetrics(),
    permalink: "https://www.instagram.com/p/example/",
    publishedAt: "2026-07-26T10:00:00.000Z",
    thumbnailUrl: null,
    ...overrides,
  };
}

function emptyMetrics() {
  return {
    comments: null,
    interactions: null,
    likes: null,
    reach: null,
    saves: null,
    shares: null,
    views: null,
  };
}
