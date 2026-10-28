import {
  defaultCarouselManualTextStyle,
  parseCarouselManualTextStyle,
  type CarouselManualTextStyle,
} from "@/lib/carousel/manual-text";
import {
  getZonedDateTimeParts,
  resolveZonedDateTime,
} from "@/lib/scheduling/schedule-time";
import type { SchedulePlatform } from "@/lib/scheduling/types";
import type { TikTokPrivacyLevel as TikTokPublishPrivacyLevel } from "@/lib/social/tiktok-publishing";
import type {
  TrendingSlideshowStructureId,
  TrendingSlideshowStyle,
} from "@/lib/trending/slideshow-style-mix";

export const TRENDING_SLIDESHOW_AUTOMATION_VERSION = 1 as const;

export const TRENDING_SLIDESHOW_AUTOMATION_FORMATS = [
  "educational_tips",
  "product_stories",
] as const;

export type TrendingSlideshowAutomationFormat =
  (typeof TRENDING_SLIDESHOW_AUTOMATION_FORMATS)[number];

export type TrendingSlideshowAutomationFormatMeta = {
  backendStyle: TrendingSlideshowStyle;
  badge: string;
  description: string;
  id: TrendingSlideshowAutomationFormat;
  structureId: TrendingSlideshowStructureId;
  subtitle: string;
  title: string;
};

export const TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META: Record<
  TrendingSlideshowAutomationFormat,
  TrendingSlideshowAutomationFormatMeta
> = {
  educational_tips: {
    backendStyle: "helpful_tips",
    badge: "💡 Educational Tip",
    description:
      "Practical steps and saveable advice that grow reach and authority.",
    id: "educational_tips",
    structureId: "structure_1",
    subtitle: "Value-first · No product pitch",
    title: "Educational Tips",
  },
  product_stories: {
    backendStyle: "product_stories_cta",
    badge: "🎯 Product Story",
    description:
      "Relatable problem-to-solution stories that naturally introduce the product and end with a clear call to action.",
    id: "product_stories",
    structureId: "structure_2",
    subtitle: "Story-led · Ends with a CTA",
    title: "Product Stories",
  },
};

export const TRENDING_SLIDESHOW_AUTOMATION_QUICK_MODES = [
  "all_product_stories",
  "all_educational_tips",
  "custom_mix",
] as const;

export type TrendingSlideshowAutomationQuickMode =
  (typeof TRENDING_SLIDESHOW_AUTOMATION_QUICK_MODES)[number];

export const TRENDING_SLIDESHOW_AUTOMATION_MIN_DAILY_TOTAL = 1;
export const TRENDING_SLIDESHOW_AUTOMATION_MAX_DAILY_TOTAL = 5;

export type TrendingSlideshowAutomationContentCounts = {
  dailyTotal: number;
  educationalTipsCount: number;
  productStoriesCount: number;
};

export type TrendingSlideshowAutomationBackgroundSelection =
  | {
      mode: "default";
    }
  | {
      collectionId: string;
      collectionName: string;
      mode: "collection_only";
      selectedAssetIds: string[];
      selectionMode: "all" | "subset";
    };

export type SavedCarouselVisualStyle = {
  createdAt: string;
  id: string;
  name: string;
  style: CarouselManualTextStyle;
  textPosition: {
    x: number;
    y: number;
  };
  updatedAt: string;
};

export type TrendingSlideshowAutomationVisualStyleSelection =
  | {
      mode: "default";
      style: CarouselManualTextStyle;
      textPosition: {
        x: number;
        y: number;
      };
    }
  | {
      mode: "saved";
      style: CarouselManualTextStyle;
      styleId: string;
      styleName: string;
      textPosition: {
        x: number;
        y: number;
      };
    };

export type TrendingSlideshowAutomationDailyTimeSlot = {
  format: TrendingSlideshowAutomationFormat;
  slotIndex: number;
  time: string;
};

export type TrendingSlideshowAutomationTargetAccount = {
  accountLabel: string;
  connectionId: string;
  platform: Extract<SchedulePlatform, "instagram" | "tiktok">;
  tiktokAiGeneratedContent?: boolean;
  tiktokMusicUsageAccepted?: boolean;
  tiktokPrivacyLevel?: TikTokPublishPrivacyLevel;
};

