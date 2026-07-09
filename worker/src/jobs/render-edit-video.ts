import { getErrorMessage, logger } from "../logger.js";
import {
  renderEditedVideoToS3,
  type RenderEditVideoPayload,
} from "../lib/render-engine.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";

const videoRatios = new Set(["9:16", "1:1", "4:5", "16:9"]);
const textOverlayPositions = new Set(["top", "middle", "bottom"]);
const textOverlayStyles = new Set(["clean", "bubble"]);

export async function runRenderEditVideoJob(
  job: BackgroundJobRow,
  context: {
    store: SupabaseJobStore;
  },
) {
  const payload = parseRenderEditVideoPayload(job.input_json);

  logger.info("Edited video render worker started", {
    jobId: job.id,
    projectId: payload.projectId,
    renderId: payload.renderId,
    sourceVideoId: payload.sourceVideoId,
    userId: payload.userId,
  });

  await context.store.markEditRenderRendering(payload.renderId);

  try {
    const result = await renderEditedVideoToS3(payload);

    await context.store.markEditRenderCompleted({
      key: result.key,
      projectId: payload.projectId,
      renderId: payload.renderId,
      sourceVideoId: payload.sourceVideoId,
      url: result.url,
      userId: payload.userId,
    });

    return result satisfies Record<string, Json>;
  } catch (error) {
    try {
      await context.store.markEditRenderFailed({
        errorMessage: getErrorMessage(error),
        projectId: payload.projectId,
        renderId: payload.renderId,
        sourceVideoId: payload.sourceVideoId,
        userId: payload.userId,
      });
    } catch (persistenceError) {
      logger.error("Could not persist edited video render failure", {
        error: getErrorMessage(persistenceError),
        jobId: job.id,
        renderId: payload.renderId,
      });
    }

    throw error;
  }
}

function parseRenderEditVideoPayload(value: Json): RenderEditVideoPayload {
  const input = getJsonRecord(value, "input_json");
  const draft = getJsonRecord(input.draft, "draft");
  const textOverlay = getJsonRecord(draft.textOverlay, "draft.textOverlay");
  const trimStartSeconds = getNumber(
    draft.trimStartSeconds,
    "draft.trimStartSeconds",
    0,
  );
  const trimEndSeconds = getNullableNumber(
    draft.trimEndSeconds,
    "draft.trimEndSeconds",
  );

  if (trimEndSeconds !== null && trimEndSeconds <= trimStartSeconds) {
    throw new Error("draft.trimEndSeconds must be after draft.trimStartSeconds.");
  }

  return {
    draft: {
      trimStartSeconds,
      trimEndSeconds,
      textOverlay: {
        position: getChoice(
          textOverlay.position,
          "draft.textOverlay.position",
          textOverlayPositions,
          "bottom",
        ) as RenderEditVideoPayload["draft"]["textOverlay"]["position"],
        style: getChoice(
          textOverlay.style,
          "draft.textOverlay.style",
          textOverlayStyles,
          "bubble",
        ) as RenderEditVideoPayload["draft"]["textOverlay"]["style"],
        text: getOptionalString(textOverlay.text, 180),
      },
    },
    projectId: getRequiredString(input.projectId, "projectId"),
    ratio: getChoice(
      input.ratio,
      "ratio",
      videoRatios,
      "9:16",
    ) as RenderEditVideoPayload["ratio"],
    renderId: getRequiredString(input.renderId, "renderId"),
    sourceVideoId: getRequiredString(input.sourceVideoId, "sourceVideoId"),
    sourceVideoUrl: getHttpUrl(input.sourceVideoUrl, "sourceVideoUrl"),
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
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
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

function getNumber(
  value: Json | undefined,
  fieldName: string,
  fallback: number,
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return value;
}

function getNullableNumber(value: Json | undefined, fieldName: string) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be null or a non-negative number.`);
  }

  return value;
}

function getChoice(
  value: Json | undefined,
  fieldName: string,
  allowedValues: Set<string>,
  fallback: string,
) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string" && allowedValues.has(value)) {
    return value;
  }

  throw new Error(`${fieldName} is not supported.`);
}
