import {
  CAROUSEL_CONTENT_GRAMMAR,
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
  getCarouselContentFormat,
  isCarouselContentFormatId,
  isCarouselHookFamilyId,
  type CarouselContentFormatId,
  type CarouselHookFamilyId,
} from "./content-grammar.ts";
import type { CarouselPerformanceSignals } from "./performance-logic.ts";

export const CAROUSEL_CONTENT_SELECTOR_VERSION =
  "carousel-content-selector-v3-bounded-performance-learning";
export const CAROUSEL_EXPERIMENT_BATCH_SIZE = 5;
const FORMAT_GROUP_COUNT = 3;
const FORMAT_EXPLORATION_SLOTS_PER_BATCH = 1;
const HOOK_EXPLORATION_RATE = 0.25;

export type CarouselPerformanceSelectionMode =
  | "controlled_rotation"
  | "performance_exploration"
  | "performance_weighted";

export type CarouselRecentContentSummary = {
  angle: string | null;
  audienceId: string | null;
  contentFormatId: CarouselContentFormatId | null;
  hook: string | null;
  hookFamilyId: CarouselHookFamilyId | null;
  topic: string | null;
  topicId: string | null;
};

export type CarouselContentAssignment = {
  assignedContentFormatId: CarouselContentFormatId;
  contentFormatId: CarouselContentFormatId;
  formatSelectionMode: CarouselPerformanceSelectionMode;
  formatSelectionMultiplier: number;
  formatVersion: number;
  grammarVersion: string;
  historySnapshot: CarouselRecentContentSummary[];
  hookFamilyId: CarouselHookFamilyId;
  hookSelectionMode: CarouselPerformanceSelectionMode;
  hookSelectionMultiplier: number;
  rotationCandidateContentFormatId: CarouselContentFormatId;
  selectorVersion: string;
};

export type CarouselExperimentBatchAssignment = CarouselContentAssignment & {
  slotIndex: number;
};

export function selectCarouselExperimentBatch(params: {
  batchSequence: number;
  history: readonly CarouselRecentContentSummary[];
  performanceSignals?: CarouselPerformanceSignals;
  reserved?: ReadonlyMap<number, Partial<CarouselContentAssignment>>;
  selectionKey?: string;
  topicOptionCount: number;
}) {
  const batchSequence = Math.max(Math.trunc(params.batchSequence), 0);
  const historySnapshot = params.history.slice(0, 10).map(normalizeHistory);
  const rotationFormats = getFormatsForBatch({
    batchSequence,
    topicOptionCount: params.topicOptionCount,
  });
  const selectedFormats = selectFormatsForBatch({
    batchSequence,
    performanceSignals: params.performanceSignals,
    rotationFormats,
    selectionKey: params.selectionKey ?? "carousel",
  });

  return selectedFormats.map((selectedFormat, slotIndex) => {
    const reserved = params.reserved?.get(slotIndex);
    const contentFormatId = isCarouselContentFormatId(reserved?.contentFormatId)
      ? reserved.contentFormatId
      : selectedFormat.contentFormatId;
    const format = getCarouselContentFormat(contentFormatId);
    const selectedHook = selectHookFamilyForFormat({
      batchSequence,
      contentFormatId,
      performanceSignals: params.performanceSignals,
      selectionKey: params.selectionKey ?? "carousel",
    });
    const hookFamilyId =
      isCarouselHookFamilyId(reserved?.hookFamilyId) &&
      format.compatibleHookFamilies.includes(reserved.hookFamilyId)
        ? reserved.hookFamilyId
        : selectedHook.hookFamilyId;

    return {
      assignedContentFormatId: selectedFormat.contentFormatId,
      contentFormatId,
      formatSelectionMode: selectedFormat.selectionMode,
      formatSelectionMultiplier: selectedFormat.selectionMultiplier,
      formatVersion: format.version,
      grammarVersion: CAROUSEL_CONTENT_GRAMMAR_VERSION,
      historySnapshot,
      hookFamilyId,
      hookSelectionMode: selectedHook.selectionMode,
      hookSelectionMultiplier: getHookMultiplier({
        contentFormatId,
        hookFamilyId,
        performanceSignals: params.performanceSignals,
      }),
      rotationCandidateContentFormatId:
        selectedFormat.rotationCandidateContentFormatId,
      selectorVersion: CAROUSEL_CONTENT_SELECTOR_VERSION,
      slotIndex,
    } satisfies CarouselExperimentBatchAssignment;
  });
}

/**
 * Compatibility wrapper for callers that reserve more than one experiment
 * batch at once. Every five outputs are still selected as an independent,
 * controlled batch.
 */