export type TrendingSlideshowAutomationCaptionSelection =
  | {
      mode: "generated";
    }
  | {
      captionId: string;
      captionName: string;
      captionText: string;
      mode: "saved_caption";
    }
  | {
      mode: "blank";
    };

export type TrendingSlideshowAutomationStatus =
  | "draft"
  | "active"
  | "paused"
  | "needs_attention";

export type TrendingSlideshowAutomationAttentionReason =
  | "collection_empty"
  | "collection_missing"
  | "account_reconnect_required"
  | "allowance_reached"
  | null;

export type TrendingSlideshowAutomationConfig = {
  backgrounds: TrendingSlideshowAutomationBackgroundSelection;
  caption: TrendingSlideshowAutomationCaptionSelection;
  counts: TrendingSlideshowAutomationContentCounts;
  dailySlots: TrendingSlideshowAutomationDailyTimeSlot[];
  quickMode: TrendingSlideshowAutomationQuickMode;
  startDate: string;
  targets: TrendingSlideshowAutomationTargetAccount[];
  timezone: string;
  version: typeof TRENDING_SLIDESHOW_AUTOMATION_VERSION;
  visualStyle: TrendingSlideshowAutomationVisualStyleSelection;
};

export type TrendingSlideshowAutomationRecord = {
  activatedAt: string | null;
  attentionMessage: string | null;
  attentionReason: TrendingSlideshowAutomationAttentionReason;
  config: TrendingSlideshowAutomationConfig;
  pausedAt: string | null;
  revision: number;
  rotationCursor: number;
  status: TrendingSlideshowAutomationStatus;
  updatedAt: string;
  userId: string;
};

export type TrendingSlideshowAutomationSlotStatus =
  | "preparing"
  | "scheduled"
  | "published"
  | "partially_published"
  | "held_collection_empty"
  | "action_required_account"
  | "missed_posting_time"
  | "cancelled_by_user";

export type TrendingSlideshowAutomationSlotSnapshot = {
  /** Uploaded app screenshot used specifically on the Structure 2 CTA. */
  ctaScreenshotAssetId?: string | null;
  backgroundAssetIds: string[];
  backgroundMode: "default" | "collection_only";
  captionText: string;
  collectionId: string | null;
  collectionName: string | null;
  configRevision: number;
  format: TrendingSlideshowAutomationFormat;
  headlinePreview: string;
  slideCount: number;
  structureId: TrendingSlideshowStructureId;
  targets: TrendingSlideshowAutomationTargetAccount[];
  visualStyle: CarouselManualTextStyle;
  textPosition?: { x: number; y: number };
  visualStyleName: string;
};

export type TrendingSlideshowAutomationSlotRecord = {
  createdAt: string;
  creativeId: string | null;
  format: TrendingSlideshowAutomationFormat;
  holdMessage: string | null;
  id: string;
  idempotencyKey: string;
  libraryItemId: string | null;
  localDate: string;
  scheduleId: string | null;
  scheduledFor: string;
  slotIndex: number;
  slotTime: string;
  snapshot: TrendingSlideshowAutomationSlotSnapshot;
  status: TrendingSlideshowAutomationSlotStatus;
  timezone: string;
  updatedAt: string;
  userId: string;
  userModified: boolean;
};

export type PauseAutomationUpcomingAction =
  | "cancel_upcoming_auto_slots"
  | "keep_scheduled_slots";

const DEFAULT_SLOT_TIMES = [
  "09:00",
  "13:30",
  "18:00",
  "20:30",
  "22:00",
] as const;

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YYYY_MM_DD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function mapAutomationFormatToBackendStyle(
  format: TrendingSlideshowAutomationFormat,
): TrendingSlideshowStyle {
  return TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[format].backendStyle;
}

export function mapAutomationFormatToStructureId(
  format: TrendingSlideshowAutomationFormat,
): TrendingSlideshowStructureId {
  return TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META[format].structureId;
}

