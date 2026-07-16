import assert from "node:assert/strict";
import test from "node:test";

import {
  getSocialPublishRetryDecision,
  runPublishSocialPostJob,
} from "./publish-social-post.js";
import { encryptSocialToken } from "../lib/social-token-crypto.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type {
  BackgroundJobRow,
  SocialPublishOperationRow,
} from "../types.js";

const TARGET_ID = "7b4f9d56-5f01-42a6-a8f5-fb8704ec2c6e";
const JOB_ID = "a31a42da-1b54-42af-82b1-266ed602f265";
const CLAIM_TOKEN = "305331aa-fb6d-4b5e-aac1-3550ad649fe4";

test("persists provider initialization before completing a publish", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation());

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram(params) {
          assert.equal(params.containerId, null);
          assert.equal(params.shareToFeed, false);
          await params.onContainerCreated?.("instagram-container-1");
          fixture.calls.push("provider-published");
          return {
            mediaId: "instagram-media-1",
            permalink: "https://www.instagram.com/reel/test",
          };
        },
      },
      store: fixture.store,
    });

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "save-provider-operation",
      "provider-published",
      "operation-published",
      "target-published",
    ]);
    assert.equal(output.platformPostId, "instagram-media-1");
    assert.equal(fixture.operation.provider_operation_id, "instagram-container-1");
    assert.equal(fixture.operation.status, "published");
  });
});

test("reuses a persisted provider operation instead of initializing again", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({
        provider_operation_id: "instagram-container-existing",
        provider_operation_kind: "instagram_container",
        status: "initialized",
      }),
    );

    await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram(params) {
          assert.equal(params.containerId, "instagram-container-existing");
          assert.ok(params.onContainerCreated);
          return {
            mediaId: "instagram-media-existing",
            permalink: null,
          };
        },
      },
      store: fixture.store,
    });

    assert.equal(
      fixture.calls.includes("save-provider-operation"),
      false,
    );
    assert.equal(fixture.operation.platform_post_id, "instagram-media-existing");
  });
});

test("keeps a provider success when the target projection needs reconciliation", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      failTargetPublished: true,
    });

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram() {
          return {
            mediaId: "instagram-media-durable-success",
            permalink: "https://www.instagram.com/reel/durable-success",
          };
        },
      },
      store: fixture.store,
    });

    assert.equal(output.platformPostId, "instagram-media-durable-success");
    assert.equal(fixture.operation.status, "published");
    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "operation-published",
      "target-published",
    ]);
  });
});

test("repairs the target from a completed operation without calling the provider", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({
        active_claim_token: null,
        active_job_id: null,
        platform_post_id: "instagram-media-complete",
        platform_post_url: "https://www.instagram.com/reel/complete",
        provider_operation_id: "instagram-container-complete",
        provider_operation_kind: "instagram_container",
        status: "published",
      }),
      { denyClaim: true },
    );
    let providerCalls = 0;

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram() {
          providerCalls += 1;
          throw new Error("Provider must not be called.");
        },
      },
      store: fixture.store,
    });

    assert.equal(providerCalls, 0);
    assert.equal(output.deduplicated, true);
    assert.equal(output.platformPostId, "instagram-media-complete");
    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "get-operation",
      "target-published",
    ]);
  });
});

test("repairs a failed target when the provider operation already completed", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({
        active_claim_token: null,
        active_job_id: null,
        platform_post_id: "instagram-media-durable",
        platform_post_url: null,
        provider_operation_id: "instagram-container-durable",
        provider_operation_kind: "instagram_container",
        status: "published",
      }),
      { targetStatus: "failed" },
    );
    let providerCalls = 0;

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram() {
          providerCalls += 1;
          throw new Error("Provider must not be called.");
        },
      },
      store: fixture.store,
    });

    assert.equal(providerCalls, 0);
    assert.equal(output.platformPostId, "instagram-media-durable");
    assert.deepEqual(fixture.calls, ["get-operation", "target-published"]);
  });
});

