import type { WorkerConfig } from "../config.js";
import {
  EXECUTABLE_BACKGROUND_JOB_TYPES,
  type BackgroundJobType,
  type WorkerQueueMessage,
} from "../types.js";
import type { WorkerDeliveryMessage } from "./queue-types.js";

const validWorkerJobTypes = new Set<BackgroundJobType>(
  EXECUTABLE_BACKGROUND_JOB_TYPES,
);

export function parseWorkerDeliveryMessage(
  message: WorkerDeliveryMessage,
): WorkerQueueMessage {
  if (!message.body) {
    throw new Error("Worker message body is empty.");
  }

  const parsedBody = JSON.parse(message.body) as Partial<WorkerQueueMessage>;

  if (!parsedBody.jobId || typeof parsedBody.jobId !== "string") {
    throw new Error("Worker message body is missing jobId.");
  }

  if (!parsedBody.jobType || typeof parsedBody.jobType !== "string") {
    throw new Error("Worker message body is missing jobType.");
  }

  if (!validWorkerJobTypes.has(parsedBody.jobType as BackgroundJobType)) {
    throw new Error(`Invalid worker job type: ${parsedBody.jobType}`);
  }

  return {
    ...(typeof parsedBody.attempt === "number"
      ? { attempt: parsedBody.attempt }
      : {}),
    jobId: parsedBody.jobId,
    jobType: parsedBody.jobType as BackgroundJobType,
    ...(typeof parsedBody.schemaVersion === "number"
      ? { schemaVersion: parsedBody.schemaVersion }
      : {}),
  };
}

export function isAllowedWorkerJobType(
  config: WorkerConfig,
  jobType: BackgroundJobType,
) {
  return config.allowedJobTypes.includes(jobType);
}