export function mapBackendStyleToAutomationFormat(
  style: TrendingSlideshowStyle,
): TrendingSlideshowAutomationFormat {
  return style === "helpful_tips" ? "educational_tips" : "product_stories";
}

export function deriveQuickModeFromCounts(
  counts: TrendingSlideshowAutomationContentCounts,
): TrendingSlideshowAutomationQuickMode {
  if (
    counts.productStoriesCount === counts.dailyTotal &&
    counts.educationalTipsCount === 0
  ) {
    return "all_product_stories";
  }

  if (
    counts.educationalTipsCount === counts.dailyTotal &&
    counts.productStoriesCount === 0
  ) {
    return "all_educational_tips";
  }

  return "custom_mix";
}

export function applyAutomationQuickMode(params: {
  dailyTotal: number;
  quickMode: TrendingSlideshowAutomationQuickMode;
}): TrendingSlideshowAutomationContentCounts {
  const dailyTotal = clampDailyTotal(params.dailyTotal);

  if (params.quickMode === "all_product_stories") {
    return {
      dailyTotal,
      educationalTipsCount: 0,
      productStoriesCount: dailyTotal,
    };
  }

  if (params.quickMode === "all_educational_tips") {
    return {
      dailyTotal,
      educationalTipsCount: dailyTotal,
      productStoriesCount: 0,
    };
  }

  const educationalTipsCount = Math.max(1, Math.floor(dailyTotal / 2));
  const productStoriesCount = Math.max(0, dailyTotal - educationalTipsCount);

  return {
    dailyTotal,
    educationalTipsCount,
    productStoriesCount,
  };
}

export function adjustAutomationFormatCount(params: {
  counts: TrendingSlideshowAutomationContentCounts;
  delta: -1 | 1;
  format: TrendingSlideshowAutomationFormat;
  maxAllowance?: number;
}): TrendingSlideshowAutomationContentCounts {
  const maxTotal = clampDailyTotal(
    params.maxAllowance ?? TRENDING_SLIDESHOW_AUTOMATION_MAX_DAILY_TOTAL,
  );
  const dailyTotal = Math.min(
    maxTotal,
    clampDailyTotal(params.counts.dailyTotal),
  );

  let educational = Math.min(
    dailyTotal,
    Math.max(0, Math.trunc(params.counts.educationalTipsCount)),
  );
  let product = dailyTotal - educational;

  if (params.format === "educational_tips") {
    educational = Math.min(dailyTotal, Math.max(0, educational + params.delta));
    product = dailyTotal - educational;
  } else {
    product = Math.min(dailyTotal, Math.max(0, product + params.delta));
    educational = dailyTotal - product;
  }

  return {
    dailyTotal,
    educationalTipsCount: educational,
    productStoriesCount: product,
  };
}

export function setAutomationDailyTotal(params: {
  counts: TrendingSlideshowAutomationContentCounts;
  dailyTotal: number;
  maxAllowance?: number;
  quickMode: TrendingSlideshowAutomationQuickMode;
}): {
  counts: TrendingSlideshowAutomationContentCounts;
  quickMode: TrendingSlideshowAutomationQuickMode;
} {
  const maxTotal = clampDailyTotal(
    params.maxAllowance ?? TRENDING_SLIDESHOW_AUTOMATION_MAX_DAILY_TOTAL,
  );
  const nextTotal = Math.min(maxTotal, clampDailyTotal(params.dailyTotal));

  if (params.quickMode === "all_product_stories") {
    return {
      counts: {
        dailyTotal: nextTotal,
        educationalTipsCount: 0,
        productStoriesCount: nextTotal,
      },
      quickMode: "all_product_stories",
    };
  }

  if (params.quickMode === "all_educational_tips") {
    return {
      counts: {
        dailyTotal: nextTotal,
        educationalTipsCount: nextTotal,
        productStoriesCount: 0,
      },
      quickMode: "all_educational_tips",
    };
  }

  const currentTotal = Math.max(1, params.counts.dailyTotal);
  const ratio = params.counts.educationalTipsCount / currentTotal;
  let educational = Math.round(nextTotal * ratio);
  if (nextTotal > 1 && educational === 0 && params.counts.educationalTipsCount > 0) {
    educational = 1;
  }
  if (
    nextTotal > 1 &&
    educational === nextTotal &&
    params.counts.productStoriesCount > 0
  ) {
    educational = nextTotal - 1;
  }
  educational = Math.min(nextTotal, Math.max(0, educational));
  const product = nextTotal - educational;
  const counts = {
    dailyTotal: nextTotal,
    educationalTipsCount: educational,
    productStoriesCount: product,
  };

  return {
    counts,
    quickMode: deriveQuickModeFromCounts(counts),
  };
}

