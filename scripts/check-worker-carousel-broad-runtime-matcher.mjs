const { getCarouselBusinessVisualProfile, resolveCarouselBusinessVisualProfile } = await import(
  "../worker/dist/lib/carousel-business-visual-profile.js"
);
const {
  CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  getCarouselBroadMatcherMode,
  resolveCarouselBroadMatcherMode,
  selectBroadRuntimeVisualAssets,
} = await import(
  "../worker/dist/lib/carousel-broad-runtime-visual-matcher.js"
);
const {
  CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
  getBroadBucketFallbacksForProfile,
  isBroadAssetSourceAllowedForProfile,
  validateBroadBucketProfileConfiguration,
} = await import(
  "../worker/dist/lib/carousel-broad-visual-bucket-taxonomy.js"
);

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
  throw new Error("Marketing SaaS worker profile is missing.");
}

if (!productivityProfile) {
  throw new Error("Productivity SaaS worker profile is missing.");
}

if (sharedHomeProfiles.some((item) => !item)) {
  throw new Error("One or more worker shared home-lifestyle profiles are missing.");
}

const failures = [];
const configurationErrors = validateBroadBucketProfileConfiguration(profile.id);

if (configurationErrors.length > 0) {
  failures.push({ configurationErrors });
}

assertEqual(getCarouselBroadMatcherMode(undefined), "off", "default mode");
assertEqual(getCarouselBroadMatcherMode("dry-run"), "dry-run", "dry-run mode");
assertEqual(
  resolveCarouselBusinessVisualProfile({
    category: "Beauty Skincare",
    productSummary:
      "A skincare app that simplifies product steps into one repeatable habit.",
    visualKeywords: ["skincare", "cosmetic bottles", "clean routine"],
  }).id,
  "beauty-skincare",
  "worker Beauty Skincare category beats overlapping Wellness habit keywords",
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
      `worker ${profileId} can use shared ${broadBucketId}`,
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
  "worker Generic Business cannot use shared wellness product assets",
);

const assets = [
  mockAsset({
    broadBucketId: "data-and-screens",
    contentTags: ["analytics", "dashboard", "marketing"],
    id: "worker-data-strong",
    objectTags: ["screen", "chart"],
  }),
  mockAsset({
    broadBucketId: "clean-texture-backgrounds",
    contentTags: ["clean", "minimal"],
    id: "worker-clean-fallback",
  }),
  mockAsset({
    broadBucketId: "data-and-screens",
    hasHuman: true,
    id: "worker-unsafe-human",
    imageSubjectClass: "faceless-human",
    personCount: 1,
    subjectReviewStatus: "rejected",
  }),
];
const slides = [
  mockSlide({
    body: "Compare campaign metrics in one place.",
    headline: "Your analytics dashboard should explain growth",
    slideNumber: 1,
    slideType: "solution",
  }),
  mockSlide({
    headline: "Your content calendar should not feel chaotic",
    slideNumber: 2,
    slideType: "problem",
  }),
];
const selections = selectBroadRuntimeVisualAssets({
  assets,
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-worker-check",
  slides,
});

assertEqual(selections.length, 2, "worker selection count");
assertEqual(selections[0]?.asset.id, "worker-data-strong", "worker exact asset");
assertEqual(selections[0]?.fallbackReason, "exact_match", "worker exact reason");
assertEqual(
  selections[1]?.asset.id,
  "worker-clean-fallback",
  "worker logical profile fallback",
);
assertEqual(
  selections[1]?.fallbackReason,
  "profile_fallback",
  "worker profile fallback reason",
);

const socialPlatformSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "data-and-screens",
      contentTags: ["social-media", "content", "youtube", "video-marketing"],
      id: "worker-local-youtube-screen",
      objectTags: ["digital-screen", "youtube-screen", "laptop"],
    }),
    mockAsset({
      broadBucketId: "phone-and-devices",
      contentTags: ["social-media", "content", "tiktok", "mobile-marketing"],
      id: "worker-local-tiktok-screen",
      objectTags: ["social-media-screen", "tiktok-app", "smartphone"],
    }),
    mockAsset({
      broadBucketId: "abstract-backgrounds",
      contentTags: ["growth"],
      id: "worker-generic-growth-background",
    }),
    mockAsset({
      broadBucketId: "phone-and-devices",
      contentTags: ["phone"],
      id: "worker-generic-phone",
      objectTags: ["smartphone"],
    }),
  ],
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-worker-social-platform-regression",
  slides: [
    mockSlide({
      body: "Review video marketing performance on the YouTube screen.",
      headline: "Your YouTube content should drive measurable growth",
      slideNumber: 1,
      slideType: "hook",
    }),
    mockSlide({
      body: "Keep short-form social media content visible on your phone.",
      headline: "TikTok ideas need a repeatable mobile marketing system",
      slideNumber: 2,
      slideType: "solution",
    }),
  ],
});
assertEqual(
  socialPlatformSelections[0]?.asset.id,
  "worker-local-youtube-screen",
  "worker hyphenated YouTube tags route to the reviewed data-and-screens asset",
);
assertEqual(
  socialPlatformSelections[1]?.asset.id,
  "worker-local-tiktok-screen",
  "worker hyphenated TikTok tags route to the reviewed phone-and-devices asset",
);
if (!socialPlatformSelections[1]?.matchedTags.includes("social-media")) {
  failures.push({
    error:
      "Worker normalized matching did not retain the social-media diagnostic tag.",
  });
}

