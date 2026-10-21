import catalogData from "./hook-keyframe-motion-catalog.json" with { type: "json" };
import plansA from "./hook-keyframe-motion-plans-a.json" with { type: "json" };
import plansB from "./hook-keyframe-motion-plans-b.json" with { type: "json" };
import plansC from "./hook-keyframe-motion-plans-c.json" with { type: "json" };
import { parseHookMotionRewrite, type HookMotionRewrite } from "./hook-motion-rewrite-contract.ts";

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

export function getHookKeyframeMotionReviewDraft(referenceId: string, sourceSha256: string) {
  const entry = hookKeyframeMotionCatalog[referenceId];
  if (!entry || entry.sourceSha256 !== sourceSha256) return undefined;
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

// Defensive linting supplements explicit review. It never turns legacy prose
// into an approved prompt, and does not interpret arbitrary user instructions.
const absentInputOrEditCommand = /@\s*(?:video|image)\s*\d|\b(?:source|reference|original)\b|\b(?:replace|swap|change)\b[^.!?\n]{0,100}\b(?:face|facial identity)\b|\bface[ -]?swap\b|\b(?:supporting|reference)\s+(?:photos?|portraits?|images?)\b|\bstill pose\b|\b(?:audio|music|sound|spoken|dialogue|narration|speech|singing|lip[ -]?sync)\b|\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen)[ -]seconds?\b|\bremove\b[^.!?\n]{0,80}\b(?:captions?|text|overlays?)\b/i;

function isNonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function planText(plan: HookMotionPlan): string[] {
  return [plan.openingState, ...plan.beats.map(beat => beat.action), plan.camera, plan.endingState, ...plan.constraints];
}

/** User-visible action directions; contains no source-video or identity input. */
export function hookMotionPlanDirections(plan: HookMotionPlan): string {
  return [
    `OPENING STATE: ${plan.openingState.trim()}`,
    ...plan.beats.map(beat => `${beat.phase.toUpperCase()}: ${beat.action.trim()}`),
    `CAMERA: ${plan.camera.trim()}`,
    `ENDING STATE: ${plan.endingState.trim()}`,
    ...plan.constraints.map(constraint => `CONSTRAINT: ${constraint.trim()}`),
  ].join("\n\n");
}

/** Prompt construction only, never evidence of catalog review or paid admission. */
export function buildHookAnimationPrompt(input: { directions: string; durationSeconds: number; generateAudio: boolean }) {
  if (typeof input.directions !== "string" || !input.directions.trim() || input.directions.length > 6_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input.directions)) {
    throw new Error("Describe the animation within 6,000 characters.");
  }
  if (absentInputOrEditCommand.test(input.directions)) {
    throw new Error("Describe visible actions directly. Keep face replacement, source-video references, duration and sound settings out of the action instructions.");
  }
  if (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 4 || input.durationSeconds > 15 || typeof input.generateAudio !== "boolean") {
    throw new Error("Choose a supported animation duration and sound setting.");
  }
  const sound = input.generateAudio
    ? "SOUND SETTING: ON. Natural ambient sound is allowed. Do not add spoken words, dialogue, singing or lip-sync unless separately requested."
    : "SOUND SETTING: OFF. Return a completely silent video, with no music, speech or sound effects. Natural expressive mouth movements may occur without sound.";
  return [
    `Animate the approved starting image into a ${input.durationSeconds}-second video. The image supplies the person's appearance and the complete opening composition.`,
    "Keep the approved facial features and proportions, hairstyle, clothing, lighting and scene consistent throughout the movement. Do not replace the person's identity or introduce a different person.",
    input.directions.trim(),
    "Do not add captions, floating logos or creator-added graphics. Preserve text physically present on objects in the approved image.",
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
