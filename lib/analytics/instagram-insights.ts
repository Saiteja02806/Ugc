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
  payload: unknown,
): NormalizedInstagramInsights {
  const entries = getInsightEntries(payload);
  const dailyByDate = new Map<string, InstagramInsightTotals>();
  const metricTotals = new Map<InstagramAccountInsightMetric, number | null>();

  for (const metric of instagramAccountInsightMetrics) {
    const entry = entries.find((candidate) => candidate.name === metric);

    if (!entry) {
      metricTotals.set(metric, null);
      continue;
    }

    const values = getInsightValues(entry.values);
    const numericValues = values
      .map((value) =>
        getUtcDateKey(value.end_time)
          ? getNonNegativeNumber(value.value)
          : null,
      )
      .filter((value): value is number => value !== null);
    const totalValue = getNonNegativeNumber(entry.total_value?.value);

    metricTotals.set(
      metric,
      numericValues.length > 0
        ? numericValues.reduce((total, value) => total + value, 0)
        : totalValue,
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
