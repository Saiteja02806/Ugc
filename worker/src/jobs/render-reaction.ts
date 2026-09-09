import {
  buildReactionRenderPayload,
  toReactionCatalogBackground,
  toReactionCatalogClip,
} from "./generate-reaction.js";
import {
  renderReactionVideoToStorage as defaultRenderReactionVideoToStorage,
} from "../lib/render-engine.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runRenderReactionJob(
  job: BackgroundJobRow,
  context: WorkerJobContext & {
    dependencies?: {
      render?: typeof defaultRenderReactionVideoToStorage;
    };
  },
) {
  const input = parseInput(job);
  const item = await context.store.claimReactionGenerationItemRender({
    generationJobId: input.generationJobId,
    itemId: input.itemId,
    renderJobId: job.id,
    userId: input.userId,
  });

  if (!item) {
    return { itemId: input.itemId, status: "superseded" } satisfies Record<string, Json>;
  }

  if (item.render_status === "ready" && item.rendered_media_asset_id && item.preview_url) {
    return {
      itemId: item.id,
      mediaAssetId: item.rendered_media_asset_id,
      status: "ready",
      url: item.preview_url,
    } satisfies Record<string, Json>;
  }

  try {
    await context.checkpoint({
      progress: null,
      stage: `rendering_reaction_${item.slot_index + 1}`,
      status: "rendering",
    });
    const catalog = await context.store.listActiveReactionCatalog();
    const render = await (context.dependencies?.render ?? defaultRenderReactionVideoToStorage)(
      buildReactionRenderPayload({
        background: (() => {
          const background = catalog.backgrounds.find((entry) => entry.id === item.background_asset_id);
          return background ? toReactionCatalogBackground(background) : undefined;
        })(),
        clip: (() => {
          const clip = catalog.clips.find((entry) => entry.id === item.clip_asset_id);
          return clip ? toReactionCatalogClip(clip) : undefined;
        })(),
        item,
      }),
    );
    await context.checkpoint({
      progress: null,
      stage: `saving_reaction_${item.slot_index + 1}`,
      status: "uploading_output",
    });
    const mediaAssetId = await context.store.saveReactionRenderedMedia({
      creativeId: item.reaction_creative_id,
      durationSeconds: item.duration_seconds,
      fileSizeBytes: render.byteLength,
      key: render.key,
      mediaAssetId: job.id,
      projectId: input.projectId,
      sourceRecordId: job.id,
      title: item.title,
      url: render.url,
      userId: input.userId,
    });
    await context.store.completeReactionGenerationItemRenderV2({
      generationJobId: input.generationJobId,
      itemId: item.id,
      mediaAssetId,
      previewUrl: render.url,
      renderJobId: job.id,
      userId: input.userId,
    });
    const completion = await context.store.completeReactionGenerationRun({
      generationJobId: input.generationJobId,
      runId: input.generationRunId,
      userId: input.userId,
    });

    return {
      failedCount: completion.failed_count,
      generationRunId: input.generationRunId,
      itemId: item.id,
      readyCount: completion.ready_count,
      status: completion.status,
      url: render.url,
    } satisfies Record<string, Json>;
  } catch (error) {
    throw new RetryableJobError(
      error instanceof Error ? error.message : "Reaction Reel rendering failed.",
      { code: "reaction_render_retry", retryAfterSeconds: 30 },
    );
  }
}

function parseInput(job: BackgroundJobRow) {
  const input = record(job.input_json);
  const generationJobId = stringValue(input?.generationJobId);
  const generationRunId = stringValue(input?.generationRunId);
  const itemId = stringValue(input?.itemId);
  const projectId = stringValue(input?.projectId);
  const userId = stringValue(input?.userId);
  if (
    !job.user_id || job.user_id !== userId || !generationJobId || !generationRunId ||
    !itemId || !projectId || !isUuid(generationJobId) || !isUuid(generationRunId) ||
    !isUuid(itemId)
  ) {
    throw new Error("reaction_render input is invalid.");
  }
  return { generationJobId, generationRunId, itemId, projectId, userId };
}

function record(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
