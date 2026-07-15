import { randomUUID } from "node:crypto";

import type { Message, SQSClient } from "@aws-sdk/client-sqs";

import type { WorkerConfig } from "./config.js";
import { getErrorMessage, logger } from "./logger.js";
import { hasWorkerJobHandler, runWorkerJob } from "./jobs/index.js";
import {
  deleteWorkerMessage,
  extendWorkerMessageVisibility,
  isAllowedWorkerJobType,
  parseWorkerMessage,
} from "./lib/sqs.js";
import type { SupabaseJobStore } from "./lib/supabase.js";
import type { BackgroundJobRow } from "./types.js";

type ProcessMessageParams = {
  config: WorkerConfig;
  dependencies?: {
    heartbeatIntervalMs?: number;
    runJob?: typeof runWorkerJob;
  };
  message: Message;
  sqsClient: SQSClient;
  store: SupabaseJobStore;
};

const terminalJobStatuses = new Set(["cancelled", "completed", "failed"]);

export async function processWorkerMessage(params: ProcessMessageParams) {
  const { config, dependencies, message, sqsClient, store } = params;
  const messageId = message.MessageId ?? "unknown-message";
  let parsedMessage;

  try {
    parsedMessage = parseWorkerMessage(message);
  } catch (error) {
    logger.warn("Dropping malformed SQS message", {
      error: getErrorMessage(error),
      messageId,
    });
    await deleteWorkerMessage({ client: sqsClient, config, message });
    return;
  }

  logger.info("Worker message received", {
    jobId: parsedMessage.jobId,
    jobType: parsedMessage.jobType,
    messageId,
  });

  const job = await store.getJobById(parsedMessage.jobId);

  if (!job) {
    logger.warn("Dropping SQS message for missing background job", {
      jobId: parsedMessage.jobId,
      jobType: parsedMessage.jobType,
      messageId,
    });
    await deleteWorkerMessage({ client: sqsClient, config, message });
    return;
  }

  if (terminalJobStatuses.has(job.status)) {
    logger.info("Dropping duplicate SQS message for terminal job", {
      jobId: job.id,
      jobStatus: job.status,
      jobType: job.job_type,
      messageId,
    });
    await deleteWorkerMessage({ client: sqsClient, config, message });
    return;
  }

  if (job.job_type !== parsedMessage.jobType) {
    await failKnownJobAndDeleteMessage({
      config,
      errorMessage: `SQS jobType ${parsedMessage.jobType} does not match stored job type ${job.job_type}.`,
      job,
      message,
      sqsClient,
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

  const claimToken = randomUUID();
  const processingJob = await store.claimJob({
    claimToken,
    jobId: job.id,
    staleAfterSeconds: getClaimStaleAfterSeconds(config),
    workerId: config.workerId,
  });

  if (!processingJob) {
    const latestJob = await store.getJobById(job.id);

    if (!latestJob || terminalJobStatuses.has(latestJob.status)) {
      logger.info("Dropping duplicate SQS message after claim was denied", {
        jobId: job.id,
        jobStatus: latestJob?.status ?? "missing",
        jobType: job.job_type,
        messageId,
      });
      await deleteWorkerMessage({ client: sqsClient, config, message });
      return;
    }

    logger.info("Background job is already claimed; leaving message for retry", {
      jobId: job.id,
      jobStatus: latestJob.status,
      jobType: job.job_type,
      messageId,
      workerId: latestJob.worker_id,
    });
    return;
  }

  let heartbeat: WorkerMessageHeartbeat | null =
    startWorkerMessageHeartbeat({
      claimToken,
      config,
      heartbeatIntervalMs: dependencies?.heartbeatIntervalMs,
      job: processingJob,
      message,
      sqsClient,
      store,
    });

  try {
    const output = await (dependencies?.runJob ?? runWorkerJob)(processingJob, {
      store,
    });

    await heartbeat.stop();

    if (heartbeat.claimWasLost()) {
      throw new Error("Background job claim was lost during processing.");
    }

    heartbeat = null;

    const completedJob = await store.markCompleted({
      claimToken,
      jobId: processingJob.id,
      output,
    });

    if (!completedJob) {
      throw new Error("Background job claim was lost before completion.");
    }

    await deleteWorkerMessage({ client: sqsClient, config, message });

    logger.info("Worker job completed", {
      jobId: processingJob.id,
      jobType: processingJob.job_type,
      messageId,
    });
  } catch (error) {
    await heartbeat?.stop();
    heartbeat = null;

    await failKnownJobAndDeleteMessage({
      claimToken,
      config,
      errorMessage: getErrorMessage(error),
      job: processingJob,
      message,
      sqsClient,
      store,
    });
  }
}

async function failKnownJobAndDeleteMessage(params: {
  claimToken?: string;
  config: WorkerConfig;
  errorMessage: string;
  job: BackgroundJobRow;
  message: Message;
  sqsClient: SQSClient;
  store: SupabaseJobStore;
}) {
  const messageId = params.message.MessageId ?? "unknown-message";

  try {
    const failedJob = await params.store.markFailed({
      claimToken: params.claimToken,
      errorMessage: params.errorMessage,
      job: params.job,
    });

    if (!failedJob) {
      logger.warn("Could not fail job because its claim is no longer active", {
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId,
      });
      return;
    }

    await deleteWorkerMessage({
      client: params.sqsClient,
      config: params.config,
      message: params.message,
    });

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

type WorkerMessageHeartbeat = {
  claimWasLost: () => boolean;
  stop: () => Promise<void>;
};

function startWorkerMessageHeartbeat(params: {
  claimToken: string;
  config: WorkerConfig;
  heartbeatIntervalMs?: number;
  job: BackgroundJobRow;
  message: Message;
  sqsClient: SQSClient;
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
    const [visibilityResult, databaseResult] = await Promise.allSettled([
      extendWorkerMessageVisibility({
        client: params.sqsClient,
        config: params.config,
        message: params.message,
      }),
      params.store.heartbeatJob({
        claimToken: params.claimToken,
        jobId: params.job.id,
      }),
    ]);

    if (visibilityResult.status === "rejected") {
      logger.warn("Could not extend SQS message visibility", {
        error: getErrorMessage(visibilityResult.reason),
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId: params.message.MessageId ?? "unknown-message",
      });
    }

    if (databaseResult.status === "rejected") {
      logger.warn("Could not heartbeat background job", {
        error: getErrorMessage(databaseResult.reason),
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId: params.message.MessageId ?? "unknown-message",
      });
    } else if (!databaseResult.value) {
      claimLost = true;
      logger.warn("Background job heartbeat detected a lost claim", {
        jobId: params.job.id,
        jobType: params.job.job_type,
        messageId: params.message.MessageId ?? "unknown-message",
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
