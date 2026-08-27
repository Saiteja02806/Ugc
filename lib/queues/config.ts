import type { BackgroundJobType } from "@/lib/jobs/background-jobs";
import { getMissingVercelGcpCredentialEnvVars } from "../gcp/credentials.ts";

export type QueueProviderName = "gcp";

type QueueConfig = {
  queueName: string;
};

const jobQueueConfig = {
  analytics_sync: {
    queueName: "ai-generation",
  },
  carousel_content_plan_generation: {
    queueName: "ai-generation",
  },
  carousel_generation: {
    queueName: "carousel",
  },
  final_render: {
    queueName: "video-render",
  },
  generate_avatar: {
    queueName: "ai-generation",
  },
  generate_carousel: {
    queueName: "carousel",
  },
  generate_hook_video: {
    queueName: "ai-generation",
  },
  generate_image: {
    queueName: "ai-generation",
  },
  generate_thumbnail: {
    queueName: "media-processing",
  },
  generate_trending_hook_copy: {
    queueName: "ai-generation",
  },
  extract_video_metadata: {
    queueName: "media-processing",
  },
  hook_text_generation: {
    queueName: "ai-generation",
  },
  image_generation: {
    queueName: "ai-generation",
  },
  media_analysis: {
    queueName: "ai-generation",
  },
  paid_trending_prebuild: {
    queueName: "ai-generation",
  },
  preview_render: {
    queueName: "video-render",
  },
  publish_social_post: {
    queueName: "social-publish",
  },
  render_demo_video: {
    queueName: "video-render",
  },
  render_edit_video: {
    queueName: "video-render",
  },
  render_schedule_combination: {
    queueName: "video-render",
  },
  render_trending_carousel_edit: {
    queueName: "carousel",
  },
  render_wall_text_video: {
    queueName: "video-render",
  },
  social_publish: {
    queueName: "social-publish",
  },
  test_worker_job: {
    queueName: "media-processing",
  },
  video_generation: {
    queueName: "ai-generation",
  },
  wall_text_generation: {
    queueName: "ai-generation",
  },
  wall_text_content_plan_generation: {
    queueName: "ai-generation",
  },
} satisfies Record<BackgroundJobType, QueueConfig>;

export function getQueueProviderName(
  _env: Record<string, string | undefined> = process.env,
): QueueProviderName {
  void _env;
  return "gcp";
}

export function getQueueNameForJobType(jobType: BackgroundJobType) {
  return getQueueConfig(jobType).queueName;
}

export function getGcpProjectId(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.GCP_PROJECT_ID?.trim() ||
    env.GOOGLE_CLOUD_PROJECT?.trim() ||
    env.GCLOUD_PROJECT?.trim() ||
    ""
  );
}

export function getMissingQueueEnvVars(
  _jobTypes?: BackgroundJobType[],
  env: Record<string, string | undefined> = process.env,
) {
  return getMissingGcpQueueEnvVars(env);
}

export function buildJobMessageBody(params: {
  attempt?: number;
  jobId: string;
  jobType: BackgroundJobType;
}) {
  return JSON.stringify({
    attempt: params.attempt ?? 0,
    jobId: params.jobId,
    jobType: params.jobType,
    schemaVersion: 1,
  });
}

function getQueueConfig(jobType: BackgroundJobType) {
  return jobQueueConfig[jobType];
}

function getMissingGcpQueueEnvVars(
  env: Record<string, string | undefined> = process.env,
) {
  const missing = new Set<string>();

  if (!getGcpProjectId(env)) {
    missing.add("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  for (const envName of getMissingVercelGcpCredentialEnvVars(env)) {
    missing.add(envName);
  }

  return Array.from(missing);
}
