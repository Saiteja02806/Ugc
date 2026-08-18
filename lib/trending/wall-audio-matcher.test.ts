import assert from "node:assert/strict";
import test from "node:test";

import {
  WALL_AUDIO_LOCKED_MATCHING_VERSION,
  WALL_AUDIO_MATCHING_VERSION,
  buildWallAudioIntent,
  createWallTextContentFingerprint,
  getWallAudioFitMode,
  scoreWallAudioMatch,
  selectLockedWallAudio,
  selectWallAudio,
  type WallAudioAsset,
  type WallAudioIntent,
} from "./wall-audio-matcher.ts";

const intent: WallAudioIntent = {
  energy: "medium",
  messageTypes: ["problem", "transformation"],
  moods: ["serious", "uplifting"],
};

test("every Wall pattern maps to a controlled audio intent", () => {
  assert.deepEqual(buildWallAudioIntent({ pattern: "problem_change_result" }), {
    energy: "medium",
    messageTypes: ["problem", "transformation", "benefit"],
    moods: ["serious", "uplifting"],
  });
  assert.equal(
    buildWallAudioIntent({ pattern: "situation_discovery" }).energy,
    "low",
  );
});

test("content fingerprints change for meaning but ignore spacing and case", () => {
  const first = createWallTextContentFingerprint({
    fullText: "A Small Change Works.",
    pattern: "action_benefit",
  });
  const equivalent = createWallTextContentFingerprint({
    fullText: "  a small   change works. ",
    pattern: "action_benefit",
  });
  const different = createWallTextContentFingerprint({
    fullText: "A different change works.",
    pattern: "action_benefit",
  });
  assert.equal(first, equivalent);
  assert.notEqual(first, different);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("duration fit uses exact, trim, loop, or rejection", () => {
  assert.equal(getWallAudioFitMode(durationAsset(5, false), 3), "trim");
  assert.equal(getWallAudioFitMode(durationAsset(7.02, false), 7), "exact");
  assert.equal(getWallAudioFitMode(durationAsset(12, false), 7), "trim");
  assert.equal(getWallAudioFitMode(durationAsset(5.2, true), 7), "loop");
  assert.equal(getWallAudioFitMode(durationAsset(5.2, false), 7), null);
  assert.equal(
    getWallAudioFitMode(
      { cueStartSeconds: 4, durationSeconds: 10, loopable: false },
      7,
    ),
    null,
  );
});

test("a 3-second video trims a longer approved audio to exactly 3 seconds", () => {
  const result = selectWallAudio({
    assets: [asset("audio_001", { durationSeconds: 5, loopable: false })],
    intent,
    videoDurationSeconds: 3,
  });

  assert.equal(result?.fitMode, "trim");
  assert.equal(result?.outputDurationSeconds, 3);
  assert.equal(result?.fadeOutSeconds, 0.2);
});

test("semantic score uses 45 percent mood, 40 percent message and 15 percent energy", () => {
  assert.equal(
    scoreWallAudioMatch(
      {
        energy: "medium",
        messageTypes: ["problem", "transformation"],
        moods: ["serious", "uplifting"],
      },
      intent,
    ),
    1,
  );
  assert.equal(
    scoreWallAudioMatch(
      {
        energy: "low",
        messageTypes: ["problem"],
        moods: ["serious"],
      },
      intent,
    ),
    0.5,
  );
});

test("matcher rejects a short non-loopable track", () => {
  const result = selectWallAudio({
    assets: [asset("audio_001", { durationSeconds: 5.2, loopable: false })],
    intent,
    videoDurationSeconds: 7,
  });
  assert.equal(result, null);
});

test("matcher prefers an exact or trim fit over a loop with the same meaning", () => {
  const result = selectWallAudio({
    assets: [
      asset("audio_001", { durationSeconds: 5.2, loopable: true }),
      asset("audio_002", { durationSeconds: 12, loopable: false }),
    ],
    intent,
    videoDurationSeconds: 7,
  });
  assert.equal(result?.audioAssetId, "audio_002");
  assert.equal(result?.fitMode, "trim");
});

test("a long trimmable soundtrack beats a short loop even with a lower semantic score", () => {
  const result = selectWallAudio({
    assets: [
      asset("audio_006s_loop", {
        durationSeconds: 6,
        loopable: true,
      }),
      asset("audio_060s_trim", {
        durationSeconds: 60,
        energy: "high",
        loopable: false,
        messageTypes: ["warning"],
        moods: ["urgent"],
      }),
    ],
    intent,
    videoDurationSeconds: 12,
  });

  assert.equal(result?.audioAssetId, "audio_060s_trim");
  assert.equal(result?.fitMode, "trim");
  assert.equal(result?.outputDurationSeconds, 12);
});

test("loop is used only when no exact or longer approved soundtrack exists", () => {
  const result = selectWallAudio({
    assets: [
      asset("audio_006s_not_loopable", {
        durationSeconds: 6,
        loopable: false,
      }),
      asset("audio_006s_loopable", {
        durationSeconds: 6,
        loopable: true,
      }),
    ],
    intent,
    videoDurationSeconds: 12,
  });

  assert.equal(result?.audioAssetId, "audio_006s_loopable");
  assert.equal(result?.fitMode, "loop");
});

test("an Instagram template keeps its locked audio and trims it to the video", () => {
  const result = selectLockedWallAudio({
    asset: asset("instagram-locked", {
      durationSeconds: 60,
      loopable: false,
    }),
    intent,
    videoDurationSeconds: 12,
  });

  assert.equal(result?.audioAssetId, "instagram-locked");
  assert.equal(result?.fitMode, "trim");
  assert.equal(result?.outputDurationSeconds, 12);
  assert.equal(result?.matchingVersion, WALL_AUDIO_LOCKED_MATCHING_VERSION);
});

test("an Instagram template never loops a short locked track", () => {
  const result = selectLockedWallAudio({
    asset: asset("instagram-locked", {
      durationSeconds: 6,
      loopable: true,
    }),
    intent,
    videoDurationSeconds: 12,
  });

  assert.equal(result, null);
});

test("recent-use avoidance chooses a fresh candidate inside the top semantic band", () => {
  const result = selectWallAudio({
    assets: [asset("audio_001"), asset("audio_002")],
    intent,
    recentAssetIds: ["audio_001"],
    videoDurationSeconds: 7,
  });
  assert.equal(result?.audioAssetId, "audio_002");
});

test("a reusable preferred asset remains fixed when it still covers the duration", () => {
  const result = selectWallAudio({
    assets: [asset("audio_001"), asset("audio_002")],
    intent,
    preferredAssetId: "audio_002",
    recentAssetIds: ["audio_002"],
    videoDurationSeconds: 10,
  });
  assert.equal(result?.audioAssetId, "audio_002");
  assert.equal(result?.matchingVersion, WALL_AUDIO_MATCHING_VERSION);
  assert.equal(result?.outputDurationSeconds, 10);
});

test("selection is deterministic when candidates are otherwise equal", () => {
  const assets = [asset("audio_010"), asset("audio_002")];
  const first = selectWallAudio({ assets, intent, videoDurationSeconds: 7 });
  const second = selectWallAudio({ assets, intent, videoDurationSeconds: 7 });
  assert.equal(first?.audioAssetId, "audio_002");
  assert.deepEqual(first, second);
});

function durationAsset(durationSeconds: number, loopable: boolean) {
  return { cueStartSeconds: 0, durationSeconds, loopable };
}

function asset(
  id: string,
  overrides: Partial<WallAudioAsset> = {},
): WallAudioAsset {
  return {
    audioUrl: `https://media.example.com/${id}.mp3`,
    cueStartSeconds: 0,
    durationSeconds: 30,
    energy: "medium",
    id,
    loopable: false,
    messageTypes: ["problem", "transformation"],
    moods: ["serious", "uplifting"],
    reviewStatus: "approved",
    status: "active",
    ...overrides,
  };
}
