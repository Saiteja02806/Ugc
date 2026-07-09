import type { CarouselBusinessVisualProfileId } from "./carousel-business-visual-profile.js";

export const CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION = "broad-v1";

export const BROAD_VISUAL_BUCKET_IDS = [
  "workspace-objects",
  "phone-and-devices",
  "data-and-screens",
  "notes-and-planning",
  "home-lifestyle",
  "food-and-table",
  "fitness-wellness-objects",
  "product-still-life",
  "abstract-backgrounds",
  "clean-texture-backgrounds",
] as const;

export type BroadVisualBucketId = (typeof BROAD_VISUAL_BUCKET_IDS)[number];

export type BroadVisualBucket = {
  readonly bestForProfiles: readonly CarouselBusinessVisualProfileId[];
  readonly defaultTags: readonly string[];
  readonly description: string;
  readonly id: BroadVisualBucketId;
  readonly label: string;
};

export const BROAD_VISUAL_BUCKETS = [
  {
    id: "workspace-objects",
    label: "Workspace Objects",
    description: "Object-led laptop, desk, workspace, and work-surface scenes.",
    defaultTags: ["workspace", "desk", "laptop", "work", "productivity"],
    bestForProfiles: ["marketing-saas", "productivity-saas", "generic-business"],
  },
  {
    id: "phone-and-devices",
    label: "Phone and Devices",
    description: "Smartphones and devices for tracking, reminders, and apps.",
    defaultTags: ["phone", "device", "app", "notification", "tracking"],
    bestForProfiles: [
      "fitness-health",
      "marketing-saas",
      "productivity-saas",
      "wellness",
      "beauty-skincare",
      "generic-business",
    ],
  },
  {
    id: "data-and-screens",
    label: "Data and Screens",
    description: "Charts, spreadsheets, dashboards, analytics, and screens.",
    defaultTags: ["data", "dashboard", "analytics", "screen", "spreadsheet"],
    bestForProfiles: ["marketing-saas", "productivity-saas", "generic-business"],
  },
  {
    id: "notes-and-planning",
    label: "Notes and Planning",
    description: "Calendars, planners, notes, schedules, and planning artifacts.",
    defaultTags: ["planning", "calendar", "notes", "schedule", "whiteboard"],
    bestForProfiles: ["marketing-saas", "productivity-saas", "generic-business"],
  },
  {
    id: "home-lifestyle",
    label: "Home Lifestyle",
    description: "Home, couch, bedside, evening, and routine object scenes.",
    defaultTags: ["home", "evening", "couch", "routine", "after-hours"],
    bestForProfiles: [
      "fitness-health",
      "productivity-saas",
      "wellness",
      "beauty-skincare",
      "generic-business",
    ],
  },
  {
    id: "food-and-table",
    label: "Food and Table",
    description: "Meals, snacks, groceries, nutrition, and table scenes.",
    defaultTags: ["food", "meal", "nutrition", "table", "grocery"],
    bestForProfiles: ["fitness-health", "wellness", "beauty-skincare"],
  },
  {
    id: "fitness-wellness-objects",
    label: "Fitness and Wellness Objects",
    description: "Workout, hydration, recovery, habit, and wellness objects.",
    defaultTags: ["fitness", "wellness", "water", "recovery", "habit"],
    bestForProfiles: ["fitness-health", "wellness", "beauty-skincare"],
  },
  {
    id: "product-still-life",
    label: "Product Still Life",
    description: "Product-led still-life and clean commercial scenes.",
    defaultTags: ["product", "still-life", "packaging", "beauty", "premium"],
    bestForProfiles: ["fitness-health", "wellness", "beauty-skincare"],
  },
  {
    id: "abstract-backgrounds",
    label: "Abstract Backgrounds",
    description: "Abstract, data, texture, and neutral visual backgrounds.",
    defaultTags: ["abstract", "background", "texture", "neutral", "data"],
    bestForProfiles: [
      "fitness-health",
      "marketing-saas",
      "productivity-saas",
      "wellness",
      "beauty-skincare",
      "generic-business",
    ],
  },
  {
    id: "clean-texture-backgrounds",
    label: "Clean Texture Backgrounds",
    description: "Minimal negative-space surfaces for text-heavy slides.",
    defaultTags: ["clean", "minimal", "negative-space", "texture", "calm"],
    bestForProfiles: [
      "marketing-saas",
      "wellness",
      "beauty-skincare",
      "fitness-health",
      "generic-business",
    ],
  },
] as const satisfies readonly BroadVisualBucket[];

export const BROAD_BUCKET_REQUIREMENTS_BY_PROFILE = {
  "marketing-saas": [
    "workspace-objects",
    "phone-and-devices",
    "data-and-screens",
    "notes-and-planning",
    "abstract-backgrounds",
    "clean-texture-backgrounds",
  ],
  "productivity-saas": [
    "workspace-objects",
    "phone-and-devices",
    "data-and-screens",
    "notes-and-planning",
    "home-lifestyle",
    "abstract-backgrounds",
  ],
  "fitness-health": [
    "food-and-table",
    "phone-and-devices",
    "fitness-wellness-objects",
    "home-lifestyle",
    "abstract-backgrounds",
    "product-still-life",
  ],
  wellness: [
    "home-lifestyle",
    "fitness-wellness-objects",
    "product-still-life",
    "food-and-table",
    "abstract-backgrounds",
    "clean-texture-backgrounds",
  ],
  "beauty-skincare": [
    "product-still-life",
    "clean-texture-backgrounds",
    "home-lifestyle",
    "fitness-wellness-objects",
    "abstract-backgrounds",
  ],
  "generic-business": [
    "workspace-objects",
    "phone-and-devices",
    "data-and-screens",
    "notes-and-planning",
    "abstract-backgrounds",
    "clean-texture-backgrounds",
  ],
} as const satisfies Record<
  CarouselBusinessVisualProfileId,
  readonly BroadVisualBucketId[]
