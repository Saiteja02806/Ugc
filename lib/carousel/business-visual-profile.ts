import {
  getVisualBucket,
  type CarouselSlideIntent,
  type CarouselVertical,
  type VisualBucketId,
} from "./visual-bucket-taxonomy";

export type CarouselBusinessVisualProfileId =
  | "beauty-skincare"
  | "fitness-health"
  | "generic-business"
  | "marketing-saas"
  | "productivity-saas"
  | "wellness";

export type CarouselProfileBucketTargetCounts = Partial<
  Record<VisualBucketId, number>
>;

export type CarouselBusinessVisualProfile = {
  readonly bucketTargetCounts?: CarouselProfileBucketTargetCounts;
  readonly categorySlug: string;
  readonly description: string;
  readonly id: CarouselBusinessVisualProfileId;
  readonly knownGaps?: readonly string[];
  readonly label: string;
  readonly primaryVertical: CarouselVertical;
  readonly requiredBucketIds: readonly VisualBucketId[];
  readonly requiredSlideIntents: readonly CarouselSlideIntent[];
  readonly seedPriorityBucketIds: readonly VisualBucketId[];
};

const DEFAULT_REQUIRED_SLIDE_INTENTS: readonly CarouselSlideIntent[] = [
  "hook",
  "problem",
  "solution",
  "benefit",
  "cta",
];

