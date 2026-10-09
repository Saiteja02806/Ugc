import {
  isTikTokPrivacyLevel,
  TIKTOK_PRIVATE_TESTING_VISIBILITY_MESSAGE,
  type TikTokPrivacyLevel,
  type TikTokPublishCapabilities,
} from "../social/tiktok-publishing.ts";
import type { SchedulePlatform } from "./types.ts";

export type ScheduleTargetSettings = Record<
  string,
  boolean | number | string
>;

export type InstagramScheduleSettings = {
  shareToFeed: boolean;
};

export type TikTokScheduleSettings = {
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  brandOrganic: boolean;
  brandedContent: boolean;
  containsSyntheticMedia: boolean;
  musicUsageConfirmed: boolean;
  privacyLevel: TikTokPrivacyLevel;
};

export type YouTubeScheduleSettings = {
  containsSyntheticMedia: boolean;
  madeForKids: boolean;
  notifySubscribers: boolean;
  privacyStatus: "private" | "public" | "unlisted";
};

export type TikTokScheduleCapabilityState =
  | { status: "idle" }
  | { status: "loading" }
  | { capabilities: TikTokPublishCapabilities; status: "ready" }
  | { message: string; status: "error" };

export class SchedulePlatformSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulePlatformSettingsError";
  }
}

export function getDefaultScheduleTargetSettings(
  platform: SchedulePlatform,
): ScheduleTargetSettings {
  if (platform === "instagram") {
    return { shareToFeed: true };
  }

  if (platform === "tiktok") {
    return {
      allowComment: false,
      allowDuet: false,
      allowStitch: false,
      brandOrganic: true,
      brandedContent: false,
      commercialContentDisclosureEnabled: true,
      containsSyntheticMedia: true,
      musicUsageConfirmed: true,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    };
  }

  return {
    containsSyntheticMedia: true,
    madeForKids: false,
    notifySubscribers: false,
    privacyStatus: "private",
  };
}

/** Apply music acknowledgement only when the user confirms the final schedule. */
export function getConfirmedScheduleTargetSettings(
  platform: SchedulePlatform,
  settings?: ScheduleTargetSettings,
): ScheduleTargetSettings {
  const current = settings ?? getDefaultScheduleTargetSettings(platform);
  return platform === "tiktok"
    ? { ...current, musicUsageConfirmed: true }
    : current;
}

export function getTikTokPublishingAgreement(params: {
  connections: Array<{ id: string; platform: SchedulePlatform }>;
  settings: Record<string, ScheduleTargetSettings>;
}) {
  const tiktokConnections = params.connections.filter(
    (connection) => connection.platform === "tiktok",
  );
  if (!tiktokConnections.length) {
    return null;
  }
  return tiktokConnections.some(
    (connection) => params.settings[connection.id]?.brandedContent === true,
  )
    ? "By confirming this schedule, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
    : "By confirming this schedule, you agree to TikTok's Music Usage Confirmation.";
}

export function getScheduleTargetSettingsError(params: {
  connections: Array<{ id: string; platform: SchedulePlatform }>;
  requireTikTokMusicConfirmation?: boolean;
  settings: Record<string, ScheduleTargetSettings>;
  tiktokCapabilities: Record<
    string,
    TikTokScheduleCapabilityState | undefined
  >;
}) {
  for (const connection of params.connections) {
    if (connection.platform !== "tiktok") {
      continue;
    }

    const capabilityState = params.tiktokCapabilities[connection.id];

    if (
      !capabilityState ||
      capabilityState.status === "idle" ||
      capabilityState.status === "loading"
    ) {
      return "Wait for TikTok publishing settings to finish loading.";
    }

    if (capabilityState.status === "error") {
      return capabilityState.message;
    }

    const settings =
      params.settings[connection.id] ??
      getDefaultScheduleTargetSettings("tiktok");
    const privacyLevel = settings.privacyLevel;

    if (!isTikTokPrivacyLevel(privacyLevel)) {
      return "Choose who can view the TikTok post.";
    }

    if (!capabilityState.capabilities.privacyLevels.includes(privacyLevel)) {
      return "Choose a TikTok visibility available for this account.";
    }

    if (
      !capabilityState.capabilities.directPostAudited &&
      privacyLevel !== "SELF_ONLY"
    ) {
      return TIKTOK_PRIVATE_TESTING_VISIBILITY_MESSAGE;
    }

    if (
      params.requireTikTokMusicConfirmation !== false &&
      settings.musicUsageConfirmed !== true
    ) {
      return "Confirm TikTok's Music Usage Confirmation before scheduling.";
    }

    if (
      settings.commercialContentDisclosureEnabled === true &&
      settings.brandOrganic !== true &&
      settings.brandedContent !== true
    ) {
      return "Choose Your brand or Branded content before scheduling.";
    }

    if (settings.brandedContent === true && privacyLevel === "SELF_ONLY") {
      return "TikTok paid partnerships cannot use Only me visibility.";
    }
  }

  return null;
}

export function normalizeScheduleTargetSettings(
  platform: SchedulePlatform,
  value: unknown,
): ScheduleTargetSettings {
  const settings = getRecord(value);

  if (platform === "instagram") {
    return {
      shareToFeed: getBoolean(settings.shareToFeed, true),
    } satisfies InstagramScheduleSettings;
  }

  if (platform === "tiktok") {
    const privacyLevel = settings.privacyLevel;

    if (!isTikTokPrivacyLevel(privacyLevel)) {
      throw new SchedulePlatformSettingsError(
        "Choose who can view the TikTok post.",
      );
    }

    const normalized = {
      allowComment: getBoolean(settings.allowComment, false),
      allowDuet: getBoolean(settings.allowDuet, false),
      allowStitch: getBoolean(settings.allowStitch, false),
      brandOrganic: getBoolean(settings.brandOrganic, false),
      brandedContent: getBoolean(settings.brandedContent, false),
      containsSyntheticMedia: getBoolean(
        settings.containsSyntheticMedia,
        true,
      ),
      musicUsageConfirmed: getBoolean(settings.musicUsageConfirmed, false),
      privacyLevel,
    } satisfies TikTokScheduleSettings;

    if (!normalized.musicUsageConfirmed) {
      throw new SchedulePlatformSettingsError(
        "Confirm TikTok's Music Usage Confirmation before scheduling.",
      );
    }

    if (normalized.brandedContent && normalized.privacyLevel === "SELF_ONLY") {
      throw new SchedulePlatformSettingsError(
        "TikTok paid partnerships cannot use Only me visibility.",
      );
    }

    return normalized;
  }

  const privacyStatus = settings.privacyStatus;

  if (
    privacyStatus !== undefined &&
    privacyStatus !== "private" &&
    privacyStatus !== "unlisted" &&
    privacyStatus !== "public"
  ) {
    throw new SchedulePlatformSettingsError(
      "Choose a valid YouTube visibility.",
    );
  }

  return {
    containsSyntheticMedia: getBoolean(
      settings.containsSyntheticMedia,
      true,
    ),
    madeForKids: getBoolean(settings.madeForKids, false),
    notifySubscribers: getBoolean(settings.notifySubscribers, false),
    privacyStatus: privacyStatus ?? "private",
  } satisfies YouTubeScheduleSettings;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
