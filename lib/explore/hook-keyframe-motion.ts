import { hookMotionPlanDirections } from "./hook-motion-plan-directions.ts";
export { hookMotionPlanDirections } from "./hook-motion-plan-directions.ts";
import catalogData from "./hook-keyframe-motion-catalog.json" with { type: "json" };
import { getCuratedHookMotionPlan } from "./hook-curated-motion.ts";
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import plansA from "./hook-keyframe-motion-plans-a.json" with { type: "json" };
import plansB from "./hook-keyframe-motion-plans-b.json" with { type: "json" };
import plansC from "./hook-keyframe-motion-plans-c.json" with { type: "json" };
import reclassifiedPlans from "./hook-wall-reclassification-motion.json" with { type: "json" };
import notbeen3Plans from "./hook-notbeen3-motion.json" with { type: "json" };
import notbeen2Plans from "./hook-notbeen2-motion.json" with { type: "json" };
import { getHookReferenceReleaseItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { parseHookMotionRewrite, type HookMotionRewrite } from "./hook-motion-rewrite-contract.ts";
import { retimeSourceMotionDirections } from "./hook-middle-frame-motion.ts";

export const HOOK_KEYFRAME_MOTION_VERSION = 1 as const;

export type HookMotionRisk =
  | "source_only_instructions"
  | "source_duration_dependency"
  | "image_pose_override"
  | "overlay_cleanup_in_motion"
  | "identity_replacement_in_motion"
  | "no_person_in_opening_frame"
  | "multiple_takes"
  | "jump_cut"
  | "secondary_person_reveal"
  | "camera_reveals_unseen_scene"
  | "partial_face_crop"
  | "face_prop_contact"
  | "hand_or_prop_occlusion"
  | "profile_turn"
  | "prop_leaves_and_hand_returns"
  | "duplicate_display_title";

export type HookMotionPlan = {
  openingState: string;
  beats: ReadonlyArray<{ phase: "opening" | "middle" | "ending"; action: string }>;
  camera: string;
  endingState: string;
  constraints: readonly string[];
  /** Reviewed wording: camera and ending summaries repeat the timed beats. */
  summariesInTimeline?: readonly ("camera" | "ending")[];
};

export type HookMotionReview = {
  status: "reviewed_for_starting_frame";
  motionVersion: typeof HOOK_KEYFRAME_MOTION_VERSION;
  startingFrameIndex: number;
  supportedDurationsSeconds: readonly number[];
  reviewMethod: "source_observations_and_opening_frame";
  reviewNote: string;
  reviewedBy: string;
  reviewedAt: string;
  plan: HookMotionPlan;
  // A reviewed prompt is not evidence of a successful generated video.
  visualQualification: "not_tested" | "passed" | "failed";
};

export type HookMotionCatalogEntry = {
  catalogVersion: typeof HOOK_KEYFRAME_MOTION_VERSION;
  referenceId: string;
  sourceSha256: string;
  displayTitle: string;
  sourceDurationSeconds: number;
  sourceReviewedFrameCount: number;
  sourceReviewMethod: "all_decoded_frames";
  sourceReviewNotes: string;
  sourceObservations: string;
  motionReviewStatus: "needs_motion_review" | "reviewed_for_starting_frame";
  riskFlags: readonly HookMotionRisk[];
  motionReview?: HookMotionReview;
};

/** Source observations are review material, never an animation fallback. */
export const hookKeyframeMotionCatalog: Readonly<Record<string, HookMotionCatalogEntry>> =
  Object.freeze(Object.fromEntries(catalogData.entries.map(entry => [
    entry.referenceId,
    Object.freeze(entry as HookMotionCatalogEntry),
  ])));

const rewriteRecords = [...plansA.entries, ...plansB.entries, ...plansC.entries];
/** Adapted plans and source-frame review, separate from paid animation admission. */
export const hookKeyframeMotionRewrites: Readonly<Record<string, HookMotionRewrite>> = Object.freeze(Object.fromEntries(
  rewriteRecords.flatMap(value => {
    const source = hookKeyframeMotionCatalog[value.referenceId];
    if (!source || rewriteRecords.filter(item => item.referenceId === value.referenceId).length !== 1) return [];
    const checked = parseHookMotionRewrite(value, source);
    return checked ? [[value.referenceId, checked]] : [];
  }),
));

export type HookMotionInput = {
  referenceId: string;
  sourceSha256: string;
  startingFrameIndex: number;
  durationSeconds: number;
  generateAudio: boolean;
};

export type HookMotionBlockedReason =
  | "unknown_reference"
  | "source_hash_changed"
  | "motion_review_required"
  | "opening_frame_not_reviewed"
  | "duration_not_reviewed"
  | "invalid_review"
  | "source_dependent_motion";

export type HookMotionCompilation =
  | { status: "blocked"; reason: HookMotionBlockedReason }
  | {
    status: "ready";
    prompt: string;
    motionVersion: typeof HOOK_KEYFRAME_MOTION_VERSION;
    referenceId: string;
    sourceSha256: string;
    startingFrameIndex: number;
    durationSeconds: number;
    generateAudio: boolean;
    visualQualification: HookMotionReview["visualQualification"];
  };

export function getHookKeyframeMotionReviewDraft(referenceId: string, sourceSha256: string, startingFrameIndex = 0) {
  const selected = getCuratedHookFrame(referenceId, sourceSha256);
  const plan = getCuratedHookMotionPlan(referenceId, sourceSha256, startingFrameIndex);
  if (selected && plan) return {
    status: "review_draft" as const, referenceId, sourceSha256, displayTitle: `Hook ${selected.number}`,
    sourceDurationSeconds: hookKeyframeMotionCatalog[referenceId]?.sourceDurationSeconds ?? 4, previewDurationSeconds: 4, sourceObservations: "Adapted to the selected visible moment; inspect the approved image and motion before generation.",
    riskFlags: [] as HookMotionRisk[], candidatePlan: plan, staticReview: null, requiresDecision: false,
    canSubmitPaidAnimation: false as const,
  };
  const entry = hookKeyframeMotionCatalog[referenceId];
  if (!entry || entry.sourceSha256 !== sourceSha256) return getReclassifiedHookMotionReview(referenceId, sourceSha256, startingFrameIndex, getHookReferenceReleaseItems());
  const rewrite = hookKeyframeMotionRewrites[referenceId];
  return {
    status: "review_draft" as const,
    referenceId: entry.referenceId,
    sourceSha256: entry.sourceSha256,
    displayTitle: entry.displayTitle,
    sourceDurationSeconds: entry.sourceDurationSeconds,
    previewDurationSeconds: rewrite?.previewDurationSeconds ?? 4,
    sourceObservations: entry.sourceObservations,
    riskFlags: entry.riskFlags,
    candidatePlan: rewrite?.plan,
    staticReview: rewrite?.review ?? null,
    requiresDecision: rewrite?.review.status === "needs_decision",
    canSubmitPaidAnimation: false as const,
  };
}

/** A published release item, including a card removed from the gallery, may
 * surface its reviewed plan for a saved recreation. The plan never grants paid admission. */
export function getReclassifiedHookMotionReview(referenceId: string, sourceSha256: string, startingFrameIndex: number, activeItems: readonly { id: string; videoSha256: string }[]) {
  if (startingFrameIndex !== 0 || !activeItems.some(item => item.id === referenceId && item.videoSha256 === sourceSha256)) return undefined;
  const entry = [...reclassifiedPlans.entries, ...notbeen2Plans.entries, ...notbeen3Plans.entries].find(item => item.referenceId === referenceId && item.sourceSha256 === sourceSha256);
  if (!entry) return undefined;
  return { status: "review_draft" as const, referenceId, sourceSha256, displayTitle: entry.displayTitle,
    sourceDurationSeconds: entry.sourceDurationSeconds, previewDurationSeconds: 4,
    sourceObservations: entry.reviewNotes,
    riskFlags: [] as HookMotionRisk[], candidatePlan: entry.plan as HookMotionPlan, staticReview: null,
    requiresDecision: false, canSubmitPaidAnimation: false as const };
}

// Defensive linting supplements explicit review. It never turns legacy prose
// into an approved prompt, and does not interpret arbitrary user instructions.
const absentInputOrEditCommand = /@\s*(?:video|image)\s*\d|\b(?:source|reference|original)\b|\b(?:replace|swap|change)\b[^.!?\n]{0,100}\b(?:face|facial identity)\b|\bface[ -]?swap\b|\b(?:supporting|reference)\s+(?:photos?|portraits?|images?)\b|\bstill pose\b|\b(?:audio|music|sound|spoken|dialogue|narration|speech|singing|lip[ -]?sync)\b|\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen)[ -]seconds?\b|\bremove\b[^.!?\n]{0,80}\b(?:captions?|text|overlays?)\b/i;

function isNonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function planText(plan: HookMotionPlan): string[] {
  return [plan.openingState, ...plan.beats.map(beat => beat.action), plan.camera, plan.endingState, ...plan.constraints];
}

/** Prompt construction only, never evidence of catalog review or paid admission. */
export function buildHookAnimationPrompt(input: { directions: string; durationSeconds: number; generateAudio: boolean; actionDurationSeconds?: number; removePhysicalText?: boolean; identityPhotoCount?: number; maxDurationSeconds?: number }) {
  if (typeof input.directions !== "string" || !input.directions.trim() || input.directions.length > 6_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input.directions)) {
    throw new Error("Describe the animation within 6,000 characters.");
  }
  if (absentInputOrEditCommand.test(input.directions)) {
    throw new Error("Describe visible actions directly. Keep face replacement, source-video references, duration and sound settings out of the action instructions.");
  }
  if (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 3 || input.durationSeconds > (input.maxDurationSeconds ?? 15) || typeof input.generateAudio !== "boolean") {
    throw new Error("Choose a supported animation duration and sound setting.");
  }
  const sound = input.generateAudio
    ? "SOUND SETTING: ON. Sync supplied words once, else a brief nonverbal reaction. Ambient sound allowed."
    : "SOUND SETTING: OFF. Silent; retain timed lips, jaw and word articulation.";
  return [
    input.identityPhotoCount
      ? `Animate approved Image 1 as frame 0 for ${input.durationSeconds}s.`
      : `Animate the approved image as frame 0 for ${input.durationSeconds}s. Keep its face, hair, clothes, light and scene.`,
    ...(input.identityPhotoCount && input.identityPhotoCount > 0 ? [
      `Image 2=main face proportions${input.identityPhotoCount === 1 ? "" : input.identityPhotoCount === 2 ? "; Image 3=same-person support" : `; Images 3–${input.identityPhotoCount + 1}=same-person support`}. Identity only; Image 1 sets hair, clothes, light, scene and pose. No blended faces or extra people.`,
    ] : []),
    // The attached literal first frame already supplies this static pose.
    // Keep every timed action, including the opening hold and complete ending.
    retimeSourceMotionDirections(input.directions.includes("PHASE [")
      ? input.directions.trim().replace(/^OPENING STATE:[^\n]+\n\s*/u, "")
      : input.directions.trim(), input.durationSeconds, input.actionDurationSeconds, input.maxDurationSeconds),
    input.removePhysicalText ? "Keep cleaned surfaces plain; no captions, letters, logos or watermarks." : "Add no captions or graphics. Keep physical object text.",
    sound,
  ].join("\n\n");
}

