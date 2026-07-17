import { setTimeout as delay } from "node:timers/promises";

import { logger } from "../logger.js";
import type { TikTokTargetPublishSettings } from "./social-publish-settings.js";

const DEFAULT_MAX_STATUS_POLLS = 18;
const DEFAULT_STATUS_POLL_INTERVAL_MS = 10_000;
const DEFAULT_STATUS_POLL_MAX_INTERVAL_MS = 30_000;
const DEFAULT_MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const DEFAULT_UPLOAD_RETRIES = 3;
const MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const MAX_FINAL_CHUNK_BYTES = 128 * 1024 * 1024;

type TikTokMediaTransferMode = "FILE_UPLOAD" | "PULL_FROM_URL";

export type TikTokPublishInitialization = {
  creatorNickname: string | null;
  creatorUsername: string | null;
  logId: string | null;
  mediaTransferMode: TikTokMediaTransferMode;
  publishId: string;
  uploadUrl: string | null;
};

export type TikTokPublishResult = {
  platformPostId: string;
  platformPostUrl: null;
  publishId: string;
};

export type TikTokPhotoPublishInitialization = {
  creatorNickname: string | null;
  creatorUsername: string | null;
  logId: string | null;
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
  creator_nickname?: string;
  creator_username?: string;
  duet_disabled?: boolean;
  max_video_post_duration_sec?: number;
  privacy_level_options?: string[];
  stitch_disabled?: boolean;
};

type TikTokPublishStatus = {
  downloaded_bytes?: number;
  fail_reason?: string;
  publicaly_available_post_id?: Array<number | string>;
  request_log_id?: string | null;
  status?: string;
  uploaded_bytes?: number;
};

type DownloadedTikTokVideo = {
  bytes: Buffer;
  contentType: string;
};

type TikTokUploadRange = {
  end: number;
  start: number;
};

export class TikTokPublishError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly logId: string | null,
    public readonly status: number | null,
    public readonly actionRequired: boolean,
  ) {
    super(message);
    this.name = "TikTokPublishError";
  }
}

export async function publishTikTokVideo(params: {
  accessToken: string;
  caption: string;
  onPublishInitialized?: (
    initialization: TikTokPublishInitialization,
  ) => Promise<void>;
  publishId?: string | null;
  settings?: TikTokTargetPublishSettings;
  uploadUrl?: string | null;
  videoDurationSeconds?: number | null;
  videoMimeType?: string | null;
  videoUrl: string;
}): Promise<TikTokPublishResult> {
  let publishId = params.publishId ?? null;
  let uploadUrl = params.uploadUrl ?? null;
  let video: DownloadedTikTokVideo | null = null;
  let initializedNow = false;
  const creatorInfo = await queryCreatorInfo(params.accessToken);
  const privacyLevel = getPrivacyLevel(
    creatorInfo.privacy_level_options,
    params.settings,
  );
  validateVideoDuration(
    params.videoDurationSeconds,
    creatorInfo.max_video_post_duration_sec,
  );

  if (!publishId) {
    const mediaTransferMode = getMediaTransferMode();

    if (mediaTransferMode === "FILE_UPLOAD") {
      video = await downloadTikTokVideo({
        sourceMimeType: params.videoMimeType,
        videoUrl: params.videoUrl,
      });
    } else {
      assertVerifiedPullUrl(params.videoUrl);
    }

    const initialization = await initializeDirectPost({
      accessToken: params.accessToken,
      caption: params.caption,
      creatorInfo,
      mediaTransferMode,
      privacyLevel,
      settings: params.settings,
      videoSize: video?.bytes.byteLength ?? null,
      videoUrl: params.videoUrl,
    });
    publishId = initialization.publishId;
    uploadUrl = initialization.uploadUrl;
    await params.onPublishInitialized?.(initialization);
    initializedNow = true;
  }

  if (uploadUrl) {
    video ??= await downloadTikTokVideo({
      sourceMimeType: params.videoMimeType,
      videoUrl: params.videoUrl,
    });
    let uploadedBytes = 0;

    if (!initializedNow) {
      const currentStatus = await fetchTikTokPostStatus({
        accessToken: params.accessToken,
        publishId,
      });
      const completed = getCompletedTikTokResult(currentStatus, publishId);

      if (completed) {
        return completed;
      }

      assertTikTokStatusDidNotFail(currentStatus);
      uploadedBytes = normalizeUploadedBytes(
        currentStatus.uploaded_bytes,
        video.bytes.byteLength,
      );
    }

    if (uploadedBytes < video.bytes.byteLength) {
      await uploadTikTokVideo({
        bytes: video.bytes,
        contentType: video.contentType,
        startByte: uploadedBytes,
        uploadUrl,
      });
    }
  }

  const finalStatus = await waitForTikTokPostStatus({
    accessToken: params.accessToken,
    publishId,
  });

  return buildTikTokPublishResult(finalStatus, publishId);
}

