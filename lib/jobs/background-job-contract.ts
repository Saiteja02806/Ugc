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
  return (
    (job.status === "failed" || job.status === "stalled") &&
    job.attemptCount < job.maxAttempts
  );
}

export function getPublicBackgroundJob(job: BackgroundJobRecord) {
  return {
    cancelRequestedAt: job.cancelRequestedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    error:
      job.status === "failed" || job.status === "stalled"
        ? {
            code: job.errorCode || "JOB_FAILED",
            message: getSafeJobErrorMessage(job.errorCode),
            retryable: isRetryableBackgroundJob(job),
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

function getSafeJobErrorMessage(errorCode: string | null) {
  switch (errorCode) {
    case "CANCELLED":
      return "This job was cancelled.";
    case "INPUT_INVALID":
      return "The job input is no longer valid.";
    case "OUTPUT_UPLOAD_FAILED":
      return "The generated output could not be saved. You can retry the job.";
    case "PROVIDER_TIMEOUT":
      return "The generation provider timed out. You can retry the job.";
    case "QUEUE_DELIVERY_FAILED":
      return "The job could not be started. You can retry it.";
    case "WORKER_STALLED":
      return "The job stopped responding. You can retry it.";
    default:
      return "The job could not be completed. You can retry it if attempts remain.";
  }
}
