export const YOUTUBE_ANALYTICS_DAYS = 30;

export const YOUTUBE_ANALYTICS_METRICS = [
  "views",
  "likes",
  "comments",
  "estimatedMinutesWatched",
] as const;

export type YouTubeChannelMetrics = {
  comments: number | null;
  estimatedMinutesWatched: number | null;
  likes: number | null;
  views: number | null;
};

type YouTubeAnalyticsColumnHeader = {
  name?: unknown;
};

export type YouTubeAnalyticsReport = {
  columnHeaders?: YouTubeAnalyticsColumnHeader[];
  rows?: unknown[][];
};

export function buildYouTubeAnalyticsReportUrl(params: {
  apiBaseUrl: string;
  now?: Date;
}) {
  const dateRange = getYouTubeAnalyticsDateRange(params.now);
  const url = new URL("/v2/reports", params.apiBaseUrl);

  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", dateRange.startDate);
  url.searchParams.set("endDate", dateRange.endDate);
  url.searchParams.set("metrics", YOUTUBE_ANALYTICS_METRICS.join(","));
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("sort", "day");

  return url;
}

export function getYouTubeAnalyticsDateRange(now = new Date()) {
  const end = startOfUtcDay(now);
  end.setUTCDate(end.getUTCDate() - 2);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (YOUTUBE_ANALYTICS_DAYS - 1));

  return {
    endDate: formatUtcDate(end),
    startDate: formatUtcDate(start),
  };
}

export function summarizeYouTubeAnalyticsReport(
  report: YouTubeAnalyticsReport,
): YouTubeChannelMetrics | null {
  if (!Array.isArray(report.rows) || report.rows.length === 0) {
    return null;
  }

  const columnIndexes = new Map(
    (report.columnHeaders ?? []).flatMap((header, index) => {
      const name = typeof header?.name === "string" ? header.name : null;
      return name ? [[name, index] as const] : [];
    }),
  );

  if (!YOUTUBE_ANALYTICS_METRICS.every((metric) => columnIndexes.has(metric))) {
    return null;
  }

  const totals = {
    comments: 0,
    estimatedMinutesWatched: 0,
    likes: 0,
    views: 0,
  };
  let hasMetricData = false;

  for (const row of report.rows) {
    for (const metric of YOUTUBE_ANALYTICS_METRICS) {
      const index = columnIndexes.get(metric);
      const value = index === undefined ? null : getNonNegativeNumber(row[index]);

      if (value === null) {
        continue;
      }

      totals[metric] += value;
      hasMetricData = true;
    }
  }

  return hasMetricData ? totals : null;
}

function getNonNegativeNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
