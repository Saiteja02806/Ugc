import { setTimeout as delay } from "node:timers/promises";

import { logger } from "../logger.js";

const DEFAULT_MAX_STATUS_POLLS = 12;
const DEFAULT_STATUS_POLL_INTERVAL_MS = 10_000;

export type InstagramPublishResult = {
  mediaId: string;
  permalink: string | null;
};

type InstagramApiResponse = {
  error?: {
    code?: number;
    error_user_msg?: string;
    error_user_title?: string;
    error_subcode?: number;
    fbtrace_id?: string;
    is_transient?: boolean;
    message?: string;
    type?: string;
  };
};

type InstagramPublishErrorOptions = {
  actionRequired: boolean;
  code: string;
  message: string;
  providerCode?: number | null;
  providerSubcode?: number | null;
  retryable: boolean;
  retryAfterSeconds?: number | null;
  status?: number | null;
  traceId?: string | null;
  userMessage: string;
};

export class InstagramPublishError extends Error {
  public readonly actionRequired: boolean;
  public readonly code: string;
  public readonly providerCode: number | null;
  public readonly providerSubcode: number | null;
  public readonly retryable: boolean;
  public readonly retryAfterSeconds: number | null;
  public readonly status: number | null;
  public readonly traceId: string | null;
  public readonly userMessage: string;

  constructor(options: InstagramPublishErrorOptions) {
    super(options.message);
    this.name = "InstagramPublishError";
    this.actionRequired = options.actionRequired;
    this.code = options.code;
    this.providerCode = options.providerCode ?? null;
    this.providerSubcode = options.providerSubcode ?? null;
    this.retryable = options.retryable;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.status = options.status ?? null;
    this.traceId = options.traceId ?? null;
    this.userMessage = options.userMessage;
  }
}

export async function publishInstagramReel(params: {
  accessToken: string;
  caption: string;
  containerId?: string | null;
  instagramAccountId: string;
  onContainerCreated?: (containerId: string) => Promise<void>;
  shareToFeed?: boolean;
  videoUrl: string;
}): Promise<InstagramPublishResult> {
  const containerId =
    params.containerId ?? (await createInstagramReelContainer(params)).id;

  if (!params.containerId) {
    await params.onContainerCreated?.(containerId);
  }

  await waitForInstagramContainer({
    accessToken: params.accessToken,
    containerId,
  });

  const mediaId = await publishInstagramContainer({
    accessToken: params.accessToken,
    containerId,
    instagramAccountId: params.instagramAccountId,
  });
  const permalink = await getInstagramMediaPermalink({
    accessToken: params.accessToken,
    mediaId,
  });

  return {
    mediaId,
    permalink,
  };
}

async function createInstagramReelContainer(params: {
  accessToken: string;
  caption: string;
  instagramAccountId: string;
  shareToFeed?: boolean;
  videoUrl: string;
}) {
  const payload = await postInstagramForm<{ id?: string }>(
    `/${params.instagramAccountId}/media`,
    {
      access_token: params.accessToken,
      caption: params.caption,
      media_type: "REELS",
      share_to_feed: String(params.shareToFeed ?? true),
      video_url: params.videoUrl,
    },
  );

  if (!payload.id) {
    throw createInstagramPublishError({
      code: "invalid_provider_response",
      message: "Instagram did not return a media container id.",
      userMessage: "Instagram could not prepare this video. Try again.",
    });
  }

  logger.info("Instagram Reel container created", {
    containerId: payload.id,
    instagramAccountId: params.instagramAccountId,
  });

  return {
    id: payload.id,
  };
}

async function waitForInstagramContainer(params: {
  accessToken: string;
  containerId: string;
}) {
  const maxPolls = getIntegerEnv(
    "INSTAGRAM_CONTAINER_MAX_POLLS",
    DEFAULT_MAX_STATUS_POLLS,
    1,
    60,
  );
  const pollIntervalMs = getIntegerEnv(
    "INSTAGRAM_CONTAINER_POLL_INTERVAL_MS",
    DEFAULT_STATUS_POLL_INTERVAL_MS,
    1_000,
    60_000,
  );

  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const status = await getInstagramContainerStatus(params);

    logger.info("Instagram Reel container status", {
      attempt,
      containerId: params.containerId,
      status: status.status,
      statusCode: status.statusCode,
    });

    if (status.statusCode === "FINISHED") {
      return;
    }

    if (status.statusCode === "ERROR" || status.statusCode === "EXPIRED") {
      throw createInstagramPublishError({
        code: "media_processing_failed",
        message: `Instagram media container failed with status ${status.statusCode}.`,
        userMessage:
          "Instagram could not process this video. Check that it meets Reel requirements, then try again.",
      });
    }

    if (attempt < maxPolls) {
      await delay(pollIntervalMs);
    }
  }

  throw createInstagramPublishError({
    code: "media_processing_timeout",
    message: "Timed out waiting for Instagram media container.",
    retryable: true,
    userMessage:
      "Instagram is still processing this video. We will retry automatically.",
  });
}