export const CAROUSEL_BUSINESS_VISUAL_PROFILES = [
  {
    id: "fitness-health",
    label: "Fitness and Health",
    categorySlug: "fitness-health",
    primaryVertical: "fitness-health",
    description:
      "Fitness, nutrition, calorie tracking, workouts, wellness habits, and health app stories.",
    requiredSlideIntents: [
      "hook",
      "problem",
      "mistake",
      "solution",
      "benefit",
      "cta",
    ],
    seedPriorityBucketIds: [
      "phone-in-hand",
      "meal-moments",
      "tired-couch",
      "grocery-aisle",
      "water-glass",
      "night-routine",
      "clean-still-life",
      "meal-prep",
      "food-scale",
      "healthy-snacks",
      "gym-phone",
      "post-workout",
    ],
    bucketTargetCounts: {
      "abstract-data": 20,
      "clean-still-life": 25,
      "food-scale": 35,
      "grocery-aisle": 35,
      "gym-phone": 35,
      "healthy-snacks": 30,
      "meal-moments": 40,
      "meal-prep": 40,
      "night-routine": 25,
      "phone-in-hand": 40,
      "post-workout": 30,
      "tired-couch": 25,
      "water-glass": 25,
    },
    requiredBucketIds: [
      "meal-moments",
      "phone-in-hand",
      "tired-couch",
      "grocery-aisle",
      "water-glass",
      "night-routine",
      "clean-still-life",
      "abstract-data",
      "meal-prep",
      "food-scale",
      "healthy-snacks",
      "gym-phone",
      "post-workout",
    ],
  },
  {
    id: "marketing-saas",
    label: "Marketing SaaS",
    categorySlug: "marketing-saas",
    primaryVertical: "saas-work",
    description:
      "Ad platforms, content calendars, campaign automation, analytics, CRM, email, social, and growth tools.",
    requiredSlideIntents: DEFAULT_REQUIRED_SLIDE_INTENTS,
    seedPriorityBucketIds: [
      "laptop-desk",
      "phone-notification",
      "desk-chaos",
      "calendar-overload",
      "spreadsheet-chaos",
      "team-meeting",
      "abstract-data",
      "clean-still-life",
    ],
    bucketTargetCounts: {
      "abstract-data": 30,
      "calendar-overload": 40,
      "clean-still-life": 30,
      "desk-chaos": 30,
      "laptop-desk": 40,
      "laptop-work": 20,
      "night-routine": 20,
      "phone-in-hand": 20,
      "phone-notification": 40,
      "spreadsheet-chaos": 40,
      "team-meeting": 30,
      "tired-couch": 20,
    },
    requiredBucketIds: [
      "phone-in-hand",
      "tired-couch",
      "desk-chaos",
      "laptop-work",
      "night-routine",
      "clean-still-life",
      "abstract-data",
      "laptop-desk",
      "calendar-overload",
      "spreadsheet-chaos",
      "phone-notification",
      "team-meeting",
    ],
  },
  {
    id: "productivity-saas",
    label: "Productivity SaaS",
    categorySlug: "productivity-saas",
    primaryVertical: "saas-work",
    description:
      "AI agents, workflow automation, project management, team collaboration, and operations tools.",
    requiredSlideIntents: DEFAULT_REQUIRED_SLIDE_INTENTS,
    seedPriorityBucketIds: [
      "laptop-desk",
      "desk-chaos",
      "calendar-overload",
      "team-meeting",
      "phone-notification",
      "clean-still-life",
    ],
    bucketTargetCounts: {
      "abstract-data": 35,
      "calendar-overload": 35,
      "clean-still-life": 30,
      "desk-chaos": 35,
      "laptop-desk": 40,
      "laptop-work": 30,
      "night-routine": 20,
      "phone-in-hand": 25,
      "phone-notification": 35,
      "spreadsheet-chaos": 30,
      "team-meeting": 35,
      "tired-couch": 25,
    },
    requiredBucketIds: [
      "phone-in-hand",
      "tired-couch",
      "desk-chaos",
      "laptop-work",
      "night-routine",
      "clean-still-life",
      "abstract-data",
      "laptop-desk",
      "calendar-overload",
      "spreadsheet-chaos",
      "phone-notification",
      "team-meeting",
    ],
  },
  {
    id: "wellness",
    label: "Wellness",
    categorySlug: "wellness",
    primaryVertical: "wellness",
    description:
      "Habit coaching, mindfulness, sleep, mental reset, self-improvement, and soft lifestyle products.",
    requiredSlideIntents: DEFAULT_REQUIRED_SLIDE_INTENTS,
    seedPriorityBucketIds: [
      "tired-couch",
      "water-glass",
      "night-routine",
      "phone-in-hand",
      "clean-still-life",
      "meal-moments",
    ],
    bucketTargetCounts: {
      "clean-still-life": 30,
      "desk-chaos": 20,
      "grocery-aisle": 20,
      "healthy-snacks": 25,
      "laptop-work": 20,
      "meal-moments": 25,
      "meal-prep": 20,
      "night-routine": 35,
      "phone-in-hand": 30,
      "post-workout": 25,
      "tired-couch": 35,
      "water-glass": 35,
    },
    requiredBucketIds: [
      "meal-moments",
      "phone-in-hand",
      "tired-couch",
      "desk-chaos",
      "laptop-work",
      "grocery-aisle",
      "water-glass",
      "night-routine",
      "clean-still-life",
      "meal-prep",
      "healthy-snacks",
      "post-workout",
    ],
  },
  {
    id: "beauty-skincare",
    label: "Beauty and Skincare",
    categorySlug: "beauty-skincare",
    primaryVertical: "wellness",
    description:
      "Beauty, skincare, cosmetic, routine, and personal-care stories using the current wellness-adjacent library.",
    knownGaps: [
      "Needs product-specific beauty buckets before it is production-grade.",
      "Needs bathroom vanity, mirror routine, cosmetic product, and skincare texture buckets.",
    ],
    requiredSlideIntents: DEFAULT_REQUIRED_SLIDE_INTENTS,
    seedPriorityBucketIds: [
      "clean-still-life",
      "night-routine",
      "water-glass",
      "phone-in-hand",
      "tired-couch",
    ],
    bucketTargetCounts: {
      "clean-still-life": 30,
      "meal-moments": 20,
      "night-routine": 25,
      "phone-in-hand": 20,
      "tired-couch": 20,
      "water-glass": 25,
    },
    requiredBucketIds: [
      "phone-in-hand",
      "tired-couch",
      "water-glass",
      "night-routine",
      "clean-still-life",
      "meal-moments",
    ],
  },
  {
    id: "generic-business",
    label: "Generic Business",
    categorySlug: "generic-business",
    primaryVertical: "saas-work",
    description:
      "Fallback for B2B, services, consulting, and broad business workflows when a tighter profile is not available.",
    knownGaps: [
      "Needs industry-specific profiles for ecommerce, local services, education, finance, and real estate.",
    ],
    requiredSlideIntents: DEFAULT_REQUIRED_SLIDE_INTENTS,
    seedPriorityBucketIds: [
      "laptop-desk",
      "team-meeting",
      "clean-still-life",
      "phone-in-hand",
      "desk-chaos",
    ],
    bucketTargetCounts: {
      "abstract-data": 25,
      "calendar-overload": 25,
      "clean-still-life": 30,
      "desk-chaos": 25,
      "laptop-desk": 35,
      "laptop-work": 25,
      "night-routine": 20,
      "phone-in-hand": 30,
      "phone-notification": 25,
      "spreadsheet-chaos": 25,
      "team-meeting": 35,
      "tired-couch": 20,
    },
    requiredBucketIds: [
      "phone-in-hand",
      "tired-couch",
      "desk-chaos",
      "laptop-work",
      "night-routine",
      "clean-still-life",
      "abstract-data",
      "laptop-desk",
      "calendar-overload",
      "spreadsheet-chaos",
      "phone-notification",
      "team-meeting",
    ],
  },
] as const satisfies readonly CarouselBusinessVisualProfile[];

const profileMap = new Map<string, CarouselBusinessVisualProfile>(
  CAROUSEL_BUSINESS_VISUAL_PROFILES.map((profile) => [profile.id, profile]),
);

