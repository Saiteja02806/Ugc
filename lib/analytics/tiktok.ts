import "server-only";

import {
  getSocialConnectionCredentialForOwner,
  listSocialConnections,
  SocialOAuthError,
} from "@/lib/social/oauth";
import { hasTikTokAnalyticsScope } from "@/lib/social/tiktok-oauth-config";

const tiktokVideoAnalyticsFields = [
  "id",
  "title",
  "video_description",
  "cover_image_url",
  "share_url",
  "create_time",
  "view_count",
  "like_count",
  "comment_count",
  "share_count",
] as const;

export type TikTokAnalyticsAccountStatus =
  | "error"
  | "permission_missing"
  | "ready"
  | "unavailable";

export type TikTokVideoAnalytics = {
  commentCount: number | null;
  coverImageUrl: string | null;
  createdAt: string | null;
  description: string | null;
  id: string;
  likeCount: number | null;
  shareCount: number | null;
  shareUrl: string | null;
  title: string | null;
  viewCount: number | null;
};

export type TikTokAnalyticsAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  status: TikTokAnalyticsAccountStatus;
  videos: TikTokVideoAnalytics[];
};

type TikTokVideoListEnvelope = {
  data?: {
    cursor?: number;
    has_more?: boolean;
    video_list?: unknown[];
    videos?: unknown[];
  };
  error?: {
    code?: string;
    log_id?: string;
    message?: string;
  };
};

type TikTokVideoObject = {
  comment_count?: unknown;
  cover_image_url?: unknown;
  create_time?: unknown;
  id?: unknown;
  like_count?: unknown;
  share_count?: unknown;
  share_url?: unknown;
  title?: unknown;
  video_description?: unknown;
  view_count?: unknown;
};

export async function listTikTokPublicVideoAnalyticsForOwner(params: {
  userId: string;
}): Promise<TikTokAnalyticsAccount[]> {
  const connections = await listSocialConnections(params.userId);
  const tiktokConnections = connections.filter(
    (connection) => connection.platform === "tiktok",
  );

  return Promise.all(
    tiktokConnections.map(async (connection): Promise<TikTokAnalyticsAccount> => {
      const baseAccount = {
        accountName: connection.platformAccountName,
        accountUsername: connection.platformAccountUsername,
        connectionId: connection.id,
        lastSyncedAt: null,
        videos: [],
      };

      if (connection.status !== "connected") {
        return {
          ...baseAccount,
          message: "Reconnect TikTok before loading analytics.",
          status: "unavailable",
        };
      }

      if (!hasTikTokAnalyticsScope(connection.scopes)) {
        return {
          ...baseAccount,
          message: "Reconnect TikTok to grant analytics access.",
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
              : "TikTok analytics could not load for this account.",
          status: "error",
        };
      }

      if (!credential || credential.connection.platform !== "tiktok") {
        return {
          ...baseAccount,
          message: "The connected TikTok account was not found.",
          status: "unavailable",
        };
      }

      if (!hasTikTokAnalyticsScope(credential.connection.scopes)) {
        return {
          ...baseAccount,
          message: "Reconnect TikTok to grant analytics access.",
          status: "permission_missing",
        };
      }

      try {
        const videos = await requestTikTokPublicVideos(credential.accessToken);

        return {
          accountName: credential.connection.platformAccountName,
          accountUsername: credential.connection.platformAccountUsername,
          connectionId: credential.connection.id,
          lastSyncedAt: new Date().toISOString(),
          message:
            videos.length > 0
              ? null
              : "No public TikTok videos were returned for this connected account.",
          status: "ready",
          videos,
        };
      } catch (error) {
        return {
          ...baseAccount,
          message:
            error instanceof TikTokAnalyticsRequestError
              ? error.userMessage
              : "TikTok analytics could not load for this account.",
          status: "error",
        };
      }
    }),
  );
}

class TikTokAnalyticsRequestError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = "TikTokAnalyticsRequestError";
  }
}

async function requestTikTokPublicVideos(accessToken: string) {
  const url = new URL(
    "/v2/video/list/",
    process.env.TIKTOK_API_BASE_URL?.trim() || "https://open.tiktokapis.com",
  );
  url.searchParams.set("fields", tiktokVideoAnalyticsFields.join(","));

  const response = await fetch(url, {
    body: JSON.stringify({ max_count: 20 }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | TikTokVideoListEnvelope
    | null;
  const errorCode = payload?.error?.code;

  if (!response.ok || !payload || (errorCode && errorCode !== "ok")) {
    const message = [
      `HTTP ${response.status}`,
      errorCode ? `code ${errorCode}` : null,
      payload?.error?.message || "TikTok video analytics request failed.",
      payload?.error?.log_id ? `log ${payload.error.log_id}` : null,
    ]
      .filter(Boolean)
      .join(" - ");
    const userMessage =
      response.status === 401 || response.status === 403
        ? "Reconnect TikTok to grant analytics access."
        : "TikTok analytics could not load right now.";

    throw new TikTokAnalyticsRequestError(message, userMessage);
  }

  const rawVideos = payload.data?.videos ?? payload.data?.video_list ?? [];

  return rawVideos
    .map(normalizeTikTokVideo)
    .filter((video): video is TikTokVideoAnalytics => video !== null);
}

function normalizeTikTokVideo(value: unknown): TikTokVideoAnalytics | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const video = value as TikTokVideoObject;
  const id = getString(video.id);

  if (!id) {
    return null;
  }

  return {
    commentCount: getNonNegativeNumber(video.comment_count),
    coverImageUrl: getHttpsUrl(video.cover_image_url),
    createdAt: getTikTokCreatedAt(video.create_time),
    description: getString(video.video_description),
    id,
    likeCount: getNonNegativeNumber(video.like_count),
    shareCount: getNonNegativeNumber(video.share_count),
    shareUrl: getHttpsUrl(video.share_url),
    title: getString(video.title),
    viewCount: getNonNegativeNumber(video.view_count),
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getHttpsUrl(value: unknown) {
  const candidate = getString(value);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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

function getTikTokCreatedAt(value: unknown) {
  const timestamp = getNonNegativeNumber(value);

  if (timestamp === null) {
    return null;
  }

  const milliseconds = timestamp > 1_000_000_000_000
    ? timestamp
    : timestamp * 1000;
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
