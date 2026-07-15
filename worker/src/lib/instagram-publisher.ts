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
    error_subcode?: number;
    message?: string;
    type?: string;
  };
};

export async function publishInstagramReel(params: {
  accessToken: string;
  caption: string;
  containerId?: string | null;
  instagramAccountId: string;
  onContainerCreated?: (containerId: string) => Promise<void>;
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
  videoUrl: string;
}) {
  const payload = await postInstagramForm<{ id?: string }>(
    `/${params.instagramAccountId}/media`,
    {
      access_token: params.accessToken,
      caption: params.caption,
      media_type: "REELS",
      share_to_feed: "true",
      video_url: params.videoUrl,
    },
  );

  if (!payload.id) {
    throw new Error("Instagram did not return a media container id.");
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
      throw new Error(
        `Instagram media container failed with status ${status.statusCode}.`,
      );
    }

    if (attempt < maxPolls) {
      await delay(pollIntervalMs);
    }
  }

  throw new Error("Timed out waiting for Instagram media container.");
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
    throw new Error("Instagram did not return a published media id.");
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

  if (!response.ok || !payload) {
    throw new Error(
      `Instagram API request failed: ${getInstagramErrorMessage(payload, response.status)}`,
    );
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

  if (!response.ok || !payload) {
    throw new Error(
      `Instagram API request failed: ${getInstagramErrorMessage(payload, response.status)}`,
    );
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

function getInstagramErrorMessage(
  payload: InstagramApiResponse | null,
  status: number,
) {
  const message = payload?.error?.message;
  const type = payload?.error?.type;
  const code = payload?.error?.code;

  return [
    `HTTP ${status}`,
    type ? `type ${type}` : null,
    code ? `code ${code}` : null,
    message || "Unknown Instagram error",
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
