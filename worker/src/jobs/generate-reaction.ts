import {
  planReactionGeneration,
  REACTION_GENERATION_PROMPT_VERSION,
  type ReactionCatalogBackground,
  type ReactionCatalogClip,
  type ReactionGenerationContext,
} from "../lib/reaction-generation.js";
import {
  type RenderReactionVideoPayload,
} from "../lib/render-engine.js";
import {
  enqueueReactionRenderTask as defaultEnqueueReactionRenderTask,
} from "../lib/reaction-render-task-dispatch.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

type Dependencies = {
  enqueueReactionRenderTask: typeof defaultEnqueueReactionRenderTask;
  planReactionGeneration: typeof planReactionGeneration;
};

const defaultDependencies: Dependencies = {
  enqueueReactionRenderTask: defaultEnqueueReactionRenderTask,
  planReactionGeneration,
};

export async function runGenerateReactionJob(
  job: BackgroundJobRow,
  context: WorkerJobContext & { dependencies?: Partial<Dependencies> },
) {
  const input = parseInput(job);
  const dependencies = { ...defaultDependencies, ...context.dependencies };

  await context.checkpoint({
    progress: null,
    stage: "loading_reaction_catalog",
    status: "processing",
  });
  const [run, catalog, historyByClipId, reservedClipIds] = await Promise.all([
    context.store.ensureReactionGenerationRun({
      businessProfileId: input.businessProfileId,
      businessProfileVersion: input.businessProfileVersion,
      generationContext: input.generationContext as unknown as Json,
      generationJobId: job.id,
      projectId: input.projectId,
      requestKey: input.requestKey,
      requestedCount: input.requestedCount,
      userId: input.userId,
    }),
    context.store.listActiveReactionCatalog(),
    context.store.getReactionClipPresentationHistory(input.userId),
    context.store.getReservedReactionClipIds({
      businessProfileId: input.businessProfileId,
      businessProfileVersion: input.businessProfileVersion,
      userId: input.userId,
    }),
  ]);
  const clips = catalog.clips.map(toReactionCatalogClip);
  const backgrounds = catalog.backgrounds.map(toReactionCatalogBackground);
  const generationContext = parseGenerationContext(run.generation_context);
  if (!generationContext) {
    throw new Error("Persisted Reaction generation context is invalid.");
  }

  if (run.brief_payload) {
    await context.store.persistReactionGenerationPlan({
        briefPayload: run.brief_payload,
        generationJobId: job.id,
        // The RPC returns its saved immutable plan before inspecting this
        // placeholder. A reclaimed job therefore cannot generate new copy or
        // select different catalog assets.
        items: [],
        runId: run.id,
        userId: input.userId,
      });
  } else {
    await createAndPersistPlan({
        backgrounds,
        clips,
        context,
        historyByClipId,
        generationContext,
        input,
        job,
        planReactionGeneration: dependencies.planReactionGeneration,
        reservedClipIds,
        runId: run.id,
      });
  }

  const renderJobs = await context.store.createReactionGenerationRenderJobs({
    generationJobId: job.id,
    runId: run.id,
    userId: input.userId,
  });

  for (const renderJob of renderJobs) {
    if (renderJob.job.status !== "queued" || renderJob.job.queue_message_id) {
      continue;
    }

    const delivery = await dependencies.enqueueReactionRenderTask(renderJob.job);
    await context.store.attachReactionRenderTaskDelivery({
      jobId: renderJob.job.id,
      taskName: delivery.taskName,
    });
  }
  await context.checkpoint({
    progress: null,
    stage: "reaction_render_tasks_enqueued",
    status: "processing",
  });

  return {
    generationRunId: run.id,
    promptVersion: run.brief_payload && typeof run.brief_payload === "object" && "promptVersion" in run.brief_payload
      ? run.brief_payload.promptVersion ?? REACTION_GENERATION_PROMPT_VERSION
      : REACTION_GENERATION_PROMPT_VERSION,
    queuedRenderCount: renderJobs.length,
    requestedCount: input.requestedCount,
    status: "rendering",
  } satisfies Record<string, Json>;
}

async function createAndPersistPlan(params: {
  backgrounds: readonly ReactionCatalogBackground[];
  clips: readonly ReactionCatalogClip[];
  context: WorkerJobContext;
  historyByClipId: ReadonlyMap<string, { lastShownAt: string | null; shownCount: number }>;
  generationContext: ReactionGenerationContext;
  input: ReturnType<typeof parseInput>;
  job: BackgroundJobRow;
  planReactionGeneration: typeof planReactionGeneration;
  reservedClipIds: ReadonlySet<string>;
  runId: string;
}) {
  await params.context.checkpoint({
    progress: null,
    stage: "generating_reaction_briefs",
    status: "waiting_external_service",
  });
  const plan = await params.planReactionGeneration({
    backgrounds: params.backgrounds,
    clips: params.clips,
    context: params.generationContext,
    historyByClipId: params.historyByClipId,
    jobId: params.job.id,
    requestedCount: params.input.requestedCount,
    reservedClipIds: params.reservedClipIds,
    seed: `${params.input.userId}:${params.input.requestKey}`,
  });
  await params.context.checkpoint({
    progress: null,
    stage: "persisting_reaction_plan",
    status: "processing",
  });
  return params.context.store.persistReactionGenerationPlan({
    briefPayload: plan.briefPayload as Json,
    generationJobId: params.job.id,
    items: plan.items.map((item) => ({
      background_asset_id: item.backgroundAssetId,
      caption: item.caption,
      clip_asset_id: item.clipAssetId,
      content_json: item.content as unknown as Json,
      duration_seconds: item.durationSeconds,
      primary_reaction: item.primaryReaction,
      render_plan_json: item.renderPlan as Json,
      slot_index: item.slotIndex,
      title: item.title,
    })) as unknown as Json,
    runId: params.runId,
    userId: params.input.userId,
  });
}

