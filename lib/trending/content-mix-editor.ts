import {
  TRENDING_CONTENT_MIX_LIMITS,
  type TrendingContentMix,
} from "./content-mix.ts";
import type { TrendingFeedFormat } from "./feed-items.ts";

export function rebalanceTrendingContentMix(
  current: TrendingContentMix,
  changedFormat: TrendingFeedFormat,
  requestedValue: number,
): TrendingContentMix {
  const nextValue = clampInteger(
    requestedValue,
    0,
    TRENDING_CONTENT_MIX_LIMITS[changedFormat],
  );

  if (changedFormat === "wall_text" || changedFormat === "hook_video") {
    const otherVideoFormat =
      changedFormat === "wall_text" ? "hook_video" : "wall_text";
    const carousel = Math.max(100 - nextValue - current[otherVideoFormat], 0);
    const otherVideoShare = 100 - nextValue - carousel;

    return {
      carousel,
      hook_video:
        changedFormat === "hook_video" ? nextValue : otherVideoShare,
      wall_text:
        changedFormat === "wall_text" ? nextValue : otherVideoShare,
    };
  }

  const remainingVideoShare = 100 - nextValue;
  const currentVideoShare = current.wall_text + current.hook_video;
  const proportionalWallShare =
    currentVideoShare > 0
      ? Math.round(
          (remainingVideoShare * current.wall_text) / currentVideoShare,
        )
      : Math.round(remainingVideoShare / 2);
  const minimumWallShare = Math.max(
    0,
    remainingVideoShare - TRENDING_CONTENT_MIX_LIMITS.hook_video,
  );
  const maximumWallShare = Math.min(
    TRENDING_CONTENT_MIX_LIMITS.wall_text,
    remainingVideoShare,
  );
  const wallText = clampInteger(
    proportionalWallShare,
    minimumWallShare,
    maximumWallShare,
  );

  return {
    carousel: nextValue,
    hook_video: remainingVideoShare - wallText,
    wall_text: wallText,
  };
}

function clampInteger(value: number, minimum: number, maximum: number) {
  const integer = Number.isFinite(value) ? Math.round(value) : minimum;
  return Math.min(Math.max(integer, minimum), maximum);
}
