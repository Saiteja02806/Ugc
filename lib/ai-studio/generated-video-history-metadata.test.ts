import assert from "node:assert/strict";
import test from "node:test";

import { getGeneratedVideoHistoryMetadata } from "./generated-video-history-metadata.ts";

test("retains WAN's exact model identity when restoring generated video history", () => {
  assert.deepEqual(getGeneratedVideoHistoryMetadata({ model: "wan_3_0", hookIdea: "My curiosity hook", resolution: "1080p" }), {
    model: "wan_3_0", prompt: "My curiosity hook", resolution: "1080p",
  });
});

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
