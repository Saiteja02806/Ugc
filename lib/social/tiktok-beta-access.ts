export type TikTokBetaIdentity = {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
};

/**
 * TikTok is available to every verified user. Keep the legacy helper name so
 * OAuth, scheduling, retries, and analytics share the same rollout policy.
 */
export function hasTikTokBetaAccess(
  identity: TikTokBetaIdentity | null | undefined,
) {
  return identity?.emailVerified === true;
}
