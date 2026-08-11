import assert from "node:assert/strict";
import test from "node:test";

import {
  mapReviewedAsset,
  parseReviewedArgs,
} from "./prepare-reviewed-wall-audio-library-v2.mjs";

test("reviewed preparation stays dry-run unless explicitly confirmed", () => {
  assert.equal(parseReviewedArgs([]).execute, false);
  assert.throws(
    () => parseReviewedArgs(["--execute"]),
    /requires both --execute and --yes/,
  );
  assert.equal(parseReviewedArgs(["--execute", "--yes"]).execute, true);
});

test("maps hookTypes to production messageTypes without changing values", () => {
  const asset = mapReviewedAsset(
    {
      id: "wall_text_audio_041",
      sourceAudioId: "wall_text_audio_041",
      startTime: 0,
      endTime: 6.456,
      duration: 6.456,
      moods: ["uplifting", "calm"],
      hookTypes: ["benefit", "transformation", "story"],
      energy: "medium",
      loopable: false,
      preparationNote: "Kept whole.",
    },
    "audio_052",
    null,
  );

  assert.equal(asset.id, "audio_052");
  assert.equal(asset.sourceAudioId, "audio_052");
  assert.deepEqual(asset.messageTypes, [
    "benefit",
    "transformation",
    "story",
  ]);
  assert.equal("hookTypes" in asset, false);
  assert.equal(asset.reviewStatus, "approved");
  assert.equal(asset.status, "active");
});

test("maps reviewed source segments onto stable V2 segment IDs", () => {
  const asset = mapReviewedAsset(
    {
      id: "wall_text_audio_051_segment_02",
      sourceAudioId: "wall_text_audio_051",
      startTime: 12,
      endTime: 26.253,
      duration: 14.263,
      moods: ["calm", "curious"],
      hookTypes: ["story", "curiosity", "authority"],
      energy: "low",
      loopable: true,
    },
    "audio_062",
    "02",
  );

  assert.equal(asset.id, "audio_062_segment_02");
  assert.equal(asset.storagePath, "audio-usable/audio_062_segment_02.mp3");
  assert.equal(asset.sourceStartSeconds, 12);
  assert.equal(asset.sourceEndSeconds, 26.253);
});
