import type {
  SocialConnectionStatus,
  SocialPlatform,
} from "./types.ts";

type EffectiveConnectionStatusInput = {
  expiresAt: string | null;
  hasRefreshToken: boolean;
  platform: SocialPlatform;
  refreshExpiresAt?: string | null;
  revokedAt: string | null;
  status: SocialConnectionStatus;
};

export function getEffectiveSocialConnectionStatus(
  input: EffectiveConnectionStatusInput,
  now = Date.now(),
): SocialConnectionStatus {
  if (input.revokedAt || input.status === "revoked") {
    return "revoked";
  }

  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  const isExpired = Number.isFinite(expiresAt) && expiresAt <= now;

  if (input.status === "connected" && isExpired) {
    const refreshExpiresAt = input.refreshExpiresAt
      ? Date.parse(input.refreshExpiresAt)
      : Number.NaN;
    const refreshTokenExpired =
      Number.isFinite(refreshExpiresAt) && refreshExpiresAt <= now;
    const canRefresh =
      (input.platform === "youtube" || input.platform === "tiktok") &&
      input.hasRefreshToken &&
      !refreshTokenExpired;

    return canRefresh ? "connected" : "expired";
  }

  return input.status;
}
