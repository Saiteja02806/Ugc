import "server-only";

import { resolveTikTokDirectPostAuditStatus } from "@/worker/src/lib/tiktok-direct-post-policy";

/**
 * TikTok Direct Post is approved for general availability. Private-testing
 * environments may explicitly override it. This is server-only: the client
 * receives the derived state alongside the creator capabilities.
 */
export function isTikTokDirectPostAudited() {
  return resolveTikTokDirectPostAuditStatus(process.env.TIKTOK_DIRECT_POST_AUDITED);
}

export const TIKTOK_DIRECT_POST_AUDIT_REQUIRED_MESSAGE =
  "Public TikTok posting will be available after UGC Pilot's TikTok Direct Post audit is approved. For a private test, choose Only me and make the TikTok account private.";
