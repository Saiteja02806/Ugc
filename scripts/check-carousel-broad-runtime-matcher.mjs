import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": workspaceRoot },
});

const {
  CAROUSEL_BUSINESS_VISUAL_PROFILES,
  getCarouselBusinessVisualProfile,
  resolveCarouselBusinessVisualProfile,
} = await jiti.import("../lib/carousel/business-visual-profile.ts");
const {
  CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  compareBroadAndLegacySelections,
  getCarouselBroadMatcherMode,
  selectBroadRuntimeVisualAssets,
} = await jiti.import("../lib/carousel/broad-runtime-visual-matcher.ts");
const {
  CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
  getBroadBucketFallbacksForProfile,
  isBroadAssetSourceAllowedForProfile,
  validateBroadBucketProfileConfiguration,
} = await jiti.import("../lib/carousel/broad-visual-bucket-taxonomy.ts");

const profile = getCarouselBusinessVisualProfile("marketing-saas");
const productivityProfile = getCarouselBusinessVisualProfile("productivity-saas");
const sharedHomeProfiles = [
  "productivity-saas",
  "fitness-health",
  "wellness",
  "beauty-skincare",
  "generic-business",
].map((profileId) => getCarouselBusinessVisualProfile(profileId));

if (!profile) {
  throw new Error("Marketing SaaS profile is missing.");
}

if (!productivityProfile) {
  throw new Error("Productivity SaaS profile is missing.");
}

if (sharedHomeProfiles.some((item) => !item)) {
  throw new Error("One or more shared home-lifestyle profiles are missing.");
}

const failures = [];

for (const item of CAROUSEL_BUSINESS_VISUAL_PROFILES) {
  const errors = validateBroadBucketProfileConfiguration(item.id);

  if (errors.length > 0) {
    failures.push({ errors, profileId: item.id });
  }
}

assertEqual(getCarouselBroadMatcherMode(undefined), "off", "default mode");
assertEqual(getCarouselBroadMatcherMode("dry-run"), "dry-run", "dry-run mode");
assertEqual(getCarouselBroadMatcherMode("ENABLED"), "enabled", "enabled mode");
assertEqual(getCarouselBroadMatcherMode("invalid"), "off", "invalid mode fallback");
assertEqual(
  resolveCarouselBusinessVisualProfile({
    category: "Beauty Skincare",
    productSummary:
      "A skincare app that simplifies product steps into one repeatable habit.",
    visualKeywords: ["skincare", "cosmetic bottles", "clean routine"],
  }).id,
  "beauty-skincare",
  "Beauty Skincare category beats overlapping Wellness habit keywords",
);

const marketingFallbacks = getBroadBucketFallbacksForProfile("marketing-saas");
assertEqual(
  marketingFallbacks.join(","),
  "clean-texture-backgrounds,abstract-backgrounds,workspace-objects",
  "Marketing SaaS logical fallbacks",
);

for (const profileId of ["fitness-health", "wellness", "beauty-skincare"]) {
  for (const broadBucketId of [
    "home-lifestyle",
    "fitness-wellness-objects",
    "product-still-life",
    "abstract-backgrounds",
  ]) {
    assertEqual(
      isBroadAssetSourceAllowedForProfile({
        broadBucketId,
        primaryCategorySlug: profileId,
        profileId,
        sourceCategorySlug: "shared",
      }),
      true,
      `${profileId} can use shared ${broadBucketId}`,
    );
  }
}

assertEqual(
  isBroadAssetSourceAllowedForProfile({
    broadBucketId: "product-still-life",
    primaryCategorySlug: "generic-business",
    profileId: "generic-business",
    sourceCategorySlug: "shared",
  }),
  false,
  "Generic Business cannot use shared wellness product assets",
);