assertEqual(
  resolveCarouselBroadMatcherMode({
    businessProfileAllowlist: "profile-canary, profile-other",
    businessProfileId: "profile-canary",
    configuredMode: "dry-run",
    userAllowlist: "user-other",
    userId: "user-ordinary",
  }).effectiveMode,
  "enabled",
  "worker business-profile allowlist enables only the dry-run canary",
);
assertEqual(
  resolveCarouselBroadMatcherMode({
    businessProfileAllowlist: "profile-other",
    businessProfileId: "profile-ordinary",
    configuredMode: "dry-run",
    userAllowlist: "user-canary",
    userId: "user-canary",
  }).effectiveMode,
  "enabled",
  "worker user allowlist enables only the dry-run canary",
);
assertEqual(
  resolveCarouselBroadMatcherMode({
    businessProfileAllowlist: "profile-canary",
    businessProfileId: "profile-ordinary",
    configuredMode: "dry-run",
    userAllowlist: "user-canary",
    userId: "user-ordinary",
  }).effectiveMode,
  "dry-run",
  "worker non-canary traffic remains in dry-run",
);
assertEqual(
  resolveCarouselBroadMatcherMode({
    businessProfileAllowlist: "profile-canary",
    businessProfileId: "profile-canary",
    configuredMode: "off",
    userAllowlist: "user-canary",
    userId: "user-canary",
  }).effectiveMode,
  "off",
  "worker off mode cannot be overridden by a canary allowlist",
);

const productivitySharedSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "workspace-objects",
      categorySlug: "marketing-saas",
      contentTags: ["workspace", "workflow", "automation"],
      id: "worker-marketing-workspace-shared",
      objectTags: ["laptop", "desk"],
    }),
    mockAsset({
      broadBucketId: "workspace-objects",
      categorySlug: "fitness-health",
      contentTags: ["workspace", "workflow"],
      id: "worker-fitness-workspace-blocked",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "productivity-saas",
  profile: productivityProfile,
  seed: "broad-matcher-worker-productivity-shared-source-check",
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
  "worker-marketing-workspace-shared",
  "worker Productivity SaaS can reuse compatible Marketing SaaS broad assets",
);
assertEqual(
  productivitySharedSelections.length,
  1,
  "worker unrelated source category remains blocked for Productivity SaaS",
);

const productivityUnsupportedBucketSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "clean-texture-backgrounds",
      categorySlug: "marketing-saas",
      contentTags: ["clean", "minimal"],
      id: "worker-marketing-clean-unsupported",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "productivity-saas",
  profile: productivityProfile,
  seed: "broad-matcher-worker-productivity-unsupported-bucket-check",
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
  "worker Productivity SaaS does not reuse Marketing SaaS buckets outside its allowed broad pools",
);

