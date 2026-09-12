import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  attachWallTextContentPlanGenerationJob,
  ensureCurrentWallTextContentPlan,
} from "@/lib/trending/wall-text-content-plan-db";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { assertWallTextGenerationRuntimeConfigured } from "./wall-text-generation-runtime";
import { shouldReuseWallTextContentPlanGeneration } from "./wall-text-content-plan-generation-logic";

export async function ensureWallTextContentPlanGeneration(params: {
  profile: BusinessProfileRecord;
}) {
  // This is also invoked by daily-feed recovery. Keep the check before the
  // plan RPC so a deployment configuration failure cannot create a plan that
  // has no route to a worker.
  assertWallTextGenerationRuntimeConfigured();

  const plan = await ensureCurrentWallTextContentPlan(params);

  if (
    plan.status !== "generating" ||
    shouldReuseWallTextContentPlanGeneration(plan)
  ) return plan;

  const job = await createAndDispatchBackgroundJob(
    {
      idempotencyKey: `wall-text-content-plan:${plan.id}:v${plan.planVersion}:attempt-${plan.generationAttempt}`,
      input: {
        operation: "wall_text_content_plan_generation",
        planId: plan.id,
        userId: plan.userId,
      },
      inputReference: `wall_text_content_plan:${plan.id}`,
      jobType: "wall_text_content_plan_generation",
      projectId: plan.projectId,
      userId: plan.userId,
    },
    {
      beforeDispatch: async (createdJob) => {
        await attachWallTextContentPlanGenerationJob({
          jobId: createdJob.id,
          planId: plan.id,
          userId: plan.userId,
        });
      },
    },
  );

  return { ...plan, generationJobId: job.id };
}
