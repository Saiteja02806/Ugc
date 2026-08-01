import "server-only";

import {
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { sendBackgroundJobMessageWithBestEffortAttachment } from "@/lib/jobs/background-job-message-delivery";
import {
  attachQueueMessageToBackgroundJob,
  claimBackgroundJobDelivery,
  createBackgroundJobWithCreationResult,
  markBackgroundJobFailed,
  type Json,
} from "@/lib/jobs/background-jobs";
import {
  TRENDING_HOOK_COPY_JOB_TYPE,
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
} from "@/lib/trending/trending-hook-copy-contract";

export async function enqueueTrendingHookCopyJob(params: {
  businessProfile: unknown;
  businessProfileId: string;
  businessProfileVersion: number;
  candidates: Array<Record<string, Json>>;
  sourceSelectionKey?: string | null;
  userId: string;
}) {
  const idempotencyKey = [
    "trending-hook-copy",
    params.businessProfileId,
    `v${params.businessProfileVersion}`,
    TRENDING_HOOK_PROMPT_VERSION,
    TRENDING_HOOK_SELECTION_VERSION,
    ...(params.sourceSelectionKey
      ? [`source-${params.sourceSelectionKey}`]
      : []),
  ].join(":");
  const creationResult =
    await createBackgroundJobWithCreationResult({
      idempotencyKey,
      input: {
        businessProfile: toJson(params.businessProfile),
        businessProfileId: params.businessProfileId,
        businessProfileVersion: params.businessProfileVersion,
        candidates: params.candidates,
        promptVersion: TRENDING_HOOK_PROMPT_VERSION,
        selectionVersion: TRENDING_HOOK_SELECTION_VERSION,
        userId: params.userId,
      },
      jobType: TRENDING_HOOK_COPY_JOB_TYPE,
      queueName: getQueueNameForJobType(
        TRENDING_HOOK_COPY_JOB_TYPE,
      ),
      userId: params.userId,
    });
  const job = creationResult.job;

  if (job.status === "completed") {
    return job;
  }

  if (
    !shouldDeliverCarouselJobMessage({
      job,
      wasJustCreated: creationResult.created,
    })
  ) {
    if (job.status === "queued" || job.status === "processing") {
      return job;
    }

    throw new Error(
      `Trending Hook copy job ${job.id} is already ${job.status}.`,
    );
  }

  const claimedJob = await claimBackgroundJobDelivery(job);

  if (!claimedJob) {
    return job;
  }

  try {
    await sendBackgroundJobMessageWithBestEffortAttachment({
      attachMessage: (messageId) =>
        attachQueueMessageToBackgroundJob({
          queueMessageId: messageId,
          jobId: job.id,
        }),
      jobId: job.id,
      onAttachmentError: (error) => {
        console.error(
          "Trending Hook copy job was sent but its message id could not be saved:",
          error,
        );
      },
      sendMessage: () =>
        sendJobMessage({
          jobId: job.id,
          jobType: TRENDING_HOOK_COPY_JOB_TYPE,
        }),
    });
  } catch (error) {
    if (creationResult.created) {
      await markBackgroundJobFailed({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Could not queue Trending Hook copy.",
        jobId: job.id,
      }).catch((persistenceError) => {
        console.error(
          "Could not save Trending Hook copy enqueue failure:",
          persistenceError,
        );
      });
    }

    throw error;
  }

  return job;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
