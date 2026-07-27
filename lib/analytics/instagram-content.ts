import "server-only";

import {
  instagramMediaInsightMetrics,
  mergeInstagramContentMetrics,
  normalizeInstagramMedia,
  normalizeInstagramMediaInsights,
  type InstagramContentAccount,
  type InstagramContentItem,
  type InstagramMediaInsightMetric,
} from "@/lib/analytics/instagram-content-insights";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import { hasInstagramAnalyticsScope } from "@/lib/social/instagram-oauth-config";
import {
  getSocialConnectionCredentialForOwner,
  listSocialConnections,
  SocialOAuthError,
} from "@/lib/social/oauth";
import type { SocialConnection } from "@/lib/social/types";

const instagramMediaFields = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
] as const;

const instagramMediaPageSize = 50;
const maxInstagramMediaPages = 10;
const mediaInsightConcurrency = 4;

export async function listInstagramContentInsightsForOwner(params: {
  days: InstagramInsightsRangeDays;
  userId: string;
}): Promise<InstagramContentAccount[]> {
  const connections = await listSocialConnections(params.userId);
  const instagramConnections = connections.filter(
    (connection) => connection.platform === "instagram",
  );
  const accounts: InstagramContentAccount[] = [];

  for (const connection of instagramConnections) {
    accounts.push(
      await loadInstagramContentAccount({
        connection,
        days: params.days,
        userId: params.userId,
      }),
    );
  }

  return accounts;
}

async function loadInstagramContentAccount(params: {
  connection: SocialConnection;
  days: InstagramInsightsRangeDays;
  userId: string;
}): Promise<InstagramContentAccount> {
  const baseAccount = {
    accountName: params.connection.platformAccountName,
    accountUsername: params.connection.platformAccountUsername,
    connectionId: params.connection.id,
    items: [],
    lastSyncedAt: null,
  };

  if (params.connection.status !== "connected") {
    return {
      ...baseAccount,
      message: "Reconnect Instagram before loading content performance.",
      status: "unavailable",
    };
  }

  if (!hasInstagramAnalyticsScope(params.connection.scopes)) {
    return {
      ...baseAccount,
      message:
        "Reconnect Instagram once to grant content performance access.",
      status: "permission_missing",
    };
  }

  let credential;

  try {
    credential = await getSocialConnectionCredentialForOwner({
      connectionId: params.connection.id,
      userId: params.userId,
    });
  } catch (error) {
    return {
      ...baseAccount,
      message:
        error instanceof SocialOAuthError
          ? error.message
          : "Instagram content performance could not load for this account.",
      status: "error",
    };
  }

  if (!credential || credential.connection.platform !== "instagram") {
    return {
      ...baseAccount,
      message: "The connected Instagram account was not found.",
      status: "unavailable",
    };
  }

  if (!hasInstagramAnalyticsScope(credential.connection.scopes)) {
    return {
      ...baseAccount,
      message:
        "Reconnect Instagram once to grant content performance access.",
      status: "permission_missing",
    };
  }

  try {
    const items = await requestInstagramMedia({
      accessToken: credential.accessToken,
      accountId: credential.connection.platformAccountId,
      accountName: credential.connection.platformAccountName,
      accountUsername: credential.connection.platformAccountUsername,
      connectionId: credential.connection.id,
      days: params.days,
    });
    const itemsWithInsights = await mapWithConcurrency(
      items,
      mediaInsightConcurrency,
      async (item) => {
        try {
          const insights = await requestInstagramMediaInsights({
            accessToken: credential.accessToken,
            mediaId: item.id,
          });

          return mergeInstagramContentMetrics(item, insights);
        } catch (error) {
          if (
            error instanceof InstagramContentRequestError &&
            error.mediaUnavailable
          ) {
            return item;
          }

          throw error;
        }
      },
    );

    return {
      accountName: credential.connection.platformAccountName,
      accountUsername: credential.connection.platformAccountUsername,
      connectionId: credential.connection.id,
      items: itemsWithInsights,
      lastSyncedAt: new Date().toISOString(),
      message: null,
      status: "ready",
    };
  } catch (error) {
    return {
      ...baseAccount,
      message:
        error instanceof InstagramContentRequestError
          ? error.userMessage
          : "Instagram content performance could not load right now.",
      status: "error",
    };
  }
}

