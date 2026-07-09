import "server-only";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/aws/sqs";
import { updateCarouselGeneration } from "@/lib/carousel/db";
import type { CarouselRenderStyle } from "@/lib/carousel/render-style";
import {
  attachAwsMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";

const CAROUSEL_JOB_TYPE = "generate_carousel";

export function getMissingCarouselAwsEnvVars() {
  const missing = new Set([
    ...getMissingBackgroundJobStorageEnvVars(),
    ...getMissingSqsEnvVars([CAROUSEL_JOB_TYPE]),
  ]);

  if (!process.env.AWS_S3_BUCKET?.trim()) {
    missing.add("AWS_S3_BUCKET");
  }

  if (!process.env.CLOUDFRONT_DOMAIN?.trim()) {
    missing.add("CLOUDFRONT_DOMAIN");
  }

  return Array.from(missing);
}

export async function enqueueCarouselGenerationJob(params: {
  candidateCount: number;
  candidateIndex: number;
  carouselId: string;
  projectId: string;
  textStyle: CarouselRenderStyle;
  userId: string;
}) {
  const job = await createBackgroundJob({
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

  try {
    const message = await sendJobMessage({
      jobId: job.id,
      jobType: CAROUSEL_JOB_TYPE,
    });

    const updatedJob = await attachAwsMessageToBackgroundJob({
      awsMessageId: message.messageId,
      jobId: job.id,
    });

    return updatedJob.id;
  } catch (error) {
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
