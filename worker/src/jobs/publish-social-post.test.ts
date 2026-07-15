import assert from "node:assert/strict";
import test from "node:test";

import { runPublishSocialPostJob } from "./publish-social-post.js";
import { encryptSocialToken } from "../lib/social-token-crypto.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
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
      "target-publishing",
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

function createPublishStore(
  initialOperation: SocialPublishOperationRow,
  options: {
    denyClaim?: boolean;
    targetStatus?: "failed" | "scheduled";
  } = {},
) {
  const calls: string[] = [];
  const operation = { ...initialOperation };
  const context = createPublishContext(options.targetStatus);
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
      throw new Error("Target should not fail in this test.");
    },
    async markSocialPublishTargetPublished() {
      calls.push("target-published");
    },
    async markSocialPublishTargetPublishing() {
      calls.push("target-publishing");
    },
    async releaseSocialPublishOperation() {
      throw new Error("Operation should not be released in this test.");
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
  targetStatus: "failed" | "scheduled" = "scheduled",
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
      title: "Test title",
    },
    target: {
      platform: "instagram" as const,
      platform_post_id: null,
      platform_post_url: null,
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
