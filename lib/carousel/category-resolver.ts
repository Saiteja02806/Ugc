export type ResolvedCarouselCategory = {
  categorySlug: string;
  queries: string[];
  visualKeywords: string[];
};

type CategoryRule = {
  keywords: string[];
  queries: string[];
  slug: string;
  visualKeywords: string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    slug: "marketing-saas",
    keywords: [
      "ad",
      "ads",
      "campaign",
      "content",
      "crm",
      "email",
      "growth",
      "lead",
      "marketing",
      "newsletter",
      "retention",
      "sales",
      "saas",
      "social",
    ],
    queries: [
      "marketing campaign planning desk",
      "content calendar laptop workspace",
      "social media manager laptop phone",
      "marketing analytics dashboard work",
      "email campaign workspace laptop",
      "crm sales pipeline laptop office",
    ],
    visualKeywords: [
      "campaign",
      "calendar",
      "analytics",
      "crm",
      "notifications",
      "laptop",
      "phone",
    ],
  },
  {
    slug: "fitness-nutrition",
    keywords: [
      "calorie",
      "fitness",
      "gym",
      "health",
      "meal",
      "nutrition",
      "protein",
      "wellness",
      "workout",
    ],
    queries: [
      "healthy meal prep bright kitchen",
      "fitness tracking phone workout",
      "fresh nutrition ingredients clean counter",
      "morning wellness routine",
    ],
    visualKeywords: ["health", "meal", "fitness", "routine", "wellness"],
  },
  {
    slug: "beauty-skincare",
    keywords: [
      "beauty",
      "cosmetic",
      "glow",
      "makeup",
      "serum",
      "skincare",
      "skin care",
      "spa",
    ],
    queries: [
      "premium skincare product bathroom light",
      "beauty routine mirror natural light",
      "cosmetic serum clean product scene",
      "minimal skincare shelf",
    ],
    visualKeywords: ["skincare", "beauty", "routine", "product", "clean"],
  },
  {
    slug: "productivity-saas",
    keywords: [
      "ai",
      "app",
      "automation",
      "collaboration",
      "dashboard",
      "notion",
      "productivity",
      "project",
      "saas",
      "software",
      "team",
      "workflow",
      "workspace",
    ],
    queries: [
      "startup founder working",
      "casual creator desk",
      "coffee shop laptop",
      "home office productivity",
      "young professional laptop",
      "woman working from home laptop",
      "man using laptop coffee shop",
      "creator planning content",
      "person holding phone laptop",
      "remote worker casual",
      "freelancer working from cafe",
      "casual laptop workspace",
      "young entrepreneur working",
      "creator filming content at desk",
      "person using phone and laptop",
      "team collaboration",
      "remote work",
      "office workspace",
      "people working on laptop",
      "technology meeting",
    ],
    visualKeywords: [
      "workspace",
      "laptop",
      "dashboard",
      "team",
      "planning",
      "creator",
      "casual",
      "founder",
      "coffee-shop",
      "home-office",
    ],
  },
];

const FALLBACK_CATEGORY: CategoryRule =
  CATEGORY_RULES.find((rule) => rule.slug === "productivity-saas") ??
  CATEGORY_RULES[0];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(cleanString)
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(haystack: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedKeyword).replace(
      /\s+/g,
      "\\s+",
    )}([^a-z0-9]|$)`,
  );

  return pattern.test(haystack);
}

export function normalizeCategorySlug(value: unknown, fallback = FALLBACK_CATEGORY.slug) {
  const cleaned = cleanString(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

export function resolveCarouselCategory(input: {
  category?: unknown;
  pexelsImageQueries?: unknown;
  productSummary?: unknown;
  valueProps?: unknown;
  visualKeywords?: unknown;
}): ResolvedCarouselCategory {
  const category = cleanString(input.category);
  const visualKeywords = cleanStringArray(input.visualKeywords);
  const valueProps = cleanStringArray(input.valueProps);
  const pexelsImageQueries = cleanStringArray(input.pexelsImageQueries);
  const productSummary = cleanString(input.productSummary);

  const haystack = [
    category,
    productSummary,
    ...visualKeywords,
    ...valueProps,
    ...pexelsImageQueries,
  ]
    .join(" ")
    .toLowerCase();

  const matchedRule = CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => keywordMatches(haystack, keyword)),
  );
  const categoryRule = matchedRule ?? FALLBACK_CATEGORY;

  return {
    categorySlug: matchedRule
      ? matchedRule.slug
      : normalizeCategorySlug(category || categoryRule.slug),
    queries: pexelsImageQueries.length > 0 ? pexelsImageQueries : categoryRule.queries,
    visualKeywords:
      visualKeywords.length > 0 ? visualKeywords : categoryRule.visualKeywords,
  };
}
