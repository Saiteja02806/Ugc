import { getErrorMessage, logger } from "../logger.js";
import {
  renderWallTextVideoToStorage as defaultRenderWallTextVideoToStorage,
  type RenderWallTextVideoPayload,
} from "../lib/render-engine.js";
import {
  finalizeRenderedWallTextSchedules as defaultFinalizeRenderedWallTextSchedules,
  type WallTextScheduleFinalizationResult,
} from "../lib/schedule-finalization.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type {
  WallTextNormalizedBox,
  WallTextPlacementZone,
  WallTextRenderContent,
  WallTextSegment,
  WallTextSegmentRole,
} from "../lib/wall-text-render-spec.js";
import {
  LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT,
  LEGACY_WALL_TEXT_FONT_WEIGHT,
  LEGACY_WALL_TEXT_REGULAR_FONT_WEIGHT,
  WALL_TEXT_FONT_WEIGHT,
} from "../lib/wall-text-render-spec.js";
import { parseTextColor } from "../lib/edit-overlay-render-spec.js";

type RenderWallTextDependencies = {
  createMediaAssetId: () => string;
  finalizeRenderedWallTextSchedules: (params: {
    assignmentId: string;
    mediaAssetId: string;
    renderId: string;
    userId: string;
  }) => Promise<WallTextScheduleFinalizationResult>;
  renderWallTextVideoToStorage: typeof defaultRenderWallTextVideoToStorage;
};

const defaultDependencies: RenderWallTextDependencies = {
  createMediaAssetId: () => crypto.randomUUID(),
  finalizeRenderedWallTextSchedules: defaultFinalizeRenderedWallTextSchedules,
  renderWallTextVideoToStorage: defaultRenderWallTextVideoToStorage,
};

export async function runRenderWallTextVideoJob(
  job: BackgroundJobRow,
  context: {
    dependencies?: Partial<RenderWallTextDependencies>;
    store: SupabaseJobStore;
  },
) {
  const dependencies = {
    ...defaultDependencies,
    ...context.dependencies,
  };
  let payload: RenderWallTextVideoPayload | null = null;

  try {
    payload = parseRenderWallTextVideoPayload(job.input_json);

    logger.info("Wall-text render worker started", {
      assignmentId: payload.assignmentId,
      creativeId: payload.creativeId,
      jobId: job.id,
      renderId: payload.renderId,
      userId: payload.userId,
    });

    await context.store.markWallTextRenderStarted({
      assignmentId: payload.assignmentId,
      jobId: job.id,
      renderId: payload.renderId,
      userId: payload.userId,
    });

    const result = await dependencies.renderWallTextVideoToStorage(payload);
    const mediaAssetId = dependencies.createMediaAssetId();

    await context.store.markWallTextRenderCompleted({
      assignmentId: payload.assignmentId,
      attribution: payload.attribution,
      creativeEditId: payload.creativeEditId,
      creativeEditRevision: payload.creativeEditRevision,
      creativeId: payload.creativeId,
      durationSeconds: payload.durationSeconds,
      key: result.key,
      mediaAssetId,
      projectId: payload.projectId,
      renderId: payload.renderId,
      title: payload.title,
      url: result.url,
      userId: payload.userId,
    });

    try {
      const hasPendingSchedule = await context.store.hasPendingWallTextSchedules({
        assignmentId: payload.assignmentId,
        renderId: payload.renderId,
        userId: payload.userId,
      });

      if (!hasPendingSchedule) {
        return {
          ...result,
          mediaAssetId,
        } satisfies Record<string, Json>;
      }

      const finalization = await dependencies.finalizeRenderedWallTextSchedules({
        assignmentId: payload.assignmentId,
        mediaAssetId,
        renderId: payload.renderId,
        userId: payload.userId,
      });

      logger.info("Rendered Wall-text schedules finalized by the server", {
        finalizedCount: finalization.finalizedCount,
        jobId: job.id,
        renderId: payload.renderId,
        scheduleCount: finalization.scheduleCount,
      });
    } catch (finalizationError) {
      const errorMessage = getErrorMessage(finalizationError);

      try {
        await context.store.markWallTextScheduleFinalizationFailed({
          assignmentId: payload.assignmentId,
          errorMessage,
          renderId: payload.renderId,
          userId: payload.userId,
        });
      } catch (persistenceError) {
        logger.error("Could not persist Wall-text final scheduling failure", {
          assignmentId: payload.assignmentId,
          error: getErrorMessage(persistenceError),
          jobId: job.id,
          renderId: payload.renderId,
        });
      }

      logger.error("Wall-text video is ready, but final scheduling failed", {
        assignmentId: payload.assignmentId,
        error: errorMessage,
        jobId: job.id,
        renderId: payload.renderId,
      });
    }

    return {
      ...result,
      mediaAssetId,
    } satisfies Record<string, Json>;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const failureIdentity = payload ?? getWallTextRenderFailureIdentity(job.input_json);

    if (failureIdentity) {
      try {
        await context.store.markWallTextRenderFailed({
          assignmentId: failureIdentity.assignmentId,
          errorMessage,
          renderId: failureIdentity.renderId,
          userId: failureIdentity.userId,
        });
      } catch (persistenceError) {
        logger.error("Could not persist Wall-text render failure", {
          assignmentId: failureIdentity.assignmentId,
          error: getErrorMessage(persistenceError),
          jobId: job.id,
          renderId: failureIdentity.renderId,
        });
      }
    } else {
      logger.error("Could not identify the Wall-text render after payload validation failed", {
        error: errorMessage,
        jobId: job.id,
      });
    }

    throw error;
  }
}

