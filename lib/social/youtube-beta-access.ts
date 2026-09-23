export type YouTubeBetaIdentity = {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
};

/** The single approved YouTube beta account is deliberately auditable in source. */
export const YOUTUBE_BETA_DEFAULT_EMAIL = "vtu19403@veltech.edu.in";

export function hasYouTubeBetaAccess(
  identity: YouTubeBetaIdentity | null | undefined,
) {
  if (!identity?.emailVerified || !identity.email) {
    return false;
  }

  return normalizeEmail(identity.email) === YOUTUBE_BETA_DEFAULT_EMAIL;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