async function requestInstagramMedia(params: {
  accessToken: string;
  accountId: string;
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  days: InstagramInsightsRangeDays;
}) {
  const since = getInstagramContentSince(params.days);
  const until = new Date();
  const items: InstagramContentItem[] = [];
  let after: string | null = null;
  const seenCursors = new Set<string>();

  for (let page = 0; page < maxInstagramMediaPages; page += 1) {
    const url = buildInstagramGraphUrl(
      `/${encodeURIComponent(params.accountId)}/media`,
    );

    url.searchParams.set("fields", instagramMediaFields.join(","));
    url.searchParams.set("limit", String(instagramMediaPageSize));
    url.searchParams.set(
      "since",
      String(Math.floor(since.getTime() / 1000)),
    );
    url.searchParams.set(
      "until",
      String(Math.floor(until.getTime() / 1000)),
    );

    if (after) {
      url.searchParams.set("after", after);
    }

    const payload = await requestInstagramGraph({
      accessToken: params.accessToken,
      url,
      userMessage: "Instagram posts could not load right now.",
    });
    const pageItems = normalizeInstagramMedia(payload, {
      accountName: params.accountName,
      accountUsername: params.accountUsername,
      connectionId: params.connectionId,
    }).filter((item) => Date.parse(item.publishedAt) >= since.getTime());

    items.push(...pageItems);

    const nextCursor = getPagingAfterCursor(payload);

    if (!nextCursor || seenCursors.has(nextCursor)) {
      break;
    }

    seenCursors.add(nextCursor);
    after = nextCursor;
  }

  return items.sort(
    (left, right) =>
      Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
  );
}

async function requestInstagramMediaInsights(params: {
  accessToken: string;
  mediaId: string;
}) {
  try {
    const payload = await requestInstagramMediaInsightMetrics({
      ...params,
      metrics: instagramMediaInsightMetrics,
    });

    return normalizeInstagramMediaInsights(payload);
  } catch (error) {
    if (
      !(error instanceof InstagramContentRequestError) ||
      !error.metricCompatibilityIssue
    ) {
      throw error;
    }
  }

  const entries: unknown[] = [];

  for (const metric of instagramMediaInsightMetrics) {
    try {
      const payload = await requestInstagramMediaInsightMetrics({
        ...params,
        metrics: [metric],
      });
      const data =
        payload && typeof payload === "object"
          ? (payload as { data?: unknown }).data
          : null;

      if (Array.isArray(data)) {
        entries.push(...data);
      }
    } catch (error) {
      if (
        error instanceof InstagramContentRequestError &&
        (error.metricCompatibilityIssue || error.mediaUnavailable)
      ) {
        continue;
      }

      throw error;
    }
  }

  return normalizeInstagramMediaInsights({ data: entries });
}

async function requestInstagramMediaInsightMetrics(params: {
  accessToken: string;
  mediaId: string;
  metrics: readonly InstagramMediaInsightMetric[];
}) {
  const url = buildInstagramGraphUrl(
    `/${encodeURIComponent(params.mediaId)}/insights`,
  );

  url.searchParams.set("metric", params.metrics.join(","));

  return requestInstagramGraph({
    accessToken: params.accessToken,
    url,
    userMessage: "Instagram content insights could not load right now.",
  });
}

