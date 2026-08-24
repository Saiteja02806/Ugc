import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  attachCarouselContentPlanGenerationJob,
  ensureCurrentCarouselContentPlan,
} from "@/lib/carousel/content-plan-db";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";

export async function ensureCarouselContentPlanGeneration(params: {
  profile: BusinessProfileRecord;
  timezone: string;
}) {
  const plan = await ensureCurrentCarouselContentPlan(params);

  if (plan.status !== "generating") {
    return plan;
  }

  const job = await createAndDispatchBackgroundJob(
    {
      idempotencyKey: `carousel-content-plan:${plan.id}:v${plan.planVersion}`,
      input: {
        operation: "carousel_content_plan_generation",
        planId: plan.id,
        userId: plan.userId,
      },
      inputReference: `carousel_content_plan:${plan.id}`,
      jobType: "carousel_content_plan_generation",
      projectId: plan.projectId,
      userId: plan.userId,
    },
    {
      beforeDispatch: async (createdJob) => {
        await attachCarouselContentPlanGenerationJob({
          jobId: createdJob.id,
          planId: plan.id,
          userId: plan.userId,
        });
      },
    },
  );

  return { ...plan, generationJobId: job.id };
}
