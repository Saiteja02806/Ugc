import type {
  SocialConnectionStatus,
  SocialPlatform,
} from "./types.ts";

type EffectiveConnectionStatusInput = {
  expiresAt: string | null;
  hasRefreshToken: boolean;
  platform: SocialPlatform;
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
    const canRefresh =
      input.platform === "youtube" && input.hasRefreshToken;

    return canRefresh ? "connected" : "expired";
  }

  return input.status;
}
