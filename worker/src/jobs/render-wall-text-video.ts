import { getErrorMessage, logger } from "../logger.js";
import {
  renderWallTextVideoToStorage as defaultRenderWallTextVideoToStorage,
  type RenderWallTextVideoPayload,
} from "../lib/render-engine.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type {
  WallTextNormalizedBox,
  WallTextPlacementZone,
  WallTextRenderContent,
  WallTextSegment,
  WallTextSegmentRole,
} from "../lib/wall-text-render-spec.js";
import { parseTextColor } from "../lib/edit-overlay-render-spec.js";

type RenderWallTextDependencies = {
  createMediaAssetId: () => string;
  renderWallTextVideoToStorage: typeof defaultRenderWallTextVideoToStorage;
};

const defaultDependencies: RenderWallTextDependencies = {
  createMediaAssetId: () => crypto.randomUUID(),
  renderWallTextVideoToStorage: defaultRenderWallTextVideoToStorage,
};

export async function runRenderWallTextVideoJob(
  job: BackgroundJobRow,
  context: {
    dependencies?: Partial<RenderWallTextDependencies>;
    store: SupabaseJobStore;
  },
) {
  const payload = parseRenderWallTextVideoPayload(job.input_json);
  const dependencies = {
    ...defaultDependencies,
    ...context.dependencies,
  };

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

  try {
    const result = await dependencies.renderWallTextVideoToStorage(payload);
    const mediaAssetId = dependencies.createMediaAssetId();

    await context.store.markWallTextRenderCompleted({
      assignmentId: payload.assignmentId,
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

    return {
      ...result,
      mediaAssetId,
    } satisfies Record<string, Json>;
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    try {
      await context.store.markWallTextRenderFailed({
        assignmentId: payload.assignmentId,
        errorMessage,
        renderId: payload.renderId,
        userId: payload.userId,
      });
    } catch (persistenceError) {
      logger.error("Could not persist Wall-text render failure", {
        assignmentId: payload.assignmentId,
        error: getErrorMessage(persistenceError),
        jobId: job.id,
        renderId: payload.renderId,
      });
    }

    throw error;
  }
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

  if ((creativeEditId === null) !== (creativeEditRevision === null)) {
    throw new Error(
      "creativeEditId and creativeEditRevision must be provided together.",
    );
  }

  return {
    assignmentId: getRequiredString(input.assignmentId, "assignmentId", 64),
    creativeEditId,
    creativeEditRevision,
    creativeId: getRequiredString(input.creativeId, "creativeId", 64),
    durationSeconds: getPositiveNumber(
      input.durationSeconds,
      "durationSeconds",
      60,
    ),
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

  return { fullText, segments };
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
