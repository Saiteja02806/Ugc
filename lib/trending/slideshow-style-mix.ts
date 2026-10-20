export const TRENDING_SLIDESHOW_STYLES = [
  "helpful_tips",
  "product_stories_cta",
] as const;

export type TrendingSlideshowStyle =
  (typeof TRENDING_SLIDESHOW_STYLES)[number];

export type TrendingSlideshowStyleMix = {
  helpfulTips: number;
  productStoriesCta: number;
};

export type TrendingSlideshowStyleAllocation = Record<
  TrendingSlideshowStyle,
  number
>;

export type TrendingSlideshowStructureId = "structure_1" | "structure_2";

export const DEFAULT_TRENDING_SLIDESHOW_STYLE_MIX = {
  helpfulTips: 50,
  productStoriesCta: 50,
} as const satisfies TrendingSlideshowStyleMix;

const STYLE_ORDER = [
  "helpful_tips",
  "product_stories_cta",
] as const satisfies readonly TrendingSlideshowStyle[];

export function validateTrendingSlideshowStyleMix(
  mix: TrendingSlideshowStyleMix,
) {
  return (
    Number.isInteger(mix.helpfulTips) &&
    Number.isInteger(mix.productStoriesCta) &&
    mix.helpfulTips >= 0 &&
    mix.helpfulTips <= 100 &&
    mix.productStoriesCta >= 0 &&
    mix.productStoriesCta <= 100 &&
    mix.helpfulTips + mix.productStoriesCta === 100
  );
}

export function getTrendingSlideshowStyleValue(
  mix: TrendingSlideshowStyleMix,
  style: TrendingSlideshowStyle,
) {
  return style === "helpful_tips" ? mix.helpfulTips : mix.productStoriesCta;
}

/**
 * Allocates complete, user-visible slideshows. It uses largest remainder and a
 * date-derived tie breaker, so a percentage always resolves to a deterministic
 * whole-card count without silently changing an already-created pack.
 */
export function allocateTrendingSlideshowStyles(params: {
  localDate: string;
  mix: TrendingSlideshowStyleMix;
  slideshowCount: number;
}): TrendingSlideshowStyleAllocation {
  const slideshowCount = Math.trunc(params.slideshowCount);

  if (slideshowCount < 1) {
    throw new Error("The slideshow allocation must contain at least one card.");
  }

  if (!validateTrendingSlideshowStyleMix(params.mix)) {
    throw new Error("The slideshow style mix must total 100%.");
  }

  const allocation = Object.fromEntries(
    STYLE_ORDER.map((style) => [
      style,
      Math.floor(
        (slideshowCount * getTrendingSlideshowStyleValue(params.mix, style)) /
          100,
      ),
    ]),
  ) as TrendingSlideshowStyleAllocation;
  let remaining = slideshowCount - sumAllocation(allocation);
  const tieOrder = getDailyStyleTieOrder(params.localDate);
  const tieIndex = new Map(tieOrder.map((style, index) => [style, index]));
  const ranked = [...STYLE_ORDER].sort((first, second) => {
    const firstRemainder =
      (slideshowCount * getTrendingSlideshowStyleValue(params.mix, first)) % 100;
    const secondRemainder =
      (slideshowCount * getTrendingSlideshowStyleValue(params.mix, second)) % 100;

    return (
      secondRemainder - firstRemainder ||
      (tieIndex.get(first) ?? 0) - (tieIndex.get(second) ?? 0)
    );
  });

  for (const style of ranked) {
    if (remaining === 0) break;
    allocation[style] += 1;
    remaining -= 1;
  }

  return allocation;
}

/**
 * Reports the visible-card counts produced by the five-candidate writer plan.
 * For mixes that cannot land on an exact whole-batch split, this shows the
 * delivered counts instead of the requested percentages' theoretical counts.
 */
export function allocateTrendingSlideshowStylesForPack(params: {
  carouselCount: number;
  localDate: string;
  mix: TrendingSlideshowStyleMix;
}): TrendingSlideshowStyleAllocation {
  const carouselCount = Math.trunc(params.carouselCount);
  if (carouselCount < 1) {
    throw new Error("The slideshow allocation must contain at least one card.");
  }

  const batches = buildTrendingSlideshowStyleBatchPlan(params);
  const allocation: TrendingSlideshowStyleAllocation = {
    helpful_tips: 0,
    product_stories_cta: 0,
  };
  for (const style of batches) {
    allocation[style] += 5;
  }

  let unassignedBatchRemainder = allocation.helpful_tips + allocation.product_stories_cta - carouselCount;
  for (const style of [...batches].reverse()) {
    if (unassignedBatchRemainder <= 0) break;
    const remainder = Math.min(5, unassignedBatchRemainder);
    allocation[style] -= remainder;
    unassignedBatchRemainder -= remainder;
  }

  return allocation;
}

