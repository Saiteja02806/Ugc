import type { HookVideoBrowseEntry } from "@/lib/trending/hook-video-types";

const DEFAULT_TRENDING_HOOK_IDEA_COUNT = 6;
// This is the durable source-metadata cap. The database reserves only the
// exact outstanding target for each worker attempt.
const MAX_TRENDING_HOOK_IDEA_COUNT = 600;
// This mirrors the worker's strict reaction map. Keep unknown/unreviewed
// sources out of the queue rather than spending a generation attempt on them.
const REVIEWED_TRENDING_HOOK_REACTIONS = new Set([
  "shock_surprise",
  "curiosity_discovery",
  "secret_reveal",
  "confidence_approval",
  "amusement_laughter",
  "concern_anxiety",
  "confusion_skepticism",
  "focused_attention",
]);

type HookBusinessEvidence = {
  desiredOutcome?: string | null;
  differentiator?: string | null;
  differentiators?: readonly string[];
  mainProblem?: string | null;
  mainPromise?: string | null;
  painPoints?: readonly string[];
  primaryAudience?: string | null;
  productSummary?: string | null;
  targetAudience?: readonly string[];
  valueProps?: readonly string[];
};

export function selectTrendingHookCandidates(
  inventory: readonly HookVideoBrowseEntry[],
  requestedCount = DEFAULT_TRENDING_HOOK_IDEA_COUNT,
  businessEvidence?: HookBusinessEvidence,
) {
  const seenVideoIds = new Set<string>();
  const validEntries = inventory.flatMap((entry) => {
    const durationSeconds = getEffectiveHookDuration(entry);

    if (
      entry.video.ratio !== "9:16" ||
      durationSeconds === null ||
      !REVIEWED_TRENDING_HOOK_REACTIONS.has(entry.video.reactionType ?? "") ||
      !hasRequiredEvidenceForReaction(
        entry.video.reactionType,
        businessEvidence,
      ) ||
      seenVideoIds.has(entry.video.id)
    ) {
      return [];
    }

    seenVideoIds.add(entry.video.id);

    return [
      {
        candidateIndex: 0,
        durationSeconds,
        entry,
        sourceDurationSeconds: entry.video.durationSeconds!,
      },
    ];
  });
  const selected = selectDiverseCandidates(
    validEntries,
    Math.min(Math.max(Math.trunc(requestedCount), 1), MAX_TRENDING_HOOK_IDEA_COUNT),
  );

  return selected
    .map((candidate, candidateIndex) => ({
      ...candidate,
      candidateIndex,
    }));
}

function hasRequiredEvidenceForReaction(
  reactionType: string | null,
  businessEvidence: HookBusinessEvidence | undefined,
) {
  // Callers without business context retain the selector's source-only
  // behavior. The Trending feed always supplies it and therefore avoids
  // queuing a video that the strict writer cannot truthfully complete.
  if (!businessEvidence) {
    return true;
  }

  const hasText = (value: string | null | undefined) => Boolean(value?.trim());
  const hasListText = (values: readonly string[] | undefined) =>
    Boolean(values?.some((value) => value.trim()));
  const desiredOutcome =
    businessEvidence.desiredOutcome ?? businessEvidence.mainPromise;
  const differentiator =
    businessEvidence.differentiator ?? businessEvidence.differentiators?.[0];
  const hasPain =
    hasText(businessEvidence.mainProblem) ||
    hasListText(businessEvidence.painPoints);
  const hasCapability =
    hasText(businessEvidence.productSummary) ||
    hasText(desiredOutcome) ||
    hasText(differentiator) ||
    hasListText(businessEvidence.differentiators) ||
    hasListText(businessEvidence.valueProps);
  const hasAudience =
    hasText(businessEvidence.primaryAudience) ||
    hasListText(businessEvidence.targetAudience);
  const distinctEvidenceCount = new Set(
    [
      businessEvidence.mainProblem,
      desiredOutcome,
      differentiator,
      ...(businessEvidence.painPoints ?? []),
      ...(businessEvidence.differentiators ?? []),
      ...(businessEvidence.valueProps ?? []),
    ]
      .filter((value): value is string => hasText(value))
      .map((value) => value.trim().toLowerCase()),
  ).size;

  switch (reactionType) {
    case "amusement_laughter":
    case "curiosity_discovery":
    case "shock_surprise":
      return hasCapability;
    case "concern_anxiety":
    case "confusion_skepticism":
      return hasPain;
    case "confidence_approval":
      return hasAudience || hasPain || hasCapability;
    case "focused_attention":
      return distinctEvidenceCount >= 2;
    case "secret_reveal":
      return hasAudience;
    default:
      return false;
  }
}

function selectDiverseCandidates<T extends {
  entry: HookVideoBrowseEntry;
}>(candidates: readonly T[], requestedCount: number) {
  const selected: T[] = [];
  const remaining = [...candidates];
  const usedInfluencers = new Set<string>();
  const usedReactionTypes = new Set<string>();
  const usedVisualGroups = new Set<string>();

  while (
    selected.length < requestedCount &&
    remaining.length > 0
  ) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [index, candidate] of remaining.entries()) {
      const influencerKey =
        candidate.entry.video.influencerKey ||
        candidate.entry.influencer.id;
      const reactionType =
        candidate.entry.video.reactionType || "unspecified";
      const visualGroup =
        candidate.entry.video.visualGroup || "unspecified";
      const score =
        (usedInfluencers.has(influencerKey) ? 0 : 100) +
        (usedReactionTypes.has(reactionType) ? 0 : 10) +
        (usedVisualGroups.has(visualGroup) ? 0 : 1);

      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);

    if (!next) {
      break;
    }

    selected.push(next);
    usedInfluencers.add(
      next.entry.video.influencerKey ||
        next.entry.influencer.id,
    );
    usedReactionTypes.add(
      next.entry.video.reactionType || "unspecified",
    );
    usedVisualGroups.add(
      next.entry.video.visualGroup || "unspecified",
    );
  }

  return selected;
}

function getEffectiveHookDuration(entry: HookVideoBrowseEntry) {
  const sourceDuration = entry.video.durationSeconds;

  if (
    sourceDuration === null ||
    !Number.isFinite(sourceDuration) ||
    sourceDuration <= 0
  ) {
    return null;
  }

  const trimStart = Math.max(entry.video.trimStart, 0);
  const trimEnd = Math.min(
    entry.video.trimEnd ?? sourceDuration,
    sourceDuration,
  );
  const duration = trimEnd - trimStart;

  return duration > 0 ? Math.round(duration * 1000) / 1000 : null;
}
