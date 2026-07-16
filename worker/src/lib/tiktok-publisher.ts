import { setTimeout as delay } from "node:timers/promises";

import { logger } from "../logger.js";
import type { TikTokTargetPublishSettings } from "./social-publish-settings.js";

const DEFAULT_MAX_STATUS_POLLS = 18;
const DEFAULT_STATUS_POLL_INTERVAL_MS = 10_000;
const defaultPrivacyPreference = ["SELF_ONLY"] as const;

export type TikTokPublishResult = {
  platformPostId: string;
  platformPostUrl: null;
  publishId: string;
};

type TikTokApiEnvelope<TData extends object> = {
  data?: TData;
  error?: {
    code?: string;
    log_id?: string;
    message?: string;
  };
};

type TikTokCreatorInfo = {
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  max_video_post_duration_sec?: number;
  privacy_level_options?: string[];
  stitch_disabled?: boolean;
};

type TikTokPublishStatus = {
  fail_reason?: string;
  publicaly_available_post_id?: Array<number | string>;
  status?: string;
};

export async function publishTikTokVideo(params: {
  accessToken: string;
  caption: string;
  onPublishInitialized?: (publishId: string) => Promise<void>;
  publishId?: string | null;
  settings?: TikTokTargetPublishSettings;
  videoUrl: string;
}): Promise<TikTokPublishResult> {
  let publishId = params.publishId ?? null;

  if (!publishId) {
    const creatorInfo = await queryCreatorInfo(params.accessToken);
    const privacyLevel = getPrivacyLevel(
      creatorInfo.privacy_level_options,
      params.settings,
    );

    publishId = await initializeDirectPost({
      accessToken: params.accessToken,
      caption: params.caption,
      creatorInfo,
      privacyLevel,
      settings: params.settings,
      videoUrl: params.videoUrl,
    });
    await params.onPublishInitialized?.(publishId);
  }

  const finalStatus = await waitForTikTokPostStatus({
    accessToken: params.accessToken,
    publishId,
  });
  const publicPostId = finalStatus.publicaly_available_post_id?.[0];

  return {
    platformPostId: publicPostId ? String(publicPostId) : publishId,
    platformPostUrl: null,
    publishId,
  };
}

async function queryCreatorInfo(accessToken: string) {
  const payload = await postTikTokJson<TikTokCreatorInfo>(
    "/v2/post/publish/creator_info/query/",
    accessToken,
    {},
  );

  if (!payload.privacy_level_options?.length) {
    throw new Error("TikTok creator info did not include privacy options.");
  }

  return payload;
}

async function initializeDirectPost(params: {
  accessToken: string;
  caption: string;
  creatorInfo: TikTokCreatorInfo;
  privacyLevel: string;
  settings?: TikTokTargetPublishSettings;
  videoUrl: string;
}) {
  const payload = await postTikTokJson<{ publish_id?: string }>(
    "/v2/post/publish/video/init/",
    params.accessToken,
    {
      post_info: {
        brand_content_toggle: params.settings?.brandedContent === true,
        brand_organic_toggle: params.settings?.brandOrganic === true,
        disable_comment:
          params.creatorInfo.comment_disabled === true ||
          params.settings?.allowComment === false,
        disable_duet:
          params.creatorInfo.duet_disabled === true ||
          params.settings?.allowDuet === false,
        disable_stitch:
          params.creatorInfo.stitch_disabled === true ||
          params.settings?.allowStitch === false,
        privacy_level: params.privacyLevel,
        title: normalizeTikTokCaption(params.caption),
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: params.videoUrl,
      },
    },
  );

  if (!payload.publish_id) {
    throw new Error("TikTok did not return a publish_id.");
  }

  logger.info("TikTok Direct Post initialized", {
    privacyLevel: params.privacyLevel,
    publishId: payload.publish_id,
  });

  return payload.publish_id;
}

async function waitForTikTokPostStatus(params: {
  accessToken: string;
  publishId: string;
}) {
  const maxPolls = getIntegerEnv(
    "TIKTOK_POST_STATUS_MAX_POLLS",
    DEFAULT_MAX_STATUS_POLLS,
    1,
    90,
  );
  const pollIntervalMs = getIntegerEnv(
    "TIKTOK_POST_STATUS_POLL_INTERVAL_MS",
    DEFAULT_STATUS_POLL_INTERVAL_MS,
    2_000,
    60_000,
  );

  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const status = await fetchTikTokPostStatus(params);

    logger.info("TikTok Direct Post status", {
      attempt,
      publishId: params.publishId,
      status: status.status,
    });

    if (status.status === "PUBLISH_COMPLETE") {
      return status;
    }

    if (status.status === "FAILED") {
      throw new Error(
        `TikTok publishing failed: ${status.fail_reason || "unknown failure"}.`,
      );
    }

    if (attempt < maxPolls) {
      await delay(pollIntervalMs);
    }
  }

  throw new Error("Timed out waiting for TikTok publishing to finish.");
}

async function fetchTikTokPostStatus(params: {
  accessToken: string;
  publishId: string;
}) {
  return postTikTokJson<TikTokPublishStatus>(
    "/v2/post/publish/status/fetch/",
    params.accessToken,
    {
      publish_id: params.publishId,
    },
  );
}

async function postTikTokJson<TData extends object>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<TData> {
  const response = await fetch(buildTikTokUrl(path), {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | TikTokApiEnvelope<TData>
    | null;

  if (!response.ok || !payload || payload.error?.code !== "ok") {
    throw new Error(
      `TikTok API request failed: ${getTikTokErrorMessage(payload, response.status)}`,
    );
  }

  if (!payload.data) {
    throw new Error("TikTok API response did not include data.");
  }

  return payload.data;
}

function buildTikTokUrl(path: string) {
  const baseUrl =
    process.env.TIKTOK_API_BASE_URL?.trim() ||
    "https://open.tiktokapis.com";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(normalizedPath, baseUrl);
}

function getPrivacyLevel(
  privacyOptions: string[] | undefined,
  settings: TikTokTargetPublishSettings | undefined,
) {
  const requestedPrivacy = settings?.privacyLevel;

  if (requestedPrivacy) {
    if (!privacyOptions?.includes(requestedPrivacy)) {
      throw new Error(
        "The selected TikTok visibility is no longer available.",
      );
    }

    if (settings.brandedContent && requestedPrivacy === "SELF_ONLY") {
      throw new Error(
        "TikTok paid partnerships cannot use Only me visibility.",
      );
    }

    return requestedPrivacy;
  }

  const preferences = [
    process.env.TIKTOK_DEFAULT_PRIVACY_LEVEL?.trim() ?? "SELF_ONLY",
    ...defaultPrivacyPreference,
  ];
  const privacyLevel = preferences.find((entry) =>
    privacyOptions?.includes(entry),
  );

  if (!privacyLevel) {
    throw new Error("TikTok privacy options do not include SELF_ONLY.");
  }

  return privacyLevel;
}

function normalizeTikTokCaption(value: string) {
  return value.trim().slice(0, 2_200);
}

function getTikTokErrorMessage(
  payload: TikTokApiEnvelope<object> | null,
  status: number,
) {
  const error = payload?.error;

  return [
    `HTTP ${status}`,
    error?.code ? `code ${error.code}` : null,
    error?.message || "Unknown TikTok error",
    error?.log_id ? `log ${error.log_id}` : null,
  ]
    .filter(Boolean)
    .join(" - ");
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
