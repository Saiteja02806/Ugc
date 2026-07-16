import { logger } from "../logger.js";
import { refreshGoogleAccessToken } from "../lib/google-oauth.js";
import { publishInstagramReel } from "../lib/instagram-publisher.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  decryptSocialToken,
  encryptSocialToken,
} from "../lib/social-token-crypto.js";
import { publishTikTokVideo } from "../lib/tiktok-publisher.js";
import { publishYouTubeVideo } from "../lib/youtube-publisher.js";
import {
  getInstagramTargetPublishSettings,
  getTikTokTargetPublishSettings,
  getYouTubeTargetPublishSettings,
} from "../lib/social-publish-settings.js";
import type {
  BackgroundJobRow,
  Json,
  SocialPublishOperationRow,
  SocialPublishProviderOperationKind,
} from "../types.js";
import { RetryableJobError } from "../retryable-job-error.js";

const requiredInstagramScopes = new Set([
  "instagram_business_content_publish",
  "instagram_content_publish",
]);
const requiredTikTokScopes = new Set(["video.publish"]);
const requiredYouTubeScopes = new Set([
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtubepartner",
]);
const ACCESS_TOKEN_REFRESH_SKEW_MS = 120_000;
const SOCIAL_PUBLISH_OPERATION_STALE_SECONDS = 900;
const DEFAULT_SOCIAL_PUBLISH_MAX_ATTEMPTS = 4;
const DEFAULT_SOCIAL_PUBLISH_RETRY_BASE_SECONDS = 30;
const DEFAULT_SOCIAL_PUBLISH_RETRY_MAX_SECONDS = 900;

type SocialPublishers = {
  instagram: typeof publishInstagramReel;
  tiktok: typeof publishTikTokVideo;
  youtube: typeof publishYouTubeVideo;
};

const defaultSocialPublishers: SocialPublishers = {
  instagram: publishInstagramReel,
  tiktok: publishTikTokVideo,
  youtube: publishYouTubeVideo,
};

