"use client";

import {
  ArrowLeft,
  CalendarClock,
  Loader2,
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

  return (
    <section
      aria-label="Wall-text Reel actions"
      className="mx-auto w-full max-w-3xl py-3 sm:py-6"
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

      <div className="mx-auto mt-3 grid w-full max-w-2xl items-center gap-5 rounded-[20px] border border-border bg-card p-4 sm:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] sm:gap-6 sm:p-5">
        <div className="relative mx-auto w-full max-w-[220px]">
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
        </div>

        <div className="min-w-0">
          {actionState.status === "error" ? (
            <p
              role="alert"
              className="mb-3 border-l-2 border-error pl-3 text-sm font-semibold leading-5 text-error"
            >
              {actionState.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void onSchedule()}
              disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-55"
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
                : "Create a Schedule"}
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-strong bg-card px-5 text-sm font-semibold text-foreground-strong transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-55"
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
          </div>
        </div>
      </div>
    </section>
  );
}
