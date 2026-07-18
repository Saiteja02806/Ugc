import assert from "node:assert/strict";
import test from "node:test";

import {
  getSocialPublishRetryDecision,
  isTransientSocialPublishError,
  runPublishSocialPostJob,
} from "./publish-social-post.js";
import { encryptSocialToken } from "../lib/social-token-crypto.js";
import { InstagramOAuthError } from "../lib/instagram-oauth.js";
import { InstagramPublishError } from "../lib/instagram-publisher.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import { TikTokPublishError } from "../lib/tiktok-publisher.js";
import { YouTubePublishError } from "../lib/youtube-publisher.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type {
  BackgroundJobRow,
  Json,
  SocialPublishOperationRow,
} from "../types.js";

const TARGET_ID = "7b4f9d56-5f01-42a6-a8f5-fb8704ec2c6e";
const JOB_ID = "a31a42da-1b54-42af-82b1-266ed602f265";
const CLAIM_TOKEN = "305331aa-fb6d-4b5e-aac1-3550ad649fe4";
type PublishMediaSourceType =
  | "combined_render"
  | "demo_upload"
  | "edit_export"
  | "generated_video"
  | "upload";

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

test("publishes a direct scheduled video asset", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      mediaSourceType: "demo_upload",
    });

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async instagram(params) {
          assert.equal(params.videoUrl, "https://cdn.example.com/final.mp4");
          return {
            mediaId: "instagram-media-direct-video",
            permalink: "https://www.instagram.com/reel/direct-video",
          };
        },
      },
      store: fixture.store,
    });

    assert.equal(output.platformPostId, "instagram-media-direct-video");
    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "operation-published",
      "target-published",
    ]);
  });
});

test("publishes saved carousel slides in their stored order", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), { carousel: true });

    const output = await runPublishSocialPostJob(createPublishJob(), {
      prepareInstagramCarouselImages: async ({ imageUrls }) =>
        imageUrls.map((url) => url.replace(/\.webp$/, ".jpg")),
      publishers: {
        async instagramCarousel(params) {
          assert.deepEqual(params.imageUrls, [
            "https://cdn.example.com/slide-1.jpg",
            "https://cdn.example.com/slide-2.jpg",
          ]);
          await params.onContainerCreated?.("instagram-carousel-1");
          return {
            mediaId: "instagram-carousel-media-1",
            permalink: "https://www.instagram.com/p/carousel-1",
          };
        },
      },
      store: fixture.store,
    });

    assert.equal(output.platformPostId, "instagram-carousel-media-1");
    assert.equal(fixture.operation.provider_operation_id, "instagram-carousel-1");
  });
});

test("publishes saved carousel slides to TikTok without requiring video media", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({ platform: "tiktok" }),
      {
        carousel: true,
        platform: "tiktok",
      },
    );

    const output = await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async tiktokCarousel(params) {
          assert.deepEqual(params.imageUrls, [
            "https://cdn.example.com/slide-1.webp",
            "https://cdn.example.com/slide-2.webp",
          ]);
          await params.onPublishInitialized?.({
            creatorNickname: "Test creator",
            creatorUsername: "test_creator",
            logId: "tiktok-log-1",
            publishId: "tiktok-photo-publish-1",
          });
          return {
            platformPostId: "tiktok-photo-post-1",
            platformPostUrl: null,
            publishId: "tiktok-photo-publish-1",
          };
        },
      },
      store: fixture.store,
    });

    assert.equal(output.platformPostId, "tiktok-photo-post-1");
    assert.equal(fixture.operation.provider_operation_id, "tiktok-photo-publish-1");
    assert.equal(fixture.operation.provider_operation_kind, "tiktok_publish");
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

test("marks TikTok permission failures as action required", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({ platform: "tiktok" }),
      { allowFailure: true, platform: "tiktok" },
    );

    await assert.rejects(
      runPublishSocialPostJob(createPublishJob(), {
        publishers: {
          async tiktok() {
            throw new TikTokPublishError(
              "TikTok API request failed: missing publishing permission.",
              "scope_not_authorized",
              "log-permission-1",
              403,
              true,
            );
          },
        },
        store: fixture.store,
      }),
      (error) =>
        error instanceof TikTokPublishError &&
        error.code === "scope_not_authorized",
    );

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "release-operation",
      "target-action-required",
    ]);
    const providerError = getJsonRecord(
      fixture.targetMetadata.providerError,
    );

    assert.equal(providerError.code, "scope_not_authorized");
    assert.equal(providerError.logId, "log-permission-1");
    assert.equal(
      providerError.message,
      "TikTok API request failed: missing publishing permission.",
    );
    assert.equal(typeof providerError.occurredAt, "string");
    assert.equal(providerError.status, 403);
  });
});

