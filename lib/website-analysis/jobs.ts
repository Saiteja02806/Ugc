import "server-only";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";

export async function enqueueWebsiteAnalysisJob(params: {
  idempotencyKey: string;
  projectId: string;
  userId: string;
  websiteUrl: string;
}) {
  return createAndDispatchBackgroundJob({
    idempotencyKey: `website-analysis:${params.idempotencyKey}`,
    input: {
      operation: "website_analysis",
      projectId: params.projectId,
      userId: params.userId,
      websiteUrl: params.websiteUrl,
    },
    inputReference: `website:${params.websiteUrl.slice(0, 1_900)}`,
    jobType: "media_analysis",
    projectId: params.projectId,
    userId: params.userId,
  });
}