async function requestInstagramGraph(params: {
  accessToken: string;
  url: URL;
  userMessage: string;
}) {
  const response = await fetch(params.url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  const providerError = getInstagramProviderError(payload);

  if (!response.ok || !payload || providerError) {
    const providerMessage =
      providerError?.message || "Instagram request failed.";
    const normalizedMessage = providerMessage.toLowerCase();
    const providerCode = providerError?.code ?? null;
    const accessTokenInvalid =
      response.status === 401 ||
      providerCode === 190 ||
      normalizedMessage.includes("access token") &&
        (normalizedMessage.includes("invalid") ||
          normalizedMessage.includes("expired"));
    const permissionMissing =
      !accessTokenInvalid &&
      (response.status === 403 ||
        providerCode === 10 ||
        providerCode === 200 ||
        normalizedMessage.includes("permission"));
    const rateLimited =
      response.status === 429 ||
      [4, 17, 32, 613].includes(providerCode ?? -1);
    const metricCompatibilityIssue =
      providerCode === 100 &&
      !normalizedMessage.includes("unsupported get request") &&
      (normalizedMessage.includes("metric") ||
        normalizedMessage.includes("insight") ||
        normalizedMessage.includes("valid parameter"));
    const mediaUnavailable =
      providerCode === 100 &&
      normalizedMessage.includes("unsupported get request");
    const userMessage = accessTokenInvalid
      ? "Reconnect Instagram before loading content performance."
      : permissionMissing
        ? "Reconnect Instagram once to grant content performance access."
        : rateLimited
          ? "Instagram is temporarily limiting content insight requests. Try again shortly."
          : params.userMessage;

    throw new InstagramContentRequestError({
      mediaUnavailable,
      message: [
        `Instagram request failed: HTTP ${response.status}`,
        providerCode !== null ? `code ${providerCode}` : null,
        providerError?.error_subcode !== undefined
          ? `subcode ${providerError.error_subcode}`
          : null,
        providerMessage,
        providerError?.fbtrace_id
          ? `trace ${providerError.fbtrace_id}`
          : null,
      ]
        .filter(Boolean)
        .join(" - "),
      metricCompatibilityIssue,
      userMessage,
    });
  }

  return payload;
}

class InstagramContentRequestError extends Error {
  mediaUnavailable: boolean;
  metricCompatibilityIssue: boolean;
  userMessage: string;

  constructor(params: {
    mediaUnavailable: boolean;
    message: string;
    metricCompatibilityIssue: boolean;
    userMessage: string;
  }) {
    super(params.message);
    this.name = "InstagramContentRequestError";
    this.mediaUnavailable = params.mediaUnavailable;
    this.metricCompatibilityIssue = params.metricCompatibilityIssue;
    this.userMessage = params.userMessage;
  }
}

function buildInstagramGraphUrl(path: string) {
  const baseUrl =
    process.env.INSTAGRAM_GRAPH_API_BASE_URL?.trim() ||
    "https://graph.instagram.com";
  const configuredVersion =
    process.env.INSTAGRAM_GRAPH_API_VERSION?.trim();
  const version = configuredVersion
    ? configuredVersion.startsWith("v")
      ? configuredVersion
      : `v${configuredVersion}`
    : null;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(`${version ? `/${version}` : ""}${normalizedPath}`, baseUrl);
}

function getInstagramContentSince(days: InstagramInsightsRangeDays) {
  const since = new Date();

  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  return since;
}

function getPagingAfterCursor(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const after = (payload as {
    paging?: {
      cursors?: {
        after?: unknown;
      };
    };
  }).paging?.cursors?.after;

  return typeof after === "string" && after.trim() ? after.trim() : null;
}

function getInstagramProviderError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    error?: {
      code?: number;
      error_subcode?: number;
      fbtrace_id?: string;
      message?: string;
    };
    error_code?: number;
    error_message?: string;
  };

  if (candidate.error && typeof candidate.error === "object") {
    return candidate.error;
  }

  if (candidate.error_code || candidate.error_message) {
    return {
      code: candidate.error_code,
      message: candidate.error_message,
    };
  }

  return null;
}

async function mapWithConcurrency<Input, Output>(
  items: Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>,
) {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      const item = items[index];

      nextIndex += 1;

      if (item === undefined) {
        continue;
      }

      results[index] = await mapper(item, index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(items.length, 1)) },
      () => worker(),
    ),
  );

  return results;
}
