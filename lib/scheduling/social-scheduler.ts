import "server-only";

import {
  createSocialPublishSchedule as createAwsSocialPublishSchedule,
  deleteSocialPublishSchedule as deleteAwsSocialPublishSchedule,
  getMissingSocialSchedulerEnvVars as getMissingAwsSocialSchedulerEnvVars,
} from "@/lib/scheduling/aws-scheduler";
import {
  createGcpSocialPublishSchedule,
  deleteGcpSocialPublishSchedule,
  getMissingGcpSocialSchedulerEnvVars,
} from "@/lib/scheduling/gcp-cloud-tasks-scheduler";
import { isGcpSocialPublishScheduleName } from "@/lib/scheduling/gcp-cloud-tasks-scheduler-logic";
import { getSocialSchedulerProviderName } from "@/lib/scheduling/social-scheduler-config";
import type {
  CreateSocialPublishScheduleInput,
  SocialPublishSchedule,
} from "@/lib/scheduling/social-scheduler-types";

export function getMissingSocialSchedulerEnvVars() {
  return getSocialSchedulerProviderName() === "gcp"
    ? getMissingGcpSocialSchedulerEnvVars()
    : getMissingAwsSocialSchedulerEnvVars();
}

export async function createSocialPublishSchedule(
  input: CreateSocialPublishScheduleInput,
): Promise<SocialPublishSchedule> {
  return getSocialSchedulerProviderName() === "gcp"
    ? createGcpSocialPublishSchedule(input)
    : createAwsSocialPublishSchedule(input);
}

export async function deleteSocialPublishSchedule(scheduleName: string | null) {
  if (isGcpSocialPublishScheduleName(scheduleName)) {
    return deleteGcpSocialPublishSchedule(scheduleName);
  }

  return deleteAwsSocialPublishSchedule(scheduleName);
}
