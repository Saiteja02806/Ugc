import { buildHookKeyframeImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { getHookKeyframeMotionReviewDraft, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import type { HookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { buildStartingFrameAnimationPrompt, startingFrameWorkflowDirections, type StartingFrameWorkflow } from "./starting-frame-workflow.ts";

/** Preparation only. This is deliberately not a HookMotionCompilation ready receipt. */
export function getHookKeyframePromptPreview(draft: HookKeyframeDraft, format: StartingFrameWorkflow = "hook", creatorDirections?: string) {
  const suggestion = getHookKeyframeMotionReviewDraft(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0);
  const suggestedDirections = format !== "hook" ? startingFrameWorkflowDirections(format) : suggestion?.candidatePlan ? hookMotionPlanDirections(suggestion.candidatePlan) : creatorDirections ?? "";
  const directions = draft.motionInstructions ?? suggestedDirections;
  const durationSeconds = format === "hook" ? suggestion?.previewDurationSeconds ?? 4 : 4;
  let animationPrompt: string | null = null;
  let animationError: string | null = null;
  if (directions) {
    try { animationPrompt = buildStartingFrameAnimationPrompt({ workflow: format, directions, durationSeconds, generateAudio: draft.generateAudio }); }
    catch (error) { animationError = error instanceof Error ? error.message : "Review the animation instructions."; }
  }
  return {
    status: "preparation_preview" as const,
    canSubmitPaidAnimation: false as const,
    sourceMatched: Boolean(suggestion || creatorDirections),
    staticReview: suggestion?.staticReview ?? null,
    requiresDecision: format === "hook" && (suggestion?.requiresDecision ?? false),
    decisionIssues: suggestion?.staticReview?.issues ?? [],
    imagePrompt: draft.imageAssetIds.length ? buildHookKeyframeImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions,
      referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256, sourceFrameIndex: draft.sourceFrame?.index }).prompt : null,
    directions, suggestedDirections, customized: draft.motionInstructions !== null,
    animationPrompt, animationError, durationSeconds,
    generateAudio: draft.generateAudio,
    needsMotionReview: true as const,
  };
}
