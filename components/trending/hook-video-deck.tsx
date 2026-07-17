"use client";

import { ArrowLeft, Plus, RefreshCw, Video } from "lucide-react";
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
  influencer,
  position,
  previewError,
  previewLoading,
  previewUrl,
  total,
  video,
  onChangeVideo,
  onCompose,
  onPreviewError,
  onRetryPreview,
  onSkip,
}: {
  influencer: HookInfluencerSummary;
  position: number;
  previewError: string | null;
  previewLoading: boolean;
  previewUrl: string | null;
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
    if ((event.target as HTMLElement).closest("video, button")) {
      return;
    }

    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerStart.current?.pointerId !== event.pointerId) {
      return;
    }

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

    if (deltaX < 0) {
      onSkip();
    } else {
      onCompose();
    }
  }

  return (
    <div className="grid min-h-[340px] items-center gap-7 px-5 py-6 sm:grid-cols-[176px_minmax(0,1fr)] sm:gap-9 sm:px-8">
      <div
        className="touch-pan-y select-none"
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

      <div className="min-w-0 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex min-h-7 items-center rounded-control bg-brand-soft px-2.5 text-xs font-semibold text-primary">
            {influencer.name}
          </span>
          <span className="text-xs font-semibold text-muted">
            {position} of {total}
          </span>
        </div>
        <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-foreground-strong">
          {video.title}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          {formatDuration(video.durationSeconds)} - {formatRatio(video.ratio)}
        </p>

        <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border-strong bg-card text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            aria-label="Skip this influencer video"
            title="Skip video"
          >
            <ArrowLeft className="size-4.5" aria-hidden="true" />
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
            className="inline-flex size-11 items-center justify-center rounded-full border border-border-strong bg-card text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            aria-label="Choose another influencer video"
            title="Choose another video"
          >
            <Video className="size-4.5" aria-hidden="true" />
          </button>
        </div>

        {previewError ? (
          <button
            type="button"
            onClick={onRetryPreview}
            className="mt-4 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Try protected preview again
          </button>
        ) : null}
      </div>
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Duration pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.round(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatRatio(ratio: HookInfluencerVideoSummary["ratio"]) {
  return ratio === "other" ? "Custom ratio" : ratio;
}
