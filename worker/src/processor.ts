import { randomUUID } from "node:crypto";

import type { WorkerConfig } from "./config.js";
import { JobCancellationRequestedError } from "./job-cancellation.js";
import { getErrorMessage, logger } from "./logger.js";
import { hasWorkerJobHandler, runWorkerJob } from "./jobs/index.js";
import { reconcileRenderEditVideoJobFailure } from "./jobs/render-edit-video.js";
import { reconcileTrendingCarouselEditJobFailure } from "./jobs/render-trending-carousel-edit.js";
import {
  isAllowedWorkerJobType,
  parseWorkerDeliveryMessage,
} from "./lib/queue-message.js";
import type {
  WorkerDeliveryMessage,
  WorkerQueueTransport,
} from "./lib/queue-types.js";
import type { SupabaseJobStore } from "./lib/supabase.js";
import { DeferredJobError, RetryableJobError } from "./retryable-job-error.js";
import { reconcileTrendingFeedInApp } from "./lib/trending-feed-reconciliation.js";
import type { BackgroundJobRow } from "./types.js";

type ProcessMessageParams = {
  config: WorkerConfig;
  dependencies?: {
    heartbeatIntervalMs?: number;
    reconcileTrendingFeed?: typeof reconcileTrendingFeedInApp;
    runJob?: typeof runWorkerJob;
  };
  message: WorkerDeliveryMessage;
  queue: WorkerQueueTransport;
  store: SupabaseJobStore;
};

const terminalJobStatuses = new Set(["cancelled", "completed", "failed"]);

export async function processWorkerMessage(params: ProcessMessageParams) {
  const { config, dependencies, message, queue, store } = params;
  const messageId = message.id;
  let parsedMessage;

  try {
    parsedMessage = parseWorkerDeliveryMessage(message);
  } catch (error) {
    logger.warn("Dropping malformed worker queue message", {
      error: getErrorMessage(error),
      messageId,
    });
    await queue.deleteMessage(message);
    return;
  }

  logger.info("Worker message received", {
    jobId: parsedMessage.jobId,
    jobType: parsedMessage.jobType,
    messageId,
  });

  const job = await store.getJobById(parsedMessage.jobId);

  if (!job) {
    logger.warn("Dropping queue message for missing background job", {
      jobId: parsedMessage.jobId,
      jobType: parsedMessage.jobType,
      messageId,
    });
    await queue.deleteMessage(message);
    return;
  }

  if (terminalJobStatuses.has(job.status)) {
    logger.info("Dropping duplicate queue message for terminal job", {
      jobId: job.id,
      jobStatus: job.status,
      jobType: job.job_type,
      messageId,
    });
    await queue.deleteMessage(message);
    return;
  }

  if (job.job_type !== parsedMessage.jobType) {
    await failKnownJobAndDeleteMessage({
      config,
      errorMessage: `Queue jobType ${parsedMessage.jobType} does not match stored job type ${job.job_type}.`,
      job,
      message,
      queue,
      store,
    });
    return;
  }

  if (!isAllowedWorkerJobType(config, job.job_type)) {
    logger.warn("Worker job type is not allowed for this service; leaving message for retry", {
      allowedJobTypes: config.allowedJobTypes,
      jobId: job.id,
      jobType: job.job_type,
      messageId,
    });
    return;
  }

  if (!hasWorkerJobHandler(job.job_type)) {
    logger.warn("Worker job type has no implemented handler yet; leaving message for retry", {
      jobId: job.id,
      jobType: job.job_type,
      messageId,
    });
    return;
  }

  await processClaimableJob({
    config,
    dependencies,
    job,
    message,
    queue,
    store,
  });
}

export async function processRecoveredWorkerJob(params: {
  config: WorkerConfig;
  dependencies?: ProcessMessageParams["dependencies"];
  jobId: string;
  store: SupabaseJobStore;
}) {
  const job = await params.store.getJobById(params.jobId);

  if (!job || terminalJobStatuses.has(job.status)) {
    return false;
  }

  if (
    !isAllowedWorkerJobType(params.config, job.job_type) ||
    !hasWorkerJobHandler(job.job_type)
  ) {
    logger.warn("Recovered job cannot run on this worker", {
      allowedJobTypes: params.config.allowedJobTypes,
      jobId: job.id,
      jobType: job.job_type,
    });
    return false;
  }

  return processClaimableJob({
    config: params.config,
    dependencies: params.dependencies,
    job,
    store: params.store,
  });
}