export function validateAutomationContentCounts(
  counts: TrendingSlideshowAutomationContentCounts,
  maxAllowance = TRENDING_SLIDESHOW_AUTOMATION_MAX_DAILY_TOTAL,
): { message?: string; ok: boolean } {
  const limit = Math.min(
    TRENDING_SLIDESHOW_AUTOMATION_MAX_DAILY_TOTAL,
    Math.max(1, Math.trunc(maxAllowance)),
  );

  if (
    !Number.isInteger(counts.dailyTotal) ||
    counts.dailyTotal < TRENDING_SLIDESHOW_AUTOMATION_MIN_DAILY_TOTAL ||
    counts.dailyTotal > limit
  ) {
    return {
      message: `Choose between 1 and ${limit} slideshows per day for your plan.`,
      ok: false,
    };
  }

  if (
    !Number.isInteger(counts.educationalTipsCount) ||
    !Number.isInteger(counts.productStoriesCount) ||
    counts.educationalTipsCount < 0 ||
    counts.productStoriesCount < 0
  ) {
    return {
      message: "Daily counts for Educational Tips and Product Stories must be zero or greater.",
      ok: false,
    };
  }

  if (
    counts.educationalTipsCount + counts.productStoriesCount !==
    counts.dailyTotal
  ) {
    return {
      message: `Educational Tips (${counts.educationalTipsCount}) + Product Stories (${counts.productStoriesCount}) must equal ${counts.dailyTotal} per day.`,
      ok: false,
    };
  }

  return { ok: true };
}

/**
 * Builds the ordered format sequence for the day so Educational Tips come first
 * (value-first opening slot) followed by Product Stories, matching the user's
 * exact daily counts in Step 1.
 */
export function buildDailyFormatSequence(
  counts: TrendingSlideshowAutomationContentCounts,
): TrendingSlideshowAutomationFormat[] {
  const sequence: TrendingSlideshowAutomationFormat[] = [];

  for (let index = 0; index < counts.educationalTipsCount; index += 1) {
    sequence.push("educational_tips");
  }
  for (let index = 0; index < counts.productStoriesCount; index += 1) {
    sequence.push("product_stories");
  }

  return sequence;
}

/**
 * Synchronizes Step 3's daily time slots with Step 1's exact counts while
 * preserving any custom times the user already picked.
 */
export function syncAutomationDailySlots(params: {
  counts: TrendingSlideshowAutomationContentCounts;
  currentSlots: readonly TrendingSlideshowAutomationDailyTimeSlot[];
}): TrendingSlideshowAutomationDailyTimeSlot[] {
  const formats = buildDailyFormatSequence(params.counts);
  const usedTimes = new Set<string>();

  return formats.map((format, index) => {
    const existing = params.currentSlots[index];
    const candidateTime =
      existing && HH_MM_PATTERN.test(existing.time) && !usedTimes.has(existing.time)
        ? existing.time
        : pickNextAvailableDefaultSlotTime(index, usedTimes);

    usedTimes.add(candidateTime);

    return {
      format,
      slotIndex: index + 1,
      time: candidateTime,
    };
  });
}

function pickNextAvailableDefaultSlotTime(
  preferredIndex: number,
  usedTimes: Set<string>,
): string {
  const preferred = DEFAULT_SLOT_TIMES[preferredIndex];
  if (preferred && !usedTimes.has(preferred)) {
    return preferred;
  }

  for (const fallback of DEFAULT_SLOT_TIMES) {
    if (!usedTimes.has(fallback)) {
      return fallback;
    }
  }

  for (let hour = 8; hour <= 22; hour += 1) {
    const candidate = `${String(hour).padStart(2, "0")}:00`;
    if (!usedTimes.has(candidate)) {
      return candidate;
    }
  }

  return "09:00";
}

