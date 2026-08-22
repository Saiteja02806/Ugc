import type { HookVideoBrowseEntry } from "@/lib/trending/hook-video-types";

const DEFAULT_TRENDING_HOOK_IDEA_COUNT = 6;
const MAX_TRENDING_HOOK_IDEA_COUNT = 12;

export function selectTrendingHookCandidates(
  inventory: readonly HookVideoBrowseEntry[],
  requestedCount = DEFAULT_TRENDING_HOOK_IDEA_COUNT,
) {
  const seenVideoIds = new Set<string>();
  const validEntries = inventory.flatMap((entry) => {
    const durationSeconds = getEffectiveHookDuration(entry);

    if (
      entry.video.ratio !== "9:16" ||
      durationSeconds === null ||
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
