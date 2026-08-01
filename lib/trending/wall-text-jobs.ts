import "server-only";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";

export async function enqueueTrendingWallTextJob(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  return createAndDispatchBackgroundJob({
    idempotencyKey: [
      "trending-wall-text",
      params.businessProfileId,
      `v${params.businessProfileVersion}`,
    ].join(":"),
    input: {
      businessProfileId: params.businessProfileId,
      businessProfileVersion: params.businessProfileVersion,
      userId: params.userId,
    },
    inputReference: `business_profile:${params.businessProfileId}:v${params.businessProfileVersion}`,
    jobType: "wall_text_generation",
    projectId: params.businessProfileId,
    userId: params.userId,
  });
}
