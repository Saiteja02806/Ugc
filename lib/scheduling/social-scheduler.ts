import "server-only";

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
  return getMissingGcpSocialSchedulerEnvVars();
}

export function getSocialSchedulerProviderName() {
  return "gcp" as const;
}

export async function createSocialPublishSchedule(
  input: CreateSocialPublishScheduleInput,
): Promise<SocialPublishSchedule> {
  return createGcpSocialPublishSchedule(input);
}

export async function deleteSocialPublishSchedule(scheduleName: string | null) {
  return deleteGcpSocialPublishSchedule(scheduleName);
}
