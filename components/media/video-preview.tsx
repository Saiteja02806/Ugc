"use client";

import { FileVideo, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type VideoPreviewProps = {
  className?: string;
  controls?: boolean;
  muted?: boolean;
  onAspectRatioChange?: (ratio: string) => void;
  onPlaybackStateChange?: (playing: boolean) => void;
  playing?: boolean;
  poster?: string | null;
  src: string | null;
  title: string;
};

export function VideoPreview(props: VideoPreviewProps) {
  // A new render/source needs its own frame and playback state.
  return <VideoPreviewMedia key={`${props.src}:${props.poster}`} {...props} />;
}

function VideoPreviewMedia({
  className,
  controls = false,
  muted = true,
  onAspectRatioChange,
  onPlaybackStateChange,
  playing = false,
  poster,
  src,
  title,
}: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const hasPoster = Boolean(poster && !posterFailed);
  const loadVideo = Boolean(src && (playing || hasStarted || (nearViewport && !hasPoster)));
  const showPoster = hasPoster && !frameReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setNearViewport(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loadVideo) return;
    let cancelled = false;
    if (playing) {
      void video.play().catch((error: unknown) => {
        // Rapid play/pause and source changes can cancel a pending play request.
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setFailure("Could not play this video");
        onPlaybackStateChange?.(false);
      });
    } else {
      video.pause();
    }
    return () => { cancelled = true; };
  }, [loadVideo, playing, onPlaybackStateChange]);

  function revealFrame(video: HTMLVideoElement) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setFrameReady(true);
  }

  return (
    <div ref={containerRef} className="relative size-full" data-video-preview>
      {loadVideo ? (
        <video
          ref={videoRef}
          src={src ?? undefined}
          poster={hasPoster ? poster ?? undefined : undefined}
          aria-label={`Preview of ${title}`}
          className={cn("size-full object-contain", className, !frameReady && "opacity-0")}
          controls={controls}
          muted={muted}
          playsInline
          // Decode a frame for visible videos without a poster, then stop
          // requesting an eager preload once the preview is available.
          preload={playing || !frameReady ? "auto" : "metadata"}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              onAspectRatioChange?.(`${video.videoWidth} / ${video.videoHeight}`);
            }
            if (hasStarted || playing) return;
            const firstFrameTime = Number.isFinite(video.duration)
              ? Math.min(0.1, Math.max(0, video.duration / 2))
              : 0.1;
            if (firstFrameTime > 0) video.currentTime = firstFrameTime;
          }}
          onLoadedData={(event) => revealFrame(event.currentTarget)}
          onSeeked={(event) => revealFrame(event.currentTarget)}
          onPlay={() => {
            setHasStarted(true);
            setFailure(null);
            onPlaybackStateChange?.(true);
          }}
          onPlaying={(event) => revealFrame(event.currentTarget)}
          onPause={() => onPlaybackStateChange?.(false)}
          onEnded={() => onPlaybackStateChange?.(false)}
          onError={() => {
            setFailure("Preview could not load");
            onPlaybackStateChange?.(false);
          }}
        />
      ) : null}
      {showPoster ? (
        // Media URLs are already delivered by the configured storage/CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster ?? undefined}
          alt={`Preview of ${title}`}
          className={cn("absolute inset-0 size-full object-contain", className)}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              onAspectRatioChange?.(`${image.naturalWidth} / ${image.naturalHeight}`);
            }
          }}
          onError={() => setPosterFailed(true)}
        />
      ) : null}
      {!src || failure ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#17181b]/90 px-3 text-center" role="status">
          <FileVideo className="size-6 text-white/65" aria-hidden="true" />
          <p className="text-xs font-medium text-white/80">{src ? failure : "Video unavailable"}</p>
          {src ? (
            <button
              type="button"
              onClick={() => {
                setFailure(null);
                videoRef.current?.load();
              }}
              className="rounded-full border border-white/25 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Retry preview
            </button>
          ) : null}
        </div>
      ) : !showPoster && !frameReady ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#17181b]" role="status">
          <Loader2 className="size-5 animate-spin text-white/50 motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only">Loading video preview</span>
        </div>
      ) : null}
    </div>
  );
}