test("marks expired Instagram authorization as action required with a safe message", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      allowFailure: true,
      withInstagramRefresh: true,
    });
    const providerMessage = "The access token has expired: raw token diagnostic.";

    await withMockFetch(async () =>
      Response.json(
        {
          error: {
            code: 190,
            message: providerMessage,
            type: "OAuthException",
          },
        },
        { status: 400 },
      ), async () => {
      await assert.rejects(
        runPublishSocialPostJob(createPublishJob(), {
          publishers: {
            async instagram() {
              throw new InstagramPublishError({
                actionRequired: true,
                code: "access_token_invalid",
                message:
                  "Instagram API request failed: HTTP 400 - code 190.",
                providerCode: 190,
                retryable: false,
                status: 400,
                userMessage: "Reconnect Instagram to continue publishing.",
              });
            },
          },
          store: fixture.store,
        }),
        (error) =>
          error instanceof InstagramOAuthError &&
          error.code === "access_token_invalid",
      );
    });

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "claim-token-refresh",
      "release-token-refresh",
      "release-operation",
      "target-action-required",
    ]);
    assert.equal(fixture.targetErrorCode, "instagram_access_token_invalid");
    assert.equal(
      fixture.targetErrorMessage,
      "Reconnect Instagram to continue publishing.",
    );
    assert.doesNotMatch(fixture.targetErrorMessage, /raw token diagnostic/i);
    assert.equal(
      getJsonRecord(fixture.targetMetadata.providerError).message,
      `Instagram token refresh failed: HTTP 400 - type OAuthException - code 190 - ${providerMessage}`,
    );
  });
});

test("retries YouTube rate limits using the provider delay and a safe message", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({ platform: "youtube" }),
      { allowFailure: true, platform: "youtube" },
    );

    await assert.rejects(
      runPublishSocialPostJob(createPublishJob(), {
        publishers: {
          async youtube() {
            throw new YouTubePublishError({
              actionRequired: false,
              code: "rate_limited",
              message:
                "YouTube API request failed: HTTP 429 - reason userRateLimitExceeded.",
              providerCode: 429,
              reasons: ["userRateLimitExceeded"],
              retryable: true,
              retryAfterSeconds: 120,
              status: 429,
              userMessage:
                "YouTube is temporarily limiting uploads. We will retry automatically.",
            });
          },
        },
        store: fixture.store,
      }),
      (error) =>
        error instanceof RetryableJobError &&
        error.retryAfterSeconds === 120 &&
        error.message ===
          "YouTube is temporarily limiting uploads. We will retry automatically.",
    );

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "release-operation",
      "target-retrying",
    ]);
    assert.equal(fixture.targetErrorCode, "youtube_rate_limited");
    assert.equal(
      fixture.targetErrorMessage,
      "YouTube is temporarily limiting uploads. We will retry automatically.",
    );
  });
});

test("fails a permanent YouTube rejection without exposing provider details", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({ platform: "youtube" }),
      { allowFailure: true, platform: "youtube" },
    );

    await assert.rejects(
      runPublishSocialPostJob(createPublishJob(), {
        publishers: {
          async youtube() {
            throw new YouTubePublishError({
              actionRequired: false,
              code: "invalid_video",
              message:
                "YouTube API request failed: snippet.title invalid at byte 7.",
              providerCode: 400,
              reasons: ["invalidValue"],
              retryable: false,
              status: 400,
              userMessage:
                "YouTube could not accept this video or its details. Review the post and try again.",
            });
          },
        },
        store: fixture.store,
      }),
      (error) => error instanceof YouTubePublishError,
    );

    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "release-operation",
      "target-failed",
    ]);
    assert.equal(fixture.targetErrorCode, "youtube_invalid_video");
    assert.doesNotMatch(fixture.targetErrorMessage, /byte 7/i);
  });
});

