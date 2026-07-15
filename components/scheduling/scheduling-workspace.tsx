"use client";

import {
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
  RefreshCw,
  UserRound,
  X,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset, MediaSourceType } from "@/lib/media/types";
import {
  getSchedulePlatformLabel,
  getSchedulePostTypeLabel,
  getScheduleStatusLabel,
  schedulePlatforms,
  schedulePostTypes,
  scheduleTabs,
  type ScheduledPost,
  type ScheduledPostTarget,
  type ScheduleDraft,
  type ScheduleDraftStatus,
  type ScheduleMediaOption,
  type SchedulePostType,
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
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

const hookVideoSourceTypes: MediaSourceType[] = [
  "upload",
  "generated_video",
  "edit_export",
];
const demoVideoSourceTypes: MediaSourceType[] = ["demo_upload"];
const openingVideoSourceTabs = [
  { id: "all", label: "All" },
  { id: "influencers", label: "Influencers" },
  { id: "videos", label: "Videos" },
  { id: "edited", label: "Edited" },
] as const;
const requiredInstagramPublishScopes = new Set([
  "instagram_business_content_publish",
  "instagram_content_publish",
]);
const requiredTikTokPublishScopes = new Set(["video.publish"]);
const requiredYouTubePublishScopes = new Set([
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtubepartner",
]);

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

type SocialConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message?: string; ok?: false };

