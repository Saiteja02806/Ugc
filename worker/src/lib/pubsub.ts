import { v1, type protos } from "@google-cloud/pubsub";

import type { WorkerConfig } from "../config.js";
import type { WorkerDeliveryMessage } from "./queue-types.js";

export type WorkerPubSubClient = v1.SubscriberClient;

export function createWorkerPubSubClient(config: WorkerConfig) {
  if (!config.gcpProjectId) {
    throw new Error(
      "Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT for Pub/Sub worker queue provider.",
    );
  }

  return new v1.SubscriberClient({
    projectId: config.gcpProjectId,
  });
}

export async function receiveWorkerPubSubMessages(params: {
  client: WorkerPubSubClient;
  config: WorkerConfig;
}) {
  const [response] = await params.client.pull({
    maxMessages: params.config.pollMaxMessages,
    returnImmediately: params.config.pollWaitTimeSeconds === 0,
    subscription: getWorkerPubSubSubscriptionPath(params.client, params.config),
  });

  return (response.receivedMessages ?? []).map(toWorkerPubSubDeliveryMessage);
}

export async function deleteWorkerPubSubMessage(params: {
  client: WorkerPubSubClient;
  config: WorkerConfig;
  message: WorkerDeliveryMessage;
}) {
  if (!params.message.ackId) {
    throw new Error("Cannot acknowledge Pub/Sub message without ackId.");
  }

  await params.client.acknowledge({
    ackIds: [params.message.ackId],
    subscription: getWorkerPubSubSubscriptionPath(params.client, params.config),
  });
}

export async function changeWorkerPubSubMessageVisibility(params: {
  client: WorkerPubSubClient;
  config: WorkerConfig;
  message: WorkerDeliveryMessage;
  visibilityTimeoutSeconds: number;
}) {
  if (!params.message.ackId) {
    throw new Error("Cannot modify Pub/Sub ack deadline without ackId.");
  }

  await params.client.modifyAckDeadline({
    ackDeadlineSeconds: Math.max(
      0,
      Math.min(600, Math.ceil(params.visibilityTimeoutSeconds)),
    ),
    ackIds: [params.message.ackId],
    subscription: getWorkerPubSubSubscriptionPath(params.client, params.config),
  });
}

function getWorkerPubSubSubscriptionPath(
  client: WorkerPubSubClient,
  config: WorkerConfig,
) {
  if (!config.gcpProjectId) {
    throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (!config.pubsubSubscriptionName) {
    throw new Error("Missing WORKER_PUBSUB_SUBSCRIPTION");
  }

  return client.subscriptionPath(
    config.gcpProjectId,
    config.pubsubSubscriptionName,
  );
}

function toWorkerPubSubDeliveryMessage(
  receivedMessage: protos.google.pubsub.v1.IReceivedMessage,
): WorkerDeliveryMessage {
  return {
    ackId: receivedMessage.ackId ?? null,
    body: decodePubSubData(receivedMessage.message?.data ?? null),
    id:
      receivedMessage.message?.messageId ??
      receivedMessage.ackId ??
      "unknown-message",
    providerName: "gcp",
  };
}

function decodePubSubData(data: Uint8Array | string | null) {
  if (!data) {
    return null;
  }

  if (typeof data !== "string") {
    return Buffer.from(data).toString("utf8");
  }

  const decodedValue = Buffer.from(data, "base64").toString("utf8");

  if (decodedValue.trim().startsWith("{")) {
    return decodedValue;
  }

  return data;
}
