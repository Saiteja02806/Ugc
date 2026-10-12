export type PublishingPreferences = {
  containsSyntheticMedia: boolean;
  tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE" | "SELF_ONLY" | "FOLLOWER_OF_CREATOR" | "MUTUAL_FOLLOW_FRIENDS";
  tiktokAllowComments: boolean;
  youtubePrivacyStatus: "public" | "private" | "unlisted";
  youtubeMadeForKids: boolean;
  youtubeNotifySubscribers: boolean;
};

export type PublishingPreferencesUpdate = Partial<PublishingPreferences>;

// Preserve the existing disclosure default until an account saves its choice.
export const DEFAULT_PUBLISHING_PREFERENCES: PublishingPreferences = {
  containsSyntheticMedia: true,
  tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE",
  tiktokAllowComments: true,
  youtubePrivacyStatus: "public",
  youtubeMadeForKids: false,
  youtubeNotifySubscribers: false,
};

export function parsePublishingPreferences(value: unknown): PublishingPreferences {
  const update = parsePublishingPreferencesUpdate(value);
  if (typeof update.containsSyntheticMedia !== "boolean") {
    throw new Error("Choose a valid AI content disclosure default.");
  }
  // Older responses contain only AI disclosure; keep them readable during rollout.
  return { ...DEFAULT_PUBLISHING_PREFERENCES, ...update };
}

export function parsePublishingPreferencesUpdate(value: unknown): PublishingPreferencesUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Choose valid publishing defaults.");
  }
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([key, setting]) => {
    if (key === "tiktokPrivacyLevel") {
      return typeof setting !== "string" || !["PUBLIC_TO_EVERYONE", "SELF_ONLY", "FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS"].includes(setting);
    }
    if (key === "youtubePrivacyStatus") {
      return setting !== "public" && setting !== "private" && setting !== "unlisted";
    }
    return !["containsSyntheticMedia", "tiktokAllowComments", "youtubeMadeForKids", "youtubeNotifySubscribers"].includes(key)
      || typeof setting !== "boolean";
  })) {
    throw new Error("Choose valid publishing defaults.");
  }
  return Object.fromEntries(entries) as PublishingPreferencesUpdate;
}
