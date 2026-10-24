"use client";

import { useRef, useState } from "react";
import { ClipPreviewControls } from "./clip-preview-controls";

/** Catalogue preview only. Owned outputs retain their separate download actions. */
export function ReferenceVideoPlayer({ title, url, poster, fallbackUrl }: { title: string; url?: string; poster?: string; fallbackUrl?: string }) {
  const player = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0), [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  return <section aria-label="Reference video playback" className="mx-auto flex w-fit max-w-full flex-col items-center gap-3">
    <video ref={player} aria-label={`Preview ${title}`} className="mx-auto h-auto max-h-[60dvh] w-auto max-w-full rounded-[20px] object-contain shadow-card"
      playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback
      onContextMenu={event => event.preventDefault()} poster={poster} src={useFallback ? fallbackUrl : url}
      onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds * 1000); }}
      onTimeUpdate={event => setTime(event.currentTarget.currentTime * 1000)} onError={() => { if (!useFallback && fallbackUrl && fallbackUrl !== url) setUseFallback(true); else setFailed(true); }} />
    <ClipPreviewControls player={player} timeMs={time} startMs={0} endMs={duration}
      onSeek={value => { if (player.current && duration > 0) { player.current.currentTime = value / 1000; setTime(value); } }}
      onMute={muted => { if (player.current) player.current.muted = muted; }} />
    {failed ? <p role="alert" className="text-xs text-destructive">This reference could not load. Close the preview and try again.</p> : null}
  </section>;
}
