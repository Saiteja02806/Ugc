import { buildHookKeyframeImagePrompt, buildHookFullRecreationOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { getHookKeyframeMotionReviewDraft, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import type { HookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { buildStartingFrameAnimationPrompt, startingFrameWorkflowDirections, type StartingFrameWorkflow } from "./starting-frame-workflow.ts";
import { getPublicMiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { getLegacyCuratedHookMotionPlan } from "./hook-curated-motion.ts";
import { getWallMoneyMotion } from "./wall-money-motion.ts";

/** Preparation only. This is deliberately not a HookMotionCompilation ready receipt. */
export function getHookKeyframePromptPreview(draft: HookKeyframeDraft, format: StartingFrameWorkflow = "hook", creatorDirections?: string, legacyCreatorDirections?: string, assignedOpeningPrompt?: string) {
  const suggestion = getHookKeyframeMotionReviewDraft(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0);
  const legacyImage = Boolean(draft.generatedImage && draft.generatedImage.promptVersion < 5 && draft.sourceFrame && draft.sourceFrame.index > 0);
  const legacyPlan = legacyImage ? getLegacyCuratedHookMotionPlan(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame!.index) : undefined;
  const wallDirections = format === "wall_text" ? getWallMoneyMotion(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0) : undefined;
  const suggestedDirections = format !== "hook" ? wallDirections ?? startingFrameWorkflowDirections(format)
    : legacyImage ? legacyPlan ? hookMotionPlanDirections(legacyPlan) : legacyCreatorDirections ?? ""
    : suggestion?.candidatePlan ? hookMotionPlanDirections(suggestion.candidatePlan) : creatorDirections ?? "";
  const directions = draft.motionInstructions ?? suggestedDirections;
  const durationSeconds = format === "hook" ? suggestion?.previewDurationSeconds ?? 4 : 4;
  let animationPrompt: string | null = null;
  let animationError: string | null = null;
  if (directions) {
    try { animationPrompt = buildStartingFrameAnimationPrompt({ workflow: format, directions, durationSeconds, generateAudio: draft.generateAudio }); }
    catch (error) { animationError = error instanceof Error ? error.message : "Review the animation instructions."; }
  }
  const publicEntry = draft.sourceFrame && getPublicMiddleFrameMotionEntry(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame.index);
  const imagePrompt = !draft.imageAssetIds.length ? null : publicEntry
    ? buildHookFullRecreationOpeningImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256 }).prompt
    : assignedOpeningPrompt ? [assignedOpeningPrompt, draft.instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${draft.instructions.trim()}` : ""].filter(Boolean).join("\n\n")
    : buildHookKeyframeImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256, sourceFrameIndex: draft.sourceFrame?.index }).prompt;
  return {
    status: "preparation_preview" as const,
    canSubmitPaidAnimation: false as const,
    sourceMatched: Boolean(suggestion || creatorDirections || wallDirections),
    staticReview: suggestion?.staticReview ?? null,
    requiresDecision: format === "hook" && (suggestion?.requiresDecision ?? false),
    decisionIssues: suggestion?.staticReview?.issues ?? [],
    imagePrompt,
    directions, suggestedDirections, customized: draft.motionInstructions !== null,
    animationPrompt, animationError, durationSeconds,
    generateAudio: draft.generateAudio,
    needsMotionReview: true as const,
  };
}