const assets = [
  mockAsset({
    broadBucketId: "data-and-screens",
    contentTags: ["analytics", "dashboard", "marketing"],
    id: "data-strong",
    objectTags: ["screen", "chart"],
  }),
  mockAsset({
    broadBucketId: "data-and-screens",
    contentTags: ["chart"],
    id: "data-weak",
    objectTags: ["screen"],
    usageCount: 1,
  }),
  mockAsset({
    broadBucketId: "clean-texture-backgrounds",
    contentTags: ["clean", "minimal"],
    id: "clean-fallback",
  }),
  mockAsset({
    broadBucketId: "workspace-objects",
    contentTags: ["workspace", "laptop"],
    id: "workspace-fallback",
  }),
  mockAsset({
    broadBucketId: "data-and-screens",
    contentTags: ["analytics", "dashboard"],
    hasHuman: true,
    id: "unsafe-human",
    imageSubjectClass: "faceless-human",
    personCount: 1,
    subjectReviewStatus: "rejected",
  }),
  mockAsset({
    broadBucketId: "data-and-screens",
    categorySlug: "fitness-health",
    contentTags: ["analytics", "dashboard"],
    id: "wrong-category",
  }),
];
const slides = [
  mockSlide({
    body: "Compare every campaign metric in one place.",
    headline: "Your analytics dashboard should explain growth",
    slideNumber: 1,
    slideType: "solution",
  }),
  mockSlide({
    headline: "Your content calendar should not feel chaotic",
    slideNumber: 2,
    slideType: "problem",
  }),
  mockSlide({
    body: "A chart makes reporting clearer.",
    headline: "Turn campaign reporting into useful data",
    slideNumber: 3,
    slideType: "benefit",
  }),
];
const selections = selectBroadRuntimeVisualAssets({
  assets,
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-app-check",
  slides,
});

assertEqual(selections.length, 3, "main selection count");
assertEqual(selections[0]?.asset.id, "data-strong", "exact data asset");
assertEqual(selections[0]?.fallbackReason, "exact_match", "exact match reason");
assertEqual(
  selections[1]?.asset.id,
  "clean-fallback",
  "logical profile fallback asset",
);
assertEqual(
  selections[1]?.fallbackReason,
  "profile_fallback",
  "logical profile fallback reason",
);
assertEqual(selections[2]?.asset.id, "data-weak", "unused target asset preference");

if (selections.some((selection) => selection.asset.id === "unsafe-human")) {
  failures.push({ error: "Strict safety filter selected a human-positive asset." });
}

if (selections.some((selection) => selection.asset.id === "wrong-category")) {
  failures.push({ error: "Matcher selected an unrelated category asset." });
}

const productivitySharedSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "workspace-objects",
      categorySlug: "marketing-saas",
      contentTags: ["workspace", "workflow", "automation"],
      id: "marketing-workspace-shared",
      objectTags: ["laptop", "desk"],
    }),
    mockAsset({
      broadBucketId: "workspace-objects",
      categorySlug: "fitness-health",
      contentTags: ["workspace", "workflow"],
      id: "fitness-workspace-blocked",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "productivity-saas",
  profile: productivityProfile,
  seed: "broad-matcher-productivity-shared-source-check",
  slides: [
    mockSlide({
      headline: "Automate your workspace workflow",
      slideNumber: 1,
      slideType: "solution",
    }),
  ],
});
assertEqual(
  productivitySharedSelections[0]?.asset.id,
  "marketing-workspace-shared",
  "Productivity SaaS can reuse compatible Marketing SaaS broad assets",
);
assertEqual(
  productivitySharedSelections.length,
  1,
  "unrelated source category remains blocked for Productivity SaaS",
);

const productivityUnsupportedBucketSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "clean-texture-backgrounds",
      categorySlug: "marketing-saas",
      contentTags: ["clean", "minimal"],
      id: "marketing-clean-unsupported",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "productivity-saas",
  profile: productivityProfile,
  seed: "broad-matcher-productivity-unsupported-bucket-check",
  slides: [
    mockSlide({
      headline: "Start with a clean simple workflow",
      slideNumber: 1,
      slideType: "cta",
    }),
  ],
});
assertEqual(
  productivityUnsupportedBucketSelections.length,
  0,
  "Productivity SaaS does not reuse Marketing SaaS buckets outside its allowed broad pools",
);