export async function runPublishSocialPostJob(
  job: BackgroundJobRow,
  context: {
    publishers?: Partial<SocialPublishers>;
    store: SupabaseJobStore;
  },
): Promise<Record<string, Json>> {
  const payload = parsePublishSocialPostPayload(job.input_json);

  if (!job.user_id) {
    throw new Error("Publish job is missing user_id.");
  }

  if (!job.claim_token) {
    throw new Error("Publish job is missing an active claim token.");
  }

  const claimToken = job.claim_token;
  const publishers = {
    ...defaultSocialPublishers,
    ...context.publishers,
  };
  let operation: SocialPublishOperationRow | null = null;

  logger.info("Social publish worker started", {
    jobId: job.id,
    targetId: payload.targetId,
    userId: job.user_id,
  });

  try {
    const publishContext = await context.store.getSocialPublishContext({
      targetId: payload.targetId,
      userId: job.user_id,
    });

    if (
      publishContext.post.status === "cancelled" ||
      publishContext.target.status === "cancelled"
    ) {
      return buildCancelledPublishResult({
        platform: publishContext.target.platform,
        targetId: payload.targetId,
      });
    }

    if (
      publishContext.target.status === "published" &&
      publishContext.target.platform_post_id
    ) {
      return buildExistingPublishResult({
        platform: publishContext.target.platform,
        platformPostId: publishContext.target.platform_post_id,
        platformPostUrl: publishContext.target.platform_post_url,
        targetId: payload.targetId,
      });
    }

    if (publishContext.target.status === "failed") {
      const completedOperation =
        await context.store.getSocialPublishOperation({
          targetId: payload.targetId,
          userId: job.user_id,
        });

      if (
        completedOperation?.status === "published" &&
        completedOperation.platform_post_id
      ) {
        await context.store.markSocialPublishTargetPublished({
          platformPostId: completedOperation.platform_post_id,
          platformPostUrl: completedOperation.platform_post_url,
          targetId: payload.targetId,
          userId: job.user_id,
        });

        return buildExistingPublishResult({
          platform: publishContext.target.platform,
          platformPostId: completedOperation.platform_post_id,
          platformPostUrl: completedOperation.platform_post_url,
          targetId: payload.targetId,
        });
      }
    }

    validatePublishContext(publishContext);

    operation = await context.store.claimSocialPublishOperation({
      claimToken,
      jobId: job.id,
      platform: publishContext.target.platform,
      staleAfterSeconds: SOCIAL_PUBLISH_OPERATION_STALE_SECONDS,
      targetId: payload.targetId,
      userId: job.user_id,
    });

    if (!operation) {
      const existingOperation =
        await context.store.getSocialPublishOperation({
          targetId: payload.targetId,
          userId: job.user_id,
        });
      const latestContext = await context.store.getSocialPublishContext({
        targetId: payload.targetId,
        userId: job.user_id,
      });

      if (
        latestContext.post.status === "cancelled" ||
        latestContext.target.status === "cancelled"
      ) {
        return buildCancelledPublishResult({
          platform: latestContext.target.platform,
          targetId: payload.targetId,
        });
      }

      if (
        existingOperation?.status === "published" &&
        existingOperation.platform_post_id
      ) {
        await context.store.markSocialPublishTargetPublished({
          platformPostId: existingOperation.platform_post_id,
          platformPostUrl: existingOperation.platform_post_url,
          targetId: payload.targetId,
          userId: job.user_id,
        });

        return buildExistingPublishResult({
          platform: publishContext.target.platform,
          platformPostId: existingOperation.platform_post_id,
          platformPostUrl: existingOperation.platform_post_url,
          targetId: payload.targetId,
        });
      }

      logger.info("Social publish operation is already active", {
        idempotencyKey: existingOperation?.idempotency_key ?? null,
        jobId: job.id,
        targetId: payload.targetId,
      });

      return {
        deduplicated: true,
        ok: true,
        platform: publishContext.target.platform,
        status: "already_processing",
        targetId: payload.targetId,
      } satisfies Record<string, Json>;
    }

    const accessToken = await getPublishAccessToken({
      context: publishContext,
      store: context.store,
      userId: job.user_id,
    });

    let publishedResult: {
      output: Record<string, Json>;
      platformPostId: string;
      platformPostUrl: string | null;
    };

    if (publishContext.target.platform === "instagram") {
      const result = await publishers.instagram({
        accessToken,
        caption: publishContext.post.caption,
        containerId: getProviderOperationId(
          operation,
          "instagram_container",
        ),
        instagramAccountId: publishContext.connection.platform_account_id,
        onContainerCreated: async (containerId) => {
          operation = await saveProviderOperationOrThrow({
            claimToken,
            operation: requireClaimedOperation(operation),
            providerOperationId: containerId,
            providerOperationKind: "instagram_container",
            store: context.store,
          });
        },
        shareToFeed: getInstagramTargetPublishSettings(
          publishContext.target.settings,
        ).shareToFeed,
        videoUrl: publishContext.media.url,
      });

      publishedResult = {
        output: {
          ok: true,
          platform: "instagram",
          platformPostId: result.mediaId,
          platformPostUrl: result.permalink,
          targetId: payload.targetId,
        },
        platformPostId: result.mediaId,
        platformPostUrl: result.permalink,
      };
    } else if (publishContext.target.platform === "tiktok") {
      const result = await publishers.tiktok({
        accessToken,
        caption: publishContext.post.caption,
        onPublishInitialized: async (publishId) => {
          operation = await saveProviderOperationOrThrow({
            claimToken,
            operation: requireClaimedOperation(operation),
            providerOperationId: publishId,
            providerOperationKind: "tiktok_publish",
            store: context.store,
          });
        },
        publishId: getProviderOperationId(operation, "tiktok_publish"),
        settings: getTikTokTargetPublishSettings(
          publishContext.target.settings,
        ),
        videoUrl: publishContext.media.url,
      });

      publishedResult = {
        output: {
          ok: true,
          platform: "tiktok",
          platformPostId: result.platformPostId,
          platformPostUrl: result.platformPostUrl,
          publishId: result.publishId,
          targetId: payload.targetId,
        },
        platformPostId: result.platformPostId,
        platformPostUrl: result.platformPostUrl,
      };
    } else if (publishContext.target.platform === "youtube") {
      const result = await publishers.youtube({
        accessToken,
        caption: publishContext.post.caption,
        mimeType: publishContext.media.mime_type,
        onUploadSessionCreated: async (uploadUrl) => {
          operation = await saveProviderOperationOrThrow({
            claimToken,
            operation: requireClaimedOperation(operation),
            providerOperationId: uploadUrl,
            providerOperationKind: "youtube_resumable_upload",
            store: context.store,
          });
        },
        title: publishContext.post.title,
        uploadUrl: getProviderOperationId(
          operation,
          "youtube_resumable_upload",
        ),
        settings: getYouTubeTargetPublishSettings(
          publishContext.target.settings,
        ),
        videoUrl: publishContext.media.url,
      });

      publishedResult = {
        output: {
          ok: true,
          platform: "youtube",
          platformPostId: result.videoId,
          platformPostUrl: result.videoUrl,
          targetId: payload.targetId,
        },
        platformPostId: result.videoId,
        platformPostUrl: result.videoUrl,
      };
    } else {
      throw new Error(
        `${publishContext.target.platform} publishing is not implemented yet.`,
      );
    }

    const completedOperation =
      await context.store.markSocialPublishOperationPublished({
        claimToken,
        operationId: operation.id,
        platformPostId: publishedResult.platformPostId,
        platformPostUrl: publishedResult.platformPostUrl,
      });

    if (!completedOperation) {
      throw new Error(
        "Social publish operation claim was lost before completion.",
      );
    }

    operation = completedOperation;

    await context.store.markSocialPublishTargetPublished({
      platformPostId: publishedResult.platformPostId,
      platformPostUrl: publishedResult.platformPostUrl,
      targetId: payload.targetId,
      userId: job.user_id,
    });

    return publishedResult.output;
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "Social publishing failed.";

    if (operation?.status === "published" && operation.platform_post_id) {
      logger.error(
        "Provider publish completed but the target projection needs reconciliation",
        {
          error: errorMessage,
          jobId: job.id,
          targetId: payload.targetId,
        },
      );

      return buildExistingPublishResult({
        platform: operation.platform,
        platformPostId: operation.platform_post_id,
        platformPostUrl: operation.platform_post_url,
        targetId: payload.targetId,
      });
    }

    const errorCode = getPublishErrorCode(errorMessage);
    const retryDecision = getSocialPublishRetryDecision({
      attemptCount: job.attempt_count,
      errorMessage,
    });
    const retryError = retryDecision.shouldRetry
      ? new RetryableJobError(errorMessage, {
          code: errorCode,
          retryAfterSeconds: retryDecision.retryAfterSeconds,
        })
      : null;

    if (operation?.active_claim_token === claimToken) {
      try {
        await context.store.releaseSocialPublishOperation({
          claimToken,
          errorCode,
          errorMessage,
          operationId: operation.id,
        });
      } catch (releaseError) {
        logger.error("Could not release social publish operation", {
          error:
            releaseError instanceof Error
              ? releaseError.message
              : "Unknown persistence error",
          jobId: job.id,
          operationId: operation.id,
          targetId: payload.targetId,
        });
      }
    }

    if (retryError) {
      try {
        await context.store.markSocialPublishTargetRetrying({
          errorCode,
          errorMessage,
          nextRetryAt: retryError.retryAt,
          targetId: payload.targetId,
          userId: job.user_id,
        });
      } catch (persistenceError) {
        logger.error("Could not persist social publish retry", {
          error:
            persistenceError instanceof Error
              ? persistenceError.message
              : "Unknown persistence error",
          jobId: job.id,
          targetId: payload.targetId,
        });
      }

      throw retryError;
    }

    try {
      await context.store.markSocialPublishTargetFailed({
        errorCode,
        errorMessage,
        targetId: payload.targetId,
        userId: job.user_id,
      });
    } catch (persistenceError) {
      logger.error("Could not persist social publish failure", {
        error:
          persistenceError instanceof Error
            ? persistenceError.message
            : "Unknown persistence error",
        jobId: job.id,
        targetId: payload.targetId,
      });
    }

    throw error;
  }
}

