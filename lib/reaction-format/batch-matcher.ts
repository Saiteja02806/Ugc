import type {
  ReactionAvailabilityIntent,
  ReactionAvailabilityPalette,
  ReactionBrief,
} from "./briefs.ts";
import {
  scoreReactionMatch,
  type ReactionAsset,
  type ReactionBackgroundAsset,
  type ReactionMatch,
} from "./matcher.ts";
import type { ReactionClipType } from "./taxonomy.ts";

const MAX_CANDIDATES_PER_BRIEF = 16;
const MAX_SEARCH_NODES = 50_000;
export const MAX_REACTION_CLIP_PRESENTATIONS_PER_USER = 2;

export type ReactionClipShownHistory = {
  lastShownAt: string | null;
  shownCount: number;
};

export type ReactionBatchSelection = {
  background: ReactionBackgroundAsset;
  brief: ReactionBrief;
  clip: ReactionAsset;
  freshness: "fresh" | "reused";
  matchScore: number;
  reuseReason: "fresh_clip" | "reused_after_fresh_catalog_exhausted";
};

export type ReactionBatchSelectionResult = {
  alternateReactionHints: readonly ReactionClipType[];
  requestedCount: number;
  selected: readonly ReactionBatchSelection[];
  shortfallCount: number;
  unmatchedSlotIndexes: readonly number[];
};

export function buildReactionAvailabilityPalette(params: {
  backgrounds: readonly ReactionBackgroundAsset[];
  clipHistoryById?: ReadonlyMap<string, ReactionClipShownHistory>;
  clips: readonly ReactionAsset[];
}): ReactionAvailabilityPalette {
  const eligibleClips = params.clips.filter((clip) =>
    isClipEligibleForAnyBackground(clip, params.backgrounds) &&
    isWithinPresentationLimit(params.clipHistoryById?.get(clip.id)),
  );
  const intentCounts = new Map<
    ReactionClipType,
    { freshClipCount: number; reusableClipCount: number }
  >();

  for (const clip of eligibleClips) {
    const history = params.clipHistoryById?.get(clip.id);
    const isFresh = !history || history.shownCount === 0;
    for (const reaction of clip.reactions) {
      const current = intentCounts.get(reaction) ?? {
        freshClipCount: 0,
        reusableClipCount: 0,
      };
      if (isFresh) current.freshClipCount += 1;
      else current.reusableClipCount += 1;
      intentCounts.set(reaction, current);
    }
  }

  const availableReactionPalette: ReactionAvailabilityIntent[] = [...intentCounts]
    .map(([intent, counts]) => ({ intent, ...counts }))
    .sort(
      (left, right) =>
        right.freshClipCount - left.freshClipCount ||
        right.reusableClipCount - left.reusableClipCount ||
        left.intent.localeCompare(right.intent),
    );
  const recentlyShownIntents = getRecentlyShownIntents(
    eligibleClips,
    params.clipHistoryById,
  );

  return {
    availableReactionPalette,
    generationRule:
      "Prefer fresh relevant reaction intents. When fresh clips are insufficient, the application may reuse the least-used, longest-unseen eligible clips; never invent or choose asset IDs.",
    recentlyShownIntents,
  };
}

export function selectReactionBatch(params: {
  backgrounds: readonly ReactionBackgroundAsset[];
  briefs: readonly ReactionBrief[];
  clipHistoryById?: ReadonlyMap<string, ReactionClipShownHistory>;
  clips: readonly ReactionAsset[];
  nowMs?: number;
  seed: string;
}): ReactionBatchSelectionResult {
  const nowMs = params.nowMs ?? Date.now();
  const candidatesBySlot = new Map<number, readonly RankedCandidate[]>();
  for (const brief of params.briefs) {
    candidatesBySlot.set(
      brief.slotIndex,
      getRankedCandidates({
        backgrounds: params.backgrounds,
        brief,
        clipHistoryById: params.clipHistoryById,
        clips: params.clips,
        nowMs,
        seed: params.seed,
      }),
    );
  }

  const orderedBriefs = [...params.briefs].sort(
    (left, right) =>
      (candidatesBySlot.get(left.slotIndex)?.length ?? 0) -
        (candidatesBySlot.get(right.slotIndex)?.length ?? 0) ||
      left.slotIndex - right.slotIndex,
  );
  const best = findBestUniqueSelection(orderedBriefs, candidatesBySlot);
  const selected = best.candidates
    .map(toSelection)
    .sort((left, right) => left.brief.slotIndex - right.brief.slotIndex);
  const selectedSlots = new Set(selected.map((selection) => selection.brief.slotIndex));
  const unmatchedSlotIndexes = params.briefs
    .map((brief) => brief.slotIndex)
    .filter((slotIndex) => !selectedSlots.has(slotIndex));
  const selectedReactionTypes = new Set(
    selected.flatMap((selection) => selection.brief.preferredReactions),
  );
  const alternateReactionHints = buildReactionAvailabilityPalette({
    backgrounds: params.backgrounds,
    clipHistoryById: params.clipHistoryById,
    clips: params.clips,
  }).availableReactionPalette
    .map((item) => item.intent)
    .filter((intent) => !selectedReactionTypes.has(intent));

  return {
    alternateReactionHints,
    requestedCount: params.briefs.length,
    selected,
    shortfallCount: unmatchedSlotIndexes.length,
    unmatchedSlotIndexes,
  };
}

