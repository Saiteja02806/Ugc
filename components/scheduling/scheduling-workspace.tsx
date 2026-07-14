"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileVideo,
  Images,
  Info,
  Layers2,
  List,
  Plus,
  UserRound,
  X,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import {
  getSchedulePlatformLabel,
  getSchedulePostTypeLabel,
  getScheduleStatusLabel,
  schedulePlatforms,
  schedulePostTypes,
  scheduleTabs,
  type ScheduledPost,
  type ScheduleDraft,
  type ScheduleDraftStatus,
  type ScheduleMediaOption,
  type SchedulePostType,
  type ScheduleTab,
  type ScheduleViewMode,
} from "@/lib/scheduling/types";
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

const hookVideoSourceTypes = ["upload", "generated_video", "edit_export"];
const demoVideoSourceTypes = ["demo_upload"];

type MediaListResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

type ScheduleListResponse =
  | { ok: true; schedules: ScheduledPost[] }
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

type SocialConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message?: string; ok?: false };

type ScheduleFormSubmission = {
  caption: string;
  demoMedia: ScheduleMediaOption;
  hookMedia: ScheduleMediaOption;
  postType: SchedulePostType;
  scheduledDate: string;
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
  const [hookMediaOptions, setHookMediaOptions] = useState<ScheduleMediaOption[]>([]);
  const [demoMediaOptions, setDemoMediaOptions] = useState<ScheduleMediaOption[]>([]);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [activeTab, setActiveTab] = useState<ScheduleTab>(getInitialScheduleTab);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("list");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renderingScheduleId, setRenderingScheduleId] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const loadScheduleMedia = useCallback(async () => {
    try {
      const token = await getCurrentUserIdToken();
      if (!token) return;

      const [influencerResponse, hookResponse, demoResponse] = await Promise.all([
        fetch("/api/media?collection=influencer", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `/api/media?collection=video&sourceTypes=${hookVideoSourceTypes.join(",")}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
        fetch(
          `/api/media?collection=video&sourceTypes=${demoVideoSourceTypes.join(",")}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      ]);
      const [influencerData, hookData, demoData] = (await Promise.all([
        influencerResponse.json(),
        hookResponse.json(),
        demoResponse.json(),
      ])) as [MediaListResponse, MediaListResponse, MediaListResponse];

      if (
        !influencerResponse.ok ||
        influencerData.ok !== true ||
        !hookResponse.ok ||
        hookData.ok !== true ||
        !demoResponse.ok ||
        demoData.ok !== true
      ) {
        throw new Error("Could not load scheduling media.");
      }

      setHookMediaOptions(
        dedupeScheduleMediaOptions([
          ...influencerData.assets.map(mapMediaAssetToScheduleMediaOption),
          ...hookData.assets.map(mapMediaAssetToScheduleMediaOption),
        ]),
      );
      setDemoMediaOptions(
        demoData.assets.map(mapMediaAssetToScheduleMediaOption),
      );
    } catch {
      setActionNotice("Could not load hook and demo media for scheduling.");
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
  function handleNewSchedulePost() {
    setActionNotice(null);
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

      const scheduledFor = getScheduledForIso(
        submission.scheduledDate,
        submission.scheduledTime,
      );
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
            plannedPlatforms: targetConnections
              .map((connection) => connection.platform)
              .join(","),
            scheduledDate: submission.scheduledDate,
            scheduledTime: submission.scheduledTime,
            postType: submission.postType,
          },
          scheduledFor,
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
      let nextNotice =
        "Combination draft saved, but the render did not start automatically.";

      try {
        const renderResult = await queueCombinationRender({
          scheduleId: data.schedule.id,
          token,
        });
        nextSchedule = renderResult.schedule;
        nextNotice =
          renderResult.status === "ready"
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
      setActiveTab(nextSchedule.status === "draft" ? "drafts" : "upcoming");
      setViewMode("list");
      setDrawerOpen(false);
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

  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Scheduling
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Plan hook plus demo combinations for upcoming posts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewSchedulePost}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          New scheduled post
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 pt-5">
        <ConnectionNotice />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ScheduleTabs
            activeTab={activeTab}
            counts={counts}
            onChange={setActiveTab}
          />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {actionNotice ? (
          <div className="w-fit rounded-full border border-border bg-white/85 px-3 py-2 text-xs font-semibold text-[#405977] shadow-sm">
            {actionNotice}
          </div>
        ) : null}

        <ScheduleContent
          activeTab={activeTab}
          drafts={visibleDrafts}
          hasAnyDrafts={drafts.length > 0}
          renderingScheduleId={renderingScheduleId}
          viewMode={viewMode}
          onCreateDraft={handleNewSchedulePost}
          onRenderDraft={handleStartCombinationRender}
        />
      </div>

      {drawerOpen ? (
        <NewScheduleDrawer
          demoMediaOptions={demoMediaOptions}
          hookMediaOptions={hookMediaOptions}
          onClose={() => setDrawerOpen(false)}
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
    <div className="overflow-hidden rounded-[24px] border border-border/80 bg-white/74 p-4 shadow-[0_18px_50px_rgb(16_32_51_/_0.08)] backdrop-blur sm:p-5">
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
            Pair an influencer hook with a Library demo, render them into one
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
  drafts,
  hasAnyDrafts,
  onCreateDraft,
  onRenderDraft,
  renderingScheduleId,
  viewMode,
}: {
  activeTab: ScheduleTab;
  drafts: ScheduleDraft[];
  hasAnyDrafts: boolean;
  onCreateDraft: () => void;
  onRenderDraft: (draftId: string) => void;
  renderingScheduleId: string | null;
  viewMode: ScheduleViewMode;
}) {
  if (viewMode === "calendar") {
    return <CalendarPreview drafts={drafts} />;
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
            Hook and demo plans waiting for a combined render.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
          {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
        </span>
      </div>

      <div className="grid auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-1 xl:grid-cols-2">
        {drafts.map((draft) => (
          <ScheduleDraftPreview
            key={draft.id}
            draft={draft}
            isRendering={renderingScheduleId === draft.id}
            onRenderDraft={onRenderDraft}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleDraftPreview({
  draft,
  isRendering,
  onRenderDraft,
}: {
  draft: ScheduleDraft;
  isRendering: boolean;
  onRenderDraft: (draftId: string) => void;
}) {
  const { combinedMedia, demoMedia, hookMedia } = getDraftMediaParts(draft);
  const canRender = draft.status === "render_required";

  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
        <ScheduleDraftMediaThumb label="Hook" media={hookMedia} />
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
          <span className="shrink-0 rounded-full bg-card-muted px-2 py-1 text-[11px] font-bold text-muted">
            {getScheduleStatusLabel(draft.status)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted">
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
              No platform selected
            </span>
          )}
        </div>

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
          ) : canRender ? (
            <button
              type="button"
              onClick={() => onRenderDraft(draft.id)}
              disabled={isRendering}
              className="mt-2 inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRendering ? "Starting render..." : "Render combined video"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
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
            ? "Your scheduled hook and demo posts will appear here after you choose connected accounts, date, and time."
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

function CalendarPreview({ drafts }: { drafts: ScheduleDraft[] }) {
  const days = useMemo(() => getCalendarDays(drafts), [drafts]);
  const draftsByDate = useMemo(() => groupDraftsByDate(drafts), [drafts]);
  const plannedCount = drafts.filter((draft) => draft.scheduledDate).length;

  return (
    <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-white/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Calendar</h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            Drafts appear on the date selected in the schedule drawer.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
          {plannedCount} planned
        </span>
      </div>

      <div className="grid min-h-[260px] flex-1 grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((day) => {
          const dayDrafts = draftsByDate.get(day.dateKey) ?? [];

          return (
            <div
              key={day.dateKey}
              className="rounded-2xl border border-border bg-white/75 p-3 shadow-sm"
            >
              <div>
                <p className="text-xs font-bold text-muted">{day.weekday}</p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {day.label}
                </p>
              </div>

              <div className="mt-4 min-h-[150px] space-y-2">
                {dayDrafts.length > 0 ? (
                  dayDrafts.map((draft) => (
                    <CalendarDraftPill key={draft.id} draft={draft} />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-[#fffaf6] px-3 py-5 text-center text-xs font-semibold leading-5 text-muted">
                    No post
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarDraftPill({ draft }: { draft: ScheduleDraft }) {
  const { demoMedia, hookMedia } = getDraftMediaParts(draft);
  const combinationLabel = `${hookMedia?.title ?? "Missing hook"} + ${
    demoMedia?.title ?? "Missing demo"
  }`;

  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold text-foreground">
          {draft.mediaTitle || "Combination draft"}
        </p>
        <span className="shrink-0 text-[11px] font-bold text-primary">
          {draft.scheduledTime || "--:--"}
        </span>
      </div>
      <p className="mt-1 truncate text-[11px] font-semibold text-muted">
        {combinationLabel}
      </p>
      <p className="mt-1 text-[11px] font-bold text-muted">
        {getScheduleStatusLabel(draft.status)}
      </p>
    </div>
  );
}

function getCalendarDays(drafts: ScheduleDraft[]) {
  const firstPlannedDate =
    drafts
      .map((draft) => draft.scheduledDate)
      .filter((date): date is string => Boolean(date))
      .sort()[0] ?? null;
  const baseDate = firstPlannedDate ? parseDateKey(firstPlannedDate) : new Date();
  const weekStart = getWeekStart(baseDate);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    return {
      dateKey: toDateKey(date),
      label: new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
      }).format(date),
      weekday: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
      }).format(date),
    };
  });
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
    draftsForDate.sort((first, second) =>
      (first.scheduledTime ?? "").localeCompare(second.scheduledTime ?? ""),
    );
  }

  return grouped;
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
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

function getScheduledForIso(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const scheduledAt = new Date(`${date}T${time}:00`);

  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt.toISOString();
}

function NewScheduleDrawer({
  demoMediaOptions,
  hookMediaOptions,
  onClose,
  onSave,
  saving,
  socialConnections,
}: {
  demoMediaOptions: ScheduleMediaOption[];
  hookMediaOptions: ScheduleMediaOption[];
  onClose: () => void;
  onSave: (submission: ScheduleFormSubmission) => void;
  saving: boolean;
  socialConnections: SocialConnection[];
}) {
  const [selectedHookMediaId, setSelectedHookMediaId] = useState<string>(
    hookMediaOptions[0]?.id ?? "",
  );
  const [selectedDemoMediaId, setSelectedDemoMediaId] = useState<string>(
    demoMediaOptions[0]?.id ?? "",
  );
  const [caption, setCaption] = useState("");
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [postType, setPostType] = useState<SchedulePostType>("reel");

  const activeHookMediaId = hookMediaOptions.some(
    (option) => option.id === selectedHookMediaId,
  )
    ? selectedHookMediaId
    : hookMediaOptions[0]?.id ?? "";
  const activeDemoMediaId = demoMediaOptions.some(
    (option) => option.id === selectedDemoMediaId,
  )
    ? selectedDemoMediaId
    : demoMediaOptions[0]?.id ?? "";
  const selectedHookMedia =
    hookMediaOptions.find((option) => option.id === activeHookMediaId) ?? null;
  const selectedDemoMedia =
    demoMediaOptions.find((option) => option.id === activeDemoMediaId) ?? null;
  const status = getDraftStatusPreview({
    demoMedia: selectedDemoMedia,
    hookMedia: selectedHookMedia,
  });
  const canSaveDraft = Boolean(
    selectedHookMedia && selectedDemoMedia && !saving,
  );

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

  function handleSaveDraft() {
    if (!selectedHookMedia || !selectedDemoMedia) {
      return;
    }

    onSave({
      caption,
      demoMedia: selectedDemoMedia,
      hookMedia: selectedHookMedia,
      postType,
      scheduledDate,
      scheduledTime,
      selectedConnectionIds,
      timezone,
    });
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex justify-end bg-[#071a33]/28 p-3 backdrop-blur-sm sm:p-4"
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
        className="flex h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-border bg-[#fbf8f4] shadow-[0_26px_90px_rgb(16_32_51_/_0.22)]"
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
              Choose the hook, choose the demo, then save the render-ready plan.
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-3">
            <ScheduleRoleMediaPicker
              description="Influencer, generated hook, or uploaded hook video."
              emptyDescription="Upload an influencer clip or generate a hook video before scheduling."
              emptyTitle="No hook videos found."
              icon={<UserRound className="size-4" aria-hidden="true" />}
              mediaOptions={hookMediaOptions}
              selectedMediaId={activeHookMediaId}
              title="Hook / influencer video"
              onSelectMedia={setSelectedHookMediaId}
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
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-foreground">Time</span>
              <input
                type="time"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-foreground">Timezone</span>
            <select
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

          <PostTypeSelector value={postType} onChange={setPostType} />

          <StatusPreview
            demoMedia={selectedDemoMedia}
            hookMedia={selectedHookMedia}
            status={status}
          />
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
              ? "Saving..."
              : canSaveDraft
                ? "Save and render combination"
                : "Choose hook and demo"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold leading-5 text-muted">
            This saves the plan and queues one combined MP4. Real publishing
            starts after that render is ready.
          </p>
        </div>
      </aside>
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
          {mediaOptions.map((option) => {
            const selected = option.id === selectedMediaId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectMedia(option.id)}
                className={cn(
                  "grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-white p-2 text-left transition hover:bg-[#fffaf6]",
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
          })}
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
            Hook opens the post. Demo follows as product proof.
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#173454] text-white">
          <Layers2 className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <CompositionSlot label="Hook" media={hookMedia} />
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

            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => onToggle(connection.id)}
                className={cn(
                  "rounded-2xl border bg-white px-3 py-3 text-left shadow-sm transition hover:bg-[#fffaf6]",
                  selected
                    ? "border-primary/60 ring-2 ring-primary/15"
                    : "border-border",
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
      ? "The selected videos need a combined render before publishing."
      : "Choose one hook video and one demo video before saving.";

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

function getTabCounts(drafts: ScheduleDraft[]): Record<ScheduleTab, number> {
  return {
    drafts: drafts.filter((draft) => draft.status === "draft").length,
    failed: drafts.filter((draft) => draft.status === "publishing_unavailable")
      .length,
    published: 0,
    upcoming: drafts.filter((draft) => isUpcomingDraft(draft)).length,
  };
}

function filterDraftsByTab(drafts: ScheduleDraft[], tab: ScheduleTab) {
  if (tab === "upcoming") {
    return drafts.filter((draft) => isUpcomingDraft(draft));
  }

  if (tab === "drafts") {
    return drafts.filter((draft) => draft.status === "draft");
  }

  if (tab === "failed") {
    return drafts.filter((draft) => draft.status === "publishing_unavailable");
  }

  return [];
}

function isUpcomingDraft(draft: ScheduleDraft) {
  return Boolean(
    draft.scheduledDate &&
      draft.scheduledTime &&
      draft.status !== "publishing_unavailable",
  );
}

function getDraftTimeLabel(draft: ScheduleDraft) {
  if (!draft.scheduledDate || !draft.scheduledTime) {
    return "Date and time not selected";
  }

  return `${draft.scheduledDate}, ${draft.scheduledTime} ${draft.timezone}`;
}

function getDraftRenderMessage(draft: ScheduleDraft) {
  if (draft.status === "ready") {
    return "Combined MP4 is ready for the next scheduling step.";
  }

  if (draft.status === "rendering") {
    return "Hook and demo are being combined into one MP4.";
  }

  if (draft.status === "render_required") {
    return "Render the hook and demo into one MP4 before publishing.";
  }

  if (draft.status === "media_required") {
    return "Choose one hook video and one demo video before rendering.";
  }

  return "Save a hook and demo pair before rendering.";
}

function hasActiveCombinationRenderStatus(schedule: ScheduledPost) {
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);

  return renderStatus === "queued" || renderStatus === "rendering";
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
  const scheduledDate = schedule.scheduledFor
    ? toDateKey(new Date(schedule.scheduledFor))
    : plannedScheduledDate;
  const scheduledTime = schedule.scheduledFor
    ? getTimeKey(new Date(schedule.scheduledFor))
    : plannedScheduledTime;
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
    hookMedia,
    id: schedule.id,
    mediaTitle: schedule.title,
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
    timezone: schedule.timezone,
    updatedAt: schedule.updatedAt,
  };
}

function getDraftStatusFromScheduledPost(
  schedule: ScheduledPost,
): ScheduleDraftStatus {
  const renderStatus = getString(schedule.metadata.combinedRenderStatus);

  if (renderStatus === "queued" || renderStatus === "rendering") {
    return "rendering";
  }

  if (renderStatus === "ready") {
    return "ready";
  }

  if (renderStatus === "failed") {
    return "render_required";
  }

  if (schedule.metadata.hookMediaId && schedule.metadata.demoMediaId) {
    return "render_required";
  }

  if (schedule.status === "draft") {
    return "draft";
  }

  if (
    schedule.status === "failed" ||
    schedule.status === "partially_failed" ||
    schedule.status === "cancelled"
  ) {
    return "publishing_unavailable";
  }

  return "scheduled_preview";
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
    sourceType: getScheduleSourceTypeFromMediaAsset(asset),
    status: asset.url ? "ready" : "missing_render",
    thumbnailUrl: asset.thumbnailUrl ?? undefined,
    title: asset.title,
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
    influencer_video: "Influencer video",
    user_video: "Uploaded hook",
  };

  return sourceLabels[option.sourceType];
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

  return typeof message === "string" && message.trim() ? message : fallback;
}

function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
