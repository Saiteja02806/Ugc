import "server-only";

import { SchedulingRequestError } from "@/lib/scheduling/errors";
import { isTikTokDirectPostAudited } from "@/lib/social/tiktok-direct-post-audit";
import {
  getTikTokPublishCapabilitiesForOwner,
  TikTokPublishCapabilitiesError,
} from "@/lib/social/tiktok-publish-capabilities";
import { getTikTokDirectPostBlock } from "@/worker/src/lib/tiktok-direct-post-policy";

export async function assertTikTokScheduleEligibility(params: {
  connectionId: string;
  userId: string;
  privacyLevel: string | undefined;
}) {
  if (isTikTokDirectPostAudited()) return;

  // Reject unsupported visibility before spending a creator-info request.
  let privacyLevels: string[] = [];
  if (params.privacyLevel === "SELF_ONLY") {
    try {
      const capabilities = await getTikTokPublishCapabilitiesForOwner({
        connectionId: params.connectionId,
        userId: params.userId,
      });
      privacyLevels = capabilities.privacyLevels;
    } catch (error) {
      if (error instanceof TikTokPublishCapabilitiesError) {
        throw new SchedulingRequestError(
          error.message,
          error.status,
          "tiktok_capabilities_unavailable",
        );
      }
      throw error;
    }
  }

  const block = getTikTokDirectPostBlock({
    audited: false,
    privacyLevel: params.privacyLevel,
    privacyLevels,
  });
  if (block) {
    throw new SchedulingRequestError(block.message, 409, `tiktok_${block.code}`);
  }
}
