"use client";

import { FileVideo, Loader2 } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
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
  // Source identity owns the still and playback position. Nothing is shared
  // across cards/accounts or persisted to storage.
  return <VideoPreviewMedia key={JSON.stringify([props.src, props.poster])} {...props} />;
}

function VideoPreviewMedia({ className, controls = false, muted = true,
  onAspectRatioChange, onPlaybackStateChange, playing = false, poster, src, title,
}: VideoPreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const positionRef = useRef(0);
  const [available, setAvailable] = useState(false);
  const [hasStill, setHasStill] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const hasPoster = Boolean(poster && !posterFailed);

  function captureFrame(video: HTMLVideoElement) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.seeking || !video.videoWidth || !video.videoHeight) return;
    const target = canvas.current;
    if (!target) return;
    const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
    target.width = Math.max(1, Math.round(video.videoWidth * scale));
    target.height = Math.max(1, Math.round(video.videoHeight * scale));
    try {
      const context = target.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, target.width, target.height);
      // Display-only canvas supports cross-origin media without reading pixels,
      // serializing a data URL, or changing existing CORS/auth requirements.
      setHasStill(true);
      setRetrying(false);
    } catch { /* A visible decoder remains the fallback if a still cannot be drawn. */ }
  }

  const suspend = useEffectEvent(() => {
    const video = player.current;
    if (video) {
      positionRef.current = Number.isFinite(video.currentTime) ? video.currentTime : positionRef.current;
      captureFrame(video);
      video.pause();
    }
    if (playing) onPlaybackStateChange?.(false);
  });

  useEffect(() => {
    // Playback buttons sit below the frame. Keep the preview available while
    // any part of its card is visible, including those controls on small screens.
    const element = container.current?.closest("article") ?? container.current;
    if (!element) return;
    let intersecting = false;
    let wasAvailable = false;
    const update = () => {
      const next = intersecting && document.visibilityState !== "hidden" && navigator.onLine;
      if (wasAvailable && !next) suspend();
      wasAvailable = next;
      setAvailable(next);
    };
    const measure = () => {
      const rect = element.getBoundingClientRect();
      intersecting = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
      update();
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      intersecting = entries.some(entry => entry.isIntersecting);
      update();
    });
    observer?.observe(element);
    if (!observer) {
      measure();
      window.addEventListener("scroll", measure, { passive: true, capture: true });
      window.addEventListener("resize", measure);
    }
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const loadVideo = Boolean(src && available && !failure && (playing || retrying || (!hasPoster && !hasStill)));
  return (
    <div ref={container} className="relative size-full" data-video-preview>
      <canvas ref={canvas} role="img" aria-label={`Preview of ${title}`}
        hidden={!hasStill} className={cn("absolute inset-0 size-full object-contain", className)} />
      {hasPoster && !hasStill ? (
        // Storage/CDN media keeps its existing authenticated/public delivery URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster ?? undefined} alt={`Preview of ${title}`} loading="lazy"
          className={cn("absolute inset-0 size-full object-contain", className)}
          onLoad={event => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) onAspectRatioChange?.(`${image.naturalWidth} / ${image.naturalHeight}`);
          }} onError={() => setPosterFailed(true)} />
      ) : null}
      {loadVideo ? <PreviewDecoder key={retry} src={src!} title={title} className={className}
        controls={controls} muted={muted} playing={playing} mediaRef={player} positionRef={positionRef}
        onAspectRatioChange={onAspectRatioChange} onFrame={captureFrame}
        onPlaybackStateChange={onPlaybackStateChange} onFailure={setFailure} /> : null}
      {!src || failure ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#17181b]/90 px-3 text-center" role="status">
          <FileVideo className="size-6 text-white/65" aria-hidden="true" />
          <p className="text-xs font-medium text-white/80">{src ? failure : "Video unavailable"}</p>
          {src ? <button type="button" onClick={() => { setFailure(null); setRetrying(true); setRetry(value => value + 1); }}
            className="rounded-full border border-white/25 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Retry preview
          </button> : null}
        </div>
      ) : !hasPoster && !hasStill ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#17181b]" role="status">
          <Loader2 className="size-5 animate-spin text-white/50 motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only">Loading video preview</span>
        </div>
      ) : null}
    </div>
  );
}

function PreviewDecoder({ src, title, className, controls, muted, playing, mediaRef, positionRef,
  onAspectRatioChange, onFrame, onPlaybackStateChange, onFailure,
}: Required<Pick<VideoPreviewProps, "controls" | "muted" | "playing" | "title">>
  & Pick<VideoPreviewProps, "className" | "onAspectRatioChange" | "onPlaybackStateChange">
  & { src: string; mediaRef: RefObject<HTMLVideoElement | null>; positionRef: RefObject<number>;
    onFrame: (video: HTMLVideoElement) => void; onFailure: (message: string) => void }) {
  const [ready, setReady] = useState(false);
  const active = useRef(false);
  const frame = useEffectEvent(onFrame);
  const failed = useEffectEvent(() => { onFailure("Could not play this video"); onPlaybackStateChange?.(false); });

  useEffect(() => {
    const video = mediaRef.current;
    if (!video) return;
    active.current = true;
    // Cleanup aborts reads and frees the decoder even if the card stays mounted.
    video.src = src;
    video.load();
    return () => {
      active.current = false;
      if (Number.isFinite(video.currentTime)) positionRef.current = video.ended ? 0 : video.currentTime;
      video.pause(); video.removeAttribute("src"); video.load();
    };
  }, [src, mediaRef, positionRef]);

  useEffect(() => {
    const video = mediaRef.current;
    if (!video) return;
    let cancelled = false;
    if (playing) {
      void video.play().catch(error => {
        if (!cancelled && error?.name !== "AbortError") failed();
      });
    } else {
      frame(video);
      video.pause();
    }
    return () => { cancelled = true; };
  }, [playing, mediaRef]);

  function decoded(video: HTMLVideoElement) {
    if (!active.current || video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    setReady(true);
    if (!playing) onFrame(video);
  }

  return <video ref={mediaRef} aria-label={`Preview of ${title}`}
    className={cn("absolute inset-0 size-full object-contain", className, !ready && "opacity-0")}
    controls={controls} muted={muted} playsInline preload="metadata"
    onLoadedMetadata={event => {
      const video = event.currentTarget;
      if (video.videoWidth > 0 && video.videoHeight > 0) onAspectRatioChange?.(`${video.videoWidth} / ${video.videoHeight}`);
      const end = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.01) : Infinity;
      video.currentTime = Math.min(positionRef.current || (playing ? 0 : 0.1), end);
    }}
    onLoadedData={event => decoded(event.currentTarget)} onSeeked={event => decoded(event.currentTarget)}
    onTimeUpdate={event => { if (active.current) positionRef.current = event.currentTarget.ended ? 0 : event.currentTarget.currentTime; }}
    onPlay={() => { if (active.current) onPlaybackStateChange?.(true); }}
    onPlaying={event => decoded(event.currentTarget)}
    onPause={event => {
      if (!active.current) return;
      positionRef.current = event.currentTarget.currentTime;
      onFrame(event.currentTarget); onPlaybackStateChange?.(false);
    }}
    onEnded={event => { if (active.current) { positionRef.current = 0; onFrame(event.currentTarget); onPlaybackStateChange?.(false); } }}
    onError={() => { if (active.current) { onFailure("Preview could not load"); onPlaybackStateChange?.(false); } }} />;
}
