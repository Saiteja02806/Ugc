import type { CarouselImageLibraryCategory } from "./carousel-image-library-category.js";

export type CarouselImageRelevanceLevel =
  | "light"
  | "moderate"
  | "none"
  | "strong";

export type CarouselSlideImageRole = "hook" | "human" | "static";

export type CarouselSlideImageSelectionType = "primary" | "related";

export type CarouselSlideSemanticInput = {
  slideNumber: number;
  supportingText?: readonly unknown[];
  visibleText: readonly unknown[];
};

export type CarouselSlideImagePlan = {
  assetRole: CarouselSlideImageRole;
  categorySlug: CarouselImageLibraryCategory;
  relevanceLevel: CarouselImageRelevanceLevel;
  relevanceReason: string | null;
  selectionType: CarouselSlideImageSelectionType;
  slideNumber: number;
};

type RelatedSignal = {
  concept: string;
  terms: readonly string[];
  weight: 1 | 2 | 3;
};

type SlideRelevance = {
  level: CarouselImageRelevanceLevel;
  reason: string | null;
  score: number;
};

const HUMAN_FIRST_ROLES: readonly CarouselSlideImageRole[] = [
  "hook",
  "human",
  "static",
  "human",
  "static",
  "static",
];

const STATIC_FIRST_ROLES: readonly CarouselSlideImageRole[] = [
  "hook",
  "static",
  "human",
  "static",
  "human",
  "static",
];

const RELATED_CATEGORY_BY_PRIMARY: Partial<
  Record<CarouselImageLibraryCategory, CarouselImageLibraryCategory>
> = {
  food: "gym",
  gym: "food",
  travel: "food",
};

const RELATED_SIGNALS: Record<
  "food" | "gym",
  readonly RelatedSignal[]
> = {
  food: [
    { concept: "food", terms: ["food", "foods"], weight: 3 },
    { concept: "protein", terms: ["protein", "proteins"], weight: 3 },
    { concept: "nutrition", terms: ["nutrition", "nutritional"], weight: 3 },
    { concept: "meal", terms: ["meal", "meals", "meal prep"], weight: 3 },
    { concept: "calorie", terms: ["calorie", "calories", "caloric"], weight: 3 },
    { concept: "diet", terms: ["diet", "dieting", "dietary"], weight: 3 },
    { concept: "recipe", terms: ["recipe", "recipes"], weight: 3 },
    { concept: "grocery", terms: ["grocery", "groceries"], weight: 3 },
    { concept: "cooking", terms: ["cook", "cooked", "cooking"], weight: 3 },
    { concept: "eating", terms: ["eat", "eats", "eating", "ate"], weight: 2 },
    { concept: "breakfast", terms: ["breakfast"], weight: 3 },
    { concept: "lunch", terms: ["lunch"], weight: 3 },
    { concept: "dinner", terms: ["dinner"], weight: 3 },
    { concept: "snack", terms: ["snack", "snacks", "snacking"], weight: 3 },
    { concept: "restaurant", terms: ["restaurant", "restaurants"], weight: 3 },
    { concept: "cuisine", terms: ["cuisine", "cuisines"], weight: 3 },
    { concept: "dining", terms: ["dining", "dine"], weight: 3 },
    { concept: "cafe", terms: ["cafe", "cafes", "coffee shop"], weight: 2 },
    { concept: "fuel", terms: ["fuel", "fueling", "fuelled"], weight: 1 },
    { concept: "energy", terms: ["energy", "energized", "energised"], weight: 1 },
    { concept: "recovery", terms: ["recovery", "recover", "recovering"], weight: 1 },
    { concept: "healthy habit", terms: ["healthy habit", "healthy habits"], weight: 1 },
  ],
  gym: [
    { concept: "gym", terms: ["gym", "gyms"], weight: 3 },
    { concept: "workout", terms: ["workout", "workouts", "work out"], weight: 3 },
    { concept: "exercise", terms: ["exercise", "exercises", "exercising"], weight: 3 },
    { concept: "fitness", terms: ["fitness", "fit routine"], weight: 3 },
    { concept: "training", terms: ["train", "trains", "trained", "training"], weight: 3 },
    { concept: "strength", terms: ["strength", "stronger"], weight: 3 },
    { concept: "muscle", terms: ["muscle", "muscles", "muscular"], weight: 3 },
    { concept: "lifting", terms: ["lift", "lifts", "lifting", "weightlifting"], weight: 3 },
    { concept: "cardio", terms: ["cardio"], weight: 3 },
    { concept: "personal trainer", terms: ["personal trainer", "fitness coach"], weight: 3 },
    { concept: "movement", terms: ["movement", "move more", "active routine"], weight: 2 },
    { concept: "recovery", terms: ["recovery", "recover", "recovering"], weight: 1 },
    { concept: "active", terms: ["active", "activity"], weight: 1 },
  ],
};

