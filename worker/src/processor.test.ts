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
import { RetryableJobError } from "./retryable-job-error.js";
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

function createConfig(): WorkerConfig {
  return {
    allowedJobTypes: ["test_worker_job"],
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

function createMessage() {
  return {
    body: JSON.stringify({
      jobId: "d8187032-2774-4aa6-9a8a-f3c46f8e0c7a",
      jobType: "test_worker_job",
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