async function processClaimableJob(params: {
  config: WorkerConfig;
  dependencies?: ProcessMessageParams["dependencies"];
  job: BackgroundJobRow;
  message?: WorkerDeliveryMessage;
  queue?: WorkerQueueTransport;
  store: SupabaseJobStore;
}) {
  const { config, dependencies, job, message, queue, store } = params;
  const messageId = message?.id ?? "database-recovery";

  const claimToken = randomUUID();
  const processingJob = await store.claimJob({
    claimToken,
    jobId: job.id,
    staleAfterSeconds: getClaimStaleAfterSeconds(config),
    workerId: config.workerId,
  });

  if (!processingJob) {
    const latestJob = await store.getJobById(job.id);

    if (latestJob?.status === "cancel_requested") {
      await store.markCancelled({ jobId: latestJob.id });
      await reconcileDurableOutputJobFailure(
        latestJob,
        store,
        "Video save was cancelled before execution.",
      );
      await deleteDeliveryMessage({ config, message, queue });
      logger.info("Background job cancelled before execution", {
        jobId: latestJob.id,
        jobType: latestJob.job_type,
        messageId,
      });
      return false;
    }

    if (!latestJob || terminalJobStatuses.has(latestJob.status)) {
      logger.info("Dropping duplicate queue message after claim was denied", {
        jobId: job.id,
        jobStatus: latestJob?.status ?? "missing",
        jobType: job.job_type,
        messageId,
      });
      await deleteDeliveryMessage({ config, message, queue });
      return false;
    }

    const retryDelaySeconds = getFutureRetryDelaySeconds(
      latestJob.next_attempt_at,
    );

    if (retryDelaySeconds && message && queue) {
      await queue.changeMessageVisibility(message, retryDelaySeconds);
      logger.info("Background job is waiting for its retry time", {
        jobId: job.id,
        jobType: job.job_type,
        messageId,
        nextAttemptAt: latestJob.next_attempt_at,
      });
      return false;
    }

    logger.info("Background job is already claimed; leaving message for retry", {
      jobId: job.id,
      jobStatus: latestJob.status,
      jobType: job.job_type,
      messageId,
      workerId: latestJob.worker_id,
    });
    return false;
  }

  let heartbeat: WorkerMessageHeartbeat | null =
    startWorkerMessageHeartbeat({
      claimToken,
      config,
      heartbeatIntervalMs: dependencies?.heartbeatIntervalMs,
      job: processingJob,
      message,
      queue,
      store,
    });

  try {
    const checkpoint = async (checkpointParams: {
      progress?: number | null;
      stage: string;
      status:
        | "processing"
        | "rendering"
        | "uploading_output"
        | "waiting_external_service";
    }) => {
      const updatedJob = await store.updateJobStage({
        claimToken,
        jobId: processingJob.id,
        ...checkpointParams,
      });

      if (updatedJob) {
        return;
      }

      const latestJob = await store.getJobById(processingJob.id);

      if (latestJob?.status === "cancel_requested") {
        throw new JobCancellationRequestedError();
      }

      throw new Error("Background job claim was lost at a checkpoint.");
    };
    const output = await (dependencies?.runJob ?? runWorkerJob)(processingJob, {
      checkpoint,
      store,
    });

    await heartbeat.stop();

    if (heartbeat.claimWasLost()) {
      throw new Error("Background job claim was lost during processing.");
    }

    heartbeat = null;

    const latestBeforeCompletion = await store.getJobById(processingJob.id);

    if (latestBeforeCompletion?.status === "cancel_requested") {
      await store.markCancelled({
        claimToken,
        jobId: processingJob.id,
      });
      await reconcileDurableOutputJobFailure(
        processingJob,
        store,
        "Video save was cancelled before completion.",
      );
      await deleteDeliveryMessage({ config, message, queue });
      logger.info("Background job cancelled at completion checkpoint", {
        jobId: processingJob.id,
        jobType: processingJob.job_type,
        messageId,
      });
      return false;
    }

    let completedJob;

    try {
      completedJob = await store.markCompleted({
        claimToken,
        jobId: processingJob.id,
        output,
      });
    } catch {
      throw new RetryableJobError(
        "The generated output was saved, but its database record could not be finalized yet.",
        {
          code: "job_completion_persistence_failed",
          retryAfterSeconds: 30,
        },
      );
    }

    if (!completedJob) {
      const latestJob = await store.getJobById(processingJob.id);

      if (latestJob && terminalJobStatuses.has(latestJob.status)) {
        await deleteDeliveryMessage({ config, message, queue });
        logger.info("Worker completion was superseded by a terminal job state", {
          jobId: processingJob.id,
          jobStatus: latestJob.status,
          jobType: processingJob.job_type,
          messageId,
        });
        return false;
      }

      throw new Error("Background job claim was lost before completion.");
    }

    await reconcileCompletedTrendingFeed({
      job: completedJob,
      reconcileTrendingFeed:
        dependencies?.reconcileTrendingFeed ?? reconcileTrendingFeedInApp,
      store,
    });

    await deleteDeliveryMessage({ config, message, queue });

    logger.info("Worker job completed", {
      jobId: processingJob.id,
      jobType: processingJob.job_type,
      messageId,
    });
    return true;
  } catch (error) {
    await heartbeat?.stop();
    heartbeat = null;

    if (error instanceof JobCancellationRequestedError) {
      await store.markCancelled({
        claimToken,
        jobId: processingJob.id,
      });
      await reconcileDurableOutputJobFailure(
        processingJob,
        store,
        "Video save was cancelled at a durable checkpoint.",
      );
      await deleteDeliveryMessage({ config, message, queue });
      logger.info("Background job cancelled at a durable checkpoint", {
        jobId: processingJob.id,
        jobType: processingJob.job_type,
        messageId,
      });
      return false;
    }

    if (error instanceof DeferredJobError) {
      await deferKnownJob({
        claimToken,
        config,
        error,
        job: processingJob,
        message,
        queue,
        store,
      });
      return false;
    }

    if (error instanceof RetryableJobError) {
      if (processingJob.attempt_count + 1 >= processingJob.max_attempts) {
        await failKnownJobAndDeleteMessage({
          claimToken,
          config,
          errorCode: error.code,
          errorMessage: error.message,
          job: processingJob,
          message,
          queue,
          store,
        });
        return false;
      }

      await retryKnownJob({
        claimToken,
        config,
        error,
        job: processingJob,
        message,
        queue,
        store,
    });
      return false;
    }

    await failKnownJobAndDeleteMessage({
      claimToken,
      config,
      errorCode: getStructuredErrorCode(error),
      errorMessage: getErrorMessage(error),
      job: processingJob,
      message,
      queue,
      store,
    });
    return false;
  }
}

