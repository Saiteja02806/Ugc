import assert from "node:assert/strict";
import test from "node:test";

import { deliverSocialPublishRetry } from "./publish-retry.ts";

test("a newly created retry sends and records exactly one queue message", async () => {
  const sentJobIds: string[] = [];
  const attachedMessages: Array<{ queueMessageId: string; jobId: string }> = [];

  const result = await deliverSocialPublishRetry(
    { jobId: "job-1", outcome: "retry_created" },
    {
      attachMessage: async (message) => {
        attachedMessages.push(message);
      },
      sendMessage: async ({ jobId }) => {
        sentJobIds.push(jobId);
        return { messageId: "message-1" };
      },
    },
  );

  assert.deepEqual(sentJobIds, ["job-1"]);
  assert.deepEqual(attachedMessages, [
    { queueMessageId: "message-1", jobId: "job-1" },
  ]);
  assert.deepEqual(result, { delivery: "queue", messageId: "message-1" });
});

test("an idempotent repeated request does not send a second queue message", async () => {
  let sendCount = 0;

  const result = await deliverSocialPublishRetry(
    { jobId: "job-1", outcome: "already_queued" },
    {
      attachMessage: async () => undefined,
      sendMessage: async () => {
        sendCount += 1;
        return { messageId: "message-2" };
      },
    },
  );

  assert.equal(sendCount, 0);
  assert.deepEqual(result, { delivery: "not_required" });
});

test("a queue outage leaves the durable retry for worker reconciliation", async () => {
  const events: string[] = [];

  const result = await deliverSocialPublishRetry(
    { jobId: "job-1", outcome: "retry_created" },
    {
      attachMessage: async () => undefined,
      reportError: (event) => events.push(event),
      sendMessage: async () => {
        throw new Error("Queue unavailable");
      },
    },
  );

  assert.deepEqual(events, ["message_send_failed"]);
  assert.deepEqual(result, { delivery: "reconciliation" });
});

test("message metadata failure does not discard a successfully sent retry", async () => {
  const events: string[] = [];

  const result = await deliverSocialPublishRetry(
    { jobId: "job-1", outcome: "retry_created" },
    {
      attachMessage: async () => {
        throw new Error("database unavailable");
      },
      reportError: (event) => events.push(event),
      sendMessage: async () => ({ messageId: "message-1" }),
    },
  );

  assert.deepEqual(events, ["message_attach_failed"]);
  assert.deepEqual(result, { delivery: "queue", messageId: "message-1" });
});