export function createAutomationSlotIdempotencyKey(params: {
  localDate: string;
  slotTime: string;
  userId: string;
}) {
  return `automation:${params.userId}:${params.localDate}:${params.slotTime}`;
}

export type CollectionBackgroundAllocationResult =
  | {
      AssignedAssetIds: string[];
      nextRotationCursor: number;
      ok: true;
      repeatedWithinSlideshow: boolean;
      warningMessage: string | null;
    }
  | {
      holdMessage: string;
      ok: false;
      status: "held_collection_empty";
    };

/**
 * Strict collection-only background allocator:
 * - Never substitutes stock, catalogue, or AI-generated images.
 * - Filters to ready, unarchived collection assets (or the user's selected subset).
 * - Rotates deterministically across slides and slots using `rotationCursor`.
 * - If 0 usable images exist in the collection/subset, halts the slot with
 *   `held_collection_empty` and an actionable message.
 */
export function allocateCollectionOnlySlideBackgrounds(params: {
  availableCollectionAssetIds: readonly string[];
  collectionName: string;
  rotationCursor: number;
  selectedAssetIds?: readonly string[];
  selectionMode: "all" | "subset";
  slideCount: number;
}): CollectionBackgroundAllocationResult {
  const slideCount = Math.max(1, Math.min(20, Math.trunc(params.slideCount)));
  const availableSet = new Set(params.availableCollectionAssetIds);
  const pool =
    params.selectionMode === "subset"
      ? (params.selectedAssetIds ?? []).filter((id) => availableSet.has(id))
      : [...params.availableCollectionAssetIds];

  if (pool.length === 0) {
    return {
      holdMessage:
        params.selectionMode === "subset"
          ? `None of the selected images in "${params.collectionName}" are currently available. Upload or reselect images in your collection, or switch background sourcing.`
          : `Collection "${params.collectionName}" has 0 usable images. Upload images to "${params.collectionName}" or choose another collection — default backgrounds are never substituted automatically.`,
      ok: false,
      status: "held_collection_empty",
    };
  }

  const startCursor = Math.max(0, Math.trunc(params.rotationCursor));
  const assignedAssetIds: string[] = [];

  for (let index = 0; index < slideCount; index += 1) {
    const poolIndex = (startCursor + index) % pool.length;
    assignedAssetIds.push(pool[poolIndex]!);
  }

  const repeatedWithinSlideshow = pool.length < slideCount;
  const warningMessage = repeatedWithinSlideshow
    ? `Your selection in "${params.collectionName}" has ${pool.length} image${pool.length === 1 ? "" : "s"}. Slideshows have ${slideCount} slides, so images will repeat in order.`
    : null;

  return {
    AssignedAssetIds: assignedAssetIds,
    nextRotationCursor: (startCursor + slideCount) % pool.length,
    ok: true,
    repeatedWithinSlideshow,
    warningMessage,
  };
}

/**
 * Evaluates whether a daily automation slot is eligible to be scheduled or if
 * its posting time was missed before preparation completed (never silently
 * publishes late).
 */
export function evaluateAutomationSlotTiming(params: {
  localDate: string;
  minimumLeadMinutes?: number;
  nowMs?: number;
  slotTime: string;
  timezone: string;
}):
  | {
      ok: true;
      scheduledFor: string;
    }
  | {
      holdMessage: string;
      ok: false;
      scheduledFor: string;
      status: "missed_posting_time";
    } {
  const nowMs = params.nowMs ?? Date.now();
  const minimumLeadMinutes = Math.max(1, params.minimumLeadMinutes ?? 5);
  const scheduledFor = resolveZonedDateTime({
    date: params.localDate,
    time: params.slotTime,
    timeZone: params.timezone,
  });
  const scheduledMs = Date.parse(scheduledFor);

  if (scheduledMs < nowMs + minimumLeadMinutes * 60_000) {
    return {
      holdMessage: `Preparation finished after the ${params.slotTime} (${params.timezone}) posting window. Held so it never publishes late at the wrong hour.`,
      ok: false,
      scheduledFor,
      status: "missed_posting_time",
    };
  }

  return {
    ok: true,
    scheduledFor,
  };
}

