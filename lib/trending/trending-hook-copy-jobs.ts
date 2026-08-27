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
  listBackgroundJobsForUser,
  markBackgroundJobFailed,
  type BackgroundJobRecord,
  type Json,
} from "@/lib/jobs/background-jobs";
import {
  TRENDING_HOOK_COPY_JOB_TYPE,
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
  getTrendingHookPerformanceSignalKey,
  isTerminalTrendingHookCopyFailure,
  type TrendingHookPerformanceSignals,
} from "@/lib/trending/trending-hook-copy-contract";

export async function enqueueTrendingHookCopyJob(params: {
  businessProfile: unknown;
  businessProfileId: string;
  businessProfileVersion: number;
  candidates: Array<Record<string, Json>>;
  generationRun?: {
    chunkId: string;
    id: string;
    remainingValidCount: number;
  };
  performanceSignals?: TrendingHookPerformanceSignals;
  refillKey?: string | null;
  selectionVersion?: string;
  sourceSelectionKey?: string | null;
  userId: string;
  beforeDispatch?: (job: BackgroundJobRecord) => Promise<void>;
}) {
  const selectionVersion =
    params.selectionVersion ?? TRENDING_HOOK_SELECTION_VERSION;
  const baseIdempotencyKey = params.generationRun
    ? [
        "trending-hook-copy-run",
        params.generationRun.id,
        `chunk-${params.generationRun.chunkId}`,
      ].join(":")
    : [
        "trending-hook-copy",
        params.businessProfileId,
        `v${params.businessProfileVersion}`,
        TRENDING_HOOK_PROMPT_VERSION,
        selectionVersion,
        getTrendingHookPerformanceSignalKey(params.performanceSignals),
        ...(params.sourceSelectionKey
          ? [`source-${params.sourceSelectionKey}`]
          : []),
        ...(params.refillKey ? [`refill-${params.refillKey}`] : []),
      ].join(":");
  let idempotencyKey = baseIdempotencyKey;
  let creationResult =
    await createBackgroundJobWithCreationResult({
      idempotencyKey,
      input: {
        businessProfile: toJson(params.businessProfile),
        businessProfileId: params.businessProfileId,
        businessProfileVersion: params.businessProfileVersion,
        candidates: params.candidates,
        generationRunChunkId: params.generationRun?.chunkId ?? null,
        generationRunId: params.generationRun?.id ?? null,
        generationRunRemainingValidCount:
          params.generationRun?.remainingValidCount ?? null,
        performanceSignals: toJson(params.performanceSignals ?? {}),
        promptVersion: TRENDING_HOOK_PROMPT_VERSION,
        selectionVersion,
        userId: params.userId,
      },
      jobType: TRENDING_HOOK_COPY_JOB_TYPE,
      queueName: getQueueNameForJobType(
        TRENDING_HOOK_COPY_JOB_TYPE,
      ),
      userId: params.userId,
    });
  let job = creationResult.job;

  for (
    let recoveryDepth = 0;
    (job.status === "failed" || job.status === "cancelled") &&
    !isTerminalTrendingHookCopyFailure(job.errorMessage) &&
    recoveryDepth < 3;
    recoveryDepth += 1
  ) {
    idempotencyKey = `${baseIdempotencyKey}:replacement:${job.id}`;
    creationResult = await createBackgroundJobWithCreationResult({
      idempotencyKey,
      input: {
        businessProfile: toJson(params.businessProfile),
        businessProfileId: params.businessProfileId,
        businessProfileVersion: params.businessProfileVersion,
        candidates: params.candidates,
        generationRunChunkId: params.generationRun?.chunkId ?? null,
        generationRunId: params.generationRun?.id ?? null,
        generationRunRemainingValidCount:
          params.generationRun?.remainingValidCount ?? null,
        performanceSignals: toJson(params.performanceSignals ?? {}),
        promptVersion: TRENDING_HOOK_PROMPT_VERSION,
        selectionVersion,
        userId: params.userId,
      },
      jobType: TRENDING_HOOK_COPY_JOB_TYPE,
      queueName: getQueueNameForJobType(
        TRENDING_HOOK_COPY_JOB_TYPE,
      ),
      userId: params.userId,
    });
    job = creationResult.job;
  }

  if (job.status === "completed") {
    return job;
  }

  try {
    await params.beforeDispatch?.(job);
  } catch (error) {
    if (creationResult.created) {
      await markBackgroundJobFailed({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Could not prepare Trending Hook copy for dispatch.",
        jobId: job.id,
      }).catch((persistenceError) => {
        console.error(
          "Could not save Trending Hook copy attachment failure:",
          persistenceError,
        );
      });
    }

    throw error;
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

/**
 * A deployment can overlap an older, pre-durable Hook job.  That job does
 * not have a parent generation-run id, so let it finish before a new durable
 * run is allowed to reserve the same profile's source videos.  Its normal
 * Trending reconciliation will then start the durable flow if more Hooks are
 * still missing.
 */
export async function findActiveLegacyTrendingHookCopyJob(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  const jobs = await listBackgroundJobsForUser({
    activeOnly: true,
    jobType: TRENDING_HOOK_COPY_JOB_TYPE,
    limit: 100,
    userId: params.userId,
  });

  return (
    jobs.find((job) => {
      const input = toJsonRecord(job.input);

      return (
        input.businessProfileId === params.businessProfileId &&
        input.businessProfileVersion === params.businessProfileVersion &&
        !getNonEmptyString(input.generationRunId)
      );
    }) ?? null
  );
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toJsonRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getNonEmptyString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}