async function deferKnownJob(params: {
  claimToken: string;
  config: WorkerConfig;
  error: DeferredJobError;
  job: BackgroundJobRow;
  message?: WorkerDeliveryMessage;
  queue?: WorkerQueueTransport;
  store: SupabaseJobStore;
}) {
  const messageId = params.message?.id ?? "database-recovery";
  const deferredJob = await params.store.deferJob({
    claimToken: params.claimToken,
    errorMessage: params.error.message,
    job: params.job,
    retryAt: params.error.retryAt,
  });

  if (!deferredJob) {
    logger.warn("Could not defer job because its claim is no longer active", {
      jobId: params.job.id,
      jobType: params.job.job_type,
      messageId,
    });
    return;
  }

  if (params.message && params.queue) {
    await params.queue.changeMessageVisibility(
      params.message,
      params.error.retryAfterSeconds,
    );
  }

  logger.info("Worker job deferred without consuming a retry attempt", {
    error: params.error.message,
    errorCode: params.error.code,
    jobId: params.job.id,
    jobType: params.job.job_type,
    messageId,
    retryAt: params.error.retryAt,
  });
}

const trendingDeliveryJobTypes = new Set<BackgroundJobRow["job_type"]>([
  "carousel_content_plan_generation",
  "generate_carousel",
  "generate_trending_hook_copy",
  "wall_text_content_plan_generation",
  "wall_text_generation",
  "reaction_generation",
]);

async function reconcileCompletedTrendingFeed(params: {
  job: BackgroundJobRow;
  reconcileTrendingFeed: typeof reconcileTrendingFeedInApp;
  store: SupabaseJobStore;
}) {
  if (!params.job.user_id || !trendingDeliveryJobTypes.has(params.job.job_type)) {
    return;
  }

  let reconciliation;

  try {
    reconciliation = await params.store.claimTrendingFeedReconciliation({
      sourceJobId: params.job.id,
    });
  } catch (error) {
    // complete_background_job atomically creates the outbox record. If this
    // immediate claim cannot be read, scheduled recovery will claim it later
    // without depending on a browser request.
    logger.error("Could not claim durable Trending reconciliation work", {
      error: getErrorMessage(error),
      jobId: params.job.id,
      jobType: params.job.job_type,
      userId: params.job.user_id,
    });
    return;
  }

  if (!reconciliation) {
    return;
  }

  try {
    await params.reconcileTrendingFeed({
      sourceJobId: params.job.id,
      userId: params.job.user_id,
    });
    const completed = await params.store.completeTrendingFeedReconciliation({
      sourceJobId: params.job.id,
    });

    if (!completed) {
      logger.warn("Trending reconciliation claim was no longer active", {
        jobId: params.job.id,
        userId: params.job.user_id,
      });
    }
  } catch (error) {
    const message = getErrorMessage(error);

    try {
      await params.store.rescheduleTrendingFeedReconciliation({
        message,
        sourceJobId: params.job.id,
      });
    } catch (rescheduleError) {
      logger.error("Could not reschedule durable Trending reconciliation", {
        error: getErrorMessage(rescheduleError),
        jobId: params.job.id,
        userId: params.job.user_id,
      });
    }

    // The source content remains completed; only its idempotent follow-up is
    // retried from the durable outbox.
    logger.error("Could not reconcile completed Trending job", {
      error: message,
      jobId: params.job.id,
      jobType: params.job.job_type,
      userId: params.job.user_id,
    });
  }
}

