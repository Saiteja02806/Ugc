const MAX_REFILL_BATCH_CANDIDATES = 50;
export const DAILY_CAROUSEL_REFILL_REPAIR_INTERVAL_MS = 15 * 60 * 1_000;

export function getDailyCarouselRefillPlan(params: {
  dailyLimit: number;
  existingBatchCandidateCount: number;
  existingRequestedCount: number;
  feedItemCount: number;
  viableUnassignedGenerationCount: number;
}) {
  const dailyLimit = toNonNegativeInteger(params.dailyLimit);
  const feedItemCount = Math.min(
    toNonNegativeInteger(params.feedItemCount),
    dailyLimit,
  );
  const pendingSlotCount = Math.max(dailyLimit - feedItemCount, 0);
  const viableUnassignedGenerationCount = toNonNegativeInteger(
    params.viableUnassignedGenerationCount,
  );
  const generationDeficit = Math.max(
    pendingSlotCount - viableUnassignedGenerationCount,
    0,
  );
  const existingBatchCandidateCount = toNonNegativeInteger(
    params.existingBatchCandidateCount,
  );
  const existingRequestedCount = toNonNegativeInteger(
    params.existingRequestedCount,
  );
  const requestedBatchCandidateCount = Math.min(
    Math.max(
      existingRequestedCount,
      existingBatchCandidateCount + generationDeficit,
    ),
    MAX_REFILL_BATCH_CANDIDATES,
  );

  return {
    generationDeficit,
    pendingSlotCount,
    requestedBatchCandidateCount,
  };
}

export function getMissingDailyCarouselCandidateIndexes(params: {
  existingCandidateIndexes: readonly number[];
  targetCandidateCount: number;
}) {
  const existingCandidateIndexes = new Set(
    params.existingCandidateIndexes.filter(
      (index) => Number.isInteger(index) && index >= 0,
    ),
  );
  const targetCandidateCount = Math.min(
    toNonNegativeInteger(params.targetCandidateCount),
    MAX_REFILL_BATCH_CANDIDATES,
  );

  return Array.from({ length: targetCandidateCount }, (_, index) => index).filter(
    (index) => !existingCandidateIndexes.has(index),
  );
}

export function canExtendDailyCarouselRefill(params: {
  currentRequestedCount: number;
  hasExistingBatch: boolean;
  lastUpdatedAt: string | null;
  now?: number;
  requestedCount: number;
}) {
  if (
    !params.hasExistingBatch ||
    toNonNegativeInteger(params.requestedCount) <=
      toNonNegativeInteger(params.currentRequestedCount)
  ) {
    return true;
  }

  const lastUpdatedAt = params.lastUpdatedAt
    ? new Date(params.lastUpdatedAt).getTime()
    : Number.NaN;

  return (
    Number.isFinite(lastUpdatedAt) &&
    (params.now ?? Date.now()) - lastUpdatedAt >=
      DAILY_CAROUSEL_REFILL_REPAIR_INTERVAL_MS
  );
}

export function isCarouselGenerationAvailableOnDate(params: {
  availableOnLocalDate: string | null;
  localDate: string;
}) {
  return (
    params.availableOnLocalDate === null ||
    params.availableOnLocalDate <= params.localDate
  );
}

export type DailyCarouselAssignmentCandidate = {
  availableOnLocalDate: string | null;
  carouselId: string;
  conceptFingerprint: string | null;
  generationSource: "auto_generated" | "manual";
  runtimeReady: boolean;
};

export function selectAssignableDailyCarouselCandidates(params: {
  assignedCarouselIds: readonly string[];
  candidates: readonly DailyCarouselAssignmentCandidate[];
  existingConceptFingerprints: readonly string[];
  localDate: string;
}) {
  const assignedCarouselIds = new Set(params.assignedCarouselIds);
  const conceptFingerprints = new Set(params.existingConceptFingerprints);

  return params.candidates.filter((candidate) => {
    if (
      candidate.generationSource !== "auto_generated" ||
      assignedCarouselIds.has(candidate.carouselId) ||
      !candidate.runtimeReady ||
      !candidate.conceptFingerprint ||
      !isCarouselGenerationAvailableOnDate({
        availableOnLocalDate: candidate.availableOnLocalDate,
        localDate: params.localDate,
      }) ||
      conceptFingerprints.has(candidate.conceptFingerprint)
    ) {
      return false;
    }

    conceptFingerprints.add(candidate.conceptFingerprint);
    return true;
  });
}

export function rotateDailyCarouselAngles(params: {
  angles: readonly string[];
  candidateCount: number;
  localDate: string;
  profileId: string;
}) {
  const candidateCount = toNonNegativeInteger(params.candidateCount);

  if (candidateCount === 0 || params.angles.length === 0) {
    return [];
  }

  const offset = stableStringHash(`${params.profileId}:${params.localDate}`) %
    params.angles.length;

  return Array.from({ length: candidateCount }, (_, index) => {
    return params.angles[(offset + index) % params.angles.length] ?? "";
  }).filter(Boolean);
}

function toNonNegativeInteger(value: number) {
  return Math.max(Math.trunc(Number.isFinite(value) ? value : 0), 0);
}

function stableStringHash(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
