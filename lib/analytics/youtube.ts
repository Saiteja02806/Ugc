import "server-only";

import {
  buildYouTubeAnalyticsReportUrl,
  getYouTubeAnalyticsDateRange,
  summarizeYouTubeAnalyticsReport,
  type YouTubeChannelMetrics,
} from "@/lib/analytics/youtube-report";
import {
  buildYouTubeUploadsChannelUrl,
  buildYouTubeUploadsPlaylistUrl,
  buildYouTubeVideoDetailsUrl,
  getYouTubePlaylistVideoIds,
  getYouTubeUploadsPlaylistId,
  normalizeYouTubeUploadedVideos,
  type YouTubePlaylistItemsResponse,
  type YouTubeUploadedVideo,
  type YouTubeUploadsChannelResponse,
  type YouTubeVideosResponse,
} from "@/lib/analytics/youtube-videos";
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
  videos: YouTubeUploadedVideo[];
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
        videos: [],
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
        const [metricsResult, videosResult] = await Promise.allSettled([
          requestYouTubeChannelAnalytics(credential.accessToken),
          requestYouTubeUploadedVideos(credential.accessToken),
        ]);
        const metrics =
          metricsResult.status === "fulfilled" ? metricsResult.value : null;
        const videos =
          videosResult.status === "fulfilled" ? videosResult.value : [];

        if (
          metricsResult.status === "rejected" &&
          videosResult.status === "rejected"
        ) {
          throw metricsResult.reason;
        }

        return {
          accountName: credential.connection.platformAccountName,
          accountUsername: credential.connection.platformAccountUsername,
          connectionId: credential.connection.id,
          lastSyncedAt: new Date().toISOString(),
          message: getYouTubeAnalyticsMessage({
            metrics,
            metricsError:
              metricsResult.status === "rejected" ? metricsResult.reason : null,
            videos,
            videosError:
              videosResult.status === "rejected" ? videosResult.reason : null,
          }),
          metrics,
          status: "ready",
          videos,
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

function getYouTubeAnalyticsMessage(params: {
  metrics: YouTubeChannelMetrics | null;
  metricsError: unknown | null;
  videos: YouTubeUploadedVideo[];
  videosError: unknown | null;
}) {
  if (params.metricsError) {
    return `${getYouTubeAnalyticsErrorMessage(params.metricsError)} Uploaded videos are still shown below.`;
  }

  if (params.videosError) {
    return `${getYouTubeAnalyticsErrorMessage(params.videosError)} Channel metrics are still shown above.`;
  }

  if (params.metrics === null && params.videos.length === 0) {
    return "No uploaded videos or channel analytics are available for this channel yet.";
  }

  if (params.metrics === null) {
    return "Channel-level Analytics data is not available for the selected dates yet.";
  }

  if (params.videos.length === 0) {
    return "No uploaded videos were returned for this channel yet.";
  }

  return null;
}

function getYouTubeAnalyticsErrorMessage(error: unknown) {
  return error instanceof YouTubeAnalyticsRequestError
    ? error.userMessage
    : "Part of the YouTube analytics data could not load right now.";
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
    throw createYouTubeAnalyticsRequestError(response.status, payload);
  }

  return summarizeYouTubeAnalyticsReport(payload);
}

async function requestYouTubeUploadedVideos(accessToken: string) {
  const apiBaseUrl =
    process.env.YOUTUBE_DATA_API_BASE_URL?.trim() ||
    "https://www.googleapis.com/youtube/v3";
  const channel = await requestYouTubeDataApi<YouTubeUploadsChannelResponse>(
    buildYouTubeUploadsChannelUrl({ apiBaseUrl }),
    accessToken,
  );
  const uploadsPlaylistId = getYouTubeUploadsPlaylistId(channel);

  if (!uploadsPlaylistId) {
    return [];
  }

  const playlistItems = await requestYouTubeDataApi<YouTubePlaylistItemsResponse>(
    buildYouTubeUploadsPlaylistUrl({
      apiBaseUrl,
      playlistId: uploadsPlaylistId,
    }),
    accessToken,
  );
  const videoIds = getYouTubePlaylistVideoIds(playlistItems);

  if (videoIds.length === 0) {
    return [];
  }

  const videos = await requestYouTubeDataApi<YouTubeVideosResponse>(
    buildYouTubeVideoDetailsUrl({ apiBaseUrl, videoIds }),
    accessToken,
  );

  return normalizeYouTubeUploadedVideos({ playlistItems, videos });
}

async function requestYouTubeDataApi<T>(url: URL, accessToken: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & YouTubeAnalyticsErrorEnvelope)
    | null;

  if (!response.ok || !payload || payload.error) {
    throw createYouTubeAnalyticsRequestError(response.status, payload);
  }

  return payload;
}

function createYouTubeAnalyticsRequestError(
  status: number,
  payload: YouTubeAnalyticsErrorEnvelope | null,
) {
  const providerMessage =
    typeof payload?.error?.message === "string"
      ? payload.error.message
      : "YouTube request failed.";
  const providerCode = payload?.error?.code;
  const message = [
    `HTTP ${status}`,
    providerCode === undefined ? null : `code ${String(providerCode)}`,
    providerMessage,
  ]
    .filter(Boolean)
    .join(" - ");
  const userMessage =
    status === 401 || status === 403
      ? "Reconnect YouTube to grant channel analytics access."
      : "YouTube analytics could not load right now.";

  return new YouTubeAnalyticsRequestError(message, userMessage);
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
