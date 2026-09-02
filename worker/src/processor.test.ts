import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { WorkerConfig } from "./config.js";
import {
  processRecoveredWorkerJob,
  processWorkerMessage,
} from "./processor.js";
import type { WorkerQueueTransport } from "./lib/queue-types.js";
import type { SupabaseJobStore } from "./lib/supabase.js";
import { toContentPlanProviderRetry } from "./lib/content-plan-provider-retry.js";
import { EmptyWallTextContentPlanResponseError } from "./lib/wall-text-content-plan.js";
import { toWallTextContentPlanRetry } from "./jobs/generate-wall-text-content-plan.js";
import { DeferredJobError, RetryableJobError } from "./retryable-job-error.js";
import type { BackgroundJobRow } from "./types.js";

test("only one delivery can claim and execute a background job", async () => {
  const job = createJob();
  const commands: string[] = [];
  const queue = createQueue(commands);
  let handlerCalls = 0;
  let releaseHandler!: () => void;
  let notifyHandlerStarted!: () => void;
  const handlerStarted = new Promise<void>((resolve) => {
    notifyHandlerStarted = resolve;
  });
  const handlerGate = new Promise<void>((resolve) => {
    releaseHandler = resolve;
  });
  const store = createJobStore(job);
  const params = {
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 1_000,
      async runJob() {
        handlerCalls += 1;
        notifyHandlerStarted();
        await handlerGate;
        return { ok: true };
      },
    },
    message: createMessage(),
    queue,
    store,
  };

  const firstDelivery = processWorkerMessage(params);
  await handlerStarted;
  await processWorkerMessage(params);

  assert.equal(handlerCalls, 1);
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    0,
  );

  releaseHandler();
  await firstDelivery;

  assert.equal(job.status, "completed");
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    1,
  );
});

test("extends queue visibility and the database lease while a job runs", async () => {
  const job = createJob();
  const commands: string[] = [];
  const store = createJobStore(job);
  let databaseHeartbeats = 0;
  const originalHeartbeat = store.heartbeatJob.bind(store);

  store.heartbeatJob = (async (params) => {
    databaseHeartbeats += 1;
    return originalHeartbeat(params);
  }) as SupabaseJobStore["heartbeatJob"];

  await processWorkerMessage({
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 5,
      async runJob() {
        await delay(35);
        return { ok: true };
      },
    },
    message: createMessage(),
    queue: createQueue(commands),
    store,
  });

  assert.ok(databaseHeartbeats >= 2);
  assert.ok(
    commands.filter((name) => name === "ChangeMessageVisibilityCommand")
      .length >= 2,
  );
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    1,
  );
});

test("persists retry state and keeps the queue delivery", async () => {
  const job = createJob();
  const commands: string[] = [];

  await processWorkerMessage({
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 1_000,
      async runJob() {
        throw new RetryableJobError("Temporary provider outage.", {
          code: "provider_publish_failed",
          now: 0,
          retryAfterSeconds: 30,
        });
      },
    },
    message: createMessage(),
    queue: createQueue(commands),
    store: createJobStore(job),
  });

  assert.equal(job.status, "queued");
  assert.equal(job.attempt_count, 1);
  assert.equal(job.next_attempt_at, "1970-01-01T00:00:30.000Z");
  assert.equal(
    commands.filter((name) => name === "ChangeMessageVisibilityCommand").length,
    1,
  );
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    0,
  );
});

test("requeues an interrupted content-plan request instead of terminally failing it", async () => {
  const job = createJob();
  const commands: string[] = [];

  await processWorkerMessage({
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 1_000,
      async runJob() {
        throw toContentPlanProviderRetry({
          message: "Request timed out.",
          name: "APIConnectionTimeoutError",
        });
      },
    },
    message: createMessage(),
    queue: createQueue(commands),
    store: createJobStore(job),
  });

  assert.equal(job.status, "queued");
  assert.equal(job.attempt_count, 1);
  assert.match(job.error_message ?? "", /will resume from its last saved chunk/);
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    0,
  );
});

test("does not retry an invalid content-plan provider request", () => {
  const error = Object.assign(new Error("The request schema is invalid."), {
    status: 400,
  });

  assert.equal(toContentPlanProviderRetry(error), error);
});

