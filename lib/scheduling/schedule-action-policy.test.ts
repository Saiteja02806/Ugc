import assert from "node:assert/strict";
import test from "node:test";

import {
  canCancelSchedule,
  canEditSchedule,
  getScheduleEditBlockReason,
} from "./schedule-action-policy.ts";
import type { ScheduledPost, ScheduledPostTarget } from "./types.ts";

function createSchedule(
  overrides: Partial<ScheduledPost> = {},
): ScheduledPost {
  return {
    cancelledAt: null,
    caption: "",
    createdAt: "2026-07-16T10:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000001",
    idempotencyKey: null,
    lastErrorCode: null,
    libraryItemId: null,
    mediaAssetId: "00000000-0000-4000-8000-000000000002",
    metadata: {},
    projectId: null,
    publishedAt: null,
    scheduledFor: null,
    sourceKind: "media_asset",
    status: "draft",
    targets: [],
    timezone: "UTC",
    title: "Draft",
    updatedAt: "2026-07-16T10:00:00.000Z",
    ...overrides,
  };
}

function createTarget(
  overrides: Partial<ScheduledPostTarget> = {},
): ScheduledPostTarget {
  return {
    attemptCount: 0,
    cancelledAt: null,
    createdAt: "2026-07-16T10:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000003",
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciledAt: null,
    nextRetryAt: null,
    platform: "instagram",
    platformPostId: null,
    platformPostUrl: null,
    publishJobId: null,
    publishedAt: null,
    scheduledFor: "2026-07-17T10:00:00.000Z",
    schedulerDeletedAt: null,
    schedulerScheduleArn: null,
    schedulerScheduleName: null,
    settings: {},
    socialConnectionId: "00000000-0000-4000-8000-000000000004",
    status: "scheduled",
    updatedAt: "2026-07-16T10:00:00.000Z",
    ...overrides,
  };
}

test("allows editing an idle draft without platform targets", () => {
  assert.equal(canEditSchedule(createSchedule()), true);
});

test("blocks editing while a render is active", () => {
  const schedule = createSchedule({
    metadata: { combinedRenderStatus: "rendering" },
  });

  assert.equal(canEditSchedule(schedule), false);
  assert.match(getScheduleEditBlockReason(schedule) ?? "", /render/i);
});

test("blocks editing while final platform scheduling is active", () => {
  const schedule = createSchedule({
    metadata: { finalScheduleStatus: "scheduling" },
  });

  assert.equal(canEditSchedule(schedule), false);
  assert.match(getScheduleEditBlockReason(schedule) ?? "", /scheduling/i);
});

test("allows cancellation after provider schedules are created", () => {
  const schedule = createSchedule({ targets: [createTarget()] });

  assert.equal(canEditSchedule(schedule), false);
  assert.equal(canCancelSchedule(schedule), true);
});

test("does not offer cancellation after publishing starts", () => {
  assert.equal(canCancelSchedule(createSchedule({ status: "publishing" })), false);
  assert.equal(canCancelSchedule(createSchedule({ status: "published" })), false);
  assert.equal(
    canCancelSchedule(
      createSchedule({ targets: [createTarget({ status: "published" })] }),
    ),
    false,
  );
});
