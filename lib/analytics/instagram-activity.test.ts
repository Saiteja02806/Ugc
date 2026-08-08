import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstagramActivitySummary,
} from "./instagram-activity.ts";
import type {
  ScheduledPost,
  ScheduledPostTarget,
} from "@/lib/scheduling/types";

test("counts only active-account publishing and excludes cancelled history", () => {
  const summary = buildInstagramActivitySummary({
    accountNames: new Map([["active-instagram", "Mira"]]),
    dateKeys: ["2026-08-08"],
    schedules: [
      makeSchedule("current-published", makeTarget({
        id: "published",
        status: "published",
      })),
      makeSchedule("current-cancelled", makeTarget({
        id: "cancelled",
        status: "cancelled",
      })),
      makeSchedule("old-account", makeTarget({
        id: "old-account",
        socialConnectionId: "revoked-instagram",
        status: "published",
      })),
      makeSchedule("current-scheduled", makeTarget({
        id: "scheduled",
        status: "scheduled",
      })),
    ],
    visibleConnectionIds: new Set(["active-instagram"]),
  });

  assert.equal(summary.published, 1);
  assert.equal(summary.scheduled, 1);
  assert.equal(summary.needsAttention, 0);
  assert.deepEqual(
    summary.activityRows.map((row) => row.id),
    ["current-published:published", "current-scheduled:scheduled"],
  );
  assert.deepEqual(summary.buckets, [
    { dateKey: "2026-08-08", published: 1, scheduled: 1 },
  ]);
});

function makeSchedule(id: string, target: ScheduledPostTarget): ScheduledPost {
  return {
    cancelledAt: null,
    caption: "",
    createdAt: "2026-08-08T10:00:00.000Z",
    id,
    idempotencyKey: null,
    lastErrorCode: null,
    libraryItemId: null,
    mediaAssetId: null,
    metadata: {},
    projectId: null,
    publishedAt: target.publishedAt,
    scheduledFor: target.scheduledFor,
    sourceKind: "user_video",
    status: target.status === "cancelled" ? "cancelled" : "scheduled",
    targets: [target],
    timezone: "UTC",
    title: id,
    updatedAt: "2026-08-08T10:00:00.000Z",
  };
}

function makeTarget(
  overrides: Partial<ScheduledPostTarget>,
): ScheduledPostTarget {
  return {
    attemptCount: 0,
    cancelledAt: null,
    createdAt: "2026-08-08T10:00:00.000Z",
    id: "target",
    lastReconciledAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    nextRetryAt: null,
    platform: "instagram",
    platformPostId: "media-id",
    platformPostUrl: "https://www.instagram.com/p/example/",
    publishJobId: null,
    publishedAt: "2026-08-08T10:00:00.000Z",
    scheduledFor: "2026-08-08T10:00:00.000Z",
    schedulerDeletedAt: null,
    schedulerScheduleArn: null,
    schedulerScheduleName: null,
    settings: {},
    socialConnectionId: "active-instagram",
    status: "scheduled",
    updatedAt: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}
