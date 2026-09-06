import "server-only";

import {
  instagramMediaInsightMetrics,
  mergeInstagramContentItems,
  mergeInstagramContentMetrics,
  normalizeInstagramMedia,
  normalizeInstagramMediaInsights,
  type InstagramContentAccount,
  type InstagramContentItem,
  type InstagramMediaInsightMetric,
} from "@/lib/analytics/instagram-content-insights";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import {
  getInstagramIncrementalFeedStart,
  INSTAGRAM_MEDIA_FEED_REFRESH_MS,
  isInstagramContentMetricsStale,
  isInstagramThumbnailStale,
  isInstagramTimestampStale,
} from "@/lib/analytics/instagram-freshness";
import { getUniqueInstagramConnections } from "@/lib/analytics/instagram-insights";
import {
  getInstagramContentSnapshotForOwner,
  persistInstagramContentConnectionSnapshots,
  persistInstagramContentRecords,
  type StoredInstagramContentItem,
} from "@/lib/analytics/instagram-snapshots";
import {
  listPublishedInstagramPostReferencesForUser,
  type PublishedInstagramPostReference,
} from "@/lib/scheduling/db";
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
const accountSyncConcurrency = 2;
const mediaInsightConcurrency = 4;
// A thumbnail renewal is one Meta request per post. Keep repairs bounded so a
// single account with a long history cannot monopolize the analytics worker.
const maxInstagramThumbnailRefreshesPerAccount = 50;

type ThumbnailSyncedInstagramContentItem = {
  item: InstagramContentItem;
  thumbnailSyncedAt: string | null;
};

export async function listInstagramContentInsightsForOwner(params: {
  days: InstagramInsightsRangeDays;
  force?: boolean;
  userId: string;
}): Promise<InstagramContentAccount[]> {
  const [connections, previousSnapshot] = await Promise.all([
    listSocialConnections(params.userId),
    getInstagramContentSnapshotForOwner({
      days: params.days,
      userId: params.userId,
    }),
  ]);
  const instagramConnections = getUniqueInstagramConnections(connections);
  const publishedPostReferences = await getPublishedInstagramPostReferences({
    days: params.days,
    userId: params.userId,
  });
  const loadedAccounts = await mapWithConcurrency(
    instagramConnections,
    accountSyncConcurrency,
    (connection) =>
      loadInstagramContentAccount({
        connection,
        days: params.days,
        force: params.force ?? false,
        previousState:
          previousSnapshot.connectionStates.get(connection.id) ?? null,
        publishedPostReferences: publishedPostReferences.filter(
          (reference) => reference.connectionId === connection.id,
        ),
        storedRecords:
          previousSnapshot.recordsByConnectionId.get(connection.id) ?? [],
        userId: params.userId,
      }),
  );

  await persistInstagramContentConnectionSnapshots({
    days: params.days,
    snapshots: loadedAccounts.map(({ account, feedSyncedAt }) => ({
      account,
      feedSyncedAt,
    })),
    userId: params.userId,
  });

  return loadedAccounts.map(({ account }) => account);
}

