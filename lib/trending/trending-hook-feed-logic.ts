import type { HookVideoBrowseEntry } from "@/lib/trending/hook-video-types";

const TRENDING_HOOK_IDEA_COUNT = 6;

export function selectTrendingHookCandidates(
  inventory: readonly HookVideoBrowseEntry[],
) {
  const seenVideoIds = new Set<string>();

  return inventory
    .flatMap((entry) => {
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
    })
    .slice(0, TRENDING_HOOK_IDEA_COUNT)
    .map((candidate, candidateIndex) => ({
      ...candidate,
      candidateIndex,
    }));
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
