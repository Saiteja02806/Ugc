import type {
  ScheduleCreateTargetInput,
  SchedulePlatform,
} from "@/lib/scheduling/types";
import type { SocialConnection } from "@/lib/social/types";

type ConnectionIdentity = Pick<
  SocialConnection,
  "id" | "platform" | "status"
>;

export function getInitialScheduleConnectionIds(params: {
  connections: ConnectionIdentity[];
  isCarouselSchedule: boolean;
  plannedPlatforms: SchedulePlatform[];
  plannedTargets: ScheduleCreateTargetInput[];
}) {
  const activeConnections = params.connections.filter(
    (connection) => connection.status !== "revoked",
  );
  const allowedConnections = params.isCarouselSchedule
    ? activeConnections.filter((connection) =>
        supportsCarouselPublishing(connection.platform),
      )
    : activeConnections;
  const allowedConnectionIds = new Set(
    allowedConnections.map((connection) => connection.id),
  );
  const savedConnectionIds = params.plannedTargets
    .map((target) => target.connectionId)
    .filter((connectionId) => allowedConnectionIds.has(connectionId));

  // A saved target snapshot is authoritative. If its account is unavailable,
  // do not silently select a different connected account as a replacement.
  if (params.plannedTargets.length > 0) {
    return [...new Set(savedConnectionIds)];
  }

  return params.plannedPlatforms.flatMap((platform) => {
    const connection = allowedConnections.find(
      (candidate) =>
        candidate.platform === platform && candidate.status === "connected",
    );

    return connection ? [connection.id] : [];
  });
}

export function getUnavailableSavedInstagramTargets(params: {
  connections: ConnectionIdentity[];
  plannedTargets: ScheduleCreateTargetInput[];
}) {
  const connectionById = new Map(
    params.connections.map((connection) => [connection.id, connection]),
  );

  return params.plannedTargets.filter((target) => {
    const connection = connectionById.get(target.connectionId);
    const platform = target.platform ?? connection?.platform;

    return (
      (platform === undefined || platform === "instagram") &&
      (!connection ||
        connection.platform !== "instagram" ||
        connection.status === "revoked")
    );
  });
}

export function getSocialConnectionAccountLabel(
  connection: Pick<
    SocialConnection,
    | "platformAccountId"
    | "platformAccountName"
    | "platformAccountUsername"
  >,
) {
  const username = connection.platformAccountUsername?.trim();

  if (username) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  return (
    connection.platformAccountName?.trim() || connection.platformAccountId.trim()
  );
}

function supportsCarouselPublishing(platform: SchedulePlatform) {
  return platform === "instagram" || platform === "tiktok";
}
