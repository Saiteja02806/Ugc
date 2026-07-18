import type { WorkerQueueProviderName } from "../config.js";

export type WorkerDeliveryMessage = {
  ackId?: string | null;
  body: string | null;
  id: string;
  providerName: WorkerQueueProviderName;
  receiptHandle?: string | null;
};

export type WorkerQueueTransport = {
  changeMessageVisibility: (
    message: WorkerDeliveryMessage,
    visibilityTimeoutSeconds: number,
  ) => Promise<void>;
  deleteMessage: (message: WorkerDeliveryMessage) => Promise<void>;
  providerName: WorkerQueueProviderName;
  receiveMessages: () => Promise<WorkerDeliveryMessage[]>;
};
