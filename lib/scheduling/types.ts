export const schedulePlatforms = ["instagram", "tiktok", "youtube"] as const;

export const scheduleDraftStatuses = [
  "draft",
  "render_required",
  "ready",
  "scheduled_preview",
  "publishing_unavailable",
] as const;

export const scheduleSourceTypes = [
  "edit_video",
  "demo_video",
  "generated_video",
  "generated_carousel",
] as const;

export const schedulePostTypes = [
  "reel",
  "tiktok_video",
  "youtube_short",
] as const;

export const scheduleTabs = ["upcoming", "drafts", "published", "failed"] as const;

export type SchedulePlatform = (typeof schedulePlatforms)[number];

export type ScheduleDraftStatus = (typeof scheduleDraftStatuses)[number];

export type ScheduleSourceType = (typeof scheduleSourceTypes)[number];

export type SchedulePostType = (typeof schedulePostTypes)[number];

export type ScheduleTab = (typeof scheduleTabs)[number];

export type ScheduleViewMode = "calendar" | "list";

export type ScheduleDraft = {
  caption: string;
  createdAt: string;
  id: string;
  mediaTitle?: string;
  mediaUrl?: string;
  platforms: SchedulePlatform[];
  postType?: SchedulePostType;
  scheduledDate?: string;
  scheduledTime?: string;
  sourceId?: string;
  sourceType?: ScheduleSourceType;
  status: ScheduleDraftStatus;
  thumbnailUrl?: string;
  timezone: string;
  updatedAt: string;
};

export type ScheduleDraftInput = {
  caption?: string;
  id?: string;
  mediaTitle?: string;
  mediaUrl?: string;
  platforms?: SchedulePlatform[];
  postType?: SchedulePostType;
  scheduledDate?: string;
  scheduledTime?: string;
  sourceId?: string;
  sourceType?: ScheduleSourceType;
  status?: ScheduleDraftStatus;
  thumbnailUrl?: string;
  timezone?: string;
};

export type ScheduleMediaOption = {
  durationLabel?: string;
  id: string;
  mediaUrl?: string;
  sourceType: ScheduleSourceType;
  status: "missing_render" | "ready";
  thumbnailUrl?: string;
  title: string;
};

export function getSchedulePlatformLabel(platform: SchedulePlatform) {
  const labels: Record<SchedulePlatform, string> = {
    instagram: "Instagram Reels",
    tiktok: "TikTok",
    youtube: "YouTube Shorts",
  };

  return labels[platform];
}

export function getScheduleStatusLabel(status: ScheduleDraftStatus) {
  const labels: Record<ScheduleDraftStatus, string> = {
    draft: "Draft",
    publishing_unavailable: "Publishing unavailable",
    ready: "Ready",
    render_required: "Render required",
    scheduled_preview: "Scheduled preview",
  };

  return labels[status];
}

export function getSchedulePostTypeLabel(postType: SchedulePostType) {
  const labels: Record<SchedulePostType, string> = {
    reel: "Reel",
    tiktok_video: "TikTok video",
    youtube_short: "YouTube Short",
  };

  return labels[postType];
}
