import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { logger } from "../logger.js";
import {
  GoogleOAuthError,
  refreshGoogleAccessToken,
} from "../lib/google-oauth.js";
import {
  InstagramOAuthError,
  refreshInstagramAccessToken,
} from "../lib/instagram-oauth.js";
import {
  InstagramPublishError,
  publishInstagramCarousel,
  publishInstagramReel,
} from "../lib/instagram-publisher.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  decryptSocialToken,
  encryptSocialToken,
} from "../lib/social-token-crypto.js";
import {
  publishTikTokPhotoCarousel,
  publishTikTokVideo,
  TikTokPublishError,
} from "../lib/tiktok-publisher.js";
import {
  isTikTokReconnectErrorCode,
  refreshTikTokAccessToken,
  TikTokOAuthError,
} from "../lib/tiktok-oauth.js";
import { prepareInstagramCarouselImages } from "../lib/social-carousel-media.js";
import {
  publishYouTubeVideo,
  YouTubePublishError,
} from "../lib/youtube-publisher.js";
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
const publishableVideoSourceTypes = new Set([
  "combined_render",
  "demo_upload",
  "upload",
  "generated_video",
  "edit_export",
]);
const ACCESS_TOKEN_REFRESH_SKEW_MS = 15 * 60 * 1000;
const SOCIAL_TOKEN_REFRESH_STALE_SECONDS = 120;
const SOCIAL_PUBLISH_OPERATION_STALE_SECONDS = 900;
const DEFAULT_SOCIAL_PUBLISH_MAX_ATTEMPTS = 4;
const DEFAULT_SOCIAL_PUBLISH_RETRY_BASE_SECONDS = 30;
const DEFAULT_SOCIAL_PUBLISH_RETRY_MAX_SECONDS = 900;
const DEFAULT_INSTAGRAM_TOKEN_REFRESH_SKEW_SECONDS = 7 * 24 * 60 * 60;

type SocialPublishers = {
  instagram: typeof publishInstagramReel;
  instagramCarousel: typeof publishInstagramCarousel;
  tiktok: typeof publishTikTokVideo;
  tiktokCarousel: typeof publishTikTokPhotoCarousel;
  youtube: typeof publishYouTubeVideo;
};

const defaultSocialPublishers: SocialPublishers = {
  instagram: publishInstagramReel,
  instagramCarousel: publishInstagramCarousel,
  tiktok: publishTikTokVideo,
  tiktokCarousel: publishTikTokPhotoCarousel,
  youtube: publishYouTubeVideo,
};

