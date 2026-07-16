import "server-only";

import { getSocialConnectionCredentialForOwner } from "@/lib/social/oauth";
import {
  isTikTokPrivacyLevel,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";

type TikTokApiEnvelope = {
  data?: {
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    max_video_post_duration_sec?: number;
    privacy_level_options?: unknown[];
    stitch_disabled?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export class TikTokPublishCapabilitiesError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 502,
  ) {
    super(message);
    this.name = "TikTokPublishCapabilitiesError";
  }
}

export async function getTikTokPublishCapabilitiesForOwner(params: {
  connectionId: string;
  userId: string;
}): Promise<TikTokPublishCapabilities> {
  const credential = await getSocialConnectionCredentialForOwner(params);

  if (!credential) {
    throw new TikTokPublishCapabilitiesError(
      "The connected TikTok account was not found.",
      404,
    );
  }

  if (credential.connection.platform !== "tiktok") {
    throw new TikTokPublishCapabilitiesError(
      "Publishing capabilities are only required for TikTok accounts.",
      400,
    );
  }

  if (
    credential.connection.status !== "connected" ||
    !credential.connection.scopes.includes("video.publish")
  ) {
    throw new TikTokPublishCapabilitiesError(
      "Reconnect TikTok with publishing permission before scheduling.",
      409,
    );
  }

  const response = await fetch(
    new URL(
      "/v2/post/publish/creator_info/query/",
      process.env.TIKTOK_API_BASE_URL?.trim() ||
        "https://open.tiktokapis.com",
    ),
    {
      body: "{}",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | TikTokApiEnvelope
    | null;

  if (!response.ok || !payload || payload.error?.code !== "ok" || !payload.data) {
    const reconnectRequired = response.status === 401 || response.status === 403;

    throw new TikTokPublishCapabilitiesError(
      reconnectRequired
        ? "Reconnect TikTok before choosing publishing settings."
        : "TikTok publishing settings could not be loaded. Try again.",
      reconnectRequired ? 409 : 502,
    );
  }

  const privacyLevels = Array.from(
    new Set(
      (payload.data.privacy_level_options ?? []).filter(
        isTikTokPrivacyLevel,
      ),
    ),
  );

  if (privacyLevels.length === 0) {
    throw new TikTokPublishCapabilitiesError(
      "TikTok did not return any available visibility settings.",
      502,
    );
  }

  const maxDuration = payload.data.max_video_post_duration_sec;

  return {
    interactions: {
      commentsDisabled: payload.data.comment_disabled === true,
      duetsDisabled: payload.data.duet_disabled === true,
      stitchesDisabled: payload.data.stitch_disabled === true,
    },
    maxVideoDurationSeconds:
      typeof maxDuration === "number" &&
      Number.isFinite(maxDuration) &&
      maxDuration > 0
        ? maxDuration
        : null,
    privacyLevels,
  };
}
