"use client";

import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileVideo,
  Images,
  Info,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import styles from "./schedule-editor.module.css";
import { useDeviceTimeFormat } from "./use-device-time-format";
import { canonicalPickerHour, pickerHour, displayScheduleTime } from "@/lib/scheduling/time-display";
import { ScheduleQuickActions } from "@/components/scheduling/schedule-quick-actions";
import { Button } from "@/components/ui/button";
import { useAccountTimeZone } from "@/components/providers/account-timezone-provider";
import { getSchedulingTimeZoneOptions } from "@/lib/scheduling/account-timezone";
import { InstagramCaptionPreview } from "@/components/social/instagram-caption-preview";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { requestPublishingPreferences } from "@/lib/scheduling/publishing-preferences-client";
import {
  getDormantScheduleTargets,
  getInitialScheduleConnectionIds,
  getUnavailableSavedInstagramTargets,
} from "@/lib/scheduling/schedule-form-persistence";
import {
  getConfirmedScheduleTargetSettings,
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  getTikTokPublishingAgreement,
  type ScheduleTargetSettings,
} from "@/lib/scheduling/platform-settings";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import { getMissingScheduleAccountPlatforms } from "@/lib/scheduling/account-picker";
import {
  getSchedulePlatformLabel,
  getScheduleStatusLabel,
  type ScheduledPost,
  type ScheduleCreateSourceInput,
  type ScheduleCreateTargetInput,
  type ScheduleDraftStatus,
  type ScheduleMediaOption,
  type SchedulePlatform,
} from "@/lib/scheduling/types";
import {
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
  resolveZonedDateTime,
  ScheduleTimeError,
  SOCIAL_SCHEDULING_TIME_STEP_SECONDS,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import {
  getTikTokPrivacyLabel,
  isTikTokPrivacyLevel,
  TIKTOK_PRIVATE_TESTING_VISIBILITY_MESSAGE,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

const scheduleSetupSteps = [
  { description: "Choose what to publish", label: "Media", mobileLabel: "Media", step: "1" },
  { description: "Select the destination", label: "Publishing account", mobileLabel: "Account", step: "2" },
  { description: "Set the publish time", label: "Date & time", mobileLabel: "Date & time", step: "3" },
] as const;
const scheduleDialogFocusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MAX_SCHEDULE_CAPTION_LENGTH = 5_000;
const scheduleHourValues = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const scheduleMinuteStepMinutes = Math.max(
  1,
  Math.round(SOCIAL_SCHEDULING_TIME_STEP_SECONDS / 60),
);
const scheduleMinuteValues = Array.from(
  { length: Math.ceil(60 / scheduleMinuteStepMinutes) },
  (_, index) => String(index * scheduleMinuteStepMinutes).padStart(2, "0"),
).filter((minute) => Number(minute) < 60);

function getPublishingAccountLabel(
  tiktokBetaEnabled: boolean,
  youtubeBetaEnabled: boolean,
) {
  if (tiktokBetaEnabled && youtubeBetaEnabled) {
    return "Instagram, TikTok, or YouTube";
  }

  if (tiktokBetaEnabled) {
    return "Instagram or TikTok";
  }

  if (youtubeBetaEnabled) {
    return "Instagram or YouTube";
  }

  return "Instagram";
}

export type ScheduleFormSubmission = {
  useDefaultScheduleTime?: boolean;
  caption: string;
  clipSelection: "hook_only" | "hook_and_secondary" | "secondary_only";
  openingMedia: ScheduleMediaOption | null;
  scheduledDate: string;
  scheduledFor: string;
  scheduledSource: ScheduleCreateSourceInput;
  scheduledSourceTitle: string;
  scheduledVideo: ScheduleMediaOption | null;
  scheduledTime: string;
  targets: ScheduleCreateTargetInput[];
  timezone: string;
  useOpeningClip: boolean;
};

export type ScheduleEditorDraftSnapshot = { caption: string; date: string; time: string; timezone: string; targets?: ScheduleCreateTargetInput[] };

type TikTokPublishSettingsResponse =
  | { capabilities: TikTokPublishCapabilities; ok: true }
  | { message?: string; ok?: false };
type ConnectionPublishingSettings = ScheduleTargetSettings;
type TikTokCapabilitiesState =
  | { status: "loading" }
  | { capabilities: TikTokPublishCapabilities; status: "ready" }
  | { message: string; status: "error" };


function ScheduledCarouselSourceCard({ schedule }: { schedule: ScheduledPost }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Images className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Saved carousel</p>
          <p className="mt-1 truncate text-sm font-semibold text-muted">
            {schedule.title}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-muted">
            This Library carousel stays attached to the schedule. Its rendered
            slides will be published in order.
          </p>
        </div>
      </div>
    </section>
  );
}

function CarouselSchedulePreview({ schedule }: { schedule: ScheduledPost }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="flex aspect-video items-center justify-center rounded-control bg-card-muted text-foreground">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-control bg-card text-primary">
            <Images className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 max-w-xs truncate text-sm font-bold">
            {schedule.title}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            Carousel slides publish in saved order
          </p>
        </div>
      </div>
    </div>
  );
}

function getScheduleTimeValidation(params: {
  date: string;
  minimumLeadMinutes: number;
  now?: number;
  time: string;
  timezone: string;
}) {
  if (!params.date || !params.time) {
    return {
      error: "Choose both a date and time to schedule.",
      scheduledFor: null,
    };
  }

  try {
    const scheduledFor = resolveZonedDateTime({
      date: params.date,
      time: params.time,
      timeZone: params.timezone,
    });
    const leadTime = validateScheduleLeadTime({
      minimumLeadMinutes: params.minimumLeadMinutes,
      now: params.now,
      scheduledFor,
    });

    if (!leadTime.valid) {
      return {
        error: leadTime.remainingMilliseconds <= 0 ? "That publish time is in the past. Choose a future time." : `Choose a time at least ${params.minimumLeadMinutes} ${
          params.minimumLeadMinutes === 1 ? "minute" : "minutes"
        } from now so the final video has time to be prepared.`,
        scheduledFor,
      };
    }

    return { error: null, scheduledFor };
  } catch (error) {
    return {
      error:
        error instanceof ScheduleTimeError
          ? error.message
          : "Choose a valid schedule date and time.",
      scheduledFor: null,
    };
  }
}

