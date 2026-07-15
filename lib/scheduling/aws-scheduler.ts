import "server-only";

import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";

const SCHEDULE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

let schedulerClient: SchedulerClient | null = null;

export type CreateSocialPublishScheduleInput = {
  jobId: string;
  scheduledFor: string;
  targetId: string;
};

export function getMissingSocialSchedulerEnvVars() {
  const missing: string[] = [];

  if (!process.env.AWS_REGION?.trim()) {
    missing.push("AWS_REGION");
  }

  if (!hasAppAwsCredentials()) {
    missing.push(
      "AWS_APP_ENQUEUE_ACCESS_KEY_ID/AWS_APP_ENQUEUE_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY",
    );
  }

  if (!process.env.UGC_EVENTBRIDGE_SCHEDULE_GROUP?.trim()) {
    missing.push("UGC_EVENTBRIDGE_SCHEDULE_GROUP");
  }

  if (!process.env.UGC_EVENTBRIDGE_SCHEDULER_ROLE_ARN?.trim()) {
    missing.push("UGC_EVENTBRIDGE_SCHEDULER_ROLE_ARN");
  }

  if (!getSocialPublishQueueArn()) {
    missing.push("UGC_SOCIAL_PUBLISH_QUEUE_ARN or UGC_SOCIAL_PUBLISH_QUEUE_URL");
  }

  return missing;
}

export async function createSocialPublishSchedule(
  input: CreateSocialPublishScheduleInput,
) {
  const name = getSocialPublishScheduleName(input.targetId);
  const scheduledAt = new Date(input.scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid schedule time.");
  }

  const result = await getSchedulerClient().send(
    new CreateScheduleCommand({
      ActionAfterCompletion: "DELETE",
      ClientToken: `create-${input.targetId}`,
      Description: "UGC Pilot social publish target",
      FlexibleTimeWindow: {
        Mode: "OFF",
      },
      GroupName: getScheduleGroupName(),
      Name: name,
      ScheduleExpression: `at(${toEventBridgeUtcTimestamp(scheduledAt)})`,
      ScheduleExpressionTimezone: "UTC",
      State: "ENABLED",
      Target: {
        Arn: getRequiredSocialPublishQueueArn(),
        Input: JSON.stringify({
          jobId: input.jobId,
          jobType: "publish_social_post",
        }),
        RoleArn: getSchedulerRoleArn(),
      },
    }),
  );

  return {
    arn: result.ScheduleArn ?? null,
    name,
  };
}

export async function deleteSocialPublishSchedule(scheduleName: string | null) {
  if (!scheduleName || !SCHEDULE_NAME_PATTERN.test(scheduleName)) {
    return;
  }

  try {
    await getSchedulerClient().send(
      new DeleteScheduleCommand({
        GroupName: getScheduleGroupName(),
        Name: scheduleName,
      }),
    );
  } catch (error) {
    if (isAwsResourceNotFound(error)) {
      return;
    }

    throw error;
  }
}

export function getSocialPublishScheduleName(targetId: string) {
  const safeTargetId = targetId.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 48);

  return `ugc-social-${safeTargetId}`.slice(0, 64);
}

function getSchedulerClient() {
  const region = process.env.AWS_REGION?.trim();

  if (!region) {
    throw new Error("Missing AWS_REGION.");
  }

  if (!schedulerClient) {
    schedulerClient = new SchedulerClient({
      credentials: getAppAwsCredentials(),
      region,
    });
  }

  return schedulerClient;
}

function getAppAwsCredentials() {
  const accessKeyId =
    process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    "";
  const secretAccessKey =
    process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
    "";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS app credentials for scheduling.");
  }

  return {
    accessKeyId,
    secretAccessKey,
  };
}

function hasAppAwsCredentials() {
  return Boolean(
    (process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim()) ||
      (process.env.AWS_ACCESS_KEY_ID?.trim() &&
        process.env.AWS_SECRET_ACCESS_KEY?.trim()),
  );
}

function getScheduleGroupName() {
  const value = process.env.UGC_EVENTBRIDGE_SCHEDULE_GROUP?.trim();

  if (!value) {
    throw new Error("Missing UGC_EVENTBRIDGE_SCHEDULE_GROUP.");
  }

  return value;
}

function getSchedulerRoleArn() {
  const value = process.env.UGC_EVENTBRIDGE_SCHEDULER_ROLE_ARN?.trim();

  if (!value) {
    throw new Error("Missing UGC_EVENTBRIDGE_SCHEDULER_ROLE_ARN.");
  }

  return value;
}

function getRequiredSocialPublishQueueArn() {
  const arn = getSocialPublishQueueArn();

  if (!arn) {
    throw new Error("Missing UGC_SOCIAL_PUBLISH_QUEUE_ARN.");
  }

  return arn;
}

function getSocialPublishQueueArn() {
  const explicitArn = process.env.UGC_SOCIAL_PUBLISH_QUEUE_ARN?.trim();

  if (explicitArn) {
    return explicitArn;
  }

  const queueUrl = process.env.UGC_SOCIAL_PUBLISH_QUEUE_URL?.trim();

  if (!queueUrl) {
    return "";
  }

  const match = queueUrl.match(
    /^https:\/\/sqs\.([a-z0-9-]+)\.amazonaws\.com\/(\d{12})\/([A-Za-z0-9_-]+(?:\.fifo)?)$/,
  );

  if (!match) {
    return "";
  }

  const [, region, accountId, queueName] = match;

  return `arn:aws:sqs:${region}:${accountId}:${queueName}`;
}

function toEventBridgeUtcTimestamp(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

function isAwsResourceNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    String((error as { name?: unknown }).name) === "ResourceNotFoundException"
  );
}
