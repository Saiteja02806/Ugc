import {
  reactionTypesByEmotion,
  type ReactionAssetStatus,
  type ReactionClipType,
  type ReactionComposition,
  type ReactionContent,
  type ReactionForegroundAnchor,
  type ReactionSubjectCount,
} from "./taxonomy.ts";

export type ReactionAsset = {
  composition: ReactionComposition;
  hasAlpha: boolean;
  id: string;
  placement: {
    anchor: ReactionForegroundAnchor;
    heightPercent: number;
  };
  reactions: readonly ReactionClipType[];
  status: ReactionAssetStatus;
  subjectCount: ReactionSubjectCount;
};

export type ReactionBackgroundAsset = {
  contextTags: readonly string[];
  foregroundPlacement: ReactionForegroundAnchor;
  id: string;
  status: ReactionAssetStatus;
};

export type ReactionMatch = {
  background: ReactionBackgroundAsset;
  clip: ReactionAsset;
  score: number;
};

export function selectReactionMatch(params: {
  backgrounds: readonly ReactionBackgroundAsset[];
  clips: readonly ReactionAsset[];
  content: ReactionContent;
  recentlyUsedBackgroundIds?: ReadonlySet<string>;
  recentlyUsedClipIds?: ReadonlySet<string>;
  seed: string;
}) {
  const candidates = params.clips.flatMap((clip) =>
    params.backgrounds.flatMap((background) => {
      const score = scoreReactionMatch({
        background,
        clip,
        content: params.content,
        recentlyUsedBackgroundIds: params.recentlyUsedBackgroundIds,
        recentlyUsedClipIds: params.recentlyUsedClipIds,
      });

      return score === null ? [] : [{ background, clip, score }];
    }),
  );

  return candidates.sort(
    (left, right) =>
      right.score - left.score ||
      stableTieBreak(params.seed, left.clip.id, left.background.id) -
        stableTieBreak(params.seed, right.clip.id, right.background.id) ||
      left.clip.id.localeCompare(right.clip.id) ||
      left.background.id.localeCompare(right.background.id),
  )[0] ?? null;
}

export function scoreReactionMatch(params: {
  background: ReactionBackgroundAsset;
  clip: ReactionAsset;
  content: ReactionContent;
  recentlyUsedBackgroundIds?: ReadonlySet<string>;
  recentlyUsedClipIds?: ReadonlySet<string>;
}) {
  const { background, clip, content } = params;
  if (
    clip.status !== "active" ||
    background.status !== "active" ||
    !clip.hasAlpha ||
    background.foregroundPlacement !== clip.placement.anchor
  ) {
    return null;
  }

  const desiredReactionTypes = reactionTypesByEmotion[content.emotion];
  const matchingReactionTypes = clip.reactions.filter((reactionType) =>
    desiredReactionTypes.includes(reactionType),
  ).length;
  const matchingBackgroundTags = intersectionSize(
    background.contextTags,
    content.visualContextTags,
  );
  const clipReusePenalty = params.recentlyUsedClipIds?.has(clip.id) ? -24 : 0;
  const backgroundReusePenalty = params.recentlyUsedBackgroundIds?.has(background.id)
    ? -12
    : 0;

  return (
    matchingReactionTypes * 100 +
    matchingBackgroundTags * 9 +
    clipReusePenalty +
    backgroundReusePenalty
  );
}

function intersectionSize(left: readonly string[], right: readonly string[]) {
  const rightSet = new Set(right.map(normalizeTag));
  return left.filter((value) => rightSet.has(normalizeTag(value))).length;
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function stableTieBreak(seed: string, clipId: string, backgroundId: string) {
  let value = 2166136261;
  for (const character of `${seed}:${clipId}:${backgroundId}`) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
