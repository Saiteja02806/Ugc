"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarPlus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileVideo,
  Images,
  List,
  Loader2,
  Plus,
  Pencil,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/auth-context";
import type { MediaAsset, MediaSourceType } from "@/lib/media/types";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getScheduleMediaIssue } from "@/lib/scheduling/media-availability";
import { getSocialConnectionAccountLabel } from "@/lib/scheduling/schedule-form-persistence";
import {
  getInstagramSchedulingAccessState,
  type InstagramSchedulingAccessState,
} from "@/lib/scheduling/social-connection-policy";
import {
  getSchedulePlatformLabel,
  getScheduleStatusLabel,
  schedulePlatforms,
  scheduleTabs,
  type ScheduledPost,
  type ScheduledPostTarget,
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
  DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
} from "@/lib/scheduling/schedule-time";
import {
  getSocialSchedulingCalendarStartAt,
  isScheduleDraftVisibleInCalendar,
} from "@/lib/scheduling/calendar-start";
import {
  canCancelSchedule,
  canEditSchedule,
  getScheduleEditBlockReason,
} from "@/lib/scheduling/schedule-action-policy";
import { getSchedulePublishFailureMessage } from "@/lib/scheduling/schedule-publish-outcome";
import {
  AccountDataAuthenticationUnavailableError,
  getAccountSchedulesQueryKey,
  getAccountSocialConnectionsQueryKey,
  loadAccountSchedules,
  loadAccountSocialConnections,
  upsertAccountSchedule,
  type AccountSchedules,
} from "@/lib/scheduling/account-data-query";
import {
  getSchedulingMediaCatalogQueryKey,
  SCHEDULING_CATALOG_FRESH_TIME_MS,
  SCHEDULING_CATALOG_GC_TIME_MS,
} from "@/lib/scheduling/workspace-query-cache";
import type { SocialConnection } from "@/lib/social/types";
import type {
  ScheduleCatalogInfluencerOption,
  ScheduleFormSubmission,
} from "@/components/scheduling/schedule-editor";
import { formatCreatorDisplayName } from "@/lib/video/avatar-display";
import { cn } from "@/lib/utils";

const ScheduleEditor = dynamic(
  () =>
    import("@/components/scheduling/schedule-editor").then(
      (module) => module.ScheduleEditor,
    ),
  { loading: ScheduleEditorLoading },
);

const hookVideoSourceTypes: MediaSourceType[] = [
  "upload",
  "generated_video",
  "edit_export",
  "wall_text_render",
];
const scheduledVideoSourceTypes: MediaSourceType[] = [
  "demo_upload",
  "upload",
  "generated_video",
  "edit_export",
];
const ACTIVE_SCHEDULE_POLL_INTERVAL_MS = 5_000;
const ACTIVE_SCHEDULE_LOOKAHEAD_MS = 60_000;
const ACTIVE_SCHEDULE_LOOKBEHIND_MS = 120_000;
const ACTIVE_JOB_TIMEOUT_MS = 5 * 60 * 1_000;
type MediaListResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

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

class SchedulePublishOutcomeError extends Error {
  constructor(
    message: string,
    readonly result: { created: boolean; schedule: ScheduledPost },
  ) {
    super(message);
    this.name = "SchedulePublishOutcomeError";
  }
}

class SchedulingAuthenticationUnavailableError extends Error {
  constructor() {
    super("Scheduling authentication is unavailable.");
    this.name = "SchedulingAuthenticationUnavailableError";
  }
}

type SchedulePublishRetryResponse =
  | {
      created: boolean;
      ok: true;
      retryStatus: "in_progress" | "published" | "started";
      schedule: ScheduledPost;
    }
  | { message?: string; ok?: false };

type SchedulingMediaCatalog = {
  catalogInfluencerOptions: ScheduleCatalogInfluencerOption[];
  demoMediaOptions: ScheduleMediaOption[];
  hookMediaOptions: ScheduleMediaOption[];
};

type SchedulingCatalogLoadOptions = {
  force?: boolean;
};

type ScheduleMutationResponse =
  | { ok: true; schedule: ScheduledPost }
  | { message?: string; ok?: false };

const tabLabels: Record<ScheduleTab, string> = {
  drafts: "Drafts",
  failed: "Failed",
  published: "Published",
  upcoming: "Upcoming",
};

