export const socialPlatforms = ["instagram", "tiktok", "youtube"] as const;
export const socialProviders = ["meta", "tiktok", "google"] as const;
export const socialOAuthReturnTargets = [
  "accounts",
  "library",
  "trending",
] as const;
export const socialOAuthIntents = ["add", "reconnect"] as const;

export type SocialPlatform = (typeof socialPlatforms)[number];
export type SocialProvider = (typeof socialProviders)[number];
export type SocialOAuthReturnTo = (typeof socialOAuthReturnTargets)[number];
export type SocialOAuthIntent = (typeof socialOAuthIntents)[number];
export type SocialConnectionStatus =
  | "connected"
  | "error"
  | "expired"
  | "permission_missing"
  | "revoked";

export type SocialConnection = {
  connectedAt: string;
  expiresAt: string | null;
  id: string;
  platform: SocialPlatform;
  platformAccountId: string;
  platformAccountName: string | null;
  platformAccountUsername: string | null;
  profilePictureUrl: string | null;
  provider: SocialProvider;
  refreshExpiresAt: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  supportsBackgroundRefresh: boolean;
  tokenRefreshedAt: string | null;
  updatedAt: string;
};

export type SocialOAuthResultMessage = {
  callbackHost?: string;
  connectionId?: string;
  correlationId?: string;
  errorCode?: string;
  failedStage?: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  status: "error" | "success";
  type: "ugc-social-oauth-result";
};

const providerByPlatform: Record<SocialPlatform, SocialProvider> = {
  instagram: "meta",
  tiktok: "tiktok",
  youtube: "google",
};

export function getProviderForPlatform(platform: SocialPlatform) {
  return providerByPlatform[platform];
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return socialPlatforms.includes(value as SocialPlatform);
}

export function isSocialProvider(value: string): value is SocialProvider {
  return socialProviders.includes(value as SocialProvider);
}

export function isSocialOAuthReturnTo(
  value: string,
): value is SocialOAuthReturnTo {
  return socialOAuthReturnTargets.includes(value as SocialOAuthReturnTo);
}

export function isSocialOAuthIntent(value: string): value is SocialOAuthIntent {
  return socialOAuthIntents.includes(value as SocialOAuthIntent);
}

export function isProviderPlatformPair(
  provider: SocialProvider,
  platform: SocialPlatform,
) {
  return providerByPlatform[platform] === provider;
}

export function isSocialOAuthResultMessage(
  value: unknown,
): value is SocialOAuthResultMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<SocialOAuthResultMessage>;

  return (
    message.type === "ugc-social-oauth-result" &&
    typeof message.platform === "string" &&
    isSocialPlatform(message.platform) &&
    typeof message.provider === "string" &&
    isSocialProvider(message.provider) &&
    (message.connectionId === undefined ||
      typeof message.connectionId === "string") &&
    (message.status === "success" || message.status === "error")
  );
}
