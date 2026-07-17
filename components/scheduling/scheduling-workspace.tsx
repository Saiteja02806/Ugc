"use client";

import {
  Ban,
  CalendarPlus,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileVideo,
  Images,
  Info,
  Layers2,
  List,
  Loader2,
  Plus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Settings2,
  UserRound,
  X,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset, MediaSourceType } from "@/lib/media/types";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { getScheduleMediaIssue } from "@/lib/scheduling/media-availability";
import {
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  type ScheduleTargetSettings,
} from "@/lib/scheduling/platform-settings";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import {
  getSchedulePlatformLabel,
  getScheduleStatusLabel,
  schedulePlatforms,
  scheduleTabs,
  type ScheduledPost,
  type ScheduledPostTarget,
  type ScheduleCreateSourceInput,
  type ScheduleCreateTargetInput,
  type ScheduleDraft,
  type ScheduleDraftStatus,
  type ScheduleMediaIssue,
  type ScheduleMediaOption,
  type SchedulePlatform,
  type ScheduleTab,
  type ScheduleViewMode,
} from "@/lib/scheduling/types";
import {
  DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  getZonedDateTimeParts,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import {
  canCancelSchedule,
  canEditSchedule,
  getScheduleEditBlockReason,
} from "@/lib/scheduling/schedule-action-policy";
import type { SocialConnection } from "@/lib/social/types";
import {
  getTikTokPrivacyLabel,
  isTikTokPrivacyLevel,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import { cn } from "@/lib/utils";

const hookVideoSourceTypes: MediaSourceType[] = [
  "upload",
  "generated_video",
  "edit_export",
];
const scheduledVideoSourceTypes: MediaSourceType[] = [
  "demo_upload",
  "upload",
  "generated_video",
  "edit_export",
];
const openingVideoSourceTabs = [
  { id: "all", label: "All" },
  { id: "influencers", label: "Influencers" },
  { id: "videos", label: "Videos" },
  { id: "edited", label: "Edited" },
] as const;
type MediaListResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

type ScheduleCatalogInfluencerOption = {
  avatarId: string;
  durationLabel: string;
  id: string;
  thumbnailUrl?: string;
  title: string;
};

type AvatarListResponse =
  | {
      avatars: {
        asset: {
          durationSeconds: number | null;
          id: string;
          name: string;
          thumbnailUrl: string | null;
        };
      }[];
      ok: true;
    }
  | { error?: string; ok?: false };

type PreparedCatalogInfluencerResponse =
  | { asset: MediaAsset; ok: true }
  | { error?: string; ok?: false };

type ScheduleListResponse =
  | {
      minimumRenderLeadMinutes?: number;
      ok: true;
      schedules: ScheduledPost[];
    }
  | { message?: string; ok?: false };

type ScheduleCreateResponse =
  | { created: boolean; ok: true; schedule: ScheduledPost }
  | { message?: string; ok?: false };

type ScheduleRenderResponse =
  | {
      jobId?: string | null;
      ok: true;
      renderId?: string;
      schedule: ScheduledPost;
      status: "queued" | "ready" | "rendering";
    }
  | { message?: string; ok?: false };

type SchedulePublishResponse =
  | { created: boolean; ok: true; schedule: ScheduledPost }
  | { message?: string; ok?: false };

type SchedulePublishRetryResponse =
  | {
      created: boolean;
      ok: true;
      retryStatus: "in_progress" | "published" | "started";
      schedule: ScheduledPost;
    }
  | { message?: string; ok?: false };

type SocialConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message?: string; ok?: false };

type ScheduleMutationResponse =
  | { ok: true; schedule: ScheduledPost }
  | { message?: string; ok?: false };

type TikTokPublishSettingsResponse =
  | { capabilities: TikTokPublishCapabilities; ok: true }
  | { message?: string; ok?: false };

type ConnectionPublishingSettings = ScheduleTargetSettings;

type TikTokCapabilitiesState =
  | { status: "loading" }
  | { capabilities: TikTokPublishCapabilities; status: "ready" }
  | { message: string; status: "error" };

type ScheduleFormSubmission = {
  caption: string;
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

const tabLabels: Record<ScheduleTab, string> = {
  drafts: "Drafts",
  failed: "Failed",
  published: "Published",
  upcoming: "Upcoming",
};

const defaultTimezone =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";

export function SchedulingWorkspace() {
  const [serverSchedules, setServerSchedules] = useState<ScheduledPost[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const initialDraftQueryState = useRef<"handled" | "idle" | "opening">(
    "idle",
  );
  const [catalogInfluencerOptions, setCatalogInfluencerOptions] = useState<
    ScheduleCatalogInfluencerOption[]
  >([]);
  const [hookMediaOptions, setHookMediaOptions] = useState<ScheduleMediaOption[]>([]);
  const [demoMediaOptions, setDemoMediaOptions] = useState<ScheduleMediaOption[]>([]);
  const [scheduleMediaLoaded, setScheduleMediaLoaded] = useState(false);
  const drafts = useMemo(() => {
    const activeOpeningIds = new Set(hookMediaOptions.map((option) => option.id));
    const activeDemoIds = new Set(demoMediaOptions.map((option) => option.id));

    return serverSchedules.map((schedule) => {
      const mediaIssue = getScheduleMediaIssue({
        activeDemoIds,
        activeOpeningIds,
        mediaLoaded: scheduleMediaLoaded,
        schedule,
      });

      return mapScheduledPostToScheduleDraft(schedule, mediaIssue);
    });
  }, [demoMediaOptions, hookMediaOptions, scheduleMediaLoaded, serverSchedules]);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [activeTab, setActiveTab] = useState<ScheduleTab>(getInitialScheduleTab);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("calendar");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() =>
    toDateKey(new Date()),
  );
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(() =>
    toMonthKey(new Date()),
  );
  const [newScheduleInitialDate, setNewScheduleInitialDate] = useState(() =>
    toDateKey(new Date()),
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [dayPlannerOpen, setDayPlannerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [requireScheduleTarget, setRequireScheduleTarget] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [schedulePendingCancellation, setSchedulePendingCancellation] =
    useState<ScheduleDraft | null>(null);
  const [cancellingScheduleId, setCancellingScheduleId] = useState<string | null>(
    null,
  );
  const [schedulingFinalDraftId, setSchedulingFinalDraftId] = useState<
    string | null
  >(null);
  const [renderingScheduleId, setRenderingScheduleId] = useState<string | null>(null);
  const [retryingPublishTargetId, setRetryingPublishTargetId] = useState<
    string | null
  >(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [minimumRenderLeadMinutes, setMinimumRenderLeadMinutes] = useState(
    DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  );
  const editingSchedule = useMemo(
    () =>
      editingScheduleId
        ? serverSchedules.find((schedule) => schedule.id === editingScheduleId) ??
          null
        : null,
    [editingScheduleId, serverSchedules],
  );

  const loadScheduleMedia = useCallback(async () => {
    try {
      const token = await getCurrentUserIdToken();
      if (!token) return false;

      const [influencerResponse, videoResponse] = await Promise.all([
        fetch("/api/media?collection=influencer", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/media?collection=video", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [influencerData, videoData] = (await Promise.all([
        influencerResponse.json(),
        videoResponse.json(),
      ])) as [MediaListResponse, MediaListResponse];

      if (
        !influencerResponse.ok ||
        influencerData.ok !== true ||
        !videoResponse.ok ||
        videoData.ok !== true
      ) {
        throw new Error("Could not load scheduling media.");
      }

      const videoAssets = videoData.assets;

      setHookMediaOptions(
        dedupeScheduleMediaOptions([
          ...influencerData.assets.map(mapMediaAssetToScheduleMediaOption),
          ...videoAssets
            .filter(isOpeningVideoMediaAsset)
            .map(mapMediaAssetToScheduleMediaOption),
        ]),
      );
      setDemoMediaOptions(
        videoAssets
          .filter(isScheduledVideoMediaAsset)
          .map(mapMediaAssetToScheduleMediaOption),
      );
      setScheduleMediaLoaded(true);

      try {
        const avatarResponse = await fetch("/api/avatars", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const avatarData = (await avatarResponse.json()) as AvatarListResponse;

        if (avatarResponse.ok && avatarData.ok === true) {
          setCatalogInfluencerOptions(
            avatarData.avatars.map(mapAvatarToCatalogInfluencerOption),
          );
        } else {
          setCatalogInfluencerOptions([]);
        }
      } catch {
        setCatalogInfluencerOptions([]);
      }
      return true;
    } catch {
      setActionNotice("Could not load scheduling media.");
      return false;
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const token = await getCurrentUserIdToken();
      if (!token) return;

      const response = await fetch("/api/schedules", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as ScheduleListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiResponseMessage(data, "Could not load schedules."));
      }

      setServerSchedules(data.schedules);
      const configuredLeadMinutes = data.minimumRenderLeadMinutes;

      if (
        typeof configuredLeadMinutes === "number" &&
        Number.isInteger(configuredLeadMinutes) &&
        configuredLeadMinutes >= 1
      ) {
        setMinimumRenderLeadMinutes(configuredLeadMinutes);
      }
    } catch {
      setActionNotice("Could not load server schedules.");
    } finally {
      setSchedulesLoaded(true);
    }
  }, []);

  const loadSocialConnections = useCallback(async () => {
    try {
      const token = await getCurrentUserIdToken();
      if (!token) return;

      const response = await fetch("/api/social/connections", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as SocialConnectionsResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(data, "Could not load connected accounts."),
        );
      }

      setSocialConnections(
        data.connections.filter((connection) => connection.status !== "revoked"),
      );
    } catch {
      setActionNotice("Could not load connected social accounts.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadScheduleMedia();
      void loadSchedules();
      void loadSocialConnections();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadScheduleMedia, loadSchedules, loadSocialConnections]);

  useEffect(() => {
    function refreshSchedulingData() {
      void loadScheduleMedia();
      void loadSchedules();
      void loadSocialConnections();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshSchedulingData();
      }
    }

    window.addEventListener("focus", refreshSchedulingData);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshSchedulingData);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadScheduleMedia, loadSchedules, loadSocialConnections]);

  const hasActiveServerWork = useMemo(
    () => serverSchedules.some(hasActiveSchedulingWork),
    [serverSchedules],
  );

  useEffect(() => {
    if (!hasActiveServerWork) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSchedules();
    }, 6000);

    return () => window.clearInterval(timer);
  }, [hasActiveServerWork, loadSchedules]);

  const counts = useMemo(() => getTabCounts(drafts), [drafts]);
  const visibleDrafts = useMemo(
    () => filterDraftsByTab(drafts, activeTab),
    [activeTab, drafts],
  );
  const selectedDayDrafts = useMemo(() => {
    return groupDraftsByDate(visibleDrafts).get(selectedCalendarDate) ?? [];
  }, [selectedCalendarDate, visibleDrafts]);

  function handleSelectCalendarDate(dateKey: string) {
    setSelectedCalendarDate(dateKey);
    setVisibleCalendarMonth(toMonthKey(parseDateKey(dateKey)));
  }

  function handleOpenDayPlanner(dateKey: string) {
    handleSelectCalendarDate(dateKey);
    setDayPlannerOpen(true);
  }

  function handleCloseScheduleDrawer() {
    setDrawerOpen(false);
    setDrawerError(null);
    setEditingScheduleId(null);
    setRequireScheduleTarget(false);
  }

  async function handleNewSchedulePost(
    dateKey = selectedCalendarDate,
    options: { keepDayOpen?: boolean } = {},
  ) {
    setActionNotice(null);
    setDrawerError(null);
    setEditingScheduleId(null);
    setRequireScheduleTarget(false);
    handleSelectCalendarDate(dateKey);
    setNewScheduleInitialDate(dateKey);
    setViewMode("calendar");
    if (!options.keepDayOpen) {
      setDayPlannerOpen(false);
    }
    await loadScheduleMedia();
    await loadSocialConnections();
    setDrawerOpen(true);
  }

  async function handleEditSchedule(draft: ScheduleDraft) {
    const schedule = serverSchedules.find((candidate) => candidate.id === draft.id);

    if (!schedule) {
      setActionNotice("This schedule could not be found. Refresh and try again.");
      return;
    }

    const editBlockReason = getScheduleEditBlockReason(schedule);

    if (editBlockReason) {
      setActionNotice(editBlockReason);
      return;
    }

    setActionNotice(null);
    setDrawerError(null);
    setEditingScheduleId(schedule.id);
    setRequireScheduleTarget(false);
    setNewScheduleInitialDate(draft.scheduledDate ?? selectedCalendarDate);
    await Promise.all([loadScheduleMedia(), loadSocialConnections()]);
    setDrawerOpen(true);
  }

  useEffect(() => {
    if (initialDraftQueryState.current !== "idle" || !schedulesLoaded) {
      return;
    }

    const draftId = new URLSearchParams(window.location.search).get("draft");

    if (!draftId) {
      initialDraftQueryState.current = "handled";
      return;
    }

    const requestedDraftId = draftId;
    let cancelled = false;
    initialDraftQueryState.current = "opening";

    async function openDraftFromQuery() {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before opening this schedule draft.");
      }

      const response = await fetch(
        `/api/schedules/${encodeURIComponent(requestedDraftId)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json().catch(() => null)) as
        | ScheduleMutationResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          getApiResponseMessage(data, "This schedule draft could not be found."),
        );
      }

      const schedule = data.schedule;
      const editBlockReason = getScheduleEditBlockReason(schedule);

      if (editBlockReason) {
        throw new Error(editBlockReason);
      }

      const draft = mapScheduledPostToScheduleDraft(schedule);

      if (schedule.sourceKind === "library_item") {
        await loadSocialConnections();
      } else {
        await Promise.all([loadScheduleMedia(), loadSocialConnections()]);
      }

      if (cancelled) {
        return;
      }

      setServerSchedules((currentSchedules) => [
        schedule,
        ...currentSchedules.filter((candidate) => candidate.id !== schedule.id),
      ]);
      setDayPlannerOpen(false);
      setActionNotice(null);
      setDrawerError(null);
      setEditingScheduleId(schedule.id);
      setRequireScheduleTarget(true);
      setNewScheduleInitialDate(draft.scheduledDate ?? toDateKey(new Date()));
      setDrawerOpen(true);
      initialDraftQueryState.current = "handled";
    }

    void openDraftFromQuery().catch((error) => {
      if (cancelled) {
        return;
      }

      initialDraftQueryState.current = "handled";
      setActionNotice(
        getErrorMessage(error, "This schedule draft could not be opened."),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    loadScheduleMedia,
    loadSocialConnections,
    schedulesLoaded,
  ]);

  async function handleSaveScheduleDraft(submission: ScheduleFormSubmission) {
    setSavingSchedule(true);
    setActionNotice(null);
    setDrawerError(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before scheduling posts.");
      }

      const scheduleBeingEdited = editingScheduleId
        ? serverSchedules.find((schedule) => schedule.id === editingScheduleId) ??
          null
        : null;

      if (editingScheduleId && !scheduleBeingEdited) {
        throw new Error("This schedule changed. Close it, refresh, and try again.");
      }

      const selectedConnectionIds = submission.targets.map(
        (target) => target.connectionId,
      );
      const editing = Boolean(scheduleBeingEdited);
      const response = await fetch(
        editing
          ? `/api/schedules/${scheduleBeingEdited?.id}`
          : "/api/schedules",
        {
        body: JSON.stringify({
          ...buildScheduleRequestBody(submission),
          expectedUpdatedAt: scheduleBeingEdited?.updatedAt,
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: editing ? "PATCH" : "POST",
      },
      );
      const data = (await response.json()) as
        | ScheduleCreateResponse
        | ScheduleMutationResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(
            data,
            editing
              ? "Could not update this schedule."
              : "Could not save this schedule.",
          ),
        );
      }

      let nextSchedule = data.schedule;
      const shouldAutoScheduleFinal = selectedConnectionIds.length > 0;
      const isCarouselSchedule = submission.scheduledSource.kind === "library_item";
      const shouldRenderCombination = !isCarouselSchedule && submission.useOpeningClip;
      const mediaLabel = isCarouselSchedule ? "carousel" : "video";
      let nextNotice = shouldAutoScheduleFinal
        ? shouldRenderCombination
          ? editing
            ? "Changes saved. Preparing the updated video before scheduling."
            : "Schedule saved. Preparing the video before automatic scheduling."
          : editing
            ? `Changes saved. Scheduling the selected ${mediaLabel}.`
            : `Schedule saved. Scheduling the selected ${mediaLabel}.`
        : editing
          ? `Changes saved as a ${mediaLabel} draft.`
          : shouldRenderCombination
            ? "Combination draft saved."
            : `${isCarouselSchedule ? "Carousel" : "Video"} draft saved.`;

      try {
        if (shouldRenderCombination) {
          const renderResult = await queueCombinationRender({
            scheduleId: data.schedule.id,
            token,
          });
          nextSchedule = renderResult.schedule;
          if (shouldAutoScheduleFinal && renderResult.status === "ready") {
            const publishResult = await requestFinalSchedule({
              connectionIds: selectedConnectionIds,
              scheduleId: renderResult.schedule.id,
              timezone: submission.timezone,
              token,
            });
            nextSchedule = publishResult.schedule;
            nextNotice = publishResult.created
              ? editing
                ? "Changes saved and the final post was scheduled."
                : "Final combined video scheduled."
              : "The final combined video was already scheduled.";
          } else {
            nextNotice = shouldAutoScheduleFinal
              ? editing
                ? "Changes saved. Preparing the updated video before automatic scheduling."
                : "Schedule saved. Preparing the video before automatic scheduling."
              : renderResult.status === "ready"
                ? "Combined video is already ready."
                : "Combination draft saved and video preparation started.";
          }
        } else if (shouldAutoScheduleFinal) {
          const publishResult = await requestFinalSchedule({
            connectionIds: selectedConnectionIds,
            scheduleId: data.schedule.id,
            timezone: submission.timezone,
            token,
          });
          nextSchedule = publishResult.schedule;
          nextNotice = publishResult.created
            ? editing
              ? `Changes saved and the selected ${mediaLabel} was scheduled.`
              : `Selected ${mediaLabel} scheduled.`
            : `The selected ${mediaLabel} was already scheduled.`;

          if (isCarouselSchedule) {
            const completionWarning = await completeTrendingScheduleAssignment({
              schedule: publishResult.schedule,
              token,
            });

            if (completionWarning) {
              nextNotice = `${nextNotice} ${completionWarning}`;
            }
          }
        }
      } catch (scheduleError) {
        nextNotice = `${editing ? "Changes" : "Draft"} saved, but ${
          shouldRenderCombination ? "video preparation" : "platform scheduling"
        } did not start: ${getErrorMessage(
          scheduleError,
        )}`;
      }

      setServerSchedules((currentSchedules) => {
        const withoutSaved = currentSchedules.filter(
          (schedule) => schedule.id !== nextSchedule.id,
        );

        return [nextSchedule, ...withoutSaved];
      });
      if (submission.scheduledDate) {
        handleSelectCalendarDate(submission.scheduledDate);
      }
      const nextDraft = mapScheduledPostToScheduleDraft(nextSchedule);
      setActiveTab(getPrimaryTabForDraft(nextDraft));
      setViewMode("calendar");
      handleCloseScheduleDrawer();
      setDayPlannerOpen(true);
      setActionNotice(nextNotice);
    } catch (error) {
      setDrawerError(
        error instanceof Error
          ? error.message
          : "Could not save this schedule right now.",
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleStartCombinationRender(scheduleId: string) {
    setRenderingScheduleId(scheduleId);
    setActionNotice(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before preparing this video.");
      }

      const renderResult = await queueCombinationRender({ scheduleId, token });

      setServerSchedules((currentSchedules) => [
        renderResult.schedule,
        ...currentSchedules.filter(
          (schedule) => schedule.id !== renderResult.schedule.id,
        ),
      ]);
      setActionNotice(
        renderResult.status === "ready"
          ? "Combined video is already ready."
          : "Video preparation started.",
      );
    } catch (error) {
      setActionNotice(
        getErrorMessage(error, "Could not start video preparation."),
      );
      await Promise.all([loadScheduleMedia(), loadSchedules()]);
    } finally {
      setRenderingScheduleId(null);
    }
  }

  const handleScheduleFinalPost = useCallback(async (draft: ScheduleDraft) => {
    setSchedulingFinalDraftId(draft.id);
    setActionNotice(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before scheduling this post.");
      }

      const data = await requestFinalSchedule({
        connectionIds: draft.plannedConnectionIds ?? [],
        scheduleId: draft.id,
        timezone: draft.timezone,
        token,
      });

      setServerSchedules((currentSchedules) => [
        data.schedule,
        ...currentSchedules.filter((schedule) => schedule.id !== data.schedule.id),
      ]);
      setActiveTab("upcoming");
      setActionNotice(
        data.created
          ? "Final combined video scheduled."
          : "Final combined video was already scheduled.",
      );
    } catch (error) {
      setActionNotice(
        getErrorMessage(error, "Could not schedule the final post."),
      );
    } finally {
      setSchedulingFinalDraftId(null);
    }
  }, []);

  async function handleRetryPublishing(
    draft: ScheduleDraft,
    target: ScheduledPostTarget,
  ) {
    setRetryingPublishTargetId(target.id);
    setActionNotice(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before retrying publishing.");
      }

      const response = await fetch(
        `/api/schedules/${draft.id}/targets/${target.id}/retry`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          method: "POST",
        },
      );
      const data = (await response.json()) as SchedulePublishRetryResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(data, "Could not retry publishing."),
        );
      }

      setServerSchedules((currentSchedules) => [
        data.schedule,
        ...currentSchedules.filter(
          (schedule) => schedule.id !== data.schedule.id,
        ),
      ]);
      setActiveTab(data.retryStatus === "published" ? "published" : "upcoming");

      const platformLabel = getScheduleDraftPlatformLabel(
        draft,
        target.platform,
      );
      setActionNotice(
        data.retryStatus === "published"
          ? `${platformLabel} was already published. Its status is now updated.`
          : data.retryStatus === "in_progress"
            ? `${platformLabel} publishing is already in progress.`
            : `Publishing started again for ${platformLabel}.`,
      );
    } catch (error) {
      setActionNotice(
        getErrorMessage(error, "Could not retry publishing right now."),
      );
      await loadSchedules();
    } finally {
      setRetryingPublishTargetId(null);
    }
  }

  async function handleConfirmScheduleCancellation() {
    if (!schedulePendingCancellation) {
      return;
    }

    const scheduleId = schedulePendingCancellation.id;
    setCancellingScheduleId(scheduleId);
    setActionNotice(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before cancelling this schedule.");
      }

      const response = await fetch(`/api/schedules/${scheduleId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      const data = (await response.json()) as ScheduleMutationResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(data, "Could not cancel this schedule."),
        );
      }

      setServerSchedules((currentSchedules) => [
        data.schedule,
        ...currentSchedules.filter((schedule) => schedule.id !== data.schedule.id),
      ]);
      setSchedulePendingCancellation(null);
      setActionNotice("Schedule cancelled. No future platform publish will run.");
    } catch (error) {
      setActionNotice(getErrorMessage(error, "Could not cancel this schedule."));
      setSchedulePendingCancellation(null);
    } finally {
      setCancellingScheduleId(null);
    }
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Scheduling
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Plan scheduled videos for upcoming posts.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void handleNewSchedulePost(selectedCalendarDate, {
              keepDayOpen: dayPlannerOpen,
            })
          }
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          New scheduled post
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 pt-5">
        {actionNotice ? (
          <div className="w-fit shrink-0 rounded-full border border-border bg-white/85 px-3 py-2 text-xs font-semibold text-[#405977] shadow-sm">
            {actionNotice}
          </div>
        ) : null}

        {dayPlannerOpen ? (
          <DayScheduleWorkspace
            activeTab={activeTab}
            drafts={selectedDayDrafts}
            isSchedulingFinalDraftId={schedulingFinalDraftId}
            retryingPublishTargetId={retryingPublishTargetId}
            renderingScheduleId={renderingScheduleId}
            selectedDate={selectedCalendarDate}
            onBackToCalendar={() => setDayPlannerOpen(false)}
            onCreateDraftForDate={(dateKey) =>
              void handleNewSchedulePost(dateKey, { keepDayOpen: true })
            }
            onCancelDraft={setSchedulePendingCancellation}
            onEditDraft={(draft) => void handleEditSchedule(draft)}
            onRenderDraft={handleStartCombinationRender}
            onRetryPublishing={handleRetryPublishing}
            onScheduleDraft={handleScheduleFinalPost}
          />
        ) : (
          <>
            <ConnectionNotice />

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ScheduleTabs
                activeTab={activeTab}
                counts={counts}
                onChange={setActiveTab}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>

            <ScheduleContent
              activeTab={activeTab}
              calendarMonth={visibleCalendarMonth}
              drafts={visibleDrafts}
              hasAnyDrafts={drafts.length > 0}
              renderingScheduleId={renderingScheduleId}
              retryingPublishTargetId={retryingPublishTargetId}
              schedulingFinalDraftId={schedulingFinalDraftId}
              selectedDate={selectedCalendarDate}
              viewMode={viewMode}
              onCreateDraft={() => void handleNewSchedulePost()}
              onCancelDraft={setSchedulePendingCancellation}
              onEditDraft={(draft) => void handleEditSchedule(draft)}
              onMonthChange={setVisibleCalendarMonth}
              onOpenDate={handleOpenDayPlanner}
              onRenderDraft={handleStartCombinationRender}
              onRetryPublishing={handleRetryPublishing}
              onScheduleDraft={handleScheduleFinalPost}
              onSelectDate={handleSelectCalendarDate}
            />
          </>
        )}
      </div>

      {drawerOpen ? (
        <NewScheduleDrawer
          catalogInfluencerOptions={catalogInfluencerOptions}
          demoMediaOptions={demoMediaOptions}
          editingSchedule={editingSchedule}
          errorMessage={drawerError}
          hookMediaOptions={hookMediaOptions}
          initialScheduledDate={newScheduleInitialDate}
          initialScheduledTime={getDefaultScheduledTime()}
          minimumRenderLeadMinutes={minimumRenderLeadMinutes}
          onClose={handleCloseScheduleDrawer}
          onRefreshMedia={loadScheduleMedia}
          onSave={handleSaveScheduleDraft}
          requireScheduleTarget={requireScheduleTarget}
          saving={savingSchedule}
          socialConnections={socialConnections}
        />
      ) : null}

      {schedulePendingCancellation ? (
        <CancelScheduleDialog
          draft={schedulePendingCancellation}
          cancelling={cancellingScheduleId === schedulePendingCancellation.id}
          onClose={() => setSchedulePendingCancellation(null)}
          onConfirm={() => void handleConfirmScheduleCancellation()}
        />
      ) : null}
    </section>
  );
}

function ConnectionNotice() {
  return (
    <div className="shrink-0 overflow-hidden rounded-[24px] border border-border/80 bg-white/74 p-4 shadow-[0_18px_50px_rgb(16_32_51_/_0.08)] backdrop-blur sm:p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#173454] text-white shadow-sm">
          <Info className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-normal text-foreground">
              Scheduling is now server-backed.
            </h2>
            <span className="rounded-full bg-card-muted px-2.5 py-1 text-xs font-bold text-[#8a4b39]">
              Video preparation
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#405977]">
            Choose a scheduled video, optionally add an opening clip, then
            schedule it automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function ScheduleTabs({
  activeTab,
  counts,
  onChange,
}: {
  activeTab: ScheduleTab;
  counts: Record<ScheduleTab, number>;
  onChange: (tab: ScheduleTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Schedule filters"
      className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-white/75 p-1 shadow-sm sm:w-fit"
    >
      {scheduleTabs.map((tab) => {
        const active = tab === activeTab;

        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition",
              active
                ? "bg-[#173454] text-white shadow-sm"
                : "text-[#405977] hover:bg-[#fff8f4] hover:text-foreground",
            )}
          >
            {tabLabels[tab]}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                active ? "bg-white/16 text-white" : "bg-card-muted text-muted",
              )}
            >
              {counts[tab]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ViewToggle({
  onChange,
  value,
}: {
  onChange: (mode: ScheduleViewMode) => void;
  value: ScheduleViewMode;
}) {
  return (
    <div className="inline-flex w-fit items-center rounded-2xl border border-border bg-white/75 p-1 shadow-sm">
      <ViewButton
        active={value === "list"}
        icon={<List className="size-4" aria-hidden="true" />}
        label="List"
        onClick={() => onChange("list")}
      />
      <ViewButton
        active={value === "calendar"}
        icon={<CalendarDays className="size-4" aria-hidden="true" />}
        label="Calendar"
        onClick={() => onChange("calendar")}
      />
    </div>
  );
}

function ViewButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition",
        active
          ? "bg-card-muted text-primary"
          : "text-[#405977] hover:bg-[#fff8f4] hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ScheduleContent({
  activeTab,
  calendarMonth,
  drafts,
  hasAnyDrafts,
  onCancelDraft,
  onCreateDraft,
  onEditDraft,
  onMonthChange,
  onOpenDate,
  onRenderDraft,
  onRetryPublishing,
  onScheduleDraft,
  onSelectDate,
  renderingScheduleId,
  retryingPublishTargetId,
  schedulingFinalDraftId,
  selectedDate,
  viewMode,
}: {
  activeTab: ScheduleTab;
  calendarMonth: string;
  drafts: ScheduleDraft[];
  hasAnyDrafts: boolean;
  onCancelDraft: (draft: ScheduleDraft) => void;
  onCreateDraft: () => void;
  onEditDraft: (draft: ScheduleDraft) => void;
  onMonthChange: (monthKey: string) => void;
  onOpenDate: (dateKey: string) => void;
  onRenderDraft: (draftId: string) => void;
  onRetryPublishing: (
    draft: ScheduleDraft,
    target: ScheduledPostTarget,
  ) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
  onSelectDate: (dateKey: string) => void;
  renderingScheduleId: string | null;
  retryingPublishTargetId: string | null;
  schedulingFinalDraftId: string | null;
  selectedDate: string;
  viewMode: ScheduleViewMode;
}) {
  if (viewMode === "calendar") {
    return (
      <CalendarPlanner
        calendarMonth={calendarMonth}
        drafts={drafts}
        selectedDate={selectedDate}
        onMonthChange={onMonthChange}
        onOpenDate={onOpenDate}
        onSelectDate={onSelectDate}
      />
    );
  }

  if (drafts.length === 0) {
    return (
      <ScheduleEmptyState
        activeTab={activeTab}
        hasAnyDrafts={hasAnyDrafts}
        onCreateDraft={onCreateDraft}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-white/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {tabLabels[activeTab]}
          </h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            {getTabDescription(activeTab)}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
          {drafts.length} {getTabItemName(activeTab, drafts.length)}
        </span>
      </div>

      <div className="grid auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-1 xl:grid-cols-2">
        {drafts.map((draft) => (
          <ScheduleDraftPreview
            key={draft.id}
            draft={draft}
            isRendering={renderingScheduleId === draft.id}
            isSchedulingFinal={schedulingFinalDraftId === draft.id}
            onCancelDraft={onCancelDraft}
            onEditDraft={onEditDraft}
            onRenderDraft={onRenderDraft}
            onRetryPublishing={onRetryPublishing}
            onScheduleDraft={onScheduleDraft}
            retryingPublishTargetId={retryingPublishTargetId}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleDraftPreview({
  draft,
  isRendering,
  isSchedulingFinal,
  onCancelDraft,
  onEditDraft,
  onRenderDraft,
  onRetryPublishing,
  onScheduleDraft,
  retryingPublishTargetId,
}: {
  draft: ScheduleDraft;
  isRendering: boolean;
  isSchedulingFinal: boolean;
  onCancelDraft: (draft: ScheduleDraft) => void;
  onEditDraft: (draft: ScheduleDraft) => void;
  onRenderDraft: (draftId: string) => void;
  onRetryPublishing: (
    draft: ScheduleDraft,
    target: ScheduledPostTarget,
  ) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
  retryingPublishTargetId: string | null;
}) {
  const { combinedMedia, demoMedia, hookMedia } = getDraftMediaParts(draft);
  const combinedDraft = isCombinedVideoDraft(draft);
  const primaryMediaLabel = isCarouselDraft(draft)
    ? "Carousel"
    : "Scheduled video";

  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
      {combinedDraft ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
          <ScheduleDraftMediaThumb label="Opening clip" media={hookMedia} />
          <span className="flex items-center text-xs font-bold text-muted">+</span>
          <ScheduleDraftMediaThumb label="Scheduled video" media={demoMedia} />
        </div>
      ) : (
        <ScheduleDraftMediaThumb label={primaryMediaLabel} media={demoMedia} />
      )}

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">
              {draft.mediaTitle || "Combination draft"}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[#405977]">
              {draft.caption ||
                (isCarouselDraft(draft)
                  ? "Caption optional."
                  : "No caption written yet.")}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
              getDraftStatusBadgeClass(draft.status),
            )}
          >
            {getScheduleStatusLabel(draft.status)}
          </span>
        </div>

        <ScheduleTargetStatusList
          draft={draft}
          onRetryPublishing={onRetryPublishing}
          retryingPublishTargetId={retryingPublishTargetId}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <Clock3 className="size-3.5" aria-hidden="true" />
          <span>{getDraftTimeLabel(draft)}</span>
        </div>

        <div className="mt-3 rounded-xl border border-border bg-card-muted px-3 py-2">
          <p className="text-xs font-bold text-foreground">
            {getDraftRenderMessage(draft)}
          </p>
          {combinedMedia?.mediaUrl ? (
            <a
              href={combinedMedia.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex h-8 items-center justify-center rounded-full border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-[#fffaf6]"
            >
              Open combined MP4
            </a>
          ) : null}
        </div>

        <ScheduleDraftActions
          draft={draft}
          isRendering={isRendering}
          isSchedulingFinal={isSchedulingFinal}
          onCancelDraft={onCancelDraft}
          onEditDraft={onEditDraft}
          onRenderDraft={onRenderDraft}
          onScheduleDraft={onScheduleDraft}
        />
      </div>
    </article>
  );
}

function ScheduleDraftActions({
  draft,
  isRendering,
  isSchedulingFinal,
  onCancelDraft,
  onEditDraft,
  onRenderDraft,
  onScheduleDraft,
}: {
  draft: ScheduleDraft;
  isRendering: boolean;
  isSchedulingFinal: boolean;
  onCancelDraft: (draft: ScheduleDraft) => void;
  onEditDraft: (draft: ScheduleDraft) => void;
  onRenderDraft: (draftId: string) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
}) {
  const showRenderAction =
    draft.status === "render_required" || draft.status === "render_failed";
  const showScheduleRetry =
    draft.status === "publishing_unavailable" ||
    canRetrySchedulerCreateFailure(draft);
  const canScheduleFinal = canScheduleFinalDraft(draft);
  const finalScheduleMessage = showScheduleRetry
    ? getFinalScheduleUnavailableMessage(draft)
    : null;
  const showActions = Boolean(
    showRenderAction || showScheduleRetry || draft.canEdit || draft.canCancel,
  );

  if (!showActions) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {showRenderAction ? (
          <button
            type="button"
            onClick={() => onRenderDraft(draft.id)}
            disabled={isRendering}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw
              className={cn("size-3.5", isRendering && "animate-spin")}
              aria-hidden="true"
            />
            {isRendering
              ? "Preparing..."
              : draft.status === "render_failed"
                ? "Try preparation again"
                : "Prepare video"}
          </button>
        ) : null}

        {showScheduleRetry ? (
          <button
            type="button"
            onClick={() => onScheduleDraft(draft)}
            disabled={!canScheduleFinal || isSchedulingFinal}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw
              className={cn("size-3.5", isSchedulingFinal && "animate-spin")}
              aria-hidden="true"
            />
            {isSchedulingFinal ? "Retrying..." : "Retry scheduling"}
          </button>
        ) : null}

        {draft.canEdit ? (
          <button
            type="button"
            onClick={() => onEditDraft(draft)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-[#fff8f4]"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </button>
        ) : null}

        {draft.canCancel ? (
          <button
            type="button"
            onClick={() => onCancelDraft(draft)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-error/30 bg-white px-3 text-xs font-bold text-error transition hover:bg-error/5"
          >
            <Ban className="size-3.5" aria-hidden="true" />
            Cancel
          </button>
        ) : null}
      </div>

      {finalScheduleMessage ? (
        <p className="mt-2 text-[11px] font-semibold leading-4 text-muted">
          {finalScheduleMessage}
        </p>
      ) : null}
    </div>
  );
}

function CancelScheduleDialog({
  cancelling,
  draft,
  onClose,
  onConfirm,
}: {
  cancelling: boolean;
  draft: ScheduleDraft;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useLockBodyScroll();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !cancelling) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cancelling, onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#071a33]/32 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !cancelling) {
          onClose();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-schedule-title"
        aria-describedby="cancel-schedule-description"
        className="w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-[0_24px_80px_rgb(16_32_51_/_0.24)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="cancel-schedule-title"
              className="text-lg font-bold text-foreground"
            >
              Cancel scheduled post?
            </h2>
            <p
              id="cancel-schedule-description"
              className="mt-2 text-sm font-medium leading-6 text-muted"
            >
              {draft.mediaTitle || "This post"} will not publish at{" "}
              {getDraftTimeLabel(draft)}.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close cancellation dialog"
            disabled={cancelling}
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-[#173454] transition hover:bg-[#fff8f4] disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={cancelling}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-bold text-[#173454] transition hover:bg-[#fff8f4] disabled:opacity-50"
          >
            Keep schedule
          </button>
          <button
            type="button"
            disabled={cancelling}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-error px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Ban className="size-4" aria-hidden="true" />
            )}
            {cancelling ? "Cancelling..." : "Cancel schedule"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ScheduleTargetStatusList({
  compact = false,
  draft,
  onRetryPublishing,
  retryingPublishTargetId,
}: {
  compact?: boolean;
  draft: ScheduleDraft;
  onRetryPublishing?: (
    draft: ScheduleDraft,
    target: ScheduledPostTarget,
  ) => void;
  retryingPublishTargetId?: string | null;
}) {
  const targets = draft.targets ?? [];

  if (targets.length === 0) {
    return (
      <div
        className={cn(
          "mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted",
          compact && "mt-2",
        )}
      >
        {draft.platforms.length > 0 ? (
          draft.platforms.map((platform) => (
            <span
              key={platform}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1"
            >
              <SocialPlatformIcon className="size-3.5" platform={platform} />
              {getScheduleDraftPlatformLabel(draft, platform)}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-border bg-white px-2.5 py-1">
            No account selected
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-xl border border-border bg-white",
        compact && "mt-2",
      )}
    >
      <div className="border-b border-border bg-card-muted px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-normal text-muted">
          Platform status
        </p>
      </div>
      <div className="divide-y divide-border">
        {targets.map((target) => {
          const isRetrying = retryingPublishTargetId === target.id;
          const showPublishRetry = canRetryTargetPublishing(target);
          const customerErrorMessage =
            getCustomerFacingTargetErrorMessage(target);

          return (
            <div
              key={target.id}
              className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SocialPlatformIcon
                    className="size-4 shrink-0"
                    platform={target.platform}
                  />
                  <span className="text-xs font-bold text-foreground">
                    {getScheduleDraftPlatformLabel(draft, target.platform)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      getTargetStatusBadgeClass(target.status),
                    )}
                  >
                    {getTargetStatusLabel(target.status)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-muted">
                  {getTargetStatusHelpText(target, draft.timezone)}
                </p>
                {customerErrorMessage ? (
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-error">
                    {customerErrorMessage}
                  </p>
                ) : null}
              </div>

              {target.platformPostUrl ? (
                <a
                  href={target.platformPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 w-fit items-center justify-center rounded-full border border-border bg-white px-2.5 text-[11px] font-bold text-[#173454] transition hover:bg-[#fffaf6]"
                >
                  View post
                </a>
              ) : target.platformPostId ? (
                <span className="rounded-full bg-card-muted px-2.5 py-1 text-[11px] font-bold text-muted">
                  ID saved
                </span>
              ) : target.status === "action_required" &&
                shouldReconnectSocialTarget(target.lastErrorCode) ? (
                <a
                  href="/connected-accounts"
                  className="inline-flex h-7 w-fit items-center justify-center rounded-lg border border-border bg-white px-2.5 text-[11px] font-bold text-[#173454] transition hover:bg-[#fffaf6]"
                >
                  Reconnect
                </a>
              ) : showPublishRetry && onRetryPublishing ? (
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={() => onRetryPublishing(draft, target)}
                  className="inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw
                    className={cn("size-3.5", isRetrying && "animate-spin")}
                    aria-hidden="true"
                  />
                  {isRetrying ? "Retrying..." : "Retry publishing"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleDraftMediaThumb({
  label,
  media,
}: {
  label: string;
  media: ScheduleMediaOption | null;
}) {
  const FallbackIcon = media?.sourceType === "generated_carousel" ? Images : Video;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card-muted">
      <div className="relative aspect-video overflow-hidden bg-[#102033] text-white">
        {media?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FallbackIcon className="size-5 text-white/70" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-bold text-muted">{label}</p>
        <p className="truncate text-xs font-bold text-foreground">
          {media?.title ?? "Missing"}
        </p>
      </div>
    </div>
  );
}

function ScheduledCarouselSourceCard({ schedule }: { schedule: ScheduledPost }) {
  return (
    <section className="rounded-2xl border border-border bg-white/78 p-4 shadow-sm">
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
    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
      <div className="flex aspect-video items-center justify-center rounded-xl bg-[#102033] text-white">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/10">
            <Images className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 max-w-xs truncate text-sm font-bold">
            {schedule.title}
          </p>
          <p className="mt-1 text-xs font-semibold text-white/70">
            Carousel slides publish in saved order
          </p>
        </div>
      </div>
    </div>
  );
}

function ScheduleEmptyState({
  activeTab,
  hasAnyDrafts,
  onCreateDraft,
}: {
  activeTab: ScheduleTab;
  hasAnyDrafts: boolean;
  onCreateDraft: () => void;
}) {
  const isPrimaryEmpty = activeTab === "upcoming" && !hasAnyDrafts;

  return (
    <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-6 py-12 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#173454] text-white shadow-sm">
          <CalendarDays className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-base font-bold text-foreground">
          {isPrimaryEmpty
            ? "No scheduled posts yet."
            : `No ${tabLabels[activeTab].toLowerCase()} posts yet.`}
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-muted">
          {isPrimaryEmpty
            ? "Your scheduled posts will appear here after you choose connected accounts, date, and time."
            : "This filter shows server-backed schedule records for the selected status."}
        </p>
        <button
          type="button"
          onClick={onCreateDraft}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create schedule draft
        </button>
      </div>
    </div>
  );
}

function CalendarPlanner({
  calendarMonth,
  drafts,
  onMonthChange,
  onOpenDate,
  onSelectDate,
  selectedDate,
}: {
  calendarMonth: string;
  drafts: ScheduleDraft[];
  onMonthChange: (monthKey: string) => void;
  onOpenDate: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
  selectedDate: string;
}) {
  const monthDays = useMemo(
    () => getMonthCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const draftsByDate = useMemo(() => groupDraftsByDate(drafts), [drafts]);
  const plannedCount = drafts.filter((draft) => draft.scheduledDate).length;

  function moveMonth(monthOffset: number) {
    const nextMonth = shiftMonth(calendarMonth, monthOffset);

    onMonthChange(nextMonth);
    onSelectDate(`${nextMonth}-01`);
  }

  function jumpToToday() {
    const todayKey = toDateKey(new Date());
    onSelectDate(todayKey);
    onMonthChange(toMonthKey(new Date()));
  }

  return (
    <div className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[24px] border border-border/70 bg-white/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">
              {getMonthLabel(calendarMonth)}
            </h2>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
              {plannedCount} planned
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            Click a date to open that day&apos;s schedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Previous month"
              className="inline-flex size-8 items-center justify-center rounded-lg text-[#405977] transition hover:bg-card-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-bold text-[#405977] transition hover:bg-card-muted hover:text-foreground"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Next month"
              className="inline-flex size-8 items-center justify-center rounded-lg text-[#405977] transition hover:bg-card-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenDate(selectedDate)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.18)] transition hover:bg-primary-hover"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Open selected day
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-white shadow-sm">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-7 border-b border-border bg-card-muted">
            {calendarWeekdayLabels.map((weekday) => (
              <div
                key={weekday}
                className="px-3 py-2 text-xs font-bold uppercase tracking-normal text-muted"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayDrafts = draftsByDate.get(day.dateKey) ?? [];

              return (
                <CalendarDayCell
                  key={day.dateKey}
                  day={day}
                  drafts={dayDrafts}
                  selected={day.dateKey === selectedDate}
                  onOpenDate={onOpenDate}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarDayCell({
  day,
  drafts,
  onOpenDate,
  selected,
}: {
  day: CalendarDay;
  drafts: ScheduleDraft[];
  onOpenDate: (dateKey: string) => void;
  selected: boolean;
}) {
  const visibleDrafts = drafts.slice(0, 3);
  const hiddenDraftCount = Math.max(0, drafts.length - visibleDrafts.length);

  return (
    <button
      type="button"
      onClick={() => onOpenDate(day.dateKey)}
      aria-label={`${getReadableDateLabel(day.dateKey)}${drafts.length ? `, ${drafts.length} scheduled` : ""}`}
      className={cn(
        "min-h-[126px] border-b border-r border-border bg-white p-2 text-left transition hover:bg-[#fffaf6] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-focus",
        !day.isCurrentMonth && "bg-[#fbfaf8] text-muted",
        selected && "relative z-10 bg-selected ring-2 ring-primary/35",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-lg text-sm font-bold",
            day.isToday
              ? "bg-[#173454] text-white"
              : selected
                ? "bg-primary text-white"
                : "text-foreground",
          )}
        >
          {day.dayNumber}
        </span>
        {drafts.length > 0 ? (
          <span className="rounded-full bg-card-muted px-2 py-0.5 text-[11px] font-bold text-muted">
            {drafts.length}
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1.5">
        {visibleDrafts.map((draft) => (
          <CalendarDraftPill key={draft.id} draft={draft} />
        ))}
        {hiddenDraftCount > 0 ? (
          <div className="rounded-lg bg-card-muted px-2 py-1 text-[11px] font-bold text-muted">
            +{hiddenDraftCount} more
          </div>
        ) : null}
      </div>
    </button>
  );
}

function CalendarDraftPill({ draft }: { draft: ScheduleDraft }) {
  return (
    <div className="rounded-lg border border-border bg-white px-2 py-1.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            getDraftStatusDotClass(draft.status),
          )}
        />
        <span className="truncate text-[11px] font-bold text-foreground">
          {draft.scheduledTime || "--:--"} {draft.mediaTitle || "Combination draft"}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-muted">
        {getScheduleStatusLabel(draft.status)}
      </p>
    </div>
  );
}

function DayScheduleWorkspace({
  activeTab,
  drafts,
  isSchedulingFinalDraftId,
  onBackToCalendar,
  onCancelDraft,
  onCreateDraftForDate,
  onEditDraft,
  onRenderDraft,
  onRetryPublishing,
  onScheduleDraft,
  renderingScheduleId,
  retryingPublishTargetId,
  selectedDate,
}: {
  activeTab: ScheduleTab;
  drafts: ScheduleDraft[];
  isSchedulingFinalDraftId: string | null;
  onBackToCalendar: () => void;
  onCancelDraft: (draft: ScheduleDraft) => void;
  onCreateDraftForDate: (dateKey: string) => void;
  onEditDraft: (draft: ScheduleDraft) => void;
  onRenderDraft: (draftId: string) => void;
  onRetryPublishing: (
    draft: ScheduleDraft,
    target: ScheduledPostTarget,
  ) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
  renderingScheduleId: string | null;
  retryingPublishTargetId: string | null;
  selectedDate: string;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onBackToCalendar();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onBackToCalendar]);

  return (
    <section
      aria-labelledby="day-schedule-title"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-[#fbf8f4] shadow-[0_18px_50px_rgb(16_32_51_/_0.08)]"
    >
      <div className="border-b border-border/80 bg-white/76 px-4 py-4 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={onBackToCalendar}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-xs font-bold text-[#173454] shadow-sm transition hover:bg-[#fff8f4]"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to calendar
        </button>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-normal text-muted">
              Selected day
            </p>
            <h2
              id="day-schedule-title"
              className="mt-1 text-2xl font-bold tracking-normal text-foreground sm:text-3xl"
            >
              {getReadableDateLabel(selectedDate)}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              {drafts.length} {drafts.length === 1 ? "item" : "items"} in{" "}
              {tabLabels[activeTab].toLowerCase()} for this day.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCreateDraftForDate(selectedDate)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.18)] transition hover:bg-primary-hover sm:w-fit"
          >
            <Plus className="size-4" aria-hidden="true" />
            Schedule for this day
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
        <div className="grid content-start gap-4">
          <div className="rounded-2xl border border-border bg-white/82 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Day workflow
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted">
                  Choose a scheduled video. You can optionally add an opening
                  clip and prepare both as one final post.
                </p>
              </div>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#173454] text-white">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/82 p-4 shadow-sm">
            <p className="text-sm font-bold text-foreground">What appears here</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted">
              Drafts, videos being prepared, ready combined videos, and
              scheduled posts for this selected calendar date.
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-white/78 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">
                Schedule for this day
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-muted">
                Video preparation and publishing status will update here.
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-card-muted px-3 py-1 text-xs font-bold text-[#405977]">
              {drafts.length} {drafts.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {drafts.length > 0 ? (
              drafts.map((draft) => (
                <SelectedDayDraftCard
                  key={draft.id}
                  draft={draft}
                  isRendering={renderingScheduleId === draft.id}
                  isSchedulingFinal={isSchedulingFinalDraftId === draft.id}
                  onCancelDraft={onCancelDraft}
                  onEditDraft={onEditDraft}
                  onRenderDraft={onRenderDraft}
                  onRetryPublishing={onRetryPublishing}
                  onScheduleDraft={onScheduleDraft}
                  retryingPublishTargetId={retryingPublishTargetId}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-[#fffaf6] px-4 py-10 text-center">
                <CalendarPlus
                  className="mx-auto size-8 text-[#9aa7b8]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-bold text-foreground">
                  Nothing scheduled here.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-muted">
                  Add a scheduled video for this day.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedDayDraftCard({
  draft,
  isRendering,
  isSchedulingFinal,
  onCancelDraft,
  onEditDraft,
  onRenderDraft,
  onRetryPublishing,
  onScheduleDraft,
  retryingPublishTargetId,
}: {
  draft: ScheduleDraft;
  isRendering: boolean;
  isSchedulingFinal: boolean;
  onCancelDraft: (draft: ScheduleDraft) => void;
  onEditDraft: (draft: ScheduleDraft) => void;
  onRenderDraft: (draftId: string) => void;
  onRetryPublishing: (
    draft: ScheduleDraft,
    target: ScheduledPostTarget,
  ) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
  retryingPublishTargetId: string | null;
}) {
  const { combinedMedia, demoMedia, hookMedia } = getDraftMediaParts(draft);
  const combinedDraft = isCombinedVideoDraft(draft);
  const primaryMediaLabel = isCarouselDraft(draft)
    ? "Carousel"
    : "Scheduled video";

  return (
    <article className="rounded-xl border border-border bg-white px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {draft.mediaTitle || "Combination draft"}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {draft.scheduledTime || "--:--"} {draft.timezone}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
            getDraftStatusBadgeClass(draft.status),
          )}
        >
          {getScheduleStatusLabel(draft.status)}
        </span>
      </div>

      {combinedDraft ? (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs font-bold">
          <span className="truncate rounded-lg bg-card-muted px-2 py-1 text-muted">
            Opening clip: {hookMedia?.title ?? "Missing"}
          </span>
          <span className="text-muted">+</span>
          <span className="truncate rounded-lg bg-card-muted px-2 py-1 text-muted">
            Scheduled video: {demoMedia?.title ?? "Missing"}
          </span>
        </div>
      ) : (
        <div className="mt-3 text-xs font-bold">
          <span className="block truncate rounded-lg bg-card-muted px-2 py-1 text-muted">
            {primaryMediaLabel}: {demoMedia?.title ?? "Missing"}
          </span>
        </div>
      )}

      {draft.caption ? (
        <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-[#405977]">
          {draft.caption}
        </p>
      ) : null}

      <ScheduleTargetStatusList
        compact
        draft={draft}
        onRetryPublishing={onRetryPublishing}
        retryingPublishTargetId={retryingPublishTargetId}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {combinedMedia?.mediaUrl ? (
          <a
            href={combinedMedia.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-[#fffaf6]"
          >
            Open MP4
          </a>
        ) : null}
      </div>

      <ScheduleDraftActions
        draft={draft}
        isRendering={isRendering}
        isSchedulingFinal={isSchedulingFinal}
        onCancelDraft={onCancelDraft}
        onEditDraft={onEditDraft}
        onRenderDraft={onRenderDraft}
        onScheduleDraft={onScheduleDraft}
      />
    </article>
  );
}

type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const calendarWeekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function groupDraftsByDate(drafts: ScheduleDraft[]) {
  const grouped = new Map<string, ScheduleDraft[]>();

  for (const draft of drafts) {
    if (!draft.scheduledDate) {
      continue;
    }

    const draftsForDate = grouped.get(draft.scheduledDate) ?? [];
    draftsForDate.push(draft);
    grouped.set(draft.scheduledDate, draftsForDate);
  }

  for (const draftsForDate of grouped.values()) {
    draftsForDate.sort((first, second) =>
      (first.scheduledTime ?? "").localeCompare(second.scheduledTime ?? ""),
    );
  }

  return grouped;
}

function getMonthCalendarDays(monthKey: string): CalendarDay[] {
  const monthStart = parseMonthKey(monthKey);
  const gridStart = new Date(monthStart);

  gridStart.setDate(1 - monthStart.getDay());
  gridStart.setHours(0, 0, 0, 0);

  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);

    return {
      dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: dateKey === todayKey,
    };
  });
}

function shiftMonth(monthKey: string, monthOffset: number) {
  const month = parseMonthKey(monthKey);

  month.setMonth(month.getMonth() + monthOffset);

  return toMonthKey(month);
}

function getMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parseMonthKey(monthKey));
}

function getReadableDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

function parseMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return new Date(year, month - 1, 1);
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getDraftStatusDotClass(status: ScheduleDraftStatus) {
  if (status === "ready" || status === "published") {
    return "bg-success";
  }

  if (status === "rendering" || status === "scheduling" || status === "publishing") {
    return "bg-info";
  }

  if (status === "scheduled" || status === "scheduled_preview") {
    return "bg-[#173454]";
  }

  if (
    status === "failed" ||
    status === "partially_failed" ||
    status === "cancelled" ||
    status === "render_failed" ||
    status === "publishing_unavailable"
  ) {
    return "bg-error";
  }

  return "bg-primary";
}

function getDraftStatusBadgeClass(status: ScheduleDraftStatus) {
  if (status === "ready" || status === "published") {
    return "bg-success/10 text-success";
  }

  if (status === "rendering" || status === "scheduling" || status === "publishing") {
    return "bg-info/10 text-info";
  }

  if (status === "scheduled" || status === "scheduled_preview") {
    return "bg-[#edf3f8] text-[#173454]";
  }

  if (
    status === "failed" ||
    status === "partially_failed" ||
    status === "cancelled" ||
    status === "render_failed" ||
    status === "publishing_unavailable"
  ) {
    return "bg-error/10 text-error";
  }

  return "bg-brand-soft text-primary";
}

function getTargetStatusLabel(status: ScheduledPostTarget["status"]) {
  const labels: Record<ScheduledPostTarget["status"], string> = {
    action_required: "Action required",
    cancelled: "Cancelled",
    draft: "Draft",
    failed: "Failed",
    published: "Published",
    publishing: "Publishing",
    scheduled: "Scheduled",
    scheduling: "Scheduling",
    skipped: "Skipped",
  };

  return labels[status];
}

function getTargetStatusBadgeClass(status: ScheduledPostTarget["status"]) {
  if (status === "published") {
    return "bg-success/10 text-success";
  }

  if (status === "publishing" || status === "scheduling") {
    return "bg-info/10 text-info";
  }

  if (status === "scheduled") {
    return "bg-[#edf3f8] text-[#173454]";
  }

  if (
    status === "action_required" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "skipped"
  ) {
    return "bg-error/10 text-error";
  }

  return "bg-card-muted text-muted";
}

function getTargetStatusHelpText(
  target: ScheduledPostTarget,
  timezone: string,
) {
  if (target.status === "published") {
    return target.publishedAt
      ? `Published ${formatShortDateTime(target.publishedAt, timezone)}.`
      : "Published successfully.";
  }

  if (target.status === "publishing") {
    if (target.nextRetryAt) {
      return `Temporary platform issue. Retrying ${formatShortDateTime(
        target.nextRetryAt,
        timezone,
      )}.`;
    }

    return "The worker is posting this video now.";
  }

  if (target.status === "scheduled") {
    return `Will publish ${formatShortDateTime(
      target.scheduledFor,
      timezone,
    )}.`;
  }

  if (target.status === "scheduling") {
    return "Creating the AWS schedule for this account.";
  }

  if (target.status === "failed") {
    return "Publishing did not complete for this account.";
  }

  if (target.status === "action_required") {
    return getActionRequiredTargetMessage(target.lastErrorCode);
  }

  if (target.status === "cancelled") {
    return "This platform target was cancelled.";
  }

  if (target.status === "skipped") {
    return "This platform target was skipped.";
  }

  return "Waiting for final scheduling.";
}

function canRetryTargetPublishing(target: ScheduledPostTarget) {
  return Boolean(
    target.status === "failed" &&
      target.publishJobId &&
      target.lastErrorCode !== "scheduler_create_failed",
  );
}

function getActionRequiredTargetMessage(errorCode: string | null) {
  if (shouldReconnectInstagramTarget(errorCode)) {
    return "Reconnect Instagram to continue publishing.";
  }

  if (shouldReconnectTikTokTarget(errorCode)) {
    return "Reconnect TikTok to grant publishing permission.";
  }

  if (shouldReconnectYouTubeTarget(errorCode)) {
    return "Reconnect YouTube to continue publishing.";
  }

  if (errorCode === "tiktok_privacy_level_option_mismatch") {
    return "TikTok visibility changed. Cancel this schedule, then choose an available option in a new post.";
  }

  if (errorCode === "tiktok_url_ownership_unverified") {
    return "TikTok could not access the video. Contact support before retrying.";
  }

  if (errorCode === "tiktok_unaudited_client_can_only_post_to_private_accounts") {
    return "This TikTok app can currently publish only with Only me visibility.";
  }

  if (errorCode === "tiktok_reached_active_user_cap") {
    return "TikTok has not approved this app for additional publishing accounts yet.";
  }

  if (errorCode === "tiktok_spam_risk_too_many_posts") {
    return "TikTok's daily posting limit was reached. Try again later.";
  }

  if (errorCode === "tiktok_video_duration_exceeds_creator_limit") {
    return "This video is longer than the selected TikTok account allows.";
  }

  if (
    errorCode === "social_connection_revoked" ||
    errorCode === "social_connection_unavailable" ||
    errorCode === "provider_permission_missing"
  ) {
    return "Reconnect this account before publishing this post.";
  }

  return "This platform needs your attention before publishing can continue.";
}

function shouldReconnectSocialTarget(errorCode: string | null) {
  return (
    errorCode === "social_connection_revoked" ||
    errorCode === "social_connection_unavailable" ||
    errorCode === "provider_permission_missing" ||
    shouldReconnectInstagramTarget(errorCode) ||
    shouldReconnectTikTokTarget(errorCode) ||
    shouldReconnectYouTubeTarget(errorCode)
  );
}

function shouldReconnectInstagramTarget(errorCode: string | null) {
  return [
    "instagram_access_token_invalid",
    "instagram_permission_missing",
  ].includes(errorCode ?? "");
}

function shouldReconnectTikTokTarget(errorCode: string | null) {
  return [
    "tiktok_access_token_invalid",
    "tiktok_account_mismatch",
    "tiktok_invalid_grant",
    "tiktok_invalid_refresh_token",
    "tiktok_refresh_token_expired",
    "tiktok_scope_not_authorized",
  ].includes(errorCode ?? "");
}

function shouldReconnectYouTubeTarget(errorCode: string | null) {
  return [
    "youtube_access_token_invalid",
    "youtube_channel_unavailable",
    "youtube_invalid_grant",
    "youtube_permission_missing",
    "youtube_refresh_token_missing",
  ].includes(errorCode ?? "");
}

function getCustomerFacingTargetErrorMessage(target: ScheduledPostTarget) {
  if (
    !target.lastErrorMessage ||
    target.status === "action_required" ||
    (target.status === "publishing" && target.nextRetryAt)
  ) {
    return null;
  }

  const errorCode = target.lastErrorCode ?? "";

  if (
    errorCode === "instagram_invalid_media" ||
    errorCode === "instagram_media_processing_failed"
  ) {
    return "Instagram could not accept this video. Check that it meets Reel requirements, then try again.";
  }

  if (errorCode.startsWith("instagram_")) {
    return "Instagram could not publish this video. Try again.";
  }

  if (errorCode === "youtube_quota_exceeded") {
    return "YouTube's publishing quota is currently exhausted. Try again later.";
  }

  if (errorCode === "youtube_upload_limit_exceeded") {
    return "This YouTube channel has reached its upload limit. Try again later.";
  }

  if (errorCode === "youtube_invalid_video") {
    return "YouTube could not accept this video or its details. Review the post and try again.";
  }

  if (errorCode.startsWith("youtube_")) {
    return "YouTube could not publish this video. Try again.";
  }

  if (errorCode === "scheduler_create_failed") {
    return "We could not reserve this publish time. Try scheduling again.";
  }

  if (errorCode.startsWith("tiktok_")) {
    return "TikTok could not publish this video. Try again.";
  }

  return "The platform could not publish this post. Try again.";
}

function formatShortDateTime(value: string, timezone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return value;
  }
}

function getSafeZonedDateTimeParts(value: string, timezone: string) {
  try {
    return getZonedDateTimeParts(value, timezone);
  } catch {
    return null;
  }
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function getDefaultScheduledTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 60);
  const roundedMinutes = Math.ceil(date.getMinutes() / 15) * 15;

  if (roundedMinutes >= 60) {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0);
  } else {
    date.setMinutes(roundedMinutes, 0, 0);
  }

  return getTimeKey(date);
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

function NewScheduleDrawer({
  catalogInfluencerOptions,
  demoMediaOptions,
  editingSchedule,
  errorMessage,
  hookMediaOptions,
  initialScheduledDate,
  initialScheduledTime,
  minimumRenderLeadMinutes,
  onClose,
  onRefreshMedia,
  onSave,
  requireScheduleTarget,
  saving,
  socialConnections,
}: {
  catalogInfluencerOptions: ScheduleCatalogInfluencerOption[];
  demoMediaOptions: ScheduleMediaOption[];
  editingSchedule: ScheduledPost | null;
  errorMessage: string | null;
  hookMediaOptions: ScheduleMediaOption[];
  initialScheduledDate: string;
  initialScheduledTime: string;
  minimumRenderLeadMinutes: number;
  onClose: () => void;
  onRefreshMedia: () => Promise<boolean>;
  onSave: (submission: ScheduleFormSubmission) => void;
  requireScheduleTarget: boolean;
  saving: boolean;
  socialConnections: SocialConnection[];
}) {
  useLockBodyScroll();

  const editingDraft = editingSchedule
    ? mapScheduledPostToScheduleDraft(editingSchedule)
    : null;
  const isCarouselSchedule = Boolean(
    editingSchedule?.sourceKind === "library_item" &&
      editingSchedule.libraryItemId,
  );
  const carouselLibraryItemId = isCarouselSchedule
    ? editingSchedule?.libraryItemId ?? null
    : null;
  const initialPlannedTargets = getSavedPlannedTargets(editingSchedule);
  const initialConnectionIds = getInitialScheduleConnectionIds({
    connections: socialConnections,
    isCarouselSchedule,
    plannedPlatforms: editingSchedule
      ? getDraftPlatformsFromSchedule(editingSchedule)
      : [],
    plannedTargets: initialPlannedTargets,
  });
  const [preparedHookMediaOptions, setPreparedHookMediaOptions] =
    useState<ScheduleMediaOption[]>([]);
  const [useOpeningClip, setUseOpeningClip] = useState(() =>
    isCombinedVideoMetadata(editingSchedule?.metadata ?? {}),
  );
  const [selectedHookMediaId, setSelectedHookMediaId] = useState<string>(
    getString(editingSchedule?.metadata.hookMediaId) ?? "",
  );
  const [selectedDemoMediaId, setSelectedDemoMediaId] = useState<string>(
    getString(editingSchedule?.metadata.scheduledVideoId) ??
      getString(editingSchedule?.metadata.demoMediaId) ??
      editingSchedule?.mediaAssetId ??
      "",
  );
  const [preparingCatalogInfluencerId, setPreparingCatalogInfluencerId] =
    useState<string | null>(null);
  const [refreshingMedia, setRefreshingMedia] = useState(false);
  const [hookPickerError, setHookPickerError] = useState<string | null>(null);
  const [caption, setCaption] = useState(editingSchedule?.caption ?? "");
  const [selectedConnectionIds, setSelectedConnectionIds] =
    useState<string[]>(initialConnectionIds);
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
    editingDraft?.scheduledDate ?? initialScheduledDate,
  );
  const [scheduledTime, setScheduledTime] = useState(
    editingDraft?.scheduledTime ?? initialScheduledTime,
  );
  const [timezone, setTimezone] = useState(
    editingSchedule?.timezone ?? defaultTimezone,
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const localHookMediaOptions = useMemo(
    () => dedupeScheduleMediaOptions([...preparedHookMediaOptions, ...hookMediaOptions]),
    [hookMediaOptions, preparedHookMediaOptions],
  );

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
    isCarouselSchedule
      ? null
      : demoMediaOptions.find((option) => option.id === activeDemoMediaId) ?? null;
  const availableSocialConnections = useMemo(
    () =>
      isCarouselSchedule
        ? socialConnections.filter((connection) =>
            supportsCarouselPublishing(connection.platform),
          )
        : socialConnections,
    [isCarouselSchedule, socialConnections],
  );
  const selectedConnections = useMemo(
    () =>
      availableSocialConnections.filter((connection) =>
        selectedConnectionIds.includes(connection.id),
      ),
    [availableSocialConnections, selectedConnectionIds],
  );
  const publishingSettingsError = getPublishingSettingsError({
    connections: selectedConnections,
    settings: publishingSettings,
    tiktokCapabilities,
  });
  const scheduleTimeValidation = useMemo(
    () =>
      getScheduleTimeValidation({
        date: scheduledDate,
        minimumLeadMinutes: minimumRenderLeadMinutes,
        now: currentTime,
        time: scheduledTime,
        timezone,
      }),
    [
      currentTime,
      minimumRenderLeadMinutes,
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
        useOpeningClip,
      });
  const mediaValidationError = getScheduleMediaValidationError({
    scheduledVideo: isCarouselSchedule
      ? getCarouselScheduleMediaOption(editingSchedule)
      : selectedDemoMedia,
    openingMedia: selectedHookMedia,
    useOpeningClip: isCarouselSchedule ? false : useOpeningClip,
  });
  const hasSelectedConnections = selectedConnections.length > 0;
  const canSaveDraft = Boolean(
    !mediaValidationError &&
      (isCarouselSchedule ? carouselLibraryItemId : selectedDemoMedia) &&
      scheduledDate &&
      scheduledTime &&
      !scheduleTimeValidation.error &&
      !publishingSettingsError &&
      (!requireScheduleTarget || hasSelectedConnections) &&
      !saving,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function toggleConnection(connectionId: string) {
    const connection = availableSocialConnections.find(
      (candidate) => candidate.id === connectionId,
    );
    const selecting = !selectedConnectionIds.includes(connectionId);

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

    if (!enabled) {
      setSelectedHookMediaId("");
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

  async function handleSelectCatalogInfluencer(
    option: ScheduleCatalogInfluencerOption,
  ) {
    if (preparingCatalogInfluencerId) {
      return;
    }

    setHookPickerError(null);
    setPreparingCatalogInfluencerId(option.avatarId);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before choosing an influencer.");
      }

      const response = await fetch("/api/media/from-avatar", {
        body: JSON.stringify({ avatarId: option.avatarId }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as PreparedCatalogInfluencerResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(data, "Could not prepare this influencer."),
        );
      }

      const mediaOption = mapMediaAssetToScheduleMediaOption(data.asset);

      setPreparedHookMediaOptions((currentOptions) =>
        dedupeScheduleMediaOptions([mediaOption, ...currentOptions]),
      );
      setSelectedHookMediaId(mediaOption.id);
    } catch (error) {
      setHookPickerError(
        getErrorMessage(error, "Could not prepare this influencer."),
      );
    } finally {
      setPreparingCatalogInfluencerId(null);
    }
  }

  function handleSaveDraft() {
    if (
      mediaValidationError ||
      (isCarouselSchedule ? !carouselLibraryItemId : !selectedDemoMedia) ||
      !scheduleTimeValidation.scheduledFor ||
      scheduleTimeValidation.error
    ) {
      return;
    }

    onSave({
      caption,
      openingMedia: selectedHookMedia,
      scheduledDate,
      scheduledFor: scheduleTimeValidation.scheduledFor,
      scheduledSource: isCarouselSchedule
        ? { id: carouselLibraryItemId!, kind: "library_item" }
        : { id: selectedDemoMedia!.id, kind: "media_asset" },
      scheduledSourceTitle:
        isCarouselSchedule && editingSchedule
          ? editingSchedule.title
          : selectedDemoMedia!.title,
      scheduledVideo: selectedDemoMedia,
      scheduledTime,
      targets: selectedConnections.map((connection) => ({
        connectionId: connection.id,
        platform: connection.platform,
        settings:
          publishingSettings[connection.id] ??
          getDefaultPublishingSettings(connection.platform),
      })),
      timezone,
      useOpeningClip: isCarouselSchedule ? false : useOpeningClip,
    });
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex bg-[#071a33]/28 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-drawer-title"
        className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none border border-border bg-[#fbf8f4] shadow-[0_26px_90px_rgb(16_32_51_/_0.22)] sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/80 bg-white/72 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <h2
              id="schedule-drawer-title"
              className="text-lg font-bold tracking-normal text-foreground"
            >
              {isCarouselSchedule
                ? "Schedule carousel"
                : editingSchedule
                  ? "Edit scheduled post"
                  : "New scheduled post"}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              {isCarouselSchedule
                ? "Confirm the carousel, choose an account, and select when it should be published."
                : "Choose a video, configure your social accounts, and select when it should be published."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule drawer"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-[#173454] shadow-sm transition hover:bg-[#fff8f4]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="mx-auto max-w-5xl divide-y divide-border">
            <ScheduleFlowSection
              step="1"
              title="Media"
              description={
                isCarouselSchedule
                  ? "Saved carousel and optional caption"
                  : "Scheduled video, caption, and optional opening clip"
              }
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
                <div className="grid content-start gap-4">
                  {isCarouselSchedule && editingSchedule ? (
                    <ScheduledCarouselSourceCard schedule={editingSchedule} />
                  ) : (
                    <ScheduleRoleMediaPicker
                      description="Choose the video that will be published."
                      emptyDescription="Select a video from your library or edited exports."
                      emptyTitle="No scheduled videos found."
                      icon={<FileVideo className="size-4" aria-hidden="true" />}
                      mediaOptions={demoMediaOptions}
                      selectedMediaId={activeDemoMediaId}
                      title="Scheduled video"
                      onSelectMedia={setSelectedDemoMediaId}
                    />
                  )}
                  <label className="block">
                    <span className="text-sm font-bold text-foreground">
                      Caption
                      {isCarouselSchedule ? (
                        <span className="ml-1 font-semibold text-muted">
                          (optional)
                        </span>
                      ) : null}
                    </span>
                    <textarea
                      rows={5}
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder={
                        isCarouselSchedule
                          ? "Add a caption if you want one..."
                          : "Write caption..."
                      }
                      className="mt-2 min-h-32 w-full resize-none rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-[#8c9aab] focus:border-primary"
                    />
                  </label>
                  {!isCarouselSchedule ? (
                    <ScheduleOpeningClipControl
                      enabled={useOpeningClip}
                      onToggle={handleToggleOpeningClip}
                    >
                      <ScheduleOpeningMediaPicker
                        catalogInfluencerOptions={catalogInfluencerOptions}
                        errorMessage={hookPickerError}
                        mediaOptions={localHookMediaOptions}
                        preparingCatalogInfluencerId={preparingCatalogInfluencerId}
                        refreshingMedia={refreshingMedia}
                        selectedMediaId={activeHookMediaId}
                        onRefreshMedia={handleRefreshMedia}
                        onSelectCatalogInfluencer={handleSelectCatalogInfluencer}
                        onSelectMedia={handleSelectHookMedia}
                      />
                    </ScheduleOpeningClipControl>
                  ) : null}
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
                      useOpeningClip={useOpeningClip}
                    />
                  )}
                </div>
              </div>
            </ScheduleFlowSection>

            <ScheduleFlowSection
              step="2"
              title="Accounts & settings"
              description="Destinations, visibility, and platform controls"
            >
              <ConnectedAccountSelector
                connections={availableSocialConnections}
                onToggle={toggleConnection}
                selectedConnectionIds={selectedConnectionIds}
              />

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
                        className="mt-2 h-11 w-full rounded-lg border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-foreground">
                        Time
                      </span>
                      <input
                        type="time"
                        aria-describedby={
                          scheduleTimeValidation.error
                            ? "schedule-time-feedback"
                            : undefined
                        }
                        aria-invalid={Boolean(scheduleTimeValidation.error)}
                        value={scheduledTime}
                        onChange={(event) => setScheduledTime(event.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                      />
                    </label>
                  </div>

                <label className="block">
                    <span className="text-sm font-bold text-foreground">
                      Timezone
                    </span>
                    <select
                    aria-describedby={
                      scheduleTimeValidation.error
                        ? "schedule-time-feedback"
                        : undefined
                    }
                    aria-invalid={Boolean(scheduleTimeValidation.error)}
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
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
                  useOpeningClip={isCarouselSchedule ? false : useOpeningClip}
                />
              </div>
            </ScheduleFlowSection>
          </div>
        </div>

        <div className="border-t border-border/80 bg-white/72 px-5 py-4 backdrop-blur sm:px-6">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
            >
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!canSaveDraft}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {saving
              ? hasSelectedConnections
                ? "Scheduling..."
                : editingSchedule
                  ? "Saving changes..."
                  : "Saving..."
              : canSaveDraft
                ? hasSelectedConnections
                  ? "Schedule post"
                  : editingSchedule
                    ? "Save changes"
                    : isCarouselSchedule
                      ? "Save carousel draft"
                      : "Save video draft"
                : publishingSettingsError
                  ? "Review publishing settings"
                : requireScheduleTarget && !hasSelectedConnections
                  ? "Choose an account"
                : isCarouselSchedule || selectedDemoMedia
                  ? "Choose date and time"
                  : mediaValidationError ?? "Select media to schedule"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold leading-5 text-muted">
            {hasSelectedConnections
              ? useOpeningClip
                ? "We prepare one combined video first, then schedule it automatically when ready."
                : isCarouselSchedule
                  ? "The saved carousel will be scheduled to the selected account."
                  : "This selected video will be scheduled directly without extra preparation."
              : requireScheduleTarget
                ? "Choose a connected account before scheduling this post."
                : editingSchedule
                  ? "Saved changes replace this draft. Active platform jobs cannot be edited."
                  : isCarouselSchedule
                    ? "Choose an account to schedule automatically, or keep this as a carousel draft."
                    : "Choose an account to schedule automatically, or save a video draft without publishing."}
          </p>
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
    <section className="grid gap-4 py-6 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
      <div className="flex items-start gap-3 md:block">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#173454] text-xs font-bold text-white">
          {step}
        </span>
        <div className="min-w-0 md:mt-3">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
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
    <section className="rounded-2xl border border-border bg-white/78 p-3 shadow-sm">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">
              Add an opening clip
            </span>
            <span className="mt-0.5 block text-xs font-semibold leading-5 text-muted">
              Place a short opening clip before the scheduled video.
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
      </label>

      {enabled ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function ScheduleOpeningMediaPicker({
  catalogInfluencerOptions,
  errorMessage,
  mediaOptions,
  onRefreshMedia,
  onSelectCatalogInfluencer,
  onSelectMedia,
  preparingCatalogInfluencerId,
  refreshingMedia,
  selectedMediaId,
}: {
  catalogInfluencerOptions: ScheduleCatalogInfluencerOption[];
  errorMessage: string | null;
  mediaOptions: ScheduleMediaOption[];
  onRefreshMedia: () => void;
  onSelectCatalogInfluencer: (option: ScheduleCatalogInfluencerOption) => void;
  onSelectMedia: (mediaId: string) => void;
  preparingCatalogInfluencerId: string | null;
  refreshingMedia: boolean;
  selectedMediaId: string;
}) {
  const [activeSource, setActiveSource] =
    useState<OpeningVideoSourceTab>("all");
  const catalogInfluencerIds = useMemo(
    () => new Set(catalogInfluencerOptions.map((option) => option.avatarId)),
    [catalogInfluencerOptions],
  );
  const selectedMedia = mediaOptions.find((option) => option.id === selectedMediaId);
  const influencerMediaOptions = mediaOptions.filter(
    (option) =>
      option.sourceType === "influencer_video" &&
      !catalogInfluencerIds.has(option.sourceRecordId ?? ""),
  );
  const videoMediaOptions = mediaOptions.filter(
    (option) =>
      option.sourceType === "generated_video" ||
      option.sourceType === "user_video",
  );
  const editedMediaOptions = mediaOptions.filter(
    (option) => option.sourceType === "edit_video",
  );
  const sourceCounts: Record<OpeningVideoSourceTab, number> = {
    all:
      catalogInfluencerOptions.length +
      influencerMediaOptions.length +
      videoMediaOptions.length +
      editedMediaOptions.length,
    edited: editedMediaOptions.length,
    influencers: catalogInfluencerOptions.length + influencerMediaOptions.length,
    videos: videoMediaOptions.length,
  };
  const hasAnyOptions = sourceCounts.all > 0;

  function renderCatalogInfluencers() {
    return catalogInfluencerOptions.map((option) => (
      <ScheduleCatalogInfluencerButton
        key={option.id}
        option={option}
        preparing={preparingCatalogInfluencerId === option.avatarId}
        selected={selectedMedia?.sourceRecordId === option.avatarId}
        disabled={Boolean(preparingCatalogInfluencerId)}
        onSelect={() => onSelectCatalogInfluencer(option)}
      />
    ));
  }

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
    if (activeSource === "influencers") {
      return sourceCounts.influencers > 0 ? (
        <>
          <OpeningVideoSourceSection
            count={catalogInfluencerOptions.length}
            title="Influencer catalog"
          >
            {renderCatalogInfluencers()}
          </OpeningVideoSourceSection>
          <OpeningVideoSourceSection
            count={influencerMediaOptions.length}
            title="My influencer videos"
          >
            {renderMediaOptions(influencerMediaOptions)}
          </OpeningVideoSourceSection>
        </>
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

    if (activeSource === "edited") {
      return sourceCounts.edited > 0 ? (
        <OpeningVideoSourceSection
          count={editedMediaOptions.length}
          title="Edited videos"
        >
          {renderMediaOptions(editedMediaOptions)}
        </OpeningVideoSourceSection>
      ) : (
        <OpeningVideoEmptyState source={activeSource} />
      );
    }

    return hasAnyOptions ? (
      <>
        <OpeningVideoSourceSection
          count={catalogInfluencerOptions.length}
          title="Influencer catalog"
        >
          {renderCatalogInfluencers()}
        </OpeningVideoSourceSection>
        <OpeningVideoSourceSection
          count={influencerMediaOptions.length}
          title="My influencer videos"
        >
          {renderMediaOptions(influencerMediaOptions)}
        </OpeningVideoSourceSection>
        <OpeningVideoSourceSection count={videoMediaOptions.length} title="Videos">
          {renderMediaOptions(videoMediaOptions)}
        </OpeningVideoSourceSection>
        <OpeningVideoSourceSection
          count={editedMediaOptions.length}
          title="Edited videos"
        >
          {renderMediaOptions(editedMediaOptions)}
        </OpeningVideoSourceSection>
      </>
    ) : (
      <OpeningVideoEmptyState source={activeSource} />
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white/78 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              Optional opening clip
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-muted">
              Add a short opening clip before the scheduled video.
            </p>
          </div>
        </div>
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
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-white text-[#405977] shadow-sm transition hover:bg-[#fff8f4] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-4", refreshingMedia ? "animate-spin" : null)}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div
        aria-label="Choose opening clip source"
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
                  : "border-border bg-white text-[#405977] hover:bg-[#fff8f4]",
              )}
            >
              {source.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  selected ? "bg-white/80" : "bg-card-muted",
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

function ScheduleCatalogInfluencerButton({
  disabled,
  onSelect,
  option,
  preparing,
  selected,
}: {
  disabled: boolean;
  onSelect: () => void;
  option: ScheduleCatalogInfluencerOption;
  preparing: boolean;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-white p-2 text-left transition hover:bg-[#fffaf6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70",
        selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="flex aspect-[9/12] items-center justify-center overflow-hidden rounded-lg bg-[#102033] text-white">
        {option.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <UserRound className="size-5 text-white/70" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">
          {option.title}
        </p>
        <p className="mt-1 text-xs font-semibold text-muted">
          Influencer catalog - {option.durationLabel}
        </p>
      </div>
      {preparing ? (
        <Loader2
          className="size-4 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : selected ? (
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
      ) : null}
    </button>
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
        "grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-white p-2 text-left transition hover:bg-[#fffaf6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="flex aspect-[9/12] items-center justify-center overflow-hidden rounded-lg bg-[#102033] text-white">
        {option.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <FileVideo className="size-5 text-white/70" aria-hidden="true" />
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
    <div className="rounded-xl border border-dashed border-border bg-[#fffaf6] px-4 py-5 text-center">
      <Video className="mx-auto size-7 text-[#9aa7b8]" aria-hidden="true" />
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
  icon,
  mediaOptions,
  onSelectMedia,
  selectedMediaId,
  title,
}: {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  icon: ReactNode;
  mediaOptions: ScheduleMediaOption[];
  onSelectMedia: (mediaId: string) => void;
  selectedMediaId: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/78 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-muted">
              {description}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted">
          {mediaOptions.length} available
        </span>
      </div>

      {mediaOptions.length > 0 ? (
        <div className="mt-3 grid max-h-[260px] gap-2 overflow-y-auto pr-1">
          {mediaOptions.map((option) => (
            <ScheduleMediaOptionButton
              key={option.id}
              option={option}
              selected={option.id === selectedMediaId}
              onSelect={() => onSelectMedia(option.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-[#fffaf6] px-4 py-5 text-center">
          <Video className="mx-auto size-7 text-[#9aa7b8]" aria-hidden="true" />
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

function CompositionPreview({
  openingMedia,
  scheduledMedia,
  useOpeningClip,
}: {
  openingMedia: ScheduleMediaOption | null;
  scheduledMedia: ScheduleMediaOption | null;
  useOpeningClip: boolean;
}) {
  const hasOpeningClip = useOpeningClip && openingMedia;

  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Post preview</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            {hasOpeningClip
              ? "The opening clip will play first, followed by the scheduled video."
              : "This video will be published as the scheduled post."}
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#173454] text-white">
          <Layers2 className="size-4" aria-hidden="true" />
        </span>
      </div>

      {hasOpeningClip ? (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <CompositionSlot label="Opening clip" media={openingMedia} />
          <span className="text-xs font-bold text-muted">+</span>
          <CompositionSlot label="Scheduled video" media={scheduledMedia} />
        </div>
      ) : (
        <div className="mt-4">
          <CompositionSlot label="Scheduled video" media={scheduledMedia} />
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
    <div>
      <span className="text-sm font-bold text-foreground">
        Planned accounts
      </span>
      {connections.length > 0 ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
                  className="rounded-lg border border-error/20 bg-[#fffaf6] px-3 py-3 shadow-sm"
                >
                  {tileContent}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href="/connected-accounts"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-card-muted"
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Reconnect account
                    </a>
                    {selected ? (
                      <button
                        type="button"
                        onClick={() => onToggle(connection.id)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-error/25 bg-white px-3 text-xs font-bold text-error transition hover:bg-error/5"
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
                onClick={() => onToggle(connection.id)}
                className={cn(
                  "rounded-lg border bg-white px-3 py-3 text-left shadow-sm transition hover:bg-[#fffaf6]",
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
        <div className="mt-2 rounded-lg border border-dashed border-border bg-[#fffaf6] px-4 py-4 text-sm font-semibold leading-6 text-muted">
          <p>
            Connect Instagram, TikTok, or YouTube to schedule this post. You can
            still save the video draft now.
          </p>
          <a
            href="/connected-accounts"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-card-muted"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Connect an account
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
    <section aria-labelledby="publishing-settings-title" className="border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-primary" aria-hidden="true" />
        <h3
          id="publishing-settings-title"
          className="text-sm font-bold text-foreground"
        >
          Publishing settings
        </h3>
      </div>

      <div className="mt-2 divide-y divide-border">
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
    <div className="py-4 first:pt-2 last:pb-0">
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

      {connection.platform === "instagram" ? (
        <div className="mt-3">
          <SettingCheckbox
            checked={getBooleanSetting(settings, "shareToFeed", true)}
            description="Also show the Reel in the account's main feed."
            label="Share to feed"
            onChange={(checked) => onChange("shareToFeed", checked)}
          />
        </div>
      ) : null}

      {connection.platform === "youtube" ? (
        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="text-xs font-bold text-foreground">Visibility</span>
            <select
              value={getStringSetting(settings, "privacyStatus", "private")}
              onChange={(event) => onChange("privacyStatus", event.target.value)}
              className="mt-1.5 h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary"
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
          capabilitiesState={tiktokCapabilities}
          settings={settings}
          onChange={onChange}
          onRetry={onRetryTikTok}
        />
      ) : null}
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
        Loading available TikTok settings...
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
          className="mt-1.5 h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary"
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
        "flex min-h-10 items-start gap-2.5 rounded-[10px] border border-border bg-white px-3 py-2",
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
  useOpeningClip,
}: {
  openingMedia: ScheduleMediaOption | null;
  scheduledMedia: ScheduleMediaOption | null;
  status: ScheduleDraftStatus;
  useOpeningClip: boolean;
}) {
  const message = getStatusPreviewMessage({
    openingMedia,
    scheduledVideo: scheduledMedia,
    useOpeningClip,
  });

  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
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

function getTabDescription(tab: ScheduleTab) {
  const descriptions: Record<ScheduleTab, string> = {
    drafts: "Saved posts that still need a date, video preparation, or final schedule.",
    failed: "Posts that need attention before they can publish successfully.",
    published: "Completed posts with platform results and links.",
    upcoming: "Planned posts moving from preparation to scheduling to publishing.",
  };

  return descriptions[tab];
}

function getTabItemName(tab: ScheduleTab, count: number) {
  const singular: Record<ScheduleTab, string> = {
    drafts: "draft",
    failed: "issue",
    published: "post",
    upcoming: "post",
  };
  const value = singular[tab];

  return count === 1 ? value : `${value}s`;
}

function getTabCounts(drafts: ScheduleDraft[]): Record<ScheduleTab, number> {
  return {
    drafts: drafts.filter(isDraftTabDraft).length,
    failed: drafts.filter(isFailedDraft).length,
    published: drafts.filter((draft) => draft.status === "published").length,
    upcoming: drafts.filter((draft) => isUpcomingDraft(draft)).length,
  };
}

function filterDraftsByTab(drafts: ScheduleDraft[], tab: ScheduleTab) {
  if (tab === "upcoming") {
    return drafts.filter((draft) => isUpcomingDraft(draft));
  }

  if (tab === "drafts") {
    return drafts.filter(isDraftTabDraft);
  }

  if (tab === "failed") {
    return drafts.filter(isFailedDraft);
  }

  return drafts.filter((draft) => draft.status === "published");
}

function getPrimaryTabForDraft(draft: ScheduleDraft): ScheduleTab {
  if (draft.status === "published") {
    return "published";
  }

  if (isFailedDraft(draft)) {
    return "failed";
  }

  return isUpcomingDraft(draft) ? "upcoming" : "drafts";
}

function isDraftTabDraft(draft: ScheduleDraft) {
  return !draft.scheduledDate && !draft.scheduledTime;
}

function isFailedDraft(draft: ScheduleDraft) {
  return (
    draft.status === "failed" ||
    draft.status === "partially_failed" ||
    draft.status === "cancelled" ||
    draft.status === "render_failed" ||
    draft.status === "publishing_unavailable"
  );
}

function isUpcomingDraft(draft: ScheduleDraft) {
  return Boolean(
    draft.scheduledDate &&
      draft.scheduledTime &&
      !isFailedDraft(draft) &&
      draft.status !== "published",
  );
}

function getDraftTimeLabel(draft: ScheduleDraft) {
  if (!draft.scheduledDate || !draft.scheduledTime) {
    return "Date and time not selected";
  }

  return `${draft.scheduledDate}, ${draft.scheduledTime} ${draft.timezone}`;
}

function getDraftRenderMessage(draft: ScheduleDraft) {
  if (draft.status === "published") {
    return "Published successfully. Platform links appear below when available.";
  }

  if (draft.status === "publishing") {
    return "Publishing is in progress on the selected platform accounts.";
  }

  if (draft.status === "scheduled") {
    if (isCarouselDraft(draft)) {
      return "Carousel is queued for publishing at the planned time.";
    }

    return isSingleVideoDraft(draft)
      ? "Scheduled video is queued for publishing at the planned time."
      : "Final combined video is scheduled. Publishing will run at the planned time.";
  }

  if (draft.status === "scheduling") {
    return isCarouselDraft(draft)
      ? "Creating platform schedules for this carousel."
      : "Creating platform schedules for this final video.";
  }

  if (draft.status === "partially_failed") {
    return "Some platforms failed. Check the platform status rows below.";
  }

  if (draft.status === "failed" || draft.status === "publishing_unavailable") {
    if (draft.status === "publishing_unavailable") {
      if (isCarouselDraft(draft)) {
        return (
          draft.finalScheduleError ??
          "The carousel is ready, but platform scheduling did not complete. Retry scheduling below."
        );
      }

      return (
        draft.finalScheduleError ??
        "The final video is ready, but platform scheduling did not complete. Retry scheduling below."
      );
    }

    return "Publishing failed. Check the platform status rows below.";
  }

  if (draft.status === "cancelled") {
    return "This scheduled post was cancelled.";
  }

  if (draft.status === "ready") {
    if (isCarouselDraft(draft)) {
      return "Choose an account, date, and time to schedule this carousel.";
    }

    return hasPlannedFinalSchedule(draft)
      ? "Combined MP4 is ready. Creating the final platform schedule automatically."
      : "Combined MP4 is ready for final scheduling.";
  }

  if (draft.status === "render_failed") {
    return "We could not prepare the combined video. Try again before scheduling.";
  }

  if (draft.status === "rendering") {
    return hasPlannedFinalSchedule(draft)
      ? "We are combining the opening clip and scheduled video. Scheduling starts automatically when the video is ready."
      : "Opening clip and scheduled video are being combined into one MP4.";
  }

  if (draft.status === "render_required") {
    return "Prepare the opening clip and scheduled video as one video before publishing.";
  }

  if (draft.status === "media_required") {
    if (isCarouselDraft(draft)) {
      return "This saved carousel is unavailable. Return to Content and choose it again.";
    }

    if (draft.mediaIssue === "demo") {
      return "The selected scheduled video was removed. Edit this draft and choose another video.";
    }

    if (draft.mediaIssue === "opening") {
      return "The selected opening clip was removed. Edit this draft and choose an available clip.";
    }

    if (draft.mediaIssue === "both") {
      return "The selected videos are no longer available. Edit this draft and choose new media.";
    }

    return isSingleVideoDraft(draft)
      ? "Select a video to schedule."
      : "Choose an opening clip and scheduled video before preparing the post.";
  }

  if (isCarouselDraft(draft)) {
    return "Choose an account, date, and time to schedule this carousel.";
  }

  return isSingleVideoDraft(draft)
    ? "Save a scheduled video before publishing."
    : "Save an opening clip and scheduled video before preparing the post.";
}

function canScheduleFinalDraft(draft: ScheduleDraft) {
  return Boolean(
    (draft.status === "ready" ||
      draft.status === "publishing_unavailable" ||
      canRetrySchedulerCreateFailure(draft)) &&
      (isSingleVideoDraft(draft) || isCarouselDraft(draft)
        ? draft.demoMedia
        : draft.combinedMedia?.mediaUrl) &&
      hasPlannedFinalSchedule(draft) &&
      !hasScheduleLeadTimeError(draft),
  );
}

function canRetrySchedulerCreateFailure(draft: ScheduleDraft) {
  const targets = draft.targets ?? [];

  return (
    draft.status === "failed" &&
    targets.length > 0 &&
    targets.every(
      (target) =>
        target.status === "failed" &&
        target.lastErrorCode === "scheduler_create_failed",
    )
  );
}

function hasPlannedFinalSchedule(draft: ScheduleDraft) {
  return Boolean(
    (draft.plannedConnectionIds?.length ?? 0) > 0 &&
      getDraftPlannedScheduledFor(draft),
  );
}

function getFinalScheduleUnavailableMessage(draft: ScheduleDraft) {
  if ((draft.plannedConnectionIds?.length ?? 0) === 0) {
    return "No connected accounts were selected when this draft was saved.";
  }

  if (!getDraftPlannedScheduledFor(draft)) {
    return "Choose date and time in a new schedule draft before final scheduling.";
  }

  if (hasScheduleLeadTimeError(draft)) {
    return (
      draft.finalScheduleError ??
      "The selected publish time is too close. Choose a later date and time."
    );
  }

  return null;
}

function hasScheduleLeadTimeError(draft: ScheduleDraft) {
  return (
    draft.finalScheduleErrorCode === "schedule_time_too_soon" ||
    draft.finalScheduleError?.startsWith("Choose a time at least ") === true
  );
}

function getDraftPlannedScheduledFor(draft: ScheduleDraft) {
  if (draft.plannedScheduledFor) {
    return draft.plannedScheduledFor;
  }

  if (!draft.scheduledDate || !draft.scheduledTime) {
    return null;
  }

  return `${draft.scheduledDate}T${draft.scheduledTime}`;
}

function hasActiveSchedulingWork(schedule: ScheduledPost) {
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);
  const finalScheduleStatus = getString(schedule.metadata.finalScheduleStatus);
  const hasDuePublishingTarget = schedule.targets.some((target) => {
    if (target.status === "publishing" || target.status === "scheduling") {
      return true;
    }

    return (
      target.status === "scheduled" &&
      Date.parse(target.scheduledFor) <= Date.now() + 5_000
    );
  });

  return (
    renderStatus === "queued" ||
    renderStatus === "rendering" ||
    hasDuePublishingTarget ||
    (["draft", "scheduling"].includes(schedule.status) &&
      ["finalizing", "scheduling"].includes(finalScheduleStatus ?? ""))
  );
}

async function queueCombinationRender({
  scheduleId,
  token,
}: {
  scheduleId: string;
  token: string;
}) {
  const response = await fetch(`/api/schedules/${scheduleId}/render`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  const data = (await response.json()) as ScheduleRenderResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(
      getApiResponseMessage(data, "Could not start video preparation."),
    );
  }

  return data;
}

async function requestFinalSchedule({
  connectionIds,
  scheduleId,
  timezone,
  token,
}: {
  connectionIds: string[];
  scheduleId: string;
  timezone: string;
  token: string;
}) {
  const response = await fetch(`/api/schedules/${scheduleId}/publish`, {
    body: JSON.stringify({ connectionIds, timezone }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as SchedulePublishResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(
      getApiResponseMessage(data, "Could not schedule the final post."),
    );
  }

  return data;
}

function mapScheduledPostToScheduleDraft(
  schedule: ScheduledPost,
  mediaIssue: ScheduleMediaIssue | null = null,
): ScheduleDraft {
  const metadata = schedule.metadata;
  const plannedScheduledDate =
    typeof metadata.scheduledDate === "string" && metadata.scheduledDate
      ? metadata.scheduledDate
      : undefined;
  const plannedScheduledTime =
    typeof metadata.scheduledTime === "string" && metadata.scheduledTime
      ? metadata.scheduledTime
      : undefined;
  const plannedScheduledFor =
    schedule.scheduledFor ?? getString(metadata.plannedScheduledFor);
  const zonedScheduleParts = plannedScheduledFor
    ? getSafeZonedDateTimeParts(plannedScheduledFor, schedule.timezone)
    : null;
  const scheduledDate = zonedScheduleParts?.date ?? plannedScheduledDate;
  const scheduledTime = zonedScheduleParts?.time ?? plannedScheduledTime;
  const hookMedia = getMetadataMediaOption({
    id: metadata.hookMediaId,
    sourceType: "influencer_video",
    title: metadata.hookMediaTitle,
  });
  const demoMedia = getMetadataMediaOption({
    id: metadata.scheduledVideoId ?? metadata.demoMediaId ?? schedule.mediaAssetId,
    sourceType: getScheduleMediaSourceType(metadata.scheduledVideoSourceType),
    title: metadata.scheduledVideoTitle ?? metadata.demoMediaTitle ?? schedule.title,
  });
  const combinedMedia = getMetadataMediaOption({
    id: metadata.combinedMediaAssetId,
    mediaUrl: metadata.combinedVideoUrl,
    sourceType: "combined_video",
    title: `${schedule.title} final`,
  });
  const carouselMedia =
    schedule.sourceKind === "library_item" && schedule.libraryItemId
      ? getMetadataMediaOption({
          id: schedule.libraryItemId,
          sourceType: "generated_carousel",
          title: schedule.title,
        })
      : undefined;

  return {
    canCancel: canCancelSchedule(schedule),
    canEdit: canEditSchedule(schedule),
    caption: schedule.caption,
    combinedMedia,
    createdAt: schedule.createdAt,
    demoMedia: carouselMedia ?? demoMedia,
    finalScheduleError: getString(metadata.finalScheduleError) ?? undefined,
    finalScheduleErrorCode:
      getString(metadata.finalScheduleErrorCode) ?? undefined,
    hookMedia,
    id: schedule.id,
    mediaIssue: mediaIssue ?? undefined,
    mediaMode:
      schedule.sourceKind === "library_item"
        ? "carousel"
        : isCombinedVideoMetadata(metadata)
          ? "combined_video"
          : "single_video",
    mediaTitle: schedule.title,
    plannedConnectionIds: getMetadataCsv(metadata.plannedConnectionIds),
    plannedScheduledFor: plannedScheduledFor ?? undefined,
    platforms: getDraftPlatformsFromSchedule(schedule),
    scheduledDate,
    scheduledTime,
    sourceId: schedule.mediaAssetId ?? schedule.libraryItemId ?? undefined,
    sourceType:
      combinedMedia
        ? "combined_video"
        : isSingleVideoMetadata(metadata)
          ? getScheduleMediaSourceType(metadata.scheduledVideoSourceType)
        : schedule.sourceKind === "library_item"
          ? "generated_carousel"
          : "demo_video",
    status: getDraftStatusFromScheduledPost(schedule, mediaIssue),
    targets: schedule.targets,
    timezone: schedule.timezone,
    updatedAt: schedule.updatedAt,
  };
}

function getDraftStatusFromScheduledPost(
  schedule: ScheduledPost,
  mediaIssue: ScheduleMediaIssue | null = null,
): ScheduleDraftStatus {
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);
  const finalScheduleStatus = getString(schedule.metadata.finalScheduleStatus);

  if (mediaIssue) {
    return "media_required";
  }

  if (renderStatus === "queued" || renderStatus === "rendering") {
    return "rendering";
  }

  if (renderStatus === "failed") {
    return "render_failed";
  }

  if (schedule.status === "failed") {
    return "failed";
  }

  if (schedule.status === "partially_failed") {
    return "partially_failed";
  }

  if (schedule.status === "cancelled") {
    return "cancelled";
  }

  if (schedule.status === "published") {
    return "published";
  }

  if (schedule.status === "publishing") {
    return "publishing";
  }

  if (schedule.status === "scheduled") {
    return "scheduled";
  }

  if (schedule.status === "scheduling") {
    return "scheduling";
  }

  if (
    schedule.status === "draft" &&
    (finalScheduleStatus === "finalizing" ||
      finalScheduleStatus === "scheduling")
  ) {
    return "scheduling";
  }

  if (
    schedule.status === "draft" &&
    (finalScheduleStatus === "failed" ||
      (renderStatus === "ready" && hasPlannedFinalScheduleMetadata(schedule)))
  ) {
    return "publishing_unavailable";
  }

  if (renderStatus === "ready") {
    return "ready";
  }

  if (schedule.metadata.hookMediaId && schedule.metadata.demoMediaId) {
    return "render_required";
  }

  if (schedule.status === "draft") {
    return "draft";
  }

  return "scheduled_preview";
}

function hasPlannedFinalScheduleMetadata(schedule: ScheduledPost) {
  const metadata = schedule.metadata;

  return Boolean(
    getString(metadata.plannedConnectionIds) &&
      (getString(metadata.plannedScheduledFor) ||
        (getString(metadata.scheduledDate) && getString(metadata.scheduledTime))),
  );
}

function getDraftPlatformsFromSchedule(schedule: ScheduledPost): ScheduleDraft["platforms"] {
  const targetPlatforms = Array.from(
    new Set(schedule.targets.map((target) => target.platform)),
  );

  if (targetPlatforms.length > 0) {
    return targetPlatforms;
  }

  const plannedPlatforms = schedule.metadata.plannedPlatforms;

  if (typeof plannedPlatforms !== "string" || !plannedPlatforms) {
    return [];
  }

  return plannedPlatforms
    .split(",")
    .filter((platform): platform is ScheduleDraft["platforms"][number] =>
      schedulePlatforms.includes(platform as ScheduleDraft["platforms"][number]),
    );
}

function getMetadataMediaOption({
  id,
  mediaUrl,
  sourceType,
  title,
}: {
  id: unknown;
  mediaUrl?: unknown;
  sourceType: ScheduleMediaOption["sourceType"];
  title: unknown;
}): ScheduleMediaOption | undefined {
  if (typeof id !== "string" || !id) {
    return undefined;
  }

  return {
    id,
    mediaUrl: typeof mediaUrl === "string" && mediaUrl ? mediaUrl : undefined,
    sourceType,
    status: "ready",
    title: typeof title === "string" && title ? title : "Scheduled media",
  };
}

function isSingleVideoMetadata(metadata: Record<string, unknown>) {
  return metadata.mediaMode === "single_video";
}

function isCombinedVideoMetadata(metadata: Record<string, unknown>) {
  return (
    metadata.mediaMode === "combined_video" ||
    Boolean(getString(metadata.hookMediaId))
  );
}

function isSingleVideoDraft(draft: ScheduleDraft) {
  return (
    draft.mediaMode === "single_video" ||
    (draft.mediaMode !== "combined_video" &&
      draft.mediaMode !== "carousel" &&
      draft.sourceType !== "combined_video" &&
      draft.sourceType !== "generated_carousel" &&
      !draft.hookMedia)
  );
}

function isCarouselDraft(draft: ScheduleDraft) {
  return (
    draft.mediaMode === "carousel" || draft.sourceType === "generated_carousel"
  );
}

function getScheduleDraftPlatformLabel(
  draft: ScheduleDraft,
  platform: SchedulePlatform,
) {
  if (!isCarouselDraft(draft)) {
    return getSchedulePlatformLabel(platform);
  }

  if (platform === "instagram") {
    return "Instagram carousel";
  }

  if (platform === "tiktok") {
    return "TikTok photos";
  }

  return "YouTube (unsupported)";
}

function isCombinedVideoDraft(draft: ScheduleDraft) {
  return draft.mediaMode === "combined_video" || Boolean(draft.hookMedia);
}

function getScheduleMediaSourceType(value: unknown): ScheduleMediaOption["sourceType"] {
  if (
    value === "demo_video" ||
    value === "demo_upload" ||
    value === "edit_video" ||
    value === "edit_export" ||
    value === "generated_video" ||
    value === "upload" ||
    value === "user_video"
  ) {
    if (value === "demo_upload") {
      return "demo_video";
    }

    if (value === "edit_export") {
      return "edit_video";
    }

    if (value === "upload") {
      return "user_video";
    }

    return value;
  }

  return "demo_video";
}

function getDraftMediaParts(draft: ScheduleDraft): {
  combinedMedia: ScheduleMediaOption | null;
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
} {
  const combinedMedia = draft.combinedMedia ?? null;
  let demoMedia = draft.demoMedia ?? null;
  let hookMedia = draft.hookMedia ?? null;
  const legacyMedia = getLegacyDraftMedia(draft);

  if (
    (legacyMedia?.sourceType === "demo_video" ||
      legacyMedia?.sourceType === "generated_carousel") &&
    !demoMedia
  ) {
    demoMedia = legacyMedia;
  } else if (legacyMedia && !hookMedia) {
    hookMedia = legacyMedia;
  }

  return { combinedMedia, demoMedia, hookMedia };
}

function getLegacyDraftMedia(draft: ScheduleDraft): ScheduleMediaOption | null {
  if (!draft.sourceId || !draft.sourceType || !draft.mediaTitle) {
    return null;
  }

  return {
    id: draft.sourceId,
    mediaUrl: draft.mediaUrl,
    sourceType: draft.sourceType,
    status: draft.mediaUrl ? "ready" : "missing_render",
    thumbnailUrl: draft.thumbnailUrl,
    title: draft.mediaTitle,
  };
}

function mapMediaAssetToScheduleMediaOption(asset: MediaAsset): ScheduleMediaOption {
  return {
    durationLabel: formatAssetDuration(asset.durationSeconds),
    id: asset.id,
    mediaUrl: asset.url || undefined,
    sourceRecordId: asset.sourceRecordId ?? undefined,
    sourceType: getScheduleSourceTypeFromMediaAsset(asset),
    status: asset.url ? "ready" : "missing_render",
    thumbnailUrl: asset.thumbnailUrl ?? undefined,
    title: asset.title,
  };
}

function mapAvatarToCatalogInfluencerOption(
  avatar: Extract<AvatarListResponse, { ok: true }>["avatars"][number],
): ScheduleCatalogInfluencerOption {
  return {
    avatarId: avatar.asset.id,
    durationLabel: formatAssetDuration(avatar.asset.durationSeconds),
    id: `catalog-influencer:${avatar.asset.id}`,
    thumbnailUrl: avatar.asset.thumbnailUrl ?? undefined,
    title: avatar.asset.name,
  };
}

function getScheduleSourceTypeFromMediaAsset(
  asset: MediaAsset,
): ScheduleMediaOption["sourceType"] {
  if (asset.sourceType === "demo_upload") {
    return "demo_video";
  }

  if (asset.sourceType === "generated_video") {
    return "generated_video";
  }

  if (asset.sourceType === "edit_export") {
    return "edit_video";
  }

  if (asset.sourceType === "combined_render") {
    return "combined_video";
  }

  if (asset.collection === "influencer") {
    return "influencer_video";
  }

  return "user_video";
}

function isOpeningVideoMediaAsset(asset: MediaAsset) {
  return hookVideoSourceTypes.includes(asset.sourceType);
}

function isScheduledVideoMediaAsset(asset: MediaAsset) {
  return (
    asset.collection === "video" &&
    scheduledVideoSourceTypes.includes(asset.sourceType)
  );
}

function dedupeScheduleMediaOptions(options: ScheduleMediaOption[]) {
  const seen = new Set<string>();
  const deduped: ScheduleMediaOption[] = [];

  for (const option of options) {
    if (seen.has(option.id)) {
      continue;
    }

    seen.add(option.id);
    deduped.push(option);
  }

  return deduped;
}

function getMediaSourceLabel(option: ScheduleMediaOption) {
  const sourceLabels: Record<ScheduleMediaOption["sourceType"], string> = {
    demo_video: "Library video",
    combined_video: "Combined video",
    edit_video: "Edited video",
    generated_carousel: "Generated carousel",
    generated_video: "Generated video",
    influencer_video: "Influencer",
    user_video: "Uploaded video",
  };

  return sourceLabels[option.sourceType];
}

function getOpeningVideoEmptyCopy(source: OpeningVideoSourceTab) {
  if (source === "influencers") {
    return {
      description:
        "Choose an influencer from Creative Assets or upload your own influencer clip.",
      title: "No influencer videos found.",
    };
  }

  if (source === "videos") {
    return {
      description:
        "Upload a video or generate one before building a schedule draft.",
      title: "No videos found.",
    };
  }

  if (source === "edited") {
    return {
      description:
        "Open a video in Edit, export it, then select it here for scheduling.",
      title: "No edited videos found.",
    };
  }

  return {
    description:
      "Add an influencer, upload a video, or create an Edit export before scheduling.",
      title: "No opening clips found.",
  };
}

function buildScheduleRequestBody(submission: ScheduleFormSubmission) {
  if (submission.scheduledSource.kind === "library_item") {
    return {
      caption: submission.caption,
      metadata: {
        mediaMode: "carousel",
        plannedScheduledFor: submission.scheduledFor,
        scheduledDate: submission.scheduledDate,
        scheduledTime: submission.scheduledTime,
      },
      plannedTargets: submission.targets,
      scheduledDate: submission.scheduledDate,
      scheduledFor: submission.scheduledFor,
      scheduledTime: submission.scheduledTime,
      source: submission.scheduledSource,
      targets: [],
      timezone: submission.timezone,
      title: submission.scheduledSourceTitle.slice(0, 140),
    };
  }

  if (!submission.scheduledVideo) {
    throw new Error("Select a video to schedule.");
  }

  const mediaMode = submission.useOpeningClip
    ? ("combined_video" as const)
    : ("single_video" as const);

  return {
    caption: submission.caption,
    metadata: {
      demoMediaId: submission.scheduledVideo.id,
      demoMediaTitle: submission.scheduledVideo.title,
      hookMediaId: submission.openingMedia?.id ?? null,
      hookMediaTitle: submission.openingMedia?.title ?? null,
      mediaMode,
      plannedScheduledFor: submission.scheduledFor,
      scheduledDate: submission.scheduledDate,
      scheduledTime: submission.scheduledTime,
      scheduledVideoId: submission.scheduledVideo.id,
      scheduledVideoSourceType: submission.scheduledVideo.sourceType,
      scheduledVideoTitle: submission.scheduledVideo.title,
      useOpeningClip: submission.useOpeningClip,
    },
    plannedTargets: submission.targets,
    scheduledDate: submission.scheduledDate,
    scheduledFor: submission.scheduledFor,
    scheduledTime: submission.scheduledTime,
    source: submission.scheduledSource,
    targets: [],
    timezone: submission.timezone,
    title:
      mediaMode === "combined_video" && submission.openingMedia
        ? getCompositeMediaTitle(submission.openingMedia, submission.scheduledVideo)
        : submission.scheduledVideo.title.slice(0, 140),
  };
}

async function completeTrendingScheduleAssignment(params: {
  schedule: ScheduledPost;
  token: string;
}) {
  const assignmentId = getString(params.schedule.metadata.assignmentId);

  if (!assignmentId) {
    return null;
  }

  try {
    const response = await fetch("/api/trending/feed/actions", {
      body: JSON.stringify({ action: "scheduled", assignmentId }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as
      | { message?: string; ok?: boolean }
      | null;

    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.message ?? "Could not update the Trending feed.");
    }

    return null;
  } catch {
    return "The post is scheduled, but Trending may need a refresh.";
  }
}

function getInitialScheduleConnectionIds(params: {
  connections: SocialConnection[];
  isCarouselSchedule: boolean;
  plannedPlatforms: SchedulePlatform[];
  plannedTargets: ScheduleCreateTargetInput[];
}) {
  const allowedConnections = params.isCarouselSchedule
    ? params.connections.filter((connection) =>
        supportsCarouselPublishing(connection.platform),
      )
    : params.connections;
  const allowedConnectionIds = new Set(
    allowedConnections.map((connection) => connection.id),
  );
  const savedConnectionIds = params.plannedTargets
    .map((target) => target.connectionId)
    .filter((connectionId) => allowedConnectionIds.has(connectionId));

  if (savedConnectionIds.length > 0) {
    return savedConnectionIds;
  }

  return params.plannedPlatforms.flatMap((platform) => {
    const connection = allowedConnections.find(
      (candidate) =>
        candidate.platform === platform && candidate.status === "connected",
    );

    return connection ? [connection.id] : [];
  });
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

function getSavedPlannedTargets(
  schedule: ScheduledPost | null,
): ScheduleCreateTargetInput[] {
  if (!schedule) {
    return [];
  }

  const snapshot = getString(schedule.metadata.plannedTargetsJson);

  if (snapshot) {
    try {
      const parsed = JSON.parse(snapshot) as unknown;

      if (Array.isArray(parsed)) {
        return parsed.flatMap((entry): ScheduleCreateTargetInput[] => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return [];
          }

          const target = entry as Record<string, unknown>;
          const connectionId = getString(target.connectionId);
          const platform = getString(target.platform);
          const settings =
            target.settings &&
            typeof target.settings === "object" &&
            !Array.isArray(target.settings)
              ? (target.settings as Record<string, unknown>)
              : {};

          if (!connectionId) {
            return [];
          }

          return [
            {
              connectionId,
              platform:
                platform &&
                schedulePlatforms.includes(platform as SchedulePlatform)
                  ? (platform as SchedulePlatform)
                  : undefined,
              settings,
            },
          ];
        });
      }
    } catch {
      // Fall back to the older connection ID snapshot below.
    }
  }

  return getMetadataCsv(schedule.metadata.plannedConnectionIds).map(
    (connectionId) => ({ connectionId }),
  );
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

function getCompositeMediaTitle(
  hookMedia: ScheduleMediaOption,
  demoMedia: ScheduleMediaOption,
) {
  return `${hookMedia.title} + ${demoMedia.title}`.slice(0, 140);
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

function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getMetadataCsv(value: unknown) {
  return typeof value === "string" && value.trim()
    ? Array.from(
        new Set(
          value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      )
    : [];
}

function getInitialScheduleTab(): ScheduleTab {
  if (typeof window === "undefined") {
    return "upcoming";
  }

  const tab = new URLSearchParams(window.location.search).get("tab");

  return scheduleTabs.includes(tab as ScheduleTab)
    ? (tab as ScheduleTab)
    : "upcoming";
}

function getDraftStatusPreview({
  demoMedia,
  hookMedia,
  useOpeningClip,
}: {
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
  useOpeningClip: boolean;
}): ScheduleDraftStatus {
  if (!demoMedia || (useOpeningClip && !hookMedia)) {
    return "media_required";
  }

  return useOpeningClip ? "render_required" : "draft";
}

function getScheduleMediaValidationError(params: {
  openingMedia: ScheduleMediaOption | null;
  scheduledVideo: ScheduleMediaOption | null;
  useOpeningClip: boolean;
}) {
  if (!params.scheduledVideo) {
    return "Select a video to schedule.";
  }

  if (params.useOpeningClip && !params.openingMedia) {
    return 'Select an opening clip or turn off "Add an opening clip."';
  }

  return null;
}

function getStatusPreviewMessage(params: {
  openingMedia: ScheduleMediaOption | null;
  scheduledVideo: ScheduleMediaOption | null;
  useOpeningClip: boolean;
}) {
  const mediaError = getScheduleMediaValidationError(params);

  if (mediaError) {
    return mediaError;
  }

  return params.useOpeningClip
    ? "We prepare one combined video first, then schedule it automatically."
    : "This video will be published as the scheduled post.";
}

function formatAssetDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Duration pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.floor(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
