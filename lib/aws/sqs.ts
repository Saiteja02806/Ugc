import "server-only";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { PubSub } from "@google-cloud/pubsub";

import { getGoogleServiceAccountCredentials } from "@/lib/gcp/credentials";
import type { BackgroundJobType } from "@/lib/jobs/background-jobs";
import {
  buildJobMessageBody,
  getAwsQueueUrlEnvNameForJobType,
  getGcpProjectId,
  getGcpPubSubTopicNameForJobType,
  getMissingQueueEnvVars,
  getQueueNameForJobType as getConfiguredQueueNameForJobType,
  getQueueProviderName as resolveQueueProviderName,
} from "@/lib/queues/config";

let sqsClient: SQSClient | null = null;
let pubSubClient: PubSub | null = null;

export function getQueueNameForJobType(jobType: BackgroundJobType) {
  return getConfiguredQueueNameForJobType(jobType);
}

export function getQueueProviderName() {
  return resolveQueueProviderName();
}

export function getQueueUrlForJobType(jobType: BackgroundJobType) {
  const envName = getAwsQueueUrlEnvNameForJobType(jobType);
  const queueUrl = process.env[envName]?.trim();

  if (!queueUrl) {
    throw new Error(`Missing ${envName}`);
  }

  return queueUrl;
}

export function getPubSubTopicForJobType(jobType: BackgroundJobType) {
  return getGcpPubSubTopicNameForJobType(jobType);
}

export function getMissingSqsEnvVars(jobTypes?: BackgroundJobType[]) {
  return getMissingQueueEnvVars(jobTypes);
}

export async function sendJobMessage({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: BackgroundJobType;
}) {
  if (resolveQueueProviderName() === "gcp") {
    return sendPubSubJobMessage({
      jobId,
      jobType,
    });
  }

  return sendSqsJobMessage({
    jobId,
    jobType,
  });
}

async function sendSqsJobMessage({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: BackgroundJobType;
}) {
  const queueUrl = getQueueUrlForJobType(jobType);
  const result = await getSqsClient().send(
    new SendMessageCommand({
      MessageBody: buildJobMessageBody({
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
    provider: "aws" as const,
    queueName: getQueueNameForJobType(jobType),
    queueUrl,
  };
}

async function sendPubSubJobMessage({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: BackgroundJobType;
}) {
  const topicName = getPubSubTopicForJobType(jobType);
  const messageId = await getPubSubClient()
    .topic(topicName)
    .publishMessage({
      attributes: {
        jobType,
        queueName: getQueueNameForJobType(jobType),
        schema: "ugc-background-job-v1",
      },
      data: Buffer.from(
        buildJobMessageBody({
          jobId,
          jobType,
        }),
        "utf8",
      ),
    });

  if (!messageId) {
    throw new Error("Pub/Sub did not return a message id.");
  }

  return {
    messageId,
    provider: "gcp" as const,
    queueName: getQueueNameForJobType(jobType),
    topicName,
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

function getPubSubClient() {
  const projectId = getGcpProjectId();

  if (!projectId) {
    throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (!pubSubClient) {
    const credentials = getGoogleServiceAccountCredentials();

    pubSubClient = new PubSub({
      ...(credentials ? { credentials } : {}),
      projectId,
    });
  }

  return pubSubClient;
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
