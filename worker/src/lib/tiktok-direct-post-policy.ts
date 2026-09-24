// Dependency-free policy shared with the web scheduler. Kept in the worker
// source tree so the independently built worker can compile it unchanged.
export const TIKTOK_PRIVATE_ACCOUNT_REQUIRED_MESSAGE =
  "TikTok requires a private account and Only me post visibility while UGC Pilot's Direct Post app is unaudited. Set the selected TikTok account to private in TikTok, or choose a private connected account, then try again. Only me alone is not enough.";

export const TIKTOK_ACCOUNT_PRIVACY_UNAVAILABLE_MESSAGE =
  "TikTok did not confirm that this account is private. Refresh the account's publishing settings and try again. Private testing requires both a private TikTok account and Only me visibility.";

export function getTikTokDirectPostBlock(params: {
  audited: boolean;
  privacyLevel: string | undefined;
  privacyLevels: readonly string[];
}): { code: string; message: string } | null {
  if (params.audited) return null;

  if (params.privacyLevel !== "SELF_ONLY") {
    return {
      code: "direct_post_audit_required",
      message:
        "Public TikTok posting will be available after UGC Pilot's TikTok Direct Post audit is approved. For a private test, choose Only me and make the TikTok account private.",
    };
  }

  // TikTok documents PUBLIC_TO_EVERYONE for public accounts and
  // FOLLOWER_OF_CREATOR for private accounts. SELF_ONLY describes a post,
  // not the account. Missing/ambiguous options must not imply private.
  if (params.privacyLevels.includes("PUBLIC_TO_EVERYONE")) {
    return {
      code: "private_account_required",
      message: TIKTOK_PRIVATE_ACCOUNT_REQUIRED_MESSAGE,
    };
  }
  if (!params.privacyLevels.includes("FOLLOWER_OF_CREATOR")) {
    return {
      code: "account_privacy_unavailable",
      message: TIKTOK_ACCOUNT_PRIVACY_UNAVAILABLE_MESSAGE,
    };
  }
  return null;
}