async function getInstagramContainerStatus(params: {
  accessToken: string;
  containerId: string;
}) {
  const payload = await getInstagramJson<{
    status?: string;
    status_code?: string;
  }>(`/${params.containerId}`, {
    access_token: params.accessToken,
    fields: "status,status_code",
  });

  return {
    status: payload.status ?? null,
    statusCode: payload.status_code ?? null,
  };
}

async function publishInstagramContainer(params: {
  accessToken: string;
  containerId: string;
  instagramAccountId: string;
}) {
  const payload = await postInstagramForm<{ id?: string }>(
    `/${params.instagramAccountId}/media_publish`,
    {
      access_token: params.accessToken,
      creation_id: params.containerId,
    },
  );

  if (!payload.id) {
    throw createInstagramPublishError({
      code: "invalid_provider_response",
      message: "Instagram did not return a published media id.",
      userMessage: "Instagram could not finish publishing this video. Try again.",
    });
  }

  return payload.id;
}

async function getInstagramMediaPermalink(params: {
  accessToken: string;
  mediaId: string;
}) {
  try {
    const payload = await getInstagramJson<{ permalink?: string }>(
      `/${params.mediaId}`,
      {
        access_token: params.accessToken,
        fields: "permalink",
      },
    );

    return payload.permalink ?? null;
  } catch (error) {
    logger.warn("Could not load Instagram media permalink", {
      error: error instanceof Error ? error.message : "Unknown error",
      mediaId: params.mediaId,
    });
    return null;
  }
}