>;

export const BROAD_BUCKET_FALLBACKS_BY_PROFILE = {
  "marketing-saas": [
    "clean-texture-backgrounds",
    "abstract-backgrounds",
    "workspace-objects",
  ],
  "productivity-saas": [
    "abstract-backgrounds",
    "workspace-objects",
    "home-lifestyle",
  ],
  "fitness-health": [
    "abstract-backgrounds",
    "home-lifestyle",
    "fitness-wellness-objects",
  ],
  wellness: [
    "clean-texture-backgrounds",
    "abstract-backgrounds",
    "home-lifestyle",
    "product-still-life",
  ],
  "beauty-skincare": [
    "clean-texture-backgrounds",
    "abstract-backgrounds",
    "product-still-life",
  ],
  "generic-business": [
    "abstract-backgrounds",
    "clean-texture-backgrounds",
    "workspace-objects",
    "home-lifestyle",
  ],
} as const satisfies Record<
  CarouselBusinessVisualProfileId,
  readonly BroadVisualBucketId[]
>;

const BROAD_ASSET_SOURCE_BUCKETS_BY_PROFILE = {
  "beauty-skincare": {
    "marketing-saas": ["clean-texture-backgrounds"],
    shared: [
      "home-lifestyle",
      "fitness-wellness-objects",
      "product-still-life",
      "abstract-backgrounds",
    ],
  },
  "fitness-health": {
    shared: [
      "home-lifestyle",
      "fitness-wellness-objects",
      "product-still-life",
      "abstract-backgrounds",
    ],
  },
  "generic-business": {
    "marketing-saas": [
      "workspace-objects",
      "phone-and-devices",
      "data-and-screens",
      "notes-and-planning",
      "abstract-backgrounds",
      "clean-texture-backgrounds",
    ],
    shared: ["home-lifestyle"],
  },
  "marketing-saas": {},
  "productivity-saas": {
    "marketing-saas": [
      "workspace-objects",
      "phone-and-devices",
      "data-and-screens",
      "notes-and-planning",
      "home-lifestyle",
      "abstract-backgrounds",
    ],
    shared: ["home-lifestyle"],
  },
  wellness: {
    "fitness-health": [
      "food-and-table",
      "fitness-wellness-objects",
      "product-still-life",
    ],
    "marketing-saas": ["clean-texture-backgrounds"],
    shared: [
      "home-lifestyle",
      "fitness-wellness-objects",
      "product-still-life",
      "abstract-backgrounds",
    ],
  },
} as const satisfies Record<
  CarouselBusinessVisualProfileId,
  Readonly<Record<string, readonly BroadVisualBucketId[]>>
>;

const broadBucketMap = new Map<string, BroadVisualBucket>(
  BROAD_VISUAL_BUCKETS.map((bucket) => [bucket.id, bucket]),
);

export function getBroadVisualBucket(value: string) {
  return broadBucketMap.get(value) ?? null;
}

export function isBroadVisualBucketId(
  value: string,
): value is BroadVisualBucketId {
  return broadBucketMap.has(value);
}

export function getBroadBucketRequirementsForProfile(
  profileId: CarouselBusinessVisualProfileId,
) {
  return BROAD_BUCKET_REQUIREMENTS_BY_PROFILE[profileId];
}

export function getBroadBucketFallbacksForProfile(
  profileId: CarouselBusinessVisualProfileId,
) {
  return BROAD_BUCKET_FALLBACKS_BY_PROFILE[profileId];
}

export function getBroadAssetSourceCategorySlugsForProfile(
  profileId: CarouselBusinessVisualProfileId,
  primaryCategorySlug: string,
) {
  return Array.from(
    new Set([
      primaryCategorySlug,
      ...Object.keys(BROAD_ASSET_SOURCE_BUCKETS_BY_PROFILE[profileId]),
    ]),
  );
}

export function isBroadAssetSourceAllowedForProfile(input: {
  broadBucketId: BroadVisualBucketId;
  primaryCategorySlug: string;
  profileId: CarouselBusinessVisualProfileId;
  sourceCategorySlug: string;
}) {
  if (input.sourceCategorySlug === input.primaryCategorySlug) {
    return true;
  }

  const sourcePolicy = BROAD_ASSET_SOURCE_BUCKETS_BY_PROFILE[input.profileId] as
    Readonly<Record<string, readonly BroadVisualBucketId[] | undefined>>;

  return Boolean(
    sourcePolicy[input.sourceCategorySlug]?.includes(input.broadBucketId),
  );
}

export function validateBroadBucketProfileConfiguration(
  profileId: CarouselBusinessVisualProfileId,
) {
  const errors: string[] = [];
  const bucketIds = [
    ...getBroadBucketRequirementsForProfile(profileId),
    ...getBroadBucketFallbacksForProfile(profileId),
  ];

  for (const bucketId of bucketIds) {
    const bucket = getBroadVisualBucket(bucketId);

    if (!bucket) {
      errors.push(`${profileId} references unknown broad bucket "${bucketId}".`);
      continue;
    }

    if (!bucket.bestForProfiles.includes(profileId)) {
      errors.push(
        `${profileId} cannot use broad bucket "${bucketId}" as a required or fallback pool.`,
      );
    }
  }

  return errors;
}