export function selectCarouselContentAssignments(params: {
  batchSequence?: number;
  candidateCount: number;
  history: readonly CarouselRecentContentSummary[];
  performanceSignals?: CarouselPerformanceSignals;
  reserved?: ReadonlyMap<number, Partial<CarouselContentAssignment>>;
  seed: string;
  topicOptionCount: number;
}) {
  const candidateCount = Math.min(
    Math.max(Math.trunc(params.candidateCount), 0),
    50,
  );
  const batchCount = Math.ceil(candidateCount / CAROUSEL_EXPERIMENT_BATCH_SIZE);
  const assignments: CarouselContentAssignment[] = [];

  for (let batchOffset = 0; batchOffset < batchCount; batchOffset += 1) {
    const reserved = new Map<number, Partial<CarouselContentAssignment>>();

    for (let slotIndex = 0; slotIndex < CAROUSEL_EXPERIMENT_BATCH_SIZE; slotIndex += 1) {
      const candidateIndex =
        batchOffset * CAROUSEL_EXPERIMENT_BATCH_SIZE + slotIndex;
      const value = params.reserved?.get(candidateIndex);

      if (value) reserved.set(slotIndex, value);
    }

    assignments.push(
      ...selectCarouselExperimentBatch({
        batchSequence: (params.batchSequence ?? 0) + batchOffset,
        history: params.history,
        performanceSignals: params.performanceSignals,
        reserved,
        selectionKey: params.seed,
        topicOptionCount: params.topicOptionCount,
      }),
    );
  }

  return assignments.slice(0, candidateCount);
}

function getFormatsForBatch(params: {
  batchSequence: number;
  topicOptionCount: number;
}) {
  const formats = [...CAROUSEL_CONTENT_GRAMMAR.formats].sort(
    (left, right) => left.rotationOrder - right.rotationOrder,
  );
  const cycleNumber = Math.floor(params.batchSequence / FORMAT_GROUP_COUNT);
  const positionInCycle = params.batchSequence % FORMAT_GROUP_COUNT;
  const firstGroupInCycle = cycleNumber % FORMAT_GROUP_COUNT;
  const groupIndex = (firstGroupInCycle + positionInCycle) % FORMAT_GROUP_COUNT;
  const group = formats.slice(
    groupIndex * CAROUSEL_EXPERIMENT_BATCH_SIZE,
    (groupIndex + 1) * CAROUSEL_EXPERIMENT_BATCH_SIZE,
  );
  const positionRotation = cycleNumber % CAROUSEL_EXPERIMENT_BATCH_SIZE;
  const rotated = [
    ...group.slice(positionRotation),
    ...group.slice(0, positionRotation),
  ];

  // Applicability is finally decided by the batch LLM. Keeping every assigned
  // format here preserves the controlled experiment instead of silently
  // replacing a format before it has been tried.
  void params.topicOptionCount;
  return rotated;
}

