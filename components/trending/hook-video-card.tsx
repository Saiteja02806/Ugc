"use client";

import { AlertCircle, Loader2, Play, Video } from "lucide-react";

import type { HookInfluencerVideoSummary } from "@/lib/trending/hook-video-types";

export function HookVideoCard({
  dragOffset,
  previewError,
  previewLoading,
  previewUrl,
  video,
  onPreviewError,
  onRetryPreview,
}: {
  dragOffset: number;
  previewError: string | null;
  previewLoading: boolean;
  previewUrl: string | null;
  video: HookInfluencerVideoSummary;
  onPreviewError: () => void;
  onRetryPreview: () => void;
}) {
  return (
    <div
      className="relative mx-auto aspect-[9/16] w-[154px] shrink-0 overflow-hidden rounded-[18px] border border-border-strong bg-foreground-strong shadow-[0_12px_34px_rgb(23_23_27_/_0.16)] sm:w-40 lg:w-[176px]"
      style={{
        transform: `translateX(${Math.max(-88, Math.min(88, dragOffset))}px) rotate(${Math.max(-4, Math.min(4, dragOffset / 22))}deg)`,
        transition: dragOffset === 0 ? "transform 180ms ease-out" : "none",
      }}
    >
      {video.thumbnailUrl ? (
        // Catalog thumbnails are delivery assets; source video URLs are not returned here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#172130] text-white/65">
          <Video className="size-7" aria-hidden="true" />
        </div>
      )}

      {previewUrl ? (
        <video
          key={previewUrl}
          src={previewUrl}
          poster={video.thumbnailUrl ?? undefined}
          className="absolute inset-0 size-full bg-black object-cover"
          controls
          playsInline
          preload="metadata"
          onError={onPreviewError}
        />
      ) : null}

      {previewLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/48 text-white">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/55">
            <Loader2
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          </span>
        </div>
      ) : null}

      {previewError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111827]/88 px-4 text-center text-white">
          <AlertCircle className="size-5" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold leading-5">
            Could not load preview.
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRetryPreview();
            }}
            className="mt-3 inline-flex size-9 items-center justify-center rounded-full bg-white text-foreground-strong transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Try protected preview again"
            title="Try preview again"
          >
            <Play className="ml-0.5 size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
