import { getErrorMessage, logger } from "../logger.js";
import {
  renderScheduleCombinationToS3 as defaultRenderScheduleCombinationToS3,
  type RenderScheduleCombinationPayload,
} from "../lib/render-engine.js";
import {
  finalizeRenderedSchedule as defaultFinalizeRenderedSchedule,
  type ScheduleFinalizationResult,
} from "../lib/schedule-finalization.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";

const videoRatios = new Set(["9:16", "1:1", "4:5", "16:9"]);
type CombinationRenderRatio = RenderScheduleCombinationPayload["ratio"];

type RenderScheduleCombinationDependencies = {
  createMediaAssetId: () => string;
  finalizeRenderedSchedule: (params: {
    renderId: string;
    scheduleId: string;
    userId: string;
  }) => Promise<ScheduleFinalizationResult>;
  renderScheduleCombinationToS3: typeof defaultRenderScheduleCombinationToS3;
};

const defaultDependencies: RenderScheduleCombinationDependencies = {
  createMediaAssetId: () => crypto.randomUUID(),
  finalizeRenderedSchedule: defaultFinalizeRenderedSchedule,
  renderScheduleCombinationToS3: defaultRenderScheduleCombinationToS3,
};

export async function runRenderScheduleCombinationJob(
  job: BackgroundJobRow,
  context: {
    dependencies?: Partial<RenderScheduleCombinationDependencies>;
    store: SupabaseJobStore;
  },
) {
  const payload = parseRenderScheduleCombinationPayload(job.input_json);
  const dependencies = {
    ...defaultDependencies,
    ...context.dependencies,
  };

  logger.info("Schedule combination render worker started", {
    demoVideoId: payload.demoVideoId,
    hookVideoId: payload.hookVideoId,
    autoFinalize: payload.autoFinalize,
    jobId: job.id,
    renderId: payload.renderId,
    scheduleId: payload.scheduleId,
    userId: payload.userId,
  });

  await context.store.markScheduleCombinationRenderStarted({
    jobId: job.id,
    renderId: payload.renderId,
    scheduleId: payload.scheduleId,
    userId: payload.userId,
  });

  let result: Awaited<
    ReturnType<typeof defaultRenderScheduleCombinationToS3>
  >;
  const mediaAssetId = dependencies.createMediaAssetId();

  try {
    result = await dependencies.renderScheduleCombinationToS3(payload);

    await context.store.markScheduleCombinationRenderCompleted({
      autoFinalize: payload.autoFinalize,
      compositionFingerprint: payload.compositionFingerprint,
      demoVideoId: payload.demoVideoId,
      hookVideoId: payload.hookVideoId,
      key: result.key,
      mediaAssetId,
      projectId: payload.projectId,
      ratio: payload.ratio,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
      title: payload.title,
      url: result.url,
      userId: payload.userId,
    });

  } catch (error) {
    const errorMessage = getErrorMessage(error);

    try {
      await context.store.markScheduleCombinationRenderFailed({
        errorMessage,
        renderId: payload.renderId,
        scheduleId: payload.scheduleId,
        userId: payload.userId,
      });
    } catch (persistenceError) {
      logger.error("Could not persist schedule combination render failure", {
        error: getErrorMessage(persistenceError),
        jobId: job.id,
        renderId: payload.renderId,
        scheduleId: payload.scheduleId,
      });
    }

    throw error;
  }

  if (!payload.autoFinalize) {
    return {
      ...result,
      finalScheduleStatus: "not_requested",
      mediaAssetId,
    } satisfies Record<string, Json>;
  }

  try {
    const finalization = await dependencies.finalizeRenderedSchedule({
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
      userId: payload.userId,
    });

    await context.store.markScheduleCombinationFinalizationCompleted({
      finalStatus: finalization.status,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
      userId: payload.userId,
    });

    logger.info("Rendered schedule finalized by the server", {
      created: finalization.created,
      jobId: job.id,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
      skipped: finalization.skipped,
      status: finalization.status,
    });

    return {
      ...result,
      finalScheduleCreated: finalization.created,
      finalScheduleSkipped: finalization.skipped,
      finalScheduleStatus: finalization.status,
      mediaAssetId,
    } satisfies Record<string, Json>;
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    try {
      await context.store.markScheduleCombinationFinalizationFailed({
        errorMessage,
        renderId: payload.renderId,
        scheduleId: payload.scheduleId,
        userId: payload.userId,
      });
    } catch (persistenceError) {
      logger.error("Could not persist final scheduling failure", {
        error: getErrorMessage(persistenceError),
        jobId: job.id,
        renderId: payload.renderId,
        scheduleId: payload.scheduleId,
      });
    }

    logger.error("Rendered video is ready, but final scheduling failed", {
      error: errorMessage,
      jobId: job.id,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
    });

    return {
      ...result,
      finalScheduleError: errorMessage.slice(0, 500),
      finalScheduleStatus: "failed",
      mediaAssetId,
    } satisfies Record<string, Json>;
  }
}

