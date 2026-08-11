"use client";

import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { WallTextOverlay } from "@/components/trending/wall-text-overlay";
import { WallTextAudioPreview } from "@/components/trending/wall-text-audio-preview";
import type {
  TrendingWallTextContent,
  TrendingWallTextFeedItem,
  TrendingWallTextLayout,
} from "@/lib/trending/feed-items";
import type { TrendingTextColor } from "@/lib/trending/text-color";

export type WallTextDetailActionState =
  | { status: "idle" }
  | { status: "saving" | "scheduling" }
  | { message: string; status: "error" };

export function WallTextDetailView({
  actionState,
  audioPreviewEnabled = true,
  content,
  item,
  layout,
  onBack,
  onSave,
  onSchedule,
  previewUrl,
  thumbnailUrl,
  textColor,
}: {
  actionState: WallTextDetailActionState;
  audioPreviewEnabled?: boolean;
  content?: TrendingWallTextContent;
  item: TrendingWallTextFeedItem;
  layout?: TrendingWallTextLayout;
  onBack: () => void;
  onSave: () => void | Promise<void>;
  onSchedule: () => void | Promise<void>;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  textColor?: TrendingTextColor;
}) {
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const creative = item.creative;
  const visibleContent = content ?? creative.text;
  const visibleLayout = layout ?? creative.layout;
  const busy =
    actionState.status === "saving" || actionState.status === "scheduling";
  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onBack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onBack]);

  function replay() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }

  return (
    <section
      aria-labelledby="wall-text-detail-heading"
      className="mx-auto w-full max-w-5xl py-3 sm:py-6"
    >
      <button
        ref={backButtonRef}
        type="button"
        onClick={onBack}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-1 text-sm font-semibold text-muted transition-colors hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to ideas
      </button>

      <div className="mt-3 grid items-center gap-7 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:gap-12">
        <div className="relative mx-auto w-full max-w-[340px]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-panel bg-[#171717] ring-1 ring-inset ring-border">
            <video
              ref={videoRef}
              src={previewUrl ?? creative.previewUrl}
              poster={thumbnailUrl ?? creative.thumbnailUrl ?? undefined}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-label="Wall-of-text video preview"
              className="size-full object-cover"
            />
            <WallTextOverlay
              content={visibleContent}
              layout={visibleLayout}
              textColor={textColor}
            />
            {audioPreviewEnabled && !previewUrl ? (
              <WallTextAudioPreview
                audio={creative.audio}
                videoRef={videoRef}
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={replay}
            className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-black/72 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Replay
          </button>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Wall-text Reel
          </p>
          <h2
            id="wall-text-detail-heading"
            className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-foreground-strong sm:text-3xl"
          >
            Review the complete overlay
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            This copy stays on the background video for the full clip. No demo
            footage is added.
          </p>

          <div className="mt-6 border-l-2 border-primary/60 pl-4">
            <p className="text-xs font-semibold text-muted">Overlay copy</p>
            <div className="mt-2 max-w-2xl space-y-3 text-[15px] font-medium leading-7 text-foreground-strong">
              {visibleContent.segments.map((segment, index) => (
                <p key={`${segment.role}-${index}`}>
                  {segment.lines.join(" ")}
                </p>
              ))}
            </div>
          </div>

          {actionState.status === "error" ? (
            <p
              role="alert"
              className="mt-5 border-l-2 border-error pl-3 text-sm font-semibold leading-5 text-error"
            >
              {actionState.message}
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-strong bg-card px-5 text-sm font-semibold text-foreground-strong transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-55"
            >
              {actionState.status === "saving" ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {actionState.status === "saving"
                ? "Saving and preparing…"
                : "Save to Creative Assets"}
            </button>
            <button
              type="button"
              onClick={() => void onSchedule()}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-55"
            >
              {actionState.status === "scheduling" ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <CalendarClock className="size-4" aria-hidden="true" />
              )}
              {actionState.status === "scheduling"
                ? "Preparing schedule…"
                : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
