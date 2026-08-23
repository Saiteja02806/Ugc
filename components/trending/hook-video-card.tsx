"use client";

import { AlertCircle, Loader2, Play, Video } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";

import type { HookInfluencerVideoSummary } from "@/lib/trending/hook-video-types";
import type { TrendingTextColor } from "@/lib/trending/text-color";
import { cn } from "@/lib/utils";
import {
  HookAudioPreview,
  type HookPreviewAudio,
} from "@/components/trending/hook-audio-preview";
import { HookTextOverlay } from "@/components/trending/hook-text-overlay";

export function HookVideoCard({
  active = true,
  className,
  dragOffset,
  exitingDirection = null,
  hookAudio = null,
  hookFontSize = 60,
  hookLines = null,
  hookPosition = null,
  hookTextColor,
  hookText = null,
  previewError,
  previewLoading,
  previewUrl,
  style,
  trimEnd = null,
  trimStart = 0,
  video,
  onPreviewError,
  onPreviewReady,
  onRetryPreview,
}: {
  active?: boolean;
  className?: string;
  dragOffset: number;
  exitingDirection?: "left" | "right" | null;
  hookAudio?: HookPreviewAudio | null;
  hookFontSize?: number;
  hookLines?: readonly string[] | null;
  hookPosition?: { x: number; y: number } | null;
  hookTextColor?: TrendingTextColor;
  hookText?: string | null;
  previewError: string | null;
  previewLoading: boolean;
  previewUrl: string | null;
  style?: CSSProperties;
  trimEnd?: number | null;
  trimStart?: number;
  video: HookInfluencerVideoSummary;
  onPreviewError: () => void;
  onPreviewReady?: () => void;
  onRetryPreview: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const exitOffset =
    exitingDirection === "left" ? -280 : exitingDirection === "right" ? 280 : 0;
  const visibleOffset = exitingDirection ? exitOffset : dragOffset;

  useEffect(() => {
    const element = videoRef.current;

    if (!element) {
      return;
    }

    if (active) {
      restartPreview(element, trimStart);
    } else {
      element.pause();
      element.currentTime = Math.max(trimStart, 0);
    }
  }, [active, previewUrl, trimStart]);

  return (
    <div
      className={cn(
        "relative aspect-[9/16] w-full shrink-0 overflow-hidden rounded-[20px] border border-border-strong bg-foreground-strong shadow-[0_12px_32px_rgb(23_23_27_/_0.16)]",
        className,
      )}
      style={{
        ...style,
        transform: `translateX(${Math.max(-280, Math.min(280, visibleOffset))}px) rotate(${Math.max(-8, Math.min(8, visibleOffset / 22))}deg)`,
        transition: exitingDirection
          ? "transform 180ms ease-in"
          : dragOffset === 0
            ? "transform 180ms ease-out"
            : "none",
      }}
    >
      {video.thumbnailUrl ? (
        // Catalog thumbnails are delivery assets; source video URLs stay protected.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt=""
          width={460}
          height={818}
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-card-muted text-muted">
          <Video className="size-7" aria-hidden="true" />
        </div>
      )}

      {previewUrl ? (
        <video
          ref={videoRef}
          key={previewUrl}
          src={previewUrl}
          poster={video.thumbnailUrl ?? undefined}
          aria-label={video.title}
          autoPlay={active}
          loop={trimStart <= 0 && trimEnd === null}
          muted
          playsInline
          preload="auto"
          draggable={false}
          className="absolute inset-0 size-full bg-black object-cover"
          onEnded={() => restartPreview(videoRef.current, trimStart)}
          onError={onPreviewError}
          onLoadedMetadata={() => {
            if (active) {
              restartPreview(videoRef.current, trimStart);
            } else if (videoRef.current) {
              videoRef.current.currentTime = Math.max(trimStart, 0);
              videoRef.current.pause();
            }
            onPreviewReady?.();
          }}
          onTimeUpdate={() => {
            const element = videoRef.current;

            if (
              element &&
              trimEnd !== null &&
              element.currentTime >= trimEnd
            ) {
              restartPreview(element, trimStart);
            }
          }}
        />
      ) : null}

      {hookAudio && previewUrl && !previewLoading && !previewError ? (
        <HookAudioPreview
          audio={hookAudio}
          trimStart={trimStart}
          videoRef={videoRef}
        />
      ) : null}

      <HookTextOverlay
        color={hookTextColor}
        fontSize={hookFontSize}
        lines={hookLines}
        position={hookPosition}
        text={hookText}
      />

      {previewLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/48 text-white">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/55">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </span>
        </div>
      ) : null}

      {previewError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card-muted/95 px-4 text-center text-foreground">
          <AlertCircle className="size-5" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold leading-5">
            Preview unavailable
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRetryPreview();
            }}
            className="mt-3 inline-flex size-9 items-center justify-center rounded-control border border-border bg-card text-foreground transition-colors hover:border-border-strong hover:bg-card-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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

function restartPreview(element: HTMLVideoElement | null, trimStart: number) {
  if (!element) {
    return;
  }

  element.currentTime = Math.max(trimStart, 0);
  void element.play().catch(() => undefined);
}
