import { renderReactionVideoToStorage, type RenderReactionVideoPayload } from "../lib/render-engine.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runRenderReactionEditJob(
  job: BackgroundJobRow,
  context: WorkerJobContext & { dependencies?: { render?: typeof renderReactionVideoToStorage } },
) {
  const input = record(job.input_json);
  if (input.format !== "reaction" || typeof input.creativeId !== "string" ||
      input.userId !== job.user_id || typeof input.revision !== "number" ||
      !Number.isInteger(input.revision) || input.revision < 1 || !job.user_id) {
    throw new Error("Invalid Reaction text render input.");
  }
  const scope = { creativeId: input.creativeId, jobId: job.id, userId: job.user_id };
  const creative = await context.store.getReactionTextEditForJob(scope);
  if (!creative) return { superseded: true };
  const content = record(creative.content_json);
  const edit = record(content.userTextEdit);
  if (edit.revision !== input.revision) return { superseded: true };
  if (edit.status === "ready") return { mediaAssetId: creative.rendered_media_asset_id };

  try {
    await context.checkpoint({ stage: "preparing_reaction_text", status: "rendering" });
    const catalog = await context.store.listActiveReactionCatalog();
    const payload = buildReactionTextEditPayload({
      creative,
      renderId: job.id,
      backgroundStorageKey: catalog.backgrounds.find((asset) => asset.id === creative.background_asset_id)?.source_storage_key,
      foregroundStorageKey: catalog.clips.find((asset) => asset.id === creative.clip_asset_id)?.source_storage_key,
    });
    const render = await (context.dependencies?.render ?? renderReactionVideoToStorage)(payload);
    await context.checkpoint({ stage: "saving_reaction_text", status: "uploading_output" });
    // A job has one immutable output. Retries reuse both its storage key and
    // media identity, while previous schedules retain their original media.
    const mediaAssetId = await context.store.saveReactionRenderedMedia({
      creativeId: creative.id,
      durationSeconds: Number(creative.duration_seconds),
      fileSizeBytes: render.byteLength,
      key: render.key,
      mediaAssetId: job.id,
      projectId: "reaction-text-edit",
      sourceRecordId: job.id,
      title: creative.title,
      url: render.url,
      userId: job.user_id,
    });
    await context.store.completeReactionTextEdit({
      ...scope,
      caption: payload.captionLines.join(" "),
      content: { ...content, caption: payload.captionLines.join(" "), lines: [...payload.captionLines], userTextEdit: { ...edit, status: "ready" } },
      mediaAssetId,
      renderPlan: { ...record(creative.render_plan_json), text: { ...record(record(creative.render_plan_json).text), lines: [...payload.captionLines] } },
      url: render.url,
    });
    return { mediaAssetId, url: render.url };
  } catch (error) {
    // Let durable job retries run first. The app reconciles terminal failure
    // from background_jobs if the worker is killed before returning here.
    if (job.attempt_count + 1 >= job.max_attempts) {
      await context.store.failReactionTextEdit({
        ...scope,
        content: { ...content, userTextEdit: { ...edit, status: "failed" } },
      });
    }
    throw error;
  }
}

export function buildReactionTextEditPayload(params: {
  creative: NonNullable<Awaited<ReturnType<SupabaseJobStore["getReactionTextEditForJob"]>>>;
  renderId: string;
  backgroundStorageKey: string | null | undefined;
  foregroundStorageKey: string | null | undefined;
}): RenderReactionVideoPayload {
  const edit = record(record(params.creative.content_json).userTextEdit);
  const plan = record(params.creative.render_plan_json);
  const text = record(plan.text);
  const foreground = record(plan.foreground);
  const lines = edit.lines;
  const anchor = foreground.anchor;
  const heightPercent = foreground.heightPercent;
  const treatment = text.treatment;
  if (!params.backgroundStorageKey || !params.foregroundStorageKey ||
      !Array.isArray(lines) || lines.length < 1 || lines.length > 3 || !lines.every((line) => typeof line === "string" && line.trim()) ||
      (anchor !== "bottom_left" && anchor !== "bottom_center" && anchor !== "bottom_right" && anchor !== "center") ||
      typeof heightPercent !== "number" || !Number.isFinite(heightPercent) || heightPercent < 0.25 || heightPercent > 0.9 ||
      (treatment !== "white_card" && treatment !== "outlined_text")) {
    throw new Error("The saved Reaction text or selected render sources are invalid.");
  }
  return {
    backgroundStorageKey: params.backgroundStorageKey,
    captionLines: lines as string[],
    creativeId: params.creative.id,
    durationSeconds: Number(params.creative.duration_seconds),
    foreground: { anchor, heightPercent },
    foregroundStorageKey: params.foregroundStorageKey,
    renderId: params.renderId,
    treatment,
  };
}

function record(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
