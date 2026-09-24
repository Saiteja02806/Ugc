import type { SocialConnection, SocialPlatform } from "../social/types.ts";

/** Missing platforms remain discoverable without treating disconnected accounts as usable. */
export function getMissingScheduleAccountPlatforms(
  enabledPlatforms: readonly SocialPlatform[],
  connections: ReadonlyArray<Pick<SocialConnection, "platform" | "status">>,
) {
  return enabledPlatforms.filter(
    platform => !connections.some(
      connection => connection.platform === platform && connection.status !== "revoked",
    ),
  );
}
