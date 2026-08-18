import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  generateValidatedTrendingHookCopies,
  TRENDING_HOOK_PROMPT_VERSION,
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
  const copies = await generateValidatedTrendingHookCopies({
    businessProfile: input.businessProfile,
    candidates: input.candidates,
    model,
    performanceSignals: input.performanceSignals,
  });
  const persistedCount =
    await context.store.persistTrendingHookCopyGeneration({
      businessProfileId: input.businessProfileId,
      businessProfileVersion: input.businessProfileVersion,
      candidates: copies as unknown as Json,
      generatorModel: model,
      jobId: job.id,
      promptVersion: input.promptVersion,
      selectionVersion: input.selectionVersion,
      userId: input.userId,
    });

  if (persistedCount !== copies.length) {
    throw new Error(
      "Trending Hook copy persistence returned an unexpected count.",
    );
  }

  return {
    ideaCount: copies.length,
    model,
    promptVersion: input.promptVersion,
    repairedCount: copies.filter(
      (copy) => copy.readabilityReview.repairApplied,
    ).length,
    selectionVersion: input.selectionVersion,
  };
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

  if (
    !job.user_id ||
    job.user_id !== userId ||
    promptVersion !== TRENDING_HOOK_PROMPT_VERSION ||
    selectionVersion !== TRENDING_HOOK_SELECTION_VERSION ||
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
    selectionVersion,
    userId,
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

  if (formatSignals.length > 18 || purposes.length > 3) {
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
