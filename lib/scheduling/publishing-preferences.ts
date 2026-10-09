export type PublishingPreferences = { containsSyntheticMedia: boolean };

// Preserve the existing disclosure default until an account saves its choice.
export const DEFAULT_PUBLISHING_PREFERENCES: PublishingPreferences = {
  containsSyntheticMedia: true,
};

export function parsePublishingPreferences(value: unknown): PublishingPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => key !== "containsSyntheticMedia") ||
      !("containsSyntheticMedia" in value) || typeof value.containsSyntheticMedia !== "boolean") {
    throw new Error("Choose whether AI content disclosure is enabled by default.");
  }
  return { containsSyntheticMedia: value.containsSyntheticMedia };
}
