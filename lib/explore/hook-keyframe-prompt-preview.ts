import { buildHookKeyframeImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { buildHookAnimationPrompt, getHookKeyframeMotionReviewDraft, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import type { HookKeyframeDraft } from "./hook-keyframe-draft.ts";

/** Preparation only. This is deliberately not a HookMotionCompilation ready receipt. */
export function getHookKeyframePromptPreview(draft: HookKeyframeDraft) {
  const suggestion = getHookKeyframeMotionReviewDraft(draft.scope.referenceId, draft.scope.sourceSha256);
  const suggestedDirections = suggestion?.candidatePlan ? hookMotionPlanDirections(suggestion.candidatePlan) : "";
  const directions = draft.motionInstructions ?? suggestedDirections;
  const durationSeconds = suggestion?.previewDurationSeconds ?? 4;
  let animationPrompt: string | null = null;
  let animationError: string | null = null;
  if (directions) {
    try { animationPrompt = buildHookAnimationPrompt({ directions, durationSeconds, generateAudio: draft.generateAudio }); }
    catch (error) { animationError = error instanceof Error ? error.message : "Review the animation instructions."; }
  }
  return {
    status: "preparation_preview" as const,
    canSubmitPaidAnimation: false as const,
    sourceMatched: Boolean(suggestion),
    staticReview: suggestion?.staticReview ?? null,
    requiresDecision: suggestion?.requiresDecision ?? false,
    decisionIssues: suggestion?.staticReview?.issues ?? [],
    imagePrompt: draft.imageAssetIds.length ? buildHookKeyframeImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions }).prompt : null,
    directions, suggestedDirections, customized: draft.motionInstructions !== null,
    animationPrompt, animationError, durationSeconds,
    generateAudio: draft.generateAudio,
    needsMotionReview: true as const,
  };
}
