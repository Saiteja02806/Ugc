import type { TrendingFeedFormat } from "@/lib/trending/feed-items";

export const DEFAULT_TRENDING_CONTENT_MIX = {
  carousel: 20,
  hook_video: 30,
  reaction: 20,
  wall_text: 30,
} as const satisfies TrendingContentMix;

export const FREE_TRENDING_CONTENT_MIX = {
  carousel: 20,
  hook_video: 30,
  reaction: 20,
  wall_text: 30,
} as const satisfies TrendingContentMix;

export const TRENDING_CONTENT_MIX_LIMITS = {
  carousel: 100,
  hook_video: 100,
  reaction: 100,
  wall_text: 100,
} as const satisfies TrendingContentMix;

/**
 * Reaction is optional only so preferences written before this format existed
 * remain readable during the database rollout. New and saved mixes always
 * contain its value.
 */
export type TrendingContentMix = Record<
  Exclude<TrendingFeedFormat, "reaction">,
  number
> & {
  reaction?: number;
};

export type TrendingContentAllocation = Record<TrendingFeedFormat, number>;

export type TrendingContentMixPreference = {
  mix: TrendingContentMix;
  preferenceVersion: number;
  updatedAt: string | null;
};

const FORMATS = [
  "carousel",
  "wall_text",
  "hook_video",
  "reaction",
] as const satisfies readonly TrendingFeedFormat[];

export function validateTrendingContentMix(mix: TrendingContentMix) {
  const total = FORMATS.reduce(
    (sum, format) => sum + getTrendingContentMixValue(mix, format),
    0,
  );

  return (
    total === 100 &&
    FORMATS.every((format) =>
      Number.isInteger(getTrendingContentMixValue(mix, format)) &&
      getTrendingContentMixValue(mix, format) >= 0 &&
      getTrendingContentMixValue(mix, format) <=
        TRENDING_CONTENT_MIX_LIMITS[format]
    )
  );
}

export function resolveTrendingContentMixPreference(params: {
  planKey: string;
  preference: TrendingContentMixPreference;
}): TrendingContentMixPreference {
  if (params.planKey === "free" && params.preference.updatedAt === null) {
    return {
      ...params.preference,
      mix: { ...FREE_TRENDING_CONTENT_MIX },
    };
  }

  return {
    ...params.preference,
    mix: { ...params.preference.mix },
  };
}

export function allocateTrendingContent(params: {
  dailyLimit: number;
  localDate: string;
  mix: TrendingContentMix;
}): TrendingContentAllocation {
  const dailyLimit = Math.trunc(params.dailyLimit);

  if (dailyLimit < 1) {
    throw new Error("The daily Trending limit must be positive.");
  }

  if (!validateTrendingContentMix(params.mix)) {
    throw new Error("The Trending content mix must total 100% and respect format limits.");
  }

  const allocation = Object.fromEntries(
    FORMATS.map((format) => [
      format,
      Math.floor(
        (dailyLimit * getTrendingContentMixValue(params.mix, format)) / 100,
      ),
    ]),
  ) as TrendingContentAllocation;
  let remaining = dailyLimit - sumAllocation(allocation);
  const tieOrder = getDailyTieOrder(params.localDate);
  const tieIndex = new Map(tieOrder.map((format, index) => [format, index]));
  const ranked = [...FORMATS].sort((first, second) => {
    const firstRemainder =
      (dailyLimit * getTrendingContentMixValue(params.mix, first)) % 100;
    const secondRemainder =
      (dailyLimit * getTrendingContentMixValue(params.mix, second)) % 100;

    return (
      secondRemainder - firstRemainder ||
      (tieIndex.get(first) ?? 0) - (tieIndex.get(second) ?? 0)
    );
  });

  for (const format of ranked) {
    if (remaining <= 0) {
      break;
    }

    allocation[format] += 1;
    remaining -= 1;
  }

  return allocation;
}