test("persists the TikTok upload session before provider completion", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(
      createOperation({ platform: "tiktok" }),
      { platform: "tiktok" },
    );

    await runPublishSocialPostJob(createPublishJob(), {
      publishers: {
        async tiktok(params) {
          assert.equal(params.publishId, null);
          assert.equal(params.uploadUrl, null);
          await params.onPublishInitialized?.({
            creatorNickname: "Creator",
            creatorUsername: "creator_name",
            logId: "log-init-1",
            mediaTransferMode: "FILE_UPLOAD",
            publishId: "publish-session-1",
            uploadUrl: "https://upload.example.com/session-token",
          });
          return {
            platformPostId: "tiktok-post-1",
            platformPostUrl: null,
            publishId: "publish-session-1",
          };
        },
      },
      store: fixture.store,
    });

    assert.equal(fixture.operation.provider_operation_id, "publish-session-1");
    assert.deepEqual(fixture.operation.metadata, {
      tiktokCreatorNickname: "Creator",
      tiktokCreatorUsername: "creator_name",
      tiktokInitializationLogId: "log-init-1",
      tiktokMediaTransferMode: "FILE_UPLOAD",
      tiktokUploadUrl: "https://upload.example.com/session-token",
    });
  });
});

test("refreshes an invalid TikTok token once and retries the same operation", async () => {
  await withEncryptionKey(async () => {
    await withTikTokEnvironment(async () => {
      const fixture = createPublishStore(
        createOperation({ platform: "tiktok" }),
        { platform: "tiktok", withTikTokRefresh: true },
      );
      const seenTokens: string[] = [];

      await withMockFetch(async (_input, init) => {
        const body = new URLSearchParams(String(init?.body));
        assert.equal(body.get("refresh_token"), "refresh-token");

        return Response.json({
          access_token: "access-token-refreshed",
          expires_in: 86_400,
          open_id: "tiktok-account-1",
          refresh_expires_in: 31_536_000,
          refresh_token: "refresh-token-rotated",
          scope: "user.info.basic,video.publish",
          token_type: "Bearer",
        });
      }, async () => {
        await runPublishSocialPostJob(createPublishJob(), {
          publishers: {
            async tiktok(params) {
              seenTokens.push(params.accessToken);

              if (seenTokens.length === 1) {
                throw new TikTokPublishError(
                  "TikTok API request failed: invalid access token.",
                  "access_token_invalid",
                  "log-token-1",
                  401,
                  true,
                );
              }

              assert.equal(params.publishId, null);
              return {
                platformPostId: "tiktok-post-refreshed",
                platformPostUrl: null,
                publishId: "publish-refreshed",
              };
            },
          },
          store: fixture.store,
        });
      });

      assert.deepEqual(seenTokens, [
        "access-token",
        "access-token-refreshed",
      ]);
      assert.deepEqual(fixture.calls, [
        "claim-operation",
        "claim-token-refresh",
        "complete-token-refresh",
        "operation-published",
        "target-published",
      ]);
    });
  });
});

