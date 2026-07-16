import assert from "node:assert/strict";
import test from "node:test";

import {
  canRetrySchedulerCreateFailure,
  getRenderFinalizationDecision,
} from "./render-finalization-policy.ts";
import type { ScheduledPost, ScheduledPostTarget } from "./types.ts";

const RENDER_ID = "00000000-0000-4000-8000-000000000010";

test("finalizes the current ready render when accounts and time are planned", () => {
  assert.deepEqual(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: RENDER_ID,
      schedule: createSchedule(),
    }),
    { action: "finalize" },
  );
});

test("rejects stale and incomplete render callbacks", () => {
  const schedule = createSchedule();

  assert.equal(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: "00000000-0000-4000-8000-000000000099",
      schedule,
    }).action,
    "reject",
  );
  assert.deepEqual(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: RENDER_ID,
      schedule: createSchedule({
        metadata: {
          combinedRenderId: RENDER_ID,
          combinedRenderStatus: "rendering",
          plannedConnectionIds: "connection-1",
        },
      }),
    }),
    {
      action: "reject",
      code: "combined_render_not_ready",
      message: "The combined render is not ready for final scheduling.",
    },
  );
});

test("skips automatic finalization when the user did not plan all inputs", () => {
  assert.deepEqual(
    getRenderFinalizationDecision({
      hasPlannedTime: false,
      renderId: RENDER_ID,
      schedule: createSchedule(),
    }),
    { action: "skip" },
  );
  assert.deepEqual(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: RENDER_ID,
      schedule: createSchedule({
        metadata: {
          combinedMediaAssetId:
            "00000000-0000-4000-8000-000000000011",
          combinedRenderId: RENDER_ID,
          combinedRenderStatus: "ready",
        },
      }),
    }),
    { action: "skip" },
  );
});

test("deduplicates a second render-finalization callback", () => {
  const schedule = createSchedule({
    status: "scheduled",
    targets: [createTarget({ status: "scheduled" })],
  });

  assert.deepEqual(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: RENDER_ID,
      schedule,
    }),
    { action: "already_finalized" },
  );
});

test("allows a clean retry only when every target failed at AWS creation", () => {
  const retryable = createSchedule({
    status: "failed",
    targets: [
      createTarget({
        lastErrorCode: "scheduler_create_failed",
        status: "failed",
      }),
      createTarget({
        id: "00000000-0000-4000-8000-000000000022",
        lastErrorCode: "scheduler_create_failed",
        status: "failed",
      }),
    ],
  });
  const mixedFailure = createSchedule({
    status: "failed",
    targets: [
      createTarget({
        lastErrorCode: "scheduler_create_failed",
        status: "failed",
      }),
      createTarget({
        id: "00000000-0000-4000-8000-000000000023",
        lastErrorCode: "provider_permission_missing",
        status: "failed",
      }),
    ],
  });

  assert.equal(canRetrySchedulerCreateFailure(retryable), true);
  assert.equal(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: RENDER_ID,
      schedule: retryable,
    }).action,
    "finalize",
  );
  assert.equal(canRetrySchedulerCreateFailure(mixedFailure), false);
  assert.equal(
    getRenderFinalizationDecision({
      hasPlannedTime: true,
      renderId: RENDER_ID,
      schedule: mixedFailure,
    }).action,
    "reject",
  );
});

function createSchedule(
  overrides: Partial<ScheduledPost> = {},
): ScheduledPost {
  return {
    cancelledAt: null,
    caption: "Caption",
    createdAt: "2026-07-16T10:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000001",
    idempotencyKey: null,
    lastErrorCode: null,
    libraryItemId: null,
    mediaAssetId: "00000000-0000-4000-8000-000000000011",
    metadata: {
      combinedMediaAssetId: "00000000-0000-4000-8000-000000000011",
      combinedRenderId: RENDER_ID,
      combinedRenderStatus: "ready",
      plannedConnectionIds: "connection-1",
    },
    projectId: null,
    publishedAt: null,
    scheduledFor: null,
    sourceKind: "media_asset",
    status: "draft",
    targets: [],
    timezone: "America/New_York",
    title: "Schedule",
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
    id: "00000000-0000-4000-8000-000000000021",
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciledAt: null,
    nextRetryAt: null,
    platform: "instagram",
    platformPostId: null,
    platformPostUrl: null,
    publishJobId: "00000000-0000-4000-8000-000000000031",
    publishedAt: null,
    scheduledFor: "2026-07-17T10:00:00.000Z",
    schedulerDeletedAt: null,
    schedulerScheduleArn: null,
    schedulerScheduleName: null,
    settings: {},
    socialConnectionId: "00000000-0000-4000-8000-000000000041",
    status: "scheduled",
    updatedAt: "2026-07-16T10:00:00.000Z",
    ...overrides,
  };
}