function getWallTextRenderFailureIdentity(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, Json | undefined>;
  const assignmentId = input.assignmentId;
  const renderId = input.renderId;
  const userId = input.userId;

  if (
    typeof assignmentId !== "string" ||
    !assignmentId.trim() ||
    typeof renderId !== "string" ||
    !renderId.trim() ||
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    return null;
  }

  return {
    assignmentId: assignmentId.trim(),
    renderId: renderId.trim(),
    userId: userId.trim(),
  };
}

function parseRenderWallTextVideoPayload(
  value: Json,
): RenderWallTextVideoPayload {
  const input = getRecord(value, "input_json");
  const layout = getRecord(input.layout, "layout");
  const safeArea = getRecord(layout.safeArea, "layout.safeArea");
  const creativeEditId = getOptionalNullableString(input.creativeEditId, 64);
  const creativeEditRevision = getOptionalNullablePositiveInteger(
    input.creativeEditRevision,
    "creativeEditRevision",
  );
  const durationSeconds = getPositiveNumber(
    input.durationSeconds,
    "durationSeconds",
    60,
  );

  if ((creativeEditId === null) !== (creativeEditRevision === null)) {
    throw new Error(
      "creativeEditId and creativeEditRevision must be provided together.",
    );
  }
  const attribution = getWallTextAttribution(input.attribution);
  const audio = getWallTextAudio(input.audio, durationSeconds);
  validateWallTextAudioAttribution({ attribution, audio });

  return {
    assignmentId: getRequiredString(input.assignmentId, "assignmentId", 64),
    attribution,
    audio,
    creativeEditId,
    creativeEditRevision,
    creativeId: getRequiredString(input.creativeId, "creativeId", 64),
    durationSeconds,
    placement: getPlacement(layout.placement),
    projectId: getRequiredString(input.projectId, "projectId", 120),
    renderId: getRequiredString(input.renderId, "renderId", 64),
    safeArea: {
      bottom: getInset(safeArea.bottom, "safeArea.bottom"),
      left: getInset(safeArea.left, "safeArea.left"),
      right: getInset(safeArea.right, "safeArea.right"),
      top: getInset(safeArea.top, "safeArea.top"),
    },
    sourceVideoUrl: getHttpUrl(input.sourceVideoUrl, "sourceVideoUrl"),
    text: getWallTextContent(input.text),
    textColor: parseTextColor(input.textColor, "textColor"),
    textBox: getTextBox(layout.textBox),
    title: getRequiredString(input.title, "title", 140),
    userId: getRequiredString(input.userId, "userId", 200),
  };
}

function validateWallTextAudioAttribution(params: {
  attribution: RenderWallTextVideoPayload["attribution"];
  audio: RenderWallTextVideoPayload["audio"];
}) {
  const isLockedAudio =
    params.audio.matchingVersion === "wall-instagram-reel-locked-v1";

  if (
    params.attribution.sourceKind === "instagram_reel" &&
    (!params.attribution.instagramReelTemplateId ||
      !isLockedAudio ||
      params.audio.fitMode === "loop")
  ) {
    throw new Error("Instagram Reel Wall audio attribution is invalid.");
  }

  if (params.attribution.sourceKind !== "instagram_reel" && isLockedAudio) {
    throw new Error("Locked Instagram Reel audio cannot be used by this source.");
  }
}