async function postInstagramForm<TResponse extends object>(
  path: string,
  params: Record<string, string>,
): Promise<TResponse> {
  const response = await fetch(buildInstagramUrl(path), {
    body: new URLSearchParams(params),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | TResponse
    | null;

  if (!response.ok || !payload || getInstagramApiError(payload)) {
    throw getInstagramPublishError(payload, response);
  }

  return payload;
}

async function getInstagramJson<TResponse extends object>(
  path: string,
  params: Record<string, string>,
): Promise<TResponse> {
  const url = buildInstagramUrl(path);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const payload = (await response.json().catch(() => null)) as
    | TResponse
    | null;

  if (!response.ok || !payload || getInstagramApiError(payload)) {
    throw getInstagramPublishError(payload, response);
  }

  return payload;
}

function buildInstagramUrl(path: string) {
  const baseUrl =
    process.env.INSTAGRAM_GRAPH_API_BASE_URL?.trim() ||
    "https://graph.instagram.com";
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(`${version ? `/${version}` : ""}${normalizedPath}`, baseUrl);
}

function getInstagramPublishError(
  payload: object | null,
  response: Response,
) {
  const providerError = getInstagramApiError(payload);
  const providerCode = providerError?.code ?? null;
  const providerSubcode = providerError?.error_subcode ?? null;
  const providerMessage =
    providerError?.message || "Instagram returned an invalid response.";
  const normalizedMessage = providerMessage.toLowerCase();
  const normalizedType = providerError?.type?.toLowerCase() ?? "";
  const rateLimited =
    response.status === 429 ||
    [4, 17, 32, 613].includes(providerCode ?? -1);
  const accessTokenInvalid =
    response.status === 401 ||
    providerCode === 190 ||
    normalizedMessage.includes("access token") &&
      (normalizedMessage.includes("invalid") ||
        normalizedMessage.includes("expired")) ||
    normalizedType === "oauthexception" && providerCode === 190;
  const permissionMissing =
    !accessTokenInvalid &&
    (providerCode === 10 ||
      providerCode === 200 ||
      response.status === 403 ||
      normalizedMessage.includes("permission"));
  const transient =
    providerError?.is_transient === true ||
    [408, 409, 425].includes(response.status) ||
    response.status >= 500;

  let code = "api_request_failed";
  let actionRequired = false;
  let retryable = false;
  let userMessage = "Instagram could not publish this video. Try again.";

  if (accessTokenInvalid) {
    code = "access_token_invalid";
    actionRequired = true;
    userMessage = "Reconnect Instagram to continue publishing.";
  } else if (permissionMissing) {
    code = "permission_missing";
    actionRequired = true;
    userMessage = "Reconnect Instagram to allow video publishing.";
  } else if (rateLimited) {
    code = "rate_limited";
    retryable = true;
    userMessage =
      "Instagram is temporarily limiting publishing. We will retry automatically.";
  } else if (transient) {
    code = "provider_unavailable";
    retryable = true;
    userMessage =
      "Instagram is temporarily unavailable. We will retry automatically.";
  } else if (response.status === 400 || providerCode === 100) {
    code = "invalid_media";
    userMessage =
      "Instagram could not accept this video. Check that it meets Reel requirements, then try again.";
  }

  return new InstagramPublishError({
    actionRequired,
    code,
    message: [
      `Instagram API request failed: HTTP ${response.status}`,
      providerError?.type ? `type ${providerError.type}` : null,
      providerCode !== null ? `code ${providerCode}` : null,
      providerSubcode !== null ? `subcode ${providerSubcode}` : null,
      providerMessage,
    ]
      .filter(Boolean)
      .join(" - "),
    providerCode,
    providerSubcode,
    retryable,
    retryAfterSeconds: getRetryAfterSeconds(response.headers.get("retry-after")),
    status: response.status,
    traceId: providerError?.fbtrace_id ?? null,
    userMessage,
  });
}

export async function publishInstagramCarousel(params: {
  accessToken: string;
  caption: string;
  containerId?: string | null;
  imageUrls: string[];
  instagramAccountId: string;
  onContainerCreated?: (containerId: string) => Promise<void>;
}): Promise<InstagramPublishResult> {
  if (params.imageUrls.length < 2 || params.imageUrls.length > 10) {
    throw createInstagramPublishError({
      code: "invalid_media",
      message: "Instagram carousel publishing requires 2 to 10 images.",
      userMessage: "Instagram carousels require between 2 and 10 slides.",
    });
  }

  const containerId =
    params.containerId ?? (await createInstagramCarouselContainer(params));

  if (!params.containerId) {
    await params.onContainerCreated?.(containerId);
  }

  await waitForInstagramContainer({
    accessToken: params.accessToken,
    containerId,
  });

  const mediaId = await publishInstagramContainer({
    accessToken: params.accessToken,
    containerId,
    instagramAccountId: params.instagramAccountId,
  });
  const permalink = await getInstagramMediaPermalink({
    accessToken: params.accessToken,
    mediaId,
  });

  return { mediaId, permalink };
}

async function createInstagramCarouselContainer(params: {
  accessToken: string;
  caption: string;
  imageUrls: string[];
  instagramAccountId: string;
}) {
  const childIds: string[] = [];

  for (const imageUrl of params.imageUrls) {
    const child = await postInstagramForm<{ id?: string }>(
      `/${params.instagramAccountId}/media`,
      {
        access_token: params.accessToken,
        image_url: imageUrl,
        is_carousel_item: "true",
      },
    );

    if (!child.id) {
      throw createInstagramPublishError({
        code: "invalid_provider_response",
        message: "Instagram did not return a carousel child container id.",
        userMessage: "Instagram could not prepare one of the carousel slides.",
      });
    }

    await waitForInstagramContainer({
      accessToken: params.accessToken,
      containerId: child.id,
    });
    childIds.push(child.id);
  }

  const parent = await postInstagramForm<{ id?: string }>(
    `/${params.instagramAccountId}/media`,
    {
      access_token: params.accessToken,
      caption: params.caption,
      children: childIds.join(","),
      media_type: "CAROUSEL",
    },
  );

  if (!parent.id) {
    throw createInstagramPublishError({
      code: "invalid_provider_response",
      message: "Instagram did not return a carousel container id.",
      userMessage: "Instagram could not prepare this carousel. Try again.",
    });
  }

  logger.info("Instagram carousel container created", {
    childCount: childIds.length,
    containerId: parent.id,
    instagramAccountId: params.instagramAccountId,
  });

  return parent.id;
}

function getInstagramApiError(payload: object | null) {
  if (!payload || !("error" in payload)) {
    return null;
  }

  const error = (payload as InstagramApiResponse).error;

  return error && typeof error === "object" ? error : null;
}

function createInstagramPublishError(
  options: Pick<
    InstagramPublishErrorOptions,
    "code" | "message" | "userMessage"
  > &
    Partial<InstagramPublishErrorOptions>,
) {
  return new InstagramPublishError({
    actionRequired: options.actionRequired ?? false,
    code: options.code,
    message: options.message,
    providerCode: options.providerCode,
    providerSubcode: options.providerSubcode,
    retryable: options.retryable ?? false,
    retryAfterSeconds: options.retryAfterSeconds,
    status: options.status,
    traceId: options.traceId,
    userMessage: options.userMessage,
  });
}

function getRetryAfterSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const retryAt = Date.parse(value);

  return Number.isFinite(retryAt)
    ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000))
    : null;
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
