import { buildHookKeyframeImagePrompt, buildHookFullRecreationOpeningImagePrompt, buildOriginalOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { getHookKeyframeMotionReviewDraft, hookKeyframeMotionCatalog, hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft, type HookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { buildStartingFrameAnimationPrompt, startingFrameWorkflowDirections, type StartingFrameWorkflow } from "./starting-frame-workflow.ts";
import { getPublicMiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { getLegacyCuratedHookMotionPlan } from "./hook-curated-motion.ts";
import { getWallMoneyMotion } from "./wall-money-motion.ts";
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { buildSourceMotionDirections } from "./hook-middle-frame-motion.ts";
import { formatGeneratedMotionPhases, formatMotionPromptTimes } from "./motion-phase-display.ts";
import { getTalkingHeadSceneDirections } from "./talking-head-scene-directions.ts";
import { withStartingFrameReferenceOptions } from "../../worker/src/lib/starting-frame-reference-options.ts";

/** Preparation only. This is deliberately not a HookMotionCompilation ready receipt. */
export function getHookKeyframePromptPreview(draft: HookKeyframeDraft, format: StartingFrameWorkflow = "hook", creatorDirections?: string, legacyCreatorDirections?: string, assignedOpeningPrompt?: string, sourceDurationSeconds?: number) {
  const suggestion = getHookKeyframeMotionReviewDraft(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0);
  const curated = draft.version === 4 && draft.sourceFrame?.index === 0 && draft.sourceFrame.timeSeconds === 0
    ? getCuratedHookFrame(draft.scope.referenceId, draft.scope.sourceSha256) : undefined;
  const openingMotion = curated ? getPublicMiddleFrameMotionEntry(draft.scope.referenceId, draft.scope.sourceSha256, curated.index) : undefined;
  const legacyImage = Boolean(draft.generatedImage && draft.generatedImage.promptVersion < 5 && draft.sourceFrame && draft.sourceFrame.index > 0);
  const legacyPlan = legacyImage ? getLegacyCuratedHookMotionPlan(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame!.index) : undefined;
  const wallDirections = format === "wall_text" ? getWallMoneyMotion(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame?.index ?? 0) : undefined;
  const talkingDirections = format === "talking_head"
    ? getTalkingHeadSceneDirections(draft.scope.referenceId, draft.scope.sourceSha256) ?? startingFrameWorkflowDirections("talking_head")
    : undefined;
  const suggestedDirections = formatGeneratedMotionPhases(format === "talking_head" ? talkingDirections!
    : format !== "hook" ? wallDirections ?? startingFrameWorkflowDirections(format)
    : legacyImage ? legacyPlan ? hookMotionPlanDirections(legacyPlan) : legacyCreatorDirections ?? ""
    : openingMotion ? buildSourceMotionDirections(openingMotion)
    : suggestion?.candidatePlan ? hookMotionPlanDirections(suggestion.candidatePlan) : creatorDirections ?? "");
  const directions = formatMotionPromptTimes(draft.motionInstructions ?? suggestedDirections);
  const durationSeconds = format === "hook" ? Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds! > 0 ? Math.min(30, Math.max(3, Math.ceil(sourceDurationSeconds! - .001))) : suggestion?.previewDurationSeconds ?? 4 : 4;
  let animationPrompt: string | null = null;
  let animationError: string | null = null;
  if (directions) {
    try { animationPrompt = buildStartingFrameAnimationPrompt({ workflow: format, directions, durationSeconds, generateAudio: draft.generateAudio, removePhysicalText: draft.version === 4, identityPhotoCount: draft.imageAssetIds.length, ...(format === "hook" ? { maxDurationSeconds: 30 } : {}),
      ...(draft.version === 4 && format === "hook" && directions.includes("PHASE [") && Number.isFinite(sourceDurationSeconds ?? suggestion?.sourceDurationSeconds)
        ? { actionDurationSeconds: Math.min(sourceDurationSeconds ?? suggestion!.sourceDurationSeconds, durationSeconds) } : {}) }); }
    catch (error) { animationError = error instanceof Error ? error.message : "Review the animation instructions."; }
  }
  const publicEntry = draft.sourceFrame && getPublicMiddleFrameMotionEntry(draft.scope.referenceId, draft.scope.sourceSha256, draft.sourceFrame.index);
  const imagePrompt = draft.customImagePrompt ?? (!draft.imageAssetIds.length ? null : draft.version === 4 ? buildOriginalOpeningImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256 }).prompt : publicEntry
    ? buildHookFullRecreationOpeningImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256 }).prompt
    : assignedOpeningPrompt ? [assignedOpeningPrompt, draft.instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${draft.instructions.trim()}` : ""].filter(Boolean).join("\n\n")
    : buildHookKeyframeImagePrompt({ personImageCount: draft.imageAssetIds.length, instructions: draft.instructions, referenceId: draft.scope.referenceId, sourceSha256: draft.scope.sourceSha256, sourceFrameIndex: draft.sourceFrame?.index }).prompt);
  return {
    status: "preparation_preview" as const,
    canSubmitPaidAnimation: false as const,
    sourceMatched: Boolean(suggestion || creatorDirections || wallDirections),
    reviewedWallMotion: Boolean(wallDirections),
    staticReview: suggestion?.staticReview ?? null,
    requiresDecision: format === "hook" && (suggestion?.requiresDecision ?? false),
    decisionIssues: suggestion?.staticReview?.issues ?? [],
    imagePrompt: imagePrompt ? withStartingFrameReferenceOptions(imagePrompt, draft.referenceOptions) : null,
    directions, suggestedDirections, customized: draft.motionInstructions !== null,
    animationPrompt, animationError, durationSeconds,
    generateAudio: draft.generateAudio,
    needsMotionReview: true as const,
  };
}

const staleWhatMotion = /form that one word|mouth the word what|Open the mouth again|mouth opens in surprise|Open the mouth wide into a final/;

/** A saved Recreate frame keeps the prompt copied at approval. Replace only an
 * older automatic what-prompt so the current catalog wording is what gets sent. */
export function adoptCurrentWhatMotion(saved: string, referenceId: string, sourceSha256: string): string {
  const stale = staleWhatMotion.test(saved) || (saved.includes("Stretch one what") && !saved.includes("form it only this once"));
  if (!stale) return saved;
  const source = hookKeyframeMotionCatalog[referenceId];
  if (!source || source.sourceSha256 !== sourceSha256) return saved;
  try {
    const draft = updateHookKeyframeDraft(createHookKeyframeDraft({
      ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId, sourceSha256,
    }), { sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } });
    const preview = getHookKeyframePromptPreview(draft, "hook", undefined, undefined, undefined, source.sourceDurationSeconds);
    return !preview.animationError && preview.directions.includes("form it only this once") ? preview.directions : saved;
  } catch {
    return saved;
  }
}

const genericTalkingHeadMotion = startingFrameWorkflowDirections("talking_head");

/** A saved Talking Head frame keeps the prompt copied at approval. Replace only the
 * generic scene sentence so the selected clip's own directions are what gets sent. */
export function adoptCurrentTalkingHeadMotion(saved: string, referenceId: string, sourceSha256: string): string {
  if (saved.trim() !== genericTalkingHeadMotion) return saved;
  const current = getTalkingHeadSceneDirections(referenceId, sourceSha256);
  return current ? formatMotionPromptTimes(formatGeneratedMotionPhases(current)) : saved;
}
