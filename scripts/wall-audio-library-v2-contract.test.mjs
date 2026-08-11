import assert from "node:assert/strict";
import test from "node:test";

import {
  NORMALIZATION_TARGET,
  WALL_AUDIO_LIBRARY_SCHEMA_VERSION,
  createPendingAsset,
  detectSilenceBounds,
  migrateExistingAsset,
  naturalAudioNameCompare,
  nextSourceId,
  parseArgs,
  toReviewCsv,
} from "./prepare-wall-audio-library-v2.mjs";

test("preparation is dry-run by default and execution needs confirmation", () => {
  assert.equal(parseArgs([]).execute, false);
  assert.throws(() => parseArgs(["--execute"]), /--execute and --yes/);
  assert.equal(parseArgs(["--execute", "--yes"]).execute, true);
});

test("new source IDs continue after the existing V1 IDs", () => {
  const existing = ["audio_001", "audio_018", "audio_009"];
  assert.equal(nextSourceId(existing), "audio_019");
  assert.equal(nextSourceId(existing, 47), "audio_066");
});

test("audio names sort numerically", () => {
  const names = [
    "wall_text_audio_010.mp3",
    "wall_text_audio_008.mp3",
    "wall_text_audio_009.mp3",
  ];
  assert.deepEqual(names.sort(naturalAudioNameCompare), [
    "wall_text_audio_008.mp3",
    "wall_text_audio_009.mp3",
    "wall_text_audio_010.mp3",
  ]);
});

test("silence bounds remove meaningful leading and trailing silence", () => {
  const output = [
    "silence_start: 0",
    "silence_end: 0.186 | silence_duration: 0.186",
    "silence_start: 60.139",
    "silence_end: 63.468 | silence_duration: 3.329",
  ].join("\n");
  assert.deepEqual(detectSilenceBounds(output, 63.504), {
    startSeconds: 0.186,
    endSeconds: 60.139,
  });
});

test("existing assets retain approved semantic tags while fields become clear", () => {
  const migrated = migrateExistingAsset(
    {
      id: "audio_001_segment_01",
      sourceAudioId: "audio_001",
      storagePath: "audio-usable/audio_001_segment_01.mp3",
      startTime: 2,
      endTime: 20,
      moods: ["calm"],
      hookTypes: ["story"],
      energy: "low",
      loopable: true,
      status: "active",
    },
    normalizedResult(),
  );
  assert.equal(migrated.sourceStartSeconds, 2);
  assert.equal(migrated.sourceEndSeconds, 20);
  assert.deepEqual(migrated.messageTypes, ["story"]);
  assert.equal(migrated.reviewStatus, "approved");
  assert.equal(migrated.status, "active");
});

test("new assets remain unavailable until subjective listening review", () => {
  const asset = createPendingAsset({
    sourceAudioId: "audio_019",
    sourceFileName: "wall_text_audio_008.mp3",
    sourceStartSeconds: 0,
    sourceEndSeconds: 8,
    normalizedResult: {
      ...normalizedResult(),
      sourceDurationSeconds: 8,
    },
  });
  assert.equal(asset.reviewStatus, "pending");
  assert.equal(asset.status, "pending_review");
  assert.deepEqual(asset.moods, []);
  assert.deepEqual(asset.messageTypes, []);
  assert.equal(asset.loopable, null);
});

test("review CSV keeps pending and approved decisions visible", () => {
  const csv = toReviewCsv(
    [
      {
        id: "audio_019",
        sourceAudioId: "audio_019",
        durationSeconds: 8,
        moods: [],
        messageTypes: [],
        energy: null,
        loopable: null,
        reviewStatus: "pending",
        status: "pending_review",
        reviewNotes: "Listen, review",
      },
    ],
    new Map([["audio_019", "wall_text_audio_008.mp3"]]),
  );
  assert.match(csv, /wall_text_audio_008\.mp3/);
  assert.match(csv, /pending_review/);
  assert.match(csv, /"Listen, review"/);
});

test("normalization contract is fixed for video-ready output", () => {
  assert.equal(WALL_AUDIO_LIBRARY_SCHEMA_VERSION, "wall-audio-library-v2");
  assert.deepEqual(NORMALIZATION_TARGET, {
    integratedLufs: -14,
    maximumIntegratedLufsError: 1,
    truePeakDb: -2.2,
    maximumMeasuredTruePeakDb: -1.5,
    loudnessRange: 11,
    sampleRateHz: 48_000,
    channels: 2,
    bitrate: "192k",
  });
});

function normalizedResult() {
  return {
    durationSeconds: 18,
    normalization: {
      targetIntegratedLufs: -14,
      targetTruePeakDb: -2.2,
      sourceIntegratedLufs: -10,
      sourceTruePeakDb: 0,
      measuredIntegratedLufs: -14,
      measuredTruePeakDb: -1.7,
    },
    probe: {
      codec: "mp3",
      sampleRateHz: 48_000,
      channels: 2,
      bitrate: 192_000,
    },
  };
}
