export const schedulePlatforms = ["instagram", "tiktok", "youtube"] as const;

export const scheduleSourceKinds = ["media_asset", "library_item"] as const;

export const scheduledPostStatuses = [
  "draft",
  "scheduling",
  "scheduled",
  "publishing",
  "published",
  "partially_failed",
  "failed",
  "cancelled",
] as const;

export const scheduledPostTargetStatuses = [
  "draft",
  "scheduling",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "action_required",
  "cancelled",
  "skipped",
] as const;

export const scheduleDraftStatuses = [
  "draft",
  "media_required",
  "rendering",
  "render_required",
  "render_failed",
  "ready",
  "scheduling",
  "scheduled",
  "publishing",
  "published",
  "partially_failed",
  "failed",
  "cancelled",
  "scheduled_preview",
  "publishing_unavailable",
] as const;

export const scheduleSourceTypes = [
  "edit_video",
  "demo_video",
  "generated_video",
  "generated_carousel",
  "influencer_video",
  "user_video",
  "combined_video",
] as const;

export const scheduleTabs = ["upcoming", "drafts", "published", "failed"] as const;

export type SchedulePlatform = (typeof schedulePlatforms)[number];

export type ScheduleSourceKind = (typeof scheduleSourceKinds)[number];

export type ScheduledPostStatus = (typeof scheduledPostStatuses)[number];

export type ScheduledPostTargetStatus =
  (typeof scheduledPostTargetStatuses)[number];

export type ScheduleDraftStatus = (typeof scheduleDraftStatuses)[number];

export type ScheduleSourceType = (typeof scheduleSourceTypes)[number];

export type ScheduleTab = (typeof scheduleTabs)[number];

export type ScheduleViewMode = "calendar" | "list";

export type ScheduleMediaIssue = "both" | "demo" | "opening";

export type ScheduledPostTarget = {
  attemptCount: number;
  cancelledAt: string | null;
  createdAt: string;
  id: string;
  lastReconciledAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  nextRetryAt: string | null;
  platform: SchedulePlatform;
  platformPostId: string | null;
  platformPostUrl: string | null;
  publishJobId: string | null;
  publishedAt: string | null;
  scheduledFor: string;
  schedulerDeletedAt: string | null;
  schedulerScheduleArn: string | null;
  schedulerScheduleName: string | null;
  settings: Record<string, unknown>;
  socialConnectionId: string;
  status: ScheduledPostTargetStatus;
  updatedAt: string;
};

export type ScheduledPost = {
  cancelledAt: string | null;
  caption: string;
  createdAt: string;
  id: string;
  idempotencyKey: string | null;
  lastErrorCode: string | null;
  libraryItemId: string | null;
  mediaAssetId: string | null;
  metadata: Record<string, unknown>;
  projectId: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  sourceKind: ScheduleSourceKind;
  status: ScheduledPostStatus;
  targets: ScheduledPostTarget[];
  timezone: string;
  title: string;
  updatedAt: string;
};

export type ScheduleCreateSourceInput = {
  id: string;
  kind: ScheduleSourceKind;
};

export type ScheduleCreateTargetInput = {
  connectionId: string;
  platform?: SchedulePlatform;
  settings?: Record<string, unknown>;
};

export type ScheduleCreateInput = {
  caption?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  plannedTargets?: ScheduleCreateTargetInput[];
  scheduledDate?: string;
  scheduledFor?: string;
  scheduledTime?: string;
  source: ScheduleCreateSourceInput;
  targets?: ScheduleCreateTargetInput[];
  timezone?: string;
  title?: string;
};

export type ScheduleUpdateInput = ScheduleCreateInput & {
  expectedUpdatedAt?: string;
};

export type ScheduleMediaSelection = {
  durationLabel?: string;
  id: string;
  mediaUrl?: string;
  sourceRecordId?: string;
  sourceType: ScheduleSourceType;
  status: "missing_render" | "ready";
  thumbnailUrl?: string;
  title: string;
};

export type ScheduleDraft = {
  canCancel?: boolean;
  canEdit?: boolean;
  caption: string;
  combinedMedia?: ScheduleMediaSelection;
  createdAt: string;
  demoMedia?: ScheduleMediaSelection;
  finalScheduleError?: string;
  finalScheduleErrorCode?: string;
  hookMedia?: ScheduleMediaSelection;
  id: string;
  mediaTitle?: string;
  mediaIssue?: ScheduleMediaIssue;
  mediaMode?: "single_video" | "combined_video";
  mediaUrl?: string;
  plannedConnectionIds?: string[];
  plannedScheduledFor?: string;
  platforms: SchedulePlatform[];
  scheduledDate?: string;
  scheduledTime?: string;
  sourceId?: string;
  sourceType?: ScheduleSourceType;
  status: ScheduleDraftStatus;
  targets?: ScheduledPostTarget[];
  thumbnailUrl?: string;
  timezone: string;
  updatedAt: string;
};

export type ScheduleDraftInput = {
  canCancel?: boolean;
  canEdit?: boolean;
  caption?: string;
  combinedMedia?: ScheduleMediaSelection;
  demoMedia?: ScheduleMediaSelection;
  finalScheduleError?: string;
  finalScheduleErrorCode?: string;
  hookMedia?: ScheduleMediaSelection;
  id?: string;
  mediaTitle?: string;
  mediaIssue?: ScheduleMediaIssue;
  mediaMode?: "single_video" | "combined_video";
  mediaUrl?: string;
  plannedConnectionIds?: string[];
  plannedScheduledFor?: string;
  platforms?: SchedulePlatform[];
  scheduledDate?: string;
  scheduledTime?: string;
  sourceId?: string;
  sourceType?: ScheduleSourceType;
  status?: ScheduleDraftStatus;
  targets?: ScheduledPostTarget[];
  thumbnailUrl?: string;
  timezone?: string;
};

export type ScheduleMediaOption = ScheduleMediaSelection;

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
    cancelled: "Cancelled",
    draft: "Draft",
    failed: "Failed",
    media_required: "Media required",
    partially_failed: "Partially failed",
    published: "Published",
    publishing: "Publishing",
    publishing_unavailable: "Publishing unavailable",
    ready: "Ready",
    render_failed: "Video preparation failed",
    rendering: "Preparing video",
    render_required: "Video needs preparation",
    scheduled: "Scheduled",
    scheduled_preview: "Scheduled preview",
    scheduling: "Scheduling",
  };

  return labels[status];
}
