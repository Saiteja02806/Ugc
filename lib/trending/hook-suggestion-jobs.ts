import "server-only";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import type { HookSuggestionRequest } from "./hook-video-validation";

export async function enqueueHookSuggestionJob(params: {
  idempotencyKey: string;
  input: HookSuggestionRequest;
  userId: string;
}) {
  return createAndDispatchBackgroundJob({
    idempotencyKey: `hook-composition-suggestions:${params.idempotencyKey}`,
    input: {
      ...params.input,
      operation: "composition_suggestions",
      userId: params.userId,
    },
    inputReference: `hook_composition:${params.input.influencerVideoId}:${params.input.demoAssetId}`,
    jobType: "hook_text_generation",
    projectId: params.input.demoAssetId,
    userId: params.userId,
  });
}