export async function publishTikTokPhotoCarousel(params: {
  accessToken: string;
  caption: string;
  imageUrls: string[];
  onPublishInitialized?: (
    initialization: TikTokPhotoPublishInitialization,
  ) => Promise<void>;
  publishId?: string | null;
  settings?: TikTokTargetPublishSettings;
}): Promise<TikTokPublishResult> {
  if (params.imageUrls.length < 2 || params.imageUrls.length > 35) {
    throw new TikTokPublishError(
      "TikTok photo posts require between 2 and 35 images.",
      "invalid_photo_count",
      null,
      400,
      false,
    );
  }

  const creatorInfo = await queryCreatorInfo(params.accessToken);
  const privacyLevel = getPrivacyLevel(
    creatorInfo.privacy_level_options,
    params.settings,
  );
  let publishId = params.publishId ?? null;

  if (!publishId) {
    for (const imageUrl of params.imageUrls) {
      assertVerifiedPullUrl(imageUrl);
    }

    const response = await requestTikTokJson<{ publish_id?: string }>(
      "/v2/post/publish/content/init/",
      params.accessToken,
      {
        media_type: "PHOTO",
        post_info: {
          auto_add_music: true,
          brand_content_toggle: params.settings?.brandedContent === true,
          brand_organic_toggle: params.settings?.brandOrganic === true,
          description: normalizeTikTokCaption(params.caption),
          disable_comment:
            creatorInfo.comment_disabled === true ||
            params.settings?.allowComment === false,
          privacy_level: privacyLevel,
          title: normalizeTikTokCaption(params.caption).slice(0, 90),
        },
        post_mode: "DIRECT_POST",
        source_info: {
          photo_cover_index: 0,
          photo_images: params.imageUrls,
          source: "PULL_FROM_URL",
        },
      },
    );

    if (!response.data.publish_id) {
      throw new TikTokPublishError(
        "TikTok did not return a publish_id for the photo post.",
        "publish_id_missing",
        response.logId,
        null,
        false,
      );
    }

    publishId = response.data.publish_id;
    await params.onPublishInitialized?.({
      creatorNickname: creatorInfo.creator_nickname ?? null,
      creatorUsername: creatorInfo.creator_username ?? null,
      logId: response.logId,
      publishId,
    });
  }

  const finalStatus = await waitForTikTokPostStatus({
    accessToken: params.accessToken,
    publishId,
  });

  return buildTikTokPublishResult(finalStatus, publishId);
}

async function queryCreatorInfo(accessToken: string) {
  const payload = await postTikTokJson<TikTokCreatorInfo>(
    "/v2/post/publish/creator_info/query/",
    accessToken,
    {},
  );

  if (!payload.privacy_level_options?.length) {
    throw new TikTokPublishError(
      "TikTok creator info did not include privacy options.",
      "privacy_level_option_mismatch",
      null,
      null,
      true,
    );
  }

  return payload;
}

