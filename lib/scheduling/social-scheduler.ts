import "server-only";
import { getBackgroundJobById } from "../jobs/background-jobs";
import { sendLocalAppWorker } from "../jobs/local-starting-frame";
import { localScheduleName, localStartingFrameConfig } from "../../worker/src/lib/local-starting-frame.ts";

import {
  createGcpSocialPublishSchedule,
  deleteGcpSocialPublishSchedule,
  getMissingGcpSocialSchedulerEnvVars,
} from "@/lib/scheduling/gcp-cloud-tasks-scheduler";
import type {
  CreateSocialPublishScheduleInput,
  SocialPublishSchedule,
} from "@/lib/scheduling/social-scheduler-types";

export function getMissingSocialSchedulerEnvVars() {
  if (process.env.LOCAL_APP_WORKER === "true") {
    try {
      if (localStartingFrameConfig(process.env)?.publish) return [];
    } catch {
      return ["Local scheduling configuration"];
    }
    return ["LOCAL_APP_WORKER_PUBLISH"];
  }
  return getMissingGcpSocialSchedulerEnvVars();
}

export function getSocialSchedulerProviderName() {
  return process.env.LOCAL_APP_WORKER === "true" ? "local" as const : "gcp" as const;
}

export async function createSocialPublishSchedule(
  input: CreateSocialPublishScheduleInput,
): Promise<SocialPublishSchedule> {
  if (process.env.LOCAL_APP_WORKER === "true") {
    const config = localStartingFrameConfig(process.env);
    if (!config?.publish) throw new Error("Local publishing requires an explicit opt-in.");
    const job = await getBackgroundJobById(input.jobId);
    if (!job || job.jobType !== "publish_social_post" || job.userId !== config.ownerId ||
        !job.input || typeof job.input !== "object" || Array.isArray(job.input) || job.input.targetId !== input.targetId) {
      throw new Error("Local publish job does not match its scheduled target.");
    }
    await sendLocalAppWorker();
    return { arn: null, name: localScheduleName(input.targetId) };
  }
  return createGcpSocialPublishSchedule(input);
}

export async function deleteSocialPublishSchedule(scheduleName: string | null) {
  if (process.env.LOCAL_APP_WORKER === "true") return;
  return deleteGcpSocialPublishSchedule(scheduleName);
}