function getWallTextAttribution(value: Json | undefined) {
  if (value === undefined || value === null) {
    return {
      contentHash: "0".repeat(64),
      editClassification: "none" as const,
      formatId: null,
      formatLearningEligible: false,
      formatVersion: 1,
      instagramReelTemplateId: null,
      selectionMode: "legacy_unknown",
      selectionWeight: 1,
      selectorVersion: "legacy_unknown",
      sourceKind: "ugcpilot" as const,
    };
  }
  const attribution = getRecord(value, "attribution");
  const editClassification = getRequiredString(
    attribution.editClassification,
    "attribution.editClassification",
    10,
  );
  const sourceKind = getRequiredString(
    attribution.sourceKind,
    "attribution.sourceKind",
    20,
  );
  if (!['none', 'minor', 'major'].includes(editClassification)) {
    throw new Error("attribution.editClassification is invalid.");
  }
  if (!['ugcpilot', 'creative_asset', 'instagram_reel'].includes(sourceKind)) {
    throw new Error("attribution.sourceKind is invalid.");
  }
  const contentHash = getRequiredString(
    attribution.contentHash,
    "attribution.contentHash",
    64,
  );
  if (!/^[a-f0-9]{64}$/u.test(contentHash)) {
    throw new Error("attribution.contentHash is invalid.");
  }
  if (
    typeof attribution.formatLearningEligible !== "boolean" ||
    typeof attribution.selectionWeight !== "number" ||
    !Number.isFinite(attribution.selectionWeight) ||
    attribution.selectionWeight <= 0
  ) {
    throw new Error("Wall-of-text render attribution is invalid.");
  }
  const formatVersion = getOptionalNullablePositiveInteger(
    attribution.formatVersion,
    "attribution.formatVersion",
  );
  if (formatVersion === null) {
    throw new Error("attribution.formatVersion is invalid.");
  }
  return {
    contentHash,
    editClassification: editClassification as "major" | "minor" | "none",
    formatId: getOptionalNullableString(attribution.formatId, 80),
    formatLearningEligible: attribution.formatLearningEligible,
    formatVersion,
    instagramReelTemplateId: getOptionalNullableString(
      attribution.instagramReelTemplateId,
      64,
    ),
    selectionMode: getRequiredString(
      attribution.selectionMode,
      "attribution.selectionMode",
      80,
    ),
    selectionWeight: attribution.selectionWeight,
    selectorVersion: getRequiredString(
      attribution.selectorVersion,
      "attribution.selectorVersion",
      120,
    ),
    sourceKind: sourceKind as "creative_asset" | "instagram_reel" | "ugcpilot",
  };
}

function getWallTextAudio(
  value: Json | undefined,
  videoDurationSeconds: number,
): RenderWallTextVideoPayload["audio"] {
  const audio = getRecord(value, "audio");
  const assetDurationSeconds = getPositiveNumber(
    audio.assetDurationSeconds,
    "audio.assetDurationSeconds",
    600,
  );
  const cueStartSeconds = getBoundedNumber(
    audio.cueStartSeconds,
    "audio.cueStartSeconds",
    0,
    assetDurationSeconds,
    true,
  );
  const fadeOutSeconds = getBoundedNumber(
    audio.fadeOutSeconds,
    "audio.fadeOutSeconds",
    0,
    1,
  );
  const fitMode = String(audio.fitMode);

  if (!["exact", "trim", "loop"].includes(fitMode)) {
    throw new Error("audio.fitMode is invalid.");
  }

  const playableDuration = assetDurationSeconds - cueStartSeconds;
  const difference = playableDuration - videoDurationSeconds;
  if (
    (fitMode === "exact" && Math.abs(difference) > 0.08) ||
    (fitMode === "trim" && difference <= 0.08) ||
    (fitMode === "loop" && difference + 0.08 >= 0)
  ) {
    throw new Error("Wall audio duration fit is invalid.");
  }

  return {
    assetDurationSeconds,
    assetId: getRequiredString(audio.assetId, "audio.assetId", 64),
    audioUrl: getHttpUrl(audio.audioUrl, "audio.audioUrl"),
    cueStartSeconds,
    fadeOutSeconds,
    fitMode: fitMode as "exact" | "trim" | "loop",
    matchingVersion: getRequiredString(
      audio.matchingVersion,
      "audio.matchingVersion",
      80,
    ),
    selectionId: getRequiredString(
      audio.selectionId,
      "audio.selectionId",
      64,
    ),
  };
}

