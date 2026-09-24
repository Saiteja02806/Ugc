export type TikTokBetaIdentity = {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
};

/** Approved TikTok beta identities are deliberately auditable in source. */
export const TIKTOK_BETA_APPROVED_EMAILS: readonly string[] = [
  "vtu19403@veltech.edu.in",
  "m28013655@gmail.com",
];

export function hasTikTokBetaAccess(
  identity: TikTokBetaIdentity | null | undefined,
) {
  if (!identity?.emailVerified || !identity.email) {
    return false;
  }

  return TIKTOK_BETA_APPROVED_EMAILS.includes(normalizeEmail(identity.email));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
