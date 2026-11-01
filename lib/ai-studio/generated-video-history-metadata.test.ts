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

test("identifies workflow correctly from job input tags, starting frame, or references", () => {
  assert.equal(getGeneratedVideoHistoryMetadata({ workflow: "talking_head", hookIdea: "Talking head video" }).workflow, "talking_head");
  assert.equal(getGeneratedVideoHistoryMetadata({ startingFrameReceipt: { workflow: "talking_head" }, hookIdea: "Script" }).workflow, "talking_head");
  assert.equal(getGeneratedVideoHistoryMetadata({ referenceId: "talking-car-story", hookIdea: "Car story" }).workflow, "talking_head");
  assert.equal(getGeneratedVideoHistoryMetadata({ workflowKind: "phone", hookIdea: "App demo" }).workflow, "phone");
  assert.equal(getGeneratedVideoHistoryMetadata({ exploreFormat: "wall_text", hookIdea: "Background" }).workflow, "wall_text");
  assert.equal(getGeneratedVideoHistoryMetadata({ exploreFormat: "hook", referenceId: "HV_001", hookIdea: "Hook idea" }).workflow, "hook");
});
