import { buildHookKeyframeImagePrompt, buildHookFullRecreationOpeningImagePrompt, buildOriginalOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { getHookKeyframeMotionReviewDraft, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import type { HookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { buildStartingFrameAnimationPrompt, startingFrameWorkflowDirections, type StartingFrameWorkflow } from "./starting-frame-workflow.ts";
import { getPublicMiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { getLegacyCuratedHookMotionPlan } from "./hook-curated-motion.ts";
import { getWallMoneyMotion } from "./wall-money-motion.ts";
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { buildSourceMotionDirections } from "./hook-middle-frame-motion.ts";
import { formatGeneratedMotionPhases, formatMotionPromptTimes } from "./motion-phase-display.ts";

/** Preparation only. This is deliberately not a HookMotionCompilation ready receipt. */
export function getHookKeyframePromptPreview(draft: HookKeyframeDraft, format: StartingFrameWorkflow = "hook", creatorDirections?: string, legacyCreatorDirections?: string, assignedOpeningPrompt?: string, sourceDurationSeconds?: number) {
  const suggestion = getHookKeyframeMotionReviewDraft(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0);
  const curated = draft.version === 4 && draft.sourceFrame?.index === 0 && draft.sourceFrame.timeSeconds === 0
    ? getCuratedHookFrame(draft.scope.referenceId, draft.scope.sourceSha256) : undefined;
  const openingMotion = curated ? getPublicMiddleFrameMotionEntry(draft.scope.referenceId, draft.scope.sourceSha256, curated.index) : undefined;
  const legacyImage = Boolean(draft.generatedImage && draft.generatedImage.promptVersion < 5 && draft.sourceFrame && draft.sourceFrame.index > 0);
  const legacyPlan = legacyImage ? getLegacyCuratedHookMotionPlan(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame!.index) : undefined;
  const wallDirections = format === "wall_text" ? getWallMoneyMotion(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0) : undefined;
  const suggestedDirections = formatGeneratedMotionPhases(format !== "hook" ? wallDirections ?? startingFrameWorkflowDirections(format)
    : legacyImage ? legacyPlan ? hookMotionPlanDirections(legacyPlan) : legacyCreatorDirections ?? ""
    : openingMotion ? buildSourceMotionDirections(openingMotion)
    : suggestion?.candidatePlan ? hookMotionPlanDirections(suggestion.candidatePlan) : creatorDirections ?? "");
  const directions = formatMotionPromptTimes(draft.motionInstructions ?? suggestedDirections);
  const durationSeconds = format === "hook" ? suggestion?.previewDurationSeconds ?? 4 : 4;
  let animationPrompt: string | null = null;
  let animationError: string | null = null;
  if (directions) {
    try { animationPrompt = buildStartingFrameAnimationPrompt({ workflow: format, directions, durationSeconds, generateAudio: draft.generateAudio, removePhysicalText: draft.version === 4,
      ...(draft.version === 4 && format === "hook" && directions.includes("PHASE [") && Number.isFinite(sourceDurationSeconds ?? suggestion?.sourceDurationSeconds)
        ? { actionDurationSeconds: Math.min(sourceDurationSeconds ?? suggestion!.sourceDurationSeconds, durationSeconds) } : {}) }); }
    catch (error) { animationError = error instanceof Error ? error.message : "Review the animation instructions."; }
  }
  const publicEntry = draft.sourceFrame && getPublicMiddleFrameMotionEntry(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame.index);
  const imagePrompt = !draft.imageAssetIds.length ? null : draft.version === 4 ? buildOriginalOpeningImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256 }).prompt : publicEntry
    ? buildHookFullRecreationOpeningImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256 }).prompt
    : assignedOpeningPrompt ? [assignedOpeningPrompt, draft.instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${draft.instructions.trim()}` : ""].filter(Boolean).join("\n\n")
    : buildHookKeyframeImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256, sourceFrameIndex: draft.sourceFrame?.index }).prompt;
  return {
    status: "preparation_preview" as const,
    canSubmitPaidAnimation: false as const,
    sourceMatched: Boolean(suggestion || creatorDirections || wallDirections),
    reviewedWallMotion: Boolean(wallDirections),
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
