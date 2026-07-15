import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const region = process.env.AWS_REGION?.trim() || "us-east-2";
const queueUrl = process.env.UGC_SOCIAL_PUBLISH_QUEUE_URL?.trim();
const jobId = process.argv[2]?.trim();

if (!queueUrl) {
  throw new Error("Missing UGC_SOCIAL_PUBLISH_QUEUE_URL.");
}

if (!jobId) {
  throw new Error("Usage: node scripts/test-social-publish-queue.mjs <background-job-id>");
}

const client = new SQSClient({ region });
const result = await client.send(
  new SendMessageCommand({
    MessageBody: JSON.stringify({
      jobId,
      jobType: "publish_social_post",
    }),
    QueueUrl: queueUrl,
  }),
);

if (!result.MessageId) {
  throw new Error("SQS did not return a message id.");
}

console.log(
  JSON.stringify({
    jobId,
    jobType: "publish_social_post",
    messageId: result.MessageId,
    sent: true,
  }),
);