/**
 * Compile a trusted, explicitly reviewed record only. A server must source this
 * record from its reviewed catalog, never a request body's asserted review.
 * Ownership, approved-image validation, model support and billing are separate
 * admission checks. This pure function performs no generation or network work.
 */
export function compileReviewedHookKeyframeMotionPrompt(
  entry: HookMotionCatalogEntry,
  input: HookMotionInput,
): HookMotionCompilation {
  if (entry.referenceId !== input.referenceId) return { status: "blocked", reason: "unknown_reference" };
  if (entry.sourceSha256 !== input.sourceSha256) return { status: "blocked", reason: "source_hash_changed" };
  const review = entry.motionReview;
  if (entry.motionReviewStatus !== "reviewed_for_starting_frame" || review?.status !== "reviewed_for_starting_frame") {
    return { status: "blocked", reason: "motion_review_required" };
  }
  if (entry.catalogVersion !== HOOK_KEYFRAME_MOTION_VERSION || !/^[a-f0-9]{64}$/.test(entry.sourceSha256)
    || !Number.isSafeInteger(entry.sourceReviewedFrameCount) || entry.sourceReviewedFrameCount < 1
    || !Array.isArray(review.supportedDurationsSeconds)) {
    return { status: "blocked", reason: "invalid_review" };
  }
  if (!Number.isSafeInteger(input.startingFrameIndex) || input.startingFrameIndex < 0
    || input.startingFrameIndex >= entry.sourceReviewedFrameCount || input.startingFrameIndex !== review.startingFrameIndex) {
    return { status: "blocked", reason: "opening_frame_not_reviewed" };
  }
  if (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 4 || input.durationSeconds > 15 || !review.supportedDurationsSeconds.includes(input.durationSeconds)) {
    return { status: "blocked", reason: "duration_not_reviewed" };
  }
  const plan = review.plan;
  if (review.motionVersion !== HOOK_KEYFRAME_MOTION_VERSION || review.reviewMethod !== "source_observations_and_opening_frame"
    || !isNonempty(review.reviewNote) || !isNonempty(review.reviewedBy) || !isNonempty(review.reviewedAt)
    || !Number.isFinite(Date.parse(review.reviewedAt)) || typeof input.generateAudio !== "boolean"
    || !plan || !Array.isArray(plan.beats) || !plan.beats.length || !Array.isArray(plan.constraints)
    || !plan.beats.every(beat => ["opening", "middle", "ending"].includes(beat.phase) && isNonempty(beat.action))
    || !["not_tested", "passed", "failed"].includes(review.visualQualification)) {
    return { status: "blocked", reason: "invalid_review" };
  }
  const content = planText(plan);
  if (!content.every(isNonempty)) return { status: "blocked", reason: "invalid_review" };
  const phases = ["opening", "middle", "ending"];
  if (plan.beats.some((beat, index) => index > 0 && phases.indexOf(beat.phase) < phases.indexOf(plan.beats[index - 1].phase))) {
    return { status: "blocked", reason: "invalid_review" };
  }
  if (content.some(text => absentInputOrEditCommand.test(text))) return { status: "blocked", reason: "source_dependent_motion" };

  const directions = hookMotionPlanDirections(plan);
  if (directions.length > 6_000 || content.some(text => /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text))) return { status: "blocked", reason: "invalid_review" };
  const prompt = buildHookAnimationPrompt({ directions, durationSeconds: input.durationSeconds, generateAudio: input.generateAudio });
  return {
    status: "ready", prompt, motionVersion: HOOK_KEYFRAME_MOTION_VERSION,
    referenceId: entry.referenceId, sourceSha256: entry.sourceSha256,
    startingFrameIndex: input.startingFrameIndex, durationSeconds: input.durationSeconds,
    generateAudio: input.generateAudio, visualQualification: review.visualQualification,
  };
}

/** Default catalog admission fails closed while the 98 adaptations need review. */
export function getHookKeyframeMotionPrompt(input: HookMotionInput): HookMotionCompilation {
  const entry = hookKeyframeMotionCatalog[input.referenceId];
  return entry ? compileReviewedHookKeyframeMotionPrompt(entry, input) : { status: "blocked", reason: "unknown_reference" };
}
