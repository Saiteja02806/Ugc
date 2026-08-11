import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLockedHookAudioSelection,
  type HookAudioLockCandidate,
  type HookVideoLockCandidate,
} from "./hook-video-audio-lock-logic.ts";

const video: HookVideoLockCandidate = {
  avatarType: "global",
  deletedAt: null,
  durationSeconds: 3.792,
  hasAudio: false,
  hookFormatId: "desk_laptop_reaction",
  id: "video-1",
  sourceVideoUrl: "https://media.example/video.mp4",
  status: "ready",
};

const audio: HookAudioLockCandidate = {
  audioUrl: "https://media.example/EWW.mp3",
  durationSeconds: 14.08,
  id: "hook_audio_029",
  loopable: false,
  reviewStatus: "approved",
  status: "active",
};

test("builds a Locked selection without an invented score", () => {
  assert.deepEqual(buildLockedHookAudioSelection({ audio, video }), {
    audioAssetId: "hook_audio_029",
    audioUrl: "https://media.example/EWW.mp3",
    durationSeconds: 14.08,
    hookVideoId: "video-1",
    selectionSource: "video_locked",
  });
});

test("rejects audio that is shorter than the selected Hook video", () => {
  assert.throws(
    () =>
      buildLockedHookAudioSelection({
        audio: { ...audio, durationSeconds: 2 },
        video,
      }),
    /cannot be shorter/u,
  );
});

test("rejects unapproved audio and non-silent videos", () => {
  assert.throws(
    () =>
      buildLockedHookAudioSelection({
        audio: { ...audio, reviewStatus: "pending" },
        video,
      }),
    /must be approved/u,
  );
  assert.throws(
    () =>
      buildLockedHookAudioSelection({
        audio,
        video: { ...video, hasAudio: true },
      }),
    /silent catalog Hook video/u,
  );
});
