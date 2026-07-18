import type { WorkerConfig } from "../config.js";
import type { BackgroundJobType, WorkerQueueMessage } from "../types.js";
import type { WorkerDeliveryMessage } from "./queue-types.js";

const validWorkerJobTypes = new Set<BackgroundJobType>([
  "extract_video_metadata",
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "generate_thumbnail",
  "publish_social_post",
  "render_demo_video",
  "render_edit_video",
  "render_schedule_combination",
  "test_worker_job",
]);

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
    jobId: parsedBody.jobId,
    jobType: parsedBody.jobType as BackgroundJobType,
  };
}

export function isAllowedWorkerJobType(
  config: WorkerConfig,
  jobType: BackgroundJobType,
) {
  return config.allowedJobTypes.includes(jobType);
}