async function initializeDirectPost(params: {
  accessToken: string;
  caption: string;
  creatorInfo: TikTokCreatorInfo;
  mediaTransferMode: TikTokMediaTransferMode;
  privacyLevel: string;
  settings?: TikTokTargetPublishSettings;
  videoSize: number | null;
  videoUrl: string;
}): Promise<TikTokPublishInitialization> {
  const sourceInfo =
    params.mediaTransferMode === "FILE_UPLOAD"
      ? getFileUploadSourceInfo(params.videoSize)
      : {
          source: "PULL_FROM_URL",
          video_url: params.videoUrl,
        };
  const response = await requestTikTokJson<{
    publish_id?: string;
    upload_url?: string;
  }>("/v2/post/publish/video/init/", params.accessToken, {
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
      is_aigc: params.settings?.containsSyntheticMedia !== false,
      privacy_level: params.privacyLevel,
      title: normalizeTikTokCaption(params.caption),
    },
    source_info: sourceInfo,
  });
  const payload = response.data;

  if (!payload.publish_id) {
    throw new TikTokPublishError(
      "TikTok did not return a publish_id.",
      "publish_id_missing",
      null,
      null,
      false,
    );
  }

  if (params.mediaTransferMode === "FILE_UPLOAD" && !payload.upload_url) {
    throw new TikTokPublishError(
      "TikTok did not return an upload URL.",
      "upload_url_missing",
      null,
      null,
      false,
    );
  }

  logger.info("TikTok Direct Post initialized", {
    mediaTransferMode: params.mediaTransferMode,
    privacyLevel: params.privacyLevel,
    publishId: payload.publish_id,
  });

  return {
    creatorNickname: params.creatorInfo.creator_nickname ?? null,
    creatorUsername: params.creatorInfo.creator_username ?? null,
    logId: response.logId,
    mediaTransferMode: params.mediaTransferMode,
    publishId: payload.publish_id,
    uploadUrl: payload.upload_url ?? null,
  };
}

async function downloadTikTokVideo(params: {
  sourceMimeType?: string | null;
  videoUrl: string;
}): Promise<DownloadedTikTokVideo> {
  const response = await fetch(params.videoUrl);

  if (!response.ok) {
    throw new Error(`TikTok media download failed: HTTP ${response.status}.`);
  }

  const maxBytes = getIntegerEnv(
    "TIKTOK_MAX_UPLOAD_BYTES",
    DEFAULT_MAX_UPLOAD_BYTES,
    1,
    4 * 1024 * 1024 * 1024,
  );
  const contentLength = getHeaderInteger(response.headers.get("content-length"));

  if (contentLength !== null && contentLength > maxBytes) {
    throw new Error(
      `TikTok media download failed: video is larger than ${maxBytes} bytes.`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new Error("TikTok media download failed: video is empty.");
  }

  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `TikTok media download failed: video is larger than ${maxBytes} bytes.`,
    );
  }

  return {
    bytes,
    contentType: getVideoContentType(
      params.sourceMimeType,
      response.headers.get("content-type"),
    ),
  };
}

async function uploadTikTokVideo(params: {
  bytes: Buffer;
  contentType: string;
  startByte: number;
  uploadUrl: string;
}) {
  const plan = getTikTokChunkPlan(params.bytes.byteLength);
  const firstRangeIndex = getResumeRangeIndex(plan.ranges, params.startByte);

  for (let index = firstRangeIndex; index < plan.ranges.length; index += 1) {
    const range = plan.ranges[index];
    const chunk = params.bytes.subarray(range.start, range.end + 1);

    await uploadTikTokChunk({
      chunk,
      contentType: params.contentType,
      range,
      totalBytes: params.bytes.byteLength,
      uploadUrl: params.uploadUrl,
    });
  }
}