type ScheduleFormSubmission = {
  caption: string;
  demoMedia: ScheduleMediaOption;
  hookMedia: ScheduleMediaOption;
  postType: SchedulePostType;
  scheduledDate: string;
  scheduledFor: string;
  scheduledTime: string;
  selectedConnectionIds: string[];
  timezone: string;
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
  const drafts = useMemo(
    () => serverSchedules.map(mapScheduledPostToScheduleDraft),
    [serverSchedules],
  );
  const [catalogInfluencerOptions, setCatalogInfluencerOptions] = useState<
    ScheduleCatalogInfluencerOption[]
  >([]);
  const [hookMediaOptions, setHookMediaOptions] = useState<ScheduleMediaOption[]>([]);
  const [demoMediaOptions, setDemoMediaOptions] = useState<ScheduleMediaOption[]>([]);
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
  const [schedulingFinalDraftId, setSchedulingFinalDraftId] = useState<
    string | null
  >(null);
  const [renderingScheduleId, setRenderingScheduleId] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [minimumRenderLeadMinutes, setMinimumRenderLeadMinutes] = useState(
    DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
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
          .filter(isDemoVideoMediaAsset)
          .map(mapMediaAssetToScheduleMediaOption),
      );

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
      setActionNotice("Could not load video and demo media for scheduling.");
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
        data.connections.filter((connection) => connection.status === "connected"),
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
  }, [loadScheduleMedia, loadSchedules]);

  const hasActiveCombinationRender = useMemo(
    () => serverSchedules.some(hasActiveCombinationRenderStatus),
    [serverSchedules],
  );

  useEffect(() => {
    if (!hasActiveCombinationRender) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSchedules();
    }, 6000);

    return () => window.clearInterval(timer);
  }, [hasActiveCombinationRender, loadSchedules]);

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

  async function handleNewSchedulePost(
    dateKey = selectedCalendarDate,
    options: { keepDayOpen?: boolean } = {},
  ) {
    setActionNotice(null);
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

  async function handleSaveScheduleDraft(submission: ScheduleFormSubmission) {
    setSavingSchedule(true);
    setActionNotice(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before scheduling posts.");
      }

      const targetConnections = socialConnections.filter((connection) =>
        submission.selectedConnectionIds.includes(connection.id),
      );
      const response = await fetch("/api/schedules", {
        body: JSON.stringify({
          caption: submission.caption,
          metadata: {
            demoMediaId: submission.demoMedia.id,
            demoMediaTitle: submission.demoMedia.title,
            hookMediaId: submission.hookMedia.id,
            hookMediaTitle: submission.hookMedia.title,
            plannedConnectionIds: submission.selectedConnectionIds.join(","),
            plannedPlatforms: targetConnections
              .map((connection) => connection.platform)
              .join(","),
            plannedScheduledFor: submission.scheduledFor,
            scheduledDate: submission.scheduledDate,
            scheduledTime: submission.scheduledTime,
            postType: submission.postType,
          },
          scheduledDate: submission.scheduledDate,
          scheduledFor: submission.scheduledFor,
          scheduledTime: submission.scheduledTime,
          source: {
            id: submission.demoMedia.id,
            kind: "media_asset",
          },
          targets: [],
          timezone: submission.timezone,
          title: getCompositeMediaTitle(
            submission.hookMedia,
            submission.demoMedia,
          ),
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as ScheduleCreateResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          getApiResponseMessage(data, "Could not save this schedule."),
        );
      }

      let nextSchedule = data.schedule;
      const shouldAutoScheduleFinal =
        submission.selectedConnectionIds.length > 0;
      let nextNotice = shouldAutoScheduleFinal
        ? "Schedule saved. Rendering the final MP4 before automatic platform scheduling."
        : "Combination draft saved, but the render did not start automatically.";

      try {
        const renderResult = await queueCombinationRender({
          scheduleId: data.schedule.id,
          token,
        });
        nextSchedule = renderResult.schedule;
        nextNotice = shouldAutoScheduleFinal
          ? renderResult.status === "ready"
            ? "Combined video is ready. Creating the final platform schedule."
            : "Schedule saved. Rendering the final MP4 before automatic platform scheduling."
          : renderResult.status === "ready"
            ? "Combined video is already ready."
            : "Combination draft saved and render queued.";
      } catch (renderError) {
        nextNotice = `Draft saved, but render did not start: ${getErrorMessage(
          renderError,
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
      setActiveTab(nextSchedule.status === "draft" ? "drafts" : "upcoming");
      setViewMode("calendar");
      setDrawerOpen(false);
      setDayPlannerOpen(true);
      setActionNotice(nextNotice);
    } catch (error) {
      setActionNotice(
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
        throw new Error("Sign in before rendering this draft.");
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
          : "Combined video render queued.",
      );
    } catch (error) {
      setActionNotice(getErrorMessage(error, "Could not start the render."));
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

      const response = await fetch(`/api/schedules/${draft.id}/publish`, {
        body: JSON.stringify({
          connectionIds: draft.plannedConnectionIds ?? [],
          timezone: draft.timezone,
        }),
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

  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Scheduling
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Plan video plus demo combinations for upcoming posts.
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
            renderingScheduleId={renderingScheduleId}
            selectedDate={selectedCalendarDate}
            onBackToCalendar={() => setDayPlannerOpen(false)}
            onCreateDraftForDate={(dateKey) =>
              void handleNewSchedulePost(dateKey, { keepDayOpen: true })
            }
            onRenderDraft={handleStartCombinationRender}
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
              schedulingFinalDraftId={schedulingFinalDraftId}
              selectedDate={selectedCalendarDate}
              viewMode={viewMode}
              onCreateDraft={() => void handleNewSchedulePost()}
              onMonthChange={setVisibleCalendarMonth}
              onOpenDate={handleOpenDayPlanner}
              onRenderDraft={handleStartCombinationRender}
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
          hookMediaOptions={hookMediaOptions}
          initialScheduledDate={newScheduleInitialDate}
          initialScheduledTime={getDefaultScheduledTime()}
          minimumRenderLeadMinutes={minimumRenderLeadMinutes}
          onClose={() => setDrawerOpen(false)}
          onRefreshMedia={loadScheduleMedia}
          onSave={handleSaveScheduleDraft}
          saving={savingSchedule}
          socialConnections={socialConnections}
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
              Render first
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#405977]">
            Pair an opening video with a Library demo, render them into one
            MP4, then use that final video for scheduling.
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
  onCreateDraft,
  onMonthChange,
  onOpenDate,
  onRenderDraft,
  onScheduleDraft,
  onSelectDate,
  renderingScheduleId,
  schedulingFinalDraftId,
  selectedDate,
  viewMode,
}: {
  activeTab: ScheduleTab;
  calendarMonth: string;
  drafts: ScheduleDraft[];
  hasAnyDrafts: boolean;
  onCreateDraft: () => void;
  onMonthChange: (monthKey: string) => void;
  onOpenDate: (dateKey: string) => void;
  onRenderDraft: (draftId: string) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
  onSelectDate: (dateKey: string) => void;
  renderingScheduleId: string | null;
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
            onRenderDraft={onRenderDraft}
            onScheduleDraft={onScheduleDraft}
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
  onRenderDraft,
  onScheduleDraft,
}: {
  draft: ScheduleDraft;
  isRendering: boolean;
  isSchedulingFinal: boolean;
  onRenderDraft: (draftId: string) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
}) {
  const { combinedMedia, demoMedia, hookMedia } = getDraftMediaParts(draft);
  const canRender =
    draft.status === "render_required" || draft.status === "render_failed";
  const canScheduleFinal = canScheduleFinalDraft(draft);
  const finalScheduleMessage = getFinalScheduleUnavailableMessage(draft);
  const showFinalScheduleAction = shouldShowFinalScheduleAction(draft);

  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
        <ScheduleDraftMediaThumb label="Opening" media={hookMedia} />
        <span className="flex items-center text-xs font-bold text-muted">+</span>
        <ScheduleDraftMediaThumb label="Demo" media={demoMedia} />
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">
              {draft.mediaTitle || "Combination draft"}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[#405977]">
              {draft.caption || "No caption written yet."}
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

        <ScheduleTargetStatusList draft={draft} />

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
          {canRender ? (
            <button
              type="button"
              onClick={() => onRenderDraft(draft.id)}
              disabled={isRendering}
              className="mt-2 inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRendering ? "Starting render..." : "Render combined video"}
            </button>
          ) : null}
          {showFinalScheduleAction && combinedMedia?.mediaUrl ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => onScheduleDraft(draft)}
                disabled={!canScheduleFinal || isSchedulingFinal}
                className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSchedulingFinal
                  ? "Scheduling..."
                  : draft.status === "ready"
                    ? "Schedule final post"
                    : "Retry scheduling"}
              </button>
              {finalScheduleMessage ? (
                <p className="mt-1 text-[11px] font-semibold leading-4 text-muted">
                  {finalScheduleMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ScheduleTargetStatusList({
  compact = false,
  draft,
}: {
  compact?: boolean;
  draft: ScheduleDraft;
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
              className="rounded-full border border-border bg-white px-2.5 py-1"
            >
              {getSchedulePlatformLabel(platform)}
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
        {targets.map((target) => (
          <div
            key={target.id}
            className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  {getSchedulePlatformLabel(target.platform)}
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
              {target.lastErrorMessage ? (
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-error">
                  {target.lastErrorMessage}
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
            ) : null}
          </div>
        ))}
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
            ? "Your scheduled video and demo posts will appear here after you choose connected accounts, date, and time."
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
  onCreateDraftForDate,
  onRenderDraft,
  onScheduleDraft,
  renderingScheduleId,
  selectedDate,
}: {
  activeTab: ScheduleTab;
  drafts: ScheduleDraft[];
  isSchedulingFinalDraftId: string | null;
  onBackToCalendar: () => void;
  onCreateDraftForDate: (dateKey: string) => void;
  onRenderDraft: (draftId: string) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
  renderingScheduleId: string | null;
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
                  Choose an opening video, choose a Library demo, render one
                  combined MP4, then schedule the final post.
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
              Drafts, rendering jobs, ready combined videos, and scheduled posts
              for this selected calendar date.
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
                Render and publishing status will update here.
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
                  onRenderDraft={onRenderDraft}
                  onScheduleDraft={onScheduleDraft}
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
                  Add a video and demo combination for this day.
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
  onRenderDraft,
  onScheduleDraft,
}: {
  draft: ScheduleDraft;
  isRendering: boolean;
  isSchedulingFinal: boolean;
  onRenderDraft: (draftId: string) => void;
  onScheduleDraft: (draft: ScheduleDraft) => void;
}) {
  const { combinedMedia, demoMedia, hookMedia } = getDraftMediaParts(draft);
  const canRender =
    draft.status === "render_required" || draft.status === "render_failed";
  const canScheduleFinal = canScheduleFinalDraft(draft);
  const finalScheduleMessage = getFinalScheduleUnavailableMessage(draft);
  const showFinalScheduleAction = shouldShowFinalScheduleAction(draft);

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

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs font-bold">
        <span className="truncate rounded-lg bg-card-muted px-2 py-1 text-muted">
          Opening: {hookMedia?.title ?? "Missing"}
        </span>
        <span className="text-muted">+</span>
        <span className="truncate rounded-lg bg-card-muted px-2 py-1 text-muted">
          Demo: {demoMedia?.title ?? "Missing"}
        </span>
      </div>

      {draft.caption ? (
        <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-[#405977]">
          {draft.caption}
        </p>
      ) : null}

      <ScheduleTargetStatusList compact draft={draft} />

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
        {canRender ? (
          <button
            type="button"
            onClick={() => onRenderDraft(draft.id)}
            disabled={isRendering}
            className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRendering ? "Starting..." : "Render"}
          </button>
        ) : null}
        {showFinalScheduleAction && combinedMedia?.mediaUrl ? (
          <button
            type="button"
            onClick={() => onScheduleDraft(draft)}
            disabled={!canScheduleFinal || isSchedulingFinal}
            className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSchedulingFinal
              ? "Scheduling..."
              : draft.status === "ready"
                ? "Schedule final"
                : "Retry scheduling"}
          </button>
        ) : null}
      </div>
      {finalScheduleMessage && showFinalScheduleAction ? (
        <p className="mt-2 text-[11px] font-semibold leading-4 text-muted">
          {finalScheduleMessage}
        </p>
      ) : null}
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

  if (status === "failed" || status === "cancelled" || status === "skipped") {
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
    return target.lastErrorCode
      ? `Failed with ${target.lastErrorCode}.`
      : "Publishing failed for this account.";
  }

  if (target.status === "cancelled") {
    return "This platform target was cancelled.";
  }

  if (target.status === "skipped") {
    return "This platform target was skipped.";
  }

  return "Waiting for final scheduling.";
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
        } from now so the final video has time to render.`,
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
  hookMediaOptions,
  initialScheduledDate,
  initialScheduledTime,
  minimumRenderLeadMinutes,
  onClose,
  onRefreshMedia,
  onSave,
  saving,
  socialConnections,
}: {
  catalogInfluencerOptions: ScheduleCatalogInfluencerOption[];
  demoMediaOptions: ScheduleMediaOption[];
  hookMediaOptions: ScheduleMediaOption[];
  initialScheduledDate: string;
  initialScheduledTime: string;
  minimumRenderLeadMinutes: number;
  onClose: () => void;
  onRefreshMedia: () => Promise<boolean>;
  onSave: (submission: ScheduleFormSubmission) => void;
  saving: boolean;
  socialConnections: SocialConnection[];
}) {
  const [preparedHookMediaOptions, setPreparedHookMediaOptions] =
    useState<ScheduleMediaOption[]>([]);
  const [selectedHookMediaId, setSelectedHookMediaId] = useState<string>(
    hookMediaOptions[0]?.id ?? "",
  );
  const [selectedDemoMediaId, setSelectedDemoMediaId] = useState<string>(
    demoMediaOptions[0]?.id ?? "",
  );
  const [preparingCatalogInfluencerId, setPreparingCatalogInfluencerId] =
    useState<string | null>(null);
  const [refreshingMedia, setRefreshingMedia] = useState(false);
  const [hookPickerError, setHookPickerError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [scheduledTime, setScheduledTime] = useState(initialScheduledTime);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [postType, setPostType] = useState<SchedulePostType>("reel");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const localHookMediaOptions = useMemo(
    () => dedupeScheduleMediaOptions([...preparedHookMediaOptions, ...hookMediaOptions]),
    [hookMediaOptions, preparedHookMediaOptions],
  );

  const activeHookMediaId = localHookMediaOptions.some(
    (option) => option.id === selectedHookMediaId,
  )
    ? selectedHookMediaId
    : localHookMediaOptions[0]?.id ?? "";
  const activeDemoMediaId = demoMediaOptions.some(
    (option) => option.id === selectedDemoMediaId,
  )
    ? selectedDemoMediaId
    : demoMediaOptions[0]?.id ?? "";
  const selectedHookMedia =
    localHookMediaOptions.find((option) => option.id === activeHookMediaId) ?? null;
  const selectedDemoMedia =
    demoMediaOptions.find((option) => option.id === activeDemoMediaId) ?? null;
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
  const status = getDraftStatusPreview({
    demoMedia: selectedDemoMedia,
    hookMedia: selectedHookMedia,
  });
  const canSaveDraft = Boolean(
    selectedHookMedia &&
      selectedDemoMedia &&
      scheduledDate &&
      scheduledTime &&
      !scheduleTimeValidation.error &&
      !saving,
  );
  const hasSelectedConnections = selectedConnectionIds.length > 0;

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
    setSelectedConnectionIds((currentConnectionIds) =>
      currentConnectionIds.includes(connectionId)
        ? currentConnectionIds.filter((currentId) => currentId !== connectionId)
        : [...currentConnectionIds, connectionId],
    );
  }

  function handleSelectHookMedia(mediaId: string) {
    setHookPickerError(null);
    setSelectedHookMediaId(mediaId);
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
      !selectedHookMedia ||
      !selectedDemoMedia ||
      !scheduleTimeValidation.scheduledFor ||
      scheduleTimeValidation.error
    ) {
      return;
    }

    onSave({
      caption,
      demoMedia: selectedDemoMedia,
      hookMedia: selectedHookMedia,
      postType,
      scheduledDate,
      scheduledFor: scheduleTimeValidation.scheduledFor,
      scheduledTime,
      selectedConnectionIds,
      timezone,
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
        aria-labelledby="new-schedule-drawer-title"
        className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-none border border-border bg-[#fbf8f4] shadow-[0_26px_90px_rgb(16_32_51_/_0.22)] sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/80 bg-white/72 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <h2
              id="new-schedule-drawer-title"
              className="text-lg font-bold tracking-normal text-foreground"
            >
              New schedule draft
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Choose the video, demo, date, and time for this planned post.
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <div className="grid content-start gap-5">
              <div className="grid gap-3">
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
                <ScheduleRoleMediaPicker
                  description="Product demo from the Library demo section."
                  emptyDescription="Upload a demo from Library before scheduling."
                  emptyTitle="No demo videos found."
                  icon={<FileVideo className="size-4" aria-hidden="true" />}
                  mediaOptions={demoMediaOptions}
                  selectedMediaId={activeDemoMediaId}
                  title="Demo video"
                  onSelectMedia={setSelectedDemoMediaId}
                />
              </div>

              <CompositionPreview
                demoMedia={selectedDemoMedia}
                hookMedia={selectedHookMedia}
              />
            </div>

            <div className="grid content-start gap-5">
              <label className="block">
                <span className="text-sm font-bold text-foreground">Caption</span>
                <textarea
                  rows={5}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Write caption..."
                  className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-[#8c9aab] focus:border-primary"
                />
              </label>

              <ConnectedAccountSelector
                connections={socialConnections}
                onToggle={toggleConnection}
                selectedConnectionIds={selectedConnectionIds}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-foreground">Date</span>
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
                    className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-foreground">Time</span>
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
                    className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-foreground">Timezone</span>
                <select
                  aria-describedby={
                    scheduleTimeValidation.error
                      ? "schedule-time-feedback"
                      : undefined
                  }
                  aria-invalid={Boolean(scheduleTimeValidation.error)}
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
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
                  className="flex items-start gap-2 rounded-xl bg-error/10 px-3 py-2 text-xs font-semibold leading-5 text-error"
                >
                  <Clock3
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{scheduleTimeValidation.error}</span>
                </div>
              ) : null}

              <PostTypeSelector value={postType} onChange={setPostType} />

              <StatusPreview
                demoMedia={selectedDemoMedia}
                hookMedia={selectedHookMedia}
                status={status}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/80 bg-white/72 px-5 py-4 backdrop-blur sm:px-6">
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
                : "Saving..."
              : canSaveDraft
                ? hasSelectedConnections
                  ? "Schedule post"
                  : "Save render draft"
                : selectedHookMedia && selectedDemoMedia
                  ? "Choose date and time"
                  : "Choose video and demo"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold leading-5 text-muted">
            {hasSelectedConnections
              ? "This renders one combined MP4 first, then schedules it automatically when ready."
              : "Choose an account to schedule automatically, or save a render draft without publishing."}
          </p>
        </div>
      </aside>
    </div>
  );
}

type OpeningVideoSourceTab = (typeof openingVideoSourceTabs)[number]["id"];

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
            <p className="text-sm font-bold text-foreground">Opening video</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-muted">
              Choose from influencers, videos, or Edit exports.
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
        aria-label="Choose opening video source"
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
  demoMedia,
  hookMedia,
}: {
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Combined post</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            Opening video starts the post. Demo follows as product proof.
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#173454] text-white">
          <Layers2 className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <CompositionSlot label="Opening" media={hookMedia} />
        <span className="text-xs font-bold text-muted">+</span>
        <CompositionSlot label="Demo" media={demoMedia} />
      </div>
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
            const unavailableMessage = getConnectionPublishUnavailableMessage(connection);
            const unavailable = Boolean(unavailableMessage);

            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => onToggle(connection.id)}
                disabled={unavailable}
                className={cn(
                  "rounded-2xl border bg-white px-3 py-3 text-left shadow-sm transition hover:bg-[#fffaf6]",
                  selected
                    ? "border-primary/60 ring-2 ring-primary/15"
                    : "border-border",
                  unavailable &&
                    "cursor-not-allowed bg-card-muted/70 opacity-70 hover:bg-card-muted/70",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {getSchedulePlatformLabel(connection.platform)}
                  </span>
                  {selected ? (
                    <CheckCircle2
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold leading-5 text-muted">
                  {connection.platformAccountUsername ||
                    connection.platformAccountName ||
                    connection.platformAccountId}
                </span>
                {unavailableMessage ? (
                  <span className="mt-2 block text-[11px] font-semibold leading-4 text-error">
                    {unavailableMessage}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 rounded-2xl border border-dashed border-border bg-[#fffaf6] px-4 py-4 text-sm font-semibold leading-6 text-muted">
          Connect Instagram, TikTok, or YouTube later. You can save the
          combination draft now.
        </div>
      )}
    </div>
  );
}

function PostTypeSelector({
  onChange,
  value,
}: {
  onChange: (postType: SchedulePostType) => void;
  value: SchedulePostType;
}) {
  return (
    <div>
      <span className="text-sm font-bold text-foreground">Post type</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {schedulePostTypes.map((postType) => {
          const selected = postType === value;

          return (
            <button
              key={postType}
              type="button"
              onClick={() => onChange(postType)}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-bold transition",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-white text-[#405977] hover:bg-[#fff8f4]",
              )}
            >
              {getSchedulePostTypeLabel(postType)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusPreview({
  demoMedia,
  hookMedia,
  status,
}: {
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
  status: ScheduleDraftStatus;
}) {
  const message =
    hookMedia && demoMedia
      ? "We render one combined MP4 first, then schedule it automatically."
      : "Choose one opening video and one demo video before saving.";

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

function getConnectionPublishUnavailableMessage(connection: SocialConnection) {
  if (connection.status !== "connected") {
    return "Reconnect this account before scheduling.";
  }

  if (connection.platform === "instagram") {
    return connection.scopes.some((scope) =>
      requiredInstagramPublishScopes.has(scope),
    )
      ? null
      : "Reconnect with Instagram publishing permission.";
  }

  if (connection.platform === "tiktok") {
    return connection.scopes.some((scope) => requiredTikTokPublishScopes.has(scope))
      ? null
      : "Reconnect with TikTok video.publish permission.";
  }

  if (connection.platform === "youtube") {
    return connection.scopes.some((scope) => requiredYouTubePublishScopes.has(scope))
      ? null
      : "Reconnect with YouTube upload permission.";
  }

  return null;
}

function getTabDescription(tab: ScheduleTab) {
  const descriptions: Record<ScheduleTab, string> = {
    drafts: "Saved combinations that still need a date, render, or final schedule.",
    failed: "Posts that need attention before they can publish successfully.",
    published: "Completed posts with platform results and links.",
    upcoming: "Planned posts moving from render to schedule to publish.",
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
    return "Final combined video is scheduled. Publishing will run at the planned time.";
  }

  if (draft.status === "scheduling") {
    return "Creating platform schedules for this final video.";
  }

  if (draft.status === "partially_failed") {
    return "Some platforms failed. Check the platform status rows below.";
  }

  if (draft.status === "failed" || draft.status === "publishing_unavailable") {
    if (draft.status === "publishing_unavailable") {
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
    return hasPlannedFinalSchedule(draft)
      ? "Combined MP4 is ready. Creating the final platform schedule automatically."
      : "Combined MP4 is ready for final scheduling.";
  }

  if (draft.status === "render_failed") {
    return "The combined render failed. Retry the render before scheduling.";
  }

  if (draft.status === "rendering") {
    return hasPlannedFinalSchedule(draft)
      ? "Opening video and demo are being combined. Final scheduling starts automatically after render."
      : "Opening video and demo are being combined into one MP4.";
  }

  if (draft.status === "render_required") {
    return "Render the opening video and demo into one MP4 before publishing.";
  }

  if (draft.status === "media_required") {
    return "Choose one opening video and one demo video before rendering.";
  }

  return "Save a video and demo pair before rendering.";
}

function canScheduleFinalDraft(draft: ScheduleDraft) {
  return Boolean(
    (draft.status === "ready" ||
      draft.status === "publishing_unavailable" ||
      canRetrySchedulerCreateFailure(draft)) &&
      draft.combinedMedia?.mediaUrl &&
      hasPlannedFinalSchedule(draft) &&
      !hasScheduleLeadTimeError(draft),
  );
}

function shouldShowFinalScheduleAction(draft: ScheduleDraft) {
  return (
    draft.status === "ready" ||
    draft.status === "publishing_unavailable" ||
    canRetrySchedulerCreateFailure(draft)
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

function hasActiveCombinationRenderStatus(schedule: ScheduledPost) {
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);
  const finalScheduleStatus = getString(schedule.metadata.finalScheduleStatus);

  return (
    renderStatus === "queued" ||
    renderStatus === "rendering" ||
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
      getApiResponseMessage(data, "Could not queue the combined render."),
    );
  }

  return data;
}

function mapScheduledPostToScheduleDraft(schedule: ScheduledPost): ScheduleDraft {
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
    id: metadata.demoMediaId ?? schedule.mediaAssetId,
    sourceType: "demo_video",
    title: metadata.demoMediaTitle ?? schedule.title,
  });
  const combinedMedia = getMetadataMediaOption({
    id: metadata.combinedMediaAssetId,
    mediaUrl: metadata.combinedVideoUrl,
    sourceType: "combined_video",
    title: `${schedule.title} final`,
  });

  return {
    caption: schedule.caption,
    combinedMedia,
    createdAt: schedule.createdAt,
    demoMedia,
    finalScheduleError: getString(metadata.finalScheduleError) ?? undefined,
    finalScheduleErrorCode:
      getString(metadata.finalScheduleErrorCode) ?? undefined,
    hookMedia,
    id: schedule.id,
    mediaTitle: schedule.title,
    plannedConnectionIds: getMetadataCsv(metadata.plannedConnectionIds),
    plannedScheduledFor: plannedScheduledFor ?? undefined,
    platforms: getDraftPlatformsFromSchedule(schedule),
    postType:
      typeof metadata.postType === "string" &&
      schedulePostTypes.includes(metadata.postType as SchedulePostType)
        ? (metadata.postType as SchedulePostType)
        : undefined,
    scheduledDate,
    scheduledTime,
    sourceId: schedule.mediaAssetId ?? schedule.libraryItemId ?? undefined,
    sourceType:
      combinedMedia
        ? "combined_video"
        : schedule.sourceKind === "library_item"
          ? "generated_carousel"
          : "demo_video",
    status: getDraftStatusFromScheduledPost(schedule),
    targets: schedule.targets,
    timezone: schedule.timezone,
    updatedAt: schedule.updatedAt,
  };
}

function getDraftStatusFromScheduledPost(
  schedule: ScheduledPost,
): ScheduleDraftStatus {
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);
  const finalScheduleStatus = getString(schedule.metadata.finalScheduleStatus);

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

function getDraftMediaParts(draft: ScheduleDraft): {
  combinedMedia: ScheduleMediaOption | null;
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
} {
  const combinedMedia = draft.combinedMedia ?? null;
  let demoMedia = draft.demoMedia ?? null;
  let hookMedia = draft.hookMedia ?? null;
  const legacyMedia = getLegacyDraftMedia(draft);

  if (legacyMedia?.sourceType === "demo_video" && !demoMedia) {
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

function isDemoVideoMediaAsset(asset: MediaAsset) {
  return demoVideoSourceTypes.includes(asset.sourceType);
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
    demo_video: "Demo video",
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
    title: "No opening videos found.",
  };
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
}: {
  demoMedia: ScheduleMediaOption | null;
  hookMedia: ScheduleMediaOption | null;
}): ScheduleDraftStatus {
  if (!hookMedia || !demoMedia) {
    return "media_required";
  }

  return "render_required";
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
