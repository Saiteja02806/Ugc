import { logger } from "../logger.js";

const DEFAULT_MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const DEFAULT_VIDEO_CATEGORY_ID = "22";
const DEFAULT_VIDEO_TITLE = "UGC Pilot Short";
const YOUTUBE_WATCH_BASE_URL = "https://www.youtube.com/watch";

export type YouTubePublishResult = {
  videoId: string;
  videoUrl: string;
};

type DownloadedVideo = {
  bytes: Buffer;
  contentType: string;
};

type GoogleApiErrorPayload = {
  error?: {
    code?: number | string;
    errors?: Array<{
      domain?: string;
      message?: string;
      reason?: string;
    }>;
    message?: string;
  };
};

type YouTubeVideoResource = {
  id?: string;
};

export async function publishYouTubeVideo(params: {
  accessToken: string;
  caption: string;
  mimeType: string;
  title: string;
  videoUrl: string;
}): Promise<YouTubePublishResult> {
  const video = await downloadVideoForYouTube({
    mimeType: params.mimeType,
    videoUrl: params.videoUrl,
  });
  const uploadUrl = await createYouTubeUploadSession({
    accessToken: params.accessToken,
    caption: params.caption,
    contentLength: video.bytes.byteLength,
    contentType: video.contentType,
    title: params.title,
  });
  const videoId = await uploadVideoToYouTube({
    accessToken: params.accessToken,
    uploadUrl,
    video,
  });
  const videoUrl = buildYouTubeWatchUrl(videoId);

  logger.info("YouTube video uploaded", {
    privacyStatus: getPrivacyStatus(),
    videoId,
  });

  return {
    videoId,
    videoUrl,
  };
}

async function downloadVideoForYouTube(params: {
  mimeType: string;
  videoUrl: string;
}): Promise<DownloadedVideo> {
  const response = await fetch(params.videoUrl);

  if (!response.ok) {
    throw new Error(
      `YouTube media download failed: HTTP ${response.status}.`,
    );
  }

  const maxBytes = getIntegerEnv(
    "YOUTUBE_MAX_UPLOAD_BYTES",
    DEFAULT_MAX_UPLOAD_BYTES,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const contentLength = getHeaderInteger(
    response.headers.get("content-length"),
  );

  if (contentLength !== null && contentLength > maxBytes) {
    throw new Error(
      `YouTube media download failed: video is larger than ${maxBytes} bytes.`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `YouTube media download failed: video is larger than ${maxBytes} bytes.`,
    );
  }

  return {
    bytes,
    contentType: getVideoContentType(
      params.mimeType,
      response.headers.get("content-type"),
    ),
  };
}

async function createYouTubeUploadSession(params: {
  accessToken: string;
  caption: string;
  contentLength: number;
  contentType: string;
  title: string;
}) {
  const url = buildYouTubeUploadUrl();
  const response = await fetch(url, {
    body: JSON.stringify({
      snippet: {
        categoryId: getVideoCategoryId(),
        description: normalizeDescription(params.caption),
        title: normalizeTitle(params.title, params.caption),
      },
      status: {
        containsSyntheticMedia: getBooleanEnv(
          "YOUTUBE_CONTAINS_SYNTHETIC_MEDIA",
          true,
        ),
        privacyStatus: getPrivacyStatus(),
        selfDeclaredMadeForKids: false,
      },
    }),
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(params.contentLength),
      "X-Upload-Content-Type": params.contentType,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `YouTube API request failed: ${await getGoogleErrorMessage(response)}`,
    );
  }

  const uploadUrl = response.headers.get("location");

  if (!uploadUrl) {
    throw new Error("YouTube did not return a resumable upload URL.");
  }

  return uploadUrl;
}

async function uploadVideoToYouTube(params: {
  accessToken: string;
  uploadUrl: string;
  video: DownloadedVideo;
}) {
  const response = await fetch(params.uploadUrl, {
    body: toArrayBuffer(params.video.bytes),
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Length": String(params.video.bytes.byteLength),
      "Content-Type": params.video.contentType,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(
      `YouTube API request failed: ${await getGoogleErrorMessage(response)}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | YouTubeVideoResource
    | null;

  if (!payload?.id) {
    throw new Error("YouTube did not return an uploaded video id.");
  }

  return payload.id;
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function buildYouTubeUploadUrl() {
  const baseUrl =
    process.env.YOUTUBE_UPLOAD_API_BASE_URL?.trim() ||
    "https://www.googleapis.com";
  const url = new URL("/upload/youtube/v3/videos", baseUrl);

  url.searchParams.set("part", "snippet,status");
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set(
    "notifySubscribers",
    String(getBooleanEnv("YOUTUBE_NOTIFY_SUBSCRIBERS", false)),
  );

  return url;
}

function buildYouTubeWatchUrl(videoId: string) {
  const url = new URL(YOUTUBE_WATCH_BASE_URL);

  url.searchParams.set("v", videoId);

  return url.toString();
}

function getVideoContentType(sourceMimeType: string, responseMimeType: string | null) {
  const candidate = [sourceMimeType, responseMimeType]
    .map((value) => value?.split(";")[0]?.trim().toLowerCase())
    .find((value) => value?.startsWith("video/"));

  return candidate || "video/mp4";
}

function getPrivacyStatus() {
  const value = process.env.YOUTUBE_PRIVACY_STATUS?.trim().toLowerCase();

  return value === "public" || value === "unlisted" || value === "private"
    ? value
    : "private";
}

function getVideoCategoryId() {
  return (
    process.env.YOUTUBE_DEFAULT_CATEGORY_ID?.trim() ||
    DEFAULT_VIDEO_CATEGORY_ID
  );
}

function normalizeTitle(title: string, caption: string) {
  const cleanedTitle = normalizeWhitespace(title);
  const firstCaptionLine = normalizeWhitespace(caption.split(/\r?\n/)[0] ?? "");
  const value = cleanedTitle || firstCaptionLine || DEFAULT_VIDEO_TITLE;

  return value.slice(0, 100);
}

function normalizeDescription(caption: string) {
  return caption.trim().slice(0, 5000);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function getGoogleErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  const payload = parseJson(text);
  const firstError = payload?.error?.errors?.[0];

  return [
    `HTTP ${response.status}`,
    payload?.error?.code ? `code ${payload.error.code}` : null,
    firstError?.reason ? `reason ${firstError.reason}` : null,
    payload?.error?.message || firstError?.message || text || "Unknown Google error",
  ]
    .filter(Boolean)
    .join(" - ");
}

function parseJson(text: string): GoogleApiErrorPayload | null {
  try {
    return JSON.parse(text) as GoogleApiErrorPayload;
  } catch {
    return null;
  }
}

function getHeaderInteger(value: string | null) {
  const parsed = value ? Number(value) : NaN;

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function getBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  return fallback;
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