test("requeues an empty Wall Text model response without losing the plan", async () => {
  const job = createJob();
  const commands: string[] = [];
  job.job_type = "wall_text_content_plan_generation";
  job.input_json = {
    operation: "wall_text_content_plan_generation",
    planId: "plan-test",
    userId: "user-test",
  };

  await processWorkerMessage({
    config: createConfig(["wall_text_content_plan_generation"]),
    dependencies: {
      async runJob() {
        throw toWallTextContentPlanRetry(
          new EmptyWallTextContentPlanResponseError(null),
        );
      },
    },
    message: createMessage("wall_text_content_plan_generation"),
    queue: createQueue(commands),
    store: createJobStore(job),
  });

  assert.equal(job.status, "queued");
  assert.equal(job.attempt_count, 1);
  assert.match(job.error_message ?? "", /returned no content/);
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    0,
  );
});

test("defers expected lane backpressure without consuming a retry attempt", async () => {
  const job = createJob();
  const commands: string[] = [];
  const store = createJobStore(job);

  store.deferJob = (async (params) => {
    if (job.claim_token !== params.claimToken || job.status !== "processing") {
      return null;
    }

    job.claim_token = null;
    job.error_message = params.errorMessage;
    job.next_attempt_at = params.retryAt;
    job.status = "queued";
    return { ...job };
  }) as SupabaseJobStore["deferJob"];

  await processWorkerMessage({
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 1_000,
      async runJob() {
        throw new DeferredJobError("Another post is publishing.", {
          code: "social_publish_account_lane_busy",
          now: 0,
          retryAfterSeconds: 30,
        });
      },
    },
    message: createMessage(),
    queue: createQueue(commands),
    store,
  });

  assert.equal(job.status, "queued");
  assert.equal(job.attempt_count, 0);
  assert.equal(job.next_attempt_at, "1970-01-01T00:00:30.000Z");
  assert.equal(
    commands.filter((name) => name === "ChangeMessageVisibilityCommand").length,
    1,
  );
});

test("retries an atomic completion failure without losing the saved output", async () => {
  const job = createJob();
  const commands: string[] = [];
  const store = createJobStore(job);

  store.markCompleted = (async () => {
    throw new Error("temporary database outage");
  }) as SupabaseJobStore["markCompleted"];

  await processWorkerMessage({
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 1_000,
      async runJob() {
        return { key: "generated/output.png", ok: true };
      },
    },
    message: createMessage(),
    queue: createQueue(commands),
    store,
  });

  assert.equal(job.status, "queued");
  assert.equal(job.attempt_count, 1);
  assert.equal(job.error_message?.includes("database record"), true);
  assert.equal(
    commands.filter((name) => name === "ChangeMessageVisibilityCommand").length,
    1,
  );
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    0,
  );
});

test("defers an early duplicate delivery until the stored retry time", async () => {
  const job = createJob();
  const commands: string[] = [];
  let handlerCalls = 0;
  job.next_attempt_at = new Date(Date.now() + 30_000).toISOString();

  await processWorkerMessage({
    config: createConfig(),
    dependencies: {
      async runJob() {
        handlerCalls += 1;
        return { ok: true };
      },
    },
    message: createMessage(),
    queue: createQueue(commands),
    store: createJobStore(job),
  });

  assert.equal(handlerCalls, 0);
  assert.equal(job.status, "queued");
  assert.equal(
    commands.filter((name) => name === "ChangeMessageVisibilityCommand").length,
    1,
  );
  assert.equal(
    commands.filter((name) => name === "DeleteMessageCommand").length,
    0,
  );
});

test("recovers and completes a due database job without a queue delivery", async () => {
  const job = createJob();
  let handlerCalls = 0;

  const completed = await processRecoveredWorkerJob({
    config: createConfig(),
    dependencies: {
      heartbeatIntervalMs: 1_000,
      async runJob() {
        handlerCalls += 1;
        return { recovered: true };
      },
    },
    jobId: job.id,
    store: createJobStore(job),
  });

  assert.equal(completed, true);
  assert.equal(handlerCalls, 1);
  assert.equal(job.status, "completed");
});

test("reconciles a completed Trending job without waiting for a browser request", async () => {
  const job = createJob();
  const reconciled: Array<{ sourceJobId: string; userId: string }> = [];
  job.job_type = "generate_trending_hook_copy";

  await processWorkerMessage({
    config: createConfig(["generate_trending_hook_copy"]),
    dependencies: {
      async reconcileTrendingFeed(params) {
        reconciled.push(params);
      },
      async runJob() {
        return { ok: true };
      },
    },
    message: createMessage("generate_trending_hook_copy"),
    queue: createQueue([]),
    store: createJobStore(job),
  });

  assert.equal(job.status, "completed");
  assert.deepEqual(reconciled, [{ sourceJobId: job.id, userId: "user-test" }]);
});

