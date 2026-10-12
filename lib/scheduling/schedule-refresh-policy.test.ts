import assert from "node:assert/strict";
import test from "node:test";
import { getScheduleRefreshDelay } from "./schedule-refresh-policy.ts";
import type { ScheduledPost, ScheduledPostTarget } from "./types.ts";

const now = Date.parse("2026-10-10T07:00:00Z");
const instant = (offset: number) => new Date(now + offset).toISOString();
function schedule(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
  return {
    id: "audit-post", cancelledAt: null, caption: "", createdAt: instant(-1_000),
    idempotencyKey: null, lastErrorCode: null, libraryItemId: null,
    mediaAssetId: null, metadata: {}, projectId: null, publishedAt: null,
    scheduledFor: instant(75_000), sourceKind: "media_asset", status: "scheduled",
    targets: [], timezone: "Asia/Calcutta", title: "Audit", updatedAt: instant(-1_000),
    ...overrides,
  };
}
function target(offset: number, status: ScheduledPostTarget["status"] = "scheduled") {
  return { status, scheduledFor: instant(offset), updatedAt: instant(-1_000) } as ScheduledPostTarget;
}

test("a post loaded 75 seconds ahead wakes at its publish window and keeps refreshing", () => {
  const posts = [schedule({ targets: [target(75_000)] })];
  assert.equal(getScheduleRefreshDelay(posts, now), 15_000);
  assert.equal(getScheduleRefreshDelay(posts, now + 15_000), 5_000);
  assert.equal(getScheduleRefreshDelay(posts, now + 76_000), 5_000);
  assert.equal(getScheduleRefreshDelay([schedule({ status: "published" })], now + 76_000), null);
});

test("multiple future targets wake at the earliest window without polling all day", () => {
  assert.equal(getScheduleRefreshDelay([
    schedule({ targets: [target(3_600_000)] }),
    schedule({ targets: [target(600_000)] }),
  ], now), 540_000);
  assert.equal(getScheduleRefreshDelay([schedule({ targets: [target(40 * 86_400_000)] })], now), 86_400_000);
});

test("terminal parents do not poll because old render or target metadata remains", () => {
  for (const status of ["cancelled", "published"] as const) {
    assert.equal(getScheduleRefreshDelay([schedule({ status,
      metadata: { wallTextAssignmentId: "wall", wallTextRenderStatus: "not_requested" },
      targets: [target(0, "publishing")],
    })], now), null);
  }
});

test("active render and finalization handoffs keep refreshing", () => {
  for (const metadata of [
    { combinedRenderStatus: "queued" },
    { combinedRenderStatus: "rendering" },
    { wallTextAssignmentId: "wall", wallTextRenderStatus: "not_requested" },
    { finalScheduleStatus: "finalizing" },
    { finalScheduleStatus: "scheduling" },
  ]) {
    assert.equal(getScheduleRefreshDelay([schedule({ status: "draft", metadata })], now), 5_000);
  }
});

test("a retry in a partial publish keeps refreshing the unfinished target", () => {
  for (const status of ["publishing", "scheduling"] as const) {
    assert.equal(getScheduleRefreshDelay([schedule({ status: "partially_failed", targets: [target(0, status)] })], now), 5_000);
  }
});

test("expired work and invalid target dates do not cause endless rapid polling", () => {
  assert.equal(getScheduleRefreshDelay([schedule({ status: "draft", updatedAt: instant(-301_000), metadata: { combinedRenderStatus: "queued" } })], now), null);
  assert.equal(getScheduleRefreshDelay([schedule({ targets: [target(-121_000)] })], now), null);
  assert.equal(getScheduleRefreshDelay([schedule({ targets: [{...target(0), scheduledFor: "invalid"}] })], now), null);
  assert.equal(getScheduleRefreshDelay([], now), null);
});
