"use client";

import { ArrowLeft, Loader2, Plus, RefreshCw, Sparkles, Video } from "lucide-react";
import {
  useEffect,
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
const SWIPE_EXIT_DURATION_MS = 180;

export function HookVideoDeck({
  browseMode,
  influencer,
  nextVideo,
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
  nextVideo: HookInfluencerVideoSummary | null;
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
  const swipeExitTimer = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [exitingDirection, setExitingDirection] = useState<
    "left" | "right" | null
  >(null);

  useEffect(() => {
    return () => {
      if (swipeExitTimer.current) window.clearTimeout(swipeExitTimer.current);
    };
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    if (exitingDirection) return;

    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (exitingDirection) return;
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

    animateSwipeExit(deltaX < 0 ? "left" : "right");
  }

  function animateSwipeExit(direction: "left" | "right") {
    if (exitingDirection) return;

    setExitingDirection(direction);
    swipeExitTimer.current = window.setTimeout(() => {
      setExitingDirection(null);
      if (direction === "left") onSkip();
      else onCompose();
    }, SWIPE_EXIT_DURATION_MS);
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center overflow-visible px-4 py-4 sm:px-6">
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
        className="relative mt-3 w-full max-w-sm touch-pan-y select-none overflow-visible"
        aria-label={`${video.title}. Swipe left to skip or right to add a product demo.`}
        onPointerCancel={finishSwipe}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
      >
        <div
          className="relative mx-auto -translate-x-2 overflow-visible"
          style={{ width: "min(90%, 236px)" }}
        >
          {nextVideo ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 opacity-85 transition-[opacity,transform] duration-200 ease-out"
              style={{
                transform: "translateX(8px) rotate(2deg) scale(0.955)",
                transformOrigin: "50% 50%",
              }}
            >
              <HookVideoCard
                dragOffset={0}
                className="shadow-[0_10px_26px_rgb(23_23_27_/_0.14)]"
                previewError={null}
                previewLoading={false}
                previewUrl={null}
                video={nextVideo}
                onPreviewError={() => undefined}
                onRetryPreview={() => undefined}
              />
              <div className="absolute inset-0 rounded-control bg-black/20" />
            </div>
          ) : null}

          <div className="relative z-10">
            <HookVideoCard
              dragOffset={dragOffset}
              exitingDirection={exitingDirection}
              previewError={previewError}
              previewLoading={previewLoading}
              previewUrl={previewUrl}
              video={video}
              onPreviewError={onPreviewError}
              onRetryPreview={onRetryPreview}
            />
          </div>
        </div>
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
          className="inline-flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_rgb(225_101_64_/_0.2)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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
