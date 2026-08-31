"use client";

import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
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
  | {
      message: string;
      retryAction: "save" | "schedule";
      status: "error";
    };

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

      <div className="mx-auto mt-3 grid w-full max-w-2xl items-start gap-5 rounded-[20px] border border-border bg-card p-4 sm:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] sm:gap-6 sm:p-5">
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

        <div
          data-wall-text-action-rail
          className="min-w-0 self-start"
        >
          {actionState.status === "error" ? (
            <p
              role="alert"
              className="mb-3 border-l-2 border-error pl-3 text-sm font-semibold leading-5 text-error"
            >
              {actionState.message}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-[16px] border border-border bg-background/35">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Next step
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground-strong">
                Keep this Reel moving
              </p>
            </div>
            <div className="flex flex-col gap-2 p-2.5">
              <button
                type="button"
                onClick={() => void onSchedule()}
                disabled={busy}
                className="group inline-flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[12px] bg-primary px-4 py-3 text-left text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-foreground/12">
                    {actionState.status === "scheduling" ? (
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <CalendarClock className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {actionState.status === "scheduling"
                        ? "Preparing schedule…"
                        : "Create a Schedule"}
                    </span>
                    <span className="mt-0.5 block text-xs text-primary-foreground/72">
                      Choose an account and publish time
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 opacity-75 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={busy}
                className="group inline-flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[12px] border border-border-strong bg-card px-4 py-3 text-left text-foreground-strong transition-[background-color,border-color,transform] hover:border-foreground/20 hover:bg-card-muted active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background/45 text-muted transition-colors group-hover:text-foreground-strong">
                    {actionState.status === "saving" ? (
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {actionState.status === "saving"
                        ? "Saving and preparing…"
                        : "Save to Creative Assets"}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      Keep it ready for later
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground-strong"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
