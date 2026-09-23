import "server-only";

/**
 * TikTok Direct Post keeps unaudited clients in private-testing mode. This is
 * intentionally server-only: the client receives the derived state alongside
 * the creator capabilities instead of being trusted to decide publish access.
 */
export function isTikTokDirectPostAudited() {
  return process.env.TIKTOK_DIRECT_POST_AUDITED?.trim().toLowerCase() === "true";
}

export const TIKTOK_DIRECT_POST_AUDIT_REQUIRED_MESSAGE =
  "Public TikTok posting will be available after UGC Pilot's TikTok Direct Post audit is approved. For a private test, choose Only me and make the TikTok account private.";
