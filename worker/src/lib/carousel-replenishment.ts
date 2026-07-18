import { createHmac } from "node:crypto";

export const CAROUSEL_REPLENISHMENT_PATH =
  "/api/internal/carousels/replenish";
export const CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER =
  "x-ugc-carousel-replenishment-signature";
export const CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER =
  "x-ugc-carousel-replenishment-timestamp";

const DEFAULT_PAGE_SIZE = 5;
const DEFAULT_REQUEST_TIMEOUT_MS = 50_000;
const SIGNATURE_PREFIX = "v1=";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CYCLE_STATUS_OPTIONS = new Set<"active" | "completed">([
  "active",
  "completed",
]);
const RESULT_STATE_OPTIONS = new Set<
  "caught_up" | "exhausted" | "preparing" | "ready"
>(["caught_up", "exhausted", "preparing", "ready"]);

type ReplenishmentResult =
  | {
      ok: true;
      pendingSlotCount: number;
      state: "caught_up" | "exhausted" | "preparing" | "ready";
      userId: string;
    }
  | {
      error: string;
      ok: false;
      userId: string;
    };

type ReplenishmentPageResponse = {
  cycleId: string;
  cycleStatus: "active" | "completed";
  hasMore: boolean;
  nextCursor: string | null;
  ok: true;
  pageCursor: string | null;
  processedCount: number;
  results: ReplenishmentResult[];
};

type Logger = {
  error: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
};

type ReplenishmentEnv = {
  [key: string]: string | undefined;
  APP_BASE_URL?: string;
  CAROUSEL_REPLENISHMENT_CYCLE_ID?: string;
  CAROUSEL_REPLENISHMENT_PAGE_SIZE?: string;
  CAROUSEL_REPLENISHMENT_REQUEST_TIMEOUT_MS?: string;
  UGC_INTERNAL_APP_URL?: string;
  UGC_INTERNAL_CAROUSEL_SECRET?: string;
};

type ReplenishmentConfig = {
  endpoint: URL;
  pageSize: number;
  requestTimeoutMs: number;
  secret: string;
};

type RunReplenishmentOptions = {
  env?: ReplenishmentEnv;
  fetchImpl?: typeof fetch;
  logger?: Logger;
  now?: Date;
};

export type DailyCarouselReplenishmentSummary = {
  cycleId: string;
  failedCount: number;
  pageCount: number;
  processedCount: number;
  requestedCycleId: string;
};