async function loadInstagramContentAccount(params: {
  connection: SocialConnection;
  days: InstagramInsightsRangeDays;
  force: boolean;
  previousState: {
    feedSyncedAt: string | null;
    lastSyncedAt: string | null;
  } | null;
  publishedPostReferences: PublishedInstagramPostReference[];
  storedRecords: StoredInstagramContentItem[];
  userId: string;
}): Promise<{
  account: InstagramContentAccount;
  feedSyncedAt: string | null;
}> {
  const storedItems = params.storedRecords.map((record) => record.item);
  const baseAccount = {
    accountName: params.connection.platformAccountName,
    accountUsername: params.connection.platformAccountUsername,
    connectionId: params.connection.id,
    items: storedItems,
    lastSyncedAt: params.previousState?.lastSyncedAt ?? null,
  };

  if (params.connection.status !== "connected") {
    return {
      account: {
        ...baseAccount,
        message: "Reconnect Instagram before loading content performance.",
        status: "unavailable",
      },
      feedSyncedAt: params.previousState?.feedSyncedAt ?? null,
    };
  }

  if (!hasInstagramAnalyticsScope(params.connection.scopes)) {
    return {
      account: {
        ...baseAccount,
        message:
          "Reconnect Instagram once to grant content performance access.",
        status: "permission_missing",
      },
      feedSyncedAt: params.previousState?.feedSyncedAt ?? null,
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
      account: keepStoredAccountAvailable({
        account: baseAccount,
        message:
          error instanceof SocialOAuthError
            ? error.message
            : "Instagram content performance could not load for this account.",
      }),
      feedSyncedAt: params.previousState?.feedSyncedAt ?? null,
    };
  }

  if (!credential || credential.connection.platform !== "instagram") {
    return {
      account: {
        ...baseAccount,
        message: "The connected Instagram account was not found.",
        status: "unavailable",
      },
      feedSyncedAt: params.previousState?.feedSyncedAt ?? null,
    };
  }

  if (!hasInstagramAnalyticsScope(credential.connection.scopes)) {
    return {
      account: {
        ...baseAccount,
        message:
          "Reconnect Instagram once to grant content performance access.",
        status: "permission_missing",
      },
      feedSyncedAt: params.previousState?.feedSyncedAt ?? null,
    };
  }

  try {
    const shouldScanFeed =
      params.force ||
      isInstagramTimestampStale({
        maxAgeMs: INSTAGRAM_MEDIA_FEED_REFRESH_MS,
        timestamp: params.previousState?.feedSyncedAt ?? null,
      });
    let feedSyncedAt = params.previousState?.feedSyncedAt ?? null;
    let feedError: string | null = null;
    let feedItems = storedItems;
    const freshThumbnailMediaIds = new Set<string>();

    if (shouldScanFeed) {
      try {
        const incrementalItems = await requestInstagramMedia({
          accessToken: credential.accessToken,
          accountId: credential.connection.platformAccountId,
          accountName: credential.connection.platformAccountName,
          accountUsername: credential.connection.platformAccountUsername,
          connectionId: credential.connection.id,
          since: getInstagramIncrementalFeedStart({
            days: params.days,
            feedSyncedAt,
          }),
        });

        for (const item of incrementalItems) {
          freshThumbnailMediaIds.add(item.id);
        }
        feedItems = mergeInstagramContentItems(incrementalItems, storedItems);
        feedSyncedAt = new Date().toISOString();
      } catch (error) {
        if (storedItems.length === 0) {
          throw error;
        }

        feedError = getInstagramContentErrorMessage(error);
      }
    }

    const reconciledMedia = await reconcilePublishedInstagramMedia({
      accessToken: credential.accessToken,
      accountName: credential.connection.platformAccountName,
      accountUsername: credential.connection.platformAccountUsername,
      connectionId: credential.connection.id,
      feedItems,
      publishedPostReferences: params.publishedPostReferences,
    });
    const storedByMediaId = new Map(
      params.storedRecords.map((record) => [record.item.id, record]),
    );
    const contentWithFreshThumbnails =
      await refreshStaleInstagramContentThumbnails({
        accessToken: credential.accessToken,
        accountName: credential.connection.platformAccountName,
        accountUsername: credential.connection.platformAccountUsername,
        connectionId: credential.connection.id,
        force: params.force,
        freshThumbnailMediaIds,
        items: reconciledMedia,
        storedByMediaId,
      });
    const records = await mapWithConcurrency(
      contentWithFreshThumbnails,
      mediaInsightConcurrency,
      async ({ item, thumbnailSyncedAt }) => {
        const stored = storedByMediaId.get(item.id);
        const mergedItem = stored
          ? mergeStoredInstagramContentItem(item, stored.item)
          : item;

        if (
          !params.force &&
          !isInstagramContentMetricsStale({
            metricsSyncedAt: stored?.metricsSyncedAt ?? null,
            publishedAt: item.publishedAt,
          })
        ) {
          return {
            item: mergedItem,
            lastSyncError: stored?.lastSyncError ?? null,
            metricsSyncedAt: stored?.metricsSyncedAt ?? null,
            thumbnailSyncedAt,
          } satisfies StoredInstagramContentItem;
        }

        try {
          const insights = await requestInstagramMediaInsights({
            accessToken: credential.accessToken,
            mediaId: item.id,
          });

          return {
            item: mergeInstagramContentMetrics(mergedItem, insights),
            lastSyncError: null,
            metricsSyncedAt: new Date().toISOString(),
            thumbnailSyncedAt,
          } satisfies StoredInstagramContentItem;
        } catch (error) {
          // A single unavailable, incompatible, rate-limited, or otherwise
          // failed post must never discard the other posts in this account.
          return {
            item: mergedItem,
            lastSyncError: getInstagramContentErrorMessage(error),
            metricsSyncedAt: stored?.metricsSyncedAt ?? null,
            thumbnailSyncedAt,
          } satisfies StoredInstagramContentItem;
        }
      },
    );
    await persistInstagramContentRecords({
      records,
      userId: params.userId,
    });
    const failedPostCount = records.filter(
      (record) => record.lastSyncError,
    ).length;
    const message = [
      feedError,
      failedPostCount > 0
        ? `${failedPostCount} post${failedPostCount === 1 ? "" : "s"} could not refresh; saved metrics are still shown.`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

    return {
      account: {
        accountName: credential.connection.platformAccountName,
        accountUsername: credential.connection.platformAccountUsername,
        connectionId: credential.connection.id,
        items: records.map((record) => record.item),
        lastSyncedAt: new Date().toISOString(),
        message,
        status: "ready",
      },
      feedSyncedAt,
    };
  } catch (error) {
    return {
      account: keepStoredAccountAvailable({
        account: baseAccount,
        message: getInstagramContentErrorMessage(error),
      }),
      feedSyncedAt: params.previousState?.feedSyncedAt ?? null,
    };
  }
}

async function requestInstagramMedia(params: {
  accessToken: string;
  accountId: string;
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  since: Date;
}) {
  const since = params.since;
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

function mergeStoredInstagramContentItem(
  current: InstagramContentItem,
  stored: InstagramContentItem,
): InstagramContentItem {
  return {
    ...current,
    metrics: {
      comments: current.metrics.comments ?? stored.metrics.comments,
      interactions: stored.metrics.interactions,
      likes: current.metrics.likes ?? stored.metrics.likes,
      reach: stored.metrics.reach,
      saves: stored.metrics.saves,
      shares: stored.metrics.shares,
      views: stored.metrics.views,
    },
  };
}

/**
 * Meta returns short-lived CDN URLs for media_url and thumbnail_url. The
 * incremental feed deliberately does not revisit older posts, so renew those
 * URLs separately without forcing their metrics to be fetched again.
 */
async function refreshStaleInstagramContentThumbnails(params: {
  accessToken: string;
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  force: boolean;
  freshThumbnailMediaIds: ReadonlySet<string>;
  items: InstagramContentItem[];
  storedByMediaId: ReadonlyMap<string, StoredInstagramContentItem>;
}): Promise<ThumbnailSyncedInstagramContentItem[]> {
  const candidates = params.items
    .filter((item) => {
      const stored = params.storedByMediaId.get(item.id);

      return (
        stored !== undefined &&
        !params.freshThumbnailMediaIds.has(item.id) &&
        (params.force ||
          isInstagramThumbnailStale({
            thumbnailSyncedAt: stored.thumbnailSyncedAt,
          }))
      );
    })
    .slice(0, maxInstagramThumbnailRefreshesPerAccount);
  const refreshedItems = await mapWithConcurrency(
    candidates,
    mediaInsightConcurrency,
    async (item) => {
      try {
        return await requestInstagramMediaById({
          accessToken: params.accessToken,
          accountName: params.accountName,
          accountUsername: params.accountUsername,
          connectionId: params.connectionId,
          mediaId: item.id,
        });
      } catch {
        // An unavailable post must retain its saved data. Its old timestamp
        // causes a later analytics job to retry without blocking other posts.
        return null;
      }
    },
  );
  const refreshedByMediaId = new Map(
    refreshedItems
      .filter((item): item is InstagramContentItem => item !== null)
      .map((item) => [item.id, item]),
  );
  const refreshedAt = new Date().toISOString();

  return params.items.map((item) => {
    const refreshedItem = refreshedByMediaId.get(item.id);
    const stored = params.storedByMediaId.get(item.id);
    const hasFreshThumbnail =
      refreshedItem !== undefined ||
      params.freshThumbnailMediaIds.has(item.id) ||
      stored === undefined;

    return {
      item: refreshedItem ?? item,
      thumbnailSyncedAt: hasFreshThumbnail
        ? refreshedAt
        : stored.thumbnailSyncedAt,
    };
  });
}

function keepStoredAccountAvailable(params: {
  account: Omit<InstagramContentAccount, "message" | "status">;
  message: string;
}): InstagramContentAccount {
  return {
    ...params.account,
    message: params.message,
    status: params.account.items.length > 0 ? "ready" : "error",
  };
}

function getInstagramContentErrorMessage(error: unknown) {
  return error instanceof InstagramContentRequestError
    ? error.userMessage
    : error instanceof SocialOAuthError
      ? error.message
      : "Instagram content performance could not load right now.";
}

/**
 * Meta's account media feed can lag behind a post that was published through
 * UGC Pilot. Read the saved, non-sensitive media IDs and ask Meta for only the
 * missing posts. A saved database reference is not enough proof that a post is
 * still live: if Meta cannot return it, Analytics must not invent an empty row.
 */
async function reconcilePublishedInstagramMedia(params: {
  accessToken: string;
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  feedItems: InstagramContentItem[];
  publishedPostReferences: PublishedInstagramPostReference[];
}): Promise<InstagramContentItem[]> {
  const feedIds = new Set(params.feedItems.map((item) => item.id));
  const missingReferences = Array.from(
    new Map(
      params.publishedPostReferences
        .filter((reference) => !feedIds.has(reference.platformPostId))
        .map((reference) => [reference.platformPostId, reference]),
    ).values(),
  );

  if (missingReferences.length === 0) {
    return params.feedItems;
  }

  const lookups = await mapWithConcurrency(
    missingReferences,
    mediaInsightConcurrency,
    async (reference) => {
      try {
        return await requestInstagramMediaById({
          accessToken: params.accessToken,
          accountName: params.accountName,
          accountUsername: params.accountUsername,
          connectionId: params.connectionId,
          mediaId: reference.platformPostId,
        });
      } catch {
        return null;
      }
    },
  );
  const availableItems = lookups.filter(
    (item): item is InstagramContentItem => item !== null,
  );

  return mergeInstagramContentItems(params.feedItems, availableItems);
}

async function requestInstagramMediaById(params: {
  accessToken: string;
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  mediaId: string;
}) {
  const url = buildInstagramGraphUrl(
    `/${encodeURIComponent(params.mediaId)}`,
  );

  url.searchParams.set("fields", instagramMediaFields.join(","));

  const payload = await requestInstagramGraph({
    accessToken: params.accessToken,
    url,
    userMessage: "Instagram post details could not load right now.",
  });

  return (
    normalizeInstagramMedia(
      { data: [payload] },
      {
        accountName: params.accountName,
        accountUsername: params.accountUsername,
        connectionId: params.connectionId,
      },
    )[0] ?? null
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

async function getPublishedInstagramPostReferences(params: {
  days: InstagramInsightsRangeDays;
  userId: string;
}) {
  const since = getInstagramContentSince(params.days);

  try {
    return await listPublishedInstagramPostReferencesForUser({
      from: since.toISOString(),
      to: new Date().toISOString(),
      userId: params.userId,
    });
  } catch {
    // The normal Meta feed remains useful if this optional reconciliation
    // lookup is temporarily unavailable.
    return [];
  }
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