function selectHookFamilyForFormat(params: {
  batchSequence: number;
  contentFormatId: CarouselContentFormatId;
  performanceSignals?: CarouselPerformanceSignals;
  selectionKey: string;
}) {
  const format = getCarouselContentFormat(params.contentFormatId);
  const controlledIndex =
    Math.floor(params.batchSequence / FORMAT_GROUP_COUNT) %
    format.compatibleHookFamilies.length;
  const controlledHookFamilyId =
    format.compatibleHookFamilies[controlledIndex]!;
  const learnedMultipliers = getQualifiedHookMultipliers({
    contentFormatId: params.contentFormatId,
    performanceSignals: params.performanceSignals,
  });

  if (!learnedMultipliers) {
    return {
      hookFamilyId: controlledHookFamilyId,
      selectionMode: "controlled_rotation" as const,
    };
  }

  const explorationValue = stableUnitInterval(
    `${params.selectionKey}:${params.batchSequence}:${params.contentFormatId}:hook-exploration`,
  );

  if (explorationValue < HOOK_EXPLORATION_RATE) {
    return {
      hookFamilyId: controlledHookFamilyId,
      selectionMode: "performance_exploration" as const,
    };
  }

  const selected = [...format.compatibleHookFamilies]
    .map((hookFamilyId) => ({
      hookFamilyId,
      priority: getWeightedPriority({
        key: `${params.selectionKey}:${params.batchSequence}:${params.contentFormatId}:${hookFamilyId}:hook`,
        weight: learnedMultipliers[hookFamilyId] ?? 1,
      }),
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.hookFamilyId.localeCompare(right.hookFamilyId),
    )[0]?.hookFamilyId;

  return {
    hookFamilyId: selected ?? controlledHookFamilyId,
    selectionMode: "performance_weighted" as const,
  };
}

function selectFormatsForBatch(params: {
  batchSequence: number;
  performanceSignals?: CarouselPerformanceSignals;
  rotationFormats: ReturnType<typeof getFormatsForBatch>;
  selectionKey: string;
}) {
  const learnedMultipliers = getQualifiedFormatMultipliers(
    params.performanceSignals,
  );

  if (!learnedMultipliers) {
    return params.rotationFormats.map((format) => ({
      contentFormatId: format.id,
      rotationCandidateContentFormatId: format.id,
      selectionMode: "controlled_rotation" as const,
      selectionMultiplier: 1,
    }));
  }

  const explorationSlotIndex =
    params.batchSequence % CAROUSEL_EXPERIMENT_BATCH_SIZE;
  const explorationFormat = params.rotationFormats[explorationSlotIndex]!;
  const weightedFormats = CAROUSEL_CONTENT_GRAMMAR.formats
    .filter((format) => format.id !== explorationFormat.id)
    .map((format) => ({
      contentFormatId: format.id,
      priority: getWeightedPriority({
        key: `${params.selectionKey}:${params.batchSequence}:${format.id}:format`,
        weight:
          format.selectionWeight * (learnedMultipliers[format.id] ?? 1),
      }),
      selectionMultiplier: learnedMultipliers[format.id] ?? 1,
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.contentFormatId.localeCompare(right.contentFormatId),
    )
    .slice(
      0,
      CAROUSEL_EXPERIMENT_BATCH_SIZE - FORMAT_EXPLORATION_SLOTS_PER_BATCH,
    );
  const selected: Array<{
    contentFormatId: CarouselContentFormatId;
    rotationCandidateContentFormatId: CarouselContentFormatId;
    selectionMode: CarouselPerformanceSelectionMode;
    selectionMultiplier: number;
  }> = weightedFormats.map((format) => ({
    contentFormatId: format.contentFormatId,
    rotationCandidateContentFormatId: format.contentFormatId,
    selectionMode: "performance_weighted" as const,
    selectionMultiplier: format.selectionMultiplier,
  }));

  selected.splice(explorationSlotIndex, 0, {
    contentFormatId: explorationFormat.id,
    rotationCandidateContentFormatId: explorationFormat.id,
    selectionMode: "performance_exploration" as const,
    selectionMultiplier: learnedMultipliers[explorationFormat.id] ?? 1,
  });

  return selected.map((selection, slotIndex) => ({
    ...selection,
    rotationCandidateContentFormatId:
      params.rotationFormats[slotIndex]?.id ?? selection.contentFormatId,
  }));
}

function getQualifiedFormatMultipliers(
  performanceSignals?: CarouselPerformanceSignals,
) {
  const values = Object.entries(performanceSignals?.formatMultipliers ?? {})
    .filter(
      (entry): entry is [CarouselContentFormatId, number] =>
        isCarouselContentFormatId(entry[0]) && isValidMultiplier(entry[1]),
    );

  return values.length >= 2 ? Object.fromEntries(values) : null;
}

function getQualifiedHookMultipliers(params: {
  contentFormatId: CarouselContentFormatId;
  performanceSignals?: CarouselPerformanceSignals;
}) {
  const compatibleHookFamilies = new Set(
    getCarouselContentFormat(params.contentFormatId).compatibleHookFamilies,
  );
  const values = Object.entries(
    params.performanceSignals?.hookFamilyMultipliers?.[
      params.contentFormatId
    ] ?? {},
  ).filter(
    (entry): entry is [CarouselHookFamilyId, number] =>
      isCarouselHookFamilyId(entry[0]) &&
      compatibleHookFamilies.has(entry[0]) &&
      isValidMultiplier(entry[1]),
  );

  return values.length >= 2 ? Object.fromEntries(values) : null;
}

function getHookMultiplier(params: {
  contentFormatId: CarouselContentFormatId;
  hookFamilyId: CarouselHookFamilyId;
  performanceSignals?: CarouselPerformanceSignals;
}) {
  const value =
    params.performanceSignals?.hookFamilyMultipliers?.[
      params.contentFormatId
    ]?.[params.hookFamilyId];

  return isValidMultiplier(value) ? value : 1;
}

function getWeightedPriority(params: { key: string; weight: number }) {
  const unit = stableUnitInterval(params.key);
  return -Math.log(unit) / Math.max(params.weight, 0.01);
}

function stableUnitInterval(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return ((hash >>> 0) + 1) / 4_294_967_297;
}

function isValidMultiplier(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.5 &&
    value <= 2
  );
}

function normalizeHistory(
  item: CarouselRecentContentSummary,
): CarouselRecentContentSummary {
  return {
    angle: cleanOptional(item.angle, 160),
    audienceId: cleanOptional(item.audienceId, 100),
    contentFormatId: isCarouselContentFormatId(item.contentFormatId)
      ? item.contentFormatId
      : null,
    hook: cleanOptional(item.hook, 160),
    hookFamilyId: isCarouselHookFamilyId(item.hookFamilyId)
      ? item.hookFamilyId
      : null,
    topic: cleanOptional(item.topic, 160),
    topicId: cleanOptional(item.topicId, 100),
  };
}

function cleanOptional(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : null;
}
