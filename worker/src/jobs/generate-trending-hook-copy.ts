import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  generateReactionMappedTrendingHooks,
  generateValidatedTrendingHookCopies,
  TRENDING_HOOK_FEED_GENERATION_MODE,
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_REACTION_SELECTION_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
  type TrendingHookCopyCandidate,
} from "../lib/trending-hook-copy.js";
import {
  isTrendingHookCampaignPurpose,
} from "../lib/trending-hook-patterns.js";
import {
  getHookTextFormat,
  type HookTextFormatId,
  type HookTextPerformanceSignals,
} from "../lib/trending-hook-text-formats.js";
import type {
  BackgroundJobRow,
  Json,
} from "../types.js";
import { RetryableJobError } from "../retryable-job-error.js";

export async function runGenerateTrendingHookCopyJob(
  job: BackgroundJobRow,
  context: {
    store: SupabaseJobStore;
  },
) {
  const input = parseInput(job);
  const model =
    process.env.OPENAI_TRENDING_HOOK_MODEL?.trim() ||
    "gpt-5.6-terra";
  const existingProgress = input.generationRun
    ? await context.store.getTrendingHookGenerationRunChunkProgress({
        chunkId: input.generationRun.chunkId,
        jobId: job.id,
        runId: input.generationRun.id,
      })
    : null;

  // Persistence and background-job completion are separate durable actions.
  // If a retry arrives between them, return the saved progress before making
  // another paid model request.
  if (existingProgress?.already_persisted) {
    return {
      ideaCount: existingProgress.accepted_count,
      generationRun: {
        completedValidCount: existingProgress.completed_valid_count,
        id: input.generationRun!.id,
        remainingValidCount: existingProgress.remaining_valid_count,
        status: existingProgress.run_status,
        targetValidCount:
          existingProgress.completed_valid_count +
          existingProgress.remaining_valid_count,
      },
      model,
      promptVersion: input.promptVersion,
      rejectedCandidateCount: Math.max(
        input.candidates.length - existingProgress.accepted_count,
        0,
      ),
      repairedCount: 0,
      selectionVersion: input.selectionVersion,
    };
  }
  const copies =
    input.generationMode === TRENDING_HOOK_FEED_GENERATION_MODE
      ? await generateReactionMappedTrendingHooks({
          businessProfile: input.businessProfile,
          candidates: input.candidates,
          model,
          performanceSignals: input.performanceSignals,
        })
      : await generateValidatedTrendingHookCopies({
          allowPartialCandidates: true,
          businessProfile: input.businessProfile,
          candidates: input.candidates,
          model,
          performanceSignals: input.performanceSignals,
          selectionStrategy: input.selectionStrategy,
        });
  // The parent run owns the exact number of valid Hooks still needed. A final
  // chunk may validate more candidates than are still required, so only save
  // the remaining promised amount.
  const copiesToPersist = input.generationRun
    ? copies.slice(0, input.generationRun.remainingValidCount)
    : copies;

  // A durable run must make forward progress. Persisting an empty V2 chunk
  // marks the chunk complete while leaving its reserved candidates stranded;
  // the run then has no pending candidates to reserve and can sit in
  // continuation_pending forever. Treat an all-rejected chunk as retryable so
  // the physical job is retried and, if it remains impossible, the normal
  // terminal-failure path releases the reservation and schedules recovery.
  if (input.generationRun) {
    ensureTrendingHookChunkMakesProgress(
      input.generationRun.remainingValidCount,
      copiesToPersist.length,
    );
  }

  const runProgress = input.generationRun
    ? await context.store.persistTrendingHookGenerationRunChunk({
        appendOnly:
          input.generationMode === TRENDING_HOOK_FEED_GENERATION_MODE,
        businessProfileId: input.businessProfileId,
        businessProfileVersion: input.businessProfileVersion,
        candidates: copiesToPersist as unknown as Json,
        chunkId: input.generationRun.chunkId,
        generatorModel: model,
        jobId: job.id,
        promptVersion: input.promptVersion,
        runId: input.generationRun.id,
        selectionVersion: input.selectionVersion,
        userId: input.userId,
      })
    : null;
  const persistedCount = runProgress
    ? runProgress.accepted_count
    : await context.store.persistTrendingHookCopyGeneration({
        businessProfileId: input.businessProfileId,
        businessProfileVersion: input.businessProfileVersion,
        candidates: copiesToPersist as unknown as Json,
        generatorModel: model,
        jobId: job.id,
        promptVersion: input.promptVersion,
        selectionVersion: input.selectionVersion,
        userId: input.userId,
      });

  // A worker can retry after this chunk was saved but before its background
  // job was marked complete. The database then returns the saved count; do
  // not reject valid existing Hooks if the repeated AI call differs.
  if (
    persistedCount !== copiesToPersist.length &&
    runProgress?.already_persisted !== true
  ) {
    throw new Error(
      "Trending Hook copy persistence returned an unexpected count.",
    );
  }

  return {
    ideaCount: copiesToPersist.length,
    generationRun: runProgress
      ? {
          completedValidCount: runProgress.completed_valid_count,
          id: input.generationRun!.id,
          remainingValidCount: runProgress.remaining_valid_count,
          status: runProgress.run_status,
          targetValidCount:
            runProgress.completed_valid_count +
            runProgress.remaining_valid_count,
        }
      : null,
    model,
    promptVersion: input.promptVersion,
    rejectedCandidateCount: input.candidates.length - copiesToPersist.length,
    repairedCount: copiesToPersist.filter(
      (copy) => copy.readabilityReview.repairApplied,
    ).length,
    selectionVersion: input.selectionVersion,
  };
}