type RankedCandidate = {
  brief: ReactionBrief;
  freshness: "fresh" | "reused";
  match: ReactionMatch;
  preferenceIndex: number;
  rank: number;
};

function getRankedCandidates(params: {
  backgrounds: readonly ReactionBackgroundAsset[];
  brief: ReactionBrief;
  clipHistoryById?: ReadonlyMap<string, ReactionClipShownHistory>;
  clips: readonly ReactionAsset[];
  nowMs: number;
  seed: string;
}): readonly RankedCandidate[] {
  const bestByClip = new Map<string, RankedCandidate>();
  for (const clip of params.clips) {
    if (!isWithinPresentationLimit(params.clipHistoryById?.get(clip.id))) continue;
    const preferenceIndex = getPreferenceIndex(
      clip.reactions,
      params.brief.preferredReactions,
    );
    if (preferenceIndex === -1) continue;

    for (const background of params.backgrounds) {
      const baseScore = scoreReactionMatch({
        background,
        clip,
        content: params.brief.content,
      });
      if (baseScore === null) continue;

      const history = params.clipHistoryById?.get(clip.id);
      const candidate: RankedCandidate = {
        brief: params.brief,
        freshness: !history || history.shownCount === 0 ? "fresh" : "reused",
        match: { background, clip, score: baseScore },
        preferenceIndex,
        rank: rankCandidate({
          baseScore,
          history,
          nowMs: params.nowMs,
          preferenceIndex,
          seed: params.seed,
          backgroundId: background.id,
          clipId: clip.id,
        }),
      };
      const current = bestByClip.get(clip.id);
      if (!current || compareCandidates(candidate, current) < 0) {
        bestByClip.set(clip.id, candidate);
      }
    }
  }

  return [...bestByClip.values()]
    .sort(compareCandidates)
    .slice(0, MAX_CANDIDATES_PER_BRIEF);
}

function findBestUniqueSelection(
  orderedBriefs: readonly ReactionBrief[],
  candidatesBySlot: ReadonlyMap<number, readonly RankedCandidate[]>,
) {
  let best: { candidates: readonly RankedCandidate[]; totalRank: number } = {
    candidates: [],
    totalRank: Number.NEGATIVE_INFINITY,
  };
  let searchedNodes = 0;

  function visit(
    index: number,
    selected: readonly RankedCandidate[],
    usedClipIds: ReadonlySet<string>,
    totalRank: number,
  ) {
    searchedNodes += 1;
    if (searchedNodes > MAX_SEARCH_NODES) return;
    if (index === orderedBriefs.length) {
      if (
        selected.length > best.candidates.length ||
        (selected.length === best.candidates.length && totalRank > best.totalRank)
      ) {
        best = { candidates: [...selected], totalRank };
      }
      return;
    }

    const remainingBriefs = orderedBriefs.length - index;
    if (selected.length + remainingBriefs < best.candidates.length) return;

    const brief = orderedBriefs[index];
    const candidates = candidatesBySlot.get(brief.slotIndex) ?? [];
    for (const candidate of candidates) {
      if (usedClipIds.has(candidate.match.clip.id)) continue;
      const nextUsedClipIds = new Set(usedClipIds);
      nextUsedClipIds.add(candidate.match.clip.id);
      visit(
        index + 1,
        [...selected, candidate],
        nextUsedClipIds,
        totalRank + candidate.rank,
      );
    }

    // Do not duplicate a clip within the same requested batch. A genuine
    // catalog shortage stays visible so callers can regenerate or report it.
    visit(index + 1, selected, usedClipIds, totalRank);
  }

  visit(0, [], new Set(), 0);
  const maximumCardinality = findMaximumUniqueMatching(
    orderedBriefs,
    candidatesBySlot,
  );
  if (maximumCardinality.length > best.candidates.length) {
    return {
      candidates: maximumCardinality,
      totalRank: maximumCardinality.reduce(
        (total, candidate) => total + candidate.rank,
        0,
      ),
    };
  }
  return best;
}

