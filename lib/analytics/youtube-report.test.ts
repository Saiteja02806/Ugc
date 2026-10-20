import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYouTubeAnalyticsReportUrl,
  getYouTubeAnalyticsDateRange,
  summarizeYouTubeAnalyticsReport,
  YOUTUBE_ANALYTICS_METRICS,
} from "./youtube-report.ts";

test("builds a channel-scoped YouTube Analytics Reports request", () => {
  const url = buildYouTubeAnalyticsReportUrl({
    apiBaseUrl: "https://youtubeanalytics.googleapis.com",
    now: new Date("2026-09-23T12:00:00.000Z"),
  });

  assert.equal(url.toString().startsWith("https://youtubeanalytics.googleapis.com/v2/reports"), true);
  assert.equal(url.searchParams.get("ids"), "channel==MINE");
  assert.equal(url.searchParams.get("startDate"), "2026-08-23");
  assert.equal(url.searchParams.get("endDate"), "2026-09-21");
  assert.equal(url.searchParams.get("metrics"), YOUTUBE_ANALYTICS_METRICS.join(","));
  assert.equal(url.searchParams.get("dimensions"), "day");
  assert.equal(url.searchParams.get("sort"), "day");
});

test("uses the last 30 complete days to avoid incomplete YouTube reports", () => {
  assert.deepEqual(
    getYouTubeAnalyticsDateRange(new Date("2026-01-02T00:00:00.000Z")),
    { endDate: "2025-12-31", startDate: "2025-12-02" },
  );
});

test("sums daily channel metrics without inventing data", () => {
  const metrics = summarizeYouTubeAnalyticsReport({
    columnHeaders: [
      { name: "day" },
      { name: "views" },
      { name: "likes" },
      { name: "comments" },
      { name: "estimatedMinutesWatched" },
    ],
    rows: [
      ["2026-09-20", 120, 16, 4, 51.5],
      ["2026-09-21", "80", "9", "2", "34.5"],
    ],
  });

  assert.deepEqual(metrics, {
    comments: 6,
    estimatedMinutesWatched: 86,
    likes: 25,
    views: 200,
  });
});

test("returns no metrics when YouTube has no report rows or required columns", () => {
  assert.equal(summarizeYouTubeAnalyticsReport({ rows: [] }), null);
  assert.equal(
    summarizeYouTubeAnalyticsReport({
      columnHeaders: [{ name: "views" }],
      rows: [[10]],
    }),
    null,
  );
});
