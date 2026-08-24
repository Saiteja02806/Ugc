"use client";

import { Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { TrendingWallTextCreative } from "@/lib/trending/feed-items";
import { TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME } from "@/lib/trending/audio-level";

export function WallTextAudioPreview({
  active = true,
  audio,
  videoRef,
}: {
  active?: boolean;
  audio: TrendingWallTextCreative["audio"];
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enabledAudioUrl, setEnabledAudioUrl] = useState<string | null>(null);
  const soundEnabled = enabledAudioUrl === audio.audioUrl;

  const syncAudio = useCallback(
    (force = false) => {
      const audioElement = audioRef.current;
      const video = videoRef.current;
      if (!audioElement || !video) return;

      const playableDuration = Math.max(
        0.001,
        audio.assetDurationSeconds - audio.cueStartSeconds,
      );
      const elapsed =
        audio.fitMode === "loop"
          ? video.currentTime % playableDuration
          : Math.min(video.currentTime, playableDuration);
      const expectedTime = Math.min(
        audio.assetDurationSeconds - 0.001,
        audio.cueStartSeconds + elapsed,
      );
      const remainingVideoSeconds = Number.isFinite(video.duration)
        ? Math.max(0, video.duration - video.currentTime)
        : Number.POSITIVE_INFINITY;

      const fadeMultiplier =
        audio.fadeOutSeconds > 0 && remainingVideoSeconds < audio.fadeOutSeconds
          ? Math.max(0, remainingVideoSeconds / audio.fadeOutSeconds)
          : 1;
      audioElement.volume =
        TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME * fadeMultiplier;

      if (force || Math.abs(audioElement.currentTime - expectedTime) > 0.25) {
        audioElement.currentTime = expectedTime;
      }
    },
    [audio, videoRef],
  );

  useEffect(() => {
    const audioElement = audioRef.current;
    const video = videoRef.current;
    if (!audioElement || !video) return;

    function pauseAudio() {
      audioElement?.pause();
    }

    function playAudio() {
      if (!active || !soundEnabled) return;
      syncAudio(true);
      void audioElement?.play().catch(() => setEnabledAudioUrl(null));
    }

    function keepAudioInSync() {
      if (active && soundEnabled) syncAudio();
    }

    function restartLoopableAudio() {
      if (!active || !soundEnabled || audio.fitMode !== "loop") return;
      audioElement!.currentTime = audio.cueStartSeconds;
      void audioElement?.play().catch(() => setEnabledAudioUrl(null));
    }

    video.addEventListener("play", playAudio);
    video.addEventListener("pause", pauseAudio);
    video.addEventListener("ended", pauseAudio);
    video.addEventListener("seeking", keepAudioInSync);
    video.addEventListener("timeupdate", keepAudioInSync);
    audioElement.addEventListener("ended", restartLoopableAudio);

    if (!active) pauseAudio();

    return () => {
      video.removeEventListener("play", playAudio);
      video.removeEventListener("pause", pauseAudio);
      video.removeEventListener("ended", pauseAudio);
      video.removeEventListener("seeking", keepAudioInSync);
      video.removeEventListener("timeupdate", keepAudioInSync);
      audioElement.removeEventListener("ended", restartLoopableAudio);
    };
  }, [active, audio, soundEnabled, syncAudio, videoRef]);

  async function toggleSound() {
    const audioElement = audioRef.current;
    const video = videoRef.current;
    if (!audioElement || !video) return;

    if (soundEnabled) {
      audioElement.pause();
      setEnabledAudioUrl(null);
      return;
    }

    syncAudio(true);
    try {
      await audioElement.play();
      if (video.paused) await video.play();
      setEnabledAudioUrl(audio.audioUrl);
    } catch {
      audioElement.pause();
      setEnabledAudioUrl(null);
    }
  }

  return (
    <>
      <audio
        key={audio.audioUrl}
        ref={audioRef}
        src={audio.audioUrl}
        preload="metadata"
        aria-hidden="true"
      />
      <button
        type="button"
        data-deck-control
        aria-label={soundEnabled ? "Mute Wall audio" : "Play Wall audio"}
        title={soundEnabled ? "Mute audio" : "Play audio"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          void toggleSound();
        }}
        className="absolute bottom-2 left-2 z-30 inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 transition-colors hover:bg-black/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {soundEnabled ? (
          <Volume2 className="size-3.5" aria-hidden="true" />
        ) : (
          <VolumeX className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