export function SchedulingWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
  const cachedMediaCatalog = queryClient.getQueryData<SchedulingMediaCatalog>(
    getSchedulingMediaCatalogQueryKey(accountId),
  );
  const cachedSchedules = queryClient.getQueryData<AccountSchedules>(
    getAccountSchedulesQueryKey(accountId),
  );
  const cachedSocialConnections = queryClient.getQueryData<SocialConnection[]>(
    getAccountSocialConnectionsQueryKey(accountId),
  );
  const [serverSchedules, setServerSchedules] = useState<ScheduledPost[]>(
    () => cachedSchedules?.schedules ?? [],
  );
  const [schedulesLoaded, setSchedulesLoaded] = useState(
    () => cachedSchedules !== undefined,
  );
  const initialDraftQueryState = useRef<"handled" | "idle" | "opening">(
    "idle",
  );
  const [catalogInfluencerOptions, setCatalogInfluencerOptions] = useState<
    ScheduleCatalogInfluencerOption[]
  >(() => cachedMediaCatalog?.catalogInfluencerOptions ?? []);
  const [hookMediaOptions, setHookMediaOptions] = useState<ScheduleMediaOption[]>(
    () => cachedMediaCatalog?.hookMediaOptions ?? [],
  );
  const [demoMediaOptions, setDemoMediaOptions] = useState<ScheduleMediaOption[]>(
    () => cachedMediaCatalog?.demoMediaOptions ?? [],
  );
  const [scheduleMediaLoaded, setScheduleMediaLoaded] = useState(
    () => cachedMediaCatalog !== undefined,
  );
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>(
    () => cachedSocialConnections ?? [],
  );
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

      return mapScheduledPostToScheduleDraft(
        schedule,
        mediaIssue,
        socialConnections,
      );
    });
  }, [
    demoMediaOptions,
    hookMediaOptions,
    scheduleMediaLoaded,
    serverSchedules,
    socialConnections,
  ]);
  const [activeTab, setActiveTab] = useState<ScheduleTab>(getInitialScheduleTab);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>(
    getInitialScheduleViewMode,
  );
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
  const [scheduleAccessPrompt, setScheduleAccessPrompt] = useState<
    Exclude<InstagramSchedulingAccessState, "ready"> | null
  >(null);
  const [checkingScheduleAccess, setCheckingScheduleAccess] = useState(false);
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
  const [minimumScheduleLeadMinutes, setMinimumScheduleLeadMinutes] = useState(
    () =>
      getConfiguredScheduleLeadMinutes(cachedSchedules) ??
      DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
  const [calendarStartAt, setCalendarStartAt] = useState(
    () => getSocialSchedulingCalendarStartAt(cachedSchedules?.calendarStartAt),
  );
  const defaultNewScheduleSlot = getDefaultScheduleSlot(
    newScheduleInitialDate,
    minimumScheduleLeadMinutes,
  );

  useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set("tab", activeTab);
    url.searchParams.set("view", viewMode);
    window.history.replaceState(window.history.state, "", url);
  }, [activeTab, viewMode]);

  const editingSchedule = useMemo(
    () =>
      editingScheduleId
        ? serverSchedules.find((schedule) => schedule.id === editingScheduleId) ??
          null
        : null,
    [editingScheduleId, serverSchedules],
  );
  const editingScheduleDraft = useMemo(
    () =>
      editingSchedule ? mapScheduledPostToScheduleDraft(editingSchedule) : null,
    [editingSchedule],
  );

  const loadScheduleMedia = useCallback(async (
    options: SchedulingCatalogLoadOptions = {},
  ) => {
    try {
      const mediaCatalog = await queryClient.fetchQuery({
        gcTime: SCHEDULING_CATALOG_GC_TIME_MS,
        queryFn: async ({ signal }) => {
          const token = await getCurrentUserIdToken();

          if (!token) {
            throw new SchedulingAuthenticationUnavailableError();
          }

          // `collection=influencer` is a legacy storage/API contract. The
          // Instagram-first scheduling UI presents these real assets as presenters.
          const [influencerResponse, videoResponse, avatarResult] =
            await Promise.all([
              fetch("/api/media?collection=influencer", {
                cache: "no-store",
                headers: { Authorization: `Bearer ${token}` },
                signal,
              }),
              fetch("/api/media?collection=video", {
                cache: "no-store",
                headers: { Authorization: `Bearer ${token}` },
                signal,
              }),
              fetch("/api/avatars", {
                cache: "no-store",
                headers: { Authorization: `Bearer ${token}` },
                signal,
              })
                .then(async (response) => ({
                  data: (await response.json().catch(() => null)) as
                    | AvatarListResponse
                    | null,
                  response,
                }))
                .catch(() => null),
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

          return {
            catalogInfluencerOptions:
              avatarResult?.response.ok && avatarResult.data?.ok === true
                ? avatarResult.data.avatars.map(mapAvatarToCatalogInfluencerOption)
                : [],
            demoMediaOptions: videoAssets
              .filter(isScheduledVideoMediaAsset)
              .map(mapMediaAssetToScheduleMediaOption),
            hookMediaOptions: dedupeScheduleMediaOptions([
              ...influencerData.assets.map(mapMediaAssetToScheduleMediaOption),
              ...videoAssets
                .filter(isOpeningVideoMediaAsset)
                .map(mapMediaAssetToScheduleMediaOption),
            ]),
          } satisfies SchedulingMediaCatalog;
        },
        queryKey: getSchedulingMediaCatalogQueryKey(accountId),
        retry: false,
        staleTime: options.force ? 0 : SCHEDULING_CATALOG_FRESH_TIME_MS,
      });

      setHookMediaOptions(mediaCatalog.hookMediaOptions);
      setDemoMediaOptions(mediaCatalog.demoMediaOptions);
      setCatalogInfluencerOptions(mediaCatalog.catalogInfluencerOptions);
      setScheduleMediaLoaded(true);
      return true;
    } catch (error) {
      if (error instanceof SchedulingAuthenticationUnavailableError) {
        return false;
      }

      setActionNotice("Could not load scheduling media.");
      return false;
    }
  }, [accountId, queryClient]);

  const prepareCatalogInfluencer = useCallback(async (avatarId: string) => {
    const token = await getCurrentUserIdToken();

    if (!token) {
      throw new Error("Sign in before choosing a presenter.");
    }

    const response = await fetch("/api/media/from-avatar", {
      body: JSON.stringify({ avatarId }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const data = (await response.json()) as PreparedCatalogInfluencerResponse;

    if (!response.ok || data.ok !== true) {
      throw new Error(
        getApiResponseMessage(data, "Could not prepare this presenter."),
      );
    }

    return mapMediaAssetToScheduleMediaOption(data.asset);
  }, []);

  const loadSchedules = useCallback(async (
    options: SchedulingCatalogLoadOptions = {},
  ) => {
    try {
      const data = await loadAccountSchedules(queryClient, accountId, options);

      setServerSchedules((current) =>
        areSchedulesEqual(current, data.schedules) ? current : data.schedules,
      );
      setCalendarStartAt((current) => {
        const next = getSocialSchedulingCalendarStartAt(data.calendarStartAt);
        return current === next ? current : next;
      });
      const configuredLeadMinutes = getConfiguredScheduleLeadMinutes(data);

      if (configuredLeadMinutes !== null) {
        setMinimumScheduleLeadMinutes((current) =>
          current === configuredLeadMinutes ? current : configuredLeadMinutes,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof AccountDataAuthenticationUnavailableError) {
        return null;
      }

      setActionNotice("Could not load server schedules.");
      return null;
    } finally {
      setSchedulesLoaded(true);
    }
  }, [accountId, queryClient]);

  const loadSocialConnections = useCallback(async (
    options: SchedulingCatalogLoadOptions = {},
  ) => {
    try {
      const connections = await loadAccountSocialConnections(
        queryClient,
        accountId,
        options,
      );

      setSocialConnections(connections);
      return connections;
    } catch (error) {
      if (error instanceof AccountDataAuthenticationUnavailableError) {
        return null;
      }

      setActionNotice("Could not load connected Instagram accounts.");
      return null;
    }
  }, [accountId, queryClient]);

  const storeServerSchedule = useCallback((schedule: ScheduledPost) => {
    setServerSchedules((currentSchedules) => [
      schedule,
      ...currentSchedules.filter((candidate) => candidate.id !== schedule.id),
    ]);
    upsertAccountSchedule(queryClient, accountId, schedule);
  }, [accountId, queryClient]);

  useEffect(() => {
    if (accountId === "signed-out") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadScheduleMedia();
      void loadSchedules();
      void loadSocialConnections();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountId, loadScheduleMedia, loadSchedules, loadSocialConnections]);

  const hasActiveServerWork = useMemo(
    () => serverSchedules.some(hasActiveSchedulingWork),
    [serverSchedules],
  );

  useEffect(() => {
    if (!hasActiveServerWork) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSchedules({ force: true });
    }, ACTIVE_SCHEDULE_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [hasActiveServerWork, loadSchedules]);

  const counts = useMemo(() => getTabCounts(drafts), [drafts]);
  const visibleDrafts = useMemo(
    () => filterDraftsByTab(drafts, activeTab),
    [activeTab, drafts],
  );
  const calendarDrafts = useMemo(
    () =>
      drafts.filter((draft) =>
        isScheduleDraftVisibleInCalendar(draft, calendarStartAt),
      ),
    [calendarStartAt, drafts],
  );
  const selectedDayDrafts = useMemo(() => {
    return groupDraftsByDate(calendarDrafts).get(selectedCalendarDate) ?? [];
  }, [calendarDrafts, selectedCalendarDate]);

  function handleSelectCalendarDate(dateKey: string) {
    setSelectedCalendarDate(dateKey);
    setVisibleCalendarMonth(toMonthKey(parseDateKey(dateKey)));
  }

  function handleChangeViewMode(mode: ScheduleViewMode) {
    if (mode === "list" && viewMode !== "list") {
      handleSelectCalendarDate(toDateKey(new Date()));
    }

    setViewMode(mode);
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
    if (checkingScheduleAccess) {
      return;
    }

    setCheckingScheduleAccess(true);
    setActionNotice(null);

    try {
      const connections = await loadSocialConnections();

      if (!connections) {
        return;
      }

      const accessState = getInstagramSchedulingAccessState(connections);

      if (accessState !== "ready") {
        setScheduleAccessPrompt(accessState);
        return;
      }

      setDrawerError(null);
      setEditingScheduleId(null);
      setRequireScheduleTarget(true);
      handleSelectCalendarDate(dateKey);
      setNewScheduleInitialDate(dateKey);
      setViewMode("calendar");
      if (!options.keepDayOpen) {
        setDayPlannerOpen(false);
      }
      await loadScheduleMedia();
      setDrawerOpen(true);
    } finally {
      setCheckingScheduleAccess(false);
    }
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
    setRequireScheduleTarget(true);
    setNewScheduleInitialDate(draft.scheduledDate ?? selectedCalendarDate);
    await Promise.all([
      loadScheduleMedia(),
      loadSocialConnections(),
    ]);
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
        await loadSocialConnections({ force: true });
      } else {
        await Promise.all([
          loadScheduleMedia({ force: true }),
          loadSocialConnections({ force: true }),
        ]);
      }

      if (cancelled) {
        return;
      }

      storeServerSchedule(schedule);
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
    storeServerSchedule,
  ]);

  async function handleSaveScheduleDraft(submission: ScheduleFormSubmission) {
    if (
      !submission.targets.some((target) => target.platform === "instagram")
    ) {
      setDrawerError(
        "Connect and select an Instagram account before scheduling.",
      );
      return;
    }

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
      let finalSchedulingAttempted = false;
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
            finalSchedulingAttempted = true;
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
          finalSchedulingAttempted = true;
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
        if (scheduleError instanceof SchedulePublishOutcomeError) {
          nextSchedule = scheduleError.result.schedule;
        }

        nextNotice = `${editing ? "Changes" : "Draft"} saved, but ${
          finalSchedulingAttempted
            ? "platform scheduling failed"
            : "video preparation did not start"
        }: ${getErrorMessage(scheduleError)}`;
      }

      storeServerSchedule(nextSchedule);
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

      storeServerSchedule(renderResult.schedule);
      setActionNotice(
        renderResult.status === "ready"
          ? "Combined video is already ready."
          : "Video preparation started.",
      );
    } catch (error) {
      setActionNotice(
        getErrorMessage(error, "Could not start video preparation."),
      );
      await Promise.all([
        loadScheduleMedia({ force: true }),
        loadSchedules({ force: true }),
      ]);
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

      storeServerSchedule(data.schedule);
      setActiveTab("upcoming");
      setActionNotice(
        data.created
          ? "Final combined video scheduled."
          : "Final combined video was already scheduled.",
      );
    } catch (error) {
      if (error instanceof SchedulePublishOutcomeError) {
        const failedSchedule = error.result.schedule;

        storeServerSchedule(failedSchedule);
        setActiveTab(
          getPrimaryTabForDraft(mapScheduledPostToScheduleDraft(failedSchedule)),
        );
      }

      setActionNotice(
        getErrorMessage(error, "Could not schedule the final post."),
      );
    } finally {
      setSchedulingFinalDraftId(null);
    }
  }, [storeServerSchedule]);

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

      storeServerSchedule(data.schedule);
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
      await loadSchedules({ force: true });
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

      storeServerSchedule(data.schedule);
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
    <section className="min-h-screen flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-10 lg:py-8">
      <header className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <SocialPlatformIcon className="size-4" platform="instagram" />
            Instagram publishing
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl">
            Content calendar
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted sm:text-base">
            Plan, review, and publish your Instagram content from one focused
            workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void handleNewSchedulePost(selectedCalendarDate, {
              keepDayOpen: dayPlannerOpen,
            })
          }
          disabled={checkingScheduleAccess}
          aria-busy={checkingScheduleAccess}
          className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(225_101_64_/_0.18)] transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-70"
        >
          {checkingScheduleAccess ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {checkingScheduleAccess
            ? "Checking Instagram…"
            : "Schedule Instagram post"}
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 pt-7">
        {actionNotice ? (
          <div
            role="status"
            aria-live="polite"
            className="w-fit rounded-control border border-border bg-card px-3 py-2 text-xs font-semibold text-muted shadow-card"
          >
            {actionNotice}
          </div>
        ) : null}

        {dayPlannerOpen ? (
          <DayScheduleWorkspace
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ScheduleTabs
                activeTab={activeTab}
                counts={counts}
                onChange={setActiveTab}
              />
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {viewMode === "list" ? (
                  <ScheduleListDatePicker
                    selectedDate={selectedCalendarDate}
                    onSelectDate={handleSelectCalendarDate}
                  />
                ) : null}
                <ViewToggle value={viewMode} onChange={handleChangeViewMode} />
              </div>
            </div>

            <ScheduleContent
              activeTab={activeTab}
              calendarMonth={visibleCalendarMonth}
              calendarDrafts={calendarDrafts}
              drafts={visibleDrafts}
              selectedDate={selectedCalendarDate}
              viewMode={viewMode}
              onCreateDraftForDate={(dateKey) =>
                void handleNewSchedulePost(dateKey)
              }
              onMonthChange={setVisibleCalendarMonth}
              onOpenDate={handleOpenDayPlanner}
              onSelectDate={handleSelectCalendarDate}
            />
          </>
        )}
      </div>

      {drawerOpen ? (
        <ScheduleEditor
          catalogInfluencerOptions={catalogInfluencerOptions}
          demoMediaOptions={demoMediaOptions}
          editingIsCombinedVideo={isCombinedVideoMetadata(
            editingSchedule?.metadata ?? {},
          )}
          editingPlannedPlatforms={editingScheduleDraft?.platforms ?? []}
          editingSchedule={editingSchedule}
          editingScheduledDate={editingScheduleDraft?.scheduledDate ?? null}
          editingScheduledTime={editingScheduleDraft?.scheduledTime ?? null}
          errorMessage={drawerError}
          hookMediaOptions={hookMediaOptions}
          initialDemoMediaId={
            getString(editingSchedule?.metadata.scheduledVideoId) ??
            getString(editingSchedule?.metadata.demoMediaId) ??
            editingSchedule?.mediaAssetId ??
            ""
          }
          initialHookMediaId={
            getString(editingSchedule?.metadata.hookMediaId) ?? ""
          }
          initialPlannedTargets={getSavedPlannedTargets(editingSchedule)}
          initialScheduledDate={defaultNewScheduleSlot.date}
          initialScheduledTime={defaultNewScheduleSlot.time}
          minimumScheduleLeadMinutes={minimumScheduleLeadMinutes}
          onClose={handleCloseScheduleDrawer}
          onPrepareCatalogInfluencer={prepareCatalogInfluencer}
          onRefreshMedia={() => loadScheduleMedia({ force: true })}
          onSave={handleSaveScheduleDraft}
          requireScheduleTarget={requireScheduleTarget}
          saving={savingSchedule}
          socialConnections={socialConnections}
        />
      ) : null}

      <InstagramScheduleAccessDialog
        accessState={scheduleAccessPrompt}
        onClose={() => setScheduleAccessPrompt(null)}
      />

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

function ScheduleEditorLoading() {
  useLockBodyScroll();

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="status"
    >
      <div className="flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground shadow-card">
        <Loader2
          aria-hidden="true"
          className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
        />
        Opening scheduling editor…
      </div>
    </div>
  );
}

