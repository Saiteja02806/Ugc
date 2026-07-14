import assert from "node:assert/strict";
import test from "node:test";

import { handler } from "./index.mjs";

test("accepts a valid test-mode social publish message", async () => {
  const result = await runHandler([
    createRecord("message-1", {
      action: "publish_social_post",
      platform: "instagram",
      postId: "test-post-001",
      test: true,
    }),
  ]);

  assert.deepEqual(result, { batchItemFailures: [] });
});

test("accepts a scheduler target message without retrying", async () => {
  const database = createMockScheduleDatabase();
  const result = await runHandler([
    createRecord("message-scheduled", {
      targetId: "7b4f9d56-5f01-42a6-a8f5-fb8704ec2c6e",
      version: 1,
    }),
  ], { database });

  assert.deepEqual(result, { batchItemFailures: [] });
  assert.deepEqual(database.operations.map((operation) => operation.type), [
    "getTarget",
    "markTargetPublishing",
    "insertAttempt",
    "markTargetFailed",
    "insertAttempt",
    "listTargetsForPost",
    "markPostStatus",
  ]);
  assert.equal(
    database.operations.find((operation) => operation.type === "markTargetFailed")
      ?.input.errorCode,
    "publishing_unavailable",
  );
  assert.equal(
    database.operations.find((operation) => operation.type === "markPostStatus")
      ?.input.status,
    "failed",
  );
});

test("returns a partial batch failure for invalid JSON", async () => {
  const result = await runHandler([
    { body: "not-json", messageId: "message-invalid-json" },
  ]);

  assert.deepEqual(result, {
    batchItemFailures: [{ itemIdentifier: "message-invalid-json" }],
  });
});

test("rejects a message without a post id", async () => {
  const result = await runHandler([
    createRecord("message-no-post", {
      action: "publish_social_post",
      platform: "instagram",
      test: true,
    }),
  ]);

  assert.deepEqual(result, {
    batchItemFailures: [{ itemIdentifier: "message-no-post" }],
  });
});

test("rejects an unsupported platform", async () => {
  const result = await runHandler([
    createRecord("message-bad-platform", {
      action: "publish_social_post",
      platform: "facebook",
      postId: "test-post-001",
      test: true,
    }),
  ]);

  assert.deepEqual(result, {
    batchItemFailures: [{ itemIdentifier: "message-bad-platform" }],
  });
});

test("rejects a scheduler target message without a valid target id", async () => {
  const result = await runHandler([
    createRecord("message-bad-target", {
      targetId: "not-a-target-id",
      version: 1,
    }),
  ]);

  assert.deepEqual(result, {
    batchItemFailures: [{ itemIdentifier: "message-bad-target" }],
  });
});

test("returns only failed records in a mixed batch", async () => {
  const result = await runHandler([
    createRecord("message-ok", {
      action: "publish_social_post",
      platform: "instagram",
      postId: "test-post-001",
      test: true,
    }),
    createRecord("message-failed", {
      action: "publish_social_post",
      platform: "unsupported",
      postId: "test-post-002",
      test: true,
    }),
  ]);

  assert.deepEqual(result, {
    batchItemFailures: [{ itemIdentifier: "message-failed" }],
  });
});

test("blocks real publishing until the production handler is implemented", async () => {
  const result = await runHandler([
    createRecord("message-real", {
      action: "publish_social_post",
      platform: "instagram",
      postId: "real-post-001",
      test: false,
    }),
  ]);

  assert.deepEqual(result, {
    batchItemFailures: [{ itemIdentifier: "message-real" }],
  });
});

test("duplicate test messages remain harmless", async () => {
  const payload = {
    action: "publish_social_post",
    platform: "instagram",
    postId: "duplicate-test-post",
    test: true,
  };
  const result = await runHandler([
    createRecord("message-duplicate-1", payload),
    createRecord("message-duplicate-2", payload),
  ]);

  assert.deepEqual(result, { batchItemFailures: [] });
});

function createRecord(messageId, payload) {
  return {
    body: JSON.stringify(payload),
    messageId,
  };
}

async function runHandler(records, options) {
  const originalInfo = console.info;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.info = () => {};
  console.error = () => {};
  console.warn = () => {};

  try {
    return await handler({ Records: records }, options);
  } finally {
    console.info = originalInfo;
    console.error = originalError;
    console.warn = originalWarn;
  }
}

function createMockScheduleDatabase() {
  const target = {
    attempt_count: 0,
    id: "7b4f9d56-5f01-42a6-a8f5-fb8704ec2c6e",
    platform: "instagram",
    scheduled_post_id: "a31a42da-1b54-42af-82b1-266ed602f265",
    status: "scheduled",
    user_id: "user_test_123",
  };
  const operations = [];

  return {
    operations,
    async getTarget(targetId) {
      operations.push({ targetId, type: "getTarget" });
      return targetId === target.id ? target : null;
    },
    async insertAttempt(input) {
      operations.push({ input, type: "insertAttempt" });
    },
    async listTargetsForPost(postId) {
      operations.push({ postId, type: "listTargetsForPost" });
      return [{ id: target.id, status: "failed" }];
    },
    async markPostStatus(input) {
      operations.push({ input, type: "markPostStatus" });
    },
    async markTargetFailed(input) {
      operations.push({ input, type: "markTargetFailed" });
      target.status = "failed";
    },
    async markTargetPublishing(input) {
      operations.push({ input, type: "markTargetPublishing" });
      target.attempt_count = input.attemptNumber;
      target.status = "publishing";
    },
  };
}