function parseRenderScheduleCombinationPayload(
  value: Json,
): RenderScheduleCombinationPayload {
  const input = getJsonRecord(value, "input_json");
  const hookTrimStart = getOptionalNonNegativeNumber(
    input.hookTrimStart,
    "hookTrimStart",
    0,
  );
  const hookTrimEnd = getOptionalNullablePositiveNumber(
    input.hookTrimEnd,
    "hookTrimEnd",
  );

  if (hookTrimEnd !== null && hookTrimEnd <= hookTrimStart) {
    throw new Error("hookTrimEnd must be after hookTrimStart.");
  }

  return {
    autoFinalize: getOptionalBoolean(input.autoFinalize, "autoFinalize", false),
    compositionFingerprint:
      getOptionalString(input.compositionFingerprint, 128) || "legacy",
    demoVideoId: getRequiredString(input.demoVideoId, "demoVideoId"),
    demoVideoUrl: getHttpUrl(input.demoVideoUrl, "demoVideoUrl"),
    hookText: getOptionalString(input.hookText, 220),
    hookTrimEnd,
    hookTrimStart,
    hookVideoId: getRequiredString(input.hookVideoId, "hookVideoId"),
    hookVideoUrl: getHttpUrl(input.hookVideoUrl, "hookVideoUrl"),
    projectId: getRequiredString(input.projectId, "projectId"),
    ratio: getChoice<CombinationRenderRatio>(
      input.ratio,
      "ratio",
      videoRatios,
      "9:16",
    ),
    renderId: getRequiredString(input.renderId, "renderId"),
    scheduleId: getRequiredString(input.scheduleId, "scheduleId"),
    title: getOptionalString(input.title, 140) || "Combined scheduled video",
    userId: getRequiredString(input.userId, "userId"),
  };
}

function getOptionalBoolean(
  value: Json | undefined,
  fieldName: string,
  fallback: boolean,
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`${fieldName} must be a boolean.`);
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

function getOptionalString(value: Json | undefined, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function getOptionalNonNegativeNumber(
  value: Json | undefined,
  fieldName: string,
  fallback: number,
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  throw new Error(`${fieldName} must be a non-negative number.`);
}

function getOptionalNullablePositiveNumber(
  value: Json | undefined,
  fieldName: string,
) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  throw new Error(`${fieldName} must be a positive number or null.`);
}

function getHttpUrl(value: Json | undefined, fieldName: string) {
  const rawValue = getRequiredString(value, fieldName);

  try {
    const url = new URL(rawValue);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be a valid http or https URL.`);
  }
}

function getChoice<TValue extends string>(
  value: Json | undefined,
  fieldName: string,
  allowedValues: Set<string>,
  fallback: TValue,
) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string" && allowedValues.has(value)) {
    return value as TValue;
  }

  throw new Error(`${fieldName} is not supported.`);
}
