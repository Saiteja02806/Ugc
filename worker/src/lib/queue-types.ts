export type WorkerDeliveryMessage = {
  ackId?: string | null;
  body: string | null;
  id: string;
  providerName: "gcp";
};

export type WorkerQueueTransport = {
  changeMessageVisibility: (
    message: WorkerDeliveryMessage,
    visibilityTimeoutSeconds: number,
  ) => Promise<void>;
  deleteMessage: (message: WorkerDeliveryMessage) => Promise<void>;
  providerName: "gcp";
  receiveMessages: () => Promise<WorkerDeliveryMessage[]>;
};
