import "server-only";

import type { BusinessProfileSetupInput } from "./setup";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";

export async function enqueueBusinessProfileSetupJob(params: {
  idempotencyKey: string;
  input: BusinessProfileSetupInput;
  userId: string;
}) {
  const operationInput =
    params.input.intakeType === "website"
      ? {
          intakeType: params.input.intakeType,
          operation: "business_profile_setup",
          userId: params.userId,
          websiteUrl: params.input.websiteUrl,
        }
      : params.input.intakeType === "mobile_app_ai_prompt"
        ? {
            aiIdeContext: params.input.aiIdeContext,
            intakeType: params.input.intakeType,
            operation: "business_profile_setup",
            userId: params.userId,
          }
        : {
            intakeType: params.input.intakeType,
            manual: params.input.manual,
            operation: "business_profile_setup",
            userId: params.userId,
          };

  return createAndDispatchBackgroundJob({
    idempotencyKey: `business-profile-setup:${params.idempotencyKey}`,
    input: operationInput,
    inputReference: `business_profile_setup:${params.userId}`,
    jobType: "media_analysis",
    projectId: "default-project",
    userId: params.userId,
  });
}
