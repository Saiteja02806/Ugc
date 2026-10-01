import type {
  BackgroundJobRecord,
  BackgroundJobStatus,
  BackgroundJobType,
  Json,
} from "./background-jobs.ts";

export const CANONICAL_BACKGROUND_JOB_TYPES = [
  "hook_text_generation",
  "trending_prebuild",
  "wall_text_content_plan_generation",
  "wall_text_generation",
  "carousel_generation",
  "image_generation",
  "video_generation",
  "preview_render",
  "final_render",
  "media_analysis",
  "paid_trending_prebuild",
  "social_publish",
  "analytics_sync",
] as const;

export type CanonicalBackgroundJobType =
  (typeof CANONICAL_BACKGROUND_JOB_TYPES)[number];

export const ACTIVE_BACKGROUND_JOB_STATUSES = [
  "created",
  "queued",
  "processing",
  "waiting_external_service",
  "rendering",
  "uploading_output",
  "cancel_requested",
  "stalled",
] as const satisfies readonly BackgroundJobStatus[];

export const TERMINAL_BACKGROUND_JOB_STATUSES = [
  "completed",
  "failed",
  "cancelled",
] as const satisfies readonly BackgroundJobStatus[];

const canonicalTypeByImplementation: Record<
  BackgroundJobType,
  CanonicalBackgroundJobType
> = {
  analytics_sync: "analytics_sync",
  carousel_content_plan_generation: "carousel_generation",
  carousel_generation: "carousel_generation",
  extract_video_metadata: "media_analysis",
  final_render: "final_render",
  generate_avatar: "video_generation",
  generate_carousel: "carousel_generation",
  generate_hook_video: "video_generation",
  generate_image: "image_generation",
  generate_thumbnail: "media_analysis",
  generate_trending_hook_copy: "hook_text_generation",
  hook_text_generation: "hook_text_generation",
  image_generation: "image_generation",
  media_analysis: "media_analysis",
  paid_trending_prebuild: "trending_prebuild",
  preview_render: "preview_render",
  publish_social_post: "social_publish",
  reaction_generation: "video_generation",
  reaction_render: "video_generation",
  render_create_content_video: "final_render",
  render_demo_video: "final_render",
  render_edit_video: "final_render",
  render_schedule_combination: "final_render",
  render_trending_carousel_edit: "carousel_generation",
  render_wall_text_video: "final_render",
  social_publish: "social_publish",
  test_worker_job: "media_analysis",
  video_generation: "video_generation",
  wall_text_content_plan_generation: "wall_text_generation",
  wall_text_generation: "wall_text_generation",
};

export type PublicBackgroundJob = {
  cancelRequestedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  failedAt: string | null;
  id: string;
  jobType: CanonicalBackgroundJobType;
  output: Json | null;
  outputReference: string | null;
  progress: number | null;
  projectId: string | null;
  queuedAt: string | null;
  stage: string | null;
  startedAt: string | null;
  status: BackgroundJobStatus;
  updatedAt: string;
};

export function getCanonicalBackgroundJobType(
  jobType: BackgroundJobType,
): CanonicalBackgroundJobType {
  return canonicalTypeByImplementation[jobType];
}

export function isActiveBackgroundJobStatus(status: BackgroundJobStatus) {
  return (ACTIVE_BACKGROUND_JOB_STATUSES as readonly string[]).includes(status);
}

export function isTerminalBackgroundJobStatus(status: BackgroundJobStatus) {
  return (TERMINAL_BACKGROUND_JOB_STATUSES as readonly string[]).includes(
    status,
  );
}

export function isRetryableBackgroundJob(job: BackgroundJobRecord) {
  const errorCode = getPublicJobErrorCode(job);
  // A provider's terminal failure needs a new, explicitly requested generation.
  // Replaying this job cannot revive its saved provider operation.
  if (
    errorCode === "PROVIDER_CONTENT_MODERATION" ||
    errorCode === "PROVIDER_INSUFFICIENT_CREDITS" ||
    errorCode === "provider_submission_uncertain" ||
    errorCode === "provider_operation_failed" ||
    isProviderBalanceFailure(job.errorMessage) ||
    /ended with status (?:failed|moderated|nsfw|canceled|cancelled)/i.test(job.errorMessage ?? "")
  ) {
    return false;
  }
  return (
    (job.status === "failed" || job.status === "stalled") &&
    job.attemptCount < job.maxAttempts
  );
}

