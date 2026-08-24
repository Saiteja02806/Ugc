import {
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY,
  CAROUSEL_STRUCTURE_2_FORMATS_VERSION,
  getCarouselStructure2Format,
  isCarouselStructure2FormatId,
  resolveCarouselStructure2FormatId,
  type CarouselStructure2FormatId,
} from "./structure-2-formats.ts";

export const CAROUSEL_STRUCTURE_2_SELECTOR_VERSION =
  "carousel-structure-2-selector-v1-eight-format-rotation";
export const CAROUSEL_STRUCTURE_2_BATCH_SIZE = 5;
export const CAROUSEL_STRUCTURE_2_HISTORY_LIMIT = 10;
const PERFORMANCE_EXPLORATION_SLOTS_PER_BATCH = 1;

export type CarouselStructure2FormatSelectionMode =
  | "controlled_rotation"
  | "performance_exploration"
  | "performance_weighted";

export type CarouselStructure2RecentHistory = {
  centralProblem: string | null;
  ctaAngle: string | null;
  hookIdea: string | null;
  storyAngle: string | null;
  storyFormatId: CarouselStructure2FormatId | null;
  summary: string | null;
};

export type CarouselStructure2PerformanceSignals = {
  formatMultipliers?: Partial<Record<CarouselStructure2FormatId, number>>;
};

export type CarouselStructure2FormatAssignment = {
  assignedStoryFormatId: CarouselStructure2FormatId;
  formatSelectionMode: CarouselStructure2FormatSelectionMode;
  formatSelectionMultiplier: number;
  formatVersion: number;
  grammarVersion: string;
  historySnapshot: CarouselStructure2RecentHistory[];
  rotationCandidateStoryFormatId: CarouselStructure2FormatId;
  selectorVersion: string;
  slotIndex: number;
  storyFormatId: CarouselStructure2FormatId;
};

type CarouselStructure2SelectedFormat = {
  rotationCandidateStoryFormatId: CarouselStructure2FormatId;
  selectionMode: CarouselStructure2FormatSelectionMode;
  selectionMultiplier: number;
  storyFormatId: CarouselStructure2FormatId;
};

export function selectCarouselStructure2ExperimentBatch(params: {
  batchSequence: number;
  history: readonly CarouselStructure2RecentHistory[];
  performanceSignals?: CarouselStructure2PerformanceSignals;
  reserved?: ReadonlyMap<
    number,
    Partial<CarouselStructure2FormatAssignment>
  >;
  selectionKey?: string;
}) {
  const batchSequence = normalizeBatchSequence(params.batchSequence);
  const historySnapshot = params.history
    .slice(0, CAROUSEL_STRUCTURE_2_HISTORY_LIMIT)
    .map(normalizeHistory);
  const rotationFormats = getCarouselStructure2RotationFormats(batchSequence);
  const selections = selectFormats({
    batchSequence,
    performanceSignals: params.performanceSignals,
    rotationFormats,
    selectionKey: params.selectionKey ?? "carousel-structure-2",
  });

  return selections.map((selection, slotIndex) => {
    const reserved = params.reserved?.get(slotIndex);
    const assignedStoryFormatId = isCarouselStructure2FormatId(
      reserved?.assignedStoryFormatId,
    )
      ? reserved.assignedStoryFormatId
      : selection.storyFormatId;
    const storyFormatId = isCarouselStructure2FormatId(
      reserved?.storyFormatId,
    )
      ? reserved.storyFormatId
      : assignedStoryFormatId;
    const rotationCandidateStoryFormatId = isCarouselStructure2FormatId(
      reserved?.rotationCandidateStoryFormatId,
    )
      ? reserved.rotationCandidateStoryFormatId
      : selection.rotationCandidateStoryFormatId;
    const format = getCarouselStructure2Format(storyFormatId);

    return {
      assignedStoryFormatId,
      formatSelectionMode: isSelectionMode(reserved?.formatSelectionMode)
        ? reserved.formatSelectionMode
        : selection.selectionMode,
      formatSelectionMultiplier: isValidMultiplier(
        reserved?.formatSelectionMultiplier,
      )
        ? reserved.formatSelectionMultiplier
        : selection.selectionMultiplier,
      formatVersion: format.version,
      grammarVersion: CAROUSEL_STRUCTURE_2_FORMATS_VERSION,
      historySnapshot,
      rotationCandidateStoryFormatId,
      selectorVersion: CAROUSEL_STRUCTURE_2_SELECTOR_VERSION,
      slotIndex,
      storyFormatId,
    } satisfies CarouselStructure2FormatAssignment;
  });
}

