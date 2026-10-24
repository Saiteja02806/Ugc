import assert from "node:assert/strict";
import test from "node:test";

import {
  getInstagramContentRefreshIntervalMs,
  getInstagramIncrementalFeedStart,
  isInstagramContentMetricsStale,
  isInstagramThumbnailStale,
  INSTAGRAM_ACCOUNT_INSIGHTS_REFRESH_MS,
  INSTAGRAM_MEDIA_FEED_REFRESH_MS,
  INSTAGRAM_ANALYTICS_BROWSER_CACHE_MS,
} from "./instagram-freshness.ts";

const hour = 60 * 60_000;
const now = Date.parse("2026-08-24T12:00:00.000Z");

test("recent Instagram posts use the fifteen-minute visit refresh window; older posts retain slower windows", () => {
  assert.equal(
    getInstagramContentRefreshIntervalMs(
      new Date(now - 23 * hour).toISOString(),
      now,
    ),
    15 * 60_000,
  );
  assert.equal(
    getInstagramContentRefreshIntervalMs(
      new Date(now - 2 * 24 * hour).toISOString(),
      now,
    ),
    6 * hour,
  );
  assert.equal(
    getInstagramContentRefreshIntervalMs(
      new Date(now - 8 * 24 * hour).toISOString(),
      now,
    ),
    24 * hour,
  );
});

test("browser reads are independent of the bounded provider synchronization window", () => {
  assert.equal(INSTAGRAM_ANALYTICS_BROWSER_CACHE_MS, 60_000);
  assert.equal(INSTAGRAM_ACCOUNT_INSIGHTS_REFRESH_MS, 15 * 60_000);
  assert.equal(INSTAGRAM_MEDIA_FEED_REFRESH_MS, 15 * 60_000);
  const publishedAt = new Date(now - hour).toISOString();
  assert.equal(isInstagramContentMetricsStale({ publishedAt, now, metricsSyncedAt: new Date(now - 14 * 60_000).toISOString() }), false);
  assert.equal(isInstagramContentMetricsStale({ publishedAt, now, metricsSyncedAt: new Date(now - 15 * 60_000).toISOString() }), true);
});

test("treats missing or expired per-post metrics as stale", () => {
  const publishedAt = new Date(now - 2 * 24 * hour).toISOString();

  assert.equal(
    isInstagramContentMetricsStale({
      metricsSyncedAt: null,
      now,
      publishedAt,
    }),
    true,
  );
  assert.equal(
    isInstagramContentMetricsStale({
      metricsSyncedAt: new Date(now - 5 * hour).toISOString(),
      now,
      publishedAt,
    }),
    false,
  );
  assert.equal(
    isInstagramContentMetricsStale({
      metricsSyncedAt: new Date(now - 6 * hour).toISOString(),
      now,
      publishedAt,
    }),
    true,
  );
});

test("refreshes signed Instagram thumbnails independently from post metrics", () => {
  assert.equal(
    isInstagramThumbnailStale({ thumbnailSyncedAt: null, now }),
    true,
  );
  assert.equal(
    isInstagramThumbnailStale({
      thumbnailSyncedAt: new Date(now - 11 * hour).toISOString(),
      now,
    }),
    false,
  );
  assert.equal(
    isInstagramThumbnailStale({
      thumbnailSyncedAt: new Date(now - 12 * hour).toISOString(),
      now,
    }),
    true,
  );
});

test("incremental feed scanning overlaps the last successful scan by one day", () => {
  assert.equal(
    getInstagramIncrementalFeedStart({
      days: 30,
      feedSyncedAt: "2026-08-24T10:00:00.000Z",
      now: new Date(now),
    }).toISOString(),
    "2026-08-23T10:00:00.000Z",
  );
});
