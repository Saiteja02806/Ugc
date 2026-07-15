import { runGenerateAvatarJob } from "./generate-avatar.js";
import { runPublishSocialPostJob } from "./publish-social-post.js";
import { runTestWorkerJob } from "./test-worker-job.js";
import { runRenderEditVideoJob } from "./render-edit-video.js";
import { runRenderScheduleCombinationJob } from "./render-schedule-combination.js";
import { runGenerateCarouselJob } from "./generate-carousel.js";
import { runGenerateHookVideoJob } from "./generate-hook-video.js";
import { runGenerateImageJob } from "./generate-image.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, BackgroundJobType, Json } from "../types.js";

const implementedWorkerJobTypes = new Set<BackgroundJobType>([
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "publish_social_post",
  "render_edit_video",
  "render_schedule_combination",
  "test_worker_job",
]);

export async function runWorkerJob(
  job: BackgroundJobRow,
  context: {
    store: SupabaseJobStore;
  },
) {
  if (job.job_type === "generate_avatar") {
    return runGenerateAvatarJob(job);
  }

  if (job.job_type === "render_edit_video") {
    return runRenderEditVideoJob(job, context);
  }

  if (job.job_type === "render_schedule_combination") {
    return runRenderScheduleCombinationJob(job, context);
  }

  if (job.job_type === "generate_carousel") {
    return runGenerateCarouselJob(job, context);
  }

  if (job.job_type === "generate_hook_video") {
    return runGenerateHookVideoJob(job);
  }

  if (job.job_type === "generate_image") {
    return runGenerateImageJob(job);
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
