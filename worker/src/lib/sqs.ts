import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import type { WorkerConfig } from "../config.js";
import type { WorkerDeliveryMessage } from "./queue-types.js";

export function createWorkerSqsClient(config: WorkerConfig) {
  if (!config.awsRegion) {
    throw new Error("Missing AWS_REGION for SQS worker queue provider.");
  }

  return new SQSClient({
    region: config.awsRegion,
  });
}

export async function receiveWorkerMessages(params: {
  client: SQSClient;
  config: WorkerConfig;
}) {
  const queueUrl = getWorkerSqsQueueUrl(params.config);
  const result = await params.client.send(
    new ReceiveMessageCommand({
      MaxNumberOfMessages: params.config.pollMaxMessages,
      QueueUrl: queueUrl,
      VisibilityTimeout: params.config.visibilityTimeoutSeconds,
      WaitTimeSeconds: params.config.pollWaitTimeSeconds,
    }),
  );

  return (result.Messages ?? []).map((message) => ({
    body: message.Body ?? null,
    id: message.MessageId ?? "unknown-message",
    providerName: "aws" as const,
    receiptHandle: message.ReceiptHandle ?? null,
  }));
}

export async function deleteWorkerMessage(params: {
  client: SQSClient;
  config: WorkerConfig;
  message: WorkerDeliveryMessage;
}) {
  if (!params.message.receiptHandle) {
    throw new Error("Cannot delete SQS message without ReceiptHandle.");
  }

  await params.client.send(
    new DeleteMessageCommand({
      QueueUrl: getWorkerSqsQueueUrl(params.config),
      ReceiptHandle: params.message.receiptHandle,
    }),
  );
}

export async function extendWorkerMessageVisibility(params: {
  client: SQSClient;
  config: WorkerConfig;
  message: WorkerDeliveryMessage;
}) {
  return changeWorkerMessageVisibility({
    ...params,
    visibilityTimeoutSeconds: params.config.visibilityTimeoutSeconds,
  });
}

export async function changeWorkerMessageVisibility(params: {
  client: SQSClient;
  config: WorkerConfig;
  message: WorkerDeliveryMessage;
  visibilityTimeoutSeconds: number;
}) {
  if (!params.message.receiptHandle) {
    throw new Error("Cannot extend SQS visibility without ReceiptHandle.");
  }

  await params.client.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: getWorkerSqsQueueUrl(params.config),
      ReceiptHandle: params.message.receiptHandle,
      VisibilityTimeout: Math.max(
        0,
        Math.min(43_200, Math.ceil(params.visibilityTimeoutSeconds)),
      ),
    }),
  );
}

function getWorkerSqsQueueUrl(config: WorkerConfig) {
  if (!config.queueUrl) {
    throw new Error("Missing WORKER_QUEUE_URL for SQS worker queue provider.");
  }

  return config.queueUrl;
}