export function getPublicBackgroundJob(job: BackgroundJobRecord) {
  const hideWallTextFailureDetails = isWallTextJob(job.jobType);
  const errorCode = getPublicJobErrorCode(job);
  const retryable = isRetryableBackgroundJob(job);
  return {
    cancelRequestedAt: job.cancelRequestedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    error:
      job.status === "failed" || job.status === "stalled"
        ? {
            code: hideWallTextFailureDetails
              ? "CONTENT_PREPARATION_UNAVAILABLE"
              : errorCode,
            message: hideWallTextFailureDetails
              ? "We’re handling content preparation automatically. No action is needed from you."
              : getSafeJobErrorMessage(errorCode, job.errorMessage, retryable),
            retryable,
          }
        : null,
    failedAt: job.failedAt,
    id: job.id,
    jobType: getCanonicalBackgroundJobType(job.jobType),
    output: job.output,
    outputReference: job.outputReference,
    progress: job.progress,
    projectId: job.projectId,
    queuedAt: job.queuedAt,
    stage: job.stage,
    startedAt: job.startedAt,
    status: job.status,
    updatedAt: job.updatedAt,
  } satisfies PublicBackgroundJob;
}

/**
 * Wall generation includes provider and content-quality diagnostics which are
 * useful to operations only. The public job contract must never reveal them.
 */
function isWallTextJob(jobType: BackgroundJobType) {
  return jobType === "wall_text_generation" ||
    jobType === "wall_text_content_plan_generation";
}

function getSafeJobErrorMessage(
  errorCode: string | null,
  errorMessage: string | null,
  retryable: boolean,
) {
  if (
    errorCode === "PROVIDER_INSUFFICIENT_CREDITS" ||
    isProviderBalanceFailure(errorMessage)
  ) {
    return "The video provider's credit balance is too low to create this video. Contact support before starting a new generation.";
  }

  switch (errorCode) {
    case "PROVIDER_CONTENT_MODERATION":
      return "The model provider blocked this generation through content moderation. Review your prompt and reference media before starting a new generation.";
    case "provider_submission_uncertain":
      return "The provider could not confirm this request. Contact support to check its status before starting another generation to avoid a duplicate charge.";
    case "provider_operation_failed":
      return "The model provider could not complete this generation. This request cannot be resumed. Start a new generation, or contact support if it fails again.";
    case "CANCELLED":
      return "This job was cancelled.";
    case "INPUT_INVALID":
      return "The job input is no longer valid.";
    case "OUTPUT_UPLOAD_FAILED":
      return `The generated output could not be saved. ${getRetryGuidance(retryable)}`;
    case "PROVIDER_TIMEOUT":
      return `The generation provider timed out. ${getRetryGuidance(retryable)}`;
    case "QUEUE_DELIVERY_FAILED":
      return `The job could not be started. ${getRetryGuidance(retryable)}`;
    case "WORKER_STALLED":
      return `The job stopped responding. ${getRetryGuidance(retryable)}`;
    default:
      return `The job failed, but the cause could not be identified automatically. ${getRetryGuidance(retryable)}`;
  }
}

function getRetryGuidance(retryable: boolean) {
  return retryable
    ? "You can retry the job."
    : "This job cannot be retried. Contact support with this job's ID.";
}

function getPublicJobErrorCode(job: BackgroundJobRecord) {
  const code = job.errorCode || "JOB_FAILED";
  // Older video workers persisted terminal provider errors as JOB_FAILED.
  // Recognize only known signatures; never publish arbitrary stored diagnostics.
  if (
    (code === "JOB_FAILED" || code === "provider_operation_failed") &&
    (job.jobType === "generate_hook_video" || job.jobType === "video_generation")
  ) {
    if (/^Runway task failed: .*\bblocked by .*content moderation system\b/i.test(job.errorMessage ?? "")) {
      return "PROVIDER_CONTENT_MODERATION";
    }
    if (/^Runway task (?:failed:|was cancelled\.)/i.test(job.errorMessage ?? "")) {
      return "provider_operation_failed";
    }
  }
  return code;
}

function isProviderBalanceFailure(errorMessage: string | null) {
  return /credit balance is too low/i.test(errorMessage ?? "");
}
