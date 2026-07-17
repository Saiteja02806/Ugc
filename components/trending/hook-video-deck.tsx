"use client";

import { ArrowLeft, Loader2, Plus, RefreshCw, Sparkles, Video } from "lucide-react";
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { HookVideoCard } from "@/components/trending/hook-video-card";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
} from "@/lib/trending/hook-video-types";

const SWIPE_THRESHOLD = 64;

export function HookVideoDeck({
  browseMode,
  influencer,
  position,
  previewError,
  previewLoading,
  previewUrl,
  surpriseLoading,
  total,
  video,
  onChangeVideo,
  onCompose,
  onPreviewError,
  onRetryPreview,
  onSkip,
}: {
  browseMode: "influencer" | "surprise";
  influencer: HookInfluencerSummary;
  position: number;
  previewError: string | null;
  previewLoading: boolean;
  previewUrl: string | null;
  surpriseLoading: boolean;
  total: number;
  video: HookInfluencerVideoSummary;
  onChangeVideo: () => void;
  onCompose: () => void;
  onPreviewError: () => void;
  onRetryPreview: () => void;
  onSkip: () => void;
}) {
  const pointerStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;

    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerStart.current?.pointerId !== event.pointerId) return;
    setDragOffset(event.clientX - pointerStart.current.x);
  }

  function finishSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;

    if (!start || start.pointerId !== event.pointerId) {
      setDragOffset(0);
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    setDragOffset(0);

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD ||
      Math.abs(deltaX) <= Math.abs(deltaY) * 1.15
    ) {
      return;
    }

    if (deltaX < 0) onSkip();
    else onCompose();
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-4 sm:px-6">
      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground-strong">
            {influencer.name}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {browseMode === "surprise"
              ? "Surprise me"
              : `${position} of ${Math.max(total, 1)}`}
          </p>
        </div>
        {influencer.sourceKind === "user" ? (
          <span className="shrink-0 text-xs font-semibold text-primary">
            Uploaded
          </span>
        ) : browseMode === "surprise" ? (
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : null}
      </div>

      <div
        className="mt-3 touch-pan-y select-none"
        aria-label={`${video.title}. Swipe left to skip or right to add a product demo.`}
        onPointerCancel={finishSwipe}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
      >
        <HookVideoCard
          dragOffset={dragOffset}
          previewError={previewError}
          previewLoading={previewLoading}
          previewUrl={previewUrl}
          video={video}
          onPreviewError={onPreviewError}
          onRetryPreview={onRetryPreview}
        />
      </div>

      <div className="mt-2.5 w-full max-w-sm text-center">
        <h2 className="truncate text-sm font-semibold text-foreground-strong">
          {video.title}
        </h2>
        <p className="mt-1 text-xs font-medium text-muted">
          {formatDuration(video.durationSeconds)} - {formatRatio(video.ratio)}
        </p>
      </div>

      <div className="mt-3 flex min-h-13 items-center justify-center gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={surpriseLoading}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border-strong bg-card text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55"
          aria-label="Skip this influencer video"
          title="Skip video"
        >
          {surpriseLoading ? (
            <Loader2 className="size-4.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ArrowLeft className="size-4.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex size-13 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_20px_rgb(255_72_34_/_0.2)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          aria-label="Add a product demo"
          title="Add product demo"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onChangeVideo}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border-strong bg-card px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <Video className="size-4" aria-hidden="true" />
          Choose
        </button>
      </div>

      {previewError ? (
        <button
          type="button"
          onClick={onRetryPreview}
          className="mt-3 inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Retry preview
        </button>
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "Duration pending";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatRatio(ratio: HookInfluencerVideoSummary["ratio"]) {
  return ratio === "other" ? "Custom ratio" : ratio;
}