export function getCarouselStructure2RotationFormats(batchSequence: number) {
  const formats = [...CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats].sort(
    (left, right) => left.rotationOrder - right.rotationOrder,
  );
  const startIndex =
    (normalizeBatchSequence(batchSequence) *
      CAROUSEL_STRUCTURE_2_BATCH_SIZE) %
    formats.length;

  return Array.from(
    { length: CAROUSEL_STRUCTURE_2_BATCH_SIZE },
    (_, offset) => formats[(startIndex + offset) % formats.length]!,
  );
}

function selectFormats(params: {
  batchSequence: number;
  performanceSignals?: CarouselStructure2PerformanceSignals;
  rotationFormats: ReturnType<typeof getCarouselStructure2RotationFormats>;
  selectionKey: string;
}) {
  const learnedMultipliers = getQualifiedFormatMultipliers(
    params.performanceSignals,
  );

  if (!learnedMultipliers) {
    return params.rotationFormats.map((format) => ({
      rotationCandidateStoryFormatId: format.id,
      selectionMode: "controlled_rotation" as const,
      selectionMultiplier: 1,
      storyFormatId: format.id,
    }));
  }

  const explorationSlotIndex =
    params.batchSequence % CAROUSEL_STRUCTURE_2_BATCH_SIZE;
  const explorationFormat = params.rotationFormats[explorationSlotIndex]!;
  const weightedFormats = CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats
    .filter((format) => format.id !== explorationFormat.id)
    .map((format) => ({
      priority: getWeightedPriority({
        key: `${params.selectionKey}:${params.batchSequence}:${format.id}:structure-2-format`,
        weight:
          format.selectionWeight * (learnedMultipliers[format.id] ?? 1),
      }),
      selectionMultiplier: learnedMultipliers[format.id] ?? 1,
      storyFormatId: format.id,
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.storyFormatId.localeCompare(right.storyFormatId),
    )
    .slice(
      0,
      CAROUSEL_STRUCTURE_2_BATCH_SIZE -
        PERFORMANCE_EXPLORATION_SLOTS_PER_BATCH,
    );
  const selected: CarouselStructure2SelectedFormat[] = weightedFormats.map(
    (format) => ({
      rotationCandidateStoryFormatId: format.storyFormatId,
      selectionMode: "performance_weighted",
      selectionMultiplier: format.selectionMultiplier,
      storyFormatId: format.storyFormatId,
    }),
  );

  selected.splice(explorationSlotIndex, 0, {
    rotationCandidateStoryFormatId: explorationFormat.id,
    selectionMode: "performance_exploration" as const,
    selectionMultiplier: learnedMultipliers[explorationFormat.id] ?? 1,
    storyFormatId: explorationFormat.id,
  });

  return selected.map((selection, slotIndex) => ({
    ...selection,
    rotationCandidateStoryFormatId:
      params.rotationFormats[slotIndex]?.id ?? selection.storyFormatId,
  }));
}

function getQualifiedFormatMultipliers(
  performanceSignals?: CarouselStructure2PerformanceSignals,
) {
  const values = Object.entries(
    performanceSignals?.formatMultipliers ?? {},
  ).filter(
    (entry): entry is [CarouselStructure2FormatId, number] =>
      isCarouselStructure2FormatId(entry[0]) &&
      isValidMultiplier(entry[1]),
  );

  return values.length >= 2 ? Object.fromEntries(values) : null;
}

function normalizeHistory(
  item: CarouselStructure2RecentHistory,
): CarouselStructure2RecentHistory {
  return {
    centralProblem: cleanOptional(item.centralProblem, 180),
    ctaAngle: cleanOptional(item.ctaAngle, 180),
    hookIdea: cleanOptional(item.hookIdea, 180),
    storyAngle: cleanOptional(item.storyAngle, 180),
    storyFormatId: resolveCarouselStructure2FormatId(item.storyFormatId),
    summary: cleanOptional(item.summary, 360),
  };
}

function normalizeBatchSequence(value: number) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
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

function isSelectionMode(
  value: unknown,
): value is CarouselStructure2FormatSelectionMode {
  return [
    "controlled_rotation",
    "performance_exploration",
    "performance_weighted",
  ].includes(value as string);
}

function isValidMultiplier(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.5 &&
    value <= 2
  );
}

function cleanOptional(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : null;
}
