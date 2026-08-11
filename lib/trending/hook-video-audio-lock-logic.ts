export type HookVideoLockCandidate = {
  avatarType: string;
  deletedAt: string | null;
  durationSeconds: number | null;
  hasAudio: boolean | null;
  hookFormatId: string | null;
  id: string;
  sourceVideoUrl: string;
  status: string;
};

export type HookAudioLockCandidate = {
  audioUrl: string;
  durationSeconds: number | null;
  id: string;
  loopable: boolean;
  reviewStatus: string;
  status: string;
};

export type LockedHookAudioSelection = {
  audioAssetId: string;
  audioUrl: string;
  durationSeconds: number;
  hookVideoId: string;
  selectionSource: "video_locked";
};

/**
 * Locked audio is a human decision, so this validates availability and fit
 * without creating an artificial AI match score.
 */
export function buildLockedHookAudioSelection(params: {
  audio: HookAudioLockCandidate;
  video: HookVideoLockCandidate;
}): LockedHookAudioSelection {
  const { audio, video } = params;
  const videoDuration = Number(video.durationSeconds);
  const audioDuration = Number(audio.durationSeconds);

  if (
    video.avatarType !== "global" ||
    video.status !== "ready" ||
    video.deletedAt !== null ||
    video.hasAudio !== false ||
    !video.hookFormatId ||
    !Number.isFinite(videoDuration) ||
    videoDuration <= 0 ||
    !video.sourceVideoUrl.startsWith("https://")
  ) {
    throw new Error(
      "Locked audio requires an available, ready, silent catalog Hook video with a format and duration.",
    );
  }

  if (
    audio.status !== "active" ||
    audio.reviewStatus !== "approved" ||
    audio.loopable !== false ||
    !Number.isFinite(audioDuration) ||
    audioDuration <= 0 ||
    !audio.audioUrl.startsWith("https://")
  ) {
    throw new Error(
      "Locked audio must be approved, active, non-looping, and available.",
    );
  }

  if (audioDuration < videoDuration) {
    throw new Error("Locked audio cannot be shorter than the Hook video.");
  }

  return {
    audioAssetId: audio.id,
    audioUrl: audio.audioUrl,
    durationSeconds: audioDuration,
    hookVideoId: video.id,
    selectionSource: "video_locked",
  };
}
