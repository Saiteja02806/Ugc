import {
  CAROUSEL_CONTENT_GRAMMAR,
  CAROUSEL_CONTENT_GRAMMAR_VERSION,
  getCarouselContentFormat,
  isCarouselContentFormatId,
  isCarouselHookFamilyId,
  type CarouselContentFormatId,
  type CarouselHookFamilyId,
} from "./content-grammar.ts";

export const CAROUSEL_CONTENT_SELECTOR_VERSION =
  "carousel-content-selector-v1-deterministic-batch";

export type CarouselRecentContentSummary = {
  angle: string | null;
  contentFormatId: CarouselContentFormatId | null;
  hook: string | null;
  hookFamilyId: CarouselHookFamilyId | null;
  topic: string | null;
  topicId: string | null;
};

export type CarouselContentAssignment = {
  contentFormatId: CarouselContentFormatId;
  grammarVersion: string;
  historySnapshot: CarouselRecentContentSummary[];
  hookFamilyId: CarouselHookFamilyId;
  selectorVersion: string;
};

export function selectCarouselContentAssignments(params: {
  candidateCount: number;
  history: readonly CarouselRecentContentSummary[];
  reserved?: ReadonlyMap<number, Partial<CarouselContentAssignment>>;
  seed: string;
  topicOptionCount: number;
}) {
  const candidateCount = Math.min(
    Math.max(Math.trunc(params.candidateCount), 0),
    50,
  );
  const historySnapshot = params.history.slice(0, 10).map(normalizeHistory);
  const workingHistory = [...historySnapshot];
  const assignments: CarouselContentAssignment[] = [];

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const reserved = params.reserved?.get(candidateIndex);
    const contentFormatId = isCarouselContentFormatId(reserved?.contentFormatId)
      ? reserved.contentFormatId
      : selectFormat({
          candidateIndex,
          history: workingHistory,
          seed: params.seed,
          topicOptionCount: params.topicOptionCount,
        });
    const format = getCarouselContentFormat(contentFormatId);
    const hookFamilyId =
      isCarouselHookFamilyId(reserved?.hookFamilyId) &&
      format.compatibleHookFamilies.includes(reserved.hookFamilyId)
        ? reserved.hookFamilyId
        : selectHookFamily({
            candidateIndex,
            contentFormatId,
            history: workingHistory,
            seed: params.seed,
          });
    const assignment = {
      contentFormatId,
      grammarVersion: CAROUSEL_CONTENT_GRAMMAR_VERSION,
      historySnapshot,
      hookFamilyId,
      selectorVersion: CAROUSEL_CONTENT_SELECTOR_VERSION,
    } satisfies CarouselContentAssignment;

    assignments.push(assignment);
    workingHistory.unshift({
      angle: null,
      contentFormatId,
      hook: null,
      hookFamilyId,
      topic: null,
      topicId: null,
    });
  }

  return assignments;
}

function selectFormat(params: {
  candidateIndex: number;
  history: readonly CarouselRecentContentSummary[];
  seed: string;
  topicOptionCount: number;
}) {
  const eligibleFormats = CAROUSEL_CONTENT_GRAMMAR.formats.filter(
    (format) => format.minimumTopicOptions <= params.topicOptionCount,
  );
  const formats = eligibleFormats.length > 0
    ? eligibleFormats
    : CAROUSEL_CONTENT_GRAMMAR.formats;
  const lastFormat = params.history[0]?.contentFormatId ?? null;

  return formats
    .map((format) => ({
      id: format.id,
      score:
        getRecentUsageScore(
          params.history.map((item) => item.contentFormatId),
          format.id,
        ) *
          1_000 +
        (lastFormat === format.id ? 10_000 : 0) +
        deterministicRank(
          `${params.seed}:${params.candidateIndex}:format:${format.id}`,
        ) /
          format.selectionWeight,
    }))
    .sort(compareRanked)[0]!.id;
}

function selectHookFamily(params: {
  candidateIndex: number;
  contentFormatId: CarouselContentFormatId;
  history: readonly CarouselRecentContentSummary[];
  seed: string;
}) {
  const format = getCarouselContentFormat(params.contentFormatId);
  const lastHookFamily = params.history[0]?.hookFamilyId ?? null;

  return format.compatibleHookFamilies
    .map((hookFamilyId) => ({
      id: hookFamilyId,
      score:
        getRecentUsageScore(
          params.history.map((item) => item.hookFamilyId),
          hookFamilyId,
        ) *
          1_000 +
        (lastHookFamily === hookFamilyId ? 10_000 : 0) +
        deterministicRank(
          `${params.seed}:${params.candidateIndex}:hook:${hookFamilyId}`,
        ),
    }))
    .sort(compareRanked)[0]!.id;
}

function getRecentUsageScore(
  values: readonly (string | null)[],
  selectedValue: string,
) {
  return values.reduce(
    (total, value, index) =>
      value === selectedValue ? total + Math.max(1, 12 - index) : total,
    0,
  );
}

function deterministicRank(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % 997;
}

function compareRanked<T extends { id: string; score: number }>(left: T, right: T) {
  return left.score - right.score || left.id.localeCompare(right.id);
}

function normalizeHistory(
  item: CarouselRecentContentSummary,
): CarouselRecentContentSummary {
  return {
    angle: cleanOptional(item.angle, 160),
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