for (const sharedProfile of sharedHomeProfiles) {
  const sharedHomeSelections = selectBroadRuntimeVisualAssets({
    assets: [
      mockAsset({
        broadBucketId: "home-lifestyle",
        categorySlug: "shared",
        contentTags: ["home", "evening", "routine"],
        id: `shared-home-${sharedProfile.id}`,
        objectTags: ["couch", "lamp"],
      }),
    ],
    candidateIndex: 0,
    categorySlug: sharedProfile.id,
    profile: sharedProfile,
    seed: `broad-matcher-${sharedProfile.id}-shared-home-check`,
    slides: [
      mockSlide({
        headline: "Make the evening routine easier at home",
        slideNumber: 1,
        slideType: "problem",
      }),
    ],
  });

  assertEqual(
    sharedHomeSelections[0]?.asset.categorySlug,
    "shared",
    `${sharedProfile.id} can use the shared home-lifestyle source pool`,
  );
}

const wellnessProfile = sharedHomeProfiles.find(
  (item) => item.id === "wellness",
);
const wellnessReuseSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "food-and-table",
      categorySlug: "fitness-health",
      contentTags: ["food", "meal", "wellness"],
      id: "fitness-food-shared-with-wellness",
      objectTags: ["meal", "table"],
    }),
    mockAsset({
      broadBucketId: "clean-texture-backgrounds",
      categorySlug: "marketing-saas",
      contentTags: ["clean", "calm", "minimal"],
      id: "marketing-clean-shared-with-wellness",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "wellness",
  profile: wellnessProfile,
  seed: "broad-matcher-wellness-cross-category-reuse-check",
  slides: [
    mockSlide({
      headline: "Plan every nutrition meal at the food table",
      slideNumber: 1,
      slideType: "solution",
    }),
    mockSlide({
      headline: "Start with one clean minimal background",
      slideNumber: 2,
      slideType: "cta",
    }),
  ],
});
assertEqual(
  Array.from(
    new Set(wellnessReuseSelections.map((selection) => selection.asset.categorySlug)),
  )
    .sort()
    .join(","),
  "fitness-health,marketing-saas",
  "Wellness can reuse Fitness Health and Marketing SaaS assets",
);

const duplicateSlides = [
  mockSlide({
    headline: "Analytics dashboard overview",
    slideNumber: 1,
    slideType: "hook",
  }),
  mockSlide({
    headline: "Analytics dashboard details",
    slideNumber: 2,
    slideType: "benefit",
  }),
];
const duplicateSelections = selectBroadRuntimeVisualAssets({
  assets: [assets[0]],
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-safe-reuse-check",
  slides: duplicateSlides,
});

assertEqual(duplicateSelections.length, 2, "safe reuse selection count");
assertEqual(
  duplicateSelections[1]?.fallbackReason,
  "duplicate_safe_reuse",
  "safe reuse reason",
);
assertEqual(
  duplicateSelections[1]?.duplicatePenaltyApplied,
  true,
  "safe reuse duplicate penalty",
);

const nearDuplicateSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "data-and-screens",
      contentTags: ["analytics", "dashboard"],
      id: "near-data-a",
      nearDuplicateGroup: "known-data-pair",
    }),
    mockAsset({
      broadBucketId: "data-and-screens",
      contentTags: ["analytics", "dashboard"],
      id: "near-data-b",
      nearDuplicateGroup: "known-data-pair",
    }),
    mockAsset({
      broadBucketId: "clean-texture-backgrounds",
      id: "near-safe-alternative",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-near-duplicate-check",
  slides: duplicateSlides,
});
assertEqual(nearDuplicateSelections.length, 2, "near duplicate selection count");
assertEqual(
  nearDuplicateSelections[1]?.asset.id,
  "near-safe-alternative",
  "near duplicate alternative",
);
assertEqual(
  nearDuplicateSelections[1]?.nearDuplicateAvoided,
  true,
  "near duplicate avoided diagnostic",
);

const noSafeSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "data-and-screens",
      id: "unreviewed",
      subjectReviewStatus: "unreviewed",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-no-safe-check",
  slides: duplicateSlides,
});
assertEqual(noSafeSelections.length, 0, "unreviewed assets are blocked");

