import type { SocialConnection } from "./types";

export function getConnectionRevision(connection: Pick<SocialConnection, "connectedAt" | "authorizationRevision">) {
  return connection.authorizationRevision ?? connection.connectedAt;
}

export function getConnectionsRevision(connections: SocialConnection[]) {
  return connections.map((connection) =>
    `${connection.id}:${getConnectionRevision(connection)}:${connection.status}`,
  ).sort().join("|");
}
