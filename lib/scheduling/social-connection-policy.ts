import type { SocialConnection } from "../social/types.ts";

const requiredInstagramPublishScopes = new Set([
  "instagram_business_content_publish",
  "instagram_content_publish",
]);
const requiredTikTokPublishScopes = new Set(["video.publish"]);
const requiredYouTubePublishScopes = new Set([
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtubepartner",
]);

type PublishingConnection = Pick<
  SocialConnection,
  "platform" | "scopes" | "status"
> & {
  supportsBackgroundRefresh?: boolean;
};

export type InstagramSchedulingAccessState =
  | "connect"
  | "ready"
  | "reconnect";

export function getInstagramSchedulingAccessState(
  connections: readonly PublishingConnection[],
): InstagramSchedulingAccessState {
  const instagramConnections = connections.filter(
    (connection) => connection.platform === "instagram",
  );

  if (
    instagramConnections.some(
      (connection) => getConnectionPublishingBlock(connection) === null,
    )
  ) {
    return "ready";
  }

  return instagramConnections.length > 0 ? "reconnect" : "connect";
}

export function getConnectionPublishingBlock(
  connection: PublishingConnection,
) {
  const platformName = getPlatformName(connection.platform);

  if (connection.status === "expired") {
    return {
      code: "social_connection_unavailable",
      message: `${platformName} access expired. Reconnect to schedule posts.`,
    };
  }

  if (connection.status !== "connected") {
    return {
      code: "social_connection_unavailable",
      message: `Reconnect ${platformName} before scheduling.`,
    };
  }

  if (
    connection.platform === "instagram" &&
    !hasOneRequiredScope(connection.scopes, requiredInstagramPublishScopes)
  ) {
    return {
      code: "provider_permission_missing",
      message: "Reconnect Instagram to allow scheduled publishing.",
    };
  }

  if (
    connection.platform === "tiktok" &&
    !hasOneRequiredScope(connection.scopes, requiredTikTokPublishScopes)
  ) {
    return {
      code: "provider_permission_missing",
      message: "Reconnect TikTok to grant publishing permission.",
    };
  }

  if (
    connection.platform === "youtube" &&
    !hasOneRequiredScope(connection.scopes, requiredYouTubePublishScopes)
  ) {
    return {
      code: "provider_permission_missing",
      message: "Reconnect YouTube to allow video uploads.",
    };
  }

  if (
    connection.platform === "youtube" &&
    connection.supportsBackgroundRefresh === false
  ) {
    return {
      code: "youtube_refresh_token_missing",
      message:
        "Reconnect YouTube so scheduled posts can publish after you leave.",
    };
  }

  return null;
}

export function getConnectionPublishingBlockMessage(
  connection: PublishingConnection,
) {
  return getConnectionPublishingBlock(connection)?.message ?? null;
}

function hasOneRequiredScope(scopes: string[], requiredScopes: Set<string>) {
  return scopes.some((scope) => requiredScopes.has(scope));
}

function getPlatformName(platform: SocialConnection["platform"]) {
  if (platform === "instagram") return "Instagram";
  if (platform === "tiktok") return "TikTok";
  return "YouTube";
}