function buildCancelledPublishResult(params: {
  platform: "instagram" | "tiktok" | "youtube";
  targetId: string;
}) {
  return {
    cancelled: true,
    ok: true,
    platform: params.platform,
    targetId: params.targetId,
  } satisfies Record<string, Json>;
}

function buildExistingPublishResult(params: {
  platform: "instagram" | "tiktok" | "youtube";
  platformPostId: string;
  platformPostUrl: string | null;
  targetId: string;
}) {
  return {
    deduplicated: true,
    ok: true,
    platform: params.platform,
    platformPostId: params.platformPostId,
    platformPostUrl: params.platformPostUrl,
    targetId: params.targetId,
  } satisfies Record<string, Json>;
}

function getProviderOperationId(
  operation: SocialPublishOperationRow,
  expectedKind: SocialPublishProviderOperationKind,
) {
  if (!operation.provider_operation_id && !operation.provider_operation_kind) {
    return null;
  }

  if (
    operation.provider_operation_kind !== expectedKind ||
    !operation.provider_operation_id
  ) {
    throw new Error(
      `Stored provider operation does not match ${expectedKind}.`,
    );
  }

  return operation.provider_operation_id;
}

function requireClaimedOperation(
  operation: SocialPublishOperationRow | null,
) {
  if (!operation) {
    throw new Error("Social publish operation claim is not active.");
  }

  return operation;
}

