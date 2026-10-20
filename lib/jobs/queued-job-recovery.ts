import type { BackgroundJobRecord } from "./background-jobs.ts";

export async function recoverStaleBackgroundJob(
  job: BackgroundJobRecord,
  dependencies: {
    taskExists: (job: BackgroundJobRecord) => Promise<boolean>;
    recoverQueued: (job: BackgroundJobRecord) => Promise<BackgroundJobRecord | null>;
    recoverRunning: (id: string) => Promise<BackgroundJobRecord | null>;
  },
) {
  if (job.status !== "queued") return { waiting: false, recovered: await dependencies.recoverRunning(job.id) };
  if (await dependencies.taskExists(job)) return { waiting: true, recovered: null };
  return { waiting: false, recovered: await dependencies.recoverQueued(job) };
}
