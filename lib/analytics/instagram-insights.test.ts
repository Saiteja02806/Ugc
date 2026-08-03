import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateInstagramInsightDaily,
  getUniqueInstagramConnections,
  normalizeInstagramAccountInsights,
  type InstagramInsightsAccount,
} from "./instagram-insights.ts";

test("keeps only the newest row for each Instagram account", () => {
  const connections = getUniqueInstagramConnections([
    {
      id: "instagram-new",
      platform: "instagram",
      platformAccountId: "account-1",
    },
    {
      id: "youtube-row",
      platform: "youtube",
      platformAccountId: "channel-1",
    },
    {
      id: "instagram-old",
      platform: "instagram",
      platformAccountId: "account-1",
    },
    {
      id: "instagram-second-account",
      platform: "instagram",
      platformAccountId: "account-2",
    },
  ]);

  assert.deepEqual(
    connections.map((connection) => connection.id),
    ["instagram-new", "instagram-second-account"],
  );
});

test("normalizes real daily Instagram insight values and totals", () => {
  const result = normalizeInstagramAccountInsights({
    data: [
      {
        name: "views",
        values: [
          { end_time: "2026-07-25T08:00:00+0000", value: 12 },
          { end_time: "2026-07-26T08:00:00+0000", value: "18" },
        ],
      },
      {
        name: "total_interactions",
        values: [
          { end_time: "2026-07-25T08:00:00+0000", value: 3 },
          { end_time: "2026-07-26T08:00:00+0000", value: 5 },
        ],
      },
      {
        name: "reach",
        values: [
          { end_time: "2026-07-25T08:00:00+0000", value: 9 },
          { end_time: "2026-07-26T08:00:00+0000", value: 14 },
        ],
      },
    ],
  });

  assert.deepEqual(result.totals, {
    interactions: 8,
    reach: 23,
    views: 30,
  });
  assert.deepEqual(result.daily, [
    {
      date: "2026-07-25",
      interactions: 3,
      reach: 9,
      views: 12,
    },
    {
      date: "2026-07-26",
      interactions: 5,
      reach: 14,
      views: 18,
    },
  ]);
});

test("keeps unavailable Instagram metrics null instead of inventing zero", () => {
  const result = normalizeInstagramAccountInsights({
    data: [
      {
        name: "views",
        values: [],
      },
      {
        name: "reach",
        total_value: { value: 0 },
      },
    ],
  });

  assert.deepEqual(result.totals, {
    interactions: null,
    reach: 0,
    views: null,
  });
  assert.deepEqual(result.daily, []);
});

test("combines Meta time-series points with authoritative period totals", () => {
  const result = normalizeInstagramAccountInsights([
    {
      data: [
        {
          name: "reach",
          values: [
            { end_time: "2026-07-25T08:00:00+0000", value: 9 },
            { end_time: "2026-07-26T08:00:00+0000", value: 14 },
          ],
        },
      ],
    },
    {
      data: [
        { name: "views", total_value: { value: 30 } },
        { name: "total_interactions", total_value: { value: 8 } },
        { name: "reach", total_value: { value: 18 } },
      ],
    },
  ]);

  assert.deepEqual(result.totals, {
    interactions: 8,
    reach: 18,
    views: 30,
  });
  assert.deepEqual(result.daily, [
    {
      date: "2026-07-25",
      interactions: null,
      reach: 9,
      views: null,
    },
    {
      date: "2026-07-26",
      interactions: null,
      reach: 14,
      views: null,
    },
  ]);
});

test("ignores malformed or negative provider values", () => {
  const result = normalizeInstagramAccountInsights({
    data: [
      {
        name: "views",
        values: [
          { end_time: "not-a-date", value: 11 },
          { end_time: "2026-07-26T08:00:00+0000", value: -2 },
        ],
      },
    ],
  });

  assert.deepEqual(result.totals, {
    interactions: null,
    reach: null,
    views: null,
  });
  assert.deepEqual(result.daily, []);
});

test("aggregates daily values without inventing missing metrics", () => {
  const accounts: InstagramInsightsAccount[] = [
    {
      accountName: "North",
      accountUsername: "north",
      connectionId: "north",
      daily: [
        {
          date: "2026-07-25",
          interactions: 0,
          reach: null,
          views: 12,
        },
        {
          date: "2026-07-26",
          interactions: 3,
          reach: 8,
          views: null,
        },
      ],
      lastSyncedAt: "2026-07-26T12:00:00.000Z",
      message: null,
      status: "ready",
      totals: {
        interactions: 3,
        reach: 8,
        views: 12,
      },
    },
    {
      accountName: "South",
      accountUsername: "south",
      connectionId: "south",
      daily: [
        {
          date: "2026-07-25",
          interactions: 2,
          reach: null,
          views: 7,
        },
        {
          date: "2026-07-26",
          interactions: null,
          reach: 5,
          views: null,
        },
      ],
      lastSyncedAt: "2026-07-26T12:00:00.000Z",
      message: null,
      status: "ready",
      totals: {
        interactions: 2,
        reach: 5,
        views: 7,
      },
    },
    {
      accountName: "Unavailable",
      accountUsername: "unavailable",
      connectionId: "unavailable",
      daily: [
        {
          date: "2026-07-25",
          interactions: 99,
          reach: 99,
          views: 99,
        },
      ],
      lastSyncedAt: null,
      message: "Reconnect Instagram.",
      status: "permission_missing",
      totals: {
        interactions: null,
        reach: null,
        views: null,
      },
    },
  ];

  assert.deepEqual(aggregateInstagramInsightDaily(accounts), [
    {
      date: "2026-07-25",
      interactions: 2,
      reach: null,
      views: 19,
    },
    {
      date: "2026-07-26",
      interactions: 3,
      reach: 13,
      views: null,
    },
  ]);
});