const PROFILE_KEYWORDS: Record<CarouselBusinessVisualProfileId, readonly string[]> =
  {
    "fitness-health": [
      "calorie",
      "fitness",
      "gym",
      "health",
      "meal",
      "nutrition",
      "protein",
      "workout",
    ],
    "marketing-saas": [
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
      "social",
    ],
    "productivity-saas": [
      "agent",
      "ai",
      "automation",
      "collaboration",
      "dashboard",
      "notion",
      "operations",
      "productivity",
      "project",
      "saas",
      "software",
      "team",
      "workflow",
      "workspace",
    ],
    wellness: [
      "habit",
      "meditation",
      "mindful",
      "self improvement",
      "sleep",
      "therapy",
      "wellness",
    ],
    "beauty-skincare": [
      "beauty",
      "cosmetic",
      "glow",
      "makeup",
      "serum",
      "skin care",
      "skincare",
      "spa",
    ],
    "generic-business": [],
  };

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(cleanString).filter(Boolean);
}

function normalizeProfileMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function categoryMatchesProfile(
  category: string,
  profile: CarouselBusinessVisualProfile,
) {
  if (!category) {
    return false;
  }

  const normalizedCategory = normalizeProfileMatchText(category);
  const profileNames = [
    profile.id,
    profile.categorySlug,
    profile.label,
    profile.label.replace(/\band\b/gi, ""),
  ]
    .map(normalizeProfileMatchText)
    .filter(Boolean);

  return profileNames.some(
    (name) =>
      normalizedCategory === name || normalizedCategory.includes(name),
  );
}

export function getCarouselBusinessVisualProfile(
  profileId: CarouselBusinessVisualProfileId,
) {
  return profileMap.get(profileId) ?? null;
}

export function getCarouselBusinessProfileBucketTargetCount(
  profile: CarouselBusinessVisualProfile,
  bucketId: VisualBucketId,
) {
  const bucket = getVisualBucket(bucketId);
  const profileTargetCount = profile.bucketTargetCounts?.[bucketId];

  return profileTargetCount ?? bucket?.targetCount ?? 0;
}

export function resolveCarouselBusinessVisualProfile(input: {
  category?: unknown;
  pexelsImageQueries?: unknown;
  productSummary?: unknown;
  valueProps?: unknown;
  visualKeywords?: unknown;
}) {
  const category = cleanString(input.category);
  const explicitCategoryProfile = CAROUSEL_BUSINESS_VISUAL_PROFILES.find(
    (profile) => categoryMatchesProfile(category, profile),
  );

  if (explicitCategoryProfile) {
    return explicitCategoryProfile;
  }

  const haystack = [
    category,
    cleanString(input.productSummary),
    ...cleanStringArray(input.visualKeywords),
    ...cleanStringArray(input.valueProps),
    ...cleanStringArray(input.pexelsImageQueries),
  ]
    .join(" ")
    .toLowerCase();

  let bestProfile: CarouselBusinessVisualProfile | null = null;
  let bestScore = 0;

  for (const profile of CAROUSEL_BUSINESS_VISUAL_PROFILES) {
    const keywords = PROFILE_KEYWORDS[profile.id];
    const score = keywords.reduce(
      (total, keyword) =>
        haystack.includes(keyword) ? total + keyword.length : total,
      0,
    );

    if (score > bestScore) {
      bestProfile = profile;
      bestScore = score;
    }
  }

  return bestProfile ?? profileMap.get("generic-business")!;
}

export function validateCarouselBusinessVisualProfile(
  profile: CarouselBusinessVisualProfile,
) {
  const errors: string[] = [];

  for (const bucketId of profile.requiredBucketIds) {
    const bucket = getVisualBucket(bucketId);

    if (!bucket) {
      errors.push(`${profile.id} references unknown bucket "${bucketId}".`);
      continue;
    }

    if (!bucket.usableVerticals.includes(profile.primaryVertical)) {
      errors.push(
        `${profile.id} bucket "${bucketId}" is not usable for vertical "${profile.primaryVertical}".`,
      );
    }
  }

  for (const [bucketId, targetCount] of Object.entries(
    profile.bucketTargetCounts ?? {},
  )) {
    if (!profile.requiredBucketIds.includes(bucketId as VisualBucketId)) {
      errors.push(
        `${profile.id} target bucket "${bucketId}" must also be required.`,
      );
    }

    if (
      typeof targetCount !== "number" ||
      !Number.isInteger(targetCount) ||
      targetCount < 10 ||
      targetCount > 100
    ) {
      errors.push(
        `${profile.id} target bucket "${bucketId}" must be an integer between 10 and 100.`,
      );
    }
  }

  for (const bucketId of profile.seedPriorityBucketIds) {
    if (!profile.requiredBucketIds.includes(bucketId)) {
      errors.push(
        `${profile.id} seed priority bucket "${bucketId}" must also be required.`,
      );
    }
  }

  for (const intent of profile.requiredSlideIntents) {
    const matchingBucketCount = profile.requiredBucketIds.filter((bucketId) => {
      const bucket = getVisualBucket(bucketId);

      return bucket?.bestForSlideTypes.includes(intent) ?? false;
    }).length;

    if (matchingBucketCount < 2) {
      errors.push(
        `${profile.id} has weak "${intent}" coverage: ${matchingBucketCount} buckets.`,
      );
    }
  }

  return errors;
}