function InstagramScheduleAccessDialog({
  accessState,
  onClose,
}: {
  accessState: Exclude<InstagramSchedulingAccessState, "ready"> | null;
  onClose: () => void;
}) {
  const reconnecting = accessState === "reconnect";

  return (
    <Dialog
      open={accessState !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <span className="mb-2 inline-flex size-11 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose)_55%,var(--instagram-violet))] text-white shadow-[0_10px_24px_rgb(214_41_118_/_0.18)]">
            <SocialPlatformIcon className="size-5" platform="instagram" />
          </span>
          <DialogTitle className="text-lg font-bold tracking-[-0.02em] text-foreground-strong">
            {reconnecting
              ? "Reconnect Instagram to schedule"
              : "Connect Instagram first"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {reconnecting
              ? "Your Instagram connection cannot publish right now. Reconnect it before choosing media, date, and time."
              : "Scheduling requires a connected Instagram professional account. Connect one before choosing media, date, and time."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            Not now
          </Button>
          <Link
            href="/settings#instagram-publishing"
            onClick={onClose}
            className={buttonVariants({ size: "lg" })}
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            {reconnecting ? "Reconnect Instagram" : "Connect Instagram"}
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      className="flex w-full gap-1 overflow-x-auto rounded-[var(--radius-panel)] border border-border bg-card p-1 sm:w-fit"
    >
      {scheduleTabs.map((tab) => {
        const active = tab === activeTab;

        return (
          <button
            key={tab}
            id={`schedule-tab-${tab}`}
            type="button"
            role="tab"
            aria-controls="schedule-content-panel"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-control px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              active
                ? "bg-selected text-foreground-strong shadow-sm ring-1 ring-primary/20"
                : "text-muted hover:bg-card-muted hover:text-foreground",
            )}
          >
            {tabLabels[tab]}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                active ? "bg-primary/15 text-primary" : "bg-card-muted text-muted",
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
    <div className="inline-flex w-fit items-center rounded-[var(--radius-panel)] border border-border bg-card p-1">
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-control px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        active
          ? "bg-selected text-primary ring-1 ring-primary/20"
          : "text-muted hover:bg-card-muted hover:text-foreground",
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
  calendarDrafts,
  drafts,
  onCreateDraftForDate,
  onMonthChange,
  onOpenDate,
  onSelectDate,
  selectedDate,
  viewMode,
}: {
  activeTab: ScheduleTab;
  calendarMonth: string;
  calendarDrafts: ScheduleDraft[];
  drafts: ScheduleDraft[];
  onCreateDraftForDate: (dateKey: string) => void;
  onMonthChange: (monthKey: string) => void;
  onOpenDate: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
  selectedDate: string;
  viewMode: ScheduleViewMode;
}) {
  let content: ReactNode;

  if (viewMode === "calendar") {
    content = (
      <CalendarPlanner
        calendarMonth={calendarMonth}
        drafts={calendarDrafts}
        selectedDate={selectedDate}
        onCreateDraftForDate={onCreateDraftForDate}
        onMonthChange={onMonthChange}
        onOpenDate={onOpenDate}
        onSelectDate={onSelectDate}
      />
    );
  } else {
    content = (
      <ScheduleDayList
        activeTab={activeTab}
        drafts={drafts}
        selectedDate={selectedDate}
      />
    );
  }

  return (
    <div
      id="schedule-content-panel"
      role="tabpanel"
      aria-labelledby={`schedule-tab-${activeTab}`}
      className="flex min-h-0 w-full flex-1"
    >
      {content}
    </div>
  );
}

function ScheduleListDatePicker({
  onSelectDate,
  selectedDate,
}: {
  onSelectDate: (dateKey: string) => void;
  selectedDate: string;
}) {
  const [open, setOpen] = useState(false);
  const inputId = "schedule-list-date";

  function handleDateChange(dateKey: string) {
    if (!dateKey) {
      return;
    }

    onSelectDate(dateKey);
    setOpen(false);
  }

  function handleSelectToday() {
    handleDateChange(toDateKey(new Date()));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label={`Choose list date, currently ${getReadableDateLabel(selectedDate)}`}
          >
            <CalendarDays data-icon="inline-start" aria-hidden="true" />
            {getReadableDateLabel(selectedDate)}
          </Button>
        }
      />

      <PopoverContent align="end" className="w-72 p-4">
        <PopoverHeader>
          <PopoverTitle>Choose a day</PopoverTitle>
          <PopoverDescription>
            Show the posts scheduled for any date.
          </PopoverDescription>
        </PopoverHeader>

        <FieldGroup className="mt-2 gap-3">
          <Field>
            <FieldLabel htmlFor={inputId}>Date</FieldLabel>
            <Input
              id={inputId}
              type="date"
              value={selectedDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </Field>
          <Button type="button" variant="ghost" size="sm" onClick={handleSelectToday}>
            Today
          </Button>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function ScheduleDayList({
  activeTab,
  drafts,
  selectedDate,
}: {
  activeTab: ScheduleTab;
  drafts: ScheduleDraft[];
  selectedDate: string;
}) {
  const dayDrafts = useMemo(
    () => getScheduleDayListDrafts(drafts, selectedDate),
    [drafts, selectedDate],
  );
  const itemLabel = getTabItemName(activeTab, dayDrafts.length);

  return (
    <section
      aria-labelledby="schedule-day-list-title"
      className="flex w-full flex-col rounded-[var(--radius-panel)] border border-border bg-card p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Daily list
          </p>
          <h2
            id="schedule-day-list-title"
            className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground"
          >
            {getReadableDateLabel(selectedDate)}
          </h2>
          <p className="mt-1 text-sm font-medium leading-5 text-muted">
            {tabLabels[activeTab]} posts scheduled for this day.
          </p>
        </div>
        <Badge variant="outline">
          {dayDrafts.length} {itemLabel}
        </Badge>
      </div>

      {dayDrafts.length > 0 ? (
        <ol
          aria-label={`${tabLabels[activeTab]} posts on ${getReadableDateLabel(selectedDate)}`}
          className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card"
        >
          {dayDrafts.map((draft) => (
            <ScheduleDayListItem key={draft.id} draft={draft} />
          ))}
        </ol>
      ) : (
        <Empty className="mt-5 min-h-40 border border-dashed border-border bg-card-muted p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No {tabLabels[activeTab].toLowerCase()} posts</EmptyTitle>
            <EmptyDescription>
              Choose another date to see posts scheduled on that day.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}

function ScheduleDayListItem({ draft }: { draft: ScheduleDraft }) {
  const isCarousel = isCarouselDraft(draft);
  const PostFormatIcon = isCarousel ? Images : FileVideo;

  return (
    <li className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(120px,0.3fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Clock3 className="size-4 text-muted" aria-hidden="true" />
        <span>{draft.scheduledTime ?? "Time pending"}</span>
        <span className="text-xs font-semibold text-muted">{draft.timezone}</span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
          <PostFormatIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {draft.mediaTitle || "Untitled post"}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {getScheduleDayListFormatLabel(draft)}
          </p>
        </div>
      </div>

      <Badge variant={getScheduleDayListStatusVariant(draft.status)}>
        {getScheduleStatusLabel(draft.status)}
      </Badge>
    </li>
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
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw
              className={cn("size-3.5", isRendering && "animate-spin")}
              aria-hidden="true"
            />
            {isRendering
              ? "Preparing…"
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
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw
              className={cn("size-3.5", isSchedulingFinal && "animate-spin")}
              aria-hidden="true"
            />
            {isSchedulingFinal ? "Retrying…" : "Retry scheduling"}
          </button>
        ) : null}

        {draft.canEdit ? (
          <button
            type="button"
            onClick={() => onEditDraft(draft)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control border border-border bg-card-muted px-3 text-xs font-bold text-foreground transition hover:border-border-strong hover:bg-card"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </button>
        ) : null}

        {draft.canCancel ? (
          <button
            type="button"
            onClick={() => onCancelDraft(draft)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control border border-error/30 bg-card-muted px-3 text-xs font-bold text-error transition hover:bg-error/10"
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
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
        className="w-full max-w-md rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-floating"
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
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-border text-muted transition hover:bg-card-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={cancelling}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-control border border-border bg-card-muted px-4 text-sm font-bold text-foreground transition hover:border-border-strong hover:bg-card disabled:opacity-50"
          >
            Keep schedule
          </button>
          <button
            type="button"
            disabled={cancelling}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-error px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Ban className="size-4" aria-hidden="true" />
            )}
            {cancelling ? "Cancelling…" : "Cancel schedule"}
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
  const plannedAccounts = (draft.plannedConnectionIds ?? []).flatMap(
    (connectionId) => {
      const label = draft.accountLabelsByConnectionId?.[connectionId];

      return label ? [{ connectionId, label }] : [];
    },
  );

  if (targets.length === 0) {
    return (
      <div
        className={cn(
          "mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted",
          compact && "mt-2",
        )}
      >
        {plannedAccounts.length > 0 ? (
          plannedAccounts.map((account) => (
            <span
              key={account.connectionId}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card-muted px-2.5 py-1"
            >
              <SocialPlatformIcon className="size-3.5" platform="instagram" />
              {account.label}
            </span>
          ))
        ) : draft.platforms.length > 0 ? (
          draft.platforms.map((platform) => (
            <span
              key={platform}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card-muted px-2.5 py-1"
            >
              <SocialPlatformIcon className="size-3.5" platform={platform} />
              {getScheduleDraftPlatformLabel(draft, platform)}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-border bg-card-muted px-2.5 py-1">
            No account selected
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
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
          const accountLabel =
            draft.accountLabelsByConnectionId?.[target.socialConnectionId];

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
                  {accountLabel ? (
                    <span className="truncate text-xs font-semibold text-muted">
                      {accountLabel}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-bold",
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
                  className="inline-flex h-7 w-fit items-center justify-center rounded-full border border-border bg-card-muted px-2.5 text-[11px] font-bold text-foreground transition hover:border-border-strong hover:bg-card"
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
                  href="/settings#instagram-publishing"
                  className="inline-flex h-7 w-fit items-center justify-center rounded-control border border-border bg-card-muted px-2.5 text-[11px] font-bold text-foreground transition hover:border-border-strong hover:bg-card"
                >
                  Reconnect
                </a>
              ) : showPublishRetry && onRetryPublishing ? (
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={() => onRetryPublishing(draft, target)}
                  className="inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-control bg-primary px-2.5 text-[11px] font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw
                    className={cn("size-3.5", isRetrying && "animate-spin")}
                    aria-hidden="true"
                  />
                  {isRetrying ? "Retrying…" : "Retry publishing"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarPlanner({
  calendarMonth,
  drafts,
  onCreateDraftForDate,
  onMonthChange,
  onOpenDate,
  onSelectDate,
  selectedDate,
}: {
  calendarMonth: string;
  drafts: ScheduleDraft[];
  onCreateDraftForDate: (dateKey: string) => void;
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
  const postCount = drafts.filter((draft) => draft.scheduledDate).length;
  const selectedDayDrafts = draftsByDate.get(selectedDate) ?? [];

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

  function selectDate(dateKey: string) {
    const selectedMonth = dateKey.slice(0, 7);

    onSelectDate(dateKey);
    if (selectedMonth !== calendarMonth) {
      onMonthChange(selectedMonth);
    }
  }

  return (
    <div className="flex min-h-[520px] w-full flex-1 flex-col rounded-[var(--radius-panel)] border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">
              {getMonthLabel(calendarMonth)}
            </h2>
            <span className="rounded-full bg-card-muted px-2.5 py-1 text-xs font-bold text-muted ring-1 ring-inset ring-border">
              {postCount} {postCount === 1 ? "post" : "posts"}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            New posts only. Older posts remain available in the history tabs.
          </p>
        </div>

        <div className="inline-flex w-fit items-center rounded-control border border-border bg-card-muted p-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="inline-flex size-8 items-center justify-center rounded-control text-muted transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={jumpToToday}
            className="inline-flex h-8 items-center justify-center rounded-control px-3 text-xs font-bold text-muted transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="inline-flex size-8 items-center justify-center rounded-control text-muted transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-border bg-card sm:block">
          <div
            className="grid grid-cols-7 border-b border-border bg-card-muted"
            aria-hidden="true"
          >
            {calendarWeekdayLabels.map((weekday) => (
              <div
                key={weekday}
                className="px-2 py-2 text-xs font-bold uppercase tracking-normal text-muted"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div
            data-calendar-grid
            className="grid grid-cols-7"
            aria-label={`${getMonthLabel(calendarMonth)} calendar`}
          >
            {monthDays.map((day) => {
              const dayDrafts = draftsByDate.get(day.dateKey) ?? [];

              return (
                <CalendarDayCell
                  key={day.dateKey}
                  day={day}
                  drafts={dayDrafts}
                  selected={day.dateKey === selectedDate}
                  onOpenDate={onOpenDate}
                  onSelectDate={selectDate}
                />
              );
            })}
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-card sm:hidden">
          <div className="grid grid-cols-7 border-b border-border bg-card-muted px-1">
            {calendarWeekdayLabels.map((weekday) => (
              <div
                key={weekday}
                className="py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted"
              >
                {weekday.slice(0, 1)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 p-1.5">
            {monthDays.map((day) => (
              <CompactCalendarDay
                key={day.dateKey}
                day={day}
                draftCount={(draftsByDate.get(day.dateKey) ?? []).length}
                selected={day.dateKey === selectedDate}
                onOpenDate={onOpenDate}
              />
            ))}
          </div>
        </div>

        <SelectedCalendarDayPanel
          drafts={selectedDayDrafts}
          selectedDate={selectedDate}
          onCreateDraftForDate={onCreateDraftForDate}
          onOpenDate={onOpenDate}
        />
      </div>
    </div>
  );
}

const CalendarDayCell = memo(function CalendarDayCell({
  day,
  drafts,
  onOpenDate,
  onSelectDate,
  selected,
}: {
  day: CalendarDay;
  drafts: ScheduleDraft[];
  onOpenDate: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
  selected: boolean;
}) {
  const visibleDrafts = drafts.slice(0, 2);
  const hiddenDraftCount = Math.max(0, drafts.length - visibleDrafts.length);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const dayOffset = getCalendarKeyboardDayOffset(event.key);

    if (dayOffset === null) {
      return;
    }

    event.preventDefault();
    const calendarGrid = event.currentTarget.closest("[data-calendar-grid]");
    const nextDateKey = shiftDateKey(day.dateKey, dayOffset);

    onSelectDate(nextDateKey);
    window.requestAnimationFrame(() => {
      calendarGrid
        ?.querySelector<HTMLButtonElement>(`[data-date-key="${nextDateKey}"]`)
        ?.focus();
    });
  }

  return (
    <button
      type="button"
      data-date-key={day.dateKey}
      tabIndex={selected ? 0 : -1}
      onClick={() => onOpenDate(day.dateKey)}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${getReadableDateLabel(day.dateKey)} day view${drafts.length ? `, ${drafts.length} scheduled` : ""}`}
      className={cn(
        "min-h-[92px] border-b border-r border-border bg-card p-2 text-left transition hover:bg-card-muted focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-focus xl:min-h-[104px]",
        !day.isCurrentMonth && "bg-card-muted/45 text-muted",
        selected && "relative z-10 bg-selected ring-2 ring-primary/35",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-lg text-sm font-bold",
            day.isToday
              ? "bg-brand-soft text-primary"
              : selected
                ? "bg-primary text-primary-foreground"
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
});

function CompactCalendarDay({
  day,
  draftCount,
  onOpenDate,
  selected,
}: {
  day: CalendarDay;
  draftCount: number;
  onOpenDate: (dateKey: string) => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Open ${getReadableDateLabel(day.dateKey)} day view${draftCount ? `, ${draftCount} scheduled` : ""}`}
      onClick={() => onOpenDate(day.dateKey)}
      className={cn(
        "relative flex min-h-11 items-center justify-center rounded-control text-xs font-bold text-foreground transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        !day.isCurrentMonth && "text-muted-subtle",
        day.isToday && !selected && "bg-brand-soft text-primary",
        selected && "bg-primary text-primary-foreground shadow-sm",
      )}
    >
      {day.dayNumber}
      {draftCount > 0 ? (
        <span
          className={cn(
            "absolute bottom-1 size-1 rounded-full",
            selected ? "bg-primary-foreground" : "bg-primary",
          )}
        />
      ) : null}
    </button>
  );
}

function SelectedCalendarDayPanel({
  drafts,
  onCreateDraftForDate,
  onOpenDate,
  selectedDate,
}: {
  drafts: ScheduleDraft[];
  onCreateDraftForDate: (dateKey: string) => void;
  onOpenDate: (dateKey: string) => void;
  selectedDate: string;
}) {
  return (
    <aside className="rounded-[var(--radius-card)] border border-border bg-card-muted p-4 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            Selected day
          </p>
          <h3 className="mt-1 text-base font-bold tracking-[-0.02em] text-foreground">
            {getReadableDateLabel(selectedDate)}
          </h3>
        </div>
        <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-muted ring-1 ring-inset ring-border">
          {drafts.length} {drafts.length === 1 ? "post" : "posts"}
        </span>
      </div>

      {drafts.length > 0 ? (
        <div className="mt-4 space-y-2">
          {drafts.slice(0, 4).map((draft) => (
            <CalendarDraftPill key={draft.id} draft={draft} />
          ))}
          {drafts.length > 4 ? (
            <p className="px-1 text-xs font-semibold text-muted">
              +{drafts.length - 4} more scheduled
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-control border border-dashed border-border bg-card px-3 py-5 text-center">
          <CalendarDays className="mx-auto size-5 text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-foreground">
            No Instagram posts yet
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-muted">
            Add a post to start planning this day.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => onCreateDraftForDate(selectedDate)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Plus className="size-4" aria-hidden="true" />
          Schedule post
        </button>
        <button
          type="button"
          onClick={() => onOpenDate(selectedDate)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          View day
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function CalendarDraftPill({ draft }: { draft: ScheduleDraft }) {
  return (
    <div className="rounded-control border border-border bg-card-muted px-2 py-1.5">
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card"
    >
      <div className="border-b border-border bg-card-muted px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBackToCalendar}
          className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-border-strong hover:bg-card-muted"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to calendar
        </button>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-normal text-muted">
              Day view
            </p>
            <h2
              id="day-schedule-title"
              className="mt-1 text-2xl font-bold tracking-normal text-foreground sm:text-3xl"
            >
              {getReadableDateLabel(selectedDate)}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              {drafts.length} {drafts.length === 1 ? "post" : "posts"} for this
              day.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCreateDraftForDate(selectedDate)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(225_101_64_/_0.18)] transition hover:bg-primary-hover sm:w-fit"
          >
            <Plus className="size-4" aria-hidden="true" />
            Schedule for this day
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
        <div className="grid content-start gap-4">
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
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
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
            <p className="text-sm font-bold text-foreground">What appears here</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted">
              Upcoming posts first, then published posts and other publishing
              statuses for this selected calendar date.
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">
                Posts for this day
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-muted">
                Upcoming posts appear first. Publishing status updates here.
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-card-muted px-3 py-1 text-xs font-bold text-muted ring-1 ring-inset ring-border">
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
              <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-card-muted px-4 py-10 text-center">
                <CalendarPlus
                  className="mx-auto size-8 text-muted"
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
    <article className="rounded-[var(--radius-card)] border border-border bg-card px-3 py-3 transition-colors hover:border-border-strong">
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
            "shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold",
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
        <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-muted">
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
            className="inline-flex h-8 items-center justify-center rounded-control border border-border bg-card-muted px-3 text-xs font-bold text-foreground transition hover:border-border-strong hover:bg-card"
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

function getScheduleDayListDrafts(drafts: ScheduleDraft[], selectedDate: string) {
  return drafts
    .filter((draft) => draft.scheduledDate === selectedDate)
    .sort((first, second) => {
      const timeDifference = (first.scheduledTime ?? "").localeCompare(
        second.scheduledTime ?? "",
      );

      return timeDifference !== 0
        ? timeDifference
        : first.createdAt.localeCompare(second.createdAt);
    });
}

function getScheduleDayListFormatLabel(draft: ScheduleDraft) {
  if (isCarouselDraft(draft)) {
    return "Carousel";
  }

  return isCombinedVideoDraft(draft) ? "Combined video" : "Video";
}

function getScheduleDayListStatusVariant(status: ScheduleDraftStatus) {
  if (status === "published") {
    return "published";
  }

  if (status === "scheduled" || status === "scheduled_preview") {
    return "scheduled";
  }

  if (
    status === "failed" ||
    status === "partially_failed" ||
    status === "cancelled" ||
    status === "render_failed" ||
    status === "publishing_unavailable"
  ) {
    return "failed";
  }

  if (status === "ready") {
    return "ready";
  }

  if (status === "rendering" || status === "scheduling" || status === "publishing") {
    return "rendering";
  }

  return "draft";
}

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
    draftsForDate.sort((first, second) => {
      const statusDifference =
        getCalendarDayDraftSortRank(first) -
        getCalendarDayDraftSortRank(second);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      const timeDifference = (first.scheduledTime ?? "").localeCompare(
        second.scheduledTime ?? "",
      );

      return timeDifference !== 0
        ? timeDifference
        : first.createdAt.localeCompare(second.createdAt);
    });
  }

  return grouped;
}

function getCalendarDayDraftSortRank(draft: ScheduleDraft) {
  if (isUpcomingDraft(draft)) {
    return 0;
  }

  if (draft.status === "published") {
    return 1;
  }

  if (isFailedDraft(draft)) {
    return 2;
  }

  return 3;
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

function shiftDateKey(dateKey: string, dayOffset: number) {
  const date = parseDateKey(dateKey);

  date.setDate(date.getDate() + dayOffset);

  return toDateKey(date);
}

function getCalendarKeyboardDayOffset(key: string) {
  const offsets: Record<string, number> = {
    ArrowDown: 7,
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
  };

  return offsets[key] ?? null;
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
    return "bg-primary";
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
    return "border-success/25 bg-success/10 text-success";
  }

  if (status === "rendering" || status === "scheduling" || status === "publishing") {
    return "border-info/25 bg-info/10 text-info";
  }

  if (status === "scheduled" || status === "scheduled_preview") {
    return "border-accent-purple/25 bg-accent-purple/10 text-accent-purple";
  }

  if (
    status === "failed" ||
    status === "partially_failed" ||
    status === "cancelled" ||
    status === "render_failed" ||
    status === "publishing_unavailable"
  ) {
    return "border-error/25 bg-error/10 text-error";
  }

  return "border-border bg-secondary text-secondary-foreground";
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
    return "border-success/25 bg-success/10 text-success";
  }

  if (status === "publishing" || status === "scheduling") {
    return "border-info/25 bg-info/10 text-info";
  }

  if (status === "scheduled") {
    return "border-accent-purple/25 bg-accent-purple/10 text-accent-purple";
  }

  if (
    status === "action_required" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "skipped"
  ) {
    return "border-error/25 bg-error/10 text-error";
  }

  return "border-border bg-secondary text-secondary-foreground";
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
    return "Creating the GCP Cloud Task for this account.";
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

function getDefaultScheduleSlot(
  selectedDate: string,
  minimumLeadMinutes: number,
  now = Date.now(),
) {
  const currentDate = toDateKey(new Date(now));
  const earliestDate = new Date(
    getEarliestScheduleTimestamp({
      minimumLeadMinutes,
      now,
    }),
  );

  return {
    date:
      selectedDate === currentDate ? toDateKey(earliestDate) : selectedDate,
    time: getTimeKey(earliestDate),
  };
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
  const now = Date.now();
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);
  const finalScheduleStatus = getString(schedule.metadata.finalScheduleStatus);
  const renderQueuedAt = Date.parse(
    getString(schedule.metadata.combinedRenderQueuedAt) ?? schedule.updatedAt,
  );
  const isRecentRender =
    (renderStatus === "queued" || renderStatus === "rendering") &&
    Number.isFinite(renderQueuedAt) &&
    now - renderQueuedAt < ACTIVE_JOB_TIMEOUT_MS;

  const finalScheduleStartedAt = Date.parse(
    getString(schedule.metadata.finalScheduleQueuedAt) ?? schedule.updatedAt,
  );
  const isRecentFinalize =
    ["draft", "scheduling"].includes(schedule.status) &&
    ["finalizing", "scheduling"].includes(finalScheduleStatus ?? "") &&
    Number.isFinite(finalScheduleStartedAt) &&
    now - finalScheduleStartedAt < ACTIVE_JOB_TIMEOUT_MS;

  const hasDuePublishingTarget = schedule.targets.some((target) => {
    if (target.status === "publishing" || target.status === "scheduling") {
      const targetUpdatedAt = Date.parse(target.updatedAt);

      return (
        Number.isFinite(targetUpdatedAt) &&
        now - targetUpdatedAt < ACTIVE_JOB_TIMEOUT_MS
      );
    }

    const scheduledTime = Date.parse(target.scheduledFor);

    return (
      target.status === "scheduled" &&
      Number.isFinite(scheduledTime) &&
      scheduledTime >= now - ACTIVE_SCHEDULE_LOOKBEHIND_MS &&
      scheduledTime <= now + ACTIVE_SCHEDULE_LOOKAHEAD_MS
    );
  });

  return isRecentRender || isRecentFinalize || hasDuePublishingTarget;
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

  const failureMessage = getSchedulePublishFailureMessage(
    data.schedule,
    connectionIds,
  );

  if (failureMessage) {
    throw new SchedulePublishOutcomeError(failureMessage, {
      created: data.created,
      schedule: data.schedule,
    });
  }

  return data;
}

function mapScheduledPostToScheduleDraft(
  schedule: ScheduledPost,
  mediaIssue: ScheduleMediaIssue | null = null,
  socialConnections: SocialConnection[] = [],
): ScheduleDraft {
  const metadata = schedule.metadata;
  const savedPlannedTargets = getSavedPlannedTargets(schedule);
  const plannedConnectionIds = [
    ...new Set([
      ...savedPlannedTargets.map((target) => target.connectionId),
      ...getMetadataCsv(metadata.plannedConnectionIds),
    ]),
  ];
  const relevantConnectionIds = new Set([
    ...schedule.targets.map((target) => target.socialConnectionId),
    ...plannedConnectionIds,
  ]);
  const accountLabelEntries: Array<[string, string]> = socialConnections.flatMap(
    (connection) =>
      relevantConnectionIds.has(connection.id)
        ? [[connection.id, getSocialConnectionAccountLabel(connection)]]
        : [],
  );
  const accountLabelsByConnectionId = Object.fromEntries(accountLabelEntries);
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
    accountLabelsByConnectionId:
      Object.keys(accountLabelsByConnectionId).length > 0
        ? accountLabelsByConnectionId
        : undefined,
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
    plannedConnectionIds,
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
    value === "user_video" ||
    value === "wall_text_render"
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

    if (value === "wall_text_render") {
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
    title: formatCreatorDisplayName(avatar.asset.name),
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
      throw new Error(data?.message ?? "Could not update Trending.");
    }

    return null;
  } catch {
    return "The post is scheduled, but Trending may need a refresh.";
  }
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

function getConfiguredScheduleLeadMinutes(data?: {
  minimumRenderLeadMinutes?: number;
  minimumScheduleLeadMinutes?: number;
}) {
  const value =
    data?.minimumScheduleLeadMinutes ?? data?.minimumRenderLeadMinutes;

  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : null;
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

function getInitialScheduleViewMode(): ScheduleViewMode {
  if (typeof window === "undefined") {
    return "calendar";
  }

  const view = new URLSearchParams(window.location.search).get("view");

  return view === "list" || view === "calendar" ? view : "calendar";
}

function formatAssetDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Duration pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.floor(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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

function areSchedulesEqual(
  first: ScheduledPost[],
  second: ScheduledPost[],
): boolean {
  if (first === second) {
    return true;
  }

  if (first.length !== second.length) {
    return false;
  }

  for (let i = 0; i < first.length; i += 1) {
    const a = first[i]!;
    const b = second[i]!;

    if (
      a.id !== b.id ||
      a.status !== b.status ||
      a.updatedAt !== b.updatedAt ||
      a.scheduledFor !== b.scheduledFor
    ) {
      return false;
    }
  }

  return true;
}
