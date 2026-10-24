import type { HookMotionCatalogEntry, HookMotionPlan } from "./hook-keyframe-motion.ts";

export type HookMotionRewrite = {
  referenceId: string;
  sourceSha256: string;
  /** Nonbillable preview duration; older rewrites default to four seconds. */
  previewDurationSeconds?: number;
  plan: HookMotionPlan;
  review: {
    status: "static_reviewed" | "needs_decision";
    startingFrameIndex: 0;
    supportedDurationsSeconds: number[];
    method: "canonical_frames_and_prior_notes";
    sampledFrameIndices: number[];
    frameCount: number;
    reviewNote: string;
    issues: string[];
    sourceFileSha256: string;
    visualQualification: "not_tested";
  };
};

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 6000 &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
const phases = ["opening", "middle", "ending"];

/** Source-bound static review evidence. Never promotes a record to paid readiness. */
export function parseHookMotionRewrite(value: unknown, source: HookMotionCatalogEntry): HookMotionRewrite | null {
  if (!object(value) || value.referenceId !== source.referenceId || value.sourceSha256 !== source.sourceSha256 ||
    !object(value.plan) || !object(value.review)) return null;
  const plan = value.plan, review = value.review;
  const beats = plan.beats;
  const samples = review.sampledFrameIndices;
  const previewDuration = value.previewDurationSeconds ?? 4;
  if (!Number.isSafeInteger(previewDuration) || (previewDuration as number) < 4 || (previewDuration as number) > 15) return null;
  if (![plan.openingState, plan.camera, plan.endingState].every(text) || !Array.isArray(beats) || beats.length < 1 || beats.length > 12 ||
    !beats.every((beat: unknown, index: number) => object(beat) && typeof beat.phase === "string" && phases.includes(beat.phase) && text(beat.action) &&
      (index === 0 || object(beats[index - 1]) && typeof beats[index - 1].phase === "string" && phases.indexOf(beat.phase) >= phases.indexOf(beats[index - 1].phase))) ||
    !Array.isArray(plan.constraints) || plan.constraints.length > 12 || !plan.constraints.every(text)) return null;
  const staticReview = review.status === "static_reviewed";
  if ((!staticReview && review.status !== "needs_decision") || review.startingFrameIndex !== 0 || review.method !== "canonical_frames_and_prior_notes" ||
    review.frameCount !== source.sourceReviewedFrameCount || review.sourceFileSha256 !== source.sourceSha256 || review.visualQualification !== "not_tested" ||
    !text(review.reviewNote) || !Array.isArray(review.issues) || !review.issues.every(text) ||
    !Array.isArray(review.supportedDurationsSeconds) || (staticReview ? review.supportedDurationsSeconds.length !== 1 || review.supportedDurationsSeconds[0] !== previewDuration || review.issues.length > 0
      : review.supportedDurationsSeconds.length !== 0 || review.issues.length === 0) ||
    !Array.isArray(samples) || samples.length < 3 ||
    samples[0] !== 0 || samples.at(-1) !== source.sourceReviewedFrameCount - 1 ||
    !samples.every((index: unknown, i: number) => Number.isSafeInteger(index) && (index as number) >= 0 &&
      (index as number) < source.sourceReviewedFrameCount && (i === 0 || (index as number) > samples[i - 1]))) return null;
  return value as HookMotionRewrite;
}