async function uploadTikTokChunk(params: {
  chunk: Buffer;
  contentType: string;
  range: TikTokUploadRange;
  totalBytes: number;
  uploadUrl: string;
}) {
  const maxAttempts = getIntegerEnv(
    "TIKTOK_UPLOAD_MAX_ATTEMPTS",
    DEFAULT_UPLOAD_RETRIES,
    1,
    8,
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(params.uploadUrl, {
        body: toArrayBuffer(params.chunk),
        headers: {
          "Content-Length": String(params.chunk.byteLength),
          "Content-Range": `bytes ${params.range.start}-${params.range.end}/${params.totalBytes}`,
          "Content-Type": params.contentType,
        },
        method: "PUT",
      });

      if (response.ok) {
        return;
      }

      if (!isRetryableHttpStatus(response.status) || attempt === maxAttempts) {
        throw new TikTokPublishError(
          `TikTok video upload failed: HTTP ${response.status}.`,
          response.status === 403 ? "upload_url_expired" : "media_upload_failed",
          null,
          response.status,
          response.status === 403,
        );
      }
    } catch (error) {
      if (error instanceof TikTokPublishError || attempt === maxAttempts) {
        throw error;
      }
    }

    await delay(Math.min(1_000 * 2 ** (attempt - 1), 8_000));
  }
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
  const basePollIntervalMs = getIntegerEnv(
    "TIKTOK_POST_STATUS_POLL_INTERVAL_MS",
    DEFAULT_STATUS_POLL_INTERVAL_MS,
    2_000,
    60_000,
  );
  const maxPollIntervalMs = getIntegerEnv(
    "TIKTOK_POST_STATUS_MAX_POLL_INTERVAL_MS",
    DEFAULT_STATUS_POLL_MAX_INTERVAL_MS,
    basePollIntervalMs,
    120_000,
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

    assertTikTokStatusDidNotFail(status);

    if (attempt < maxPolls) {
      const pollIntervalMs = Math.min(
        basePollIntervalMs * 2 ** Math.floor((attempt - 1) / 3),
        maxPollIntervalMs,
      );
      await delay(pollIntervalMs);
    }
  }

  throw new Error("Timed out waiting for TikTok publishing to finish.");
}

async function fetchTikTokPostStatus(params: {
  accessToken: string;
  publishId: string;
}) {
  const response = await requestTikTokJson<TikTokPublishStatus>(
    "/v2/post/publish/status/fetch/",
    params.accessToken,
    {
      publish_id: params.publishId,
    },
  );

  return {
    ...response.data,
    request_log_id: response.logId,
  };
}

async function postTikTokJson<TData extends object>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<TData> {
  return (await requestTikTokJson<TData>(path, accessToken, body)).data;
}

async function requestTikTokJson<TData extends object>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
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
    const code = payload?.error?.code || `http_${response.status}`;

    throw new TikTokPublishError(
      `TikTok API request failed: ${getTikTokErrorMessage(payload, response.status)}`,
      code,
      payload?.error?.log_id ?? null,
      response.status,
      isTikTokActionRequiredError(code),
    );
  }

  if (!payload.data) {
    throw new TikTokPublishError(
      "TikTok API response did not include data.",
      "response_data_missing",
      payload.error?.log_id ?? null,
      response.status,
      false,
    );
  }

  return {
    data: payload.data,
    logId: payload.error?.log_id ?? null,
  };
}

function getFileUploadSourceInfo(videoSize: number | null) {
  if (!videoSize || videoSize <= 0) {
    throw new Error("TikTok FILE_UPLOAD requires a non-empty video.");
  }

  const plan = getTikTokChunkPlan(videoSize);

  return {
    chunk_size: plan.chunkSize,
    source: "FILE_UPLOAD",
    total_chunk_count: plan.ranges.length,
    video_size: videoSize,
  };
}

export function getTikTokChunkPlan(totalBytes: number) {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
    throw new Error("TikTok upload size must be a positive integer.");
  }

  const chunkSize = Math.min(totalBytes, MAX_CHUNK_BYTES);
  const chunkCount = Math.max(1, Math.floor(totalBytes / chunkSize));
  const ranges: TikTokUploadRange[] = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * chunkSize;
    const end = index === chunkCount - 1
      ? totalBytes - 1
      : start + chunkSize - 1;

    if (end - start + 1 > MAX_FINAL_CHUNK_BYTES) {
      throw new Error("TikTok final upload chunk exceeds 128 MB.");
    }

    ranges.push({ end, start });
  }

  return { chunkSize, ranges };
}

function getResumeRangeIndex(ranges: TikTokUploadRange[], startByte: number) {
  if (!Number.isSafeInteger(startByte) || startByte < 0) {
    throw new Error("TikTok returned an invalid uploaded byte count.");
  }

  const index = ranges.findIndex((range) => range.start === startByte);

  if (index >= 0) {
    return index;
  }

  const completedBytes = ranges.at(-1)?.end;

  if (completedBytes !== undefined && startByte === completedBytes + 1) {
    return ranges.length;
  }

  throw new Error("TikTok upload cannot resume from a partial chunk boundary.");
}

function normalizeUploadedBytes(value: number | undefined, totalBytes: number) {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isSafeInteger(value) || value < 0 || value > totalBytes) {
    throw new Error("TikTok returned an invalid uploaded byte count.");
  }

  return value;
}

