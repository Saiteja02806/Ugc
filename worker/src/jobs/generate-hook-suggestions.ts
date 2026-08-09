import {
  generateValidatedTrendingHookCopies,
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
  type TrendingHookCopyCandidate,
} from "../lib/trending-hook-copy.js";
import {
  getTrendingHookPattern,
  isTrendingHookCampaignPurpose,
  type HookPerformanceSignals,
  type TrendingHookPatternId,
} from "../lib/trending-hook-patterns.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

const DEFAULT_SUGGESTION_COUNT = 6;
const MIN_SUGGESTION_COUNT = 4;
const MAX_SUGGESTION_COUNT = 8;

export async function runGenerateHookSuggestionsJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  const input = parseInput(job);
  const model =
    process.env.OPENAI_TRENDING_HOOK_MODEL?.trim() ||
    "gpt-5.6-terra";
  const candidates = Array.from(
    { length: input.suggestionCount },
    (_, candidateIndex): TrendingHookCopyCandidate => ({
      ...input.candidate,
      candidateIndex,
    }),
  );

  await context.checkpoint({
    progress: null,
    stage: "generating_validated_hook_suggestions",
    status: "waiting_external_service",
  });
  const copies = await generateValidatedTrendingHookCopies({
    businessProfile: input.businessProfile,
    candidates,
    model,
    performanceSignals: input.performanceSignals,
  });
  await context.checkpoint({
    progress: null,
    stage: "persisting_validated_hook_suggestions",
    status: "processing",
  });
  const suggestions =
    await context.store.persistValidatedHookCompositionGeneration({
      businessProfileId: input.businessProfileId,
      businessProfileVersion: input.businessProfileVersion,
      candidates: copies as unknown as Json,
      demoAssetId: input.demoAssetId,
      generatorModel: model,
      jobId: job.id,
      promptVersion: input.promptVersion,
      selectionVersion: input.selectionVersion,
      userId: input.userId,
    });

  if (suggestions.length !== copies.length) {
    throw new Error(
      "Validated Hook composition persistence returned an unexpected count.",
    );
  }

  return {
    demoAssetId: input.demoAssetId,
    influencerId: input.candidate.influencerId,
    influencerVideoId: input.candidate.influencerVideoId,
    model,
    ok: true,
    operation: "composition_suggestions",
    promptVersion: input.promptVersion,
    selectionVersion: input.selectionVersion,
    suggestions,
  } as Record<string, Json | undefined>;
}

function parseInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);
  const userId = getRequiredString(input?.userId, "userId");
  const promptVersion = getRequiredString(
    input?.promptVersion,
    "promptVersion",
  );
  const selectionVersion = getRequiredString(
    input?.selectionVersion,
    "selectionVersion",
  );
  const businessProfile = getRecord(input?.businessProfile);
  const suggestionCount = getInteger(input?.suggestionCount);

  if (
    !job.user_id ||
    job.user_id !== userId ||
    input?.operation !== "composition_suggestions" ||
    promptVersion !== TRENDING_HOOK_PROMPT_VERSION ||
    selectionVersion !== TRENDING_HOOK_SELECTION_VERSION ||
    !businessProfile ||
    suggestionCount === null ||
    suggestionCount < MIN_SUGGESTION_COUNT ||
    suggestionCount > MAX_SUGGESTION_COUNT
  ) {
    throw new Error(
      "hook_text_generation input does not match the validated composition contract.",
    );
  }

  return {
    businessProfile,
    businessProfileId: getRequiredString(
      input.businessProfileId,
      "businessProfileId",
    ),
    businessProfileVersion: getPositiveInteger(
      input.businessProfileVersion,
      "businessProfileVersion",
    ),
    candidate: parseCandidate(input.candidate),
    demoAssetId: getRequiredString(input.demoAssetId, "demoAssetId"),
    performanceSignals: parsePerformanceSignals(input.performanceSignals),
    promptVersion,
    selectionVersion,
    suggestionCount: suggestionCount || DEFAULT_SUGGESTION_COUNT,
    userId,
  };
}

function parseCandidate(value: Json | undefined) {
  const candidate = getRecord(value);
  const sourceKind = getRequiredString(candidate?.sourceKind, "sourceKind");

  if (sourceKind !== "catalog" && sourceKind !== "user") {
    throw new Error("hook_text_generation has invalid input.sourceKind.");
  }

  return {
    durationSeconds: getPositiveNumber(
      candidate?.durationSeconds,
      "durationSeconds",
    ),
    influencerId: getRequiredString(candidate?.influencerId, "influencerId"),
    influencerKey: getOptionalString(candidate?.influencerKey),
    influencerName: getRequiredString(
      candidate?.influencerName,
      "influencerName",
    ),
    influencerVideoId: getRequiredString(
      candidate?.influencerVideoId,
      "influencerVideoId",
    ),
    influencerVideoTitle: getRequiredString(
      candidate?.influencerVideoTitle,
      "influencerVideoTitle",
    ),
    reactionType: getOptionalString(candidate?.reactionType),
    sourceDurationSeconds: getPositiveNumber(
      candidate?.sourceDurationSeconds,
      "sourceDurationSeconds",
    ),
    sourceKind,
    thumbnailUrl: getOptionalString(candidate?.thumbnailUrl),
    trimEnd:
      candidate?.trimEnd === null || candidate?.trimEnd === undefined
        ? null
        : getPositiveNumber(candidate.trimEnd, "trimEnd"),
    trimStart: getNonNegativeNumber(candidate?.trimStart, "trimStart"),
    visualGroup: getOptionalString(candidate?.visualGroup),
  } satisfies Omit<TrendingHookCopyCandidate, "candidateIndex">;
}

function parsePerformanceSignals(value: Json | undefined): HookPerformanceSignals {
  const signals = getRecord(value);
  const preferredPatternIds = Array.isArray(signals?.preferredPatternIds)
    ? signals.preferredPatternIds.filter(
        (patternId): patternId is TrendingHookPatternId =>
          typeof patternId === "string" && Boolean(getTrendingHookPattern(patternId)),
      )
    : [];
  const preferredPurposes = Array.isArray(signals?.preferredPurposes)
    ? signals.preferredPurposes.filter(isTrendingHookCampaignPurpose)
    : [];

  if (preferredPatternIds.length > 3 || preferredPurposes.length > 3) {
    throw new Error(
      "hook_text_generation performance signals exceed the bounded contract.",
    );
  }

  return {
    preferredPatternIds: [...new Set(preferredPatternIds)],
    preferredPurposes: [...new Set(preferredPurposes)],
  };
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getRequiredString(value: Json | undefined, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`hook_text_generation requires input.${field}.`);
  }

  return value.trim();
}

function getOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getInteger(value: Json | undefined) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getPositiveInteger(value: Json | undefined, field: string) {
  const parsed = getInteger(value);

  if (parsed === null || parsed <= 0) {
    throw new Error(
      `hook_text_generation requires positive input.${field}.`,
    );
  }

  return parsed;
}

function getPositiveNumber(value: Json | undefined, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `hook_text_generation requires positive input.${field}.`,
    );
  }

  return value;
}

function getNonNegativeNumber(value: Json | undefined, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `hook_text_generation requires non-negative input.${field}.`,
    );
  }

  return value;
}
