export const tiktokPrivacyLevels = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;

export type TikTokPrivacyLevel = (typeof tiktokPrivacyLevels)[number];

export const TIKTOK_PRIVATE_TESTING_VISIBILITY_MESSAGE =
  "Public TikTok posting will be available after UGC Pilot's TikTok Direct Post audit is approved. For a private test, choose Only me and make the TikTok account private.";

export type TikTokPublishCapabilities = {
  creatorNickname: string | null;
  creatorUsername: string | null;
  /** Whether TikTok has approved this client to Direct Post beyond private testing. */
  directPostAudited: boolean;
  interactions: {
    commentsDisabled: boolean;
    duetsDisabled: boolean;
    stitchesDisabled: boolean;
  };
  maxVideoDurationSeconds: number | null;
  privacyLevels: TikTokPrivacyLevel[];
};

export function isTikTokPrivacyLevel(
  value: unknown,
): value is TikTokPrivacyLevel {
  return tiktokPrivacyLevels.includes(value as TikTokPrivacyLevel);
}

export function getTikTokPrivacyLabel(value: TikTokPrivacyLevel) {
  const labels: Record<TikTokPrivacyLevel, string> = {
    FOLLOWER_OF_CREATOR: "Followers",
    MUTUAL_FOLLOW_FRIENDS: "Friends",
    PUBLIC_TO_EVERYONE: "Everyone",
    SELF_ONLY: "Only me",
  };

  return labels[value];
}