export async function runPublishSocialPostJob(
  job: BackgroundJobRow,
  context: {
    prepareInstagramCarouselImages?: typeof prepareInstagramCarouselImages;
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
  let targetMetadata: Json = {};

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
    targetMetadata = publishContext.target.metadata;

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

    let accessToken = await getPublishAccessToken({
      context: publishContext,
      store: context.store,
      targetId: payload.targetId,
      userId: job.user_id,
    });

    let publishedResult: {
      output: Record<string, Json>;
      platformPostId: string;
      platformPostUrl: string | null;
    };

    if (publishContext.target.platform === "instagram") {
      const sourceCarouselImageUrls = publishContext.carousel?.slides.map(
        (slide) => slide.rendered_url,
      );
      const instagramContainerId = getProviderOperationId(
        requireClaimedOperation(operation),
        "instagram_container",
      );
      const carouselImageUrls =
        sourceCarouselImageUrls && !instagramContainerId
          ? await (
              context.prepareInstagramCarouselImages ??
              prepareInstagramCarouselImages
            )({
              imageUrls: sourceCarouselImageUrls,
              libraryItemId: publishContext.carousel!.item.id,
            })
          : sourceCarouselImageUrls;
      const videoMedia = publishContext.media;
      const publishToInstagram = (token: string) =>
        carouselImageUrls
          ? publishers.instagramCarousel({
              accessToken: token,
              caption: publishContext.post.caption,
              containerId: instagramContainerId,
              imageUrls: carouselImageUrls,
              instagramAccountId:
                publishContext.connection.platform_account_id,
              onContainerCreated: persistInstagramContainer,
            })
          : publishers.instagram({
              accessToken: token,
              caption: publishContext.post.caption,
              containerId: instagramContainerId,
              instagramAccountId:
                publishContext.connection.platform_account_id,
              onContainerCreated: persistInstagramContainer,
              shareToFeed: getInstagramTargetPublishSettings(
                publishContext.target.settings,
              ).shareToFeed,
              videoUrl: requireVideoMedia(videoMedia).url,
            });
      const persistInstagramContainer = async (containerId: string) => {
        operation = await saveProviderOperationOrThrow({
          claimToken,
          operation: requireClaimedOperation(operation),
          providerOperationId: containerId,
          providerOperationKind: "instagram_container",
          store: context.store,
        });
      };
      let result: Awaited<ReturnType<typeof publishInstagramReel>>;

      try {
        result = await publishToInstagram(accessToken);
      } catch (error) {
        if (
          !(error instanceof InstagramPublishError) ||
          error.code !== "access_token_invalid"
        ) {
          throw error;
        }

        accessToken = await refreshInstagramConnectionToken({
          context: publishContext,
          store: context.store,
          targetId: payload.targetId,
          userId: job.user_id,
        });
        result = await publishToInstagram(accessToken);
      }

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
      const carouselImageUrls = publishContext.carousel?.slides.map(
        (slide) => slide.rendered_url,
      );
      const videoMedia = publishContext.media;
      const publishToTikTok = (token: string) =>
        carouselImageUrls
          ? publishers.tiktokCarousel({
              accessToken: token,
              caption: publishContext.post.caption,
              imageUrls: carouselImageUrls,
              onPublishInitialized: async (initialization) => {
                await persistTikTokInitialization({
                  initialization,
                  mediaTransferMode: "PULL_FROM_URL",
                  uploadUrl: null,
                });
              },
              publishId: getProviderOperationId(
                requireClaimedOperation(operation),
                "tiktok_publish",
              ),
              settings: getTikTokTargetPublishSettings(
                publishContext.target.settings,
              ),
            })
          : publishers.tiktok({
              accessToken: token,
              caption: publishContext.post.caption,
              onPublishInitialized: async (initialization) => {
                await persistTikTokInitialization({
                  initialization,
                  mediaTransferMode: initialization.mediaTransferMode,
                  uploadUrl: initialization.uploadUrl,
                });
              },
              publishId: getProviderOperationId(
                requireClaimedOperation(operation),
                "tiktok_publish",
              ),
              settings: getTikTokTargetPublishSettings(
                publishContext.target.settings,
              ),
              uploadUrl: getTikTokUploadUrl(requireClaimedOperation(operation)),
              videoDurationSeconds:
                requireVideoMedia(videoMedia).duration_seconds,
              videoMimeType: requireVideoMedia(videoMedia).mime_type,
              videoUrl: requireVideoMedia(videoMedia).url,
            });
      const persistTikTokInitialization = async (params: {
        initialization: {
          creatorNickname: string | null;
          creatorUsername: string | null;
          logId: string | null;
          publishId: string;
        };
        mediaTransferMode: string;
        uploadUrl: string | null;
      }) => {
        operation = await saveProviderOperationOrThrow({
          claimToken,
          metadata: mergeJsonRecords(
            requireClaimedOperation(operation).metadata,
            {
              tiktokCreatorNickname: params.initialization.creatorNickname,
              tiktokCreatorUsername: params.initialization.creatorUsername,
              tiktokInitializationLogId: params.initialization.logId,
              tiktokMediaTransferMode: params.mediaTransferMode,
              tiktokUploadUrl: params.uploadUrl,
            },
          ),
          operation: requireClaimedOperation(operation),
          providerOperationId: params.initialization.publishId,
          providerOperationKind: "tiktok_publish",
          store: context.store,
        });
      };
      let result: Awaited<ReturnType<typeof publishTikTokVideo>>;

      try {
        result = await publishToTikTok(accessToken);
      } catch (error) {
        if (
          !(error instanceof TikTokPublishError) ||
          error.code !== "access_token_invalid"
        ) {
          throw error;
        }

        accessToken = await refreshTikTokConnectionToken({
          context: publishContext,
          store: context.store,
          targetId: payload.targetId,
          userId: job.user_id,
        });
        result = await publishToTikTok(accessToken);
      }

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
      const videoMedia = requireVideoMedia(publishContext.media);
      const result = await publishers.youtube({
        accessToken,
        caption: publishContext.post.caption,
        mimeType: videoMedia.mime_type,
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
        videoUrl: videoMedia.url,
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

    const failure = getSocialPublishFailure(error, errorMessage);
    const errorCode = failure.errorCode;
    const failureMetadata = mergeJsonRecords(targetMetadata, {
      providerError: failure.providerError,
    });
    const retryDecision = getSocialPublishRetryDecision({
      attemptCount: job.attempt_count,
      errorMessage,
      providerRetryAfterSeconds: failure.retryAfterSeconds,
      retryable: failure.retryable,
    });
    const retryError = !failure.actionRequired && retryDecision.shouldRetry
      ? new RetryableJobError(failure.userMessage, {
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
          metadata: mergeJsonRecords(operation.metadata, {
            providerError: failure.providerError,
          }),
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

    if (failure.actionRequired) {
      try {
        await context.store.markSocialPublishTargetActionRequired({
          errorCode,
          errorMessage: failure.userMessage,
          metadata: failureMetadata,
          targetId: payload.targetId,
          userId: job.user_id,
        });
      } catch (persistenceError) {
        logger.error("Could not persist social publish action requirement", {
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

    if (retryError) {
      try {
        await context.store.markSocialPublishTargetRetrying({
          errorCode,
          errorMessage: failure.userMessage,
          metadata: failureMetadata,
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
        errorMessage: failure.retryable
          ? getRetryExhaustedUserMessage(errorCode)
          : failure.userMessage,
        metadata: failureMetadata,
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
  metadata?: Json;
  operation: SocialPublishOperationRow;
  providerOperationId: string;
  providerOperationKind: SocialPublishProviderOperationKind;
  store: SupabaseJobStore;
}) {
  const savedOperation =
    await params.store.saveSocialPublishProviderOperation({
      claimToken: params.claimToken,
      metadata: params.metadata,
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

  if (context.carousel) {
    if (context.target.platform === "youtube") {
      throw new Error("YouTube does not support carousel publishing.");
    }

    if (
      context.carousel.slides.length < 2 ||
      context.carousel.slides.length >
        (context.target.platform === "instagram" ? 10 : 35)
    ) {
      throw new Error("Scheduled carousel has an unsupported slide count.");
    }

    if (
      context.carousel.slides.some(
        (slide) => !isHttpsUrl(slide.rendered_url),
      )
    ) {
      throw new Error("Every carousel slide URL must be HTTPS.");
    }
  } else {
    const media = requireVideoMedia(context.media);

    if (media.status !== "ready") {
      throw new Error("Final media is not ready for publishing.");
    }

    if (
      media.collection !== "video" ||
      !publishableVideoSourceTypes.has(media.source_type)
    ) {
      throw new Error("Only scheduled videos can be published.");
    }

    if (!isHttpsUrl(media.url)) {
      throw new Error("Final media URL must be HTTPS.");
    }
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
  targetId: string;
  userId: string;
}) {
  const { connection, target } = params.context;

  if (target.platform === "instagram") {
    const refreshSkewMs =
      getIntegerEnv(
        "INSTAGRAM_TOKEN_REFRESH_SKEW_SECONDS",
        DEFAULT_INSTAGRAM_TOKEN_REFRESH_SKEW_SECONDS,
        3_600,
        30 * 24 * 60 * 60,
      ) * 1_000;

    if (!isExpired(connection.expires_at, refreshSkewMs)) {
      return decryptSocialToken(connection.access_token_ciphertext);
    }

    return refreshInstagramConnectionToken(params);
  }

  if (!isExpired(connection.expires_at, ACCESS_TOKEN_REFRESH_SKEW_MS)) {
    return decryptSocialToken(connection.access_token_ciphertext);
  }

  if (target.platform === "tiktok") {
    return refreshTikTokConnectionToken(params);
  }

  if (target.platform !== "youtube") {
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

async function refreshInstagramConnectionToken(params: {
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>;
  store: SupabaseJobStore;
  targetId: string;
  userId: string;
}) {
  const connection = params.context.connection;

  if (isExpired(connection.expires_at)) {
    throw new InstagramOAuthError(
      "Instagram access expired before it could be renewed.",
      "access_token_invalid",
      401,
      true,
      false,
      "Reconnect Instagram to continue publishing.",
    );
  }

  const claimToken = randomUUID();
  const claimedConnection =
    await params.store.claimSocialConnectionTokenRefresh({
      claimToken,
      connectionId: connection.id,
      staleAfterSeconds: SOCIAL_TOKEN_REFRESH_STALE_SECONDS,
      userId: params.userId,
    });

  if (!claimedConnection) {
    return waitForInstagramConnectionRefresh(params);
  }

  try {
    if (isExpired(claimedConnection.expires_at)) {
      throw new InstagramOAuthError(
        "Instagram access expired before it could be renewed.",
        "access_token_invalid",
        401,
        true,
        false,
        "Reconnect Instagram to continue publishing.",
      );
    }

    const refreshedToken = await refreshInstagramAccessToken(
      decryptSocialToken(claimedConnection.access_token_ciphertext),
    );
    const hasPublishScope = claimedConnection.scopes.some((scope) =>
      requiredInstagramScopes.has(scope),
    );
    const completedConnection =
      await params.store.completeSocialConnectionTokenRefresh({
        accessTokenCiphertext: encryptSocialToken(refreshedToken.accessToken),
        claimToken,
        connectionId: claimedConnection.id,
        expiresAt: refreshedToken.expiresAt,
        refreshExpiresAt: claimedConnection.refresh_expires_at,
        refreshTokenCiphertext: claimedConnection.refresh_token_ciphertext,
        scopes: claimedConnection.scopes,
        status: hasPublishScope ? "connected" : "permission_missing",
        tokenType: refreshedToken.tokenType,
        userId: params.userId,
      });

    if (!completedConnection) {
      throw new Error("Instagram token refresh claim was lost before completion.");
    }

    if (!hasPublishScope) {
      throw new InstagramOAuthError(
        "Instagram connection is missing content publishing scope.",
        "permission_missing",
        403,
        true,
        false,
        "Reconnect Instagram to allow video publishing.",
      );
    }

    return refreshedToken.accessToken;
  } catch (error) {
    const refreshErrorCode =
      error instanceof InstagramOAuthError
        ? error.code
        : "instagram_refresh_failed";

    try {
      await params.store.releaseSocialConnectionTokenRefresh({
        claimToken,
        connectionId: claimedConnection.id,
        errorCode: refreshErrorCode,
        userId: params.userId,
      });
    } catch (releaseError) {
      logger.error("Could not release Instagram token refresh claim", {
        connectionId: claimedConnection.id,
        error:
          releaseError instanceof Error
            ? releaseError.message
            : "Unknown persistence error",
      });
    }

    throw error;
  }
}

function requireVideoMedia<TMedia>(media: TMedia | null): TMedia {
  if (!media) {
    throw new Error("Scheduled post is missing final video media.");
  }

  return media;
}

async function waitForInstagramConnectionRefresh(params: {
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>;
  store: SupabaseJobStore;
  targetId: string;
  userId: string;
}) {
  const refreshSkewMs =
    getIntegerEnv(
      "INSTAGRAM_TOKEN_REFRESH_SKEW_SECONDS",
      DEFAULT_INSTAGRAM_TOKEN_REFRESH_SKEW_SECONDS,
      3_600,
      30 * 24 * 60 * 60,
    ) * 1_000;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await delay(250);
    const latest = await params.store.getSocialPublishContext({
      targetId: params.targetId,
      userId: params.userId,
    });

    if (
      latest.connection.status === "connected" &&
      !latest.connection.token_refresh_claim_token &&
      !isExpired(latest.connection.expires_at, refreshSkewMs)
    ) {
      return decryptSocialToken(latest.connection.access_token_ciphertext);
    }

    if (
      latest.connection.status !== "connected" ||
      isExpired(latest.connection.expires_at)
    ) {
      throw new InstagramOAuthError(
        "Instagram authorization must be renewed by the account owner.",
        latest.connection.last_error_code || "access_token_invalid",
        401,
        true,
        false,
        "Reconnect Instagram to continue publishing.",
      );
    }
  }

  throw new InstagramOAuthError(
    "Instagram token renewal is already in progress.",
    "refresh_in_progress",
    409,
    false,
    true,
    "Instagram authorization is being renewed. We will retry automatically.",
  );
}

async function refreshTikTokConnectionToken(params: {
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>;
  store: SupabaseJobStore;
  targetId: string;
  userId: string;
}) {
  const connection = params.context.connection;

  if (
    !connection.refresh_token_ciphertext ||
    isExpired(connection.refresh_expires_at)
  ) {
    throw new TikTokOAuthError(
      "Reconnect TikTok because its authorization has expired.",
      "refresh_token_expired",
      null,
      401,
    );
  }

  const claimToken = randomUUID();
  const claimedConnection =
    await params.store.claimSocialConnectionTokenRefresh({
      claimToken,
      connectionId: connection.id,
      staleAfterSeconds: SOCIAL_TOKEN_REFRESH_STALE_SECONDS,
      userId: params.userId,
    });

  if (!claimedConnection) {
    return waitForTikTokConnectionRefresh(params);
  }

  try {
    if (
      !claimedConnection.refresh_token_ciphertext ||
      isExpired(claimedConnection.refresh_expires_at)
    ) {
      throw new TikTokOAuthError(
        "Reconnect TikTok because its authorization has expired.",
        "refresh_token_expired",
        null,
        401,
      );
    }

    const refreshedToken = await refreshTikTokAccessToken(
      decryptSocialToken(claimedConnection.refresh_token_ciphertext),
    );

    if (
      !refreshedToken.openId ||
      refreshedToken.openId !== claimedConnection.platform_account_id
    ) {
      throw new TikTokOAuthError(
        "TikTok refreshed a different account. Reconnect the intended account.",
        "account_mismatch",
        refreshedToken.logId,
        401,
      );
    }

    const hasPublishScope = refreshedToken.scopes.some((scope) =>
      requiredTikTokScopes.has(scope),
    );
    const completedConnection =
      await params.store.completeSocialConnectionTokenRefresh({
        accessTokenCiphertext: encryptSocialToken(refreshedToken.accessToken),
        claimToken,
        connectionId: claimedConnection.id,
        expiresAt: refreshedToken.expiresAt,
        refreshExpiresAt: refreshedToken.refreshExpiresAt,
        refreshTokenCiphertext: encryptSocialToken(
          refreshedToken.refreshToken,
        ),
        scopes: refreshedToken.scopes,
        status: hasPublishScope ? "connected" : "permission_missing",
        tokenType: refreshedToken.tokenType,
        userId: params.userId,
      });

    if (!completedConnection) {
      throw new Error("TikTok token refresh claim was lost before completion.");
    }

    if (!hasPublishScope) {
      throw new TikTokOAuthError(
        "Reconnect TikTok to grant publishing permission.",
        "scope_not_authorized",
        refreshedToken.logId,
        403,
      );
    }

    return refreshedToken.accessToken;
  } catch (error) {
    const refreshErrorCode =
      error instanceof TikTokOAuthError
        ? error.code
        : "tiktok_refresh_failed";

    try {
      await params.store.releaseSocialConnectionTokenRefresh({
        claimToken,
        connectionId: claimedConnection.id,
        errorCode: refreshErrorCode,
        userId: params.userId,
      });
    } catch (releaseError) {
      logger.error("Could not release TikTok token refresh claim", {
        connectionId: claimedConnection.id,
        error:
          releaseError instanceof Error
            ? releaseError.message
            : "Unknown persistence error",
      });
    }

    throw error;
  }
}

async function waitForTikTokConnectionRefresh(params: {
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>;
  store: SupabaseJobStore;
  targetId: string;
  userId: string;
}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await delay(250);
    const latest = await params.store.getSocialPublishContext({
      targetId: params.targetId,
      userId: params.userId,
    });

    if (
      latest.connection.status === "connected" &&
      !latest.connection.token_refresh_claim_token &&
      !isExpired(latest.connection.expires_at, ACCESS_TOKEN_REFRESH_SKEW_MS)
    ) {
      return decryptSocialToken(latest.connection.access_token_ciphertext);
    }

    if (
      latest.connection.status !== "connected" ||
      isExpired(latest.connection.refresh_expires_at)
    ) {
      throw new TikTokOAuthError(
        "Reconnect TikTok to continue publishing.",
        latest.connection.last_error_code || "invalid_refresh_token",
        null,
        401,
      );
    }
  }

  throw new Error("TikTok token refresh is already in progress.");
}

function canRefreshExpiredConnection(
  context: Awaited<ReturnType<SupabaseJobStore["getSocialPublishContext"]>>,
) {
  return (
    (context.target.platform === "youtube" &&
      Boolean(context.connection.refresh_token_ciphertext)) ||
    (context.target.platform === "tiktok" &&
      Boolean(context.connection.refresh_token_ciphertext) &&
      !isExpired(context.connection.refresh_expires_at))
  );
}

function getTikTokUploadUrl(operation: SocialPublishOperationRow) {
  if (operation.provider_operation_kind !== "tiktok_publish") {
    return null;
  }

  const metadata = asJsonRecord(operation.metadata);
  const uploadUrl = metadata.tiktokUploadUrl;
  const transferMode = metadata.tiktokMediaTransferMode;

  if (transferMode === "FILE_UPLOAD" && typeof uploadUrl !== "string") {
    throw new Error("Stored TikTok upload session is missing its upload URL.");
  }

  return typeof uploadUrl === "string" ? uploadUrl : null;
}

function getSocialPublishFailure(error: unknown, fallbackMessage: string) {
  if (error instanceof InstagramOAuthError) {
    return {
      actionRequired: error.actionRequired,
      errorCode: `instagram_${normalizeErrorCode(error.code)}`,
      providerError: {
        code: error.code,
        message: error.message,
        occurredAt: new Date().toISOString(),
        providerCode: error.providerCode,
        providerSubcode: error.providerSubcode,
        retryable: error.retryable,
        status: error.status,
        traceId: error.traceId,
      },
      retryable: error.retryable,
      retryAfterSeconds: null,
      userMessage: error.userMessage,
    };
  }

  if (error instanceof InstagramPublishError) {
    return {
      actionRequired: error.actionRequired,
      errorCode: `instagram_${normalizeErrorCode(error.code)}`,
      providerError: {
        code: error.code,
        message: error.message,
        occurredAt: new Date().toISOString(),
        providerCode: error.providerCode,
        providerSubcode: error.providerSubcode,
        retryable: error.retryable,
        status: error.status,
        traceId: error.traceId,
      },
      retryable: error.retryable,
      retryAfterSeconds: error.retryAfterSeconds,
      userMessage: error.userMessage,
    };
  }

  if (error instanceof YouTubePublishError) {
    return {
      actionRequired: error.actionRequired,
      errorCode: `youtube_${normalizeErrorCode(error.code)}`,
      providerError: {
        code: error.code,
        message: error.message,
        occurredAt: new Date().toISOString(),
        providerCode: error.providerCode,
        reasons: error.reasons,
        retryable: error.retryable,
        status: error.status,
      },
      retryable: error.retryable,
      retryAfterSeconds: error.retryAfterSeconds,
      userMessage: error.userMessage,
    };
  }

  if (error instanceof GoogleOAuthError) {
    return {
      actionRequired: error.actionRequired,
      errorCode: `youtube_${normalizeErrorCode(error.code)}`,
      providerError: {
        code: error.code,
        message: error.message,
        occurredAt: new Date().toISOString(),
        retryable: error.retryable,
        status: error.status,
      },
      retryable: error.retryable,
      retryAfterSeconds: null,
      userMessage: error.userMessage,
    };
  }

  if (error instanceof TikTokPublishError) {
    return {
      actionRequired: error.actionRequired,
      errorCode: `tiktok_${normalizeErrorCode(error.code)}`,
      providerError: {
        code: error.code,
        logId: error.logId,
        message: error.message,
        occurredAt: new Date().toISOString(),
        status: error.status,
      },
      retryable: null,
      retryAfterSeconds: null,
      userMessage: getTikTokUserMessage(error.code, error.message),
    };
  }

  if (error instanceof TikTokOAuthError) {
    return {
      actionRequired: isTikTokReconnectErrorCode(error.code) ||
        error.code === "account_mismatch" ||
        error.code === "refresh_token_expired",
      errorCode: `tiktok_${normalizeErrorCode(error.code)}`,
      providerError: {
        code: error.code,
        logId: error.logId,
        message: error.message,
        occurredAt: new Date().toISOString(),
        status: error.status,
      },
      retryable: null,
      retryAfterSeconds: null,
      userMessage: getTikTokUserMessage(error.code, error.message),
    };
  }

  const errorCode = getPublishErrorCode(fallbackMessage);
  const retryable = isTransientSocialPublishError(fallbackMessage);

  return {
    actionRequired: [
      "provider_permission_missing",
      "social_connection_unavailable",
    ].includes(errorCode),
    errorCode,
    providerError: {
      code: errorCode,
      logId: null,
      message: fallbackMessage,
      occurredAt: new Date().toISOString(),
      retryable,
      status: null,
    },
    retryable,
    retryAfterSeconds: null,
    userMessage: getGenericSocialPublishUserMessage(errorCode, retryable),
  };
}

function getGenericSocialPublishUserMessage(
  errorCode: string,
  retryable: boolean,
) {
  if (
    errorCode === "provider_permission_missing" ||
    errorCode === "social_connection_unavailable"
  ) {
    return "Reconnect this account to continue publishing.";
  }

  if (errorCode === "provider_publish_not_implemented") {
    return "Publishing to this platform is not available yet.";
  }

  if (retryable) {
    return "The platform is temporarily unavailable. We will retry automatically.";
  }

  return "The platform could not publish this post. Try again.";
}

function getTikTokUserMessage(code: string, fallbackMessage: string) {
  if (["access_token_invalid", "account_mismatch", "invalid_grant", "invalid_refresh_token", "refresh_token_expired", "scope_not_authorized"].includes(code)) {
    return "Reconnect TikTok to continue publishing.";
  }

  if (code === "privacy_level_option_mismatch") {
    return "Choose a TikTok visibility option that is available for this account.";
  }

  if (code === "url_ownership_unverified") {
    return "TikTok could not access this video source. Try preparing the post again.";
  }

  if (code === "reached_active_user_cap") {
    return "TikTok has not approved this app for additional public accounts yet.";
  }

  if (code === "spam_risk_too_many_posts") {
    return "TikTok's daily posting limit was reached. Try again later.";
  }

  if (code === "video_duration_exceeds_creator_limit") {
    return "This video is longer than the selected TikTok account allows.";
  }

  if (code === "unaudited_client_can_only_post_to_private_accounts") {
    return "TikTok currently allows this app to publish only with Only me visibility.";
  }

  return fallbackMessage.toLowerCase().includes("timed out")
    ? "TikTok is still processing this video. We will retry automatically."
    : "TikTok could not publish this video. Try again.";
}

function getRetryExhaustedUserMessage(errorCode: string) {
  if (errorCode.startsWith("instagram_")) {
    return "Instagram is still unavailable. Retry publishing when ready.";
  }

  if (errorCode.startsWith("youtube_")) {
    return "YouTube is still unavailable. Retry publishing when ready.";
  }

  if (errorCode.startsWith("tiktok_")) {
    return "TikTok is still unavailable. Retry publishing when ready.";
  }

  return "The platform is still unavailable. Retry publishing when ready.";
}

function normalizeErrorCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "publish_failed";
}

function mergeJsonRecords(left: Json, right: Record<string, Json>): Json {
  return {
    ...asJsonRecord(left),
    ...right,
  };
}

function asJsonRecord(value: Json): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] =>
      entry[1] !== undefined,
    ),
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
  providerRetryAfterSeconds?: number | null;
  retryable?: boolean | null;
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
  const exponentialRetryAfterSeconds = Math.min(
    maxDelaySeconds,
    baseDelaySeconds * 2 ** Math.max(0, attemptNumber - 1),
  );
  const providerRetryAfterSeconds =
    typeof params.providerRetryAfterSeconds === "number" &&
    Number.isFinite(params.providerRetryAfterSeconds) &&
    params.providerRetryAfterSeconds >= 0
      ? Math.ceil(params.providerRetryAfterSeconds)
      : 0;
  const retryAfterSeconds = Math.min(
    maxDelaySeconds,
    Math.max(exponentialRetryAfterSeconds, providerRetryAfterSeconds),
  );

  return {
    attemptNumber,
    maxAttempts,
    retryAfterSeconds,
    shouldRetry:
      attemptNumber < maxAttempts &&
      (params.retryable ??
        isTransientSocialPublishError(params.errorMessage)),
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
      "not found",
      "not implemented",
      "only scheduled videos",
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