export async function runDailyCarouselReplenishmentSweep(
  options: RunReplenishmentOptions = {},
): Promise<DailyCarouselReplenishmentSummary> {
  const env = options.env ?? process.env;
  const config = getCarouselReplenishmentConfig(env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger ?? console;
  const requestedCycleId =
    getConfiguredCycleId(env) ?? (options.now ?? new Date()).toISOString();
  let activeCycleId: string | null = null;
  let expectedPageCursor: string | null | undefined;
  let failedCount = 0;
  let pageCount = 0;
  let processedCount = 0;

  while (true) {
    const data = await requestReplenishmentPage({
      config,
      fetchImpl,
      requestedCycleId,
    });

    if (activeCycleId && data.cycleId !== activeCycleId) {
      throw new Error(
        "Daily Carousel replenishment changed cycles before completion.",
      );
    }

    if (
      expectedPageCursor !== undefined &&
      data.pageCursor?.toLowerCase() !== expectedPageCursor?.toLowerCase()
    ) {
      throw new Error(
        "Daily Carousel replenishment did not resume from its saved cursor.",
      );
    }

    activeCycleId = data.cycleId;
    const nextCursor = getNextReplenishmentCursor({
      currentCursor: data.pageCursor,
      hasMore: data.hasMore,
      nextCursor: data.nextCursor,
      processedCount: data.processedCount,
    });
    const failedResults = data.results.filter((result) => !result.ok);

    pageCount += 1;
    processedCount += data.processedCount;
    failedCount += failedResults.length;

    logger.info("Daily Carousel replenishment page completed", {
      cycleId: data.cycleId,
      failedCount: failedResults.length,
      nextCursor,
      pageCursor: data.pageCursor,
      processedCount: data.processedCount,
      requestedCycleId,
    });

    for (const result of failedResults) {
      logger.error("Daily Carousel replenishment failed for profile", {
        cycleId: data.cycleId,
        error: result.error,
        userId: result.userId,
      });
    }

    if (!nextCursor) {
      break;
    }

    expectedPageCursor = nextCursor;
  }

  const summary = {
    cycleId: activeCycleId ?? requestedCycleId,
    failedCount,
    pageCount,
    processedCount,
    requestedCycleId,
  };

  logger.info("Daily Carousel replenishment sweep completed", summary);

  return summary;
}

export function createCarouselReplenishmentSignature(params: {
  body: string;
  secret: string;
  timestamp: string;
}) {
  const digest = createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.body}`, "utf8")
    .digest("hex");

  return `${SIGNATURE_PREFIX}${digest}`;
}

export function getCarouselReplenishmentConfig(
  env: ReplenishmentEnv = process.env,
): ReplenishmentConfig {
  const rawBaseUrl =
    env.APP_BASE_URL?.trim() || env.UGC_INTERNAL_APP_URL?.trim();
  const secret = env.UGC_INTERNAL_CAROUSEL_SECRET?.trim() ?? "";

  if (!rawBaseUrl) {
    throw new Error("Missing APP_BASE_URL for Carousel replenishment.");
  }

  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "Set UGC_INTERNAL_CAROUSEL_SECRET to at least 32 random bytes.",
    );
  }

  let endpoint: URL;

  try {
    endpoint = new URL(
      CAROUSEL_REPLENISHMENT_PATH,
      `${rawBaseUrl.replace(/\/+$/, "")}/`,
    );
  } catch {
    throw new Error("APP_BASE_URL must be a valid URL.");
  }

  if (
    endpoint.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(endpoint.hostname)
  ) {
    throw new Error("APP_BASE_URL must use HTTPS.");
  }

  return {
    endpoint,
    pageSize: getIntegerEnvValue(
      env.CAROUSEL_REPLENISHMENT_PAGE_SIZE,
      DEFAULT_PAGE_SIZE,
      { max: 10, min: 1 },
    ),
    requestTimeoutMs: getIntegerEnvValue(
      env.CAROUSEL_REPLENISHMENT_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
      { max: 55_000, min: 1_000 },
    ),
    secret,
  };
}

async function requestReplenishmentPage(params: {
  config: ReplenishmentConfig;
  fetchImpl: typeof fetch;
  requestedCycleId: string;
}) {
  const body = JSON.stringify({
    cycleId: params.requestedCycleId,
    limit: params.config.pageSize,
  });
  const timestamp = Date.now().toString();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    params.config.requestTimeoutMs,
  );

  try {
    const response = await params.fetchImpl(params.config.endpoint, {
      body,
      headers: {
        "Content-Type": "application/json",
        [CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER]:
          createCarouselReplenishmentSignature({
            body,
            secret: params.config.secret,
            timestamp,
          }),
        [CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER]: timestamp,
      },
      method: "POST",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Daily Carousel replenishment endpoint returned HTTP ${response.status}.`,
      );
    }

    return parseReplenishmentPageResponse(data);
  } finally {
    clearTimeout(timeout);
  }
}

function parseReplenishmentPageResponse(value: unknown) {
  if (!isRecord(value) || value.ok !== true) {
    throw new Error("Daily Carousel replenishment returned an invalid response.");
  }

  const response = value as Record<string, unknown>;
  const cycleId = getString(response.cycleId, "cycleId");
  const cycleStatus = getEnum(
    response.cycleStatus,
    "cycleStatus",
    CYCLE_STATUS_OPTIONS,
  );
  const hasMore = getBoolean(response.hasMore, "hasMore");
  const nextCursor = getNullableUuid(response.nextCursor, "nextCursor");
  const pageCursor = getNullableUuid(response.pageCursor, "pageCursor");
  const processedCount = getInteger(response.processedCount, "processedCount", {
    max: 10,
    min: 0,
  });
  const results = getResults(response.results);

  if (!isValidCycleId(cycleId)) {
    throw new Error("Daily Carousel replenishment returned an invalid cycleId.");
  }

  if (processedCount !== results.length) {
    throw new Error(
      "Daily Carousel replenishment processed count did not match results.",
    );
  }

  if (hasMore !== (cycleStatus === "active")) {
    throw new Error(
      "Daily Carousel replenishment cycle status did not match continuation.",
    );
  }

  if (cycleStatus === "active" && (!nextCursor || processedCount === 0)) {
    throw new Error(
      "Daily Carousel replenishment active cycle did not advance.",
    );
  }

  if (cycleStatus === "completed" && nextCursor !== null) {
    throw new Error(
      "Daily Carousel replenishment completed cycle exposed a next cursor.",
    );
  }

  if (
    nextCursor &&
    pageCursor &&
    nextCursor.toLowerCase() <= pageCursor.toLowerCase()
  ) {
    throw new Error("Daily Carousel replenishment cursor did not advance.");
  }

  return {
    cycleId,
    cycleStatus,
    hasMore,
    nextCursor,
    ok: true,
    pageCursor,
    processedCount,
    results,
  } satisfies ReplenishmentPageResponse;
}

