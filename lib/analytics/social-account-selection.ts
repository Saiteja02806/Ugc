import type {
  SocialConnection,
  SocialPlatform,
} from "@/lib/social/types";

export function getConnectionsForAnalyticsPlatform(
  connections: SocialConnection[],
  platform: SocialPlatform,
) {
  return connections.filter((connection) => connection.platform === platform);
}

export function getEffectiveAnalyticsConnectionId(
  connections: SocialConnection[],
  selectedConnectionId: string,
) {
  if (selectedConnectionId === "all") {
    return "all";
  }

  return connections.some((connection) => connection.id === selectedConnectionId)
    ? selectedConnectionId
    : "all";
}

export function getSocialConnectionAnalyticsLabel(connection: SocialConnection) {
  const username = connection.platformAccountUsername?.trim();

  if (username) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  return connection.platformAccountName?.trim() || "Connected account";
}
