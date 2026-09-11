import assert from "node:assert/strict";
import test from "node:test";

import {
  HOOK_AUDIO_MATCHING_VERSION,
  createHookAudioContentFingerprint,
  getDefaultHookAudioIntent,
  parseHookAudioIntent,
  scoreHookAudioMatch,
  selectHookAudio,
  type HookAudioAsset,
  type HookAudioIntent,
} from "./hook-audio-matcher.ts";

const intent: HookAudioIntent = {
  energy: "high",
  hookType: "warning",
  mood: "urgent",
};

test("selects the highest-scoring approved-duration Hook track", () => {
  const result = selectHookAudio({
    assets: [
      asset("hook_audio_001", {
        energy: "medium",
        hookTypes: ["story", "benefit"],
        moods: ["calm"],
      }),
      asset("hook_audio_002", {
        energy: "high",
        hookTypes: ["warning", "curiosity"],
        moods: ["urgent"],
      }),
    ],
    intent,
    videoDurationSeconds: 4,
  });

  assert.equal(result?.audioAssetId, "hook_audio_002");
  assert.equal(result?.matchScore, 1);
  assert.equal(result?.matchingVersion, HOOK_AUDIO_MATCHING_VERSION);
  assert.equal(result?.selectionSource, "dynamic");
});

test("uses an eligible reviewed format preference ahead of the dynamic score", () => {
  const result = selectHookAudio({
    assets: [
      asset("hook_audio_001", {
        energy: "low",
        hookTypes: ["story", "benefit"],
        moods: ["calm"],
      }),
      asset("hook_audio_002", {
        energy: "high",
        hookTypes: ["warning", "curiosity"],
        moods: ["urgent"],
      }),
    ],
    intent,
    preferredAssetIds: ["hook_audio_001"],
    videoDurationSeconds: 4,
  });

  assert.equal(result?.audioAssetId, "hook_audio_001");
  assert.equal(result?.selectionSource, "format_preferred");
});

test("rejects short tracks instead of producing a shortened Hook segment", () => {
  const result = selectHookAudio({
    assets: [asset("hook_audio_001", { durationSeconds: 3.99 })],
    intent,
    videoDurationSeconds: 4,
  });

  assert.equal(result, null);
});

test("parses controlled intent and keeps the generator format fallback aligned", () => {
  assert.deepEqual(
    parseHookAudioIntent({
      energy: "medium",
      hookType: "problem",
      mood: "serious",
    }),
    { energy: "medium", hookType: "problem", mood: "serious" },
  );
  assert.equal(
    parseHookAudioIntent({ energy: "extreme", hookType: "problem", mood: "serious" }),
    null,
  );
  assert.deepEqual(getDefaultHookAudioIntent("GF_019"), {
    energy: "medium",
    hookType: "curiosity",
    mood: "playful",
  });
});

test("Hook audio fingerprints are deterministic and bind the video and intent", () => {
  const first = createHookAudioContentFingerprint({
    hookTextFormatId: "GF_004",
    hookVideoId: "video-1",
    intent,
  });
  const repeated = createHookAudioContentFingerprint({
    hookTextFormatId: "GF_004",
    hookVideoId: "video-1",
    intent,
  });
  const different = createHookAudioContentFingerprint({
    hookTextFormatId: "GF_004",
    hookVideoId: "video-2",
    intent,
  });

  assert.equal(first, repeated);
  assert.notEqual(first, different);
  assert.match(first, /^[a-f0-9]{64}$/u);
});

test("Hook audio scoring uses mood, message type, and energy", () => {
  assert.equal(
    scoreHookAudioMatch(
      {
        energy: "medium",
        hookTypes: ["warning", "story"],
        moods: ["urgent"],
      },
      intent,
    ),
    0.925,
  );
});

function asset(
  id: string,
  overrides: Partial<HookAudioAsset> = {},
): HookAudioAsset {
  return {
    audioUrl: `https://cdn.example.com/${id}.mp3`,
    durationSeconds: 15,
    energy: "medium",
    hookTypes: ["curiosity", "story"],
    id,
    impactAtSeconds: null,
    loopable: false,
    moods: ["curious"],
    ...overrides,
  };
}
