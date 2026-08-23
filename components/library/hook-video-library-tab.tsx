"use client";

import {
  CalendarClock,
  Eye,
  Film,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PlatformSelectionModalLoading } from "@/components/social/platform-selection-modal-loading";
import type { HookVideoScheduleSelection } from "@/components/trending/hook-video-schedule-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { HookVideoSourceKind } from "@/lib/trending/hook-video-types";
import { cn } from "@/lib/utils";

const HookVideoScheduleDrawer = dynamic(
  () =>
    import("@/components/trending/hook-video-schedule-drawer").then(
      (module) => module.HookVideoScheduleDrawer,
    ),
  { loading: PlatformSelectionModalLoading },
);

type SavedHookVideo = {
  createdAt: string;
  demoAssetId: string;
  demoTitle: string;
  hookText: string;
  id: string;
  influencerId: string;
  influencerName: string;
  influencerVideoId: string;
  influencerVideoTitle: string;
  librarySavedAt: string | null;
  renderError: string | null;
  renderJobId: string | null;
  renderStatus: "not_requested" | "queued" | "rendering" | "ready" | "failed";
  renderedAt: string | null;
  renderedMediaAssetId: string | null;
  renderedVideoUrl: string | null;
  scheduledPostId: string | null;
  selectedHookId: string;
  sourceKind: HookVideoSourceKind;
  status: "draft" | "saved" | "scheduled";
  trimEnd: number | null;
  trimStart: number;
  updatedAt: string;
};

type SavedHookVideoResponse =
  | { drafts: SavedHookVideo[]; ok: true }
  | { error?: string; ok?: false };

type ScheduleResponse =
  | { draft: { id: string }; ok: true; scheduleId: string }
  | { error?: string; ok?: false };

type RenderResponse =
  | { jobId: string | null; ok: true; status: string }
  | { message?: string; ok?: false };

