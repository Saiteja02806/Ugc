import { runGenerateAvatarJob } from "./generate-avatar.js";
import { runPublishSocialPostJob } from "./publish-social-post.js";
import { runTestWorkerJob } from "./test-worker-job.js";
import { runRenderEditVideoJob } from "./render-edit-video.js";
import { runRenderScheduleCombinationJob } from "./render-schedule-combination.js";
import { runRenderTrendingCarouselEditJob } from "./render-trending-carousel-edit.js";
import { runRenderWallTextVideoJob } from "./render-wall-text-video.js";
import { runGenerateCarouselJob } from "./generate-carousel.js";
import { runGenerateHookVideoJob } from "./generate-hook-video.js";
import { runGenerateImageJob } from "./generate-image.js";
import { runGenerateTrendingHookCopyJob } from "./generate-trending-hook-copy.js";
import { runGenerateWallTextJob } from "./generate-wall-text.js";
import { runGenerateHookSuggestionsJob } from "./generate-hook-suggestions.js";
import { runAnalyticsSyncJob } from "./sync-analytics.js";
import { runMediaAnalysisJob } from "./process-media-analysis.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, BackgroundJobType, Json } from "../types.js";

const implementedWorkerJobTypes = new Set<BackgroundJobType>([
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "generate_trending_hook_copy",
  "wall_text_generation",
  "media_analysis",
  "hook_text_generation",
  "analytics_sync",
  "publish_social_post",
  "render_edit_video",
  "render_schedule_combination",
  "render_trending_carousel_edit",
  "render_wall_text_video",
  "test_worker_job",
]);

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
