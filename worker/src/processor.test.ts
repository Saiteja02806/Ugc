import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { SQSClient } from "@aws-sdk/client-sqs";

import type { WorkerConfig } from "./config.js";
import { processWorkerMessage } from "./processor.js";
import type { SupabaseJobStore } from "./lib/supabase.js";
import type { BackgroundJobRow } from "./types.js";

test("only one delivery can claim and execute a background job", async () => {
  const job = createJob();
  const commands: string[] = [];
  const sqsClient = createSqsClient(commands);
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
    sqsClient,
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

test("extends SQS visibility and the database lease while a job runs", async () => {
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
    sqsClient: createSqsClient(commands),
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

function createJob(): BackgroundJobRow {
  const now = new Date().toISOString();

  return {
    attempt_count: 0,
    aws_message_id: null,
    claim_token: null,
    completed_at: null,
    created_at: now,
    error_message: null,
    id: "d8187032-2774-4aa6-9a8a-f3c46f8e0c7a",
    input_json: {},
    job_type: "test_worker_job",
    last_heartbeat_at: null,
    locked_at: null,
    output_json: null,
    project_id: null,
    queue_name: "test",
    started_at: null,
    status: "queued",
    updated_at: now,
    user_id: "user-test",
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
      if (job.status !== "queued") {
        return null;
      }

      job.claim_token = params.claimToken;
      job.last_heartbeat_at = new Date().toISOString();
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
    async markFailed() {
      throw new Error("markFailed should not be called in this test.");
    },
  };

  return store as unknown as SupabaseJobStore;
}

function createConfig(): WorkerConfig {
  return {
    allowedJobTypes: ["test_worker_job"],
    awsRegion: "us-east-2",
    pollMaxMessages: 1,
    pollWaitTimeSeconds: 0,
    queueName: "test",
    queueUrl: "https://sqs.us-east-2.amazonaws.com/123456789012/test",
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
    Body: JSON.stringify({
      jobId: "d8187032-2774-4aa6-9a8a-f3c46f8e0c7a",
      jobType: "test_worker_job",
    }),
    MessageId: "message-test",
    ReceiptHandle: "receipt-test",
  };
}

function createSqsClient(commands: string[]) {
  return {
    async send(command: object) {
      commands.push(command.constructor.name);
      return {};
    },
  } as unknown as SQSClient;
}