/**
 * Computes the next upcoming daily slots across a rolling window (e.g. next 24-48h)
 * starting from `max(startDate, todayInTimezone)`.
 */
export function planUpcomingAutomationOccurrences(params: {
  config: TrendingSlideshowAutomationConfig;
  horizonHours?: number;
  minimumLeadMinutes?: number;
  nowMs?: number;
}): Array<{
  format: TrendingSlideshowAutomationFormat;
  idempotencyKey: string;
  localDate: string;
  scheduledFor: string;
  slotIndex: number;
  slotTime: string;
  structureId: TrendingSlideshowStructureId;
}> {
  const nowMs = params.nowMs ?? Date.now();
  const horizonHours = Math.max(12, Math.min(168, params.horizonHours ?? 36));
  const minimumLeadMinutes = Math.max(1, params.minimumLeadMinutes ?? 5);
  const earliestMs = nowMs + minimumLeadMinutes * 60_000;
  const horizonMs = nowMs + horizonHours * 3_600_000;

  const todayParts = getZonedDateTimeParts(nowMs, params.config.timezone);
  const startLocalDate =
    YYYY_MM_DD_PATTERN.test(params.config.startDate) &&
    params.config.startDate > todayParts.date
      ? params.config.startDate
      : todayParts.date;

  const syncedSlots = syncAutomationDailySlots({
    counts: params.config.counts,
    currentSlots: params.config.dailySlots,
  }).sort((first, second) => first.time.localeCompare(second.time));

  const occurrences: Array<{
    format: TrendingSlideshowAutomationFormat;
    idempotencyKey: string;
    localDate: string;
    scheduledFor: string;
    slotIndex: number;
    slotTime: string;
    structureId: TrendingSlideshowStructureId;
  }> = [];

  for (let dayOffset = 0; dayOffset <= 3; dayOffset += 1) {
    const candidateDate = addDaysToLocalDate(startLocalDate, dayOffset);
    for (const slot of syncedSlots) {
      try {
        const scheduledFor = resolveZonedDateTime({
          date: candidateDate,
          time: slot.time,
          timeZone: params.config.timezone,
        });
        const timestamp = Date.parse(scheduledFor);
        if (timestamp >= earliestMs && timestamp <= horizonMs) {
          occurrences.push({
            format: slot.format,
            idempotencyKey: `${candidateDate}:${slot.time}`,
            localDate: candidateDate,
            scheduledFor,
            slotIndex: slot.slotIndex,
            slotTime: slot.time,
            structureId: mapAutomationFormatToStructureId(slot.format),
          });
        }
      } catch {
        // Skip DST gap times safely
      }
    }
  }

  return occurrences;
}

/**
 * Determines which existing slots should be cancelled when pausing automation.
 * User-modified slots (`userModified === true`) or already published slots are
 * never cancelled automatically.
 */
export function selectSlotsToCancelOnPause(params: {
  action: PauseAutomationUpcomingAction;
  nowMs?: number;
  slots: readonly TrendingSlideshowAutomationSlotRecord[];
}): string[] {
  if (params.action === "keep_scheduled_slots") {
    return [];
  }

  const nowMs = params.nowMs ?? Date.now();

  return params.slots
    .filter((slot) => {
      if (slot.userModified) {
        return false;
      }
      if (slot.status !== "preparing" && slot.status !== "scheduled") {
        return false;
      }
      return Date.parse(slot.scheduledFor) > nowMs;
    })
    .map((slot) => slot.id);
}

