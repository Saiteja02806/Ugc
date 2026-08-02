import "server-only";

import {
  attachQueueMessageToBackgroundJob,
  createBackgroundJobWithCreationResult,
  getBackgroundJobForUser,
  markBackgroundJobFailed,
  requestBackgroundJobCancellation,
  retryBackgroundJob,
  type BackgroundJobRecord,
  type BackgroundJobType,
  type CreateBackgroundJobInput,
} from "./background-jobs";
import { enqueueBackgroundJobCloudTask } from "./gcp-cloud-tasks";
import { getQueueNameForJobType } from "@/lib/queues/config";

export async function createAndDispatchBackgroundJob(
  input: Omit<CreateBackgroundJobInput, "queueName">,
  options?: {
    beforeDispatch?: (job: BackgroundJobRecord) => Promise<void>;
  },
) {
  const result = await createBackgroundJobWithCreationResult({
    ...input,
    queueName: getQueueNameForJobType(input.jobType),
  });

  try {
    await options?.beforeDispatch?.(result.job);
  } catch (error) {
    if (result.created) {
      await markBackgroundJobFailed({
        errorCode: "PRE_DISPATCH_PERSISTENCE_FAILED",
        errorMessage: getInternalErrorMessage(error),
        jobId: result.job.id,
      }).catch(() => undefined);
    }

    throw error;
  }

  if (!result.created || result.job.queueMessageId) {
    return result.job;
  }

  return dispatchBackgroundJob(result.job);
}

export async function retryAndDispatchBackgroundJob(params: {
  jobId: string;
  userId: string;
}) {
  const job = await retryBackgroundJob(params);

  if (!job) {
    return null;
  }

  return dispatchBackgroundJob(job);
}

export async function cancelBackgroundJobForUser(params: {
  jobId: string;
  userId: string;
}) {
  return requestBackgroundJobCancellation(params);
}

export async function assertBackgroundJobOwner(params: {
  jobId: string;
  userId: string;
}) {
  return getBackgroundJobForUser(params);
}

export function isPubliclyCreatableJobType(
  jobType: string,
): jobType is Extract<BackgroundJobType, "test_worker_job"> {
  return jobType === "test_worker_job";
}

async function dispatchBackgroundJob(
  job: BackgroundJobRecord,
) {
  let delivery;

  try {
    delivery = await enqueueBackgroundJobCloudTask(job);
  } catch (error) {
    await markBackgroundJobFailed({
      errorCode: "QUEUE_DELIVERY_FAILED",
      errorMessage: getInternalErrorMessage(error),
      jobId: job.id,
    });
    throw error;
  }

  try {
    return await attachQueueMessageToBackgroundJob({
      jobId: job.id,
      queueMessageId: delivery.messageId,
    });
  } catch (error) {
    // The task already exists and can safely execute from the durable queued row.
    console.error("Cloud Task created but delivery metadata was not attached:", {
      error: getInternalErrorMessage(error),
      jobId: job.id,
      taskName: delivery.messageId,
    });
    return job;
  }
}

function getInternalErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Background job dispatch failed.";
}