/**
 * Carousel planning happens in five-card batches. This creates a deterministic
 * sequence of whole batches and deliberately interleaves styles, while the UI
 * allocation above remains the exact count shown to the owner.
 */
export function buildTrendingSlideshowStyleBatchPlan(params: {
  carouselCount: number;
  localDate: string;
  mix: TrendingSlideshowStyleMix;
}): TrendingSlideshowStyle[] {
  const carouselCount = Math.trunc(params.carouselCount);

  if (carouselCount < 1) {
    return [];
  }

  const batchCount = Math.ceil(carouselCount / 5);
  const allocation = allocateTrendingSlideshowStyles({
    localDate: params.localDate,
    mix: params.mix,
    slideshowCount: batchCount,
  });
  const remaining = { ...allocation };
  const currentWeight: TrendingSlideshowStyleAllocation = {
    helpful_tips: 0,
    product_stories_cta: 0,
  };
  const tieOrder = getDailyStyleTieOrder(params.localDate);
  const tieIndex = new Map(tieOrder.map((style, index) => [style, index]));
  const plan: TrendingSlideshowStyle[] = [];

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const eligible = STYLE_ORDER.filter((style) => remaining[style] > 0);

    for (const style of eligible) {
      currentWeight[style] += allocation[style];
    }

    eligible.sort(
      (first, second) =>
        currentWeight[second] - currentWeight[first] ||
        (tieIndex.get(first) ?? 0) - (tieIndex.get(second) ?? 0),
    );
    const leading = eligible[0];
    const next =
      leading === plan.at(-1) && eligible.length > 1 ? eligible[1] : leading;

    if (!next) {
      throw new Error("Could not allocate slideshow planning batches.");
    }

    plan.push(next);
    currentWeight[next] -= batchCount;
    remaining[next] -= 1;
  }

  return plan;
}

/**
 * Recovery must replace the structures still owed by the open feed positions,
 * not restart the user's percentage mix against a smaller replacement batch.
 * Writer jobs are five-card batches, so a partial final group may deliberately
 * produce compatible surplus candidates; those candidates never change the
 * structure required by a visible position.
 */
export function buildTrendingSlideshowStructureBatchPlan(params: {
  existingBatchStructureIds?: readonly TrendingSlideshowStructureId[];
  requestedCandidateCount: number;
  requestedStructureIds: readonly TrendingSlideshowStructureId[];
}): TrendingSlideshowStructureId[] {
  const requestedCandidateCount = Math.trunc(params.requestedCandidateCount);
  if (requestedCandidateCount < 1 || params.requestedStructureIds.length === 0) {
    return [];
  }

  const batchCount = Math.ceil(requestedCandidateCount / 5);
  const existingBatchStructureIds = [
    ...(params.existingBatchStructureIds ?? []),
  ];

  if (existingBatchStructureIds.length > batchCount) {
    throw new Error("Existing slideshow batches exceed the requested candidate count.");
  }

  const plan: TrendingSlideshowStructureId[] = [...existingBatchStructureIds];

  for (
    let batchIndex = existingBatchStructureIds.length;
    batchIndex < batchCount;
    batchIndex += 1
  ) {
    const group = params.requestedStructureIds.slice(
      (batchIndex - existingBatchStructureIds.length) * 5,
      (batchIndex - existingBatchStructureIds.length + 1) * 5,
    );
    const candidates = group.length > 0
      ? group
      : params.requestedStructureIds;
    const structure1Count = candidates.filter(
      (structureId) => structureId === "structure_1",
    ).length;
    const structure2Count = candidates.length - structure1Count;

    if (structure1Count === structure2Count) {
      plan.push(candidates[0] ?? "structure_1");
    } else {
      plan.push(structure1Count > structure2Count ? "structure_1" : "structure_2");
    }
  }

  return plan;
}

export function getCarouselStructureForTrendingSlideshowStyle(
  style: TrendingSlideshowStyle,
): TrendingSlideshowStructureId {
  return style === "helpful_tips" ? "structure_1" : "structure_2";
}

function getDailyStyleTieOrder(localDate: string) {
  const dayNumber = Math.floor(
    Date.parse(`${localDate}T00:00:00.000Z`) / 86_400_000,
  );

  return Number.isFinite(dayNumber) && Math.abs(dayNumber) % 2 === 1
    ? (["product_stories_cta", "helpful_tips"] as const)
    : (["helpful_tips", "product_stories_cta"] as const);
}

function sumAllocation(allocation: TrendingSlideshowStyleAllocation) {
  return STYLE_ORDER.reduce((sum, style) => sum + allocation[style], 0);
}