test("skips a target when cancellation won before provider publishing", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      targetStatus: "cancelled",
    });
    let providerCalls = 0;

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram() {
          providerCalls += 1;
          throw new Error("Provider must not be called.");
        },
      },
      store: fixture.store,
    });

    assert.equal(providerCalls, 0);
    assert.equal(output.cancelled, true);
    assert.deepEqual(fixture.calls, []);
  });
});

test("skips publishing when cancellation wins between context read and operation claim", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      cancelAfterClaimDenied: true,
      denyClaim: true,
    });
    let providerCalls = 0;

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram() {
          providerCalls += 1;
          throw new Error("Provider must not be called.");
        },
      },
      store: fixture.store,
    });

    assert.equal(providerCalls, 0);
    assert.equal(output.cancelled, true);
    assert.deepEqual(fixture.calls, ["claim-operation", "get-operation"]);
  });
});

test("keeps transient provider failures retryable", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      allowFailure: true,
    });

    await assert.rejects(
      runPublishSocialPostJob(createPublishJob(), {
        publishers: {
          async instagram() {
            throw new Error("Instagram API request failed: HTTP 503.");
          },
        },
        store: fixture.store,
      }),
      (error) =>
        error instanceof RetryableJobError &&
        error.retryAfterSeconds === 30,
    );

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "release-operation",
      "target-retrying",
    ]);
  });
});

test("does not retry permanent provider errors", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      allowFailure: true,
    });

    await assert.rejects(
      runPublishSocialPostJob(createPublishJob(), {
        publishers: {
          async instagram() {
            throw new Error("Instagram API request failed: HTTP 400.");
          },
        },
        store: fixture.store,
      }),
      /HTTP 400/,
    );

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "release-operation",
      "target-failed",
    ]);
  });
});

test("stops retrying at the configured attempt limit", () => {
  assert.deepEqual(
    getSocialPublishRetryDecision({
      attemptCount: 0,
      baseDelaySeconds: 10,
      errorMessage: "YouTube API request failed: HTTP 429.",
      maxAttempts: 3,
      maxDelaySeconds: 60,
    }),
    {
      attemptNumber: 1,
      maxAttempts: 3,
      retryAfterSeconds: 10,
      shouldRetry: true,
    },
  );
  assert.equal(
    getSocialPublishRetryDecision({
      attemptCount: 2,
      baseDelaySeconds: 10,
      errorMessage: "YouTube API request failed: HTTP 503.",
      maxAttempts: 3,
      maxDelaySeconds: 60,
    }).shouldRetry,
    false,
  );
});

function createPublishStore(
  initialOperation: SocialPublishOperationRow,
  options: {
    allowFailure?: boolean;
    cancelAfterClaimDenied?: boolean;
    denyClaim?: boolean;
    failTargetPublished?: boolean;
    targetStatus?: "cancelled" | "failed" | "scheduled";
  } = {},
) {
  const calls: string[] = [];
  const operation = { ...initialOperation };
  const context = createPublishContext(options.targetStatus);
  let contextReadCount = 0;
  const store = {
    async claimSocialPublishOperation() {
      calls.push("claim-operation");

      if (options.denyClaim) {
        return null;
      }

      operation.active_claim_token = CLAIM_TOKEN;
      operation.active_job_id = JOB_ID;
      return { ...operation };
    },
    async getSocialPublishContext() {
      contextReadCount += 1;

      if (options.cancelAfterClaimDenied && contextReadCount > 1) {
        return createPublishContext("cancelled");
      }

      return context;
    },
    async getSocialPublishOperation() {
      calls.push("get-operation");
      return { ...operation };
    },
    async markSocialPublishOperationPublished(params: {
      platformPostId: string;
      platformPostUrl: string | null;
    }) {
      calls.push("operation-published");
      operation.active_claim_token = null;
      operation.active_job_id = null;
      operation.platform_post_id = params.platformPostId;
      operation.platform_post_url = params.platformPostUrl;
      operation.status = "published";
      return { ...operation };
    },
    async markSocialPublishTargetFailed() {
      if (!options.allowFailure) {
        throw new Error("Target should not fail in this test.");
      }

      calls.push("target-failed");
    },
    async markSocialPublishTargetPublished() {
      calls.push("target-published");

      if (options.failTargetPublished) {
        throw new Error("Could not update target projection: database unavailable.");
      }
    },
    async markSocialPublishTargetRetrying() {
      if (!options.allowFailure) {
        throw new Error("Target should not retry in this test.");
      }

      calls.push("target-retrying");
      return true;
    },
    async releaseSocialPublishOperation() {
      if (!options.allowFailure) {
        throw new Error("Operation should not be released in this test.");
      }

      calls.push("release-operation");
      operation.active_claim_token = null;
      operation.active_job_id = null;
      return true;
    },
    async saveSocialPublishProviderOperation(params: {
      providerOperationId: string;
      providerOperationKind: SocialPublishOperationRow["provider_operation_kind"];
    }) {
      calls.push("save-provider-operation");
      operation.provider_operation_id = params.providerOperationId;
      operation.provider_operation_kind = params.providerOperationKind;
      operation.status = "initialized";
      return { ...operation };
    },
  };

  return {
    calls,
    operation,
    store: store as unknown as SupabaseJobStore,
  };
}

