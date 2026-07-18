import type { WorkerConfig } from "../config.js";
import {
  changeWorkerPubSubMessageVisibility,
  createWorkerPubSubClient,
  deleteWorkerPubSubMessage,
  receiveWorkerPubSubMessages,
} from "./pubsub.js";
import type { WorkerQueueTransport } from "./queue-types.js";
import {
  changeWorkerMessageVisibility,
  createWorkerSqsClient,
  deleteWorkerMessage,
  receiveWorkerMessages,
} from "./sqs.js";

export function createWorkerQueueTransport(
  config: WorkerConfig,
): WorkerQueueTransport {
  if (config.queueProvider === "gcp") {
    const client = createWorkerPubSubClient(config);

    return {
      changeMessageVisibility: (message, visibilityTimeoutSeconds) =>
        changeWorkerPubSubMessageVisibility({
          client,
          config,
          message,
          visibilityTimeoutSeconds,
        }),
      deleteMessage: (message) =>
        deleteWorkerPubSubMessage({
          client,
          config,
          message,
        }),
      providerName: "gcp",
      receiveMessages: () =>
        receiveWorkerPubSubMessages({
          client,
          config,
        }),
    };
  }

  const client = createWorkerSqsClient(config);

  return {
    changeMessageVisibility: (message, visibilityTimeoutSeconds) =>
      changeWorkerMessageVisibility({
        client,
        config,
        message,
        visibilityTimeoutSeconds,
      }),
    deleteMessage: (message) =>
      deleteWorkerMessage({
        client,
        config,
        message,
      }),
    providerName: "aws",
    receiveMessages: () =>
      receiveWorkerMessages({
        client,
        config,
      }),
  };
}
