import assert from "node:assert/strict";
import test from "node:test";

import { getScheduleMediaIssue } from "./media-availability.ts";
import type { ScheduledPost } from "./types.ts";

const activeOpeningIds = new Set(["opening-active"]);
const activeDemoIds = new Set(["demo-active"]);

test("detects a deleted demo before video preparation starts", () => {
  assert.equal(
    getScheduleMediaIssue({
      activeDemoIds,
      activeOpeningIds,
      mediaLoaded: true,
      schedule: createSchedule({
        demoMediaId: "demo-deleted",
        hookMediaId: "opening-active",
      }),
    }),
    "demo",
  );
});

test("detects missing opening and demo selections", () => {
  assert.equal(
    getScheduleMediaIssue({
      activeDemoIds,
      activeOpeningIds,
      mediaLoaded: true,
      schedule: createSchedule({ mediaMode: "combined_video" }),
    }),
    "both",
  );
});

test("accepts active opening and demo media", () => {
  assert.equal(
    getScheduleMediaIssue({
      activeDemoIds,
      activeOpeningIds,
      mediaLoaded: true,
      schedule: createSchedule({
        demoMediaId: "demo-active",
        hookMediaId: "opening-active",
      }),
    }),
    null,
  );
});

test("accepts a single scheduled video without an opening clip", () => {
  assert.equal(
    getScheduleMediaIssue({
      activeDemoIds,
      activeOpeningIds: new Set(),
      mediaLoaded: true,
      schedule: createSchedule({
        mediaMode: "single_video",
        scheduledVideoId: "demo-active",
      }),
    }),
    null,
  );
});

test("detects a deleted single scheduled video", () => {
  assert.equal(
    getScheduleMediaIssue({
      activeDemoIds,
      activeOpeningIds,
      mediaLoaded: true,
      schedule: createSchedule({
        mediaMode: "single_video",
        scheduledVideoId: "demo-deleted",
      }),
    }),
    "demo",
  );
});

test("does not report stale source media after preparation is queued or ready", () => {
  for (const combinedRenderStatus of ["queued", "rendering", "ready"]) {
    assert.equal(
      getScheduleMediaIssue({
        activeDemoIds: new Set(),
        activeOpeningIds: new Set(),
        mediaLoaded: true,
        schedule: createSchedule({ combinedRenderStatus }),
      }),
      null,
    );
  }
});

test("waits for the active media catalog before deciding media is missing", () => {
  assert.equal(
    getScheduleMediaIssue({
      activeDemoIds: new Set(),
      activeOpeningIds: new Set(),
      mediaLoaded: false,
      schedule: createSchedule({
        demoMediaId: "demo-active",
        hookMediaId: "opening-active",
      }),
    }),
    null,
  );
});

function createSchedule(metadata: Record<string, unknown>): Pick<
  ScheduledPost,
  "mediaAssetId" | "metadata" | "status"
> {
  return {
    mediaAssetId: null,
    metadata,
    status: "draft",
  };
}
