import type { SocialConnection } from "@/lib/social/types";

export const instagramAccountInsightMetrics = [
  "views",
  "total_interactions",
  "reach",
] as const;

export type InstagramAccountInsightMetric =
  (typeof instagramAccountInsightMetrics)[number];

export type InstagramInsightTotals = {
  interactions: number | null;
  reach: number | null;
  views: number | null;
};

export type InstagramAccountInsightMetricKey = keyof InstagramInsightTotals;

/**
 * Meta returns daily account points for Reach. Views and total interactions
 * are returned as one total for the requested period, so drawing them as a
 * daily line would invent data that Meta did not provide.
 */
export function hasInstagramAccountDailyTrend(
  metric: InstagramAccountInsightMetricKey,
) {
  return metric === "reach";
}

export type InstagramInsightPoint = InstagramInsightTotals & {
  date: string;
};

export type InstagramInsightsAccountStatus =
  | "error"
  | "permission_missing"
  | "ready"
  | "unavailable";

export type InstagramInsightsAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  daily: InstagramInsightPoint[];
  lastSyncedAt: string | null;
  message: string | null;
  status: InstagramInsightsAccountStatus;
  totals: InstagramInsightTotals;
};

type InstagramConnectionIdentity = Pick<
  SocialConnection,
  "id" | "platform" | "platformAccountId"
>;

/**
 * Keeps the first (normally newest) active row for each Instagram account.
 * Historical duplicate connection rows must not duplicate UI, Meta requests,
 * or aggregated metrics.
 */
export function getUniqueInstagramConnections<
  Connection extends InstagramConnectionIdentity,
>(connections: readonly Connection[]) {
  const seenAccountIds = new Set<string>();

  return connections.filter((connection) => {
    if (connection.platform !== "instagram") {
      return false;
    }

    const accountKey =
      connection.platformAccountId.trim() || connection.id;

    if (seenAccountIds.has(accountKey)) {
      return false;
    }

    seenAccountIds.add(accountKey);
    return true;
  });
}

export function aggregateInstagramInsightDaily(
  accounts: InstagramInsightsAccount[],
): InstagramInsightPoint[] {
  const dailyByDate = new Map<string, InstagramInsightTotals>();

  for (const account of accounts) {
    if (account.status !== "ready") {
      continue;
    }

    for (const point of account.daily) {
      const totals = dailyByDate.get(point.date) ?? emptyInsightTotals();

      totals.interactions = sumOptionalMetric(
        totals.interactions,
        point.interactions,
      );
      totals.reach = sumOptionalMetric(totals.reach, point.reach);
      totals.views = sumOptionalMetric(totals.views, point.views);
      dailyByDate.set(point.date, totals);
    }
  }

  return Array.from(dailyByDate, ([date, totals]) => ({
    date,
    ...totals,
  })).sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Builds a chart series from Meta's daily account data only. A period total or
 * a current per-post total must never be placed on a calendar day, because it
 * describes a different thing from views earned on that day.
 */
export function buildInstagramAccountDailyTrend(params: {
  accounts: InstagramInsightsAccount[];
  dateKeys: readonly string[];
}): InstagramInsightPoint[] {
  const dailyByDate = new Map(
    aggregateInstagramInsightDaily(params.accounts).map((point) => [
      point.date,
      point,
    ]),
  );

  return params.dateKeys.map((date) => {
    const point = dailyByDate.get(date);

    return point
      ? { ...point }
      : {
          date,
          ...emptyInsightTotals(),
        };
  });
}

type InstagramInsightValue = {
  end_time?: unknown;
  value?: unknown;
};

type InstagramInsightMetricObject = {
  name?: unknown;
  total_value?: {
    value?: unknown;
  };
  values?: unknown;
};

export type NormalizedInstagramInsights = {
  daily: InstagramInsightPoint[];
  totals: InstagramInsightTotals;
};

export function normalizeInstagramAccountInsights(
  payload: unknown | readonly unknown[],
): NormalizedInstagramInsights {
  const entries = (Array.isArray(payload) ? payload : [payload]).flatMap(
    getInsightEntries,
  );
  const dailyByDate = new Map<string, InstagramInsightTotals>();
  const metricTotals = new Map<InstagramAccountInsightMetric, number | null>();

  for (const metric of instagramAccountInsightMetrics) {
    const metricEntries = entries.filter(
      (candidate) => candidate.name === metric,
    );

    if (metricEntries.length === 0) {
      metricTotals.set(metric, null);
      continue;
    }

    const values = metricEntries.flatMap((entry) =>
      getInsightValues(entry.values),
    );
    const numericValues = values
      .map((value) =>
        getUtcDateKey(value.end_time)
          ? getNonNegativeNumber(value.value)
          : null,
      )
      .filter((value): value is number => value !== null);
    const totalValue = metricEntries
      .map((entry) => getNonNegativeNumber(entry.total_value?.value))
      .find((value): value is number => value !== null) ?? null;

    metricTotals.set(
      metric,
      totalValue ??
        (numericValues.length > 0
          ? numericValues.reduce((total, value) => total + value, 0)
          : null),
    );

    for (const value of values) {
      const date = getUtcDateKey(value.end_time);
      const numericValue = getNonNegativeNumber(value.value);

      if (!date || numericValue === null) {
        continue;
      }

      const point = dailyByDate.get(date) ?? emptyInsightTotals();
      setMetricValue(point, metric, numericValue);
      dailyByDate.set(date, point);
    }
  }

  return {
    daily: Array.from(dailyByDate, ([date, totals]) => ({
      date,
      ...totals,
    })).sort((left, right) => left.date.localeCompare(right.date)),
    totals: {
      interactions: metricTotals.get("total_interactions") ?? null,
      reach: metricTotals.get("reach") ?? null,
      views: metricTotals.get("views") ?? null,
    },
  };
}

function getInsightEntries(payload: unknown): InstagramInsightMetricObject[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = (payload as { data?: unknown }).data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (value): value is InstagramInsightMetricObject =>
      Boolean(value && typeof value === "object"),
  );
}

function getInsightValues(value: unknown): InstagramInsightValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (candidate): candidate is InstagramInsightValue =>
      Boolean(candidate && typeof candidate === "object"),
  );
}

function emptyInsightTotals(): InstagramInsightTotals {
  return {
    interactions: null,
    reach: null,
    views: null,
  };
}

function setMetricValue(
  totals: InstagramInsightTotals,
  metric: InstagramAccountInsightMetric,
  value: number,
) {
  if (metric === "total_interactions") {
    totals.interactions = value;
    return;
  }

  totals[metric] = value;
}

function sumOptionalMetric(
  current: number | null,
  next: number | null,
) {
  if (next === null) {
    return current;
  }

  return (current ?? 0) + next;
}

function getNonNegativeNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getUtcDateKey(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString().slice(0, 10);
}