export function ensureTrendingHookChunkMakesProgress(
  remainingValidCount: number,
  persistedCandidateCount: number,
) {
  if (remainingValidCount <= 0 || persistedCandidateCount > 0) {
    return;
  }

  throw new RetryableJobError(
    "Trending Hook generation produced no valid copies for its reserved chunk.",
    {
      code: "trending_hook_generation_zero_progress",
      retryAfterSeconds: 15,
    },
  );
}

function parseInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);
  const userId = getRequiredString(input?.userId, "userId");
  const businessProfileId = getRequiredString(
    input?.businessProfileId,
    "businessProfileId",
  );
  const businessProfileVersion = getPositiveInteger(
    input?.businessProfileVersion,
    "businessProfileVersion",
  );
  const promptVersion = getRequiredString(
    input?.promptVersion,
    "promptVersion",
  );
  const selectionVersion = getRequiredString(
    input?.selectionVersion,
    "selectionVersion",
  );
  const businessProfile = getRecord(input?.businessProfile);
  const rawCandidates = input?.candidates;
  const generationRun = parseGenerationRun(input);
  const generationMode = getOptionalString(input?.generationMode);

  if (
    !job.user_id ||
    job.user_id !== userId ||
    promptVersion !== TRENDING_HOOK_PROMPT_VERSION ||
    (selectionVersion !== TRENDING_HOOK_SELECTION_VERSION &&
      selectionVersion !== TRENDING_HOOK_REACTION_SELECTION_VERSION) ||
    (generationMode !== null &&
      generationMode !== TRENDING_HOOK_FEED_GENERATION_MODE) ||
    (generationMode === TRENDING_HOOK_FEED_GENERATION_MODE &&
      (!generationRun ||
        selectionVersion !== TRENDING_HOOK_REACTION_SELECTION_VERSION)) ||
    !businessProfile ||
    !Array.isArray(rawCandidates)
  ) {
    throw new Error(
      "generate_trending_hook_copy input does not match the current job contract.",
    );
  }

  return {
    businessProfile,
    businessProfileId,
    businessProfileVersion,
    candidates: rawCandidates.map(parseCandidate),
    performanceSignals: parsePerformanceSignals(input?.performanceSignals),
    promptVersion,
    selectionStrategy:
      selectionVersion === TRENDING_HOOK_REACTION_SELECTION_VERSION
        ? ("reaction_mapped" as const)
        : ("legacy_rotation" as const),
    selectionVersion,
    generationRun,
    generationMode,
    userId,
  };
}

function parseGenerationRun(
  value: { [key: string]: Json | undefined } | null,
) {
  const runId = getOptionalString(value?.generationRunId);
  const chunkId = getOptionalString(value?.generationRunChunkId);
  const remainingValidCount = value?.generationRunRemainingValidCount;

  if (!runId && !chunkId && (remainingValidCount === null || remainingValidCount === undefined)) {
    return null;
  }

  if (!runId || !chunkId) {
    throw new Error(
      "generate_trending_hook_copy has an incomplete durable generation run input.",
    );
  }

  return {
    chunkId,
    id: runId,
    remainingValidCount: getPositiveInteger(
      remainingValidCount,
      "generationRunRemainingValidCount",
    ),
  };
}

