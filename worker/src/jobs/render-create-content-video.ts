import { getErrorMessage, logger } from "../logger.js";
import {
  renderCreateContentVideoToStorage as defaultRenderCreateContentVideoToStorage,
  type RenderCreateContentVideoPayload,
} from "../lib/render-engine.js";
import type { WallTextRenderContent } from "../lib/wall-text-render-spec.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";

type CreateContentRenderJobInput = RenderCreateContentVideoPayload & {
  cardRevision: number;
};

type RenderCreateContentDependencies = {
  createMediaAssetId: () => string;
  renderCreateContentVideoToStorage: typeof defaultRenderCreateContentVideoToStorage;
};

const defaultDependencies: RenderCreateContentDependencies = {
  createMediaAssetId: () => crypto.randomUUID(),
  renderCreateContentVideoToStorage: defaultRenderCreateContentVideoToStorage,
};

export async function runRenderCreateContentVideoJob(
  job: BackgroundJobRow,
  context: {
    dependencies?: Partial<RenderCreateContentDependencies>;
    store: SupabaseJobStore;
  },
) {
  const dependencies = { ...defaultDependencies, ...context.dependencies };
  let payload: CreateContentRenderJobInput | null = null;

  try {
    payload = parseCreateContentRenderJobInput(job.input_json);
    await context.store.markCreateContentRenderStarted({
      jobId: job.id,
      renderId: payload.renderId,
      userId: payload.userId,
    });

    logger.info("Create Content video render started", {
      format: payload.overlay.format,
      jobId: job.id,
      renderId: payload.renderId,
      sourceVideoId: payload.sourceVideoId,
      userId: payload.userId,
    });

    const result = await dependencies.renderCreateContentVideoToStorage(payload);
    const mediaAssetId = dependencies.createMediaAssetId();
    await context.store.markCreateContentRenderCompleted({
      cardRevision: payload.cardRevision,
      jobId: job.id,
      key: result.key,
      mediaAssetId,
      payload,
      url: result.url,
    });

    return {
      mediaAssetId,
      renderId: payload.renderId,
      sourceVideoId: payload.sourceVideoId,
      url: result.url,
    } satisfies Record<string, Json>;
  } catch (error) {
    if (payload) {
      await reconcileCreateContentRenderFailure({
        errorMessage: getErrorMessage(error),
        payload,
        store: context.store,
      });
    }
    throw error;
  }
}

async function reconcileCreateContentRenderFailure(params: {
  errorMessage: string;
  payload: CreateContentRenderJobInput;
  store: SupabaseJobStore;
}) {
  try {
    await params.store.markCreateContentRenderFailed({
      errorMessage: params.errorMessage,
      renderId: params.payload.renderId,
      userId: params.payload.userId,
    });
  } catch (persistenceError) {
    logger.error("Could not persist Create Content render failure", {
      error: getErrorMessage(persistenceError),
      renderId: params.payload.renderId,
    });
  }
}

function parseCreateContentRenderJobInput(value: Json): CreateContentRenderJobInput {
  const input = getRecord(value, "input_json");
  const overlay = getRecord(input.overlay, "overlay");
  const format = getRequiredString(overlay.format, "overlay.format");
  const position = getPosition(overlay.position, "overlay.position");
  const common = {
    cardRevision: getPositiveInteger(input.cardRevision, "cardRevision"),
    projectId: getRequiredString(input.projectId, "projectId"),
    renderId: getRequiredString(input.renderId, "renderId"),
    sourceVideoId: getRequiredString(input.sourceVideoId, "sourceVideoId"),
    sourceVideoUrl: getHttpUrl(input.sourceVideoUrl, "sourceVideoUrl"),
    title: getRequiredString(input.title, "title"),
    userId: getRequiredString(input.userId, "userId"),
  };

  if (format === "hook_text") {
    const hook = getRecord(overlay.hook, "overlay.hook");
    const fontSize = getPositiveInteger(hook.fontSize, "overlay.hook.fontSize");
    const layoutVersion = getRequiredString(
      hook.layoutVersion,
      "overlay.hook.layoutVersion",
    );
    const lines = getLines(hook.lines, "overlay.hook.lines", 3);

    if (fontSize !== 52 || layoutVersion !== "hook-overlay-layout-v2-fixed") {
      throw new Error("Create Content Hook text has an unsupported layout.");
    }

    return {
      ...common,
      overlay: {
        format,
        hook: { fontSize, layoutVersion, lines },
        position,
        text: getRequiredString(overlay.text, "overlay.text"),
      },
    };
  }

  if (format === "wall_text") {
    const wall = getRecord(overlay.wall, "overlay.wall");
    const layout = getRecord(wall.layout, "overlay.wall.layout");
    const content = getRecord(wall.content, "overlay.wall.content");
    const safeArea = getRecord(layout.safeArea, "overlay.wall.layout.safeArea");
    const textBox = getRecord(layout.textBox, "overlay.wall.layout.textBox");

    return {
      ...common,
      overlay: {
        format,
        position,
        text: getRequiredString(overlay.text, "overlay.text"),
        wall: {
          content: content as unknown as WallTextRenderContent,
          layout: {
            safeArea: {
              bottom: getUnitNumber(safeArea.bottom, "safeArea.bottom"),
              left: getUnitNumber(safeArea.left, "safeArea.left"),
              right: getUnitNumber(safeArea.right, "safeArea.right"),
              top: getUnitNumber(safeArea.top, "safeArea.top"),
            },
            textBox: {
              height: getUnitNumber(textBox.height, "textBox.height"),
              width: getUnitNumber(textBox.width, "textBox.width"),
              x: getUnitNumber(textBox.x, "textBox.x"),
              y: getUnitNumber(textBox.y, "textBox.y"),
            },
          },
        },
      },
    } as CreateContentRenderJobInput;
  }

  throw new Error("Create Content render has an unsupported text format.");
}

function getRecord(value: Json | undefined, fieldName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value as Record<string, Json | undefined>;
}

function getRequiredString(value: Json | undefined, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function getPositiveInteger(value: Json | undefined, fieldName: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function getUnitNumber(value: Json | undefined, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${fieldName} must be a number from 0 to 1.`);
  }
  return value;
}

function getPosition(value: Json | undefined, fieldName: string) {
  const position = getRecord(value, fieldName);
  return {
    x: getUnitNumber(position.x, `${fieldName}.x`),
    y: getUnitNumber(position.y, `${fieldName}.y`),
  };
}

function getLines(value: Json | undefined, fieldName: string, maximum: number) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    throw new Error(`${fieldName} must contain one to ${maximum} lines.`);
  }
  return value.map((line, index) =>
    getRequiredString(line, `${fieldName}[${index}]`).replace(/\s+/gu, " "),
  );
}

function getHttpUrl(value: Json | undefined, fieldName: string) {
  const raw = getRequiredString(value, fieldName);
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be a valid http or https URL.`);
  }
}
