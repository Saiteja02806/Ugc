export const instagramMediaInsightMetrics = [
  "views",
  "reach",
  "total_interactions",
  "saved",
  "shares",
] as const;

export type InstagramMediaInsightMetric =
  (typeof instagramMediaInsightMetrics)[number];

export type InstagramContentType = "carousel" | "post" | "reel";

export type InstagramContentMetrics = {
  comments: number | null;
  interactions: number | null;
  likes: number | null;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  views: number | null;
};

export type InstagramContentItem = {
  accountName: string | null;
  accountUsername: string | null;
  caption: string | null;
  connectionId: string;
  contentType: InstagramContentType;
  id: string;
  mediaType: string | null;
  metrics: InstagramContentMetrics;
  permalink: string | null;
  publishedAt: string;
  thumbnailUrl: string | null;
};

export type InstagramContentAccountStatus =
  | "error"
  | "permission_missing"
  | "ready"
  | "unavailable";

export type InstagramContentAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  items: InstagramContentItem[];
  lastSyncedAt: string | null;
  message: string | null;
  status: InstagramContentAccountStatus;
};

export type InstagramContentFilter = "all" | InstagramContentType;

export type InstagramContentSort =
  | "interactions"
  | "reach"
  | "saves"
  | "shares"
  | "views";

export type InstagramPublishedContentPerformance = {
  date: string;
  interactions: number | null;
  reach: number | null;
  views: number | null;
};

type InstagramMediaObject = {
  caption?: unknown;
  comments_count?: unknown;
  id?: unknown;
  like_count?: unknown;
  media_product_type?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  permalink?: unknown;
  thumbnail_url?: unknown;
  timestamp?: unknown;
};

type InstagramInsightMetricObject = {
  name?: unknown;
  total_value?: {
    value?: unknown;
  };
  values?: unknown;
};

export function normalizeInstagramMedia(
  payload: unknown,
  account: {
    accountName: string | null;
    accountUsername: string | null;
    connectionId: string;
  },
): InstagramContentItem[] {
  const data =
    payload && typeof payload === "object"
      ? (payload as { data?: unknown }).data
      : null;

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return [];
    }

    const media = candidate as InstagramMediaObject;
    const id = getNonEmptyString(media.id);
    const publishedAt = getIsoDate(media.timestamp);

    if (!id || !publishedAt) {
      return [];
    }

    const mediaType = getNonEmptyString(media.media_type);
    const mediaProductType = getNonEmptyString(media.media_product_type);
    const thumbnailUrl =
      getHttpUrl(media.thumbnail_url) ?? getHttpUrl(media.media_url);

    return [
      {
        ...account,
        caption: getNonEmptyString(media.caption),
        contentType: getInstagramContentType({
          mediaProductType,
          mediaType,
        }),
        id,
        mediaType,
        metrics: {
          comments: getNonNegativeNumber(media.comments_count),
          interactions: null,
          likes: getNonNegativeNumber(media.like_count),
          reach: null,
          saves: null,
          shares: null,
          views: null,
        },
        permalink: getHttpUrl(media.permalink),
        publishedAt,
        thumbnailUrl,
      },
    ];
  });
}

export function normalizeInstagramMediaInsights(
  payload: unknown,
): Pick<
  InstagramContentMetrics,
  "interactions" | "reach" | "saves" | "shares" | "views"
> {
  const entries = getInsightEntries(payload);
  const values = new Map<InstagramMediaInsightMetric, number | null>();

  for (const metric of instagramMediaInsightMetrics) {
    const entry = entries.find((candidate) => candidate.name === metric);

    values.set(metric, entry ? getInsightMetricValue(entry) : null);
  }

  return {
    interactions: values.get("total_interactions") ?? null,
    reach: values.get("reach") ?? null,
    saves: values.get("saved") ?? null,
    shares: values.get("shares") ?? null,
    views: values.get("views") ?? null,
  };
}

export function mergeInstagramContentMetrics(
  item: InstagramContentItem,
  insights: ReturnType<typeof normalizeInstagramMediaInsights>,
): InstagramContentItem {
  return {
    ...item,
    metrics: {
      ...item.metrics,
      ...insights,
    },
  };
}