function parsePerformanceSignals(
  value: Json | undefined,
): HookTextPerformanceSignals {
  const signals = getRecord(value);
  const formatSignals = Array.isArray(signals?.formatSignals)
    ? signals.formatSignals.map(parseFormatPerformanceSignal)
    : [];
  const purposes = Array.isArray(signals?.preferredPurposes)
    ? signals.preferredPurposes.filter(isTrendingHookCampaignPurpose)
    : [];

  if (formatSignals.length > 20 || purposes.length > 3) {
    throw new Error(
      "generate_trending_hook_copy performance signals exceed the bounded contract.",
    );
  }

  return {
    formatSignals: [
      ...new Map(
        formatSignals.map((signal) => [signal.formatId, signal]),
      ).values(),
    ],
    preferredPurposes: [...new Set(purposes)],
  };
}

function parseFormatPerformanceSignal(value: Json) {
  const signal = getRecord(value);
  const formatId = getRequiredString(
    signal?.formatId,
    "performanceSignals.formatSignals.formatId",
  );

  if (!getHookTextFormat(formatId)) {
    throw new Error(
      "generate_trending_hook_copy has an invalid Hook text format signal.",
    );
  }

  const selectionWeight = getNonNegativeNumber(
    signal?.selectionWeight,
    "performanceSignals.formatSignals.selectionWeight",
  );
  const temporaryBoost = getNonNegativeNumber(
    signal?.temporaryBoost,
    "performanceSignals.formatSignals.temporaryBoost",
  );

  if (selectionWeight > 1.3 || temporaryBoost > 0.12) {
    throw new Error(
      "generate_trending_hook_copy has an out-of-range Hook text format signal.",
    );
  }

  return {
    formatId: formatId as HookTextFormatId,
    lastGeneratedAt: getOptionalString(signal?.lastGeneratedAt),
    publishedResultCount: getNonNegativeInteger(
      signal?.publishedResultCount,
      "performanceSignals.formatSignals.publishedResultCount",
    ),
    selectionWeight,
    temporaryBoost,
    timesGenerated: getNonNegativeInteger(
      signal?.timesGenerated,
      "performanceSignals.formatSignals.timesGenerated",
    ),
  };
}

function parseCandidate(
  value: Json,
): TrendingHookCopyCandidate {
  const candidate = getRecord(value);
  const sourceKind = getRequiredString(
    candidate?.sourceKind,
    "sourceKind",
  );

  if (sourceKind !== "catalog" && sourceKind !== "user") {
    throw new Error(
      "generate_trending_hook_copy has invalid input.sourceKind.",
    );
  }

  return {
    candidateIndex: getNonNegativeInteger(
      candidate?.candidateIndex,
      "candidateIndex",
    ),
    durationSeconds: getPositiveNumber(
      candidate?.durationSeconds,
      "durationSeconds",
    ),
    influencerId: getRequiredString(
      candidate?.influencerId,
      "influencerId",
    ),
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
      candidate?.trimEnd === null ||
      candidate?.trimEnd === undefined
        ? null
        : getPositiveNumber(candidate.trimEnd, "trimEnd"),
    trimStart: getNonNegativeNumber(
      candidate?.trimStart,
      "trimStart",
    ),
    visualGroup: getOptionalString(candidate?.visualGroup),
  };
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getRequiredString(value: Json | undefined, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `generate_trending_hook_copy requires input.${field}.`,
    );
  }

  return value.trim();
}

function getOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function getPositiveInteger(value: Json | undefined, field: string) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `generate_trending_hook_copy requires positive input.${field}.`,
    );
  }

  return value;
}

function getNonNegativeInteger(
  value: Json | undefined,
  field: string,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `generate_trending_hook_copy requires non-negative input.${field}.`,
    );
  }

  return value;
}

function getPositiveNumber(value: Json | undefined, field: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `generate_trending_hook_copy requires positive input.${field}.`,
    );
  }

  return value;
}

function getNonNegativeNumber(
  value: Json | undefined,
  field: string,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `generate_trending_hook_copy requires non-negative input.${field}.`,
    );
  }

  return value;
}