function getWallTextContent(value: Json | undefined): WallTextRenderContent {
  const content = getRecord(value, "text");
  const fullText = getRequiredString(content.fullText, "text.fullText", 600);

  if (
    !Array.isArray(content.segments) ||
    content.segments.length < 2 ||
    content.segments.length > 3
  ) {
    throw new Error("text.segments must contain 2–3 semantic segments.");
  }

  const segments = content.segments.map((entry, segmentIndex) => {
    const segment = getRecord(entry, `text.segments[${segmentIndex}]`);
    const role = getSegmentRole(segment.role, segmentIndex);

    if (
      !Array.isArray(segment.lines) ||
      segment.lines.length < 1 ||
      segment.lines.length > 4
    ) {
      throw new Error(
        `text.segments[${segmentIndex}].lines must contain 1–4 lines.`,
      );
    }

    return {
      lines: segment.lines.map((line, lineIndex) =>
        getRequiredString(
          line,
          `text.segments[${segmentIndex}].lines[${lineIndex}]`,
          100,
        ),
      ),
      role,
    } satisfies WallTextSegment;
  });
  const finalLayout = content.finalLayout
    ? getFinalLayout(content.finalLayout, content.layoutVersion)
    : undefined;

  return {
    ...(finalLayout ? { finalLayout } : {}),
    fullText,
    ...([36, 38, 40, 42, 44, 46, 48, 50, 52].includes(Number(content.renderFontSize))
      ? { renderFontSize: Number(content.renderFontSize) as 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 | 52 }
      : {}),
    segments,
  };
}

function getFinalLayout(value: Json, contentLayoutVersion: Json | undefined) {
  const layout = getRecord(value, "text.finalLayout");
  const isArialRegularRolloutEnvelope =
    contentLayoutVersion === "wall-text-overlay-v8" &&
    layout.version === "wall-text-final-layout-v3";
  if (
    !["wall-text-final-layout-v1", "wall-text-final-layout-v2", "wall-text-final-layout-v3", "wall-text-final-layout-v4"].includes(
      String(layout.version),
    ) ||
    (layout.version === "wall-text-final-layout-v3"
      ? layout.fontFamily !== "Arial" || Number(layout.fontWeight) !== LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT
      : layout.version === "wall-text-final-layout-v4"
        ? layout.fontFamily !== "Arial" || Number(layout.fontWeight) !== WALL_TEXT_FONT_WEIGHT
      : layout.fontFamily !== "Inter" ||
        ![
          LEGACY_WALL_TEXT_REGULAR_FONT_WEIGHT,
          600,
          LEGACY_WALL_TEXT_FONT_WEIGHT,
        ].includes(Number(layout.fontWeight))) ||
    ![36, 38, 40, 42, 44, 46, 48, 50, 52].includes(Number(layout.fontSizePx)) ||
    typeof layout.lineHeightPx !== "number" ||
    !Array.isArray(layout.blocks) ||
    layout.blocks.length < 1 ||
    layout.blocks.length > 6
  ) {
    throw new Error("text.finalLayout is invalid.");
  }
  const blocks = layout.blocks.map((entry, blockIndex) => {
    const block = getRecord(entry, `text.finalLayout.blocks[${blockIndex}]`);
    if (
      !["prose", "text", "title", "item"].includes(String(block.role)) ||
      !Array.isArray(block.lines) ||
      block.lines.length < 1
    ) {
      throw new Error(`text.finalLayout.blocks[${blockIndex}] is invalid.`);
    }
    return {
      lines: block.lines.map((line, lineIndex) =>
        getRequiredString(
          line,
          `text.finalLayout.blocks[${blockIndex}].lines[${lineIndex}]`,
          160,
        ),
      ),
      role: block.role as "prose" | "text" | "title" | "item",
    };
  });
  const isV2OrV3OrV4 =
    layout.version === "wall-text-final-layout-v2" ||
    layout.version === "wall-text-final-layout-v3" ||
    layout.version === "wall-text-final-layout-v4";
  const lineCount = blocks.reduce((total, block) => total + block.lines.length, 0);
  if (
    isV2OrV3OrV4 &&
    (blocks.length !== 1 ||
      blocks[0]?.role !== "text" ||
      lineCount < 4 ||
      lineCount > 8)
  ) {
    throw new Error("text.finalLayout V2/V3/V4 must contain one 4-8 line text block.");
  }
  const fontSizePx = normalizeWallTextFontSize(Number(layout.fontSizePx));
  const textBox = getTextBoxFromRecord(layout.textBox, "text.finalLayout.textBox");
  const lineHeightPx = Math.round(fontSizePx * 1.1 * 100) / 100;
  if (isArialRegularRolloutEnvelope) {
    return {
      blocks,
      fontFamily: "Arial" as const,
      fontSizePx,
      fontWeight: WALL_TEXT_FONT_WEIGHT as 400,
      lineHeightPx,
      textBox,
      version: "wall-text-final-layout-v4" as const,
    };
  }
  if (layout.version === "wall-text-final-layout-v3") {
    return {
      blocks,
      fontFamily: "Arial" as const,
      fontSizePx,
      fontWeight: LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT as 500,
      lineHeightPx,
      textBox,
      version: "wall-text-final-layout-v3" as const,
    };
  }
  if (layout.version === "wall-text-final-layout-v4") {
    return {
      blocks,
      fontFamily: "Arial" as const,
      fontSizePx,
      fontWeight: WALL_TEXT_FONT_WEIGHT as 400,
      lineHeightPx,
      textBox,
      version: "wall-text-final-layout-v4" as const,
    };
  }
  return {
    blocks,
    fontFamily: "Inter" as const,
    fontSizePx,
    fontWeight: LEGACY_WALL_TEXT_REGULAR_FONT_WEIGHT as 400,
    lineHeightPx,
    textBox,
    version:
      layout.version === "wall-text-final-layout-v2"
        ? ("wall-text-final-layout-v2" as const)
        : ("wall-text-final-layout-v1" as const),
  };
}

