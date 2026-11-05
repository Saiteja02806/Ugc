import { setTimeout } from "node:timers/promises";
import type { WorkerConfig } from "../config.js";
import { logger } from "../logger.js";
import { processRecoveredWorkerJob } from "../processor.js";
import { localScheduleName } from "./local-starting-frame.js";
import type { SupabaseJobStore } from "./supabase.js";

type LocalScheduler = {
  config: WorkerConfig;
  store: SupabaseJobStore;
  ownerId: string;
  isStopping: () => boolean;
};

export async function runLocalSocialScheduler(params: LocalScheduler) {
  while (!params.isStopping()) {
    try {
      await processDueLocalSchedules(params);
    } catch {
      logger.warn("Could not process due local social schedules.");
    }
    await setTimeout(5000);
  }
}

export async function processDueLocalSchedules({ store, ownerId, config, isStopping }: LocalScheduler) {
  const jobIds = await store.listDueSocialPublishJobIds({ limit: 25, staleAfterSeconds: config.visibilityTimeoutSeconds });
  for (const jobId of jobIds) {
    if (isStopping()) return;
    const job = await store.getJobById(jobId);
    const input = job?.input_json;
    if (job?.user_id !== ownerId || job.job_type !== "publish_social_post" ||
        !input || typeof input !== "object" || Array.isArray(input) || typeof input.targetId !== "string") continue;
    if (await store.hasLocalPublishSchedule({ jobId, ownerId, targetId: input.targetId, name: localScheduleName(input.targetId) })) {
      await processRecoveredWorkerJob({ config, store, jobId });
    }
  }
}