async function retryKnownJob(params: {
  claimToken: string;
  config: WorkerConfig;
  error: RetryableJobError;
  job: BackgroundJobRow;
  message?: WorkerDeliveryMessage;
  queue?: WorkerQueueTransport;
  store: SupabaseJobStore;
}) {
  const messageId = params.message?.id ?? "database-recovery";
  const retryingJob = await params.store.markRetrying({
    claimToken: params.claimToken,
    errorMessage: params.error.message,
    job: params.job,
    retryAt: params.error.retryAt,
  });

  if (!retryingJob) {
    const latestJob = await params.store.getJobById(params.job.id);

    if (latestJob && terminalJobStatuses.has(latestJob.status)) {
      await deleteDeliveryMessage(params);
    } else {
      logger.warn("Could not retry job because its claim is no longer active", {
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId,
      });
    }

    return;
  }

  if (params.message && params.queue) {
    await params.queue.changeMessageVisibility(
      params.message,
      params.error.retryAfterSeconds,
    );
  }

  logger.warn("Worker job scheduled for retry", {
    attemptCount: retryingJob.attempt_count,
    error: params.error.message,
    errorCode: params.error.code,
    jobId: params.job.id,
    jobType: params.job.job_type,
    messageId,
    retryAt: params.error.retryAt,
  });
}

async function failKnownJobAndDeleteMessage(params: {
  claimToken?: string;
  config: WorkerConfig;
  errorCode?: string;
  errorMessage: string;
  job: BackgroundJobRow;
  message?: WorkerDeliveryMessage;
  queue?: WorkerQueueTransport;
  store: SupabaseJobStore;
}) {
  const messageId = params.message?.id ?? "database-recovery";

  try {
    const failedJob = await params.store.markFailed({
      claimToken: params.claimToken,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      job: params.job,
    });

    if (!failedJob) {
      const latestJob = await params.store.getJobById(params.job.id);

      if (latestJob && terminalJobStatuses.has(latestJob.status)) {
        await deleteDeliveryMessage(params);
        return;
      }

      logger.warn("Could not fail job because its claim is no longer active", {
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId,
      });
      return;
    }

    await reconcileDurableOutputJobFailure(
      failedJob,
      params.store,
      params.errorMessage,
    );

    // A durable Hook run must continue from its saved count after a terminal
    // physical-job failure. The database trigger creates the same durable
    // reconciliation outbox used for successful Trending jobs.
    await reconcileCompletedTrendingFeed({
      job: failedJob,
      reconcileTrendingFeed: reconcileTrendingFeedInApp,
      store: params.store,
    });

    await deleteDeliveryMessage(params);

    logger.error("Worker job failed", {
      error: params.errorMessage,
      jobId: params.job.id,
      jobType: params.job.job_type,
      messageId,
    });
  } catch (error) {
    logger.error("Could not persist worker job failure", {
      error: getErrorMessage(error),
      jobId: params.job.id,
      jobType: params.job.job_type,
      messageId,
    });
    throw error;
  }
}

async function reconcileDurableOutputJobFailure(
  job: BackgroundJobRow,
  store: SupabaseJobStore,
  errorMessage: string,
) {
  if (job.job_type === "reaction_generation" && job.user_id) {
    await store.failReactionGenerationRun({
      errorMessage,
      generationJobId: job.id,
      userId: job.user_id,
    });
  }

  if (job.job_type === "generate_trending_hook_copy") {
    await store.failTrendingHookGenerationRunChunk({
      errorMessage,
      jobId: job.id,
    });
  }

  await reconcileRenderEditVideoJobFailure(job, store, errorMessage);
  await reconcileTrendingCarouselEditJobFailure(job, store, errorMessage);
  await reconcileContentPlanGenerationFailure(job, store, errorMessage);
}

