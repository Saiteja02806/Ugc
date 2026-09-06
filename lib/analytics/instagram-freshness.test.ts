import assert from "node:assert/strict";
import test from "node:test";

import {
  getInstagramContentRefreshIntervalMs,
  getInstagramIncrementalFeedStart,
  isInstagramContentMetricsStale,
  isInstagramThumbnailStale,
} from "./instagram-freshness.ts";

const hour = 60 * 60_000;
const now = Date.parse("2026-08-24T12:00:00.000Z");

test("uses the agreed age-based Instagram content refresh windows", () => {
  assert.equal(
    getInstagramContentRefreshIntervalMs(
      new Date(now - 23 * hour).toISOString(),
      now,
    ),
    hour,
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
