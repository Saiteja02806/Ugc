import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const region = process.env.AWS_REGION?.trim() || "us-east-2";
const queueUrl = process.env.UGC_SOCIAL_PUBLISH_QUEUE_URL?.trim();
const postId = process.argv[2]?.trim() || "test-post-001";
const platform = process.argv[3]?.trim() || "instagram";

if (!queueUrl) {
  throw new Error("Missing UGC_SOCIAL_PUBLISH_QUEUE_URL.");
}

if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(postId)) {
  throw new Error("The test post id is invalid.");
}

if (!new Set(["instagram", "tiktok", "youtube"]).has(platform)) {
  throw new Error("The test platform is unsupported.");
}

const client = new SQSClient({ region });
const result = await client.send(
  new SendMessageCommand({
    MessageBody: JSON.stringify({
      action: "publish_social_post",
      platform,
      postId,
      test: true,
    }),
    QueueUrl: queueUrl,
  }),
);

if (!result.MessageId) {
  throw new Error("SQS did not return a message id.");
}

console.log(
  JSON.stringify({
    messageId: result.MessageId,
    platform,
    postId,
    sent: true,
  }),
);
