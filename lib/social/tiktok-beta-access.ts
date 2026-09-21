export type TikTokBetaIdentity = {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
};

/** The single approved TikTok beta account is deliberately auditable in source. */
export const TIKTOK_BETA_DEFAULT_EMAIL = "vtu19403@veltech.edu.in";

export function hasTikTokBetaAccess(
  identity: TikTokBetaIdentity | null | undefined,
) {
  if (!identity?.emailVerified || !identity.email) {
    return false;
  }

  return normalizeEmail(identity.email) === TIKTOK_BETA_DEFAULT_EMAIL;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
