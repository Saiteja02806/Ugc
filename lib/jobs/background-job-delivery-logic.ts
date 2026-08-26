// This matches the worker's production reclaim lease: two 15-minute delivery
// visibility windows. A replacement delivery before this boundary cannot take
// over the database claim and only creates duplicate queue traffic.
export const CAROUSEL_JOB_REDELIVERY_INTERVAL_MS = 30 * 60 * 1_000;

export type CarouselDeliveryJob = {
  queueMessageId: string | null;
  lastDeliveryAt: string | null;
  lastHeartbeatAt: string | null;
  lockedAt: string | null;
  status: BackgroundJobStatus;
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
      // A database transaction may have committed the job before the process
      // reached Cloud Tasks. The compare-and-set delivery claim ensures that
      // concurrent observers cannot both send it.
      (!params.job.queueMessageId && !params.job.lastDeliveryAt) ||
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
import type { BackgroundJobStatus } from "./background-jobs.ts";
