import "server-only";

import {
  getUniqueInstagramConnections,
  instagramAccountInsightMetrics,
  normalizeInstagramAccountInsights,
  type InstagramInsightsAccount,
} from "@/lib/analytics/instagram-insights";
import {
  getSocialConnectionCredentialForOwner,
  listSocialConnections,
  SocialOAuthError,
} from "@/lib/social/oauth";
import { hasInstagramAnalyticsScope } from "@/lib/social/instagram-oauth-config";

export type InstagramInsightsRangeDays = 7 | 30 | 90;

export async function listInstagramAccountInsightsForOwner(params: {
  days: InstagramInsightsRangeDays;
  userId: string;
}): Promise<InstagramInsightsAccount[]> {
  const connections = await listSocialConnections(params.userId);
  const instagramConnections = getUniqueInstagramConnections(connections);

  return Promise.all(
    instagramConnections.map(
      async (connection): Promise<InstagramInsightsAccount> => {
        const baseAccount = {
          accountName: connection.platformAccountName,
          accountUsername: connection.platformAccountUsername,
          connectionId: connection.id,
          daily: [],
          lastSyncedAt: null,
          totals: {
            interactions: null,
            reach: null,
            views: null,
          },
        };

        if (connection.status !== "connected") {
          return {
            ...baseAccount,
            message: "Reconnect Instagram before loading insights.",
            status: "unavailable",
          };
        }

        if (!hasInstagramAnalyticsScope(connection.scopes)) {
          return {
            ...baseAccount,
            message:
              "Reconnect Instagram once to grant performance insight access.",
            status: "permission_missing",
          };
        }

        let credential;

        try {
          credential = await getSocialConnectionCredentialForOwner({
            connectionId: connection.id,
            userId: params.userId,
          });
        } catch (error) {
          return {
            ...baseAccount,
            message:
              error instanceof SocialOAuthError
                ? error.message
                : "Instagram insights could not load for this account.",
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
              "Reconnect Instagram once to grant performance insight access.",
            status: "permission_missing",
          };
        }

        try {
          const insights = await requestInstagramAccountInsights({
            accessToken: credential.accessToken,
            accountId: credential.connection.platformAccountId,
            days: params.days,
          });
          const hasValues = Object.values(insights.totals).some(
            (value) => value !== null,
          );

          return {
            accountName: credential.connection.platformAccountName,
            accountUsername:
              credential.connection.platformAccountUsername,
            connectionId: credential.connection.id,
            daily: insights.daily,
            lastSyncedAt: new Date().toISOString(),
            message: hasValues
              ? null
              : "Meta returned no insight values for this period.",
            status: "ready",
            totals: insights.totals,
          };
        } catch (error) {
          return {
            ...baseAccount,
            message:
              error instanceof InstagramInsightsRequestError
                ? error.userMessage
                : "Instagram insights could not load right now.",
            status: "error",
          };
        }
      },
    ),
  );
}

class InstagramInsightsRequestError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = "InstagramInsightsRequestError";
  }
}

async function requestInstagramAccountInsights(params: {
  accessToken: string;
  accountId: string;
  days: InstagramInsightsRangeDays;
}) {
  const { since, until } = getUtcInsightRange(params.days);
  const [timeSeriesPayload, totalValuePayload] = await Promise.all([
    requestInstagramAccountInsightsPayload({
      ...params,
      metrics: ["reach"],
      metricType: "time_series",
      since,
      until,
    }),
    requestInstagramAccountInsightsPayload({
      ...params,
      metrics: instagramAccountInsightMetrics,
      metricType: "total_value",
      since,
      until,
    }),
  ]);

  return normalizeInstagramAccountInsights([
    timeSeriesPayload,
    totalValuePayload,
  ]);
}

async function requestInstagramAccountInsightsPayload(params: {
  accessToken: string;
  accountId: string;
  metrics: readonly string[];
  metricType: "time_series" | "total_value";
  since: number;
  until: number;
}) {
  const url = buildInstagramGraphUrl(
    `/${encodeURIComponent(params.accountId)}/insights`,
  );

  url.searchParams.set("metric", params.metrics.join(","));
  url.searchParams.set("metric_type", params.metricType);
  url.searchParams.set("period", "day");
  url.searchParams.set("since", String(params.since));
  url.searchParams.set("until", String(params.until));

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  const providerError = getInstagramProviderError(payload);

  if (!response.ok || !payload || providerError) {
    const providerMessage =
      providerError?.message || "Instagram insights request failed.";
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
    const userMessage = accessTokenInvalid
      ? "Reconnect Instagram before loading insights."
      : permissionMissing
        ? "Reconnect Instagram once to grant performance insight access."
        : rateLimited
          ? "Instagram is temporarily limiting insight requests. Try again shortly."
          : "Instagram insights could not load right now.";

    throw new InstagramInsightsRequestError(
      [
        `Instagram insights request failed: HTTP ${response.status}`,
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
      userMessage,
    );
  }

  return payload;
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

function getUtcInsightRange(days: InstagramInsightsRangeDays) {
  const untilDate = new Date();
  untilDate.setUTCHours(0, 0, 0, 0);
  untilDate.setUTCDate(untilDate.getUTCDate() + 1);

  const sinceDate = new Date(untilDate);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - days);

  return {
    since: Math.floor(sinceDate.getTime() / 1000),
    until: Math.floor(untilDate.getTime() / 1000),
  };
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
