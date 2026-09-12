import "server-only";

import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import type { CarouselRenderStyle } from "@/lib/carousel/render-style";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { sendBackgroundJobMessageWithBestEffortAttachment } from "@/lib/jobs/background-job-message-delivery";
import {
  appendBackgroundJobEvent,
  attachQueueMessageToBackgroundJob,
  claimBackgroundJobDelivery,
  createBackgroundJobWithCreationResult,
  createOrGetCarouselExperimentBatchJob,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
} from "@/lib/jobs/background-jobs";

const CAROUSEL_JOB_TYPE = "generate_carousel";

export function getMissingCarouselGenerationEnvVars() {
  const missing = new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingJobQueueEnvVars([CAROUSEL_JOB_TYPE]),
  ]);

  return Array.from(missing);
}

export class CarouselGenerationConfigurationError extends Error {
  readonly missingEnvVars: string[];

  constructor(missingEnvVars: string[]) {
    super(
      `Carousel generation is unavailable because required queue configuration is missing: ${missingEnvVars.join(", ")}.`,
    );
    this.name = "CarouselGenerationConfigurationError";
    this.missingEnvVars = missingEnvVars;
  }
}

/**
 * Fail before a generation row, plan reservation, or durable job is created.
 * The worker cannot repair an app-side Cloud Tasks configuration error, and
 * consuming a customer's Carousel slot before a task exists would make that
 * configuration error look like a content-generation failure.
 */
export function assertCarouselGenerationRuntimeConfigured() {
  const missingEnvVars = getMissingCarouselGenerationEnvVars();

  if (missingEnvVars.length > 0) {
    throw new CarouselGenerationConfigurationError(missingEnvVars);
  }
}

export async function enqueueCarouselGenerationJob(params: {
  candidateCount: number;
  candidateIndex: number;
  carouselId: string;
  existingJobId?: string | null;
  projectId: string;
  textStyle: CarouselRenderStyle;
  userId: string;
}) {
  assertCarouselGenerationRuntimeConfigured();

  const existingJob = params.existingJobId
    ? await getBackgroundJobById(params.existingJobId)
    : null;
  const creationResult = existingJob
    ? { created: false as const, job: existingJob }
    : await createBackgroundJobWithCreationResult({
        idempotencyKey: `carousel-generation:${params.carouselId}`,
        input: {
          candidateCount: params.candidateCount,
          candidateIndex: params.candidateIndex,
          carouselId: params.carouselId,
          textStyle: params.textStyle,
        },
        jobType: CAROUSEL_JOB_TYPE,
        projectId: params.projectId,
        queueName: getQueueNameForJobType(CAROUSEL_JOB_TYPE),
        userId: params.userId,
      });
  const job = creationResult.job;

  if (existingJob && !isMatchingCarouselGenerationJob(existingJob, params)) {
    throw new Error("Existing Carousel generation job ownership does not match.");
  }

  if (job.status === "completed") {
    return job.id;
  }

  if (
    !shouldDeliverCarouselJobMessage({
      job,
      wasJustCreated: creationResult.created,
    })
  ) {
    if (job.status === "queued" || job.status === "processing") {
      return job.id;
    }

    throw new Error(
      `Carousel generation job ${job.id} is already ${job.status}.`,
    );
  }

  const claimedJob = await claimBackgroundJobDelivery(job);

  if (!claimedJob) {
    return job.id;
  }

  try {
    return await sendBackgroundJobMessageWithBestEffortAttachment({
      attachMessage: (queueMessageId) =>
        attachQueueMessageToBackgroundJob({
          queueMessageId,
          jobId: job.id,
        }),
      jobId: job.id,
      onAttachmentError: (persistenceError) => {
        console.error(
          "Carousel job was sent but its queue message id could not be persisted:",
          persistenceError,
        );
      },
      sendMessage: () =>
        sendJobMessage({
          jobId: job.id,
          jobType: CAROUSEL_JOB_TYPE,
        }),
    });
  } catch (error) {
    return preserveCarouselJobForDeliveryRecovery({
      error,
      jobId: job.id,
      scope: "single_generation",
    });
  }
}

