export type YouTubeBetaIdentity = {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
};

/**
 * YouTube is available to every verified user. Keep the legacy helper name so
 * OAuth, scheduling, retries, and analytics share the same rollout policy.
 */
export function hasYouTubeBetaAccess(
  identity: YouTubeBetaIdentity | null | undefined,
) {
  return identity?.emailVerified === true;
}
