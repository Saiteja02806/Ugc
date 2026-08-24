"use client";

import { Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME } from "@/lib/trending/audio-level";

export type HookPreviewAudio = {
  audioAssetId: string;
  audioUrl: string;
  durationSeconds: number;
  selectionSource: "video_locked";
};

export function HookAudioPreview({
  active = true,
  audio,
  trimStart,
  videoRef,
}: {
  active?: boolean;
  audio: HookPreviewAudio;
  trimStart: number;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enabledAudioAssetId, setEnabledAudioAssetId] = useState<string | null>(
    null,
  );
  const soundEnabled = enabledAudioAssetId === audio.audioAssetId;

  const syncAudio = useCallback(
    (force = false) => {
      const audioElement = audioRef.current;
      const video = videoRef.current;
      if (!audioElement || !video) return;

      audioElement.volume = TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME;

      const expectedTime = Math.min(
        Math.max(audio.durationSeconds - 0.001, 0),
        Math.max(video.currentTime - trimStart, 0),
      );

      if (force || Math.abs(audioElement.currentTime - expectedTime) > 0.25) {
        audioElement.currentTime = expectedTime;
      }
    },
    [audio.durationSeconds, trimStart, videoRef],
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
      void audioElement?.play().catch(() => setEnabledAudioAssetId(null));
    }

    function keepAudioInSync() {
      if (active && soundEnabled) syncAudio();
    }

    video.addEventListener("play", playAudio);
    video.addEventListener("pause", pauseAudio);
    video.addEventListener("ended", pauseAudio);
    video.addEventListener("seeking", keepAudioInSync);
    video.addEventListener("timeupdate", keepAudioInSync);

    if (!active) pauseAudio();

    return () => {
      pauseAudio();
      video.removeEventListener("play", playAudio);
      video.removeEventListener("pause", pauseAudio);
      video.removeEventListener("ended", pauseAudio);
      video.removeEventListener("seeking", keepAudioInSync);
      video.removeEventListener("timeupdate", keepAudioInSync);
    };
  }, [active, soundEnabled, syncAudio, videoRef]);

  async function toggleSound() {
    const audioElement = audioRef.current;
    const video = videoRef.current;
    if (!audioElement || !video) return;

    if (soundEnabled) {
      audioElement.pause();
      setEnabledAudioAssetId(null);
      return;
    }

    syncAudio(true);
    try {
      await audioElement.play();
      if (video.paused) await video.play();
      setEnabledAudioAssetId(audio.audioAssetId);
    } catch {
      audioElement.pause();
      setEnabledAudioAssetId(null);
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
        aria-label={soundEnabled ? "Mute Hook audio" : "Play Hook audio"}
        title={soundEnabled ? "Mute audio" : "Play approved audio"}
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
