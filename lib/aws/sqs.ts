import "server-only";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import type { BackgroundJobType } from "@/lib/jobs/background-jobs";

type QueueConfig = {
  envName: string;
  queueName: string;
};

const jobQueueConfig = {
  extract_video_metadata: {
    envName: "UGC_MEDIA_PROCESSING_QUEUE_URL",
    queueName: "media-processing",
  },
  generate_avatar: {
    envName: "UGC_AI_GENERATION_QUEUE_URL",
    queueName: "ai-generation",
  },
  generate_carousel: {
    envName: "UGC_CAROUSEL_QUEUE_URL",
    queueName: "carousel",
  },
  generate_hook_video: {
    envName: "UGC_AI_GENERATION_QUEUE_URL",
    queueName: "ai-generation",
  },
  generate_image: {
    envName: "UGC_AI_GENERATION_QUEUE_URL",
    queueName: "ai-generation",
  },
  generate_thumbnail: {
    envName: "UGC_MEDIA_PROCESSING_QUEUE_URL",
    queueName: "media-processing",
  },
  publish_social_post: {
    envName: "UGC_SOCIAL_PUBLISH_QUEUE_URL",
    queueName: "social-publish",
  },
  render_demo_video: {
    envName: "UGC_VIDEO_RENDER_QUEUE_URL",
    queueName: "video-render",
  },
  render_edit_video: {
    envName: "UGC_VIDEO_RENDER_QUEUE_URL",
    queueName: "video-render",
  },
  render_schedule_combination: {
    envName: "UGC_VIDEO_RENDER_QUEUE_URL",
    queueName: "video-render",
  },
  test_worker_job: {
    envName: "UGC_MEDIA_PROCESSING_QUEUE_URL",
    queueName: "media-processing",
  },
} satisfies Record<BackgroundJobType, QueueConfig>;

let sqsClient: SQSClient | null = null;

export function getQueueNameForJobType(jobType: BackgroundJobType) {
  return jobQueueConfig[jobType].queueName;
}

export function getQueueUrlForJobType(jobType: BackgroundJobType) {
  const config = jobQueueConfig[jobType];
  const queueUrl = process.env[config.envName]?.trim();

  if (!queueUrl) {
    throw new Error(`Missing ${config.envName}`);
  }

  return queueUrl;
}

export function getMissingSqsEnvVars(jobTypes?: BackgroundJobType[]) {
  const missing = new Set<string>();

  if (!process.env.AWS_REGION?.trim()) {
    missing.add("AWS_REGION");
  }

  if (!hasAppSqsCredentials()) {
    missing.add(
      "AWS_APP_ENQUEUE_ACCESS_KEY_ID/AWS_APP_ENQUEUE_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY",
    );
  }

  for (const jobType of jobTypes ?? Object.keys(jobQueueConfig)) {
    const config = jobQueueConfig[jobType as BackgroundJobType];

    if (!process.env[config.envName]?.trim()) {
      missing.add(config.envName);
    }
  }

  return Array.from(missing);
}

export async function sendJobMessage({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: BackgroundJobType;
}) {
  const queueUrl = getQueueUrlForJobType(jobType);
  const result = await getSqsClient().send(
    new SendMessageCommand({
      MessageBody: JSON.stringify({
        jobId,
        jobType,
      }),
      QueueUrl: queueUrl,
    }),
  );

  if (!result.MessageId) {
    throw new Error("SQS did not return a message id.");
  }

  return {
    messageId: result.MessageId,
    queueName: getQueueNameForJobType(jobType),
    queueUrl,
  };
}

function getSqsClient() {
  const region = process.env.AWS_REGION?.trim();

  if (!region) {
    throw new Error("Missing AWS_REGION");
  }

  if (!sqsClient) {
    sqsClient = new SQSClient({
      credentials: getAppSqsCredentials(),
      region,
    });
  }

  return sqsClient;
}

function getAppSqsCredentials() {
  const enqueueAccessKeyId =
    process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    "";
  const enqueueSecretAccessKey =
    process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
    "";

  if (!enqueueAccessKeyId || !enqueueSecretAccessKey) {
    throw new Error(
      "Missing AWS app enqueue credentials for sending SQS messages.",
    );
  }

  return {
    accessKeyId: enqueueAccessKeyId,
    secretAccessKey: enqueueSecretAccessKey,
  };
}

function hasAppSqsCredentials() {
  const hasDedicatedCredentials = Boolean(
    process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim(),
  );
  const hasDefaultAwsCredentials = Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );

  return hasDedicatedCredentials || hasDefaultAwsCredentials;
}
