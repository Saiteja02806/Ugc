import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": workspaceRoot,
  },
});
const {
  getVisualBucketsForVertical,
  VISUAL_BUCKETS,
} = await jiti.import("../lib/carousel/visual-bucket-taxonomy.ts");
const {
  getCarouselBusinessProfileBucketTargetCount,
  getCarouselBusinessVisualProfile,
} = await jiti.import("../lib/carousel/business-visual-profile.ts");

const CALORIE_TRACKER_VERTICAL = "fitness-health";
const REQUIRED_SLIDE_INTENTS = [
  "hook",
  "problem",
  "mistake",
  "solution",
  "benefit",
  "cta",
];
const FOOD_SPECIFIC_BUCKETS = new Set([
  "food-scale",
  "grocery-aisle",
  "healthy-snacks",
  "meal-moments",
  "meal-prep",
]);

const verticalBuckets = getVisualBucketsForVertical(CALORIE_TRACKER_VERTICAL);
const fitnessHealthProfile = getCarouselBusinessVisualProfile("fitness-health");

if (!fitnessHealthProfile) {
  throw new Error("Fitness-health profile is missing.");
}

const bucketIds = new Set(verticalBuckets.map((bucket) => bucket.id));
const missingIntentCoverage = [];

for (const intent of REQUIRED_SLIDE_INTENTS) {
  const matches = verticalBuckets.filter((bucket) =>
    bucket.bestForSlideTypes.includes(intent),
  );

  if (matches.length < 2) {
    missingIntentCoverage.push({ intent, matchingBucketCount: matches.length });
  }
}

const broadLifestyleBuckets = verticalBuckets.filter(
  (bucket) => !FOOD_SPECIFIC_BUCKETS.has(bucket.id),
);
const invalidSeedQueryBuckets = verticalBuckets.filter(
  (bucket) => bucket.seedQueries.length < 3,
);
const requiredBucketIds = [
  "meal-moments",
  "phone-in-hand",
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
];
const missingRequiredBuckets = requiredBucketIds.filter(
  (bucketId) => !bucketIds.has(bucketId),
);

if (missingIntentCoverage.length > 0) {
  throw new Error(
    `Calorie tracker bucket plan has weak slide intent coverage: ${JSON.stringify(
      missingIntentCoverage,
    )}`,
  );
}

if (invalidSeedQueryBuckets.length > 0) {
  throw new Error(
    `Calorie tracker buckets need at least three Pexels queries: ${invalidSeedQueryBuckets
      .map((bucket) => bucket.id)
      .join(", ")}`,
  );
}

if (missingRequiredBuckets.length > 0) {
  throw new Error(
    `Calorie tracker required bucket coverage is missing: ${missingRequiredBuckets.join(
      ", ",
    )}`,
  );
}

if (broadLifestyleBuckets.length < 6) {
  throw new Error(
    `Calorie tracker needs at least 6 broader lifestyle buckets, found ${broadLifestyleBuckets.length}.`,
  );
}

const seedingPlan = requiredBucketIds.map((bucketId) => {
  const bucket = VISUAL_BUCKETS.find((item) => item.id === bucketId);

  if (!bucket) {
    throw new Error(`Missing bucket "${bucketId}".`);
  }

  return {
    bucketId: bucket.id,
    bucketType: bucket.bucketType,
    bestForSlideTypes: [...bucket.bestForSlideTypes],
    defaultTargetCount: bucket.targetCount,
    seedQueries: [...bucket.seedQueries],
    targetCount: getCarouselBusinessProfileBucketTargetCount(
      fitnessHealthProfile,
      bucket.id,
    ),
  };
});

console.log(
  JSON.stringify(
    {
      categorySlug: "calorie-tracker",
      vertical: CALORIE_TRACKER_VERTICAL,
      totalVerticalBuckets: verticalBuckets.length,
      broadLifestyleBucketCount: broadLifestyleBuckets.length,
      foodSpecificBucketCount:
        verticalBuckets.length - broadLifestyleBuckets.length,
      requiredSlideIntents: REQUIRED_SLIDE_INTENTS,
      plan: seedingPlan,
    },
    null,
    2,
  ),
);