export function flattenReadyInstagramContentAccounts(
  accounts: InstagramContentAccount[],
) {
  return accounts.flatMap((account) =>
    account.status === "ready" ? account.items : [],
  );
}

export function aggregateInstagramContentPerformanceByPublishedDate(
  accounts: InstagramContentAccount[],
): InstagramPublishedContentPerformance[] {
  const performanceByDate = new Map<
    string,
    Omit<InstagramPublishedContentPerformance, "date">
  >();

  for (const item of flattenReadyInstagramContentAccounts(accounts)) {
    const publishedAt = getIsoDate(item.publishedAt);

    if (!publishedAt) {
      continue;
    }

    const date = publishedAt.slice(0, 10);
    const performance = performanceByDate.get(date) ?? {
      interactions: null,
      reach: null,
      views: null,
    };

    performance.interactions = sumOptionalMetric(
      performance.interactions,
      item.metrics.interactions,
    );
    performance.reach = sumOptionalMetric(
      performance.reach,
      item.metrics.reach,
    );
    performance.views = sumOptionalMetric(
      performance.views,
      item.metrics.views,
    );
    performanceByDate.set(date, performance);
  }

  return Array.from(performanceByDate, ([date, performance]) => ({
    date,
    ...performance,
  })).sort((left, right) => left.date.localeCompare(right.date));
}

export function filterAndSortInstagramContent(params: {
  filter: InstagramContentFilter;
  items: InstagramContentItem[];
  sort: InstagramContentSort;
}) {
  return params.items
    .filter(
      (item) =>
        params.filter === "all" || item.contentType === params.filter,
    )
    .sort((left, right) => {
      const leftValue = left.metrics[params.sort];
      const rightValue = right.metrics[params.sort];

      if (leftValue === null && rightValue === null) {
        return (
          Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
        );
      }

      if (leftValue === null) {
        return 1;
      }

      if (rightValue === null) {
        return -1;
      }

      return (
        rightValue - leftValue ||
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
      );
    });
}

export function getInstagramInteractionRate(
  metrics: InstagramContentMetrics,
) {
  if (
    metrics.interactions === null ||
    metrics.reach === null ||
    metrics.reach <= 0
  ) {
    return null;
  }

  return (metrics.interactions / metrics.reach) * 100;
}

export function getInstagramContentTitle(item: InstagramContentItem) {
  const firstLine = item.caption
    ?.split(/\r?\n/, 1)[0]
    ?.replace(/\s+/g, " ")
    .trim();

  if (firstLine) {
    return firstLine;
  }

  if (item.contentType === "reel") {
    return "Instagram Reel";
  }

  if (item.contentType === "carousel") {
    return "Instagram carousel";
  }

  return "Instagram post";
}

export function getInstagramContentType(params: {
  mediaProductType: string | null;
  mediaType: string | null;
}): InstagramContentType {
  if (params.mediaProductType?.toUpperCase() === "REELS") {
    return "reel";
  }

  if (params.mediaType?.toUpperCase() === "CAROUSEL_ALBUM") {
    return "carousel";
  }

  return "post";
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

function getInsightMetricValue(entry: InstagramInsightMetricObject) {
  const totalValue = getNonNegativeNumber(entry.total_value?.value);

  if (totalValue !== null) {
    return totalValue;
  }

  if (!Array.isArray(entry.values)) {
    return null;
  }

  for (const candidate of entry.values) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const value = getNonNegativeNumber(
      (candidate as { value?: unknown }).value,
    );

    if (value !== null) {
      return value;
    }
  }

  return null;
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

function sumOptionalMetric(current: number | null, next: number | null) {
  return next === null ? current : (current ?? 0) + next;
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getHttpUrl(value: unknown) {
  const candidate = getNonEmptyString(value);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getIsoDate(value: unknown) {
  const candidate = getNonEmptyString(value);

  if (!candidate) {
    return null;
  }

  const date = new Date(candidate);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