test("renews an invalid Instagram token once and retries the same container", async () => {
  await withEncryptionKey(async () => {
    const fixture = createPublishStore(createOperation(), {
      withInstagramRefresh: true,
    });
    const seenTokens: string[] = [];

    await withMockFetch(async (input) => {
      const url = new URL(String(input));

      assert.equal(url.pathname, "/refresh_access_token");
      assert.equal(url.searchParams.get("access_token"), "access-token");

      return Response.json({
        access_token: "instagram-access-token-renewed",
        expires_in: 5_184_000,
        token_type: "bearer",
      });
    }, async () => {
      await runPublishSocialPostJob(createPublishJob(), {
        publishers: {
          async instagram(params) {
            seenTokens.push(params.accessToken);

            if (seenTokens.length === 1) {
              throw new InstagramPublishError({
                actionRequired: true,
                code: "access_token_invalid",
                message: "Instagram API request failed: access token invalid.",
                providerCode: 190,
                retryable: false,
                status: 400,
                userMessage: "Reconnect Instagram to continue publishing.",
              });
            }

            assert.equal(params.containerId, null);
            return {
              mediaId: "instagram-media-renewed",
              permalink: null,
            };
          },
        },
        store: fixture.store,
      });
    });

    assert.deepEqual(seenTokens, [
      "access-token",
      "instagram-access-token-renewed",
    ]);
    assert.deepEqual(fixture.calls, [
      "claim-operation",
      "claim-token-refresh",
      "complete-token-refresh",
      "operation-published",
      "target-published",
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

test("treats missing social publish records as permanent failures", () => {
  assert.equal(
    isTransientSocialPublishError("Publish target was not found."),
    false,
  );
  assert.equal(
    isTransientSocialPublishError("Scheduled post was not found."),
    false,
  );
  assert.equal(
    isTransientSocialPublishError("Final media was not found."),
    false,
  );
});

function createPublishStore(
  initialOperation: SocialPublishOperationRow,
  options: {
    allowFailure?: boolean;
    cancelAfterClaimDenied?: boolean;
    carousel?: boolean;
    denyClaim?: boolean;
    failTargetPublished?: boolean;
    mediaSourceType?: PublishMediaSourceType;
    platform?: "instagram" | "tiktok" | "youtube";
    targetStatus?: "cancelled" | "failed" | "scheduled";
    withInstagramRefresh?: boolean;
    withTikTokRefresh?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const operation = { ...initialOperation };
  const context = createPublishContext(
    options.targetStatus,
    options.platform,
    options.withTikTokRefresh,
    options.withInstagramRefresh,
    options.mediaSourceType,
    options.carousel,
  );
  let targetMetadata: Record<string, Json> = {};
  let targetErrorCode: string | null = null;
  let targetErrorMessage = "";
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
    async markSocialPublishTargetFailed(params: {
      errorCode: string;
      errorMessage: string;
      metadata?: Json;
    }) {
      if (!options.allowFailure) {
        throw new Error("Target should not fail in this test.");
      }

      calls.push("target-failed");
      targetErrorCode = params.errorCode;
      targetErrorMessage = params.errorMessage;
      targetMetadata = getJsonRecord(params.metadata);
    },
    async markSocialPublishTargetActionRequired(params: {
      errorCode: string;
      errorMessage: string;
      metadata?: Json;
    }) {
      if (!options.allowFailure) {
        throw new Error("Target should not require action in this test.");
      }

      calls.push("target-action-required");
      targetErrorCode = params.errorCode;
      targetErrorMessage = params.errorMessage;
      targetMetadata = getJsonRecord(params.metadata);
      return true;
    },
    async markSocialPublishTargetPublished() {
      calls.push("target-published");

      if (options.failTargetPublished) {
        throw new Error("Could not update target projection: database unavailable.");
      }
    },
    async markSocialPublishTargetRetrying(params: {
      errorCode: string;
      errorMessage: string;
      metadata?: Json;
    }) {
      if (!options.allowFailure) {
        throw new Error("Target should not retry in this test.");
      }

      calls.push("target-retrying");
      targetErrorCode = params.errorCode;
      targetErrorMessage = params.errorMessage;
      targetMetadata = getJsonRecord(params.metadata);
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
    async claimSocialConnectionTokenRefresh() {
      if (!options.withTikTokRefresh && !options.withInstagramRefresh) {
        throw new Error("Token refresh should not be claimed in this test.");
      }

      calls.push("claim-token-refresh");
      return { ...context.connection };
    },
    async completeSocialConnectionTokenRefresh(params: {
      accessTokenCiphertext: string;
      expiresAt: string;
      refreshExpiresAt: string | null;
      refreshTokenCiphertext: string | null;
      scopes: string[];
      status: "connected" | "permission_missing";
      tokenType: string;
    }) {
      if (!options.withTikTokRefresh && !options.withInstagramRefresh) {
        throw new Error("Token refresh should not complete in this test.");
      }

      calls.push("complete-token-refresh");
      Object.assign(context.connection, {
        access_token_ciphertext: params.accessTokenCiphertext,
        expires_at: params.expiresAt,
        refresh_expires_at: params.refreshExpiresAt,
        refresh_token_ciphertext: params.refreshTokenCiphertext,
        scopes: params.scopes,
        status: params.status,
        token_type: params.tokenType,
      });
      return { ...context.connection };
    },
    async releaseSocialConnectionTokenRefresh() {
      calls.push("release-token-refresh");
      return true;
    },
    async saveSocialPublishProviderOperation(params: {
      metadata?: Json;
      providerOperationId: string;
      providerOperationKind: SocialPublishOperationRow["provider_operation_kind"];
    }) {
      calls.push("save-provider-operation");
      operation.provider_operation_id = params.providerOperationId;
      operation.provider_operation_kind = params.providerOperationKind;
      operation.metadata = params.metadata ?? operation.metadata;
      operation.status = "initialized";
      return { ...operation };
    },
  };

  return {
    calls,
    operation,
    store: store as unknown as SupabaseJobStore,
    get targetMetadata() {
      return targetMetadata;
    },
    get targetErrorCode() {
      return targetErrorCode;
    },
    get targetErrorMessage() {
      return targetErrorMessage;
    },
  };
}

function createPublishContext(
  targetStatus: "cancelled" | "failed" | "scheduled" = "scheduled",
  platform: "instagram" | "tiktok" | "youtube" = "instagram",
  withTikTokRefresh = false,
  withInstagramRefresh = false,
  mediaSourceType: PublishMediaSourceType = "combined_render",
  carousel = false,
) {
  const isTikTok = platform === "tiktok";
  const isYouTube = platform === "youtube";

  return {
    carousel: carousel
      ? {
          item: {
            deleted_at: null,
            id: "4d41918d-2997-4f02-a301-5f14a76eb767",
            media_type: "carousel" as const,
            project_id: "project-1",
            source_type: "generated_carousel" as const,
            status: "ready" as const,
            title: "Test carousel",
            user_id: "user-test",
          },
          slides: [
            {
              id: "slide-1",
              library_item_id: "4d41918d-2997-4f02-a301-5f14a76eb767",
              rendered_url: "https://cdn.example.com/slide-1.webp",
              slide_number: 1,
            },
            {
              id: "slide-2",
              library_item_id: "4d41918d-2997-4f02-a301-5f14a76eb767",
              rendered_url: "https://cdn.example.com/slide-2.webp",
              slide_number: 2,
            },
          ],
        }
      : null,
    connection: {
      access_token_ciphertext: encryptSocialToken("access-token"),
      connected_at: new Date().toISOString(),
      expires_at: withInstagramRefresh
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      id: "e3eb0ce7-4729-4454-88f4-8a07db92cb62",
      last_error_code: null,
      metadata: {},
      platform,
      platform_account_id: isTikTok
        ? "tiktok-account-1"
        : isYouTube
          ? "youtube-channel-1"
          : "instagram-account-1",
      platform_account_name: "Test Account",
      platform_account_username: "test-account",
      provider: isTikTok
        ? ("tiktok" as const)
        : isYouTube
          ? ("google" as const)
          : ("meta" as const),
      refresh_expires_at: withTikTokRefresh
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
      refresh_token_ciphertext: withTikTokRefresh
        ? encryptSocialToken("refresh-token")
        : null,
      revoked_at: null,
      scopes: isTikTok
        ? ["user.info.basic", "video.publish"]
        : isYouTube
          ? ["https://www.googleapis.com/auth/youtube.upload"]
          : ["instagram_content_publish"],
      status: "connected" as const,
      token_type: "Bearer",
      token_refreshed_at: null,
      token_refresh_claim_token: null,
      token_refresh_claimed_at: null,
      updated_at: new Date().toISOString(),
      user_id: "user-test",
    },
    media: carousel ? null : {
      collection: "video",
      duration_seconds: 12,
      mime_type: "video/mp4",
      source_type: mediaSourceType,
      status: "ready",
      url: "https://cdn.example.com/final.mp4",
    },
    post: {
      caption: "Test caption",
      status: targetStatus === "cancelled" ? "cancelled" : "scheduled",
      title: "Test title",
    },
    target: {
      metadata: {},
      platform,
      platform_post_id: null,
      platform_post_url: null,
      settings: isTikTok
        ? { containsSyntheticMedia: true, privacyLevel: "SELF_ONLY" }
        : isYouTube
          ? {
              containsSyntheticMedia: true,
              madeForKids: false,
              notifySubscribers: false,
              privacyStatus: "private",
            }
          : { shareToFeed: false },
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

async function withTikTokEnvironment(run: () => Promise<void>) {
  const originalKey = process.env.TIKTOK_CLIENT_KEY;
  const originalSecret = process.env.TIKTOK_CLIENT_SECRET;
  process.env.TIKTOK_CLIENT_KEY = "client-key";
  process.env.TIKTOK_CLIENT_SECRET = "client-secret";

  try {
    await run();
  } finally {
    restoreEnv("TIKTOK_CLIENT_KEY", originalKey);
    restoreEnv("TIKTOK_CLIENT_SECRET", originalSecret);
  }
}

async function withMockFetch<T>(
  mockFetch: typeof fetch,
  run: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function getJsonRecord(value: Json | undefined): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] =>
      entry[1] !== undefined,
    ),
  );
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
