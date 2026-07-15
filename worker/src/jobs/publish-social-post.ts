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
import type { BackgroundJobRow, Json } from "../types.js";

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

export async function runPublishSocialPostJob(
  job: BackgroundJobRow,
  context: {
    store: SupabaseJobStore;
  },
) {
  const payload = parsePublishSocialPostPayload(job.input_json);

  if (!job.user_id) {
    throw new Error("Publish job is missing user_id.");
  }

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

    validatePublishContext(publishContext);

    await context.store.markSocialPublishTargetPublishing({
      targetId: payload.targetId,
      userId: job.user_id,
    });

    const accessToken = await getPublishAccessToken({
      context: publishContext,
      store: context.store,
      userId: job.user_id,
    });

    if (publishContext.target.platform === "instagram") {
      const result = await publishInstagramReel({
        accessToken,
        caption: publishContext.post.caption,
        instagramAccountId: publishContext.connection.platform_account_id,
        videoUrl: publishContext.media.url,
      });

      await context.store.markSocialPublishTargetPublished({
        platformPostId: result.mediaId,
        platformPostUrl: result.permalink,
        targetId: payload.targetId,
        userId: job.user_id,
      });

      return {
        ok: true,
        platform: "instagram",
        platformPostId: result.mediaId,
        platformPostUrl: result.permalink,
        targetId: payload.targetId,
      } satisfies Record<string, Json>;
    }

    if (publishContext.target.platform === "tiktok") {
      const result = await publishTikTokVideo({
        accessToken,
        caption: publishContext.post.caption,
        videoUrl: publishContext.media.url,
      });

      await context.store.markSocialPublishTargetPublished({
        platformPostId: result.platformPostId,
        platformPostUrl: result.platformPostUrl,
        targetId: payload.targetId,
        userId: job.user_id,
      });

      return {
        ok: true,
        platform: "tiktok",
        platformPostId: result.platformPostId,
        platformPostUrl: result.platformPostUrl,
        publishId: result.publishId,
        targetId: payload.targetId,
      } satisfies Record<string, Json>;
    }

    if (publishContext.target.platform === "youtube") {
      const result = await publishYouTubeVideo({
        accessToken,
        caption: publishContext.post.caption,
        mimeType: publishContext.media.mime_type,
        title: publishContext.post.title,
        videoUrl: publishContext.media.url,
      });

      await context.store.markSocialPublishTargetPublished({
        platformPostId: result.videoId,
        platformPostUrl: result.videoUrl,
        targetId: payload.targetId,
        userId: job.user_id,
      });

      return {
        ok: true,
        platform: "youtube",
        platformPostId: result.videoId,
        platformPostUrl: result.videoUrl,
        targetId: payload.targetId,
      } satisfies Record<string, Json>;
    }

    throw new Error(
      `${publishContext.target.platform} publishing is not implemented yet.`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "Social publishing failed.";
    const errorCode = getPublishErrorCode(errorMessage);

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
