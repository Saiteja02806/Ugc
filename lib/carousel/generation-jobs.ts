import "server-only";

import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import { updateCarouselGeneration } from "@/lib/carousel/db";
import type { CarouselRenderStyle } from "@/lib/carousel/render-style";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { sendBackgroundJobMessageWithBestEffortAttachment } from "@/lib/jobs/background-job-message-delivery";
import {
  attachQueueMessageToBackgroundJob,
  claimBackgroundJobDelivery,
  createBackgroundJobWithCreationResult,
  createOrGetCarouselExperimentBatchJob,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";

const CAROUSEL_JOB_TYPE = "generate_carousel";

export function getMissingCarouselGenerationEnvVars() {
  const missing = new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingJobQueueEnvVars([CAROUSEL_JOB_TYPE]),
  ]);

  return Array.from(missing);
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
    if (!creationResult.created) {
      throw error;
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to queue carousel generation.";

    await markBackgroundJobFailed({
      errorMessage,
      jobId: job.id,
    }).catch((persistenceError) => {
      console.error(
        "Failed to persist carousel background job enqueue failure:",
        persistenceError,
      );
    });

    await updateCarouselGeneration(params.carouselId, {
      error_message: "Could not start the carousel generation worker.",
      status: "failed",
    }).catch((persistenceError) => {
      console.error(
        "Failed to mark carousel generation enqueue failure:",
        persistenceError,
      );
    });

    throw error;
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
    if (creationResult.created) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to queue Carousel experiment.";
      await markBackgroundJobFailed({ errorMessage, jobId: job.id }).catch(() => undefined);
      await Promise.all(
        params.carouselIds.map((carouselId) =>
          updateCarouselGeneration(carouselId, {
            error_message: "Could not start the Carousel experiment worker.",
            status: "failed",
          }).catch(() => undefined),
        ),
      );
    }
    throw error;
  }
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