async function saveProviderOperationOrThrow(params: {
  claimToken: string;
  operation: SocialPublishOperationRow;
  providerOperationId: string;
  providerOperationKind: SocialPublishProviderOperationKind;
  store: SupabaseJobStore;
}) {
  const savedOperation =
    await params.store.saveSocialPublishProviderOperation({
      claimToken: params.claimToken,
      operationId: params.operation.id,
      providerOperationId: params.providerOperationId,
      providerOperationKind: params.providerOperationKind,
    });

  if (!savedOperation) {
    throw new Error(
      "Social publish operation claim was lost during provider initialization.",
    );
  }

  return savedOperation;
}

function validatePublishContext(
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>,
) {
  if (!["scheduled", "scheduling", "publishing"].includes(context.target.status)) {
    throw new Error(`Publish target is not publishable from ${context.target.status}.`);
  }

  if (context.media.status !== "ready") {
    throw new Error("Final media is not ready for publishing.");
  }

  if (
    context.media.collection !== "video" ||
    context.media.source_type !== "combined_render"
  ) {
    throw new Error("Only combined rendered videos can be published.");
  }

  if (!isHttpsUrl(context.media.url)) {
    throw new Error("Final media URL must be HTTPS.");
  }

  if (context.connection.platform !== context.target.platform) {
    throw new Error("Social connection platform does not match target platform.");
  }

  if (
    context.connection.status !== "connected" ||
    context.connection.revoked_at ||
    (isExpired(context.connection.expires_at) &&
      !canRefreshExpiredConnection(context))
  ) {
    throw new Error("Social connection is not available for publishing.");
  }

  if (
    context.target.platform === "instagram" &&
    !context.connection.scopes.some((scope) => requiredInstagramScopes.has(scope))
  ) {
    throw new Error("Instagram connection is missing content publishing scope.");
  }

  if (
    context.target.platform === "tiktok" &&
    !context.connection.scopes.some((scope) => requiredTikTokScopes.has(scope))
  ) {
    throw new Error("TikTok connection is missing video.publish scope.");
  }

  if (
    context.target.platform === "youtube" &&
    !context.connection.scopes.some((scope) => requiredYouTubeScopes.has(scope))
  ) {
    throw new Error("YouTube connection is missing upload scope.");
  }
}

async function getPublishAccessToken(params: {
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>;
  store: SupabaseJobStore;
  userId: string;
}) {
  const { connection, target } = params.context;

  if (
    target.platform !== "youtube" ||
    !isExpired(connection.expires_at, ACCESS_TOKEN_REFRESH_SKEW_MS)
  ) {
    return decryptSocialToken(connection.access_token_ciphertext);
  }

  if (!connection.refresh_token_ciphertext) {
    throw new Error("YouTube connection is missing refresh token.");
  }

  const refreshedToken = await refreshGoogleAccessToken(
    decryptSocialToken(connection.refresh_token_ciphertext),
  );

  try {
    await params.store.updateSocialConnectionAccessToken({
      accessTokenCiphertext: encryptSocialToken(refreshedToken.accessToken),
      connectionId: connection.id,
      expiresAt: refreshedToken.expiresAt,
      tokenType: refreshedToken.tokenType,
      userId: params.userId,
    });
  } catch (error) {
    logger.warn("Could not persist refreshed YouTube access token", {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : "Unknown persistence error",
    });
  }

  return refreshedToken.accessToken;
}