for (const sharedProfile of sharedHomeProfiles) {
  const sharedHomeSelections = selectBroadRuntimeVisualAssets({
    assets: [
      mockAsset({
        broadBucketId: "home-lifestyle",
        categorySlug: "shared",
        contentTags: ["home", "evening", "routine"],
        id: `worker-shared-home-${sharedProfile.id}`,
        objectTags: ["couch", "lamp"],
      }),
    ],
    candidateIndex: 0,
    categorySlug: sharedProfile.id,
    profile: sharedProfile,
    seed: `broad-matcher-worker-${sharedProfile.id}-shared-home-check`,
    slides: [
      mockSlide({
        headline: "Make the evening routine easier at home",
        slideNumber: 1,
        slideType: "problem",
      }),
    ],
  });

  assertEqual(
    sharedHomeSelections[0]?.asset.category_slug,
    "shared",
    `worker ${sharedProfile.id} can use the shared home-lifestyle source pool`,
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
      id: "worker-fitness-food-shared-with-wellness",
      objectTags: ["meal", "table"],
    }),
    mockAsset({
      broadBucketId: "clean-texture-backgrounds",
      categorySlug: "marketing-saas",
      contentTags: ["clean", "calm", "minimal"],
      id: "worker-marketing-clean-shared-with-wellness",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "wellness",
  profile: wellnessProfile,
  seed: "broad-matcher-worker-wellness-cross-category-reuse-check",
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
    new Set(wellnessReuseSelections.map((selection) => selection.asset.category_slug)),
  )
    .sort()
    .join(","),
  "fitness-health,marketing-saas",
  "worker Wellness can reuse Fitness Health and Marketing SaaS assets",
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
  seed: "broad-matcher-worker-reuse-check",
  slides: duplicateSlides,
});

assertEqual(duplicateSelections.length, 2, "worker safe reuse count");
assertEqual(
  duplicateSelections[1]?.fallbackReason,
  "duplicate_safe_reuse",
  "worker safe reuse reason",
);

const nearDuplicateSelections = selectBroadRuntimeVisualAssets({
  assets: [
    mockAsset({
      broadBucketId: "data-and-screens",
      contentTags: ["analytics", "dashboard"],
      id: "worker-near-a",
      nearDuplicateGroup: "known-data-pair",
    }),
    mockAsset({
      broadBucketId: "data-and-screens",
      contentTags: ["analytics", "dashboard"],
      id: "worker-near-b",
      nearDuplicateGroup: "known-data-pair",
    }),
    mockAsset({
      broadBucketId: "clean-texture-backgrounds",
      id: "worker-near-alternative",
    }),
  ],
  candidateIndex: 0,
  categorySlug: "marketing-saas",
  profile,
  seed: "broad-matcher-worker-near-duplicate-check",
  slides: duplicateSlides,
});
assertEqual(
  nearDuplicateSelections[1]?.asset.id,
  "worker-near-alternative",
  "worker near duplicate alternative",
);
assertEqual(
  nearDuplicateSelections[1]?.nearDuplicateAvoided,
  true,
  "worker near duplicate avoided diagnostic",
);

const spreadAssets = Array.from({ length: 12 }, (_, index) =>
  mockAsset({
    broadBucketId: "data-and-screens",
    contentTags: ["analytics", "dashboard"],
    id: `worker-spread-data-${String(index + 1).padStart(2, "0")}`,
    objectTags: ["screen", "chart"],
  }),
);
const spreadSelections = Array.from({ length: 20 }, (_, candidateIndex) =>
  selectBroadRuntimeVisualAssets({
    assets: spreadAssets,
    candidateIndex,
    categorySlug: "marketing-saas",
    profile,
    seed: "broad-matcher-worker-candidate-spread-check",
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
    label: "worker candidate spread unique asset count",
    actual: uniqueSpreadAssetCount,
    expected: ">= 6",
    spreadCounts,
  });
}

if (topSpreadReuseCount > 6) {
  failures.push({
    label: "worker candidate spread top reuse count",
    actual: topSpreadReuseCount,
    expected: "<= 6",
    spreadCounts,
  });
}

console.log(
  JSON.stringify(
    {
      fallbackBuckets: getBroadBucketFallbacksForProfile(profile.id),
      matcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
      selections: selections.map((selection) => ({
        assetId: selection.asset.id,
        broadBucketId: selection.broadBucketId,
        fallbackReason: selection.fallbackReason,
        score: selection.score,
        slideNumber: selection.slideNumber,
        targetBroadBucketId: selection.targetBroadBucketId,
      })),
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
}) {
  return {
    base_s3_key: `category-library/${categorySlug}/${broadBucketId}/${id}.webp`,
    base_url: `https://cdn.example.test/${id}.webp`,
    best_for_slide_types: [],
    broad_visual_bucket: broadBucketId,
    bucket_taxonomy_version: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
    bucket_type: "universal",
    category_slug: categorySlug,
    content_tags: contentTags,
    face_count: 0,
    has_human: hasHuman,
    id,
    image_subject_class: imageSubjectClass,
    mood_tags: [],
    near_duplicate_group: nearDuplicateGroup,
    object_tags: objectTags,
    person_count: personCount,
    pexels_photo_id: id,
    runtime_exclusion_reason: null,
    status: "ready",
    subject_review_status: subjectReviewStatus,
    usage_count: 0,
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