export async function enqueueCarouselExperimentBatchJob(params: {
  carouselIds: readonly string[];
  existingJobId?: string | null;
  experimentBatchId: string;
  projectId: string;
  textStyle: CarouselRenderStyle;
  userId: string;
}) {
  assertCarouselGenerationRuntimeConfigured();

  if (params.carouselIds.length !== 5 || new Set(params.carouselIds).size !== 5) {
    throw new Error("A Carousel experiment job requires exactly five unique Carousel IDs.");
  }

  const creationResult = await createOrGetCarouselExperimentBatchJob({
    carouselIds: [...params.carouselIds],
    experimentBatchId: params.experimentBatchId,
    projectId: params.projectId,
    textStyle: params.textStyle,
    userId: params.userId,
  });
  const job = creationResult.job;

  if (
    params.existingJobId &&
    params.existingJobId !== job.id
  ) {
    throw new Error("Existing Carousel experiment job ownership does not match.");
  }

  if (!isMatchingCarouselExperimentBatchJob(job, params)) {
    throw new Error("Carousel experiment job ownership does not match.");
  }

  if (job.status === "completed") return job.id;

  if (!shouldDeliverCarouselJobMessage({ job, wasJustCreated: creationResult.created })) {
    if (job.status === "queued" || job.status === "processing") return job.id;
    throw new Error(`Carousel experiment job ${job.id} is already ${job.status}.`);
  }

  const claimedJob = await claimBackgroundJobDelivery(job);
  if (!claimedJob) return job.id;

  try {
    return await sendBackgroundJobMessageWithBestEffortAttachment({
      attachMessage: (queueMessageId) =>
        attachQueueMessageToBackgroundJob({ queueMessageId, jobId: job.id }),
      jobId: job.id,
      onAttachmentError: (persistenceError) => {
        console.error(
          "Carousel experiment job was sent but its queue message id could not be persisted:",
          persistenceError,
        );
      },
      sendMessage: () => sendJobMessage({ jobId: job.id, jobType: CAROUSEL_JOB_TYPE }),
    });
  } catch (error) {
    return preserveCarouselJobForDeliveryRecovery({
      error,
      jobId: job.id,
      scope: "experiment_batch",
    });
  }
}

async function preserveCarouselJobForDeliveryRecovery(params: {
  error: unknown;
  jobId: string;
  scope: "experiment_batch" | "single_generation";
}) {
  const errorMessage =
    params.error instanceof Error
      ? params.error.message
      : "Carousel task delivery could not be confirmed.";

  // Cloud Tasks can fail after accepting a request, so immediately retrying or
  // terminalizing here can respectively duplicate work or lose it. The durable
  // job remains queued; the existing stale-delivery lease and worker claim
  // provide the bounded, idempotent recovery path.
  console.error("Carousel task delivery deferred for durable recovery:", {
    error: errorMessage,
    jobId: params.jobId,
    scope: params.scope,
  });

  await appendBackgroundJobEvent({
    eventType: "queue_delivery_deferred",
    jobId: params.jobId,
    metadata: {
      errorMessage,
      scope: params.scope,
    },
  }).catch((eventError) => {
    console.error("Could not record deferred Carousel task delivery:", {
      error: eventError,
      jobId: params.jobId,
      scope: params.scope,
    });
  });

  return params.jobId;
}

function isMatchingCarouselGenerationJob(
  job: NonNullable<Awaited<ReturnType<typeof getBackgroundJobById>>>,
  params: {
    carouselId: string;
    projectId: string;
    userId: string;
  },
) {
  const input = job.input;

  return (
    job.jobType === CAROUSEL_JOB_TYPE &&
    job.projectId === params.projectId &&
    job.userId === params.userId &&
    Boolean(
      input &&
        typeof input === "object" &&
        !Array.isArray(input) &&
        input.carouselId === params.carouselId,
    )
  );
}

function isMatchingCarouselExperimentBatchJob(
  job: NonNullable<Awaited<ReturnType<typeof getBackgroundJobById>>>,
  params: {
    carouselIds: readonly string[];
    experimentBatchId: string;
    projectId: string;
    userId: string;
  },
) {
  const input = job.input;
  const storedCarouselIds =
    input && typeof input === "object" && !Array.isArray(input)
      ? input.carouselIds
      : null;

  return (
    job.jobType === CAROUSEL_JOB_TYPE &&
    job.projectId === params.projectId &&
    job.userId === params.userId &&
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    input.experimentBatchId === params.experimentBatchId &&
    Array.isArray(storedCarouselIds) &&
    storedCarouselIds.length === params.carouselIds.length &&
    storedCarouselIds.every((id, index) => id === params.carouselIds[index])
  );
}