function normalizeWallTextFontSize(value: number) {
  if ([36, 38, 40, 42, 44, 46, 48, 50, 52].includes(value)) {
    return value as 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 | 52;
  }
  return 52 as const;
}

function getTextBoxFromRecord(value: Json | undefined, fieldName: string) {
  const box = getRecord(value, fieldName);
  return {
    height: getUnitNumber(box.height, `${fieldName}.height`),
    width: getUnitNumber(box.width, `${fieldName}.width`),
    x: getUnitNumber(box.x, `${fieldName}.x`),
    y: getUnitNumber(box.y, `${fieldName}.y`),
  };
}

function getSegmentRole(
  value: Json | undefined,
  segmentIndex: number,
): WallTextSegmentRole {
  if (!["lead", "support", "closing"].includes(String(value))) {
    throw new Error(`text.segments[${segmentIndex}].role is invalid.`);
  }

  return value as WallTextSegmentRole;
}

function getPlacement(value: Json | undefined): WallTextPlacementZone {
  if (
    !["upper-middle", "middle", "lower-middle"].includes(String(value))
  ) {
    throw new Error("layout.placement is invalid.");
  }

  return value as WallTextPlacementZone;
}

function getTextBox(value: Json | undefined): WallTextNormalizedBox {
  const box = getRecord(value, "layout.textBox");

  return {
    height: getUnitNumber(box.height, "layout.textBox.height"),
    width: getUnitNumber(box.width, "layout.textBox.width"),
    x: getUnitNumber(box.x, "layout.textBox.x"),
    y: getUnitNumber(box.y, "layout.textBox.y"),
  };
}

function getRecord(
  value: Json | undefined,
  fieldName: string,
): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value;
}

function getRequiredString(
  value: Json | undefined,
  fieldName: string,
  maxLength: number,
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} is too long.`);
  }

  return normalized;
}

function getPositiveNumber(
  value: Json | undefined,
  fieldName: string,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > maximum
  ) {
    throw new Error(`${fieldName} must be between 0 and ${maximum}.`);
  }

  return value;
}

function getBoundedNumber(
  value: Json | undefined,
  fieldName: string,
  minimum: number,
  maximum: number,
  maximumExclusive = false,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    (maximumExclusive ? value >= maximum : value > maximum)
  ) {
    throw new Error(
      `${fieldName} must be between ${minimum} and ${
        maximumExclusive ? "less than " : ""
      }${maximum}.`,
    );
  }

  return value;
}

function getOptionalNullableString(value: Json | undefined, maximum: number) {
  if (value === undefined || value === null) {
    return null;
  }

  return getRequiredString(value, "optional string", maximum);
}

function getOptionalNullablePositiveInteger(
  value: Json | undefined,
  fieldName: string,
) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be a positive integer or null.`);
  }

  return value;
}

function getInset(value: Json | undefined, fieldName: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 0.3
  ) {
    throw new Error(`${fieldName} must be between 0 and 0.3.`);
  }

  return value;
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
  const rawValue = getRequiredString(value, fieldName, 2_048);

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
