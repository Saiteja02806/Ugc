import type { Message, SQSClient } from "@aws-sdk/client-sqs";

import type { WorkerConfig } from "./config.js";
import { getErrorMessage, logger } from "./logger.js";
import { hasWorkerJobHandler, runWorkerJob } from "./jobs/index.js";
import {
  deleteWorkerMessage,
  isAllowedWorkerJobType,
  parseWorkerMessage,
} from "./lib/sqs.js";
import type { SupabaseJobStore } from "./lib/supabase.js";
import type { BackgroundJobRow } from "./types.js";

type ProcessMessageParams = {
  config: WorkerConfig;
  message: Message;
  sqsClient: SQSClient;
  store: SupabaseJobStore;
};

const terminalJobStatuses = new Set(["cancelled", "completed", "failed"]);

export async function processWorkerMessage(params: ProcessMessageParams) {
  const { config, message, sqsClient, store } = params;
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

  let activeJob: BackgroundJobRow = job;

  try {
    const processingJob = await store.markProcessing({
      jobId: job.id,
      workerId: config.workerId,
    });

    if (!processingJob) {
      throw new Error("Background job disappeared before processing.");
    }

    activeJob = processingJob;

    const output = await runWorkerJob(processingJob, {
      store,
    });

    await store.markCompleted({
      jobId: processingJob.id,
      output,
    });
    await deleteWorkerMessage({ client: sqsClient, config, message });

    logger.info("Worker job completed", {
      jobId: processingJob.id,
      jobType: processingJob.job_type,
      messageId,
    });
  } catch (error) {
    await failKnownJobAndDeleteMessage({
      config,
      errorMessage: getErrorMessage(error),
      job: activeJob,
      message,
      sqsClient,
      store,
    });
  }
}

async function failKnownJobAndDeleteMessage(params: {
  config: WorkerConfig;
  errorMessage: string;
  job: BackgroundJobRow;
  message: Message;
  sqsClient: SQSClient;
  store: SupabaseJobStore;
}) {
  const messageId = params.message.MessageId ?? "unknown-message";

  try {
    await params.store.markFailed({
      errorMessage: params.errorMessage,
      job: params.job,
    });
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