function createPublishContext(
  targetStatus: "cancelled" | "failed" | "scheduled" = "scheduled",
) {
  return {
    connection: {
      access_token_ciphertext: encryptSocialToken("access-token"),
      connected_at: new Date().toISOString(),
      expires_at: null,
      id: "e3eb0ce7-4729-4454-88f4-8a07db92cb62",
      last_error_code: null,
      metadata: {},
      platform: "instagram" as const,
      platform_account_id: "instagram-account-1",
      platform_account_name: "Test Account",
      platform_account_username: "test-account",
      provider: "meta" as const,
      refresh_token_ciphertext: null,
      revoked_at: null,
      scopes: ["instagram_content_publish"],
      status: "connected" as const,
      token_type: "Bearer",
      updated_at: new Date().toISOString(),
      user_id: "user-test",
    },
    media: {
      collection: "video",
      mime_type: "video/mp4",
      source_type: "combined_render",
      status: "ready",
      url: "https://cdn.example.com/final.mp4",
    },
    post: {
      caption: "Test caption",
      status: targetStatus === "cancelled" ? "cancelled" : "scheduled",
      title: "Test title",
    },
    target: {
      platform: "instagram" as const,
      platform_post_id: null,
      platform_post_url: null,
      settings: { shareToFeed: false },
      status: targetStatus,
    },
  };
}

function createOperation(
  patch: Partial<SocialPublishOperationRow> = {},
): SocialPublishOperationRow {
  const now = new Date().toISOString();

  return {
    active_claim_token: CLAIM_TOKEN,
    active_job_id: JOB_ID,
    claimed_at: now,
    created_at: now,
    id: "619e14dc-0d27-49f0-97cf-20268893b2d3",
    idempotency_key: `social-publish:${TARGET_ID}:v1`,
    last_error_code: null,
    last_error_message: null,
    metadata: {},
    platform: "instagram",
    platform_post_id: null,
    platform_post_url: null,
    provider_operation_id: null,
    provider_operation_kind: null,
    published_at: null,
    scheduled_post_target_id: TARGET_ID,
    status: "pending",
    updated_at: now,
    user_id: "user-test",
    ...patch,
  };
}

function createPublishJob(): BackgroundJobRow {
  const now = new Date().toISOString();

  return {
    attempt_count: 0,
    aws_message_id: null,
    claim_token: CLAIM_TOKEN,
    completed_at: null,
    created_at: now,
    error_message: null,
    id: JOB_ID,
    input_json: { targetId: TARGET_ID },
    job_type: "publish_social_post",
    last_heartbeat_at: now,
    locked_at: now,
    next_attempt_at: null,
    output_json: null,
    project_id: null,
    queue_name: "social-publish",
    started_at: now,
    status: "processing",
    updated_at: now,
    user_id: "user-test",
    worker_id: "worker-test",
  };
}

async function withEncryptionKey(run: () => Promise<void>) {
  const originalKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-encryption-key";

  try {
    await run();
  } finally {
    if (originalKey === undefined) {
      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = originalKey;
    }
  }
}
