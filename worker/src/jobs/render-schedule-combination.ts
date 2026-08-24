import { getErrorMessage, logger } from "../logger.js";
import {
  renderScheduleCombinationToStorage as defaultRenderScheduleCombinationToStorage,
  type RenderScheduleCombinationPayload,
} from "../lib/render-engine.js";
import {
  finalizeRenderedSchedule as defaultFinalizeRenderedSchedule,
  type ScheduleFinalizationResult,
} from "../lib/schedule-finalization.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  HOOK_TEXT_FIXED_FONT_SIZE,
  HOOK_TEXT_LAYOUT_VERSION,
  LEGACY_HOOK_TEXT_LAYOUT_VERSION,
  parseTextColor,
} from "../lib/edit-overlay-render-spec.js";
import type { BackgroundJobRow, Json } from "../types.js";

const videoRatios = new Set(["9:16", "1:1", "4:5", "16:9"]);
type CombinationRenderRatio = RenderScheduleCombinationPayload["ratio"];
type ParsedCombinationRenderPayload = RenderScheduleCombinationPayload & {
  hookVideoDraftId: string | null;
};

type RenderScheduleCombinationDependencies = {
  createMediaAssetId: () => string;
  finalizeRenderedSchedule: (params: {
    renderId: string;
    scheduleId: string;
    userId: string;
  }) => Promise<ScheduleFinalizationResult>;
  renderScheduleCombinationToStorage: typeof defaultRenderScheduleCombinationToStorage;
};