async function reconcileContentPlanGenerationFailure(
  job: BackgroundJobRow,
  store: SupabaseJobStore,
  errorMessage: string,
) {
  const input = getContentPlanFailureInput(job);

  if (!input) {
    return;
  }

  if (job.job_type === "carousel_content_plan_generation") {
    await store.failCarouselContentPlanGeneration({
      errorMessage,
      jobId: job.id,
      planId: input.planId,
      userId: input.userId,
    });
    return;
  }

  await store.failWallTextContentPlanGeneration({
    errorMessage,
    jobId: job.id,
    planId: input.planId,
    userId: input.userId,
  });
}

function getContentPlanFailureInput(job: BackgroundJobRow) {
  if (
    job.job_type !== "carousel_content_plan_generation" &&
    job.job_type !== "wall_text_content_plan_generation"
  ) {
    return null;
  }

  const value = job.input_json;

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.planId !== "string" ||
    !value.planId.trim() ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    value.userId !== job.user_id
  ) {
    logger.warn("Could not reconcile malformed content-plan job input", {
      jobId: job.id,
      jobType: job.job_type,
    });
    return null;
  }

  return {
    planId: value.planId,
    userId: value.userId,
  };
}

async function deleteDeliveryMessage(params: {
  config: WorkerConfig;
  message?: WorkerDeliveryMessage;
  queue?: WorkerQueueTransport;
}) {
  if (!params.message || !params.queue) {
    return;
  }

  await params.queue.deleteMessage(params.message);
}

type WorkerMessageHeartbeat = {
  claimWasLost: () => boolean;
  stop: () => Promise<void>;
};

function startWorkerMessageHeartbeat(params: {
  claimToken: string;
  config: WorkerConfig;
  heartbeatIntervalMs?: number;
  job: BackgroundJobRow;
  message?: WorkerDeliveryMessage;
  queue?: WorkerQueueTransport;
  store: SupabaseJobStore;
}): WorkerMessageHeartbeat {
  const intervalMs =
    params.heartbeatIntervalMs ??
    getHeartbeatIntervalMs(params.config.visibilityTimeoutSeconds);
  let claimLost = false;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let tickPromise: Promise<void> | null = null;

  const scheduleTick = () => {
    if (stopped) {
      return;
    }

    timer = setTimeout(() => {
      tickPromise = runTick().finally(() => {
        tickPromise = null;
        scheduleTick();
      });
    }, intervalMs);
  };

  const runTick = async () => {
    const visibilityPromise =
      params.message && params.queue
        ? params.queue.changeMessageVisibility(
            params.message,
            params.config.visibilityTimeoutSeconds,
          )
        : Promise.resolve();
    const [visibilityResult, databaseResult] = await Promise.allSettled([
      visibilityPromise,
      params.store.heartbeatJob({
        claimToken: params.claimToken,
        jobId: params.job.id,
      }),
    ]);

    if (
      params.message &&
      params.queue &&
      visibilityResult.status === "rejected"
    ) {
      logger.warn("Could not extend queue message visibility", {
        error: getErrorMessage(visibilityResult.reason),
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId: params.message.id,
      });
    }

    if (databaseResult.status === "rejected") {
      logger.warn("Could not heartbeat background job", {
        error: getErrorMessage(databaseResult.reason),
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId: params.message?.id ?? "database-recovery",
      });
    } else if (!databaseResult.value) {
      claimLost = true;
      logger.warn("Background job heartbeat detected a lost claim", {
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId: params.message?.id ?? "database-recovery",
      });
    }
  };

  scheduleTick();

  return {
    claimWasLost: () => claimLost,
    async stop() {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      await tickPromise;
    },
  };
}

function getHeartbeatIntervalMs(visibilityTimeoutSeconds: number) {
  return Math.max(
    1_000,
    Math.min(60_000, Math.floor((visibilityTimeoutSeconds * 1_000) / 3)),
  );
}

function getClaimStaleAfterSeconds(config: WorkerConfig) {
  return Math.max(
    60,
    Math.min(43_200, config.visibilityTimeoutSeconds * 2),
  );
}

function getFutureRetryDelaySeconds(nextAttemptAt: string | null) {
  if (!nextAttemptAt) {
    return null;
  }

  const retryAtMs = Date.parse(nextAttemptAt);

  if (!Number.isFinite(retryAtMs) || retryAtMs <= Date.now()) {
    return null;
  }

  return Math.min(
    43_200,
    Math.max(1, Math.ceil((retryAtMs - Date.now()) / 1_000)),
  );
}

function getStructuredErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" && code.trim()
    ? code.trim().slice(0, 120)
    : undefined;
}
