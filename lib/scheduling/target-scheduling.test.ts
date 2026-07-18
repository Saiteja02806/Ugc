import assert from "node:assert/strict";
import test from "node:test";

import { getRenderFinalizationDecision } from "./render-finalization-policy.ts";
import {
  scheduleTargetRowsWithDependencies,
  type TargetSchedulingDependencies,
} from "./target-scheduling.ts";
import type { ScheduledPost, ScheduledPostTarget } from "./types.ts";

const TARGET_ID = "00000000-0000-4000-8000-000000000101";
const JOB_ID = "00000000-0000-4000-8000-000000000102";
const RENDER_ID = "00000000-0000-4000-8000-000000000103";
const SCHEDULED_FOR = "2026-07-18T14:00:00.000Z";

test("creates and durably records the provider schedule", async () => {
  const fixture = createDependencies();

  const result = await runHandoff(fixture.dependencies);

  assert.deepEqual(result, { failedCount: 0, scheduledCount: 1 });
  assert.deepEqual(fixture.events, [
    "lead",
    "create-job",
    "attach-job",
    "create-provider-schedule",
    "mark-provider-schedule",
  ]);
});

test("uses the durable worker fallback when provider schedule creation fails", async () => {
  const fixture = createDependencies({
    async createProviderSchedule() {
      fixture.events.push("create-provider-schedule");
      throw new Error("scheduler CreateSchedule denied");
    },
  });

  const result = await runHandoff(fixture.dependencies);

  assert.deepEqual(result, { failedCount: 0, scheduledCount: 1 });
  assert.deepEqual(fixture.events.slice(-2), [
    "mark-scheduler-fallback",
    "scheduler_fallback_active",
  ]);
  assert.equal(fixture.fallback?.errorMessage, "scheduler CreateSchedule denied");
  assert.equal(fixture.fallback?.scheduleName, null);
});

test("deletes an orphaned provider schedule when database persistence loses the race", async () => {
  const fixture = createDependencies({
    async markProviderSchedule() {
      fixture.events.push("mark-provider-schedule");
      throw new Error("target was cancelled");
    },
  });

  const result = await runHandoff(fixture.dependencies);

  assert.deepEqual(result, { failedCount: 0, scheduledCount: 1 });
  assert.deepEqual(fixture.events.slice(-4), [
    "mark-provider-schedule",
    "delete-provider-schedule",
    "mark-scheduler-fallback",
    "scheduler_fallback_active",
  ]);
  assert.equal(fixture.fallback?.scheduleName, "provider-schedule-1");
  assert.equal(
    fixture.fallback?.schedulerDeletedAt,
    "2026-07-16T12:00:00.000Z",
  );
});

test("fails both the unlinked job and target when setup cannot complete", async () => {
  const fixture = createDependencies({
    async attachPublishJob() {
      fixture.events.push("attach-job");
      throw new Error("target changed before job attachment");
    },
  });

  const result = await runHandoff(fixture.dependencies);

  assert.deepEqual(result, { failedCount: 1, scheduledCount: 0 });
  assert.deepEqual(fixture.events, [
    "lead",
    "create-job",
    "attach-job",
    "fail-job",
    "fail-target",
  ]);
});

test("a ready render schedules once even when finalization is delivered twice", async () => {
  const fixture = createDependencies();
  const schedule = createSchedule();
  const firstDecision = getRenderFinalizationDecision({
    hasPlannedTime: true,
    renderId: RENDER_ID,
    schedule,
  });

  assert.equal(firstDecision.action, "finalize");
  if (firstDecision.action === "finalize") {
    await runHandoff(fixture.dependencies);
  }

  schedule.status = "scheduled";
  schedule.targets = [createTarget()];
  const duplicateDecision = getRenderFinalizationDecision({
    hasPlannedTime: true,
    renderId: RENDER_ID,
    schedule,
  });

  assert.deepEqual(duplicateDecision, { action: "already_finalized" });
  assert.equal(
    fixture.events.filter((event) => event === "create-provider-schedule").length,
    1,
  );
});

async function runHandoff(dependencies: TargetSchedulingDependencies) {
  return scheduleTargetRowsWithDependencies(
    {
      projectId: null,
      targetRows: [{ id: TARGET_ID, scheduled_for: SCHEDULED_FOR }],
      userId: "user-test",
    },
    dependencies,
  );
}

function createDependencies(
  overrides: Partial<TargetSchedulingDependencies> = {},
) {
  const events: string[] = [];
  const fixture: {
    dependencies: TargetSchedulingDependencies;
    events: string[];
    fallback: Parameters<
      TargetSchedulingDependencies["markSchedulerFallback"]
    >[0] | null;
  } = {
    dependencies: null as unknown as TargetSchedulingDependencies,
    events,
    fallback: null,
  };
  const dependencies: TargetSchedulingDependencies = {
    assertMinimumLead() {
      events.push("lead");
    },
    async attachPublishJob() {
      events.push("attach-job");
    },
    async createProviderSchedule() {
      events.push("create-provider-schedule");
      return {
        arn: "arn:aws:scheduler:us-east-2:123:schedule/provider-schedule-1",
        name: "provider-schedule-1",
      };
    },
    async createPublishJob() {
      events.push("create-job");
      return { id: JOB_ID };
    },
    async deleteProviderSchedule() {
      events.push("delete-provider-schedule");
    },
    async failPublishJob() {
      events.push("fail-job");
    },
    async failTarget() {
      events.push("fail-target");
    },
    getErrorCode() {
      return "publish_job_create_failed";
    },
    getErrorMessage(error) {
      return error instanceof Error ? error.message : "Unknown failure";
    },
    async markProviderSchedule() {
      events.push("mark-provider-schedule");
    },
    async markSchedulerFallback(params) {
      events.push("mark-scheduler-fallback");
      fixture.fallback = params;
    },
    now() {
      return "2026-07-16T12:00:00.000Z";
    },
    reportError(event) {
      events.push(event);
    },
    reportWarning(event) {
      events.push(event);
    },
    ...overrides,
  };

  fixture.dependencies = dependencies;
  return fixture;
}

function createSchedule(): ScheduledPost {
  return {
    cancelledAt: null,
    caption: "Caption",
    createdAt: "2026-07-16T10:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000104",
    idempotencyKey: null,
    lastErrorCode: null,
    libraryItemId: null,
    mediaAssetId: "00000000-0000-4000-8000-000000000105",
    metadata: {
      combinedMediaAssetId: "00000000-0000-4000-8000-000000000105",
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
    timezone: "UTC",
    title: "Schedule",
    updatedAt: "2026-07-16T10:00:00.000Z",
  };
}

function createTarget(): ScheduledPostTarget {
  return {
    attemptCount: 0,
    cancelledAt: null,
    createdAt: "2026-07-16T10:00:00.000Z",
    id: TARGET_ID,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciledAt: null,
    nextRetryAt: null,
    platform: "instagram",
    platformPostId: null,
    platformPostUrl: null,
    publishJobId: JOB_ID,
    publishedAt: null,
    scheduledFor: SCHEDULED_FOR,
    schedulerDeletedAt: null,
    schedulerScheduleArn: null,
    schedulerScheduleName: "provider-schedule-1",
    settings: {},
    socialConnectionId: "00000000-0000-4000-8000-000000000106",
    status: "scheduled",
    updatedAt: "2026-07-16T10:00:00.000Z",
  };
}
