import "server-only";

import {
  buildYouTubeAnalyticsReportUrl,
  getYouTubeAnalyticsDateRange,
  summarizeYouTubeAnalyticsReport,
  type YouTubeChannelMetrics,
} from "@/lib/analytics/youtube-report";
import {
  getSocialConnectionCredentialForOwner,
  listSocialConnections,
  SocialOAuthError,
} from "@/lib/social/oauth";
import { hasYouTubeAnalyticsScope } from "@/lib/social/youtube-oauth-config";

export type YouTubeAnalyticsAccountStatus =
  | "error"
  | "permission_missing"
  | "ready"
  | "unavailable";

export type YouTubeAnalyticsAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  metrics: YouTubeChannelMetrics | null;
  status: YouTubeAnalyticsAccountStatus;
};

type YouTubeAnalyticsErrorEnvelope = {
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

export async function listYouTubeChannelAnalyticsForOwner(params: {
  userId: string;
}): Promise<YouTubeAnalyticsAccount[]> {
  const connections = await listSocialConnections(params.userId);
  const youtubeConnections = connections.filter(
    (connection) => connection.platform === "youtube",
  );

  return Promise.all(
    youtubeConnections.map(async (connection): Promise<YouTubeAnalyticsAccount> => {
      const baseAccount = {
        accountName: connection.platformAccountName,
        accountUsername: connection.platformAccountUsername,
        connectionId: connection.id,
        lastSyncedAt: null,
        metrics: null,
      };

      if (connection.status !== "connected") {
        return {
          ...baseAccount,
          message: "Reconnect YouTube before loading channel analytics.",
          status: "unavailable",
        };
      }

      if (!hasYouTubeAnalyticsScope(connection.scopes)) {
        return {
          ...baseAccount,
          message: "Reconnect YouTube to grant channel analytics access.",
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
              : "YouTube analytics could not load for this channel.",
          status: "error",
        };
      }

      if (!credential || credential.connection.platform !== "youtube") {
        return {
          ...baseAccount,
          message: "The connected YouTube channel was not found.",
          status: "unavailable",
        };
      }

      if (!hasYouTubeAnalyticsScope(credential.connection.scopes)) {
        return {
          ...baseAccount,
          message: "Reconnect YouTube to grant channel analytics access.",
          status: "permission_missing",
        };
      }

      try {
        const metrics = await requestYouTubeChannelAnalytics(
          credential.accessToken,
        );

        return {
          accountName: credential.connection.platformAccountName,
          accountUsername: credential.connection.platformAccountUsername,
          connectionId: credential.connection.id,
          lastSyncedAt: new Date().toISOString(),
          message:
            metrics === null
              ? "No YouTube analytics data is available for the selected dates yet."
              : null,
          metrics,
          status: "ready",
        };
      } catch (error) {
        return {
          ...baseAccount,
          message:
            error instanceof YouTubeAnalyticsRequestError
              ? error.userMessage
              : "YouTube analytics could not load right now.",
          status: "error",
        };
      }
    }),
  );
}

class YouTubeAnalyticsRequestError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = "YouTubeAnalyticsRequestError";
  }
}

async function requestYouTubeChannelAnalytics(accessToken: string) {
  const url = buildYouTubeAnalyticsReportUrl({
    apiBaseUrl:
      process.env.YOUTUBE_ANALYTICS_API_BASE_URL?.trim() ||
      "https://youtubeanalytics.googleapis.com",
  });
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as
    | (YouTubeAnalyticsErrorEnvelope & {
        columnHeaders?: Array<{ name?: unknown }>;
        rows?: unknown[][];
      })
    | null;

  if (!response.ok || !payload || payload.error) {
    const providerMessage =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "YouTube Analytics request failed.";
    const providerCode = payload?.error?.code;
    const message = [
      `HTTP ${response.status}`,
      providerCode === undefined ? null : `code ${String(providerCode)}`,
      providerMessage,
    ]
      .filter(Boolean)
      .join(" - ");
    const userMessage =
      response.status === 401 || response.status === 403
        ? "Reconnect YouTube to grant channel analytics access."
        : "YouTube analytics could not load right now.";

    throw new YouTubeAnalyticsRequestError(message, userMessage);
  }

  return summarizeYouTubeAnalyticsReport(payload);
}

export function getYouTubeAnalyticsRangeLabel() {
  const { endDate, startDate } = getYouTubeAnalyticsDateRange();
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}
