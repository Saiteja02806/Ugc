import { runGenerateAvatarJob } from "./generate-avatar.js";
import { runPublishSocialPostJob } from "./publish-social-post.js";
import { runTestWorkerJob } from "./test-worker-job.js";
import { runRenderEditVideoJob } from "./render-edit-video.js";
import { runRenderScheduleCombinationJob } from "./render-schedule-combination.js";
import { runRenderTrendingCarouselEditJob } from "./render-trending-carousel-edit.js";
import { runRenderWallTextVideoJob } from "./render-wall-text-video.js";
import { runGenerateCarouselJob } from "./generate-carousel.js";
import { runGenerateCarouselContentPlanJob } from "./generate-carousel-content-plan.js";
import { runGenerateWallTextContentPlanJob } from "./generate-wall-text-content-plan.js";
import { runGenerateHookVideoJob } from "./generate-hook-video.js";
import { runGenerateImageJob } from "./generate-image.js";
import { runGenerateTrendingHookCopyJob } from "./generate-trending-hook-copy.js";
import { runGenerateWallTextJob } from "./generate-wall-text.js";
import { runGenerateHookSuggestionsJob } from "./generate-hook-suggestions.js";
import { runAnalyticsSyncJob } from "./sync-analytics.js";
import { runMediaAnalysisJob } from "./process-media-analysis.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  EXECUTABLE_BACKGROUND_JOB_TYPES,
  type BackgroundJobRow,
  type BackgroundJobType,
  type Json,
} from "../types.js";

const implementedWorkerJobTypes = new Set<BackgroundJobType>(
  EXECUTABLE_BACKGROUND_JOB_TYPES,
);

export async function runWorkerJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  if (job.job_type === "generate_avatar") {
    return runGenerateAvatarJob(job, context);
  }

  if (job.job_type === "render_edit_video") {
    return runRenderEditVideoJob(job, context);
  }

  if (job.job_type === "render_schedule_combination") {
    return runRenderScheduleCombinationJob(job, context);
  }

  if (job.job_type === "render_trending_carousel_edit") {
    return runRenderTrendingCarouselEditJob(job, context);
  }

  if (job.job_type === "render_wall_text_video") {
    return runRenderWallTextVideoJob(job, context);
  }

  if (job.job_type === "generate_carousel") {
    return runGenerateCarouselJob(job, context);
  }

  if (job.job_type === "carousel_content_plan_generation") {
    return runGenerateCarouselContentPlanJob(job, context);
  }

  if (job.job_type === "wall_text_content_plan_generation") {
    return runGenerateWallTextContentPlanJob(job, context);
  }

  if (job.job_type === "generate_hook_video") {
    return runGenerateHookVideoJob(job, context);
  }

  if (job.job_type === "generate_image") {
    return runGenerateImageJob(job, context);
  }

  if (job.job_type === "generate_trending_hook_copy") {
    return runGenerateTrendingHookCopyJob(job, context);
  }

  if (job.job_type === "wall_text_generation") {
    return runGenerateWallTextJob(job, context);
  }

  if (job.job_type === "media_analysis") {
    return runMediaAnalysisJob(job, context);
  }

  if (job.job_type === "hook_text_generation") {
    return runGenerateHookSuggestionsJob(job, context);
  }

  if (job.job_type === "analytics_sync") {
    return runAnalyticsSyncJob(job, context);
  }

  if (job.job_type === "publish_social_post") {
    return runPublishSocialPostJob(job, context);
  }

  if (job.job_type === "test_worker_job") {
    return runTestWorkerJob(job);
  }

  throw new Error(`No worker handler exists for job type ${job.job_type}.`);
}

export function hasWorkerJobHandler(jobType: BackgroundJobType) {
  return implementedWorkerJobTypes.has(jobType);
}

export type WorkerJobOutput = Record<string, Json | undefined>;

export type WorkerJobContext = {
  checkpoint: (params: {
    progress?: number | null;
    stage: string;
    status:
      | "processing"
      | "rendering"
      | "uploading_output"
      | "waiting_external_service";
  }) => Promise<void>;
  store: SupabaseJobStore;
};
