import {
  WALL_TEXT_FORMAT_REGISTRY_VERSION,
  getEligibleWallTextFormats,
} from "./wall-formats.ts";
import type { WallTextPerformanceSignals } from "./wall-format-performance-logic.ts";
import type { WallTextFormatId } from "./wall-text-types.ts";

export const WALL_TEXT_FORMAT_SELECTOR_VERSION =
  "wall-text-format-selector-v1-bounded-views" as const;
export const WALL_TEXT_WRITER_CHUNK_SIZE = 10;
export const WALL_TEXT_FORMAT_EXPLORATION_RATE = 0.25;
export const WALL_TEXT_MAX_FORMAT_SHARE = 0.5;

export type WallTextFormatSelectionMode =
  | "controlled_rotation"
  | "performance_exploration"
  | "performance_weighted";

export type WallTextFormatAssignment = {
  assignedFormatId: WallTextFormatId;
  candidateIndex: number;
  formatRegistryVersion: typeof WALL_TEXT_FORMAT_REGISTRY_VERSION;
  formatVersion: 1;
  rotationCandidateFormatId: WallTextFormatId;
  selectionMode: WallTextFormatSelectionMode;
  selectionWeight: number;
  selectorVersion: typeof WALL_TEXT_FORMAT_SELECTOR_VERSION;
};

export function selectWallTextFormatAssignments(params: {
  batchSequence?: number;
  candidateCount: number;
  candidateIndexOffset?: number;
  hasAuthorityEvidence?: boolean;
  hasFirstPersonEvidence?: boolean;
  performanceSignals?: WallTextPerformanceSignals;
  selectionKey: string;
}) {
  const candidateCount = Math.min(
    Math.max(Math.trunc(params.candidateCount), 0),
    50,
  );
  if (candidateCount === 0) return [];
  const eligible = getEligibleWallTextFormats({
    hasAuthorityEvidence: params.hasAuthorityEvidence,
    hasFirstPersonEvidence: params.hasFirstPersonEvidence,
  }).sort((left, right) => left.rotationOrder - right.rotationOrder);
  if (eligible.length === 0) {
    throw new Error("No Wall-of-text formats are eligible for this Business Profile.");
  }
  const batchSequence = Math.max(Math.trunc(params.batchSequence ?? 0), 0);
  const offset = Math.max(Math.trunc(params.candidateIndexOffset ?? 0), 0);
  const rotation = Array.from({ length: candidateCount }, (_, index) =>
    eligible[(batchSequence * candidateCount + index) % eligible.length]!.id,
  );
  const qualifiedWeights = new Map(
    (params.performanceSignals?.formats ?? [])
      .filter((signal) => signal.qualified)
      .map((signal) => [signal.formatId, signal.selectionWeight]),
  );

  if (qualifiedWeights.size < 2) {
    return rotation.map((formatId, index) =>
      assignment({
        candidateIndex: offset + index,
        formatId,
        rotationFormatId: formatId,
        selectionMode: "controlled_rotation",
        selectionWeight: 1,
      }),
    );
  }

  const maximumPerFormat =
    candidateCount === 1
      ? 1
      : Math.max(1, Math.floor(candidateCount * WALL_TEXT_MAX_FORMAT_SHARE));
  const explorationCount = Math.min(
    candidateCount,
    Math.max(1, Math.ceil(candidateCount * WALL_TEXT_FORMAT_EXPLORATION_RATE)),
  );
  const explorationSlots = new Set<number>();
  for (let index = 0; index < explorationCount; index += 1) {
    explorationSlots.add(
      Math.floor((index * candidateCount) / explorationCount),
    );
  }
  const usage = new Map<WallTextFormatId, number>();
  const selected: WallTextFormatAssignment[] = [];

  for (let slotIndex = 0; slotIndex < candidateCount; slotIndex += 1) {
    const rotationFormatId = rotation[slotIndex]!;
    const isExploration = explorationSlots.has(slotIndex);
    const formatId = isExploration
      ? chooseExplorationFormat(rotation, slotIndex, usage, maximumPerFormat)
      : chooseWeightedFormat({
          eligible: eligible.map((entry) => entry.id),
          maximumPerFormat,
          selectionKey: params.selectionKey,
          slotIndex,
          usage,
          weights: qualifiedWeights,
        });
    usage.set(formatId, (usage.get(formatId) ?? 0) + 1);
    selected.push(
      assignment({
        candidateIndex: offset + slotIndex,
        formatId,
        rotationFormatId,
        selectionMode: isExploration
          ? "performance_exploration"
          : "performance_weighted",
        selectionWeight: qualifiedWeights.get(formatId) ?? 1,
      }),
    );
  }

  return selected;
}

export function chunkWallTextAssignments(
  assignments: readonly WallTextFormatAssignment[],
  chunkSize = WALL_TEXT_WRITER_CHUNK_SIZE,
) {
  const size = Math.min(Math.max(Math.trunc(chunkSize), 1), WALL_TEXT_WRITER_CHUNK_SIZE);
  const chunks: WallTextFormatAssignment[][] = [];
  for (let index = 0; index < assignments.length; index += size) {
    chunks.push(assignments.slice(index, index + size));
  }
  return chunks;
}

function chooseExplorationFormat(
  rotation: readonly WallTextFormatId[],
  slotIndex: number,
  usage: ReadonlyMap<WallTextFormatId, number>,
  maximumPerFormat: number,
) {
  for (let offset = 0; offset < rotation.length; offset += 1) {
    const candidate = rotation[(slotIndex + offset) % rotation.length]!;
    if ((usage.get(candidate) ?? 0) < maximumPerFormat) return candidate;
  }
  return rotation[slotIndex]!;
}

function chooseWeightedFormat(params: {
  eligible: readonly WallTextFormatId[];
  maximumPerFormat: number;
  selectionKey: string;
  slotIndex: number;
  usage: ReadonlyMap<WallTextFormatId, number>;
  weights: ReadonlyMap<WallTextFormatId, number>;
}) {
  const available = params.eligible.filter(
    (formatId) =>
      (params.usage.get(formatId) ?? 0) < params.maximumPerFormat,
  );
  const pool = available.length > 0 ? available : params.eligible;
  return pool
    .map((formatId) => {
      const usagePenalty = 1 + (params.usage.get(formatId) ?? 0) * 0.12;
      const weight = (params.weights.get(formatId) ?? 1) / usagePenalty;
      return {
        formatId,
        priority:
          -Math.log(
            stableUnitInterval(
              `${params.selectionKey}:${params.slotIndex}:${formatId}`,
            ),
          ) / Math.max(weight, 0.01),
      };
    })
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.formatId.localeCompare(right.formatId),
    )[0]!.formatId;
}

function assignment(params: {
  candidateIndex: number;
  formatId: WallTextFormatId;
  rotationFormatId: WallTextFormatId;
  selectionMode: WallTextFormatSelectionMode;
  selectionWeight: number;
}): WallTextFormatAssignment {
  return {
    assignedFormatId: params.formatId,
    candidateIndex: params.candidateIndex,
    formatRegistryVersion: WALL_TEXT_FORMAT_REGISTRY_VERSION,
    formatVersion: 1,
    rotationCandidateFormatId: params.rotationFormatId,
    selectionMode: params.selectionMode,
    selectionWeight: params.selectionWeight,
    selectorVersion: WALL_TEXT_FORMAT_SELECTOR_VERSION,
  };
}

function stableUnitInterval(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) + 1) / 4_294_967_297;
}
