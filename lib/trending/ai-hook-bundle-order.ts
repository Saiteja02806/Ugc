type HookVideo = { id: string; creatorKey: string | null };

// A stable mix avoids hydration differences and keeps filtering from reshuffling
// the page. Each round shows one clip per creator before repeating a creator.
export function mixTrendingHookVideos<T extends HookVideo>(videos: readonly T[]): T[] {
  const creators = new Map<string, T[]>();
  for (const video of videos) {
    const key = video.creatorKey || video.id;
    const clips = creators.get(key) ?? [];
    clips.push(video);
    creators.set(key, clips);
  }
  for (const clips of creators.values()) {
    clips.sort((left, right) => mixedRank(left.id) - mixedRank(right.id) || left.id.localeCompare(right.id));
  }
  const creatorCount = creators.size;

  const result: T[] = [];
  let previousCreator = "";
  let round = 0;
  while (creators.size) {
    const keys = [...creators.keys()].sort((left, right) =>
      mixedRank(`${round}:${left}`) - mixedRank(`${round}:${right}`) || left.localeCompare(right),
    );
    if (keys.length > 1 && keys[0] === previousCreator) {
      [keys[0], keys[1]] = [keys[1], keys[0]];
    }
    for (const key of keys) {
      const clips = creators.get(key)!;
      result.push(clips.shift()!);
      previousCreator = key;
      if (!clips.length) creators.delete(key);
    }
    round++;
  }
  // A prolific creator can outlast every other queue. Spread those final clips
  // into earlier gaps instead of leaving a run of the same face at the end.
  for (;;) {
    const repeated = result.findIndex((video, index) => index > 0 && creatorKey(video) === creatorKey(result[index - 1]));
    if (repeated < 0) break;
    const [video] = result.splice(repeated, 1);
    const gaps = Array.from({ length: result.length + 1 }, (_, index) => index).filter(index =>
      (index === 0 || creatorKey(result[index - 1]) !== creatorKey(video)) &&
      (index === result.length || creatorKey(result[index]) !== creatorKey(video)),
    );
    if (!gaps.length) {
      result.splice(repeated, 0, video);
      break;
    }
    const afterFirstRound = gaps.filter(index => index >= creatorCount);
    const choices = afterFirstRound.length ? afterFirstRound : gaps;
    choices.sort((left, right) => mixedRank(`${video.id}:${left}`) - mixedRank(`${video.id}:${right}`));
    result.splice(choices[0], 0, video);
  }
  return result;
}

function creatorKey(video: HookVideo) {
  return video.creatorKey || video.id;
}

function mixedRank(value: string) {
  let hash = 2166136261;
  for (const character of `trending-bundle-v1:${value}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  return (hash ^ (hash >>> 13)) >>> 0;
}
