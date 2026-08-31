"use client";

import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileVideo,
  Images,
  Info,
  Layers2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Video,
  X,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  getInitialScheduleConnectionIds,
  getUnavailableSavedInstagramTargets,
} from "@/lib/scheduling/schedule-form-persistence";
import {
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  type ScheduleTargetSettings,
} from "@/lib/scheduling/platform-settings";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
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
  getZonedDateTimeParts,
  resolveZonedDateTime,
  ScheduleTimeError,
  SOCIAL_SCHEDULING_TIME_STEP_SECONDS,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import {
  getTikTokPrivacyLabel,
  isTikTokPrivacyLevel,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

const openingVideoSourceTabs = [
  { id: "all", label: "All" },
  { id: "creators", label: "Creator clips" },
  { id: "videos", label: "Videos" },
] as const;
const scheduleSetupSteps = [
  { description: "Choose what to publish", label: "Media", mobileLabel: "Media", step: "1" },
  { description: "Select the destination", label: "Instagram account", mobileLabel: "Account", step: "2" },
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
const defaultTimezone =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";

export type ScheduleFormSubmission = {
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
        error: `Choose a time at least ${params.minimumLeadMinutes} ${
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
  initialDemoMediaId,
  initialHookMediaId,
  initialPlannedTargets,
  initialScheduledDate,
  initialScheduledTime,
  minimumScheduleLeadMinutes,
  onClose,
  onRefreshMedia,
  onSave,
  requireScheduleTarget,
  saving,
  socialConnections,
}: {
  demoMediaOptions: ScheduleMediaOption[];
  editingIsCombinedVideo: boolean;
  editingPlannedPlatforms: SchedulePlatform[];
  editingSchedule: ScheduledPost | null;
  editingScheduledDate: string | null;
  editingScheduledTime: string | null;
  errorMessage: string | null;
  hookMediaOptions: ScheduleMediaOption[];
  initialDemoMediaId: string;
  initialHookMediaId: string;
  initialPlannedTargets: ScheduleCreateTargetInput[];
  initialScheduledDate: string;
  initialScheduledTime: string;
  minimumScheduleLeadMinutes: number;
  onClose: () => void;
  onRefreshMedia: () => Promise<boolean>;
  onSave: (submission: ScheduleFormSubmission) => void;
  requireScheduleTarget: boolean;
  saving: boolean;
  socialConnections: SocialConnection[];
}) {
  useLockBodyScroll();
  const dialogRef = useRef<HTMLElement>(null);

  const isCarouselSchedule = Boolean(
    editingSchedule?.sourceKind === "library_item" &&
      editingSchedule.libraryItemId,
  );
  const carouselLibraryItemId = isCarouselSchedule
    ? editingSchedule?.libraryItemId ?? null
    : null;
  const instagramConnections = useMemo(
    () =>
      socialConnections.filter(
        (connection) =>
          connection.platform === "instagram" &&
          connection.status !== "revoked",
      ),
    [socialConnections],
  );
  const initialConnectionIds = getInitialScheduleConnectionIds({
    connections: instagramConnections,
    isCarouselSchedule,
    plannedPlatforms: editingPlannedPlatforms,
    plannedTargets: initialPlannedTargets,
  });
  /*
   * TikTok and YouTube target support is intentionally preserved for future
   * multi-platform use. The current product surface is Instagram-only, so
   * legacy non-Instagram targets stay dormant and are not shown in this form.
   */
  const dormantLegacyTargets = initialPlannedTargets.filter(
    (target) => {
      const savedConnection = socialConnections.find(
        (connection) => connection.id === target.connectionId,
      );
      const platform = target.platform ?? savedConnection?.platform;

      return platform !== undefined && platform !== "instagram";
    },
  );
  const [useOpeningClip, setUseOpeningClip] = useState(
    () =>
      getInitialClipSelection({
        editingIsCombinedVideo,
        editingSchedule,
        hasHookOptions: hookMediaOptions.length > 0,
        hasSecondaryOptions: demoMediaOptions.length > 0,
      }).useHook,
  );
  const [useSecondaryClip, setUseSecondaryClip] = useState(
    () =>
      getInitialClipSelection({
        editingIsCombinedVideo,
        editingSchedule,
        hasHookOptions: hookMediaOptions.length > 0,
        hasSecondaryOptions: demoMediaOptions.length > 0,
      }).useSecondary,
  );
  const [selectedHookMediaId, setSelectedHookMediaId] = useState<string>(
    initialHookMediaId,
  );
  const [selectedDemoMediaId, setSelectedDemoMediaId] = useState<string>(
    initialDemoMediaId,
  );
  const [refreshingMedia, setRefreshingMedia] = useState(false);
  const [hookPickerError, setHookPickerError] = useState<string | null>(null);
  const [caption, setCaption] = useState(editingSchedule?.caption ?? "");
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
  const [scheduledDate, setScheduledDate] = useState(
    editingScheduledDate ?? initialScheduledDate,
  );
  const [scheduledTime, setScheduledTime] = useState(
    editingScheduledTime ?? initialScheduledTime,
  );
  const [timezone, setTimezone] = useState(
    editingSchedule?.timezone ?? defaultTimezone,
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const localHookMediaOptions = hookMediaOptions;

  const activeHookMediaId = localHookMediaOptions.some(
    (option) => option.id === selectedHookMediaId,
  )
    ? selectedHookMediaId
    : "";
  const activeDemoMediaId = demoMediaOptions.some(
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
      : demoMediaOptions.find((option) => option.id === activeDemoMediaId) ?? null;
  const selectedPublishMedia = selectedDemoMedia ?? selectedHookMedia;
  const shouldCombineClips = useOpeningClip && useSecondaryClip;

  useEffect(() => {
    if (
      isCarouselSchedule ||
      editingSchedule ||
      selectedDemoMediaId ||
      demoMediaOptions.length === 0
    ) {
      return;
    }

    setSelectedDemoMediaId(demoMediaOptions[0]!.id);
  }, [demoMediaOptions, editingSchedule, isCarouselSchedule, selectedDemoMediaId]);

  useEffect(() => {
    if (
      isCarouselSchedule ||
      editingSchedule ||
      selectedHookMediaId ||
      localHookMediaOptions.length === 0
    ) {
      return;
    }

    setSelectedHookMediaId(localHookMediaOptions[0]!.id);
  }, [
    editingSchedule,
    isCarouselSchedule,
    localHookMediaOptions,
    selectedHookMediaId,
  ]);

  const availableSocialConnections = useMemo(
    () =>
      socialConnections.filter(
        (connection) =>
          connection.platform === "instagram" &&
          connection.status !== "revoked" &&
          (!isCarouselSchedule ||
            supportsCarouselPublishing(connection.platform)),
      ),
    [isCarouselSchedule, socialConnections],
  );
  const selectedConnections = useMemo(
    () =>
      availableSocialConnections.filter((connection) =>
        selectedConnectionIds.includes(connection.id),
      ),
    [availableSocialConnections, selectedConnectionIds],
  );
  const unavailableSavedInstagramTargets =
    getUnavailableSavedInstagramTargets({
      connections: socialConnections,
      plannedTargets: initialPlannedTargets,
    });
  const unavailableSavedTargetError =
    editingSchedule &&
    unavailableSavedInstagramTargets.length > 0 &&
    !accountSelectionChanged
      ? `${
          unavailableSavedInstagramTargets.length === 1
            ? "A previously selected Instagram account is"
            : `${unavailableSavedInstagramTargets.length} previously selected Instagram accounts are`
        } unavailable. Reconnect the account or explicitly confirm a replacement selection before saving.`
      : null;
  const captionValidationError =
    caption.length > MAX_SCHEDULE_CAPTION_LENGTH
      ? `Caption must be ${MAX_SCHEDULE_CAPTION_LENGTH.toLocaleString()} characters or fewer.`
      : null;
  const publishingSettingsError = getPublishingSettingsError({
    connections: selectedConnections,
    settings: publishingSettings,
    tiktokCapabilities,
  });
  const scheduleTimeValidation = useMemo(
    () =>
      getScheduleTimeValidation({
        date: scheduledDate,
        minimumLeadMinutes: minimumScheduleLeadMinutes,
        now: currentTime,
        time: scheduledTime,
        timezone,
      }),
    [
      currentTime,
      minimumScheduleLeadMinutes,
      scheduledDate,
      scheduledTime,
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
  const status = isCarouselSchedule
    ? ("draft" as const)
    : getDraftStatusPreview({
        demoMedia: selectedDemoMedia,
        hookMedia: selectedHookMedia,
        useHookClip: useOpeningClip,
        useSecondaryClip,
      });
  const mediaValidationError = getScheduleMediaValidationError({
    hookMedia: isCarouselSchedule ? null : selectedHookMedia,
    secondaryMedia: isCarouselSchedule
      ? getCarouselScheduleMediaOption(editingSchedule)
      : selectedDemoMedia,
    useHookClip: isCarouselSchedule ? false : useOpeningClip,
    useSecondaryClip: isCarouselSchedule ? true : useSecondaryClip,
  });
  const hasSelectedConnections = selectedConnections.length > 0;
  const canSaveDraft = Boolean(
    !mediaValidationError &&
      (isCarouselSchedule ? carouselLibraryItemId : selectedPublishMedia) &&
      scheduledDate &&
      scheduledTime &&
      !scheduleTimeValidation.error &&
      !publishingSettingsError &&
      !captionValidationError &&
      !unavailableSavedTargetError &&
      (!requireScheduleTarget || hasSelectedConnections) &&
      !saving,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
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
  }, [onClose]);

  function toggleConnection(connectionId: string) {
    const connection = availableSocialConnections.find(
      (candidate) => candidate.id === connectionId,
    );
    const selecting = !selectedConnectionIds.includes(connectionId);

    setAccountSelectionChanged(true);

    setSelectedConnectionIds((currentConnectionIds) =>
      currentConnectionIds.includes(connectionId)
        ? currentConnectionIds.filter((currentId) => currentId !== connectionId)
        : [...currentConnectionIds, connectionId],
    );

    if (!selecting || !connection) {
      return;
    }

    setPublishingSettings((current) =>
      current[connectionId]
        ? current
        : {
            ...current,
            [connectionId]: getDefaultPublishingSettings(connection.platform),
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
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before loading TikTok settings.");
      }

      const response = await fetch(
        `/api/social/connections/${connectionId}/publish-settings`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as TikTokPublishSettingsResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(
            data,
            "Could not load TikTok publishing settings.",
          ),
        );
      }

      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: {
          capabilities: data.capabilities,
          status: "ready",
        },
      }));
      setPublishingSettings((current) => {
        const settings =
          current[connectionId] ?? getDefaultPublishingSettings("tiktok");
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
              data.capabilities.privacyLevels.includes(privacyLevel)
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

  function handleSelectHookMedia(mediaId: string) {
    setHookPickerError(null);
    setSelectedHookMediaId(mediaId);
  }

  function handleToggleOpeningClip(enabled: boolean) {
    setUseOpeningClip(enabled);
    setHookPickerError(null);
  }

  function handleToggleSecondaryClip(enabled: boolean) {
    setUseSecondaryClip(enabled);
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
    if (
      mediaValidationError ||
      (isCarouselSchedule ? !carouselLibraryItemId : !selectedPublishMedia) ||
      !scheduleTimeValidation.scheduledFor ||
      scheduleTimeValidation.error ||
      captionValidationError ||
      unavailableSavedTargetError
    ) {
      return;
    }

    onSave({
      caption,
      clipSelection: shouldCombineClips
        ? "hook_and_secondary"
        : useOpeningClip
          ? "hook_only"
          : "secondary_only",
      openingMedia: shouldCombineClips ? selectedHookMedia : null,
      scheduledDate,
      scheduledFor: scheduleTimeValidation.scheduledFor,
      scheduledSource: isCarouselSchedule
        ? { id: carouselLibraryItemId!, kind: "library_item" }
        : { id: selectedPublishMedia!.id, kind: "media_asset" },
      scheduledSourceTitle:
        isCarouselSchedule && editingSchedule
          ? editingSchedule.title
          : selectedPublishMedia!.title,
      scheduledVideo: selectedPublishMedia,
      scheduledTime,
      targets: [
        // Preserve dormant legacy targets while this Instagram-first editor
        // hides TikTok/YouTube controls; editing must not silently delete them.
        ...dormantLegacyTargets,
        ...selectedConnections.map((connection) => ({
          connectionId: connection.id,
          platform: connection.platform,
          settings:
            publishingSettings[connection.id] ??
            getDefaultPublishingSettings(connection.platform),
        })),
      ],
      timezone,
      useOpeningClip: isCarouselSchedule ? false : shouldCombineClips,
    });
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-drawer-title"
        aria-describedby="schedule-drawer-description"
        tabIndex={-1}
        className="flex h-full w-full flex-col overflow-hidden border border-border bg-card shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:h-[calc(100vh-2rem)] sm:max-h-[920px] sm:max-w-[1400px] sm:rounded-[var(--radius-panel)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
              <SocialPlatformIcon className="size-4" platform="instagram" />
            </span>
            <div className="min-w-0">
              <h2
                id="schedule-drawer-title"
                className="text-lg font-bold tracking-normal text-foreground"
              >
                {isCarouselSchedule
                  ? "Schedule Instagram carousel"
                  : editingSchedule
                    ? "Edit Instagram schedule"
                    : "Schedule Instagram post"}
              </h2>
              <p
                id="schedule-drawer-description"
                className="mt-1 max-w-2xl text-sm font-medium leading-6 text-muted"
              >
                {isCarouselSchedule
                  ? "Confirm the carousel, choose your Instagram account, and set the publish time."
                  : "Choose real media, your Instagram account, and when the post should publish."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scheduling workspace"
            className="inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-control border border-border bg-card text-muted transition hover:border-border-strong hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ol
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
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1280px] divide-y divide-border">
            <ScheduleFlowSection
              step="1"
              title="Media"
              description={
                isCarouselSchedule
                  ? "Saved carousel and optional caption"
                  : "Choose a hook, a secondary clip, or both in sequence"
              }
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] xl:gap-6">
                <div className="grid content-start gap-4">
                  {isCarouselSchedule && editingSchedule ? (
                    <ScheduledCarouselSourceCard schedule={editingSchedule} />
                  ) : (
                    <>
                      <ScheduleOpeningClipControl
                        enabled={useOpeningClip}
                        onToggle={handleToggleOpeningClip}
                      >
                        <ScheduleOpeningMediaPicker
                          errorMessage={hookPickerError}
                          mediaOptions={localHookMediaOptions}
                          refreshingMedia={refreshingMedia}
                          selectedMediaId={activeHookMediaId}
                          onRefreshMedia={handleRefreshMedia}
                          onSelectMedia={handleSelectHookMedia}
                        />
                      </ScheduleOpeningClipControl>
                      <ScheduleRoleMediaPicker
                        description="Choose a Content video to play after the hook, or publish on its own."
                        emptyDescription="Create or upload a Content video, then select it here."
                        emptyTitle="No secondary clips found."
                        enabled={useSecondaryClip}
                        icon={<FileVideo className="size-4" aria-hidden="true" />}
                        mediaOptions={demoMediaOptions}
                        selectedMediaId={activeDemoMediaId}
                        title="Secondary clip"
                        onSelectMedia={setSelectedDemoMediaId}
                        onToggle={handleToggleSecondaryClip}
                      />
                    </>
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
                          : "Write your Instagram caption…"
                      }
                      className="mt-2 min-h-32 w-full resize-none rounded-control border border-border bg-card-muted px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-muted-subtle hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                    {isCarouselSchedule ? (
                      <span className="mt-2 block text-xs font-semibold text-muted">
                        Caption optional.
                      </span>
                    ) : null}
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

                <div className="grid content-start gap-4">
                  {isCarouselSchedule && editingSchedule ? (
                    <CarouselSchedulePreview schedule={editingSchedule} />
                  ) : (
                    <CompositionPreview
                      openingMedia={selectedHookMedia}
                      scheduledMedia={selectedDemoMedia}
                      useHookClip={useOpeningClip}
                      useSecondaryClip={useSecondaryClip}
                    />
                  )}
                </div>
              </div>
            </ScheduleFlowSection>

            <ScheduleFlowSection
              step="2"
              title="Instagram account"
              description="Choose where this post will publish"
            >
              <ConnectedAccountSelector
                connections={availableSocialConnections}
                onToggle={toggleConnection}
                selectedConnectionIds={selectedConnectionIds}
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
                  errorMessage={publishingSettingsError}
                  settings={publishingSettings}
                  tiktokCapabilities={tiktokCapabilities}
                  onChange={updatePublishingSetting}
                  onRetryTikTok={loadTikTokCapabilities}
                />
              ) : null}
            </ScheduleFlowSection>

            <ScheduleFlowSection
              step="3"
              title="Date & time"
              description="Publish time in the selected timezone"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
                <div className="grid content-start gap-3">
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
                        onChange={(event) => setScheduledDate(event.target.value)}
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
                        onChange={setScheduledTime}
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

                <StatusPreview
                  openingMedia={isCarouselSchedule ? null : selectedHookMedia}
                  scheduledMedia={
                    isCarouselSchedule
                      ? getCarouselScheduleMediaOption(editingSchedule)
                      : selectedDemoMedia
                  }
                  status={status}
                  useHookClip={isCarouselSchedule ? false : useOpeningClip}
                  useSecondaryClip={isCarouselSchedule ? true : useSecondaryClip}
                />
              </div>
            </ScheduleFlowSection>
          </div>
        </div>

        <div className="border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgb(16_32_51_/_0.06)] sm:px-6 sm:py-4 lg:px-8">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
            >
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <div className="mx-auto flex max-w-[1280px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl text-xs font-semibold leading-5 text-muted">
              {unavailableSavedTargetError
                ? unavailableSavedTargetError
                : hasSelectedConnections
                  ? shouldCombineClips
                    ? "We prepare one combined video first, then schedule it automatically when ready."
                    : isCarouselSchedule
                      ? "The saved carousel will be scheduled to the selected account."
                      : useOpeningClip
                        ? "The selected hook clip will be scheduled directly."
                        : "The selected secondary clip will be scheduled directly."
                  : requireScheduleTarget
                    ? "Choose a connected account before scheduling this post."
                    : "Choose a connected Instagram account before scheduling this post."}
            </p>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft}
              className="inline-flex h-11 w-full shrink-0 touch-manipulation items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(225_101_64_/_0.18)] transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-56"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {saving
                ? "Scheduling…"
                : canSaveDraft
                  ? editingSchedule
                    ? "Save and schedule"
                    : "Schedule post"
                  : unavailableSavedTargetError
                    ? "Review saved account"
                    : captionValidationError
                      ? "Shorten caption"
                      : publishingSettingsError
                        ? "Review publishing settings"
                        : requireScheduleTarget && !hasSelectedConnections
                          ? "Choose an account"
                          : isCarouselSchedule || selectedPublishMedia
                            ? "Choose date and time"
                            : mediaValidationError ?? "Select media to schedule"}
            </button>
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
}: {
  children: ReactNode;
  description: string;
  step: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`schedule-step-${step}-title`}
      aria-describedby={`schedule-step-${step}-description`}
      className="py-6 lg:py-7"
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
              aria-label={`Choose publish time, currently ${hour}:${minute}`}
              aria-describedby={errorMessageId}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-control border bg-card-muted px-4 text-sm font-bold tabular-nums text-foreground outline-none transition hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
                invalid && "border-error/60",
              )}
            />
          }
        >
          <Clock3 className="size-4 text-primary" aria-hidden="true" />
          <span>{hour}:{minute}</span>
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
              24-hour time with 1-minute precision.
            </PopoverDescription>
          </PopoverHeader>

          <div className="divide-y divide-border">
            <ScheduleTimeRail
              label="Hour"
              selectedRef={selectedHourRef}
              selectedValue={hour}
              values={scheduleHourValues}
              onSelect={(nextHour) => onChange(`${nextHour}:${minute}`)}
            />
            <ScheduleTimeRail
              label="Minute"
              selectedRef={selectedMinuteRef}
              selectedValue={minute}
              values={scheduleMinuteValues}
              onSelect={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-card-muted/50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-[11px] font-semibold text-muted">
              <Clock3 className="size-3.5 text-primary" aria-hidden="true" />
              Selected {hour}:{minute}
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
  selectedRef: RefObject<HTMLButtonElement | null>;
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

type OpeningVideoSourceTab = (typeof openingVideoSourceTabs)[number]["id"];

function ScheduleOpeningClipControl({
  children,
  enabled,
  onToggle,
}: {
  children: ReactNode;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      <label className="flex cursor-pointer items-start justify-between gap-4 bg-card-muted/45 px-4 py-3">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
            <Video className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">
              Hook clip
            </span>
            <span className="mt-0.5 block text-xs font-semibold leading-5 text-muted">
              Plays first. Choose a Creative Assets video or leave it out.
            </span>
          </span>
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-2 text-xs font-bold text-muted">
          {enabled ? "Included" : "Skip"}
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="size-4 shrink-0 accent-primary"
          />
        </span>
      </label>

      {enabled ? (
        <div className="px-4 pb-4">{children}</div>
      ) : (
        <p className="px-4 py-3 text-xs font-semibold leading-5 text-muted">
          This Reel will begin with the secondary clip only.
        </p>
      )}
    </section>
  );
}

function ScheduleOpeningMediaPicker({
  errorMessage,
  mediaOptions,
  onRefreshMedia,
  onSelectMedia,
  refreshingMedia,
  selectedMediaId,
}: {
  errorMessage: string | null;
  mediaOptions: ScheduleMediaOption[];
  onRefreshMedia: () => void;
  onSelectMedia: (mediaId: string) => void;
  refreshingMedia: boolean;
  selectedMediaId: string;
}) {
  const [activeSource, setActiveSource] =
    useState<OpeningVideoSourceTab>("all");
  const creatorMediaOptions = mediaOptions.filter(
    (option) => option.sourceType === "influencer_video",
  );
  const videoMediaOptions = mediaOptions.filter(
    (option) =>
      option.sourceType === "generated_video" ||
      option.sourceType === "user_video",
  );
  const sourceCounts: Record<OpeningVideoSourceTab, number> = {
    all: creatorMediaOptions.length + videoMediaOptions.length,
    creators: creatorMediaOptions.length,
    videos: videoMediaOptions.length,
  };
  const hasAnyOptions = sourceCounts.all > 0;

  function renderMediaOptions(options: ScheduleMediaOption[]) {
    return options.map((option) => (
      <ScheduleMediaOptionButton
        key={option.id}
        option={option}
        selected={option.id === selectedMediaId}
        onSelect={() => onSelectMedia(option.id)}
      />
    ));
  }

  function renderSourceSections() {
    if (activeSource === "creators") {
      return sourceCounts.creators > 0 ? (
        <OpeningVideoSourceSection
          count={creatorMediaOptions.length}
          title="Creator clips"
        >
          {renderMediaOptions(creatorMediaOptions)}
        </OpeningVideoSourceSection>
      ) : (
        <OpeningVideoEmptyState source={activeSource} />
      );
    }

    if (activeSource === "videos") {
      return sourceCounts.videos > 0 ? (
        <OpeningVideoSourceSection count={videoMediaOptions.length} title="Videos">
          {renderMediaOptions(videoMediaOptions)}
        </OpeningVideoSourceSection>
      ) : (
        <OpeningVideoEmptyState source={activeSource} />
      );
    }

    return hasAnyOptions ? (
      <>
        <OpeningVideoSourceSection
          count={creatorMediaOptions.length}
          title="Creator clips"
        >
          {renderMediaOptions(creatorMediaOptions)}
        </OpeningVideoSourceSection>
        <OpeningVideoSourceSection count={videoMediaOptions.length} title="Videos">
          {renderMediaOptions(videoMediaOptions)}
        </OpeningVideoSourceSection>
      </>
    ) : (
      <OpeningVideoEmptyState source={activeSource} />
    );
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-foreground">Creative Assets</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-muted">
            {sourceCounts.all} available
          </span>
          <button
            type="button"
            onClick={onRefreshMedia}
            disabled={refreshingMedia}
            aria-label="Refresh scheduling media"
            title="Refresh scheduling media"
            className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-card-muted text-muted transition hover:border-border-strong hover:bg-card hover:text-foreground disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-4", refreshingMedia ? "animate-spin" : null)}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div
        aria-label="Choose hook clip source"
        className="mt-3 flex flex-wrap gap-2"
      >
        {openingVideoSourceTabs.map((source) => {
          const selected = activeSource === source.id;

          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveSource(source.id)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-card-muted text-muted hover:bg-card hover:text-foreground",
              )}
            >
              {source.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  selected ? "bg-primary/15 text-primary" : "bg-card text-muted",
                )}
              >
                {sourceCounts[source.id]}
              </span>
            </button>
          );
        })}
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold leading-5 text-error"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-3 grid max-h-[320px] gap-3 overflow-y-auto pr-1">
        {renderSourceSections()}
      </div>
    </div>
  );
}

function OpeningVideoSourceSection({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-bold text-muted">{title}</p>
        <span className="text-[11px] font-bold text-muted">{count}</span>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function ScheduleMediaOptionButton({
  onSelect,
  option,
  selected,
}: {
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
        "grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-control border bg-card-muted p-2 text-left transition hover:border-border-strong hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="flex aspect-[9/12] items-center justify-center overflow-hidden rounded-control bg-card text-muted">
        {option.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.thumbnailUrl}
            alt=""
            width={116}
            height={154}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <FileVideo className="size-5 text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">
          {option.title}
        </p>
        <p className="mt-1 text-xs font-semibold text-muted">
          {getMediaSourceLabel(option)} -{" "}
          {option.durationLabel || "Duration pending"}
        </p>
      </div>
      {selected ? (
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}

function OpeningVideoEmptyState({ source }: { source: OpeningVideoSourceTab }) {
  const copy = getOpeningVideoEmptyCopy(source);

  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-card-muted px-4 py-5 text-center">
      <Video className="mx-auto size-7 text-muted" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-foreground">{copy.title}</p>
      <p className="mt-1 text-sm font-medium leading-6 text-muted">
        {copy.description}
      </p>
    </div>
  );
}

function ScheduleRoleMediaPicker({
  description,
  emptyDescription,
  emptyTitle,
  enabled,
  icon,
  mediaOptions,
  onSelectMedia,
  onToggle,
  selectedMediaId,
  title,
}: {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  enabled: boolean;
  icon: ReactNode;
  mediaOptions: ScheduleMediaOption[];
  onSelectMedia: (mediaId: string) => void;
  onToggle: (enabled: boolean) => void;
  selectedMediaId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedMedia = mediaOptions.find(
    (option) => option.id === selectedMediaId,
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
        !enabled && "bg-card-muted/20",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card-muted/45 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-muted">
              {description}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold text-muted">
          <span className="hidden sm:inline">{enabled ? "Included" : "Skip"}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="size-4 accent-primary"
          />
        </label>
      </div>

      {!enabled ? (
        <p className="px-4 py-3 text-xs font-semibold leading-5 text-muted">
          This Reel will use the hook clip only.
        </p>
      ) : mediaOptions.length > 0 ? (
        <div className="p-3">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={
                    selectedMedia
                      ? `Change selected secondary clip, currently ${selectedMedia.title}`
                      : "Choose a secondary clip"
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
                  {selectedMedia?.title ?? "No video selected"}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold text-muted">
                  {selectedMedia
                    ? `${getMediaSourceLabel(selectedMedia)} - ${selectedMedia.durationLabel || "Duration pending"}`
                    : "Open Content and choose a video."}
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
                  Choose a secondary clip
                </PopoverTitle>
                <PopoverDescription className="text-xs font-semibold text-muted">
                  Content videos appear here. Selecting a clip closes this list.
                </PopoverDescription>
              </PopoverHeader>

              <div
                aria-label="Choose a secondary clip"
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
            {emptyTitle}
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-muted">
            {emptyDescription}
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

function CompositionPreview({
  openingMedia,
  scheduledMedia,
  useHookClip,
  useSecondaryClip,
}: {
  openingMedia: ScheduleMediaOption | null;
  scheduledMedia: ScheduleMediaOption | null;
  useHookClip: boolean;
  useSecondaryClip: boolean;
}) {
  const hasHookClip = useHookClip && openingMedia;
  const hasSecondaryClip = useSecondaryClip && scheduledMedia;
  const hasBothClips = hasHookClip && hasSecondaryClip;

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Post preview</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            {hasBothClips
              ? "Hook plays first, then the secondary clip."
              : hasHookClip
                ? "Only the hook clip will be published."
                : hasSecondaryClip
                  ? "Only the secondary clip will be published."
                  : "Select at least one clip to prepare this Reel."}
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
          <Layers2 className="size-4" aria-hidden="true" />
        </span>
      </div>

      {hasBothClips ? (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <CompositionSlot label="Hook clip" media={openingMedia} />
          <span className="text-xs font-bold text-primary">→</span>
          <CompositionSlot label="Secondary clip" media={scheduledMedia} />
        </div>
      ) : (
        <div className="mt-4">
          <CompositionSlot
            label={hasHookClip ? "Hook clip" : "Secondary clip"}
            media={hasHookClip ? openingMedia : scheduledMedia}
          />
        </div>
      )}
    </div>
  );
}

function CompositionSlot({
  label,
  media,
}: {
  label: string;
  media: ScheduleMediaOption | null;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card-muted p-2">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-foreground">
        {media?.title ?? "Not selected"}
      </p>
    </div>
  );
}

function ConnectedAccountSelector({
  connections,
  onToggle,
  selectedConnectionIds,
}: {
  connections: SocialConnection[];
  onToggle: (connectionId: string) => void;
  selectedConnectionIds: string[];
}) {
  return (
    <div className="max-w-xl">
      <span className="text-sm font-bold text-foreground">
        Instagram account
      </span>
      {connections.length > 0 ? (
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
                        {getSchedulePlatformLabel(connection.platform)}
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
        </div>
      ) : (
        <div className="mt-2 rounded-control border border-dashed border-border bg-card-muted px-4 py-4 text-sm font-semibold leading-6 text-muted">
          <p>Connect Instagram before scheduling this post.</p>
          <a
            href="/settings#instagram-publishing"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-border-strong hover:bg-card-muted"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Connect Instagram
          </a>
        </div>
      )}
    </div>
  );
}

function PlatformPublishingSettings({
  connections,
  errorMessage,
  onChange,
  onRetryTikTok,
  settings,
  tiktokCapabilities,
}: {
  connections: SocialConnection[];
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
          Reel placement
        </h3>
      </div>

      <div className="mt-2 grid gap-2">
        {connections.map((connection) => (
          <PlatformAccountSettings
            key={connection.id}
            connection={connection}
            settings={
              settings[connection.id] ??
              getDefaultPublishingSettings(connection.platform)
            }
            tiktokCapabilities={tiktokCapabilities[connection.id]}
            onChange={(key, value) => onChange(connection.id, key, value)}
            onRetryTikTok={() => onRetryTikTok(connection.id)}
          />
        ))}
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
  onChange,
  onRetryTikTok,
  settings,
  tiktokCapabilities,
}: {
  connection: SocialConnection;
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

      {/* Dormant future multi-platform support: this YouTube branch is kept
          intact but receives no connections in the Instagram-only editor. */}
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

      {/* Dormant future multi-platform support: TikTok settings remain
          implemented so re-enabling the platform does not require a rewrite. */}
      {connection.platform === "tiktok" ? (
        <TikTokAccountSettings
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
  onChange,
  onRetry,
  settings,
}: {
  capabilitiesState?: TikTokCapabilitiesState;
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
          <SettingCheckbox
            checked={getBooleanSetting(settings, "allowDuet", false)}
            disabled={capabilities.interactions.duetsDisabled}
            label="Duets"
            onChange={(checked) => onChange("allowDuet", checked)}
          />
          <SettingCheckbox
            checked={getBooleanSetting(settings, "allowStitch", false)}
            disabled={capabilities.interactions.stitchesDisabled}
            label="Stitches"
            onChange={(checked) => onChange("allowStitch", checked)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-bold text-foreground">
          Content disclosure
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <SettingCheckbox
            checked={getBooleanSetting(
              settings,
              "containsSyntheticMedia",
              true,
            )}
            label="Contains AI-generated content"
            onChange={(checked) =>
              onChange("containsSyntheticMedia", checked)
            }
          />
          <SettingCheckbox
            checked={getBooleanSetting(settings, "brandOrganic", false)}
            label="Promotes your brand"
            onChange={(checked) => onChange("brandOrganic", checked)}
          />
          <SettingCheckbox
            checked={brandedContent}
            label="Paid partnership"
            onChange={(checked) => {
              onChange("brandedContent", checked);

              if (checked && privacyLevel === "SELF_ONLY") {
                onChange("privacyLevel", "");
              }
            }}
          />
        </div>
      </fieldset>

      <p className="text-[11px] font-semibold leading-5 text-muted">
        By posting, you agree to TikTok&apos;s Music Usage Confirmation.
      </p>
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
}) {
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
    useHook: params.hasHookOptions,
    useSecondary: params.hasSecondaryOptions,
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
  };

  return sourceLabels[option.sourceType];
}

function getOpeningVideoEmptyCopy(source: OpeningVideoSourceTab) {
  if (source === "creators") {
    return {
      description:
        "Upload a creator clip in Creative Assets before scheduling.",
      title: "No creator clips found.",
    };
  }

  if (source === "videos") {
    return {
      description:
        "Upload or generate a Creative Assets video before scheduling.",
      title: "No hook videos found.",
    };
  }

  return {
    description:
      "Add a video to Creative Assets before scheduling.",
    title: "No hook clips found.",
  };
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
    return "Include a hook clip, a secondary clip, or both.";
  }

  if (params.useHookClip && !params.hookMedia) {
    return "Select a hook clip or turn it off.";
  }

  if (params.useSecondaryClip && !params.secondaryMedia) {
    return "Select a secondary clip or turn it off.";
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
    : params.useHookClip
      ? "The hook clip will be published as the scheduled Reel."
      : "The secondary clip will be published as the scheduled Reel.";
}

function getTimezoneOptions(currentTimezone: string) {
  return Array.from(
    new Set([
      currentTimezone,
      "UTC",
      "Asia/Calcutta",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
    ]),
  );
}

function useLockBodyScroll() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