const spreadAssets = Array.from({ length: 12 }, (_, index) =>
  mockAsset({
    broadBucketId: "data-and-screens",
    contentTags: ["analytics", "dashboard"],
    id: `spread-data-${String(index + 1).padStart(2, "0")}`,
    objectTags: ["screen", "chart"],
  }),
);
const spreadSelections = Array.from({ length: 20 }, (_, candidateIndex) =>
  selectBroadRuntimeVisualAssets({
    assets: spreadAssets,
    candidateIndex,
    categorySlug: "marketing-saas",
    profile,
    seed: "broad-matcher-candidate-spread-check",
    slides: [
      mockSlide({
        headline: "Analytics dashboard overview",
        slideNumber: 1,
        slideType: "hook",
      }),
    ],
  })[0],
).filter(Boolean);
const spreadCounts = countBy(
  spreadSelections,
  (selection) => selection.asset.id,
);
const uniqueSpreadAssetCount = Object.keys(spreadCounts).length;
const topSpreadReuseCount = Math.max(...Object.values(spreadCounts));

if (uniqueSpreadAssetCount < 6) {
  failures.push({
    label: "candidate spread unique asset count",
    actual: uniqueSpreadAssetCount,
    expected: ">= 6",
    spreadCounts,
  });
}

if (topSpreadReuseCount > 6) {
  failures.push({
    label: "candidate spread top reuse count",
    actual: topSpreadReuseCount,
    expected: "<= 6",
    spreadCounts,
  });
}

const comparisons = compareBroadAndLegacySelections({
  broadSelections: selections,
  legacySelections: selections.map((selection) => ({
    asset: selection.asset,
    bucketId: selection.asset.visualBucket,
    hasHuman: selection.hasHuman,
    imageSubjectClass: selection.imageSubjectClass,
    intent: selection.intent,
    matchReason: ["legacy test selection"],
    mode: "bucket-profile",
    score: 50,
    slideNumber: selection.slideNumber,
  })),
  slides,
});
assertEqual(comparisons.length, slides.length, "comparison count");
assertEqual(comparisons[0]?.sameAsset, true, "comparison asset equality");

console.log(
  JSON.stringify(
    {
      comparisons,
      fallbackBuckets: marketingFallbacks,
      matcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
      selections: selections.map(toDiagnostic),
      taxonomyVersion: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push({ actual, expected, label });
  }
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function mockAsset({
  broadBucketId,
  categorySlug = "marketing-saas",
  contentTags = [],
  hasHuman = false,
  id,
  imageSubjectClass = "object-only",
  nearDuplicateGroup = null,
  objectTags = [],
  personCount = 0,
  subjectReviewStatus = "approved",
  usageCount = 0,
}) {
  return {
    baseS3Key: `category-library/${categorySlug}/${broadBucketId}/${id}.webp`,
    baseUrl: `https://cdn.example.test/${id}.webp`,
    bestForSlideTypes: [],
    broadVisualBucket: broadBucketId,
    bucketTaxonomyVersion: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
    bucketType: "universal",
    categorySlug,
    contentTags,
    faceCount: 0,
    hasHuman,
    id,
    imageQuery: null,
    imageSubjectClass,
    moodTags: [],
    nearDuplicateGroup,
    objectTags,
    pexelsPhotoId: id,
    pexelsPhotographer: null,
    personCount,
    primaryVertical: "saas-work",
    runtimeExclusionReason: null,
    sourceQuery: null,
    status: "ready",
    subjectReviewStatus,
    usageCount,
    usableVerticals: ["saas-work"],
    visualBucket: null,
    visualSetting: null,
    visualStyle: null,
  };
}

function mockSlide({ body = null, headline, slideNumber, slideType }) {
  return {
    body,
    ctaText: null,
    headline,
    imageDirection: null,
    layoutPreset: slideType === "hook" ? "top-hook" : "bottom-message",
    listItems: [],
    slideNumber,
    slideType,
    subtext: null,
    textMode: body ? "headline_body" : "single_statement",
    textPosition: slideType === "hook" ? "top" : "bottom",
  };
}

function toDiagnostic(selection) {
  return {
    assetId: selection.asset.id,
    broadBucketId: selection.broadBucketId,
    duplicatePenaltyApplied: selection.duplicatePenaltyApplied,
    fallbackReason: selection.fallbackReason,
    matchedTags: selection.matchedTags,
    score: selection.score,
    slideNumber: selection.slideNumber,
    targetBroadBucketId: selection.targetBroadBucketId,
  };
}
