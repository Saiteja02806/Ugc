import type { BackgroundJobType } from "@/lib/jobs/background-jobs";
import { getMissingVercelGcpCredentialEnvVars } from "../gcp/credentials.ts";

export type QueueProviderName = "aws" | "gcp";

type QueueConfig = {
  awsQueueUrlEnvName: string;
  gcpTopicEnvName: string;
  gcpTopicName: string;
  queueName: string;
};

const jobQueueConfig = {
  extract_video_metadata: {
    awsQueueUrlEnvName: "UGC_MEDIA_PROCESSING_QUEUE_URL",
    gcpTopicEnvName: "UGC_MEDIA_PROCESSING_PUBSUB_TOPIC",
    gcpTopicName: "ugc-media-processing",
    queueName: "media-processing",
  },
  generate_avatar: {
    awsQueueUrlEnvName: "UGC_AI_GENERATION_QUEUE_URL",
    gcpTopicEnvName: "UGC_AI_GENERATION_PUBSUB_TOPIC",
    gcpTopicName: "ugc-ai-generation",
    queueName: "ai-generation",
  },
  generate_carousel: {
    awsQueueUrlEnvName: "UGC_CAROUSEL_QUEUE_URL",
    gcpTopicEnvName: "UGC_CAROUSEL_PUBSUB_TOPIC",
    gcpTopicName: "ugc-carousel",
    queueName: "carousel",
  },
  generate_hook_video: {
    awsQueueUrlEnvName: "UGC_AI_GENERATION_QUEUE_URL",
    gcpTopicEnvName: "UGC_AI_GENERATION_PUBSUB_TOPIC",
    gcpTopicName: "ugc-ai-generation",
    queueName: "ai-generation",
  },
  generate_image: {
    awsQueueUrlEnvName: "UGC_AI_GENERATION_QUEUE_URL",
    gcpTopicEnvName: "UGC_AI_GENERATION_PUBSUB_TOPIC",
    gcpTopicName: "ugc-ai-generation",
    queueName: "ai-generation",
  },
  generate_thumbnail: {
    awsQueueUrlEnvName: "UGC_MEDIA_PROCESSING_QUEUE_URL",
    gcpTopicEnvName: "UGC_MEDIA_PROCESSING_PUBSUB_TOPIC",
    gcpTopicName: "ugc-media-processing",
    queueName: "media-processing",
  },
  publish_social_post: {
    awsQueueUrlEnvName: "UGC_SOCIAL_PUBLISH_QUEUE_URL",
    gcpTopicEnvName: "UGC_SOCIAL_PUBLISH_PUBSUB_TOPIC",
    gcpTopicName: "ugc-social-publish",
    queueName: "social-publish",
  },
  render_demo_video: {
    awsQueueUrlEnvName: "UGC_VIDEO_RENDER_QUEUE_URL",
    gcpTopicEnvName: "UGC_VIDEO_RENDER_PUBSUB_TOPIC",
    gcpTopicName: "ugc-video-render",
    queueName: "video-render",
  },
  render_edit_video: {
    awsQueueUrlEnvName: "UGC_VIDEO_RENDER_QUEUE_URL",
    gcpTopicEnvName: "UGC_VIDEO_RENDER_PUBSUB_TOPIC",
    gcpTopicName: "ugc-video-render",
    queueName: "video-render",
  },
  render_schedule_combination: {
    awsQueueUrlEnvName: "UGC_VIDEO_RENDER_QUEUE_URL",
    gcpTopicEnvName: "UGC_VIDEO_RENDER_PUBSUB_TOPIC",
    gcpTopicName: "ugc-video-render",
    queueName: "video-render",
  },
  test_worker_job: {
    awsQueueUrlEnvName: "UGC_MEDIA_PROCESSING_QUEUE_URL",
    gcpTopicEnvName: "UGC_MEDIA_PROCESSING_PUBSUB_TOPIC",
    gcpTopicName: "ugc-media-processing",
    queueName: "media-processing",
  },
} satisfies Record<BackgroundJobType, QueueConfig>;

export function getQueueProviderName(
  env: Record<string, string | undefined> = process.env,
): QueueProviderName {
  const rawValue =
    env.QUEUE_PROVIDER?.trim() ||
    env.UGC_QUEUE_PROVIDER?.trim() ||
    "aws";
  const normalizedValue = rawValue.toLowerCase();

  if (normalizedValue === "aws" || normalizedValue === "sqs") {
    return "aws";
  }

  if (
    normalizedValue === "gcp" ||
    normalizedValue === "google" ||
    normalizedValue === "pubsub"
  ) {
    return "gcp";
  }

  throw new Error(
    `Invalid QUEUE_PROVIDER: ${rawValue}. Expected aws or gcp.`,
  );
}

export function getQueueNameForJobType(jobType: BackgroundJobType) {
  return getQueueConfig(jobType).queueName;
}

export function getAwsQueueUrlEnvNameForJobType(jobType: BackgroundJobType) {
  return getQueueConfig(jobType).awsQueueUrlEnvName;
}

export function getGcpPubSubTopicEnvNameForJobType(
  jobType: BackgroundJobType,
) {
  return getQueueConfig(jobType).gcpTopicEnvName;
}

export function getGcpPubSubTopicNameForJobType(
  jobType: BackgroundJobType,
  env: Record<string, string | undefined> = process.env,
) {
  const config = getQueueConfig(jobType);

  return env[config.gcpTopicEnvName]?.trim() || config.gcpTopicName;
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
  jobTypes?: BackgroundJobType[],
  env: Record<string, string | undefined> = process.env,
) {
  return getQueueProviderName(env) === "gcp"
    ? getMissingGcpQueueEnvVars(env)
    : getMissingAwsQueueEnvVars(jobTypes, env);
}

export function buildJobMessageBody(params: {
  jobId: string;
  jobType: BackgroundJobType;
}) {
  return JSON.stringify({
    jobId: params.jobId,
    jobType: params.jobType,
  });
}

function getQueueConfig(jobType: BackgroundJobType) {
  return jobQueueConfig[jobType];
}

function getMissingAwsQueueEnvVars(
  jobTypes?: BackgroundJobType[],
  env: Record<string, string | undefined> = process.env,
) {
  const missing = new Set<string>();

  if (!env.AWS_REGION?.trim()) {
    missing.add("AWS_REGION");
  }

  if (!hasAppSqsCredentials(env)) {
    missing.add(
      "AWS_APP_ENQUEUE_ACCESS_KEY_ID/AWS_APP_ENQUEUE_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY",
    );
  }

  for (const jobType of jobTypes ?? Object.keys(jobQueueConfig)) {
    const envName = getAwsQueueUrlEnvNameForJobType(
      jobType as BackgroundJobType,
    );

    if (!env[envName]?.trim()) {
      missing.add(envName);
    }
  }

  return Array.from(missing);
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

function hasAppSqsCredentials(env: Record<string, string | undefined>) {
  const hasDedicatedCredentials = Boolean(
    env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() &&
      env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim(),
  );
  const hasDefaultAwsCredentials = Boolean(
    env.AWS_ACCESS_KEY_ID?.trim() && env.AWS_SECRET_ACCESS_KEY?.trim(),
  );

  return hasDedicatedCredentials || hasDefaultAwsCredentials;
}