export function buildReactionRenderPayload(params: {
  background: ReactionCatalogBackground | undefined;
  clip: ReactionCatalogClip | undefined;
  item: Awaited<ReturnType<SupabaseJobStore["persistReactionGenerationPlan"]>>[number];
}): RenderReactionVideoPayload {
  if (!params.clip?.sourceStorageKey || !params.background?.sourceStorageKey) {
    throw new Error("A planned Reaction item no longer has renderable catalog sources.");
  }
  const content = record(params.item.content_json);
  const renderPlan = record(params.item.render_plan_json);
  const text = record(renderPlan?.text);
  const foreground = record(renderPlan?.foreground);
  const lines = Array.isArray(text?.lines) && text.lines.every((line) => typeof line === "string")
    ? text.lines
    : null;
  const treatment = text?.treatment;
  const anchor = foreground?.anchor;
  const heightPercent = foreground?.heightPercent;
  if (!lines || !isTreatment(treatment) || !isAnchor(anchor) || typeof heightPercent !== "number" || !Number.isFinite(heightPercent) || heightPercent < 0.25 || heightPercent > 0.9 || content?.caption !== params.item.caption) {
    throw new Error("A persisted Reaction render plan is invalid.");
  }
  return {
    backgroundStorageKey: params.background.sourceStorageKey,
    captionLines: lines,
    creativeId: params.item.reaction_creative_id,
    durationSeconds: params.item.duration_seconds,
    foreground: { anchor, heightPercent },
    foregroundStorageKey: params.clip.sourceStorageKey,
    renderId: params.item.id,
    treatment,
  };
}

export function toReactionCatalogClip(row: {
  composition: string | null; duration_seconds: number; foreground_anchor: string | null;
  foreground_height_percent: number | null; has_alpha: boolean; id: string; reactions: string[];
  source_storage_key: string | null; status: string; subject_count: string | null;
}): ReactionCatalogClip {
  return {
    composition: row.composition,
    durationSeconds: Number(row.duration_seconds),
    foregroundAnchor: row.foreground_anchor,
    foregroundHeightPercent: row.foreground_height_percent === null ? null : Number(row.foreground_height_percent),
    hasAlpha: row.has_alpha,
    id: row.id,
    reactions: row.reactions,
    sourceStorageKey: row.source_storage_key,
    status: row.status,
    subjectCount: row.subject_count,
  };
}

export function toReactionCatalogBackground(row: {
  context_tags: string[]; foreground_placement: string | null; id: string;
  source_storage_key: string | null; status: string;
}): ReactionCatalogBackground {
  return {
    contextTags: row.context_tags,
    foregroundPlacement: row.foreground_placement,
    id: row.id,
    sourceStorageKey: row.source_storage_key,
    status: row.status,
  };
}

function parseInput(job: BackgroundJobRow) {
  const input = record(job.input_json);
  const userId = stringValue(input?.userId);
  const businessProfileId = stringValue(input?.businessProfileId);
  const projectId = stringValue(input?.projectId);
  const requestKey = stringValue(input?.requestKey);
  const businessProfileVersion = input?.businessProfileVersion;
  const requestedCount = input?.requestedCount;
  const generationContext = parseGenerationContext(input?.generationContext);
  const generationOrigin = typeof input?.generationOrigin === "string" ? input.generationOrigin : null;
  if (
    !job.user_id || job.user_id !== userId || !job.project_id || job.project_id !== projectId || !businessProfileId || !projectId || !requestKey ||
    !Number.isInteger(businessProfileVersion) || typeof businessProfileVersion !== "number" || businessProfileVersion < 1 ||
    !Number.isInteger(requestedCount) || typeof requestedCount !== "number" || requestedCount < 1 || requestedCount > 12 ||
    !generationContext || (generationOrigin !== null && generationOrigin !== "business_generation")
  ) {
    throw new Error("reaction_generation input is invalid.");
  }
  return { businessProfileId, businessProfileVersion, generationContext, generationOrigin, projectId, requestKey, requestedCount, userId };
}

function parseGenerationContext(value: Json | undefined): ReactionGenerationContext | null {
  const input = record(value);
  if (!input) return null;
  const audience = stringArray(input.audience);
  const pains = stringArray(input.pains);
  const commonSituations = stringArray(input.commonSituations);
  const desiredOutcomes = stringArray(input.desiredOutcomes);
  if (!audience || !pains || !commonSituations || !desiredOutcomes) return null;
  return {
    audience,
    commonSituations,
    desiredOutcomes,
    pains,
    productName: typeof input.productName === "string" ? input.productName.trim().slice(0, 160) || null : null,
  };
}

function record(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function stringValue(value: Json | undefined) { return typeof value === "string" ? value.trim() : ""; }
function stringArray(value: Json | undefined) { return Array.isArray(value) && value.length <= 12 && value.every((item) => typeof item === "string") ? value.map((item) => item.trim()).filter(Boolean).slice(0, 12) : null; }
function isTreatment(value: Json | undefined): value is "caption_with_labels" | "outlined_text" | "white_card" { return value === "caption_with_labels" || value === "outlined_text" || value === "white_card"; }
function isAnchor(value: Json | undefined): value is "bottom_center" | "bottom_left" | "bottom_right" | "center" { return value === "bottom_center" || value === "bottom_left" || value === "bottom_right" || value === "center"; }
