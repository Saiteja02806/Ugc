import type { InstagramInsightsRangeDays } from "./instagram";

export const INSTAGRAM_ANALYTICS_BROWSER_CACHE_MS = 30 * 60_000;
export const INSTAGRAM_ACCOUNT_INSIGHTS_REFRESH_MS = 60 * 60_000;
export const INSTAGRAM_MEDIA_FEED_REFRESH_MS = 60 * 60_000;
export const INSTAGRAM_THUMBNAIL_REFRESH_MS = 12 * 60 * 60_000;

const ONE_HOUR_MS = 60 * 60_000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export function getInstagramContentRefreshIntervalMs(
  publishedAt: string,
  now = Date.now(),
) {
  const publishedTime = Date.parse(publishedAt);

  if (!Number.isFinite(publishedTime)) {
    return ONE_HOUR_MS;
  }

  const ageMs = Math.max(0, now - publishedTime);

  if (ageMs < ONE_DAY_MS) {
    return ONE_HOUR_MS;
  }

  if (ageMs < SEVEN_DAYS_MS) {
    return 6 * ONE_HOUR_MS;
  }

  return ONE_DAY_MS;
}

export function isInstagramContentMetricsStale(params: {
  metricsSyncedAt: string | null;
  now?: number;
  publishedAt: string;
}) {
  if (!params.metricsSyncedAt) {
    return true;
  }

  const syncedTime = Date.parse(params.metricsSyncedAt);
  const now = params.now ?? Date.now();

  return (
    !Number.isFinite(syncedTime) ||
    now - syncedTime >=
      getInstagramContentRefreshIntervalMs(params.publishedAt, now)
  );
}

/**
 * Instagram media URLs are CDN-signed and cannot be treated as permanent
 * storage references. Track their refresh separately from metrics: metrics
 * can be current even after a saved thumbnail URL has expired.
 */
export function isInstagramThumbnailStale(params: {
  now?: number;
  thumbnailSyncedAt: string | null;
}) {
  return isInstagramTimestampStale({
    maxAgeMs: INSTAGRAM_THUMBNAIL_REFRESH_MS,
    now: params.now,
    timestamp: params.thumbnailSyncedAt,
  });
}

export function isInstagramTimestampStale(params: {
  maxAgeMs: number;
  now?: number;
  timestamp: string | null;
}) {
  if (!params.timestamp) {
    return true;
  }

  const timestamp = Date.parse(params.timestamp);

  return (
    !Number.isFinite(timestamp) ||
    (params.now ?? Date.now()) - timestamp >= params.maxAgeMs
  );
}

export function getInstagramAnalyticsRangeStart(
  days: InstagramInsightsRangeDays,
  now = new Date(),
) {
  const since = new Date(now);

  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  return since;
}

export function getInstagramIncrementalFeedStart(params: {
  days: InstagramInsightsRangeDays;
  feedSyncedAt: string | null;
  now?: Date;
}) {
  const rangeStart = getInstagramAnalyticsRangeStart(
    params.days,
    params.now,
  );
  const feedSyncedTime = params.feedSyncedAt
    ? Date.parse(params.feedSyncedAt)
    : NaN;

  if (!Number.isFinite(feedSyncedTime)) {
    return rangeStart;
  }

  // Keep a one-day overlap so delayed Meta feed entries are still discovered.
  return new Date(Math.max(rangeStart.getTime(), feedSyncedTime - ONE_DAY_MS));
}
