import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";

import type { WorkerConfig } from "../config.js";
import type { BackgroundJobType, WorkerQueueMessage } from "../types.js";

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

export function createWorkerSqsClient(config: WorkerConfig) {
  return new SQSClient({
    region: config.awsRegion,
  });
}

export async function receiveWorkerMessages(params: {
  client: SQSClient;
  config: WorkerConfig;
}) {
  const result = await params.client.send(
    new ReceiveMessageCommand({
      MaxNumberOfMessages: params.config.pollMaxMessages,
      QueueUrl: params.config.queueUrl,
      VisibilityTimeout: params.config.visibilityTimeoutSeconds,
      WaitTimeSeconds: params.config.pollWaitTimeSeconds,
    }),
  );

  return result.Messages ?? [];
}

export async function deleteWorkerMessage(params: {
  client: SQSClient;
  config: WorkerConfig;
  message: Message;
}) {
  if (!params.message.ReceiptHandle) {
    throw new Error("Cannot delete SQS message without ReceiptHandle.");
  }

  await params.client.send(
    new DeleteMessageCommand({
      QueueUrl: params.config.queueUrl,
      ReceiptHandle: params.message.ReceiptHandle,
    }),
  );
}

export async function extendWorkerMessageVisibility(params: {
  client: SQSClient;
  config: WorkerConfig;
  message: Message;
}) {
  return changeWorkerMessageVisibility({
    ...params,
    visibilityTimeoutSeconds: params.config.visibilityTimeoutSeconds,
  });
}

export async function changeWorkerMessageVisibility(params: {
  client: SQSClient;
  config: WorkerConfig;
  message: Message;
  visibilityTimeoutSeconds: number;
}) {
  if (!params.message.ReceiptHandle) {
    throw new Error("Cannot extend SQS visibility without ReceiptHandle.");
  }

  await params.client.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: params.config.queueUrl,
      ReceiptHandle: params.message.ReceiptHandle,
      VisibilityTimeout: Math.max(
        0,
        Math.min(43_200, Math.ceil(params.visibilityTimeoutSeconds)),
      ),
    }),
  );
}

export function parseWorkerMessage(message: Message): WorkerQueueMessage {
  if (!message.Body) {
    throw new Error("SQS message body is empty.");
  }

  const parsedBody = JSON.parse(message.Body) as Partial<WorkerQueueMessage>;

  if (!parsedBody.jobId || typeof parsedBody.jobId !== "string") {
    throw new Error("SQS message body is missing jobId.");
  }

  if (!parsedBody.jobType || typeof parsedBody.jobType !== "string") {
    throw new Error("SQS message body is missing jobType.");
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
