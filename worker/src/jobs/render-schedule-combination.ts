import { getErrorMessage, logger } from "../logger.js";
import {
  renderScheduleCombinationToS3,
  type RenderScheduleCombinationPayload,
} from "../lib/render-engine.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";

const videoRatios = new Set(["9:16", "1:1", "4:5", "16:9"]);
type CombinationRenderRatio = RenderScheduleCombinationPayload["ratio"];

export async function runRenderScheduleCombinationJob(
  job: BackgroundJobRow,
  context: {
    store: SupabaseJobStore;
  },
) {
  const payload = parseRenderScheduleCombinationPayload(job.input_json);

  logger.info("Schedule combination render worker started", {
    demoVideoId: payload.demoVideoId,
    hookVideoId: payload.hookVideoId,
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

  try {
    const result = await renderScheduleCombinationToS3(payload);
    const mediaAssetId = crypto.randomUUID();

    await context.store.markScheduleCombinationRenderCompleted({
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

    return {
      ...result,
      mediaAssetId,
    } satisfies Record<string, Json>;
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
}

function parseRenderScheduleCombinationPayload(
  value: Json,
): RenderScheduleCombinationPayload {
  const input = getJsonRecord(value, "input_json");

  return {
    demoVideoId: getRequiredString(input.demoVideoId, "demoVideoId"),
    demoVideoUrl: getHttpUrl(input.demoVideoUrl, "demoVideoUrl"),
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