test("keeps a completed Trending source job complete and reschedules its durable follow-up", async () => {
  const job = createJob();
  const store = createJobStore(job);
  const rescheduled: Array<{ message: string; sourceJobId: string }> = [];
  job.job_type = "generate_trending_hook_copy";
  store.rescheduleTrendingFeedReconciliation = (async (params) => {
    rescheduled.push(params);
    return true;
  }) as SupabaseJobStore["rescheduleTrendingFeedReconciliation"];

  await processWorkerMessage({
    config: createConfig(["generate_trending_hook_copy"]),
    dependencies: {
      async reconcileTrendingFeed() {
        throw new Error("app temporarily unavailable");
      },
      async runJob() {
        return { ok: true };
      },
    },
    message: createMessage("generate_trending_hook_copy"),
    queue: createQueue([]),
    store,
  });

  assert.equal(job.status, "completed");
  assert.deepEqual(rescheduled, [
    {
      message: "app temporarily unavailable",
      sourceJobId: job.id,
    },
  ]);
});

test("marks a failed content plan terminally failed only after the worker job fails", async () => {
  const job = createJob();
  const store = createJobStore(job);
  const failures: Array<{ planId: string; userId: string }> = [];
  job.job_type = "carousel_content_plan_generation";
  job.input_json = {
    operation: "carousel_content_plan_generation",
    planId: "plan-test",
    userId: "user-test",
  };

  store.markFailed = (async () => {
    job.claim_token = null;
    job.status = "failed";
    return { ...job };
  }) as SupabaseJobStore["markFailed"];
  store.failCarouselContentPlanGeneration = (async (params) => {
    failures.push({ planId: params.planId, userId: params.userId });
  }) as SupabaseJobStore["failCarouselContentPlanGeneration"];

  await processWorkerMessage({
    config: createConfig(["carousel_content_plan_generation"]),
    dependencies: {
      async runJob() {
        throw new Error("provider rejected request");
      },
    },
    message: createMessage("carousel_content_plan_generation"),
    queue: createQueue([]),
    store,
  });

  assert.equal(job.status, "failed");
  assert.deepEqual(failures, [{ planId: "plan-test", userId: "user-test" }]);
});

test("marks a failed Wall content plan terminally failed only after the worker job fails", async () => {
  const job = createJob();
  const store = createJobStore(job);
  const failures: Array<{ planId: string; userId: string }> = [];
  job.job_type = "wall_text_content_plan_generation";
  job.input_json = {
    operation: "wall_text_content_plan_generation",
    planId: "wall-plan-test",
    userId: "user-test",
  };

  store.markFailed = (async () => {
    job.claim_token = null;
    job.status = "failed";
    return { ...job };
  }) as SupabaseJobStore["markFailed"];
  store.failWallTextContentPlanGeneration = (async (params) => {
    failures.push({ planId: params.planId, userId: params.userId });
  }) as SupabaseJobStore["failWallTextContentPlanGeneration"];

  await processWorkerMessage({
    config: createConfig(["wall_text_content_plan_generation"]),
    dependencies: {
      async runJob() {
        throw new Error("provider rejected request");
      },
    },
    message: createMessage("wall_text_content_plan_generation"),
    queue: createQueue([]),
    store,
  });

  assert.equal(job.status, "failed");
  assert.deepEqual(failures, [
    { planId: "wall-plan-test", userId: "user-test" },
  ]);
});

test("returns a failed Hook chunk to the durable continuation path after its worker job fails", async () => {
  const job = createJob();
  const store = createJobStore(job);
  const failures: Array<{ errorMessage: string; jobId: string }> = [];
  job.job_type = "generate_trending_hook_copy";

  store.markFailed = (async () => {
    job.claim_token = null;
    job.status = "failed";
    return { ...job };
  }) as SupabaseJobStore["markFailed"];
  store.failTrendingHookGenerationRunChunk = (async (params) => {
    failures.push(params);
    return true;
  }) as SupabaseJobStore["failTrendingHookGenerationRunChunk"];

  await processWorkerMessage({
    config: createConfig(["generate_trending_hook_copy"]),
    dependencies: {
      async runJob() {
        throw new Error("provider rejected request");
      },
    },
    message: createMessage("generate_trending_hook_copy"),
    queue: createQueue([]),
    store,
  });

  assert.equal(job.status, "failed");
  assert.deepEqual(failures, [
    { errorMessage: "provider rejected request", jobId: job.id },
  ]);
});

