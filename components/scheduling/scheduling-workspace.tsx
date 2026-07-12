"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileVideo,
  Images,
  Info,
  List,
  Plus,
  X,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  formatVideoDuration,
  getEditableVideos,
  listenToEditableVideoLibrary,
  type EditableVideo,
} from "@/lib/edit/video-library";
import {
  createScheduleDraft,
  getScheduleDrafts,
  listenToScheduleDrafts,
  saveScheduleDraft,
} from "@/lib/scheduling/local-storage";
import {
  getSchedulePlatformLabel,
  getSchedulePostTypeLabel,
  getScheduleStatusLabel,
  schedulePlatforms,
  schedulePostTypes,
  scheduleTabs,
  type ScheduleDraft,
  type ScheduleDraftStatus,
  type ScheduleMediaOption,
  type SchedulePlatform,
  type SchedulePostType,
  type ScheduleTab,
  type ScheduleViewMode,
} from "@/lib/scheduling/types";
import { cn } from "@/lib/utils";

const emptyScheduleDrafts: ScheduleDraft[] = [];
const emptyEditableVideos: EditableVideo[] = [];

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
  const drafts = useSyncExternalStore(
    subscribeToScheduleDrafts,
    getScheduleDrafts,
    getEmptyScheduleDrafts,
  );
  const editableVideos = useSyncExternalStore(
    subscribeToEditableVideoLibrary,
    getEditableVideos,
    getEmptyEditableVideos,
  );
  const [activeTab, setActiveTab] = useState<ScheduleTab>(getInitialScheduleTab);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("list");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const counts = useMemo(() => getTabCounts(drafts), [drafts]);
  const visibleDrafts = useMemo(
    () => filterDraftsByTab(drafts, activeTab),
    [activeTab, drafts],
  );
  const mediaOptions = useMemo(
    () => editableVideos.map(mapEditableVideoToScheduleMediaOption),
    [editableVideos],
  );

  function handleNewSchedulePost() {
    setActionNotice(null);
    setDrawerOpen(true);
  }

  function handleSaveScheduleDraft(draft: ScheduleDraft) {
    saveScheduleDraft(draft);
    setActiveTab(draft.scheduledDate && draft.scheduledTime ? "upcoming" : "drafts");
    setViewMode("list");
    setDrawerOpen(false);
    setActionNotice(
      "Schedule draft saved locally. Real publishing will be connected later.",
    );
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Scheduling
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Plan and organize your upcoming posts.
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
          viewMode={viewMode}
          onCreateDraft={handleNewSchedulePost}
        />
      </div>

      {drawerOpen ? (
        <NewScheduleDrawer
          mediaOptions={mediaOptions}
          onClose={() => setDrawerOpen(false)}
          onSave={handleSaveScheduleDraft}
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
              Social publishing is not connected yet.
            </h2>
            <span className="rounded-full bg-card-muted px-2.5 py-1 text-xs font-bold text-[#8a4b39]">
              Frontend preview
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#405977]">
            You can design and preview the scheduling workflow here. Real
            publishing will be enabled after Instagram, TikTok, and YouTube
            integrations are connected.
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
  viewMode,
}: {
  activeTab: ScheduleTab;
  drafts: ScheduleDraft[];
  hasAnyDrafts: boolean;
  onCreateDraft: () => void;
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
            Local frontend drafts only. Real publishing is not active.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
          {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
        </span>
      </div>

      <div className="grid auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-1 xl:grid-cols-2">
        {drafts.map((draft) => (
          <ScheduleDraftPreview key={draft.id} draft={draft} />
        ))}
      </div>
    </div>
  );
}

function ScheduleDraftPreview({ draft }: { draft: ScheduleDraft }) {
  const FallbackIcon = draft.sourceType === "generated_carousel" ? Images : Video;

  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm sm:grid-cols-[96px_minmax(0,1fr)]">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[#102033] text-white sm:aspect-[9/12]">
        {draft.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <FallbackIcon className="size-6 text-white/70" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">
              {draft.mediaTitle || "Schedule draft"}
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
      </div>
    </article>
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
            ? "Your planned posts will appear here once scheduling is connected."
            : "This filter will populate from local schedule drafts for now, then from the real publishing backend later."}
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
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-white/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Calendar preview</h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            A lightweight planning view. Real scheduling will connect later.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
          {drafts.length} planned
        </span>
      </div>

      <div className="grid min-h-[260px] flex-1 grid-cols-1 gap-3 md:grid-cols-7">
        {weekdays.map((day) => (
          <div
            key={day}
            className="rounded-2xl border border-border bg-white/75 p-3 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-normal text-muted">
              {day}
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-border bg-[#fffaf6] px-3 py-5 text-center text-xs font-semibold leading-5 text-muted md:min-h-[150px]">
              Planned posts will appear here.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewScheduleDrawer({
  mediaOptions,
  onClose,
  onSave,
}: {
  mediaOptions: ScheduleMediaOption[];
  onClose: () => void;
  onSave: (draft: ScheduleDraft) => void;
}) {
  const [selectedMediaId, setSelectedMediaId] = useState<string>(
    mediaOptions[0]?.id ?? "",
  );
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<SchedulePlatform[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [postType, setPostType] = useState<SchedulePostType>("reel");

  const selectedMedia =
    mediaOptions.find((option) => option.id === selectedMediaId) ?? null;
  const status = getDraftStatusPreview({
    caption,
    platforms,
    scheduledDate,
    scheduledTime,
    selectedMedia,
  });

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

  function togglePlatform(platform: SchedulePlatform) {
    setPlatforms((currentPlatforms) =>
      currentPlatforms.includes(platform)
        ? currentPlatforms.filter((currentPlatform) => currentPlatform !== platform)
        : [...currentPlatforms, platform],
    );
  }

  function handleSaveDraft() {
    const draft = createScheduleDraft({
      caption,
      mediaTitle: selectedMedia?.title,
      mediaUrl: selectedMedia?.mediaUrl,
      platforms,
      postType,
      scheduledDate,
      scheduledTime,
      sourceId: selectedMedia?.id,
      sourceType: selectedMedia?.sourceType,
      status,
      thumbnailUrl: selectedMedia?.thumbnailUrl,
      timezone,
    });

    onSave(draft);
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
              Plan the post now. Publishing connections will come later.
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
          <ScheduleMediaPicker
            mediaOptions={mediaOptions}
            selectedMediaId={selectedMediaId}
            onSelectMedia={setSelectedMediaId}
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

          <PlatformSelector platforms={platforms} onToggle={togglePlatform} />

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

          <StatusPreview status={status} selectedMedia={selectedMedia} />
        </div>

        <div className="border-t border-border/80 bg-white/72 px-5 py-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Save schedule draft
          </button>
          <p className="mt-3 text-center text-xs font-semibold leading-5 text-muted">
            This saves locally only. No EventBridge schedule or social publishing
            API will be called.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ScheduleMediaPicker({
  mediaOptions,
  onSelectMedia,
  selectedMediaId,
}: {
  mediaOptions: ScheduleMediaOption[];
  onSelectMedia: (mediaId: string) => void;
  selectedMediaId: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-foreground">Select media</span>
        <span className="text-xs font-semibold text-muted">
          {mediaOptions.length} local {mediaOptions.length === 1 ? "asset" : "assets"}
        </span>
      </div>

      {mediaOptions.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {mediaOptions.map((option) => {
            const selected = option.id === selectedMediaId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectMedia(option.id)}
                className={cn(
                  "grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-white p-2 text-left shadow-sm transition hover:bg-[#fffaf6]",
                  selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
                )}
              >
                <div className="flex aspect-[9/12] items-center justify-center overflow-hidden rounded-xl bg-[#102033] text-white">
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
                    {getMediaSourceLabel(option)} ·{" "}
                    {option.durationLabel || "Duration pending"}
                  </p>
                  {option.status === "missing_render" ? (
                    <p className="mt-1 text-xs font-bold text-primary">
                      Render required before real scheduling.
                    </p>
                  ) : null}
                </div>
                {selected ? (
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 rounded-2xl border border-dashed border-border bg-[#fffaf6] px-4 py-5 text-center">
          <Video className="mx-auto size-7 text-[#9aa7b8]" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-foreground">
            No ready media found.
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-muted">
            Finish editing or rendering content before scheduling.
          </p>
        </div>
      )}
    </div>
  );
}

function PlatformSelector({
  onToggle,
  platforms,
}: {
  onToggle: (platform: SchedulePlatform) => void;
  platforms: SchedulePlatform[];
}) {
  return (
    <div>
      <span className="text-sm font-bold text-foreground">Platforms</span>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {schedulePlatforms.map((platform) => {
          const selected = platforms.includes(platform);

          return (
            <button
              key={platform}
              type="button"
              onClick={() => onToggle(platform)}
              className={cn(
                "rounded-2xl border bg-white px-3 py-3 text-left shadow-sm transition hover:bg-[#fffaf6]",
                selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-foreground">
                  {getSchedulePlatformLabel(platform)}
                </span>
                {selected ? (
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                ) : null}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
                Publishing connection required
              </span>
            </button>
          );
        })}
      </div>
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
  selectedMedia,
  status,
}: {
  selectedMedia: ScheduleMediaOption | null;
  status: ScheduleDraftStatus;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Status preview</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">
            {selectedMedia
              ? "This is a local planning status, not a live publishing status."
              : "No media selected, so the draft will show render required."}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-card-muted px-2.5 py-1 text-xs font-bold text-muted">
          {getScheduleStatusLabel(status)}
        </span>
      </div>
    </div>
  );
}

function subscribeToScheduleDrafts(onStoreChange: () => void) {
  return listenToScheduleDrafts(() => {
    onStoreChange();
  });
}

function subscribeToEditableVideoLibrary(onStoreChange: () => void) {
  return listenToEditableVideoLibrary(() => {
    onStoreChange();
  });
}

function getEmptyScheduleDrafts() {
  return emptyScheduleDrafts;
}

function getEmptyEditableVideos() {
  return emptyEditableVideos;
}

function getTabCounts(drafts: ScheduleDraft[]): Record<ScheduleTab, number> {
  return {
    drafts: drafts.filter((draft) => draft.status === "draft").length,
    failed: 0,
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

function mapEditableVideoToScheduleMediaOption(
  video: EditableVideo,
): ScheduleMediaOption {
  const renderedVideoUrl = video.renderedVideoUrl?.trim() || "";
  const previewVideoUrl = renderedVideoUrl || video.videoUrl?.trim() || "";

  return {
    durationLabel: formatVideoDuration(video.durationSeconds),
    id: video.id,
    mediaUrl: previewVideoUrl || undefined,
    sourceType: getScheduleSourceTypeFromEditableVideo(video),
    status: renderedVideoUrl ? "ready" : "missing_render",
    thumbnailUrl: video.thumbnailUrl ?? undefined,
    title: video.title,
  };
}

function getScheduleSourceTypeFromEditableVideo(video: EditableVideo) {
  if (video.source === "demo") {
    return "demo_video";
  }

  if (video.source === "hook") {
    return "generated_video";
  }

  return "edit_video";
}

function getMediaSourceLabel(option: ScheduleMediaOption) {
  const sourceLabels: Record<ScheduleMediaOption["sourceType"], string> = {
    demo_video: "Demo video",
    edit_video: "Edited video",
    generated_carousel: "Generated carousel",
    generated_video: "Generated video",
  };

  return sourceLabels[option.sourceType];
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
  caption,
  platforms,
  scheduledDate,
  scheduledTime,
  selectedMedia,
}: {
  caption: string;
  platforms: SchedulePlatform[];
  scheduledDate: string;
  scheduledTime: string;
  selectedMedia: ScheduleMediaOption | null;
}): ScheduleDraftStatus {
  if (!selectedMedia || selectedMedia.status === "missing_render") {
    return "render_required";
  }

  if (
    caption.trim() &&
    platforms.length > 0 &&
    scheduledDate.trim() &&
    scheduledTime.trim()
  ) {
    return "scheduled_preview";
  }

  return "draft";
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
