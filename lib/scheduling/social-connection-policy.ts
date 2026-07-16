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

export function getConnectionPublishingBlockMessage(
  connection: Pick<SocialConnection, "platform" | "scopes" | "status">,
) {
  const platformName = getPlatformName(connection.platform);

  if (connection.status === "expired") {
    return `${platformName} access expired. Reconnect to schedule posts.`;
  }

  if (connection.status !== "connected") {
    return `Reconnect ${platformName} before scheduling.`;
  }

  if (
    connection.platform === "instagram" &&
    !hasOneRequiredScope(connection.scopes, requiredInstagramPublishScopes)
  ) {
    return "Reconnect Instagram to allow scheduled publishing.";
  }

  if (
    connection.platform === "tiktok" &&
    !hasOneRequiredScope(connection.scopes, requiredTikTokPublishScopes)
  ) {
    return "Reconnect TikTok to grant publishing permission.";
  }

  if (
    connection.platform === "youtube" &&
    !hasOneRequiredScope(connection.scopes, requiredYouTubePublishScopes)
  ) {
    return "Reconnect YouTube to allow video uploads.";
  }

  return null;
}

function hasOneRequiredScope(scopes: string[], requiredScopes: Set<string>) {
  return scopes.some((scope) => requiredScopes.has(scope));
}

function getPlatformName(platform: SocialConnection["platform"]) {
  if (platform === "instagram") return "Instagram";
  if (platform === "tiktok") return "TikTok";
  return "YouTube";
}
