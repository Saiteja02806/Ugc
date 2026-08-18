export const CAROUSEL_IMAGE_LIBRARY_CATEGORIES = [
  "gym",
  "food",
  "productivity",
  "dating",
  "travel",
  "skin",
] as const;

export type CarouselImageLibraryCategory =
  (typeof CAROUSEL_IMAGE_LIBRARY_CATEGORIES)[number];

type CategoryRule = {
  category: CarouselImageLibraryCategory;
  terms: readonly string[];
};

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "skin",
    terms: [
      "beauty",
      "cosmetic",
      "makeup",
      "serum",
      "skin",
      "skincare",
      "skin care",
      "spa",
    ],
  },
  {
    category: "dating",
    terms: [
      "couple",
      "dating",
      "matchmaking",
      "relationship",
      "romance",
      "romantic",
      "singles",
    ],
  },
  {
    category: "travel",
    terms: [
      "airline",
      "booking",
      "flight",
      "holiday",
      "hotel",
      "tourism",
      "travel",
      "trip",
      "vacation",
    ],
  },
  {
    category: "food",
    terms: [
      "calorie",
      "cooking",
      "diet",
      "food",
      "grocery",
      "meal",
      "nutrition",
      "recipe",
      "restaurant",
    ],
  },
  {
    category: "gym",
    terms: [
      "exercise",
      "fitness",
      "gym",
      "muscle",
      "personal trainer",
      "strength",
      "training",
      "workout",
    ],
  },
  {
    category: "productivity",
    terms: [
      "automation",
      "collaboration",
      "notion",
      "productivity",
      "project management",
      "saas",
      "software",
      "task management",
      "workflow",
      "workspace",
    ],
  },
];

function normalize(value: unknown) {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function normalizeValues(value: unknown) {
  return Array.isArray(value)
    ? value.map(normalize).filter(Boolean)
    : [normalize(value)].filter(Boolean);
}

function containsTerm(value: string, term: string) {
  const normalizedTerm = normalize(term);

  return Boolean(
    normalizedTerm &&
      (` ${value} `.includes(` ${normalizedTerm} `) || value === normalizedTerm),
  );
}

export function resolveCarouselImageLibraryCategory(input: {
  category?: unknown;
  categorySlug?: unknown;
  productSummary?: unknown;
  valueProps?: unknown;
  visualKeywords?: unknown;
}): CarouselImageLibraryCategory {
  const primaryValues = [
    ...normalizeValues(input.category),
    ...normalizeValues(input.categorySlug),
  ];
  const supportingValues = [
    ...normalizeValues(input.productSummary),
    ...normalizeValues(input.valueProps),
    ...normalizeValues(input.visualKeywords),
  ];
  const scores = CATEGORY_RULES.map((rule) => {
    const primaryScore = rule.terms.reduce(
      (score, term) =>
        score +
        primaryValues.filter((value) => containsTerm(value, term)).length * 5,
      0,
    );
    const supportingScore = rule.terms.reduce(
      (score, term) =>
        score + supportingValues.filter((value) => containsTerm(value, term)).length,
      0,
    );

    return {
      category: rule.category,
      score: primaryScore + supportingScore,
    };
  }).sort(
    (left, right) =>
      right.score - left.score || left.category.localeCompare(right.category),
  );
  const selected = scores[0];

  if (!selected || selected.score === 0) {
    throw new Error(
      "This business does not resolve to an active Carousel image-library category.",
    );
  }

  return selected.category;
}