export function buildCarouselSlideImagePlan(params: {
  carouselId: string;
  primaryCategory: CarouselImageLibraryCategory;
  slides: readonly CarouselSlideSemanticInput[];
}): CarouselSlideImagePlan[] {
  const slides = normalizeSlides(params.slides);
  const relatedCategory = RELATED_CATEGORY_BY_PRIMARY[params.primaryCategory];
  const relevanceBySlide = new Map<number, SlideRelevance>();

  for (const slide of slides) {
    relevanceBySlide.set(
      slide.slideNumber,
      relatedCategory && slide.slideNumber > 1
        ? calculateRelatedCategoryRelevance(slide, relatedCategory)
        : { level: "none", reason: null, score: 0 },
    );
  }

  const roles = selectRolePattern({
    carouselId: params.carouselId,
    relevanceBySlide,
  });
  const staticCandidates = slides
    .filter((slide) => roles[slide.slideNumber - 1] === "static")
    .map((slide) => ({
      relevance: relevanceBySlide.get(slide.slideNumber)!,
      slideNumber: slide.slideNumber,
    }));
  const selectedRelatedSlides = selectRelatedStaticSlides(staticCandidates);

  return slides.map((slide) => {
    const assetRole = roles[slide.slideNumber - 1]!;
    const relevance = relevanceBySlide.get(slide.slideNumber)!;
    const useRelated =
      assetRole === "static" &&
      Boolean(relatedCategory) &&
      selectedRelatedSlides.has(slide.slideNumber);

    return {
      assetRole,
      categorySlug: useRelated ? relatedCategory! : params.primaryCategory,
      relevanceLevel: useRelated ? relevance.level : "none",
      relevanceReason: useRelated ? relevance.reason : null,
      selectionType: useRelated ? "related" : "primary",
      slideNumber: slide.slideNumber,
    };
  });
}

export function getRelatedCarouselImageLibraryCategory(
  primaryCategory: CarouselImageLibraryCategory,
) {
  return RELATED_CATEGORY_BY_PRIMARY[primaryCategory] ?? null;
}

function calculateRelatedCategoryRelevance(
  slide: CarouselSlideSemanticInput,
  relatedCategory: CarouselImageLibraryCategory,
): SlideRelevance {
  if (relatedCategory !== "food" && relatedCategory !== "gym") {
    return { level: "none", reason: null, score: 0 };
  }

  const visibleText = normalizeText(slide.visibleText);
  const supportingText = normalizeText(slide.supportingText ?? []);
  const matchedConcepts = new Map<string, number>();

  for (const signal of RELATED_SIGNALS[relatedCategory]) {
    const visibleMatch = signal.terms.some((term) =>
      containsWholeTerm(visibleText, term),
    );
    const supportingMatch = signal.terms.some((term) =>
      containsWholeTerm(supportingText, term),
    );
    const effectiveWeight = visibleMatch
      ? signal.weight
      : supportingMatch
        ? Math.max(1, signal.weight - 1)
        : 0;

    if (effectiveWeight > 0) {
      matchedConcepts.set(signal.concept, effectiveWeight);
    }
  }

  const weights = [...matchedConcepts.values()];
  const score = weights.reduce((total, weight) => total + weight, 0);
  const strongestSignal = Math.max(0, ...weights);
  const level: CarouselImageRelevanceLevel =
    strongestSignal >= 3 || score >= 4
      ? "strong"
      : score >= 2
        ? "moderate"
        : score === 1
          ? "light"
          : "none";

  return {
    level,
    reason:
      level === "none"
        ? null
        : `${relatedCategory}:${[...matchedConcepts.keys()].sort().join(",")}`,
    score,
  };
}

function selectRolePattern(params: {
  carouselId: string;
  relevanceBySlide: ReadonlyMap<number, SlideRelevance>;
}) {
  const humanFirstScore = scoreRolePattern(
    HUMAN_FIRST_ROLES,
    params.relevanceBySlide,
  );
  const staticFirstScore = scoreRolePattern(
    STATIC_FIRST_ROLES,
    params.relevanceBySlide,
  );

  if (humanFirstScore !== staticFirstScore) {
    return humanFirstScore > staticFirstScore
      ? HUMAN_FIRST_ROLES
      : STATIC_FIRST_ROLES;
  }

  return stableHash(params.carouselId) % 2 === 0
    ? HUMAN_FIRST_ROLES
    : STATIC_FIRST_ROLES;
}

function scoreRolePattern(
  roles: readonly CarouselSlideImageRole[],
  relevanceBySlide: ReadonlyMap<number, SlideRelevance>,
) {
  return roles.reduce(
    (score, role, index) =>
      role === "static"
        ? score + (relevanceBySlide.get(index + 1)?.score ?? 0)
        : score,
    0,
  );
}

function selectRelatedStaticSlides(
  candidates: readonly { relevance: SlideRelevance; slideNumber: number }[],
) {
  const meaningful = candidates.filter((candidate) =>
    ["moderate", "strong"].includes(candidate.relevance.level),
  );

  if (meaningful.length > 0) {
    return new Set(
      meaningful
        .sort(compareCandidates)
        .slice(0, 2)
        .map((candidate) => candidate.slideNumber),
    );
  }

  const light = candidates
    .filter((candidate) => candidate.relevance.level === "light")
    .sort(compareCandidates)[0];

  return new Set(light ? [light.slideNumber] : []);
}

function compareCandidates(
  left: { relevance: SlideRelevance; slideNumber: number },
  right: { relevance: SlideRelevance; slideNumber: number },
) {
  return (
    right.relevance.score - left.relevance.score ||
    left.slideNumber - right.slideNumber
  );
}

function normalizeSlides(slides: readonly CarouselSlideSemanticInput[]) {
  const ordered = [...slides].sort(
    (left, right) => left.slideNumber - right.slideNumber,
  );

  if (
    ordered.length !== 6 ||
    ordered.some((slide, index) => slide.slideNumber !== index + 1)
  ) {
    throw new Error(
      "Carousel slide-image planning requires slide numbers 1 through 6 exactly once.",
    );
  }

  return ordered;
}

function normalizeText(values: readonly unknown[]) {
  return values
    .flatMap((value) =>
      Array.isArray(value) ? value : typeof value === "string" ? [value] : [],
    )
    .join(" ")
    .toLowerCase()
    .replace(/\bfood for thought\b/g, " ")
    .replace(/\btrain of thought\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWholeTerm(value: string, term: string) {
  const normalizedTerm = normalizeText([term]);
  return Boolean(
    normalizedTerm && ` ${value} `.includes(` ${normalizedTerm} `),
  );
}

function stableHash(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