function createJob(): BackgroundJobRow {
  const now = new Date().toISOString();

  return {
    attempt_count: 0,
    cancel_requested_at: null,
    queue_message_id: null,
    claim_token: null,
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: "d8187032-2774-4aa6-9a8a-f3c46f8e0c7a",
    input_json: {},
    input_reference: null,
    job_type: "test_worker_job",
    last_delivery_at: null,
    last_heartbeat_at: null,
    locked_at: null,
    max_attempts: 3,
    next_attempt_at: null,
    output_json: null,
    output_reference: null,
    progress: null,
    project_id: null,
    queue_name: "test",
    queue_provider: "gcp",
    queued_at: now,
    stage: "queued",
    started_at: null,
    status: "queued",
    updated_at: now,
    user_id: "user-test",
    worker_execution_id: null,
    worker_id: null,
  };
}

function createJobStore(job: BackgroundJobRow) {
  const store = {
    async claimJob(params: {
      claimToken: string;
      jobId: string;
      staleAfterSeconds: number;
      workerId: string;
    }) {
      if (
        job.status !== "queued" ||
        (job.next_attempt_at !== null &&
          Date.parse(job.next_attempt_at) > Date.now())
      ) {
        return null;
      }

      job.claim_token = params.claimToken;
      job.last_heartbeat_at = new Date().toISOString();
      job.stage = "processing";
      job.status = "processing";
      job.worker_id = params.workerId;
      return { ...job };
    },
    async getJobById(jobId: string) {
      return jobId === job.id ? { ...job } : null;
    },
    async heartbeatJob(params: { claimToken: string; jobId: string }) {
      if (
        job.id !== params.jobId ||
        job.claim_token !== params.claimToken ||
        job.status !== "processing"
      ) {
        return false;
      }

      job.last_heartbeat_at = new Date().toISOString();
      return true;
    },
    async markCompleted(params: { claimToken: string; jobId: string }) {
      if (
        job.id !== params.jobId ||
        job.claim_token !== params.claimToken ||
        job.status !== "processing"
      ) {
        return null;
      }

      job.claim_token = null;
      job.status = "completed";
      return { ...job };
    },
    async claimTrendingFeedReconciliation(params: { sourceJobId: string }) {
      return params.sourceJobId === job.id
        ? {
            attempt_count: 1,
            source_job_id: job.id,
            user_id: job.user_id ?? "",
          }
        : null;
    },
    async completeTrendingFeedReconciliation() {
      return true;
    },
    async rescheduleTrendingFeedReconciliation() {
      return true;
    },
    async updateJobStage(params: {
      claimToken: string;
      jobId: string;
      progress?: number | null;
      stage: string;
      status: BackgroundJobRow["status"];
    }) {
      if (
        job.id !== params.jobId ||
        job.claim_token !== params.claimToken ||
        job.status === "cancel_requested"
      ) {
        return null;
      }

      job.progress = params.progress ?? null;
      job.stage = params.stage;
      job.status = params.status;
      return { ...job };
    },
    async markCancelled() {
      job.claim_token = null;
      job.stage = "cancelled";
      job.status = "cancelled";
      return { ...job };
    },
    async markFailed() {
      throw new Error("markFailed should not be called in this test.");
    },
    async markRetrying(params: {
      claimToken: string;
      errorMessage: string;
      retryAt: string;
    }) {
      if (
        job.claim_token !== params.claimToken ||
        job.status !== "processing"
      ) {
        return null;
      }

      job.attempt_count += 1;
      job.claim_token = null;
      job.error_message = params.errorMessage;
      job.next_attempt_at = params.retryAt;
      job.status = "queued";
      return { ...job };
    },
  };

  return store as unknown as SupabaseJobStore;
}

function createConfig(
  allowedJobTypes: WorkerConfig["allowedJobTypes"] = ["test_worker_job"],
): WorkerConfig {
  return {
    allowedJobTypes,
    queueName: "test",
    socialReconciliationBatchSize: 10,
    socialReconciliationEnabled: true,
    socialReconciliationIntervalSeconds: 15,
    supabaseServiceRoleKey: "test",
    supabaseUrl: "https://example.supabase.co",
    visibilityTimeoutSeconds: 60,
    workerGitCommit: "test",
    workerId: "worker-test",
    workerRunOnce: true,
    workerVersion: "test",
  };
}

function createMessage(jobType: BackgroundJobRow["job_type"] = "test_worker_job") {
  return {
    body: JSON.stringify({
      jobId: "d8187032-2774-4aa6-9a8a-f3c46f8e0c7a",
      jobType,
    }),
    id: "message-test",
    ackId: "ack-test",
    providerName: "gcp" as const,
  };
}

function createQueue(commands: string[]): WorkerQueueTransport {
  return {
    async changeMessageVisibility() {
      commands.push("ChangeMessageVisibilityCommand");
    },
    async deleteMessage() {
      commands.push("DeleteMessageCommand");
    },
    providerName: "gcp",
    async receiveMessages() {
      return [];
    },
  };
}