const defaultDependencies: RenderScheduleCombinationDependencies = {
  createMediaAssetId: () => crypto.randomUUID(),
  finalizeRenderedSchedule: defaultFinalizeRenderedSchedule,
  renderScheduleCombinationToStorage: defaultRenderScheduleCombinationToStorage,
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
    hookVideoDraftId: payload.hookVideoDraftId,
    userId: payload.userId,
  });

  if (payload.hookVideoDraftId) {
    await context.store.markHookVideoLibraryRenderStarted({
      draftId: payload.hookVideoDraftId,
      jobId: job.id,
      renderId: payload.renderId,
      userId: payload.userId,
    });
  } else {
    await context.store.markScheduleCombinationRenderStarted({
      jobId: job.id,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
      userId: payload.userId,
    });
  }

  let result: Awaited<
    ReturnType<typeof defaultRenderScheduleCombinationToStorage>
  >;
  const mediaAssetId = dependencies.createMediaAssetId();

  try {
    result = await dependencies.renderScheduleCombinationToStorage(payload);

    if (payload.hookVideoDraftId) {
      await context.store.markHookVideoLibraryRenderCompleted({
        compositionFingerprint: payload.compositionFingerprint,
        demoVideoId: payload.demoVideoId,
        draftId: payload.hookVideoDraftId,
        hookAudioAssetId: payload.hookAudio?.audioAssetId ?? null,
        hookVideoId: payload.hookVideoId,
        key: result.key,
        mediaAssetId,
        projectId: payload.projectId,
        ratio: payload.ratio,
        renderId: payload.renderId,
        title: payload.title,
        url: result.url,
        userId: payload.userId,
      });
    } else {
      await context.store.markScheduleCombinationRenderCompleted({
        autoFinalize: payload.autoFinalize,
        compositionFingerprint: payload.compositionFingerprint,
        demoVideoId: payload.demoVideoId,
        hookAudioAssetId: payload.hookAudio?.audioAssetId ?? null,
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
    }

  } catch (error) {
    const errorMessage = getErrorMessage(error);

    try {
      if (payload.hookVideoDraftId) {
        await context.store.markHookVideoLibraryRenderFailed({
          draftId: payload.hookVideoDraftId,
          errorMessage,
          renderId: payload.renderId,
          userId: payload.userId,
        });
      } else {
        await context.store.markScheduleCombinationRenderFailed({
          errorMessage,
          renderId: payload.renderId,
          scheduleId: payload.scheduleId,
          userId: payload.userId,
        });
      }
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
): ParsedCombinationRenderPayload {
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

  const autoFinalize = getOptionalBoolean(
    input.autoFinalize,
    "autoFinalize",
    false,
  );
  const hookVideoDraftId = getOptionalString(input.hookVideoDraftId, 128) || null;

  if (hookVideoDraftId && autoFinalize) {
    throw new Error("Saved Hook video renders cannot auto-finalize a schedule.");
  }

  const hookText = getOptionalString(input.hookText, 220);
  const hookTextFontSize = getOptionalHookTextFontSize(input.hookTextFontSize);
  const hookTextLayoutVersion = getOptionalHookTextLayoutVersion(
    input.hookTextLayoutVersion,
  );
  const hookTextLines = getOptionalHookTextLines(input.hookTextLines);

  if ((hookTextFontSize === null) !== (hookTextLines === null)) {
    throw new Error(
      "Hook text requires both hookTextFontSize and hookTextLines.",
    );
  }

  if (
    hookTextLines &&
    normalizeHookText(hookTextLines.join(" ")) !== normalizeHookText(hookText)
  ) {
    throw new Error("hookTextLines must match hookText exactly.");
  }

  if (
    hookTextLayoutVersion === HOOK_TEXT_LAYOUT_VERSION &&
    (hookTextFontSize === null || hookTextLines === null)
  ) {
    throw new Error("The authoritative Hook text layout is incomplete.");
  }

  if (
    hookTextLayoutVersion === HOOK_TEXT_LAYOUT_VERSION &&
    hookTextFontSize !== HOOK_TEXT_FIXED_FONT_SIZE
  ) {
    throw new Error(
      `Current Hook text must use the fixed ${HOOK_TEXT_FIXED_FONT_SIZE}px font size.`,
    );
  }

  return {
    autoFinalize,
    compositionFingerprint:
      getOptionalString(input.compositionFingerprint, 128) || "legacy",
    demoVideoId: getRequiredString(input.demoVideoId, "demoVideoId"),
    demoVideoUrl: getHttpUrl(input.demoVideoUrl, "demoVideoUrl"),
    hookAudio: getOptionalHookAudio(input.hookAudio),
    hookText,
    hookTextFontSize,
    hookTextLayoutVersion,
    hookTextLines,
    hookTextPosition: getOptionalNormalizedPosition(input.hookTextPosition),
    hookTextColor: parseTextColor(input.hookTextColor, "hookTextColor"),
    hookTrimEnd,
    hookTrimStart,
    hookVideoId: getRequiredString(input.hookVideoId, "hookVideoId"),
    hookVideoDraftId,
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

function getOptionalHookAudio(value: Json | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const audio = getJsonRecord(value, "hookAudio");
  const selectionSource = getRequiredString(
    audio.selectionSource,
    "hookAudio.selectionSource",
  );

  if (selectionSource !== "video_locked") {
    throw new Error("hookAudio.selectionSource must be video_locked.");
  }

  const durationSeconds = getOptionalNullablePositiveNumber(
    audio.durationSeconds,
    "hookAudio.durationSeconds",
  );

  if (durationSeconds === null) {
    throw new Error("hookAudio.durationSeconds must be a positive number.");
  }

  return {
    audioAssetId: getRequiredString(
      audio.audioAssetId,
      "hookAudio.audioAssetId",
    ),
    audioUrl: getHttpUrl(audio.audioUrl, "hookAudio.audioUrl"),
    durationSeconds,
    selectionSource: "video_locked" as const,
  };
}

function getOptionalHookTextFontSize(value: Json | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 34 &&
    value <= 60 &&
    value % 2 === 0
  ) {
    return value;
  }

  throw new Error("hookTextFontSize must be an even number from 34 to 60.");
}

function getOptionalHookTextLayoutVersion(value: Json | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    value === HOOK_TEXT_LAYOUT_VERSION ||
    value === LEGACY_HOOK_TEXT_LAYOUT_VERSION
  ) {
    return value;
  }

  throw new Error("hookTextLayoutVersion is not supported.");
}

function getOptionalHookTextLines(value: Json | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    value.some(
      (line) =>
        typeof line !== "string" ||
        !line.trim() ||
        Array.from(line.trim()).length > 78,
    )
  ) {
    throw new Error("hookTextLines must contain one to three text lines.");
  }

  return value.map((line) => String(line).trim().replace(/\s+/gu, " "));
}

function normalizeHookText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
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

function getOptionalNormalizedPosition(value: Json | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const position = getJsonRecord(value, "hookTextPosition");

  return {
    x: getUnitNumber(position.x, "hookTextPosition.x"),
    y: getUnitNumber(position.y, "hookTextPosition.y"),
  };
}

function getUnitNumber(value: Json | undefined, fieldName: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(`${fieldName} must be between 0 and 1.`);
  }

  return value;
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
