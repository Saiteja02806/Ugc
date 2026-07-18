import "server-only";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/aws/sqs";
import { updateCarouselGeneration } from "@/lib/carousel/db";
import type { CarouselRenderStyle } from "@/lib/carousel/render-style";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { sendBackgroundJobMessageWithBestEffortAttachment } from "@/lib/jobs/background-job-message-delivery";
import {
  attachAwsMessageToBackgroundJob,
  claimBackgroundJobDelivery,
  createBackgroundJobWithCreationResult,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";

const CAROUSEL_JOB_TYPE = "generate_carousel";

export function getMissingCarouselAwsEnvVars() {
  return getMissingCarouselGenerationEnvVars();
}

export function getMissingCarouselGenerationEnvVars() {
  const missing = new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingSqsEnvVars([CAROUSEL_JOB_TYPE]),
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
      attachMessage: (awsMessageId) =>
        attachAwsMessageToBackgroundJob({
          awsMessageId,
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
