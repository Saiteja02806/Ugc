import assert from "node:assert/strict";
import test from "node:test";

import { sendBackgroundJobMessageWithBestEffortAttachment } from "./background-job-message-delivery.ts";

test("keeps a successfully sent job live when message metadata persistence fails", async () => {
  const attachmentErrors: unknown[] = [];
  let sendCount = 0;

  const jobId = await sendBackgroundJobMessageWithBestEffortAttachment({
    async attachMessage() {
      throw new Error("database unavailable");
    },
    jobId: "job-1",
    onAttachmentError(error) {
      attachmentErrors.push(error);
    },
    async sendMessage() {
      sendCount += 1;
      return { messageId: "message-1" };
    },
  });

  assert.equal(jobId, "job-1");
  assert.equal(sendCount, 1);
  assert.equal(attachmentErrors.length, 1);
});

test("propagates a failed queue send before attempting attachment", async () => {
  let attachCount = 0;

  await assert.rejects(
    sendBackgroundJobMessageWithBestEffortAttachment({
      async attachMessage() {
        attachCount += 1;
        return { id: "job-1" };
      },
      jobId: "job-1",
      async sendMessage() {
        throw new Error("queue unavailable");
      },
    }),
    /queue unavailable/,
  );
  assert.equal(attachCount, 0);
});
