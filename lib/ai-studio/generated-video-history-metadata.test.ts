import assert from "node:assert/strict";
import test from "node:test";

import { getGeneratedVideoHistoryMetadata } from "./generated-video-history-metadata.ts";

test("extracts safe display metadata from an AI Studio video job input", () => {
  assert.deepEqual(
    getGeneratedVideoHistoryMetadata({
      hookIdea: "  A cinematic product launch at sunset  ",
      model: "seedance_2_5",
      resolution: "720p",
    }),
    {
      model: "seedance_2_5",
      prompt: "A cinematic product launch at sunset",
      resolution: "720p",
    },
  );
});

test("omits unsupported values from video history metadata", () => {
  assert.deepEqual(
    getGeneratedVideoHistoryMetadata({
      hookIdea: "",
      model: "other",
      resolution: "4k",
    }),
    {},
  );
});
