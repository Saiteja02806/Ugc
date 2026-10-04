import { hasTikTokBetaAccess, type TikTokBetaIdentity } from "./tiktok-beta-access";
import { socialPlatforms, type SocialPlatform } from "./types";

/** UI rollout only. Keep provider APIs, credentials and saved targets intact. */
export const socialPlatformVisibility: Readonly<Record<SocialPlatform, boolean>> = {
  instagram: true,
  // Restore this after content-posting API access is approved.
  tiktok: false,
  youtube: true,
};

export function isSocialPlatformVisible(platform: SocialPlatform) {
  return socialPlatformVisibility[platform];
}

export function hasTikTokUiAccess(identity: TikTokBetaIdentity | null | undefined) {
  return isSocialPlatformVisible("tiktok") && hasTikTokBetaAccess(identity);
}

const platformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const visibleSocialPlatforms = socialPlatforms.filter(isSocialPlatformVisible);
export const visibleSocialPlatformLabels = visibleSocialPlatforms.map(
  (platform) => platformLabels[platform],
);
export const visibleSocialPlatformList = visibleSocialPlatformLabels.length > 2
  ? `${visibleSocialPlatformLabels.slice(0, -1).join(", ")}, and ${visibleSocialPlatformLabels.at(-1)}`
  : visibleSocialPlatformLabels.join(" and ");