function findMaximumUniqueMatching(
  orderedBriefs: readonly ReactionBrief[],
  candidatesBySlot: ReadonlyMap<number, readonly RankedCandidate[]>,
) {
  const selectedBySlot = new Map<number, RankedCandidate>();
  const selectedByClipId = new Map<string, RankedCandidate>();

  function assign(brief: ReactionBrief, visitedClipIds: Set<string>) {
    const candidates = candidatesBySlot.get(brief.slotIndex) ?? [];
    for (const candidate of candidates) {
      const clipId = candidate.match.clip.id;
      if (visitedClipIds.has(clipId)) continue;
      visitedClipIds.add(clipId);
      const occupyingCandidate = selectedByClipId.get(clipId);
      if (!occupyingCandidate) {
        selectedByClipId.set(clipId, candidate);
        selectedBySlot.set(brief.slotIndex, candidate);
        return true;
      }

      selectedByClipId.delete(clipId);
      selectedBySlot.delete(occupyingCandidate.brief.slotIndex);
      if (assign(occupyingCandidate.brief, visitedClipIds)) {
        selectedByClipId.set(clipId, candidate);
        selectedBySlot.set(brief.slotIndex, candidate);
        return true;
      }
      selectedByClipId.set(clipId, occupyingCandidate);
      selectedBySlot.set(occupyingCandidate.brief.slotIndex, occupyingCandidate);
    }
    return false;
  }

  for (const brief of orderedBriefs) {
    assign(brief, new Set());
  }
  return [...selectedBySlot.values()];
}

function rankCandidate(params: {
  backgroundId: string;
  baseScore: number;
  clipId: string;
  history: ReactionClipShownHistory | undefined;
  nowMs: number;
  preferenceIndex: number;
  seed: string;
}) {
  const isFresh = !params.history || params.history.shownCount === 0;
  const shownCount = params.history?.shownCount ?? 0;
  const lastShown = parseShownAt(params.history?.lastShownAt);
  const longUnseenBonus = lastShown === null
    ? 0
    : Math.min(Math.floor((params.nowMs - lastShown) / 86_400_000), 365);

  return (
    (isFresh ? 10_000 : 0) +
    (3 - params.preferenceIndex) * 1_000 +
    params.baseScore * 10 -
    shownCount * 100 +
    longUnseenBonus +
    stableTieBreak(params.seed, params.clipId, params.backgroundId) / 1_000_000
  );
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate) {
  return (
    right.rank - left.rank ||
    left.match.clip.id.localeCompare(right.match.clip.id) ||
    left.match.background.id.localeCompare(right.match.background.id)
  );
}

function toSelection(candidate: RankedCandidate): ReactionBatchSelection {
  return {
    background: candidate.match.background,
    brief: candidate.brief,
    clip: candidate.match.clip,
    freshness: candidate.freshness,
    matchScore: candidate.match.score,
    reuseReason:
      candidate.freshness === "fresh"
        ? "fresh_clip"
        : "reused_after_fresh_catalog_exhausted",
  };
}

function isClipEligibleForAnyBackground(
  clip: ReactionAsset,
  backgrounds: readonly ReactionBackgroundAsset[],
) {
  return (
    clip.status === "active" &&
    clip.hasAlpha &&
    backgrounds.some(
      (background) =>
        background.status === "active" &&
        background.foregroundPlacement === clip.placement.anchor,
    )
  );
}

function getRecentlyShownIntents(
  clips: readonly ReactionAsset[],
  historyById: ReadonlyMap<string, ReactionClipShownHistory> | undefined,
) {
  const byIntent = new Map<ReactionClipType, number>();
  for (const clip of clips) {
    const shownAt = parseShownAt(historyById?.get(clip.id)?.lastShownAt);
    if (shownAt === null) continue;
    for (const reaction of clip.reactions) {
      byIntent.set(reaction, Math.max(byIntent.get(reaction) ?? 0, shownAt));
    }
  }
  return [...byIntent.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([intent]) => intent);
}

function getPreferenceIndex(
  clipReactions: readonly ReactionClipType[],
  preferredReactions: readonly ReactionClipType[],
) {
  const indexes = clipReactions
    .map((reaction) => preferredReactions.indexOf(reaction))
    .filter((index) => index !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function parseShownAt(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isWithinPresentationLimit(history: ReactionClipShownHistory | undefined) {
  return (history?.shownCount ?? 0) < MAX_REACTION_CLIP_PRESENTATIONS_PER_USER;
}

function stableTieBreak(seed: string, clipId: string, backgroundId: string) {
  let value = 2166136261;
  for (const character of `${seed}:${clipId}:${backgroundId}`) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