function canRefreshExpiredConnection(
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>,
) {
  return (
    context.target.platform === "youtube" &&
    Boolean(context.connection.refresh_token_ciphertext)
  );
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isExpired(value: string | null, skewMs = 0) {
  return Boolean(value && Date.parse(value) - skewMs <= Date.now());
}

function getPublishErrorCode(errorMessage: string) {
  if (errorMessage.includes("not implemented")) {
    return "provider_publish_not_implemented";
  }

  if (errorMessage.includes("scope")) {
    return "provider_permission_missing";
  }

  if (errorMessage.includes("connection")) {
    return "social_connection_unavailable";
  }

  if (
    errorMessage.includes("Google OAuth token refresh failed") ||
    errorMessage.includes("refresh token")
  ) {
    return "social_connection_unavailable";
  }

  if (
    errorMessage.includes("Instagram API request failed") ||
    errorMessage.includes("TikTok API request failed") ||
    errorMessage.includes("YouTube API request failed")
  ) {
    return "provider_publish_failed";
  }

  return "social_publish_failed";
}

export function getSocialPublishRetryDecision(params: {
  attemptCount: number;
  baseDelaySeconds?: number;
  errorMessage: string;
  maxAttempts?: number;
  maxDelaySeconds?: number;
}) {
  const attemptNumber = Math.max(1, params.attemptCount + 1);
  const maxAttempts = normalizeInteger(
    params.maxAttempts,
    getIntegerEnv(
      "SOCIAL_PUBLISH_MAX_ATTEMPTS",
      DEFAULT_SOCIAL_PUBLISH_MAX_ATTEMPTS,
      1,
      10,
    ),
    1,
    10,
  );
  const baseDelaySeconds = normalizeInteger(
    params.baseDelaySeconds,
    getIntegerEnv(
      "SOCIAL_PUBLISH_RETRY_BASE_SECONDS",
      DEFAULT_SOCIAL_PUBLISH_RETRY_BASE_SECONDS,
      5,
      3_600,
    ),
    1,
    3_600,
  );
  const maxDelaySeconds = normalizeInteger(
    params.maxDelaySeconds,
    getIntegerEnv(
      "SOCIAL_PUBLISH_RETRY_MAX_SECONDS",
      DEFAULT_SOCIAL_PUBLISH_RETRY_MAX_SECONDS,
      30,
      43_200,
    ),
    1,
    43_200,
  );
  const retryAfterSeconds = Math.min(
    maxDelaySeconds,
    baseDelaySeconds * 2 ** Math.max(0, attemptNumber - 1),
  );

  return {
    attemptNumber,
    maxAttempts,
    retryAfterSeconds,
    shouldRetry:
      attemptNumber < maxAttempts &&
      isTransientSocialPublishError(params.errorMessage),
  };
}

export function isTransientSocialPublishError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  const statusMatch = normalized.match(/\bhttp\s+(\d{3})\b/);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  if (status !== null) {
    if ([408, 409, 425, 429].includes(status) || status >= 500) {
      return true;
    }

    if ([400, 401, 403, 404, 410, 422].includes(status)) {
      return false;
    }
  }

  if (
    [
      "econnreset",
      "enotfound",
      "etimedout",
      "fetch failed",
      "network",
      "rate limit",
      "temporarily unavailable",
      "timed out",
      "timeout",
    ].some((fragment) => normalized.includes(fragment))
  ) {
    return true;
  }

  if (
    [
      "does not match",
      "is missing",
      "is not available",
      "is not publishable",
      "must be",
      "not implemented",
      "only combined rendered videos",
      "scope",
    ].some((fragment) => normalized.includes(fragment))
  ) {
    return false;
  }

  return true;
}

function getIntegerEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const rawValue = process.env[name]?.trim();
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return Number.isInteger(parsedValue)
    ? Math.min(Math.max(parsedValue, min), max)
    : fallback;
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  return Number.isInteger(value)
    ? Math.min(Math.max(value ?? fallback, min), max)
    : fallback;
}

function parsePublishSocialPostPayload(value: Json) {
  const input = getJsonRecord(value, "input_json");

  return {
    targetId: getRequiredString(input.targetId, "targetId"),
  };
}

function getJsonRecord(
  value: Json | undefined,
  fieldName: string,
): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value;
}

function getRequiredString(value: Json | undefined, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}
