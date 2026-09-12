import assert from "node:assert/strict";
import { mock, test } from "node:test";

const carouselIds = [
  "carousel-1",
  "carousel-2",
  "carousel-3",
  "carousel-4",
  "carousel-5",
] as const;

let missingQueueEnvVars: string[] = [];
let missingStorageEnvVars: string[] = [];
let createBatchJobCalls = 0;
let sendCalls = 0;
let deliveryShouldFail = false;
const events: Array<{ eventType: string; jobId: string; metadata?: object }> = [];

const queuedBatchJob = {
  id: "job-1",
  input: {
    carouselIds: [...carouselIds],
    experimentBatchId: "batch-1",
  },
  jobType: "generate_carousel",
  projectId: "project-1",
  status: "queued",
  userId: "user-1",
};

mock.module("@/lib/queues/job-queue", {
  namedExports: {
    getMissingJobQueueEnvVars: () => missingQueueEnvVars,
    getQueueNameForJobType: () => "carousel",
    sendJobMessage: async () => {
      sendCalls += 1;
      if (deliveryShouldFail) {
        throw new Error("simulated Cloud Tasks transport timeout");
      }

      return "queue-message-1";
    },
  },
});

mock.module("@/lib/jobs/background-job-delivery-logic", {
  namedExports: {
    shouldDeliverCarouselJobMessage: () => true,
  },
});

mock.module("@/lib/jobs/background-job-message-delivery", {
  namedExports: {
    sendBackgroundJobMessageWithBestEffortAttachment: async (params: {
      sendMessage: () => Promise<string>;
    }) => params.sendMessage(),
  },
});

mock.module("@/lib/jobs/background-jobs", {
  namedExports: {
    appendBackgroundJobEvent: async (params: {
      eventType: string;
      jobId: string;
      metadata?: object;
    }) => {
      events.push(params);
      return "event-1";
    },
    attachQueueMessageToBackgroundJob: async () => undefined,
    claimBackgroundJobDelivery: async () => queuedBatchJob,
    createBackgroundJobWithCreationResult: async () => ({
      created: true,
      job: queuedBatchJob,
    }),
    createOrGetCarouselExperimentBatchJob: async () => {
      createBatchJobCalls += 1;
      return { created: true, job: queuedBatchJob };
    },
    getBackgroundJobById: async () => null,
    getMissingBackgroundJobStorageEnvVars: () => missingStorageEnvVars,
  },
});

const { CarouselGenerationConfigurationError, enqueueCarouselExperimentBatchJob } =
  await import("./generation-jobs.ts");

function resetSimulation() {
  createBatchJobCalls = 0;
  deliveryShouldFail = false;
  events.length = 0;
  missingQueueEnvVars = [];
  missingStorageEnvVars = [];
  sendCalls = 0;
}

test("simulates the historical missing Carousel task URL before any five-item batch is persisted", async () => {
  resetSimulation();
  missingQueueEnvVars = ["GCP_CAROUSEL_TASK_URL or GCP_BACKGROUND_JOB_TASK_URL"];

  await assert.rejects(
    enqueueCarouselExperimentBatchJob({
      carouselIds,
      experimentBatchId: "batch-1",
      projectId: "project-1",
      textStyle: "plain",
      userId: "user-1",
    }),
    (error: unknown) =>
      error instanceof CarouselGenerationConfigurationError &&
      error.missingEnvVars.includes(
        "GCP_CAROUSEL_TASK_URL or GCP_BACKGROUND_JOB_TASK_URL",
      ),
  );

  assert.equal(createBatchJobCalls, 0);
  assert.equal(sendCalls, 0);
  assert.deepEqual(events, []);
});

test("simulates an ambiguous five-Carousel Cloud Tasks failure without terminalizing customer work", async () => {
  resetSimulation();
  deliveryShouldFail = true;

  const jobId = await enqueueCarouselExperimentBatchJob({
    carouselIds,
    experimentBatchId: "batch-1",
    projectId: "project-1",
    textStyle: "plain",
    userId: "user-1",
  });

  assert.equal(jobId, queuedBatchJob.id);
  assert.equal(createBatchJobCalls, 1);
  assert.equal(sendCalls, 1);
  assert.deepEqual(events, [
    {
      eventType: "queue_delivery_deferred",
      jobId: queuedBatchJob.id,
      metadata: {
        errorMessage: "simulated Cloud Tasks transport timeout",
        scope: "experiment_batch",
      },
    },
  ]);
});