export function createDefaultAutomationConfig(params?: {
  dailyAllowance?: number;
  nowMs?: number;
  timezone?: string;
}): TrendingSlideshowAutomationConfig {
  const timezone = normalizeAutomationTimezone(params?.timezone);
  const nowMs = params?.nowMs ?? Date.now();
  const today = getZonedDateTimeParts(nowMs, timezone).date;
  const maxAllowance = clampDailyTotal(params?.dailyAllowance ?? 3);
  const defaultTotal = Math.min(2, maxAllowance);
  const counts: TrendingSlideshowAutomationContentCounts =
    defaultTotal >= 2
      ? {
          dailyTotal: 2,
          educationalTipsCount: 1,
          productStoriesCount: 1,
        }
      : {
          dailyTotal: 1,
          educationalTipsCount: 0,
          productStoriesCount: 1,
        };
  const quickMode = deriveQuickModeFromCounts(counts);

  return {
    backgrounds: {
      mode: "default",
    },
    caption: {
      mode: "generated",
    },
    counts,
    dailySlots: syncAutomationDailySlots({
      counts,
      currentSlots: [],
    }),
    quickMode,
    startDate: today,
    targets: [],
    timezone,
    version: TRENDING_SLIDESHOW_AUTOMATION_VERSION,
    visualStyle: {
      mode: "default",
      style: defaultCarouselManualTextStyle(),
      textPosition: { x: 0.5, y: 0.5 },
    },
  };
}

export function normalizeAutomationTimezone(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "America/New_York";
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return trimmed;
  } catch {
    return "America/New_York";
  }
}

export function validateAutomationConfigForActivation(params: {
  availableCollectionAssetCount?: number;
  config: TrendingSlideshowAutomationConfig;
  dailyAllowance: number;
}): { message?: string; ok: boolean } {
  const countsCheck = validateAutomationContentCounts(
    params.config.counts,
    params.dailyAllowance,
  );
  if (!countsCheck.ok) {
    return countsCheck;
  }

  if (
    params.config.dailySlots.length !== params.config.counts.dailyTotal ||
    params.config.dailySlots.some((slot) => !HH_MM_PATTERN.test(slot.time))
  ) {
    return {
      message: "Configure a valid posting time for every daily slideshow slot.",
      ok: false,
    };
  }

  const uniqueTimes = new Set(
    params.config.dailySlots.map((slot) => slot.time),
  );
  if (uniqueTimes.size !== params.config.dailySlots.length) {
    return {
      message: "Each daily slideshow slot must have a distinct posting time.",
      ok: false,
    };
  }

  if (params.config.backgrounds.mode === "collection_only") {
    if (!params.config.backgrounds.collectionId.trim()) {
      return {
        message:
          "Choose a Media library collection for collection-only backgrounds.",
        ok: false,
      };
    }

    if (
      params.config.backgrounds.selectionMode === "subset" &&
      params.config.backgrounds.selectedAssetIds.length === 0
    ) {
      return {
        message:
          "Select at least 1 image from your collection or use all images in the collection.",
        ok: false,
      };
    }

    if (
      typeof params.availableCollectionAssetCount === "number" &&
      params.availableCollectionAssetCount <= 0
    ) {
      return {
        message: `Collection "${params.config.backgrounds.collectionName}" has 0 usable images. Upload images to that collection before activating collection-only automation.`,
        ok: false,
      };
    }
  }

  if (params.config.targets.length === 0) {
    return {
      message:
        "Select at least one connected Instagram or TikTok destination account.",
      ok: false,
    };
  }

  // TikTok visibility and AI disclosure come from the user's publishing
  // settings, so they are not part of this configuration.

  if (!YYYY_MM_DD_PATTERN.test(params.config.startDate)) {
    return {
      message: "Choose a valid start date (YYYY-MM-DD).",
      ok: false,
    };
  }

  try {
    parseCarouselManualTextStyle(params.config.visualStyle.style);
  } catch {
    return {
      message: "Choose a valid visual style font, size, and color.",
      ok: false,
    };
  }

  return { ok: true };
}

function clampDailyTotal(value: number): number {
  const integer = Math.trunc(Number.isFinite(value) ? value : 1);
  return Math.min(
    TRENDING_SLIDESHOW_AUTOMATION_MAX_DAILY_TOTAL,
    Math.max(TRENDING_SLIDESHOW_AUTOMATION_MIN_DAILY_TOTAL, integer),
  );
}

function addDaysToLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return `${String(utc.getUTCFullYear()).padStart(4, "0")}-${String(
    utc.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}