export function HookVideoLibraryTab({
  embedded = false,
  hideIfEmpty = false,
  onLoadedCount,
}: {
  embedded?: boolean;
  hideIfEmpty?: boolean;
  onLoadedCount?: (count: number, loading: boolean) => void;
} = {}) {
  const [items, setItems] = useState<SavedHookVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SavedHookVideo | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [pendingScheduleItem, setPendingScheduleItem] =
    useState<SavedHookVideo | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await requireToken();
      const response = await fetch("/api/trending/hook-videos/drafts", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | SavedHookVideoResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load saved Reel hooks."));
      }

      setItems(data.drafts);
      onLoadedCount?.(data.drafts.length, false);
    } catch (error) {
      setItems([]);
      onLoadedCount?.(0, false);
      setErrorMessage(
        getErrorMessage(error, "Could not load saved Reel hooks."),
      );
    } finally {
      setLoading(false);
    }
  }, [onLoadedCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    if (!items.some((item) => isRenderPending(item.renderStatus))) {
      return;
    }

    const timer = window.setInterval(() => void loadItems(), 5_000);
    return () => window.clearInterval(timer);
  }, [items, loadItems]);

  function openPreview(item: SavedHookVideo) {
    if (item.renderStatus === "ready" && item.renderedVideoUrl) {
      setSelectedItem(item);
    }
  }

  async function confirmSchedule(selection: HookVideoScheduleSelection) {
    const item = pendingScheduleItem;

    if (!item) {
      throw new Error("Choose a Reel hook before scheduling.");
    }

    setSchedulingId(item.id);
    setErrorMessage(null);
    setNoticeMessage(null);
    let scheduleCreated = false;

    try {
      const token = await requireToken();
      const response = await fetch(
        "/api/trending/hook-videos/drafts/schedule",
        {
          body: JSON.stringify({
            demoAssetId: item.demoAssetId,
            draftId: item.id,
            influencerId: item.influencerId,
            influencerVideoId: item.influencerVideoId,
            selectedHookId: item.selectedHookId,
            sourceKind: item.sourceKind,
            ...selection,
            trimEnd: item.trimEnd,
            trimStart: item.trimStart,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => null)) as
        | ScheduleResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiError(data, "Could not prepare this schedule."));
      }

      scheduleCreated = true;
      const renderResponse = await fetch(
        `/api/schedules/${encodeURIComponent(data.scheduleId)}/render`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          method: "POST",
        },
      );
      const renderData = (await renderResponse.json().catch(() => null)) as
        | RenderResponse
        | null;

      if (!renderResponse.ok || !renderData || renderData.ok !== true) {
        throw new Error(
        getApiMessage(renderData, "Could not start preparing this Reel."),
        );
      }

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                scheduledPostId: data.scheduleId,
                status: "scheduled",
              }
            : currentItem,
        ),
      );
      setPendingScheduleItem(null);
      setNoticeMessage("Schedule saved. Reel preparation is queued.");
    } catch (error) {
      const message = getErrorMessage(error, "Could not prepare this schedule.");
      setErrorMessage(
        scheduleCreated
          ? `The schedule was saved, but Reel preparation did not start. Open Scheduling to retry it. ${message}`
          : message,
      );
      throw error;
    } finally {
      setSchedulingId(null);
    }
  }

  if (hideIfEmpty && !loading && items.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        "relative",
        !embedded && "overflow-hidden rounded-panel border border-border bg-card",
      )}
      aria-labelledby="hook-video-library-heading"
    >
      <header
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          embedded ? "pb-3" : "px-4 py-4 sm:px-5",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {!embedded ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
              <Video className="size-[18px]" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2
              id="hook-video-library-heading"
              className="text-base font-semibold text-foreground-strong"
            >
              Reel hooks
            </h2>
            {!embedded ? (
              <p className="mt-0.5 text-sm leading-5 text-muted">
                Saved hooks paired with your real opening and product footage.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-10 items-center rounded-control bg-surface-subtle px-3 text-xs font-semibold text-muted ring-1 ring-inset ring-border">
            {loading
              ? "Loading"
              : `${items.length} ${items.length === 1 ? "video" : "videos"}`}
          </span>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            aria-label="Refresh Reel hooks"
            title="Refresh Reel hooks"
            className="inline-flex size-10 items-center justify-center rounded-control border border-border bg-card text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
          >
            <RefreshCw
              className={cn(
                "size-4",
                loading && "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      <div
        className={cn(
          !embedded && "border-t border-border bg-surface-subtle/55 p-4 sm:p-5",
        )}
      >
        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded-control border border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error"
          >
            {errorMessage}
          </p>
        ) : null}

        {noticeMessage ? (
          <p role="status" className="mb-4 rounded-control border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">
            {noticeMessage}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-[430px] animate-pulse rounded-panel border border-border bg-card motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div
            className={cn(
              "flex items-center justify-center px-5 py-8 text-center",
              embedded
                ? "min-h-44"
                : "min-h-[330px] rounded-panel border border-dashed border-border-strong bg-card",
            )}
          >
            <div className="max-w-md">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand-soft text-primary">
                <Sparkles className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground-strong">
                No saved Reel hooks
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Save a reviewed Reel hook from Trending and it will
                appear here.
              </p>
              <Link
                href="/dashboard"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Open Trending
              </Link>
            </div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="group min-w-0 overflow-hidden rounded-panel border border-border bg-card transition-colors hover:border-border-strong"
              >
                <button
                  type="button"
                  onClick={() => openPreview(item)}
                  aria-label={`Preview ${item.hookText}`}
                  disabled={
                    item.renderStatus !== "ready" || !item.renderedVideoUrl
                  }
                  className="relative block aspect-[9/12] w-full overflow-hidden bg-[#17171a] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default"
                >
                  {item.renderStatus === "ready" && item.renderedVideoUrl ? (
                    <video
                      src={item.renderedVideoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015] motion-reduce:transition-none"
                    />
                  ) : isRenderPending(item.renderStatus) ? (
                    <span className="flex size-full flex-col items-center justify-center gap-3 px-5 text-center text-white/70">
                      <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      <span className="text-xs font-semibold">
                        Preparing finished video
                      </span>
                    </span>
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-3 px-5 text-center text-white/60">
                      <Video className="size-7" aria-hidden="true" />
                      <span className="text-xs font-semibold">
                        {item.renderStatus === "failed"
                          ? "Video preparation failed"
                          : "Finished video not prepared"}
                      </span>
                    </span>
                  )}
                </button>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground-strong">
                      {item.influencerName}
                    </p>
                    <span className="shrink-0 text-[11px] font-semibold text-muted">
                      {getRenderStatusLabel(item.renderStatus)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-muted">
                    Demo: {item.demoTitle}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    Saved {formatDate(item.librarySavedAt ?? item.updatedAt)}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => openPreview(item)}
                      disabled={
                        item.renderStatus !== "ready" || !item.renderedVideoUrl
                      }
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-control bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      Preview
                    </button>
                    {item.scheduledPostId ? (
                      <Link
                        href={`/scheduling?draft=${encodeURIComponent(item.scheduledPostId)}`}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <CalendarClock className="size-3.5" aria-hidden="true" />
                        View schedule
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setNoticeMessage(null);
                          setPendingScheduleItem(item);
                        }}
                        disabled={
                          Boolean(schedulingId) || item.renderStatus !== "ready"
                        }
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
                      >
                        {schedulingId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : (
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                        )}
                        Schedule
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <HookVideoPreviewDialog
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
          }
        }}
      />
      {pendingScheduleItem ? (
        <HookVideoScheduleDrawer
          onClose={() => {
            if (!schedulingId) setPendingScheduleItem(null);
          }}
          onConfirm={confirmSchedule}
          summary={{
            demoTitle: pendingScheduleItem.demoTitle,
            hookText: pendingScheduleItem.hookText,
            influencerName: pendingScheduleItem.influencerName,
          }}
        />
      ) : null}
    </section>
  );
}

