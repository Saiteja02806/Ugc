import "server-only";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import {
  getTrendingHookPerformanceSignalKey,
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
  type TrendingHookPerformanceSignals,
} from "@/lib/trending/trending-hook-copy-contract";
import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import type { HookVideoSourceKind } from "./hook-video-types";
import type { HookSuggestionRequest } from "./hook-video-validation";

export type HookCompositionGenerationContext = {
  businessProfile: WebsiteBusinessAnalysis;
  businessProfileId: string;
  businessProfileVersion: number;
  candidate: {
    durationSeconds: number;
    influencerId: string;
    influencerKey: string | null;
    influencerName: string;
    influencerVideoId: string;
    influencerVideoTitle: string;
    reactionType: string | null;
    sourceDurationSeconds: number;
    sourceKind: HookVideoSourceKind;
    thumbnailUrl: string | null;
    trimEnd: number | null;
    trimStart: number;
    visualGroup: string | null;
  };
  performanceSignals?: TrendingHookPerformanceSignals;
};

export async function enqueueHookSuggestionJob(params: {
  idempotencyKey: string;
  generationContext: HookCompositionGenerationContext;
  input: HookSuggestionRequest;
  userId: string;
}) {
  return createAndDispatchBackgroundJob({
    idempotencyKey: [
      "hook-composition-suggestions",
      params.idempotencyKey,
      getTrendingHookPerformanceSignalKey(
        params.generationContext.performanceSignals,
      ),
    ].join(":"),
    input: {
      ...params.input,
      businessProfile: params.generationContext.businessProfile,
      businessProfileId: params.generationContext.businessProfileId,
      businessProfileVersion: params.generationContext.businessProfileVersion,
      candidate: params.generationContext.candidate,
      operation: "composition_suggestions",
      performanceSignals: params.generationContext.performanceSignals ?? {},
      promptVersion: TRENDING_HOOK_PROMPT_VERSION,
      selectionVersion: TRENDING_HOOK_SELECTION_VERSION,
      suggestionCount: 6,
      userId: params.userId,
    },
    inputReference: `hook_composition:${params.input.influencerVideoId}:${params.input.demoAssetId}`,
    jobType: "hook_text_generation",
    projectId: params.input.demoAssetId,
    userId: params.userId,
  });
}