export function interleaveTrendingContent(params: {
  allocation: TrendingContentAllocation;
  localDate: string;
}) {
  const total = sumAllocation(params.allocation);
  const remaining = { ...params.allocation };
  const currentWeight: TrendingContentAllocation = {
    carousel: 0,
    hook_video: 0,
    reaction: 0,
    wall_text: 0,
  };
  const order: TrendingFeedFormat[] = [];
  const tieOrder = getDailyTieOrder(params.localDate);
  const tieIndex = new Map(tieOrder.map((format, index) => [format, index]));

  for (let position = 0; position < total; position += 1) {
    const eligible = FORMATS.filter((format) => remaining[format] > 0);

    for (const format of eligible) {
      currentWeight[format] += params.allocation[format];
    }

    eligible.sort((first, second) => {
      return (
        currentWeight[second] - currentWeight[first] ||
        (tieIndex.get(first) ?? 0) - (tieIndex.get(second) ?? 0)
      );
    });

    const leading = eligible[0];
    const next =
      leading === order.at(-1) && eligible.length > 1
        ? eligible[1]
        : leading;

    if (!next) {
      throw new Error("Could not interleave the complete Trending allocation.");
    }

    order.push(next);
    currentWeight[next] -= total;
    remaining[next] -= 1;
  }

  return order;
}

export function buildTrendingDailyFormatPlan(params: {
  dailyLimit: number;
  localDate: string;
  mix: TrendingContentMix;
}) {
  const allocation = allocateTrendingContent(params);

  return {
    allocation,
    formats: interleaveTrendingContent({
      allocation,
      localDate: params.localDate,
    }),
  };
}

export function allocateUnboundTrendingSlots(params: {
  currentCounts: TrendingContentAllocation;
  dailyLimit: number;
  localDate: string;
  mix: TrendingContentMix;
  unboundCount: number;
}) {
  const target = allocateTrendingContent({
    dailyLimit: params.dailyLimit,
    localDate: params.localDate,
    mix: params.mix,
  });
  const allocation: TrendingContentAllocation = {
    carousel: Math.max(target.carousel - params.currentCounts.carousel, 0),
    hook_video: Math.max(target.hook_video - params.currentCounts.hook_video, 0),
    reaction: Math.max(target.reaction - params.currentCounts.reaction, 0),
    wall_text: Math.max(target.wall_text - params.currentCounts.wall_text, 0),
  };
  let remaining = params.unboundCount - sumAllocation(allocation);

  while (remaining > 0) {
    const format = [...FORMATS].sort((first, second) => {
      const firstCount = params.currentCounts[first] + allocation[first];
      const secondCount = params.currentCounts[second] + allocation[second];
      const firstDeficit =
        getTrendingContentMixValue(params.mix, first) -
        (firstCount / params.dailyLimit) * 100;
      const secondDeficit =
        getTrendingContentMixValue(params.mix, second) -
        (secondCount / params.dailyLimit) * 100;

      return secondDeficit - firstDeficit || first.localeCompare(second);
    })[0];

    allocation[format] += 1;
    remaining -= 1;
  }

  while (remaining < 0) {
    const format = [...FORMATS]
      .filter((candidate) => allocation[candidate] > 0)
      .sort((first, second) => allocation[second] - allocation[first])[0];

    allocation[format] -= 1;
    remaining += 1;
  }

  return interleaveTrendingContent({ allocation, localDate: params.localDate });
}

function getDailyTieOrder(localDate: string) {
  const dayNumber = Math.floor(
    Date.parse(`${localDate}T00:00:00.000Z`) / 86_400_000,
  );

  return Number.isFinite(dayNumber) && Math.abs(dayNumber) % 2 === 1
    ? (["hook_video", "wall_text", "carousel", "reaction"] as const)
    : (["carousel", "wall_text", "hook_video", "reaction"] as const);
}

export function getTrendingContentMixValue(
  mix: TrendingContentMix,
  format: TrendingFeedFormat,
) {
  return format === "reaction" ? mix.reaction ?? 0 : mix[format];
}

function sumAllocation(allocation: TrendingContentAllocation) {
  return FORMATS.reduce((sum, format) => sum + allocation[format], 0);
}