function HookVideoPreviewDialog({
  item,
  onOpenChange,
}: {
  item: SavedHookVideo | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[760px] flex-col overflow-hidden p-0 sm:max-w-[calc(100%-2rem)]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14">
          <DialogTitle className="truncate text-lg font-semibold text-foreground-strong">
            {item?.influencerName ?? "Reel hook"}
          </DialogTitle>
          <DialogDescription className="truncate text-sm text-muted">
            {item?.demoTitle ?? "Product demo"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto p-5 sm:grid-cols-[260px_minmax(0,1fr)]">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[16px] bg-[#17171a]">
            {item?.renderedVideoUrl ? (
              <video
                key={item.renderedVideoUrl}
                src={item.renderedVideoUrl}
                controls
                playsInline
                preload="metadata"
                className="size-full object-contain"
              />
            ) : null}
            {!item?.renderedVideoUrl ? (
              <span className="absolute inset-0 flex items-center justify-center text-white/60">
                <Video className="size-7" aria-hidden="true" />
              </span>
            ) : null}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-muted">Hook</p>
            <p className="mt-2 text-lg font-semibold leading-7 text-foreground-strong">
              {item?.hookText}
            </p>
            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <PreviewDetail
                icon={UserRound}
                label="Source clip"
                value={item?.influencerVideoTitle ?? ""}
              />
              <PreviewDetail
                icon={Film}
                label="Product demo"
                value={item?.demoTitle ?? ""}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground-strong">
          {value}
        </p>
      </div>
    </div>
  );
}

async function requireToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before opening your Library.");
  }

  return token;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function isRenderPending(status: SavedHookVideo["renderStatus"]) {
  return status === "queued" || status === "rendering";
}

function getRenderStatusLabel(status: SavedHookVideo["renderStatus"]) {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Failed";
  if (isRenderPending(status)) return "Preparing";
  return "Not prepared";
}

function getApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}

function getApiMessage(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
