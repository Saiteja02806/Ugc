import type { Json } from "../types.js";

export type InstagramTargetPublishSettings = {
  shareToFeed?: boolean;
};

export type TikTokTargetPublishSettings = {
  allowComment?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
  brandOrganic?: boolean;
  brandedContent?: boolean;
  privacyLevel?:
    | "FOLLOWER_OF_CREATOR"
    | "MUTUAL_FOLLOW_FRIENDS"
    | "PUBLIC_TO_EVERYONE"
    | "SELF_ONLY";
};

export type YouTubeTargetPublishSettings = {
  containsSyntheticMedia?: boolean;
  madeForKids?: boolean;
  notifySubscribers?: boolean;
  privacyStatus?: "private" | "public" | "unlisted";
};

const tiktokPrivacyLevels = new Set([
  "FOLLOWER_OF_CREATOR",
  "MUTUAL_FOLLOW_FRIENDS",
  "PUBLIC_TO_EVERYONE",
  "SELF_ONLY",
]);

export function getInstagramTargetPublishSettings(
  value: Json,
): InstagramTargetPublishSettings {
  const settings = getRecord(value);

  return {
    shareToFeed: getOptionalBoolean(settings.shareToFeed),
  };
}

export function getTikTokTargetPublishSettings(
  value: Json,
): TikTokTargetPublishSettings {
  const settings = getRecord(value);
  const privacyLevel = getOptionalString(settings.privacyLevel);

  if (privacyLevel && !tiktokPrivacyLevels.has(privacyLevel)) {
    throw new Error("TikTok publishing settings contain invalid visibility.");
  }

  return {
    allowComment: getOptionalBoolean(settings.allowComment),
    allowDuet: getOptionalBoolean(settings.allowDuet),
    allowStitch: getOptionalBoolean(settings.allowStitch),
    brandOrganic: getOptionalBoolean(settings.brandOrganic),
    brandedContent: getOptionalBoolean(settings.brandedContent),
    privacyLevel:
      privacyLevel as TikTokTargetPublishSettings["privacyLevel"],
  };
}

export function getYouTubeTargetPublishSettings(
  value: Json,
): YouTubeTargetPublishSettings {
  const settings = getRecord(value);
  const privacyStatus = getOptionalString(settings.privacyStatus);

  if (
    privacyStatus &&
    privacyStatus !== "private" &&
    privacyStatus !== "unlisted" &&
    privacyStatus !== "public"
  ) {
    throw new Error("YouTube publishing settings contain invalid visibility.");
  }

  return {
    containsSyntheticMedia: getOptionalBoolean(
      settings.containsSyntheticMedia,
    ),
    madeForKids: getOptionalBoolean(settings.madeForKids),
    notifySubscribers: getOptionalBoolean(settings.notifySubscribers),
    privacyStatus:
      privacyStatus as YouTubeTargetPublishSettings["privacyStatus"],
  };
}

function getRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getOptionalBoolean(value: Json | undefined) {
  return typeof value === "boolean" ? value : undefined;
}

function getOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
