import assert from "node:assert/strict";
import test from "node:test";

import {
  getCurrentDemoRenderedVideoUrl,
  getDemoPlaybackUrl,
  isActiveDemoStatus,
} from "./demo-display.ts";

test("prefers the rendered demo output after the worker marks it ready", () => {
  assert.equal(
    getDemoPlaybackUrl({
      rendered_video_url: "https://media.example/rendered.mp4",
      source_video_url: "https://media.example/source.mp4",
      status: "rendered",
    }),
    "https://media.example/rendered.mp4",
  );
});

test("does not expose incomplete or failed demo uploads as playable", () => {
  for (const status of ["uploading", "processing", "failed"] as const) {
    assert.equal(
      getDemoPlaybackUrl({
        rendered_video_url: null,
        source_video_url: "https://media.example/source.mp4",
        status,
      }),
      null,
    );
  }
});

test("treats an older rendered URL as stale after the demo returns to draft", () => {
  const draftDemo = {
    rendered_video_url: "https://media.example/older-render.mp4",
    source_video_url: "https://media.example/source.mp4",
    status: "draft" as const,
  };

  assert.equal(getCurrentDemoRenderedVideoUrl(draftDemo), null);
  assert.equal(
    getDemoPlaybackUrl(draftDemo),
    "https://media.example/source.mp4",
  );
});

test("uses the source preview instead of an older output while rendering", () => {
  assert.equal(
    getDemoPlaybackUrl({
      rendered_video_url: "https://media.example/older-render.mp4",
      source_video_url: "https://media.example/source.mp4",
      status: "rendering",
    }),
    "https://media.example/source.mp4",
  );
});

test("returns a current rendered output only for rendered demos", () => {
  assert.equal(
    getCurrentDemoRenderedVideoUrl({
      rendered_video_url: "  https://media.example/rendered.mp4  ",
      source_video_url: "https://media.example/source.mp4",
      status: "rendered",
    }),
    "https://media.example/rendered.mp4",
  );
});

test("identifies only statuses that can still change in the background", () => {
  assert.equal(isActiveDemoStatus("rendering"), true);
  assert.equal(isActiveDemoStatus("processing"), true);
  assert.equal(isActiveDemoStatus("rendered"), false);
  assert.equal(isActiveDemoStatus("failed"), false);
});