export function ScheduleEditor({
  demoMediaOptions,
  editingIsCombinedVideo,
  editingPlannedPlatforms,
  editingSchedule,
  editingScheduledDate,
  editingScheduledTime,
  errorMessage,
  hookMediaOptions,
  initialClipSelection,
  initialLibraryItemId,
  initialDemoMediaId,
  initialCaption = "",
  initialHookMediaId,
  finalVideo,
  pendingVideo,
  initialPlannedTargets,
  initialScheduledDate,
  initialScheduledTime,
  initialUseDefaultScheduleTime = true,
  initialTimezone,
  minimumScheduleLeadMinutes,
  onClose,
  onRefreshMedia,
  onRefreshConnections,
  onUploadVideo,
  onSave,
  requireScheduleTarget,
  saving,
  socialConnections,
  tiktokBetaEnabled,
  youtubeBetaEnabled,
  presentation = "modal",
  onCloseDraft,
  onDraftChange,
}: {
  demoMediaOptions: ScheduleMediaOption[];
  editingIsCombinedVideo: boolean;
  editingPlannedPlatforms: SchedulePlatform[];
  editingSchedule: ScheduledPost | null;
  editingScheduledDate: string | null;
  editingScheduledTime: string | null;
  errorMessage: string | null;
  hookMediaOptions: ScheduleMediaOption[];
  initialClipSelection?: "secondary_only";
  initialLibraryItemId?: string;
  initialDemoMediaId: string;
  initialCaption?: string;
  initialHookMediaId: string;
  /** Explore has already prepared this exact output; composition stays fixed. */
  finalVideo?: ScheduleMediaOption;
  /** Explicit Explore background acceptance; never used by the generic schedule API. */
  pendingVideo?: ScheduleMediaOption;
  initialPlannedTargets: ScheduleCreateTargetInput[];
  initialScheduledDate: string;
  initialScheduledTime: string;
  initialUseDefaultScheduleTime?: boolean;
  initialTimezone?: string;
  minimumScheduleLeadMinutes: number;
  onClose: () => void;
  onRefreshMedia: () => Promise<boolean>;
  onRefreshConnections: () => Promise<boolean>;
  onUploadVideo?: (file: File) => Promise<ScheduleMediaOption>;
  onSave: (submission: ScheduleFormSubmission) => void;
  requireScheduleTarget: boolean;
  saving: boolean;
  socialConnections: SocialConnection[];
  tiktokBetaEnabled: boolean;
  youtubeBetaEnabled: boolean;
  /** Explore keeps confirmation within its scheduling panel; other callers stay modal. */
  presentation?: "modal" | "inline" | "workflow";
  /** Preserve unsent inline edits when returning to the overview form. */
  onCloseDraft?: (draft: ScheduleEditorDraftSnapshot) => void;
  onDraftChange?: (draft: ScheduleEditorDraftSnapshot) => void;
}) {
  const deviceHour12 = useDeviceTimeFormat();
  const inline = presentation !== "modal";
  const workflow = presentation === "workflow";
  useLockBodyScroll(!inline);
  const defaultTimezone = useAccountTimeZone();
  const dialogRef = useRef<HTMLElement>(null);

  const isCarouselSchedule = Boolean(
    initialLibraryItemId || editingSchedule?.sourceKind === "library_item" && editingSchedule.libraryItemId,
  );
  const carouselLibraryItemId = isCarouselSchedule
    ? initialLibraryItemId ?? editingSchedule?.libraryItemId ?? null
    : null;
  const fixedInlineSource = inline && Boolean(finalVideo || pendingVideo || initialLibraryItemId);
  const enabledPlatforms = useMemo<SchedulePlatform[]>(
    () => [
      "instagram",
      ...(tiktokBetaEnabled ? (["tiktok"] as const) : []),
      ...(youtubeBetaEnabled ? (["youtube"] as const) : []),
    ],
    [tiktokBetaEnabled, youtubeBetaEnabled],
  );
  const selectablePlatforms = useMemo(
    () =>
      isCarouselSchedule
        ? enabledPlatforms.filter(supportsCarouselPublishing)
        : enabledPlatforms,
    [enabledPlatforms, isCarouselSchedule],
  );
  const videoPublishingAccountLabel = getPublishingAccountLabel(
    tiktokBetaEnabled,
    youtubeBetaEnabled,
  );
  const carouselPublishingAccountLabel = getPublishingAccountLabel(
    tiktokBetaEnabled,
    false,
  );
  const publishingAccountLabel = isCarouselSchedule
    ? carouselPublishingAccountLabel
    : videoPublishingAccountLabel;
  const hasAdditionalVideoPublishingPlatform =
    tiktokBetaEnabled || youtubeBetaEnabled;
  const hasAdditionalCarouselPublishingPlatform = tiktokBetaEnabled;
  const publishingConnections = useMemo(
    () =>
      socialConnections.filter(
        (connection) =>
          selectablePlatforms.includes(connection.platform) &&
          connection.status !== "revoked",
      ),
    [selectablePlatforms, socialConnections],
  );
  const initialConnectionIds = getInitialScheduleConnectionIds({
    connections: publishingConnections,
    isCarouselSchedule,
    plannedPlatforms: editingPlannedPlatforms,
    plannedTargets: initialPlannedTargets,
  });
  // Keep providers outside the currently selectable publishing surface dormant,
  // so legacy drafts remain lossless when saved.
  const dormantLegacyTargets = getDormantScheduleTargets({
    allowedPlatforms: selectablePlatforms,
    connections: socialConnections,
    plannedTargets: initialPlannedTargets,
  });
  const [useOpeningClip, setUseOpeningClip] = useState(
    () =>
      getInitialClipSelection({
        editingIsCombinedVideo,
        editingSchedule,
        hasHookOptions: hookMediaOptions.length > 0,
        hasSecondaryOptions: demoMediaOptions.length > 0,
        requestedSelection: finalVideo || pendingVideo ? "secondary_only" : initialClipSelection,
      }).useHook,
  );
  const [useSecondaryClip, setUseSecondaryClip] = useState(
    () =>
      getInitialClipSelection({
        editingIsCombinedVideo,
        editingSchedule,
        hasHookOptions: hookMediaOptions.length > 0,
        hasSecondaryOptions: demoMediaOptions.length > 0,
        requestedSelection: finalVideo || pendingVideo ? "secondary_only" : initialClipSelection,
      }).useSecondary,
  );
  const selectedHookMediaId = initialHookMediaId;
  const [selectedDemoMediaId, setSelectedDemoMediaId] = useState<string>(
    finalVideo?.id ?? pendingVideo?.id ?? (initialDemoMediaId || initialHookMediaId),
  );
  const [uploadedVideos, setUploadedVideos] = useState<ScheduleMediaOption[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const uploadingVideoRef = useRef(false);
  const videoOptions = useMemo(() => Array.from(new Map(
    [...uploadedVideos, ...demoMediaOptions, ...hookMediaOptions].map(option => [option.id, option]),
  ).values()), [demoMediaOptions, hookMediaOptions, uploadedVideos]);
  const [refreshingMedia, setRefreshingMedia] = useState(false);
  const [hookPickerError, setHookPickerError] = useState<string | null>(null);
  const [caption, setCaption] = useState(editingSchedule?.caption ?? initialCaption);
  const [selectedConnectionIds, setSelectedConnectionIds] =
    useState<string[]>(initialConnectionIds);
  const [accountSelectionChanged, setAccountSelectionChanged] = useState(false);
  const [publishingSettings, setPublishingSettings] = useState<
    Record<string, ConnectionPublishingSettings>
  >(() =>
    Object.fromEntries(
      initialPlannedTargets.map((target) => [
        target.connectionId,
        getSavedPublishingSettings(target.settings),
      ]),
    ),
  );
  const [tiktokCapabilities, setTikTokCapabilities] = useState<
    Record<string, TikTokCapabilitiesState>
  >({});
  const [aiDisclosureDefault, setAiDisclosureDefault] = useState(true);
  const [brandOrganicDefault, setBrandOrganicDefault] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(!editingSchedule);
  useEffect(() => {
    if (editingSchedule) return;
    const controller = new AbortController();
    void requestPublishingPreferences(undefined, controller.signal).then((preferences) => {
      if (!controller.signal.aborted) {
        setAiDisclosureDefault(preferences.containsSyntheticMedia);
        setBrandOrganicDefault(preferences.tiktokBrandOrganic);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setPreferencesError("Your account default could not load. Review the AI content setting for this post in publishing options.");
    }).finally(() => {
      if (!controller.signal.aborted) setPreferencesLoading(false);
    });
    return () => controller.abort();
  }, [editingSchedule]);
  const effectivePublishingSettings = useMemo(() => Object.fromEntries(
    publishingConnections.map((connection) => [connection.id, {
      ...getDefaultPublishingSettings(connection.platform),
      ...(connection.platform !== "instagram" ? { containsSyntheticMedia: aiDisclosureDefault } : {}),
      ...(connection.platform === "tiktok" ? { brandOrganic: brandOrganicDefault, commercialContentDisclosureEnabled: brandOrganicDefault } : {}),
      ...publishingSettings[connection.id],
    }]),
  ), [aiDisclosureDefault, brandOrganicDefault, publishingConnections, publishingSettings]);
  const [scheduledDateOverride, setScheduledDate] = useState<string | null>(editingScheduledDate ?? null);
  const [scheduledTimeOverride, setScheduledTime] = useState<string | null>(editingScheduledTime ?? null);
  const scheduledDate = scheduledDateOverride ?? initialScheduledDate;
  const scheduledTime = scheduledTimeOverride ?? initialScheduledTime;
  const [timezoneOverride, setTimezone] = useState<string | null>(editingSchedule?.timezone ?? null);
  const timezone = timezoneOverride ?? initialTimezone ?? defaultTimezone;
  const [postNow, setPostNow] = useState(initialUseDefaultScheduleTime && !editingSchedule);
  const [fiveMinutesFromSubmit, setFiveMinutesFromSubmit] = useState(false);
  const useDefaultScheduleTime = (postNow && !editingSchedule) || fiveMinutesFromSubmit;
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const localHookMediaOptions = hookMediaOptions;

  const activeHookMediaId = localHookMediaOptions.some(
    (option) => option.id === selectedHookMediaId,
  )
    ? selectedHookMediaId
    : "";
  const activeDemoMediaId = videoOptions.some(
    (option) => option.id === selectedDemoMediaId,
  )
    ? selectedDemoMediaId
    : "";
  const selectedHookMedia = useOpeningClip
    ? localHookMediaOptions.find((option) => option.id === activeHookMediaId) ?? null
    : null;
  const selectedDemoMedia =
    isCarouselSchedule || !useSecondaryClip
      ? null
      : videoOptions.find((option) => option.id === activeDemoMediaId) ?? null;
  const selectedPublishMedia = selectedDemoMedia ?? selectedHookMedia;
  const shouldCombineClips = useOpeningClip && useSecondaryClip;

  useEffect(() => {
    if (
      isCarouselSchedule ||
      editingSchedule ||
      videoOptions.length === 0
    ) {
      return;
    }

    if (!selectedDemoMediaId) {
      setSelectedDemoMediaId(videoOptions[0]!.id);
    }
  }, [videoOptions, editingSchedule, isCarouselSchedule, selectedDemoMediaId]);

  const availableSocialConnections = useMemo(
    () =>
      socialConnections.filter(
        (connection) =>
          selectablePlatforms.includes(connection.platform) &&
          connection.status !== "revoked" &&
          (!isCarouselSchedule ||
            supportsCarouselPublishing(connection.platform)),
      ),
    [isCarouselSchedule, selectablePlatforms, socialConnections],
  );
  const selectedConnections = useMemo(
    () =>
      availableSocialConnections.filter((connection) =>
        selectedConnectionIds.includes(connection.id),
      ),
    [availableSocialConnections, selectedConnectionIds],
  );
  const draftTargets = useMemo(() => selectedConnections.map(connection => ({ connectionId: connection.id, platform: connection.platform })), [selectedConnections]);
  const draftChange = useRef(onDraftChange);
  useEffect(() => { draftChange.current = onDraftChange; }, [onDraftChange]);
  useEffect(() => {
    if (workflow) draftChange.current?.({ caption, date: scheduledDate, time: scheduledTime, timezone, targets: draftTargets });
  }, [workflow, caption, scheduledDate, scheduledTime, timezone, draftTargets]);
  const hasInstagramDestination = selectedConnections.some(
    (connection) => connection.platform === "instagram",
  );
  const unavailableSavedInstagramTargets =
    getUnavailableSavedInstagramTargets({
      allowedPlatforms: selectablePlatforms,
      connections: socialConnections,
      plannedTargets: initialPlannedTargets,
    });
  const unavailableSavedTargetError =
    editingSchedule &&
    unavailableSavedInstagramTargets.length > 0 &&
    !accountSelectionChanged
      ? `${
          unavailableSavedInstagramTargets.length === 1
            ? "A previously selected publishing account is"
            : `${unavailableSavedInstagramTargets.length} previously selected publishing accounts are`
        } unavailable. Reconnect the account or explicitly confirm a replacement selection before saving.`
      : null;
  const captionValidationError =
    caption.length > MAX_SCHEDULE_CAPTION_LENGTH
      ? `Caption must be ${MAX_SCHEDULE_CAPTION_LENGTH.toLocaleString()} characters or fewer.`
      : null;
  const publishingSettingsError = getPublishingSettingsError({
    connections: selectedConnections,
    requireTikTokMusicConfirmation: false,
    settings: effectivePublishingSettings,
    tiktokCapabilities,
  });
  const tiktokPublishingAgreement = getTikTokPublishingAgreement({
    connections: selectedConnections,
    settings: effectivePublishingSettings,
  });
  const selectedTime = useDefaultScheduleTime
    ? automaticScheduleParts(currentTime, minimumScheduleLeadMinutes, timezone, fiveMinutesFromSubmit ? 0 : 1)
    : { date: scheduledDate, time: scheduledTime };
  const scheduleTimeValidation = useMemo(
    () =>
      getScheduleTimeValidation({
        date: selectedTime.date,
        minimumLeadMinutes: minimumScheduleLeadMinutes,
        now: currentTime,
        time: selectedTime.time,
        timezone,
      }),
    [
      currentTime,
      minimumScheduleLeadMinutes,
      selectedTime.date,
      selectedTime.time,
      timezone,
    ],
  );
  const minimumScheduledDate = useMemo(() => {
    try {
      return getZonedDateTimeParts(currentTime, timezone).date;
    } catch {
      return toDateKey(new Date(currentTime));
    }
  }, [currentTime, timezone]);
  const scheduleClock = useMemo(() => {
    try {
      const now = getZonedDateTimeParts(currentTime, timezone);
      const earliest = getZonedDateTimeParts(getEarliestScheduleTimestamp({
        minimumLeadMinutes: minimumScheduleLeadMinutes,
        now: currentTime,
      }), timezone);
      return { now, earliest };
    } catch {
      return null;
    }
  }, [currentTime, minimumScheduleLeadMinutes, timezone]);
  const status = isCarouselSchedule
    ? ("draft" as const)
    : getDraftStatusPreview({
        demoMedia: selectedDemoMedia,
        hookMedia: selectedHookMedia,
        useHookClip: useOpeningClip,
        useSecondaryClip,
      });
  const pendingExploreReview = inline && !finalVideo && !initialLibraryItemId && Boolean(pendingVideo && pendingVideo.sourceType === "combined_video" && pendingVideo.status === "missing_render" && selectedDemoMedia?.status === "missing_render" && selectedDemoMedia.id === pendingVideo.id) && !useOpeningClip && useSecondaryClip;
  const fixedVideoReadinessError = fixedInlineSource && !isCarouselSchedule && !pendingExploreReview && selectedDemoMedia?.status !== "ready"
    ? "Wait for your finished video, or return to the workflow to confirm background preparation." : null;
  const mediaValidationError = uploadingVideo ? "Wait for your video upload to finish." : pendingExploreReview ? null : fixedVideoReadinessError ?? getScheduleMediaValidationError({
    hookMedia: isCarouselSchedule ? null : selectedHookMedia,
    secondaryMedia: isCarouselSchedule
      ? initialLibraryItemId
        ? { id: initialLibraryItemId, sourceType: "generated_carousel", status: "ready", title: "Saved slideshow" }
        : getCarouselScheduleMediaOption(editingSchedule)
      : selectedDemoMedia,
    useHookClip: isCarouselSchedule ? false : useOpeningClip,
    useSecondaryClip: isCarouselSchedule ? true : useSecondaryClip,
  });
  const hasSelectedConnections = selectedConnections.length > 0;
  const canSaveDraft = Boolean(
    !(preferencesLoading && selectedConnections.some((connection) => connection.platform !== "instagram")) && !mediaValidationError &&
      (isCarouselSchedule ? carouselLibraryItemId : selectedPublishMedia) &&
      (useDefaultScheduleTime || scheduledDate && scheduledTime) &&
      !scheduleTimeValidation.error &&
      !publishingSettingsError &&
      !captionValidationError &&
      !unavailableSavedTargetError &&
      (!(requireScheduleTarget || useDefaultScheduleTime) || hasSelectedConnections) &&
      !saving,
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      // Whole-minute selections have the same lead result until the next
      // minute boundary. Sleeping tabs still get a fresh check on submit.
      setCurrentTime(previous => Math.ceil(previous / 60_000) === Math.ceil(now / 60_000) ? previous : now);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!inline) return;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
      dialogRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [inline]);

  useEffect(() => {
    if (inline) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          scheduleDialogFocusableSelector,
        ),
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0]!;
      const lastElement = focusableElements[focusableElements.length - 1]!;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement ||
          !dialogRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [inline, onClose]);

  function toggleConnection(connectionId: string) {
    const connection = availableSocialConnections.find(
      (candidate) => candidate.id === connectionId,
    );
    const selecting = !selectedConnectionIds.includes(connectionId);

    setAccountSelectionChanged(true);

    setSelectedConnectionIds((currentConnectionIds) =>
      currentConnectionIds.includes(connectionId)
        ? currentConnectionIds.filter((currentId) => currentId !== connectionId)
        : [...currentConnectionIds.filter(currentId => !workflow || !connection || availableSocialConnections.find(candidate => candidate.id === currentId)?.platform !== connection.platform), connectionId],
    );

    if (!selecting || !connection) {
      return;
    }

    setPublishingSettings((current) =>
      current[connectionId]
        ? current
        : {
            ...current,
            [connectionId]: {},
          },
    );

    if (
      connection.platform === "tiktok" &&
      tiktokCapabilities[connectionId]?.status !== "ready" &&
      tiktokCapabilities[connectionId]?.status !== "loading"
    ) {
      void loadTikTokCapabilities(connectionId);
    }
  }

  function updatePublishingSetting(
    connectionId: string,
    key: string,
    value: boolean | string,
  ) {
    setPublishingSettings((current) => ({
      ...current,
      [connectionId]: {
        ...(current[connectionId] ?? {}),
        [key]: value,
      },
    }));
  }

  const loadTikTokCapabilities = useCallback(async (connectionId: string) => {
    setTikTokCapabilities((current) => ({
      ...current,
      [connectionId]: { status: "loading" },
    }));

    try {
      const data = await withReadDeadline(async (signal) => {
        const token = await getCurrentUserIdToken();
        signal.throwIfAborted();

        if (!token) {
          throw new Error("Sign in before loading TikTok settings.");
        }

        const response = await fetch(
          `/api/social/connections/${connectionId}/publish-settings`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
            signal,
          },
        );
        const data = (await response.json()) as TikTokPublishSettingsResponse;
        signal.throwIfAborted();

        if (!response.ok || data.ok !== true) {
          throw new Error(
            getApiResponseMessage(
              data,
              "Could not load TikTok publishing settings.",
            ),
          );
        }

        return data;
      });

      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: {
          capabilities: data.capabilities,
          status: "ready",
        },
      }));
      setPublishingSettings((current) => {
        const settings =
          current[connectionId] ?? {};
        const privacyLevel = settings.privacyLevel;

        return {
          ...current,
          [connectionId]: {
            ...settings,
            allowComment: data.capabilities.interactions.commentsDisabled
              ? false
              : settings.allowComment === true,
            allowDuet: data.capabilities.interactions.duetsDisabled
              ? false
              : settings.allowDuet === true,
            allowStitch: data.capabilities.interactions.stitchesDisabled
              ? false
              : settings.allowStitch === true,
            privacyLevel:
              isTikTokPrivacyLevel(privacyLevel) &&
              data.capabilities.privacyLevels.includes(privacyLevel) &&
              (data.capabilities.directPostAudited || privacyLevel === "SELF_ONLY")
                ? privacyLevel
                : "",
          },
        };
      });
    } catch (error) {
      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: {
          message: getErrorMessage(
            error,
            "Could not load TikTok publishing settings.",
          ),
          status: "error",
        },
      }));
    }
  }, []);

  useEffect(() => {
    for (const connection of selectedConnections) {
      if (
        connection.platform === "tiktok" &&
        !tiktokCapabilities[connection.id]
      ) {
        void loadTikTokCapabilities(connection.id);
      }
    }
  }, [loadTikTokCapabilities, selectedConnections, tiktokCapabilities]);

  function handleSelectVideo(mediaId: string) {
    if (uploadingVideoRef.current || saving) return;
    setUseOpeningClip(false);
    setUseSecondaryClip(true);
    setHookPickerError(null);
    setSelectedDemoMediaId(mediaId);
  }

  async function handleUploadVideo(file: File) {
    if (!onUploadVideo || uploadingVideoRef.current || saving) return;
    uploadingVideoRef.current = true;
    setUploadingVideo(true);
    setHookPickerError(null);
    try {
      const video = await onUploadVideo(file);
      setUploadedVideos(previous => [...previous.filter(option => option.id !== video.id), video]);
      uploadingVideoRef.current = false;
      handleSelectVideo(video.id);
      // The selected uploaded asset remains usable even if catalog refresh fails.
      void onRefreshMedia().catch(() => false);
    } catch (error) {
      setHookPickerError(getErrorMessage(error, "Could not upload this video. Try again."));
    } finally {
      uploadingVideoRef.current = false;
      setUploadingVideo(false);
    }
  }

  async function handleRefreshMedia() {
    setHookPickerError(null);
    setRefreshingMedia(true);

    try {
      const refreshed = await onRefreshMedia();

      if (!refreshed) {
        setHookPickerError("Could not refresh scheduling media.");
      }
    } finally {
      setRefreshingMedia(false);
    }
  }

  function handleSaveDraft() {
    if (uploadingVideoRef.current || saving) return;
    // A tab can sleep or cross the lead boundary between its last render and
    // this click. Validate the current instant before submitting any request.
    const now = Date.now();
    const chosenTime = useDefaultScheduleTime
      ? automaticScheduleParts(now, minimumScheduleLeadMinutes, timezone, fiveMinutesFromSubmit ? 0 : 1)
      : { date: scheduledDate, time: scheduledTime };
    const timeValidation = getScheduleTimeValidation({
      date: chosenTime.date,
      time: chosenTime.time,
      timezone,
      minimumLeadMinutes: minimumScheduleLeadMinutes,
      now,
    });
    setCurrentTime(now);
    if (
      mediaValidationError ||
      (useDefaultScheduleTime && !hasSelectedConnections) ||
      (isCarouselSchedule ? !carouselLibraryItemId : !selectedPublishMedia) ||
      !timeValidation.scheduledFor ||
      timeValidation.error ||
      captionValidationError ||
      publishingSettingsError ||
      unavailableSavedTargetError
    ) {
      return;
    }

    onSave({
      ...(useDefaultScheduleTime ? { useDefaultScheduleTime: true } : {}),
      caption,
      clipSelection: shouldCombineClips
        ? "hook_and_secondary"
        : useOpeningClip
          ? "hook_only"
          : "secondary_only",
      openingMedia: shouldCombineClips ? selectedHookMedia : null,
      scheduledDate: chosenTime.date,
      scheduledFor: timeValidation.scheduledFor,
      scheduledSource: isCarouselSchedule
        ? { id: carouselLibraryItemId!, kind: "library_item" }
        : { id: selectedPublishMedia!.id, kind: "media_asset" },
      scheduledSourceTitle:
        isCarouselSchedule
          ? editingSchedule?.title ?? "Saved slideshow"
          : selectedPublishMedia!.title,
      scheduledVideo: selectedPublishMedia,
      scheduledTime: chosenTime.time,
      targets: [
        // Preserve targets outside the enabled publishing surface so edits never
        // silently delete legacy providers.
        ...dormantLegacyTargets,
        ...selectedConnections.map((connection) => ({
          connectionId: connection.id,
          platform: connection.platform,
          settings: getConfirmedScheduleTargetSettings(
            connection.platform,
            effectivePublishingSettings[connection.id],
          ),
        })),
      ],
      timezone,
      useOpeningClip: isCarouselSchedule ? false : shouldCombineClips,
    });
  }

  return (
    <div
      role={inline ? undefined : "presentation"}
      className={inline ? "min-w-0" : "fixed inset-0 z-50 flex items-center justify-center bg-overlay p-0 backdrop-blur-sm sm:p-4"}
      onMouseDown={(event) => {
        if (!inline && event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <aside
        ref={dialogRef}
        role={inline ? "region" : "dialog"}
        aria-modal={inline ? undefined : true}
        aria-labelledby="schedule-drawer-title"
        aria-describedby="schedule-drawer-description"
        tabIndex={-1}
        className={inline ? "flex min-w-0 w-full flex-col rounded-[var(--radius-panel)] border border-border bg-card" : "flex h-full w-full flex-col overflow-hidden border border-border bg-card shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:h-[calc(100vh-2rem)] sm:max-h-[920px] sm:max-w-[1400px] sm:rounded-[var(--radius-panel)]"}
      >
        <div className={inline ? "grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-border px-5 py-4" : "flex items-start justify-between gap-4 border-b border-border bg-card px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-5 lg:px-8"}>
          <div className={inline ? "contents" : "flex min-w-0 items-start gap-3"}>
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
              <SocialPlatformIcon className="size-4" platform="instagram" />
            </span>
            <div className={inline ? "contents" : "min-w-0"}>
              <h2
                id="schedule-drawer-title"
                className={cn("min-w-0 text-lg font-bold tracking-normal text-foreground", inline && "col-start-2 row-start-1")}
              >
                {workflow ? "Schedule your video" : inline ? "Confirm your schedule" : finalVideo ? "Review schedule" : isCarouselSchedule
                  ? `Schedule ${hasAdditionalCarouselPublishingPlatform ? "publishing" : "Instagram"} carousel`
                  : editingSchedule
                    ? `Edit ${hasAdditionalVideoPublishingPlatform ? "publishing" : "Instagram"} schedule`
                    : `Schedule ${hasAdditionalVideoPublishingPlatform ? "publishing" : "Instagram"} post`}
              </h2>
              <p
                id="schedule-drawer-description"
                className={cn("max-w-2xl text-sm font-medium leading-6 text-muted", inline ? "col-span-3 row-start-2" : "mt-1")}
              >
                {workflow ? "Choose where and when to share your video." : inline ? "Check the caption, accounts and publishing options before scheduling." : finalVideo ? `Review your finished video, choose your ${publishingAccountLabel} account, and set the publish time.` : isCarouselSchedule
                  ? `Confirm the carousel, choose your ${publishingAccountLabel} account, and set the publish time.`
                  : `Choose real media, your ${publishingAccountLabel} account, and when the post should publish.`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size={inline ? "sm" : "icon"}
            onClick={() => {
              if (inline) onCloseDraft?.({ caption, date: scheduledDate, time: scheduledTime, timezone, ...(workflow ? { targets: draftTargets } : {}) });
              onClose();
            }}
            disabled={inline && saving}
            aria-label={workflow ? "Back to Edit" : inline ? "Back to schedule settings" : "Close scheduling workspace"}
            className={inline ? "col-start-3 row-start-1 shrink-0" : "inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-control border border-border bg-card text-muted transition hover:border-border-strong hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"}
          >
            {workflow ? "Back to Edit" : inline ? "Back" : <X className="size-4" aria-hidden="true" />}
          </Button>
        </div>

        {!inline ? <ol
          aria-label="Scheduling checklist"
          className="grid grid-cols-3 border-b border-border bg-card-muted/40 px-4 sm:px-6 lg:px-8"
        >
          {scheduleSetupSteps.map((item) => (
            <li
              key={item.step}
              className="flex min-w-0 items-center gap-2.5 border-r border-border px-2 py-3 first:pl-0 last:border-r-0 last:pr-0 sm:gap-3 sm:px-4"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/15">
                {item.step}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-foreground sm:hidden">
                  {item.mobileLabel}
                </span>
                <span className="hidden truncate text-sm font-bold text-foreground sm:block">
                  {item.label}
                </span>
                <span className="mt-0.5 hidden truncate text-[11px] font-semibold text-muted md:block">
                  {item.description}
                </span>
              </span>
            </li>
          ))}
        </ol> : null}

        <div className={inline ? "min-w-0 px-5" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8"}>
          <div className="mx-auto max-w-[1280px] divide-y divide-border">
            <ScheduleFlowSection
              compact={inline}
              step="1"
              title="Media"
              description={
                finalVideo ? "Review your finished video and optional caption" : isCarouselSchedule
                  ? "Saved carousel and optional caption"
                  : "Upload one video or choose from Demo and Creative Assets"
              }
            >
              <div className={inline ? "grid min-w-0 gap-4" : "grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] xl:gap-6"}>
                <div className="grid content-start gap-4">
                  {fixedInlineSource ? null : finalVideo ? (
                    <FinalVideoPreview key={finalVideo.id} video={finalVideo} />
                  ) : isCarouselSchedule && editingSchedule ? (
                    <ScheduledCarouselSourceCard schedule={editingSchedule} />
                  ) : (
                    <ScheduleVideoPicker
                      errorMessage={hookPickerError}
                      mediaOptions={videoOptions}
                      selectedMediaId={selectedPublishMedia?.id ?? activeDemoMediaId}
                      refreshingMedia={refreshingMedia}
                      uploadingVideo={uploadingVideo}
                      disabled={saving}
                      onRefreshMedia={handleRefreshMedia}
                      onSelectMedia={handleSelectVideo}
                      onUploadVideo={onUploadVideo ? handleUploadVideo : undefined}
                      savedSequenceTitle={shouldCombineClips ? editingSchedule?.title : undefined}
                    />
                  )}
                  <label className="block">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-foreground">
                        Caption
                        {isCarouselSchedule ? (
                          <span className="ml-1 font-semibold text-muted">
                            (optional)
                          </span>
                        ) : null}
                      </span>
                      <span
                        id="schedule-caption-count"
                        className={cn(
                          "text-xs font-semibold tabular-nums text-muted",
                          captionValidationError && "text-error",
                        )}
                      >
                        {caption.length.toLocaleString()}/
                        {MAX_SCHEDULE_CAPTION_LENGTH.toLocaleString()}
                      </span>
                    </span>
                    <textarea
                      name="scheduleCaption"
                      aria-describedby="schedule-caption-count"
                      autoComplete="off"
                      maxLength={MAX_SCHEDULE_CAPTION_LENGTH}
                      rows={5}
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder={
                        isCarouselSchedule
                          ? "Add a caption if you want one…"
                          : hasAdditionalVideoPublishingPlatform
                            ? "Write a caption for your selected accounts…"
                            : "Write your Instagram caption…"
                      }
                      className="mt-2 min-h-32 w-full resize-none rounded-control border border-border bg-card-muted px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-muted-subtle hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                    <span className="mt-2 block text-xs font-semibold text-muted">
                      {hasAdditionalVideoPublishingPlatform
                        ? "Caption optional. It is sent to each selected publishing account."
                        : "Caption optional. Appears with your Instagram post, separate from the text on the video or slides."}
                    </span>
                    {captionValidationError ? (
                      <span className="mt-2 block text-xs font-semibold text-error">
                        {captionValidationError}
                      </span>
                    ) : null}
                  </label>
                  {mediaValidationError ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
                    >
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>{mediaValidationError}</span>
                    </div>
                  ) : null}
                </div>

                {!inline ? <div className="grid content-start gap-4">
                  {finalVideo ? (
                    <p className="rounded-control border border-border bg-card-muted/45 px-4 py-3 text-sm leading-6 text-muted">This finished video will be published to each selected account. Return to Explore to edit it.</p>
                  ) : isCarouselSchedule && editingSchedule ? (
                    <CarouselSchedulePreview schedule={editingSchedule} />
                  ) : (
                    <ScheduleVideoPreview video={shouldCombineClips ? null : selectedPublishMedia} savedSequenceTitle={shouldCombineClips ? editingSchedule?.title : undefined} />
                  )}
                  {hasInstagramDestination ? (
                    <InstagramCaptionPreview caption={caption} />
                  ) : null}
                </div> : null}
              </div>
            </ScheduleFlowSection>

            <ScheduleFlowSection
              compact={inline}
              step="2"
              title={
                hasAdditionalVideoPublishingPlatform
                  ? "Publishing account"
                  : "Instagram account"
              }
              description="Choose where this post will publish"
            >
              <ConnectedAccountSelector
                connections={availableSocialConnections}
                enabledPlatforms={selectablePlatforms}
                onRefresh={onRefreshConnections}
                onToggle={toggleConnection}
                selectedConnectionIds={selectedConnectionIds}
                accountLabel={publishingAccountLabel}
                isPhoto={isCarouselSchedule}
              />

              {unavailableSavedTargetError ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
                >
                  <Info
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p>{unavailableSavedTargetError}</p>
                    {hasSelectedConnections ? (
                      <button
                        type="button"
                        onClick={() => setAccountSelectionChanged(true)}
                        className="mt-2 inline-flex h-8 items-center justify-center rounded-control border border-error/25 bg-card px-3 text-xs font-bold text-foreground transition hover:bg-card-muted"
                      >
                        Use selected {selectedConnections.length === 1 ? "account" : "accounts"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedConnections.length > 0 ? (
                <PlatformPublishingSettings
                  connections={selectedConnections}
                  isPhoto={isCarouselSchedule}
                  errorMessage={publishingSettingsError}
                  settings={effectivePublishingSettings}
                  tiktokCapabilities={tiktokCapabilities}
                  onChange={updatePublishingSetting}
                  onRetryTikTok={loadTikTokCapabilities}
                />
              ) : null}
              {preferencesError && selectedConnections.some((connection) => connection.platform !== "instagram") ? <p role="status" className="mt-3 max-w-xl text-xs leading-5 text-muted">{preferencesError}</p> : null}
            </ScheduleFlowSection>

            <ScheduleFlowSection
              compact={inline}
              step="3"
              title="Date & time"
              description="Publish time in the selected timezone"
            >
              <div className={inline ? "grid min-w-0 gap-4" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]"}>
                <div className={inline ? "grid w-full max-w-[480px] content-start gap-3" : "grid content-start gap-3"}>
                  <ScheduleQuickActions timezone={timezone} disabled={saving} onSelect={(parts, preset) => { setFiveMinutesFromSubmit(preset === 5); setPostNow(false); setCurrentTime(Date.now()); setTimezone(timezone); setScheduledDate(parts.date); setScheduledTime(parts.time); }} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-bold text-foreground">
                        Date
                      </span>
                      <input
                        name="scheduledDate"
                        autoComplete="off"
                        type="date"
                        aria-describedby={
                          scheduleTimeValidation.error
                            ? "schedule-time-feedback"
                            : undefined
                        }
                        aria-invalid={Boolean(scheduleTimeValidation.error)}
                        min={minimumScheduledDate}
                        value={scheduledDate}
                        onChange={(event) => { setFiveMinutesFromSubmit(false); setPostNow(false); setTimezone(timezone); setScheduledTime(scheduledTime); setScheduledDate(event.target.value); }}
                        className="mt-2 h-11 w-full rounded-control border border-border bg-card-muted px-4 text-sm font-bold text-foreground outline-none transition [color-scheme:dark] hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <div className="block">
                      <span className="text-sm font-bold text-foreground">
                        Time
                      </span>
                      <ScheduleTimePicker
                        value={scheduledTime}
                        errorMessageId={
                          scheduleTimeValidation.error
                            ? "schedule-time-feedback"
                            : undefined
                        }
                        invalid={Boolean(scheduleTimeValidation.error)}
                        onChange={(value) => { setFiveMinutesFromSubmit(false); setPostNow(false); setCurrentTime(Date.now()); setTimezone(timezone); setScheduledDate(scheduledDate); setScheduledTime(value); }}
                      />
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-bold text-foreground">
                      Timezone
                    </span>
                    <select
                      name="scheduleTimezone"
                      autoComplete="off"
                      aria-describedby={
                        scheduleTimeValidation.error
                          ? "schedule-time-feedback"
                          : undefined
                      }
                      aria-invalid={Boolean(scheduleTimeValidation.error)}
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="mt-2 h-11 w-full rounded-control border border-border bg-card-muted px-4 text-sm font-bold text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      {getTimezoneOptions(timezone).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!postNow && scheduleClock ? <div id="schedule-clock-help" className="text-xs font-semibold leading-5 text-muted">
                    <p>Now: {formatScheduleClock(scheduleClock.now, deviceHour12)} · {timezone}</p>
                    <p>Earliest: {formatScheduleClock(scheduleClock.earliest, deviceHour12)}. Allow {minimumScheduleLeadMinutes} full {minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"}.</p>
                    {scheduleTimeValidation.error && scheduleTimeValidation.scheduledFor ? <button
                      type="button"
                      disabled={saving}
                      className="mt-1 min-h-9 rounded-control border border-border px-3 py-1 text-foreground hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      onClick={() => {
                        const now = Date.now();
                        // Keep a further minute for confirmation and transport.
                        const next = automaticScheduleParts(now, minimumScheduleLeadMinutes, timezone);
                        setFiveMinutesFromSubmit(false);
                        setCurrentTime(now);
                        setTimezone(timezone);
                        setScheduledDate(next.date);
                        setScheduledTime(next.time);
                      }}
                    >Use next available time</button> : null}
                  </div> : null}

                  {scheduleTimeValidation.error ? (
                    <div
                      id="schedule-time-feedback"
                      role="alert"
                      className="flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
                    >
                      <Clock3
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{scheduleTimeValidation.error}</span>
                    </div>
                  ) : null}
                </div>

                {inline ? null : finalVideo ? <p className="self-start rounded-control border border-border bg-card-muted/45 px-4 py-3 text-sm leading-6 text-muted">Your finished video is ready. Confirm the accounts, caption and publish time before scheduling.</p> : <StatusPreview
                  openingMedia={isCarouselSchedule ? null : selectedHookMedia}
                  scheduledMedia={
                    isCarouselSchedule
                      ? getCarouselScheduleMediaOption(editingSchedule)
                      : selectedDemoMedia
                  }
                  status={status}
                  useHookClip={isCarouselSchedule ? false : useOpeningClip}
                  useSecondaryClip={isCarouselSchedule ? true : useSecondaryClip}
                />}
              </div>
            </ScheduleFlowSection>
          </div>
        </div>

        <div className={inline ? "border-t border-border px-5 py-4" : "border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgb(16_32_51_/_0.06)] sm:px-6 sm:py-4 lg:px-8"}>
          {tiktokPublishingAgreement ? (
            <p className="mb-3 text-xs leading-5 text-muted">
              {tiktokPublishingAgreement}
            </p>
          ) : null}
          {errorMessage ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
            >
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <div className={inline ? "flex flex-wrap items-center justify-between gap-3" : "mx-auto flex max-w-[1280px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"}>
            <p className="max-w-3xl text-xs font-semibold leading-5 text-muted">
              {unavailableSavedTargetError
                ? unavailableSavedTargetError
                : mediaValidationError
                  ? mediaValidationError
                  : hasSelectedConnections
                  ? pendingExploreReview
                    ? "Your schedule will be saved now. Video preparation continues in the background."
                    : finalVideo
                    ? "This finished video will be scheduled to your selected accounts."
                    : shouldCombineClips
                    ? "We prepare one combined video first, then schedule it automatically when ready."
                    : isCarouselSchedule
                      ? "The saved carousel will be scheduled to the selected account."
                      : "The selected video will be scheduled directly."
                  : requireScheduleTarget
                    ? "Choose a connected account before scheduling this post."
                    : `Choose a connected ${publishingAccountLabel} account before scheduling this post.`}
            </p>
            <Button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft}
              className={inline ? "min-h-11 shrink-0 gap-2" : "inline-flex h-11 w-full shrink-0 touch-manipulation items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(225_101_64_/_0.18)] transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-56"}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {saving ? "Scheduling…" : canSaveDraft ? editingSchedule ? "Save and schedule" : postNow ? "Post now" : "Schedule post" : unavailableSavedTargetError ? "Review saved account" : captionValidationError ? "Shorten caption" : publishingSettingsError ? "Review publishing settings" : (requireScheduleTarget || useDefaultScheduleTime) && !hasSelectedConnections ? "Choose an account" : mediaValidationError ?? (isCarouselSchedule || selectedPublishMedia ? "Choose date and time" : "Select media to schedule")}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ScheduleFlowSection({
  children,
  description,
  step,
  title,
  compact = false,
}: {
  children: ReactNode;
  description: string;
  step: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <section
      aria-labelledby={`schedule-step-${step}-title`}
      aria-describedby={`schedule-step-${step}-description`}
      className={compact ? "py-4" : "py-6 lg:py-7"}
    >
      <h3 id={`schedule-step-${step}-title`} className="sr-only">
        {title}
      </h3>
      <p id={`schedule-step-${step}-description`} className="sr-only">
        {description}
      </p>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function automaticScheduleParts(now: number, minimumLeadMinutes: number, timezone: string, bufferMinutes = 1) {
  try { return getZonedDateTimeParts(getEarliestScheduleTimestamp({ minimumLeadMinutes: minimumLeadMinutes + bufferMinutes, now }), timezone); }
  catch { return { date: "", time: "" }; }
}

function ScheduleTimePicker({
  errorMessageId,
  invalid,
  onChange,
  value,
}: {
  errorMessageId?: string;
  invalid: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedHourRef = useRef<HTMLButtonElement | null>(null);
  const selectedMinuteRef = useRef<HTMLButtonElement | null>(null);
  const [rawHour = "00", rawMinute = "00"] = value.split(":");
  const hour = scheduleHourValues.includes(rawHour) ? rawHour : "00";
  const minute = scheduleMinuteValues.includes(rawMinute) ? rawMinute : "00";
  const hour12 = useDeviceTimeFormat();
  const shownHour = pickerHour(hour, hour12);
  const period = Number(hour) >= 12 ? "PM" : "AM";
  const timeLabel = displayScheduleTime(`${hour}:${minute}`, hour12);

  useEffect(() => {
    if (!open) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      centerScheduleTimeOption(selectedHourRef);
      centerScheduleTimeOption(selectedMinuteRef);
    }, 100);

    return () => window.clearTimeout(scrollTimer);
  }, [hour, minute, open]);

  return (
    <div className="mt-2">
      <input type="hidden" name="scheduledTime" value={`${hour}:${minute}`} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`Choose publish time, currently ${timeLabel}`}
              aria-describedby={errorMessageId}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-control border bg-card-muted px-4 text-sm font-bold tabular-nums text-foreground outline-none transition hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
                invalid && "border-error/60",
              )}
            />
          }
        >
          <Clock3 className="size-4 text-primary" aria-hidden="true" />
          <span>{timeLabel}</span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 text-muted transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(92vw,460px)] gap-0 overflow-hidden p-0"
        >
          <PopoverHeader className="border-b border-border px-4 py-3">
            <PopoverTitle className="text-sm font-bold text-foreground">
              Choose publish time
            </PopoverTitle>
            <PopoverDescription className="text-xs font-semibold text-muted">
              Time in the selected timezone.
            </PopoverDescription>
          </PopoverHeader>

          <div className="divide-y divide-border">
            <ScheduleTimeRail
              label="Hour"
              selectedRef={selectedHourRef}
              selectedValue={shownHour}
              values={hour12 ? Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")) : scheduleHourValues}
              onSelect={(nextHour) => onChange(`${canonicalPickerHour(nextHour, period, hour12)}:${minute}`)}
            />
            <ScheduleTimeRail
              label="Minute"
              selectedRef={selectedMinuteRef}
              selectedValue={minute}
              values={scheduleMinuteValues}
              onSelect={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
            />
            {hour12 ? <ScheduleTimeRail label="AM/PM" selectedValue={period} values={["AM", "PM"]} onSelect={next => onChange(`${canonicalPickerHour(shownHour, next, true)}:${minute}`)} /> : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-card-muted/50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-[11px] font-semibold text-muted">
              <Clock3 className="size-3.5 text-primary" aria-hidden="true" />
              Selected {timeLabel}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center justify-center rounded-control bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function formatScheduleClock(parts: { date: string; time: string }, hour12: boolean) {
  return `${parts.date} ${displayScheduleTime(parts.time, hour12)}`;
}

function centerScheduleTimeOption(
  selectedRef: RefObject<HTMLButtonElement | null>,
) {
  const selectedOption = selectedRef.current;
  const scrollRail = selectedOption?.parentElement;

  if (!selectedOption || !scrollRail) {
    return;
  }

  scrollRail.scrollLeft = Math.max(
    0,
    selectedOption.offsetLeft -
      (scrollRail.clientWidth - selectedOption.clientWidth) / 2,
  );
}

function ScheduleTimeRail({
  label,
  onSelect,
  selectedRef,
  selectedValue,
  values,
}: {
  label: string;
  onSelect: (value: string) => void;
  selectedRef?: RefObject<HTMLButtonElement | null>;
  selectedValue: string;
  values: string[];
}) {
  return (
    <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="flex min-w-0 snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:thin]"
      >
        {values.map((option) => {
          const selected = option === selectedValue;

          return (
            <button
              key={option}
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option)}
              className={cn(
                "flex h-9 w-11 shrink-0 snap-center items-center justify-center rounded-control text-sm font-bold tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                selected
                  ? "bg-primary text-primary-foreground shadow-[0_6px_16px_rgb(225_101_64_/_0.2)]"
                  : "bg-card-muted text-foreground hover:bg-card",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleVideoPicker({
  errorMessage,
  uploadingVideo,
  disabled,
  onUploadVideo,
  savedSequenceTitle,
  mediaOptions,
  onRefreshMedia,
  onSelectMedia,
  refreshingMedia,
  selectedMediaId,
}: {
  errorMessage: string | null;
  uploadingVideo: boolean;
  disabled: boolean;
  onUploadVideo?: (file: File) => Promise<void>;
  savedSequenceTitle?: string;
  mediaOptions: ScheduleMediaOption[];
  onRefreshMedia: () => void;
  onSelectMedia: (mediaId: string) => void;
  refreshingMedia: boolean;
  selectedMediaId: string;
}) {
  const [open, setOpen] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const selectedMedia = mediaOptions.find(
    (option) => option.id === selectedMediaId,
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card-muted/45 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
            <FileVideo className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Video clip</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-muted">
              Upload a video or choose an existing video from Demo or Creative Assets.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Refresh videos"
            title="Refresh videos"
            disabled={refreshingMedia || uploadingVideo || disabled}
            onClick={onRefreshMedia}
            className="flex size-9 items-center justify-center rounded-control text-muted transition hover:bg-card hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", refreshingMedia && "animate-spin")} aria-hidden="true" />
          </button>

        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="px-4 py-3 text-xs font-semibold text-red-500">
          {errorMessage}
        </p>
      ) : null}

      {onUploadVideo ? <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <input ref={uploadInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" aria-label="Upload video clip" className="sr-only" disabled={uploadingVideo || disabled} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onUploadVideo(file);
        }} />
        <Button type="button" variant="outline" disabled={uploadingVideo || disabled} onClick={() => uploadInput.current?.click()}>
          {uploadingVideo ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {uploadingVideo ? "Uploading video…" : "Upload video"}
        </Button>
        <p className="text-xs text-muted">MP4, MOV or WebM · Up to 250 MB</p>
      </div> : null}
      {savedSequenceTitle ? <p className="px-4 pt-4 text-xs leading-5 text-muted">Saved video: {savedSequenceTitle}. Choosing a replacement publishes only that video.</p> : null}
      {mediaOptions.length > 0 ? (
        <div className="p-3">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  disabled={uploadingVideo || disabled}
                  aria-label={
                    selectedMedia
                      ? `Change selected video, currently ${selectedMedia.title}`
                      : "Choose a video"
                  }
                  className={cn(
                    "group flex min-h-20 w-full items-center gap-3 rounded-[var(--radius-card)] border bg-card-muted p-2.5 text-left transition hover:border-border-strong hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    selectedMedia
                      ? "border-primary/45 ring-1 ring-primary/10"
                      : "border-dashed border-border",
                  )}
                />
              }
            >
              <span className="relative flex size-16 shrink-0 overflow-hidden rounded-control border border-border bg-background">
                {selectedMedia ? (
                  <ScheduleMediaVisual option={selectedMedia} compact />
                ) : (
                  <span className="flex size-full items-center justify-center bg-brand-soft/40 text-primary">
                    <FileVideo className="size-5" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {savedSequenceTitle ?? selectedMedia?.title ?? "No video selected"}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold text-muted">
                  {selectedMedia
                    ? `${getMediaSourceLabel(selectedMedia)} - ${selectedMedia.durationLabel || "Duration pending"}`
                    : "Choose from Demo or Creative Assets."}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-primary">
                {selectedMedia ? "Change" : "Choose"}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform motion-reduce:transition-none",
                    open && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </span>
            </PopoverTrigger>

            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-[min(92vw,860px)] gap-0 overflow-hidden p-0"
            >
              <PopoverHeader className="border-b border-border px-4 py-3">
                <PopoverTitle className="text-sm font-bold text-foreground">
                  Choose a video
                </PopoverTitle>
                <PopoverDescription className="text-xs font-semibold text-muted">
                  Demo and Creative Assets videos appear here. Choose one video to publish.
                </PopoverDescription>
              </PopoverHeader>

              <div
                aria-label="Choose a video"
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-3 pb-4"
              >
                {mediaOptions.map((option) => (
                  <SchedulePrimaryMediaCard
                    key={option.id}
                    className="w-44 shrink-0 snap-start sm:w-52"
                    option={option}
                    selected={option.id === selectedMediaId}
                    onSelect={() => {
                      onSelectMedia(option.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <div className="m-3 rounded-[var(--radius-card)] border border-dashed border-border bg-card-muted px-4 py-7 text-center">
          <Video className="mx-auto size-7 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-foreground">
            No videos found.
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-muted">
            Upload a video here, or create a video in Creative Assets and refresh this list.
          </p>
        </div>
      )}
    </div>
  );
}

function SchedulePrimaryMediaCard({
  className,
  onSelect,
  option,
  selected,
}: {
  className?: string;
  onSelect: () => void;
  option: ScheduleMediaOption;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-[var(--radius-card)] border bg-card-muted text-left transition duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected
          ? "border-primary shadow-[0_14px_36px_rgb(225_101_64_/_0.14)] ring-2 ring-primary/20"
          : "border-border hover:-translate-y-0.5 hover:border-border-strong hover:bg-card motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div className="relative h-28 overflow-hidden border-b border-border bg-background">
        <ScheduleMediaVisual option={option} />
        <span
          className={cn(
            "absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border shadow-sm backdrop-blur transition",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/15 bg-black/55 text-white/70 group-hover:text-white",
          )}
          aria-hidden="true"
        >
          <CheckCircle2 className="size-4" />
        </span>
        <span className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          {option.durationLabel || "Video"}
        </span>
      </div>
      <span className="block p-3">
        <span className="block truncate text-sm font-bold text-foreground">
          {option.title}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
          <span className="truncate">{getMediaSourceLabel(option)}</span>
          <span className={cn("shrink-0", selected && "text-primary")}>
            {selected ? "Selected" : "Choose"}
          </span>
        </span>
      </span>
    </button>
  );
}

function ScheduleMediaVisual({
  compact = false,
  option,
}: {
  compact?: boolean;
  option: ScheduleMediaOption;
}) {
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(
    null,
  );

  if (option.thumbnailUrl && failedThumbnailUrl !== option.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={option.thumbnailUrl}
        alt=""
        width={360}
        height={440}
        loading="lazy"
        onError={() => setFailedThumbnailUrl(option.thumbnailUrl ?? null)}
        className="size-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    );
  }

  if (option.mediaUrl) {
    return (
      <span className="relative block size-full bg-background">
        <video
          src={option.mediaUrl}
          aria-hidden="true"
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white shadow-sm backdrop-blur",
            compact ? "size-7" : "size-9",
          )}
        >
          <Play
            className={cn("ml-0.5 fill-current", compact ? "size-3" : "size-4")}
            aria-hidden="true"
          />
        </span>
      </span>
    );
  }

  return (
    <span className="flex size-full items-center justify-center bg-brand-soft/40 text-muted">
      <FileVideo className="size-8" aria-hidden="true" />
    </span>
  );
}

function FinalVideoPreview({ video }: { video: ScheduleMediaOption }) {
  const [duration, setDuration] = useState<number | null>(null);
  return <section aria-label="Final video review" className="space-y-3 rounded-[var(--radius-card)] border border-border bg-card-muted/30 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-foreground">Final video</h3><span className="text-xs text-muted">{duration ? `${Math.round(duration * 10) / 10}s` : video.durationLabel ?? "Ready to publish"}</span></div>
    <video src={video.mediaUrl} poster={video.thumbnailUrl} controls playsInline preload="metadata" aria-label="Finished video to schedule" className="mx-auto max-h-[48dvh] w-full rounded-control bg-black object-contain" onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds); }} />
    <p className="break-words text-xs leading-5 text-muted">{video.title}</p>
  </section>;
}

function ScheduleVideoPreview({ video, savedSequenceTitle }: { video: ScheduleMediaOption | null; savedSequenceTitle?: string }) {
  return <section aria-label="Post preview" className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-4">
    <p className="text-sm font-bold text-foreground">Post preview</p>
    <p className="mt-1 text-xs leading-5 text-muted">{savedSequenceTitle ? "Your saved video sequence stays attached unless you choose a replacement." : "The selected video will be published to your chosen accounts."}</p>
    {video?.mediaUrl ? <video key={video.id} src={video.mediaUrl} controls playsInline preload="metadata" className="mt-4 max-h-[340px] w-full rounded-control bg-black object-contain" /> : null}
    <p className="mt-3 break-words text-sm font-semibold">{savedSequenceTitle ?? video?.title ?? "Choose or upload a video."}</p>
  </section>;
}

function ConnectedAccountSelector({
  accountLabel,
  isPhoto = false,
  connections,
  enabledPlatforms,
  onRefresh,
  onToggle,
  selectedConnectionIds,
}: {
  accountLabel: string;
  isPhoto?: boolean;
  connections: SocialConnection[];
  enabledPlatforms: SchedulePlatform[];
  onRefresh: () => Promise<boolean>;
  onToggle: (connectionId: string) => void;
  selectedConnectionIds: string[];
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const missingPlatforms = getMissingScheduleAccountPlatforms(enabledPlatforms, connections);

  async function refreshAccounts() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      if (!(await onRefresh())) {
        setRefreshError("Could not refresh publishing accounts. Try again.");
      }
    } catch {
      setRefreshError("Could not refresh publishing accounts. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="min-w-0 text-sm font-bold text-foreground">
          {accountLabel === "Instagram" ? "Instagram account" : "Publishing account"}
        </span>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refreshAccounts()}
          className={cn(styles.refreshAccounts, "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-foreground transition hover:bg-card-muted disabled:opacity-50")}
        >
          <RefreshCw className={cn("size-3.5 shrink-0", refreshing && "motion-safe:animate-spin")} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh accounts"}
        </button>
      </div>
      {refreshError ? <p role="alert" className="mt-2 text-xs font-semibold text-error">{refreshError}</p> : null}
        <div className="mt-2 grid gap-2">
          {connections.map((connection) => {
            const selected = selectedConnectionIds.includes(connection.id);
            const unavailableMessage =
              getConnectionPublishingBlockMessage(connection);
            const unavailable = Boolean(unavailableMessage);
            const accountName =
              connection.platformAccountUsername ||
              connection.platformAccountName ||
              connection.platformAccountId;
            const tileContent = (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card-muted">
                    <SocialPlatformIcon
                      className="size-5"
                      platform={connection.platform}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {isPhoto && connection.platform === "instagram" ? "Instagram carousel" : getSchedulePlatformLabel(connection.platform)}
                      </span>
                      {selected ? (
                        <CheckCircle2
                          className="size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold leading-5 text-muted">
                      {accountName}
                    </span>
                  </span>
                </span>
                {unavailableMessage ? (
                  <span className="mt-2 block text-[11px] font-semibold leading-4 text-error">
                    {unavailableMessage}
                  </span>
                ) : null}
              </>
            );

            if (unavailable) {
              return (
                <div
                  key={connection.id}
                  className="rounded-control border border-error/25 bg-error/10 px-3 py-3"
                >
                  {tileContent}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href="/settings#instagram-publishing"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control border border-border bg-card-muted px-3 text-xs font-bold text-foreground transition hover:border-border-strong hover:bg-card"
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Reconnect account
                    </a>
                    {selected ? (
                      <button
                        type="button"
                        onClick={() => onToggle(connection.id)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control border border-error/25 bg-card-muted px-3 text-xs font-bold text-error transition hover:bg-error/10"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <button
                key={connection.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggle(connection.id)}
                className={cn(
                  "rounded-control border bg-card-muted px-3 py-2.5 text-left transition hover:border-border-strong hover:bg-card",
                  selected
                    ? "border-primary/60 ring-2 ring-primary/15"
                    : "border-border",
                )}
              >
                {tileContent}
              </button>
            );
          })}
          {missingPlatforms.map(platform => (
            <div key={platform} className="rounded-control border border-dashed border-border bg-card-muted px-3 py-3">
              <div className="flex items-center gap-3">
                <SocialPlatformIcon className="size-5 shrink-0" platform={platform} />
                <div>
                  <p className="text-sm font-bold text-foreground">{isPhoto && platform === "instagram" ? "Instagram carousel" : getSchedulePlatformLabel(platform)}</p>
                  <p className="text-xs font-semibold leading-5 text-muted">No connected account. Connect one in Settings, then refresh accounts here.</p>
                </div>
              </div>
              <a
                href="/settings#instagram-publishing"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-border-strong hover:bg-card-muted"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Connect {platform === "tiktok" ? "TikTok" : platform === "youtube" ? "YouTube" : "Instagram"}
                <span className="sr-only"> (opens Settings in a new tab)</span>
              </a>
            </div>
          ))}
        </div>
    </div>
  );
}

function PlatformPublishingSettings({
  connections,
  isPhoto,
  errorMessage,
  onChange,
  onRetryTikTok,
  settings,
  tiktokCapabilities,
}: {
  connections: SocialConnection[];
  isPhoto: boolean;
  errorMessage: string | null;
  onChange: (
    connectionId: string,
    key: string,
    value: boolean | string,
  ) => void;
  onRetryTikTok: (connectionId: string) => void;
  settings: Record<string, ConnectionPublishingSettings>;
  tiktokCapabilities: Record<string, TikTokCapabilitiesState>;
}) {
  return (
    <section aria-labelledby="publishing-settings-title" className="mt-3 max-w-xl">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-primary" aria-hidden="true" />
        <h3
          id="publishing-settings-title"
          className="text-sm font-bold text-foreground"
        >
          Publishing options
        </h3>
      </div>

      <div className="mt-2 grid gap-2">
        {connections.filter((connection) => connection.platform === "tiktok").map((connection) => (
          <PlatformAccountSettings
            key={connection.id}
            connection={connection}
            isPhoto={isPhoto}
            settings={
              settings[connection.id] ??
              getDefaultPublishingSettings(connection.platform)
            }
            tiktokCapabilities={tiktokCapabilities[connection.id]}
            onChange={(key, value) => onChange(connection.id, key, value)}
            onRetryTikTok={() => onRetryTikTok(connection.id)}
          />
        ))}
        {connections.some((connection) => connection.platform !== "tiktok") ? <details className="rounded-control border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">More publishing options</summary>
          <div className="mt-3 grid gap-2">{connections.filter((connection) => connection.platform !== "tiktok").map((connection) => <PlatformAccountSettings key={connection.id} connection={connection} isPhoto={isPhoto} settings={settings[connection.id] ?? getDefaultPublishingSettings(connection.platform)} onChange={(key, value) => onChange(connection.id, key, value)} onRetryTikTok={() => onRetryTikTok(connection.id)} />)}</div>
        </details> : null}
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-[10px] bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
    </section>
  );
}

function PlatformAccountSettings({
  connection,
  isPhoto,
  onChange,
  onRetryTikTok,
  settings,
  tiktokCapabilities,
}: {
  connection: SocialConnection;
  isPhoto: boolean;
  onChange: (key: string, value: boolean | string) => void;
  onRetryTikTok: () => void;
  settings: ConnectionPublishingSettings;
  tiktokCapabilities?: TikTokCapabilitiesState;
}) {
  const accountName =
    connection.platformAccountUsername ||
    connection.platformAccountName ||
    connection.platformAccountId;

  return (
    <div className="rounded-control border border-border bg-card-muted/45 px-3 py-2.5">
      {connection.platform === "instagram" ? (
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">
              Show on profile grid
            </span>
            <span className="mt-0.5 block text-xs font-semibold leading-5 text-muted">
              Also show this Reel in {accountName}&apos;s main feed.
            </span>
          </span>
          <input
            type="checkbox"
            checked={getBooleanSetting(settings, "shareToFeed", true)}
            onChange={(event) => onChange("shareToFeed", event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
        </label>
      ) : (
        <>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SocialPlatformIcon
                className="size-4 shrink-0"
                platform={connection.platform}
              />
              <p className="text-sm font-bold text-foreground">
                {getSchedulePlatformLabel(connection.platform)}
              </p>
            </div>
            <p className="truncate text-xs font-semibold text-muted">{accountName}</p>
          </div>

      {connection.platform === "youtube" ? (
        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="text-xs font-bold text-foreground">Visibility</span>
            <select
              name={`youtubePrivacyStatus-${connection.id}`}
              value={getStringSetting(settings, "privacyStatus", "private")}
              onChange={(event) => onChange("privacyStatus", event.target.value)}
              className="mt-1.5 h-10 w-full rounded-control border border-border bg-card-muted px-3 text-sm font-semibold text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <SettingCheckbox
              checked={getBooleanSetting(settings, "notifySubscribers", false)}
              label="Notify subscribers"
              onChange={(checked) => onChange("notifySubscribers", checked)}
            />
            <SettingCheckbox
              checked={getBooleanSetting(settings, "madeForKids", false)}
              label="Made for kids"
              onChange={(checked) => onChange("madeForKids", checked)}
            />
          </div>
          <SettingCheckbox
            checked={getBooleanSetting(
              settings,
              "containsSyntheticMedia",
              true,
            )}
            description="Disclose realistic altered or AI-generated people or events."
            label="Contains synthetic media"
            onChange={(checked) =>
              onChange("containsSyntheticMedia", checked)
            }
          />
        </div>
      ) : null}

      {connection.platform === "tiktok" ? (
        <TikTokAccountSettings
          isPhoto={isPhoto}
          capabilitiesState={tiktokCapabilities}
          settings={settings}
          onChange={onChange}
          onRetry={onRetryTikTok}
        />
      ) : null}
        </>
      )}
    </div>
  );
}

function TikTokAccountSettings({
  capabilitiesState,
  isPhoto,
  onChange,
  onRetry,
  settings,
}: {
  capabilitiesState?: TikTokCapabilitiesState;
  isPhoto: boolean;
  onChange: (key: string, value: boolean | string) => void;
  onRetry: () => void;
  settings: ConnectionPublishingSettings;
}) {
  if (!capabilitiesState || capabilitiesState.status === "loading") {
    return (
      <div className="mt-3 flex h-10 items-center gap-2 text-xs font-semibold text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading available TikTok settings…
      </div>
    );
  }

  if (capabilitiesState.status === "error") {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-error/10 px-3 py-2">
        <p className="text-xs font-semibold leading-5 text-error">
          {capabilitiesState.message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-error transition hover:bg-error/10"
          aria-label="Retry TikTok publishing settings"
          title="Retry"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const capabilities = capabilitiesState.capabilities;
  const privacyLevel = getStringSetting(settings, "privacyLevel", "");
  const brandedContent = getBooleanSetting(settings, "brandedContent", false);

  return (
    <div className="mt-3 grid gap-3">
      {capabilities.creatorUsername || capabilities.creatorNickname ? (
        <p className="text-xs font-semibold text-muted">
          Posting as {capabilities.creatorUsername
            ? `@${capabilities.creatorUsername}`
            : capabilities.creatorNickname}
        </p>
      ) : null}
      {!capabilities.directPostAudited ? (
        <p className="rounded-control border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] font-semibold leading-5 text-foreground">
          {TIKTOK_PRIVATE_TESTING_VISIBILITY_MESSAGE}
        </p>
      ) : null}
      <label className="block">
        <span className="flex items-center justify-between gap-3 text-xs font-bold text-foreground">
          <span>Visibility</span>
          {capabilities.maxVideoDurationSeconds ? (
            <span className="font-semibold text-muted">
              Up to {capabilities.maxVideoDurationSeconds}s
            </span>
          ) : null}
        </span>
        <select
          value={privacyLevel}
          onChange={(event) => onChange("privacyLevel", event.target.value)}
          className="mt-1.5 h-10 w-full rounded-control border border-border bg-card-muted px-3 text-sm font-semibold text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="">Select visibility</option>
          {capabilities.privacyLevels.map((level) => (
            <option
              key={level}
              value={level}
              disabled={brandedContent && level === "SELF_ONLY"}
            >
              {getTikTokPrivacyLabel(level)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-xs font-bold text-foreground">
          Allow interactions
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <SettingCheckbox
            checked={getBooleanSetting(settings, "allowComment", false)}
            disabled={capabilities.interactions.commentsDisabled}
            label="Comments"
            onChange={(checked) => onChange("allowComment", checked)}
          />
          {!isPhoto ? <SettingCheckbox
            checked={getBooleanSetting(settings, "allowDuet", false)}
            disabled={capabilities.interactions.duetsDisabled}
            label="Duets"
            onChange={(checked) => onChange("allowDuet", checked)}
          /> : null}
          {!isPhoto ? <SettingCheckbox
            checked={getBooleanSetting(settings, "allowStitch", false)}
            disabled={capabilities.interactions.stitchesDisabled}
            label="Stitches"
            onChange={(checked) => onChange("allowStitch", checked)}
          /> : null}
        </div>
      </fieldset>

      <details className="rounded-control border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold text-foreground">AI content disclosure · {getBooleanSetting(settings, "containsSyntheticMedia", true) ? "On" : "Off"}</summary>
        <div className="mt-2">
          <SettingCheckbox
            checked={getBooleanSetting(settings, "containsSyntheticMedia", true)}
            description="Separate from commercial content disclosure."
            label="Contains AI-generated content"
            onChange={(checked) => onChange("containsSyntheticMedia", checked)}
          />
        </div>
        <a href="/settings#preferences" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary underline underline-offset-4">Set your default in Settings (opens a new tab)</a>
      </details>

    </div>
  );
}

function SettingCheckbox({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-10 items-start gap-2.5 rounded-control border border-border bg-card-muted px-3 py-2",
        disabled && "cursor-not-allowed bg-card-muted opacity-65",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-xs font-bold text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-muted">
            {description}
          </span>
        ) : disabled ? (
          <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-muted">
            Disabled in TikTok
          </span>
        ) : null}
      </span>
    </label>
  );
}

function getDefaultPublishingSettings(
  platform: SchedulePlatform,
): ConnectionPublishingSettings {
  return getDefaultScheduleTargetSettings(platform);
}

function getPublishingSettingsError(params: {
  connections: SocialConnection[];
  requireTikTokMusicConfirmation?: boolean;
  settings: Record<string, ConnectionPublishingSettings>;
  tiktokCapabilities: Record<string, TikTokCapabilitiesState>;
}) {
  return getScheduleTargetSettingsError(params);
}

function getBooleanSetting(
  settings: ConnectionPublishingSettings,
  key: string,
  fallback: boolean,
) {
  return typeof settings[key] === "boolean"
    ? (settings[key] as boolean)
    : fallback;
}

function getStringSetting(
  settings: ConnectionPublishingSettings,
  key: string,
  fallback: string,
) {
  return typeof settings[key] === "string"
    ? (settings[key] as string)
    : fallback;
}

function StatusPreview({
  openingMedia,
  scheduledMedia,
  status,
  useHookClip,
  useSecondaryClip,
}: {
  openingMedia: ScheduleMediaOption | null;
  scheduledMedia: ScheduleMediaOption | null;
  status: ScheduleDraftStatus;
  useHookClip: boolean;
  useSecondaryClip: boolean;
}) {
  const message = getStatusPreviewMessage({
    hookMedia: openingMedia,
    secondaryMedia: scheduledMedia,
    useHookClip,
    useSecondaryClip,
  });

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Status preview</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            {message}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-card-muted px-2.5 py-1 text-xs font-bold text-muted">
          {getScheduleStatusLabel(status)}
        </span>
      </div>
    </div>
  );
}

function supportsCarouselPublishing(platform: SchedulePlatform) {
  return platform === "instagram" || platform === "tiktok";
}

function getCarouselScheduleMediaOption(
  schedule: ScheduledPost | null,
): ScheduleMediaOption | null {
  if (!schedule?.libraryItemId || schedule.sourceKind !== "library_item") {
    return null;
  }

  return {
    id: schedule.libraryItemId,
    sourceType: "generated_carousel",
    status: "ready",
    title: schedule.title,
  };
}

function getSavedPublishingSettings(value: unknown): ConnectionPublishingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, boolean | string] =>
        typeof entry[1] === "boolean" || typeof entry[1] === "string",
    ),
  );
}

function getInitialClipSelection(params: {
  editingIsCombinedVideo: boolean;
  editingSchedule: ScheduledPost | null;
  hasHookOptions: boolean;
  hasSecondaryOptions: boolean;
  requestedSelection?: "secondary_only";
}) {
  if (params.requestedSelection === "secondary_only") {
    return { useHook: false, useSecondary: true };
  }

  const savedSelection = params.editingSchedule?.metadata.clipSelection;

  if (savedSelection === "hook_only") {
    return { useHook: true, useSecondary: false };
  }

  if (savedSelection === "hook_and_secondary") {
    return { useHook: true, useSecondary: true };
  }

  if (savedSelection === "secondary_only") {
    return { useHook: false, useSecondary: true };
  }

  if (params.editingSchedule) {
    return params.editingIsCombinedVideo
      ? { useHook: true, useSecondary: true }
      : { useHook: false, useSecondary: true };
  }

  return {
    useHook: false,
    useSecondary: true,
  };
}

function getApiResponseMessage(responseData: unknown, fallback: string) {
  if (!responseData || typeof responseData !== "object") {
    return fallback;
  }

  const message = (responseData as { message?: unknown }).message;
  const error = (responseData as { error?: unknown }).error;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return typeof error === "string" && error.trim() ? error : fallback;
}

function getMediaSourceLabel(option: ScheduleMediaOption) {
  const sourceLabels: Record<ScheduleMediaOption["sourceType"], string> = {
    demo_video: "Content video",
    combined_video: "Combined video",
    edit_video: "Edited video",
    generated_carousel: "Generated carousel",
    generated_video: "Generated video",
    influencer_video: "Presenter",
    user_video: "Uploaded video",
    wall_text_render: "Wall-of-text Reel",
    reaction_render: "Reaction Reel",
  };

  return sourceLabels[option.sourceType];
}

function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getDraftStatusPreview({
  demoMedia,
  hookMedia,
  useHookClip,
  useSecondaryClip,
}: {
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
  useHookClip: boolean;
  useSecondaryClip: boolean;
}): ScheduleDraftStatus {
  if (
    (!useHookClip && !useSecondaryClip) ||
    (useHookClip && !hookMedia) ||
    (useSecondaryClip && !demoMedia)
  ) {
    return "media_required";
  }

  return useHookClip && useSecondaryClip ? "render_required" : "draft";
}

function getScheduleMediaValidationError(params: {
  hookMedia: ScheduleMediaOption | null;
  secondaryMedia: ScheduleMediaOption | null;
  useHookClip: boolean;
  useSecondaryClip: boolean;
}) {
  if (!params.useHookClip && !params.useSecondaryClip) {
    return "Choose or upload a video to schedule.";
  }

  if (params.useHookClip && !params.hookMedia) {
    return "The saved video is missing a source. Choose a replacement video.";
  }

  if (params.useSecondaryClip && !params.secondaryMedia) {
    return "Choose or upload a video to schedule.";
  }

  return null;
}

function getStatusPreviewMessage(params: {
  hookMedia: ScheduleMediaOption | null;
  secondaryMedia: ScheduleMediaOption | null;
  useHookClip: boolean;
  useSecondaryClip: boolean;
}) {
  const mediaError = getScheduleMediaValidationError(params);

  if (mediaError) {
    return mediaError;
  }

  return params.useHookClip && params.useSecondaryClip
    ? "We prepare one combined video first, then schedule it automatically."
    : "The selected video will be published as the scheduled Reel.";
}

function getTimezoneOptions(currentTimezone: string) {
  return getSchedulingTimeZoneOptions(currentTimezone);
}

function useLockBodyScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [enabled]);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