function getCompletedTikTokResult(
  status: TikTokPublishStatus,
  publishId: string,
) {
  return status.status === "PUBLISH_COMPLETE"
    ? buildTikTokPublishResult(status, publishId)
    : null;
}

function buildTikTokPublishResult(
  status: TikTokPublishStatus,
  publishId: string,
): TikTokPublishResult {
  const publicPostId = status.publicaly_available_post_id?.[0];

  return {
    platformPostId: publicPostId ? String(publicPostId) : publishId,
    platformPostUrl: null,
    publishId,
  };
}

function assertTikTokStatusDidNotFail(status: TikTokPublishStatus) {
  if (status.status !== "FAILED") {
    return;
  }

  const code = status.fail_reason || "tiktok_publish_failed";

  throw new TikTokPublishError(
    `TikTok publishing failed: ${status.fail_reason || "unknown failure"}.`,
    code,
    status.request_log_id ?? null,
    null,
    isTikTokActionRequiredError(code),
  );
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

  if (!requestedPrivacy || !privacyOptions?.includes(requestedPrivacy)) {
    throw new TikTokPublishError(
      "The selected TikTok visibility is no longer available.",
      "privacy_level_option_mismatch",
      null,
      null,
      true,
    );
  }

  if (settings?.brandedContent && requestedPrivacy === "SELF_ONLY") {
    throw new TikTokPublishError(
      "TikTok paid partnerships cannot use Only me visibility.",
      "invalid_branded_content_visibility",
      null,
      null,
      true,
    );
  }

  return requestedPrivacy;
}

function validateVideoDuration(
  durationSeconds: number | null | undefined,
  maxDurationSeconds: number | undefined,
) {
  if (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    typeof maxDurationSeconds === "number" &&
    Number.isFinite(maxDurationSeconds) &&
    durationSeconds > maxDurationSeconds
  ) {
    throw new TikTokPublishError(
      `TikTok allows videos up to ${maxDurationSeconds} seconds for this account.`,
      "video_duration_exceeds_creator_limit",
      null,
      null,
      true,
    );
  }
}

function getMediaTransferMode(): TikTokMediaTransferMode {
  return process.env.TIKTOK_MEDIA_TRANSFER_MODE?.trim().toUpperCase() ===
    "PULL_FROM_URL"
    ? "PULL_FROM_URL"
    : "FILE_UPLOAD";
}

function assertVerifiedPullUrl(videoUrl: string) {
  const host = new URL(videoUrl).hostname.toLowerCase();
  const verifiedHosts = new Set(
    (process.env.TIKTOK_VERIFIED_MEDIA_HOSTS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!verifiedHosts.has(host)) {
    throw new TikTokPublishError(
      `TikTok media host ${host} is not configured as verified.`,
      "url_ownership_unverified",
      null,
      null,
      true,
    );
  }
}

function isTikTokActionRequiredError(code: string) {
  return [
    "access_token_invalid",
    "invalid_branded_content_visibility",
    "privacy_level_option_mismatch",
    "scope_not_authorized",
    "spam_risk_too_many_posts",
    "spam_risk_user_banned_from_posting",
    "spam_risk_text",
    "reached_active_user_cap",
    "unaudited_client_can_only_post_to_private_accounts",
    "upload_url_expired",
    "url_ownership_unverified",
    "video_duration_exceeds_creator_limit",
  ].includes(code);
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

function getVideoContentType(
  sourceMimeType: string | null | undefined,
  responseMimeType: string | null,
) {
  const candidate = [sourceMimeType, responseMimeType]
    .map((value) => value?.split(";")[0]?.trim().toLowerCase())
    .find((value) => value?.startsWith("video/"));

  return candidate || "video/mp4";
}

function getHeaderInteger(value: string | null) {
  const parsedValue = value ? Number(value) : NaN;

  return Number.isSafeInteger(parsedValue) && parsedValue >= 0
    ? parsedValue
    : null;
}

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function getIntegerEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const rawValue = process.env[name]?.trim();
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return Number.isSafeInteger(parsedValue)
    ? Math.min(Math.max(parsedValue, min), max)
    : fallback;
}