function getNextReplenishmentCursor(params: {
  currentCursor: string | null;
  hasMore: boolean;
  nextCursor: string | null;
  processedCount: number;
}) {
  if (!params.hasMore) {
    return null;
  }

  if (!Number.isInteger(params.processedCount) || params.processedCount <= 0) {
    throw new Error(
      "Carousel replenishment page cannot continue without processed profiles.",
    );
  }

  if (
    !params.nextCursor ||
    !UUID_PATTERN.test(params.nextCursor) ||
    (params.currentCursor !== null &&
      (!UUID_PATTERN.test(params.currentCursor) ||
        params.nextCursor.toLowerCase() <= params.currentCursor.toLowerCase()))
  ) {
    throw new Error("Carousel replenishment cursor did not advance.");
  }

  return params.nextCursor;
}

function getResults(value: unknown): ReplenishmentResult[] {
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error("Daily Carousel replenishment returned invalid results.");
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error(
        "Daily Carousel replenishment returned an invalid result.",
      );
    }

    const userId = getString(item.userId, "result.userId");

    if (item.ok === true) {
      return {
        ok: true,
        pendingSlotCount: getInteger(
          item.pendingSlotCount,
          "result.pendingSlotCount",
          { min: 0 },
        ),
        state: getEnum(
          item.state,
          "result.state",
          RESULT_STATE_OPTIONS,
        ),
        userId,
      };
    }

    if (item.ok === false) {
      return {
        error: getString(item.error, "result.error").slice(0, 500),
        ok: false,
        userId,
      };
    }

    throw new Error("Daily Carousel replenishment returned an invalid result.");
  });
}

function getConfiguredCycleId(env: ReplenishmentEnv) {
  const value = env.CAROUSEL_REPLENISHMENT_CYCLE_ID?.trim();

  if (!value) {
    return null;
  }

  if (!isValidCycleId(value)) {
    throw new Error(
      "CAROUSEL_REPLENISHMENT_CYCLE_ID must be a canonical ISO timestamp.",
    );
  }

  return value;
}

function isValidCycleId(value: string) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function getBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Daily Carousel replenishment returned invalid ${fieldName}.`);
  }

  return value;
}

function getEnum<TValue extends string>(
  value: unknown,
  fieldName: string,
  options: Set<TValue>,
) {
  if (typeof value !== "string" || !options.has(value as TValue)) {
    throw new Error(`Daily Carousel replenishment returned invalid ${fieldName}.`);
  }

  return value as TValue;
}

function getInteger(
  value: unknown,
  fieldName: string,
  range: { max?: number; min: number },
) : number {
  if (
    !Number.isInteger(value) ||
    (value as number) < range.min ||
    (range.max !== undefined && (value as number) > range.max)
  ) {
    throw new Error(`Daily Carousel replenishment returned invalid ${fieldName}.`);
  }

  return value as number;
}

function getIntegerEnvValue(
  value: string | undefined,
  fallback: number,
  range: { max: number; min: number },
) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= range.min && parsed <= range.max
    ? parsed
    : fallback;
}

function getNullableUuid(value: unknown, fieldName: string) {
  if (value === null) {
    return null;
  }

  const text = getString(value, fieldName);

  if (!UUID_PATTERN.test(text)) {
    throw new Error(`Daily Carousel replenishment returned invalid ${fieldName}.`);
  }

  return text;
}

function getString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    throw new Error(`Daily Carousel replenishment returned invalid ${fieldName}.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
