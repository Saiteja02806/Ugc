import assert from "node:assert/strict";
import test from "node:test";

import {
  dispatchScheduledSocialPublishJob,
  ScheduledSocialPublishDispatchError,
} from "./schedule-dispatch-logic.ts";

const TARGET_ID = "00000000-0000-4000-8000-000000000101";
const JOB_ID = "00000000-0000-4000-8000-000000000102";

test("enqueues and records a queued social publish job", async () => {
  const events: string[] = [];
  const result = await dispatchScheduledSocialPublishJob(
    {
      jobId: JOB_ID,
      targetId: TARGET_ID,
    },
    {
      async attachMessage(params) {
        events.push(`attach:${params.queueMessageId}`);
      },
      async getJob() {
        return job();
      },
      async sendMessage(params) {
        events.push(`send:${params.jobType}`);
        assert.equal(params.jobId, JOB_ID);
        return { messageId: "cloud-task-1" };
      },
    },
  );

  assert.deepEqual(events, ["send:publish_social_post", "attach:cloud-task-1"]);
  assert.deepEqual(result, {
    attached: true,
    delivery: "queue",
    jobStatus: "queued",
    messageId: "cloud-task-1",
  });
});

test("does not enqueue when a queue message is already attached", async () => {
  const result = await dispatchScheduledSocialPublishJob(
    {
      jobId: JOB_ID,
      targetId: TARGET_ID,
    },
    {
      async attachMessage() {
        throw new Error("should not attach");
      },
      async getJob() {
        return job({ queueMessageId: "message-existing" });
      },
      async sendMessage() {
        throw new Error("should not send");
      },
    },
  );

  assert.deepEqual(result, {
    delivery: "already_attached",
    jobStatus: "queued",
    messageId: "message-existing",
  });
});

test("does not enqueue terminal jobs", async () => {
  const result = await dispatchScheduledSocialPublishJob(
    {
      jobId: JOB_ID,
      targetId: TARGET_ID,
    },
    {
      async attachMessage() {
        throw new Error("should not attach");
      },
      async getJob() {
        return job({ status: "completed" });
      },
      async sendMessage() {
        throw new Error("should not send");
      },
    },
  );

  assert.deepEqual(result, {
    delivery: "not_required",
    jobStatus: "completed",
  });
});

test("rejects non-social jobs", async () => {
  await assert.rejects(
    () =>
      dispatchScheduledSocialPublishJob(
        {
          jobId: JOB_ID,
          targetId: TARGET_ID,
        },
        {
          async attachMessage() {
            throw new Error("should not attach");
          },
          async getJob() {
            return job({ jobType: "generate_carousel" });
          },
          async sendMessage() {
            throw new Error("should not send");
          },
        },
      ),
    (error) =>
      error instanceof ScheduledSocialPublishDispatchError &&
      error.code === "background_job_type_mismatch" &&
      error.status === 409,
  );
});

test("rejects target mismatches", async () => {
  await assert.rejects(
    () =>
      dispatchScheduledSocialPublishJob(
        {
          jobId: JOB_ID,
          targetId: "00000000-0000-4000-8000-000000000999",
        },
        {
          async attachMessage() {
            throw new Error("should not attach");
          },
          async getJob() {
            return job();
          },
          async sendMessage() {
            throw new Error("should not send");
          },
        },
      ),
    (error) =>
      error instanceof ScheduledSocialPublishDispatchError &&
      error.code === "background_job_target_mismatch" &&
      error.status === 409,
  );
});

function job(
  overrides: Partial<{
    queueMessageId: string | null;
    jobType: "generate_carousel" | "publish_social_post";
    status: "cancelled" | "completed" | "failed" | "processing" | "queued";
  }> = {},
) {
  return {
    queueMessageId: overrides.queueMessageId ?? null,
    id: JOB_ID,
    input: {
      targetId: TARGET_ID,
    },
    jobType: overrides.jobType ?? "publish_social_post",
    status: overrides.status ?? "queued",
  };
}
