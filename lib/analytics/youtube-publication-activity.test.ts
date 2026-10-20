import assert from "node:assert/strict";
import test from "node:test";

import { buildYouTubePublicationActivity } from "./youtube-publication-activity.ts";
import type { ScheduledPost, ScheduledPostTarget } from "@/lib/scheduling/types";

function createTarget(
  overrides: Partial<ScheduledPostTarget> = {},
): ScheduledPostTarget {
  return {
    attemptCount: 0,
    cancelledAt: null,
    createdAt: "2026-09-20T09:00:00.000Z",
    id: "target-1",
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciledAt: null,
    nextRetryAt: null,
    platform: "youtube",
    platformPostId: null,
    platformPostUrl: null,
    publishJobId: null,
    publishedAt: null,
    scheduledFor: "2026-09-21T09:00:00.000Z",
    schedulerDeletedAt: null,
    schedulerScheduleArn: null,
    schedulerScheduleName: null,
    settings: {},
    socialConnectionId: "youtube-connection",
    status: "scheduled",
    updatedAt: "2026-09-20T09:00:00.000Z",
    ...overrides,
  };
}

function createSchedule(
  targets: ScheduledPostTarget[],
  title = "September upload",
): ScheduledPost {
  return {
    cancelledAt: null,
    caption: "",
    createdAt: "2026-09-20T09:00:00.000Z",
    id: "schedule-1",
    idempotencyKey: null,
    lastErrorCode: null,
    libraryItemId: null,
    mediaAssetId: "media-1",
    metadata: {},
    projectId: null,
    publishedAt: null,
    scheduledFor: "2026-09-21T09:00:00.000Z",
    sourceKind: "media_asset",
    status: "scheduled",
    targets,
    timezone: "Asia/Kolkata",
    title,
    updatedAt: "2026-09-20T09:00:00.000Z",
  };
}

test("shows only YouTube target activity and keeps the publish link", () => {
  const summary = buildYouTubePublicationActivity([
    createSchedule([
      createTarget({
        id: "youtube-published",
        platformPostUrl: "https://www.youtube.com/watch?v=published",
        publishedAt: "2026-09-22T12:00:00.000Z",
        status: "published",
      }),
      createTarget({ id: "instagram-target", platform: "instagram" }),
    ]),
  ]);

  assert.deepEqual(summary, {
    needsAttention: 0,
    published: 1,
    rows: [
      {
        connectionId: "youtube-connection",
        date: "2026-09-22T12:00:00.000Z",
        errorMessage: null,
        id: "schedule-1:youtube-published",
        platformPostUrl: "https://www.youtube.com/watch?v=published",
        status: "published",
        title: "September upload",
      },
    ],
    scheduled: 0,
  });
});

test("filters publishing activity to one connected YouTube account", () => {
  const summary = buildYouTubePublicationActivity(
    [
      createSchedule([
        createTarget({
          id: "first-channel",
          socialConnectionId: "channel-one",
          status: "published",
        }),
        createTarget({
          id: "second-channel",
          socialConnectionId: "channel-two",
          status: "scheduled",
        }),
      ]),
    ],
    { connectionId: "channel-two" },
  );

  assert.equal(summary.published, 0);
  assert.equal(summary.scheduled, 1);
  assert.deepEqual(summary.rows.map((row) => row.connectionId), ["channel-two"]);
});

test("surfaces scheduled and attention states but omits cancelled uploads", () => {
  const summary = buildYouTubePublicationActivity([
    createSchedule([
      createTarget({ id: "scheduled" }),
      createTarget({
        id: "failed",
        lastErrorMessage: "Reconnect YouTube to continue publishing.",
        status: "action_required",
        updatedAt: "2026-09-23T11:00:00.000Z",
      }),
      createTarget({ id: "cancelled", status: "cancelled" }),
    ], "  "),
  ]);

  assert.equal(summary.scheduled, 1);
  assert.equal(summary.needsAttention, 1);
  assert.equal(summary.published, 0);
  assert.deepEqual(
    summary.rows.map((row) => ({
      errorMessage: row.errorMessage,
      status: row.status,
      title: row.title,
    })),
    [
      {
        errorMessage: "Reconnect YouTube to continue publishing.",
        status: "attention",
        title: "YouTube upload",
      },
      {
        errorMessage: null,
        status: "scheduled",
        title: "YouTube upload",
      },
    ],
  );
});
