import "server-only";

import {
  createAndDispatchBackgroundJob,
  retryAndDispatchBackgroundJob,
} from "@/lib/jobs/background-job-service";
import { WALL_TEXT_GENERATOR_VERSION } from "@/lib/trending/wall-text-types";

export async function enqueueTrendingWallTextJob(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  const idempotencyKey = [
    "trending-wall-text",
    params.businessProfileId,
    `v${params.businessProfileVersion}`,
    WALL_TEXT_GENERATOR_VERSION,
  ].join(":");

  let job = await createWallTextBackgroundJob({
    idempotencyKey,
    ...params,
  });

  // A failed job with unused attempts can safely resume. If it exhausted its
  // retry budget, create one new replacement that is tied to that failed job.
  // This keeps normal requests idempotent while allowing a user to recover
  // from an earlier infrastructure failure without changing their profile.
  for (let recoveryDepth = 0; job.status === "failed" && recoveryDepth < 3; recoveryDepth += 1) {
    if (job.attemptCount < job.maxAttempts) {
      const retried = await retryAndDispatchBackgroundJob({
        jobId: job.id,
        userId: params.userId,
      });

      return retried ?? job;
    }

    job = await createWallTextBackgroundJob({
      idempotencyKey: `${idempotencyKey}:replacement:${job.id}`,
      ...params,
    });
  }

  return job;
}

function createWallTextBackgroundJob(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  idempotencyKey: string;
  userId: string;
}) {
  return createAndDispatchBackgroundJob({
    idempotencyKey: params.idempotencyKey,
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
