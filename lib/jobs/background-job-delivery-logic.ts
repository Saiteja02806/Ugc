// This matches the worker's production reclaim lease: two 15-minute delivery
// visibility windows. A replacement delivery before this boundary cannot take
// over the database claim and only creates duplicate queue traffic.
export const CAROUSEL_JOB_REDELIVERY_INTERVAL_MS = 30 * 60 * 1_000;

export type CarouselDeliveryJob = {
  awsMessageId: string | null;
  lastDeliveryAt: string | null;
  lastHeartbeatAt: string | null;
  lockedAt: string | null;
  status: "cancelled" | "completed" | "failed" | "processing" | "queued";
  updatedAt: string;
};

export function shouldDeliverCarouselJobMessage(params: {
  job: CarouselDeliveryJob;
  now?: number;
  wasJustCreated?: boolean;
}) {
  const now = params.now ?? Date.now();

  if (params.job.status === "queued") {
    return (
      (params.wasJustCreated &&
        !params.job.awsMessageId &&
        !params.job.lastDeliveryAt) ||
      isStaleTimestamp(
        params.job.lastDeliveryAt ?? params.job.updatedAt,
        now,
      )
    );
  }

  if (params.job.status === "processing") {
    return (
      isStaleTimestamp(
        params.job.lastHeartbeatAt ??
          params.job.lockedAt ??
          params.job.updatedAt,
        now,
      ) &&
      isStaleTimestamp(
        params.job.lastDeliveryAt ?? params.job.updatedAt,
        now,
      )
    );
  }

  return false;
}

function isStaleTimestamp(value: string, now: number) {
  const timestamp = new Date(value).getTime();

  return (
    !Number.isFinite(timestamp) ||
    now - timestamp >= CAROUSEL_JOB_REDELIVERY_INTERVAL_MS
  );
}
