import "server-only";

import {
  getBackgroundJobById,
  type BackgroundJobType,
} from "@/lib/jobs/background-jobs";
import {
  enqueueBackgroundJobCloudTask,
  getMissingBackgroundJobCloudTasksEnvVars,
} from "@/lib/jobs/gcp-cloud-tasks";
import { getQueueNameForJobType as getConfiguredQueueNameForJobType } from "./config";

export function getQueueNameForJobType(jobType: BackgroundJobType) {
  return getConfiguredQueueNameForJobType(jobType);
}

export function getQueueProviderName() {
  return "gcp" as const;
}

export function getMissingJobQueueEnvVars(jobTypes?: BackgroundJobType[]) {
  return getMissingBackgroundJobCloudTasksEnvVars(
    jobTypes && jobTypes.length > 0 ? jobTypes : ["test_worker_job"],
  );
}

export async function sendJobMessage({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: BackgroundJobType;
}) {
  const job = await getBackgroundJobById(jobId);

  if (!job) {
    throw new Error("Cannot dispatch a missing background job.");
  }

  if (job.jobType !== jobType) {
    throw new Error("Background job type does not match the dispatch request.");
  }

  return enqueueBackgroundJobCloudTask(job);
}
