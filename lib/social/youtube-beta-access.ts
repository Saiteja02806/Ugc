export type YouTubeBetaIdentity = {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
};

/** Approved YouTube beta identities are deliberately auditable in source. */
export const YOUTUBE_BETA_APPROVED_EMAILS: readonly string[] = [
  "vtu19403@veltech.edu.in",
  "m28013655@gmail.com",
];

export function hasYouTubeBetaAccess(
  identity: YouTubeBetaIdentity | null | undefined,
) {
  if (!identity?.emailVerified || !identity.email) {
    return false;
  }

  return YOUTUBE_BETA_APPROVED_EMAILS.includes(normalizeEmail(identity.email));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
