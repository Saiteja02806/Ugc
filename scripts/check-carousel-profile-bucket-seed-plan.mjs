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

const { getCarouselBusinessVisualProfile } = await jiti.import(
  "../lib/carousel/business-visual-profile.ts",
);
const { buildCarouselProfileBucketReadiness } = await jiti.import(
  "../lib/carousel/profile-bucket-readiness.ts",
);
const { buildCarouselProfileBucketSeedPlan } = await jiti.import(
  "../lib/carousel/profile-bucket-seeding-runner.ts",
);

const failures = [];
const marketingProfile = getCarouselBusinessVisualProfile("marketing-saas");

if (!marketingProfile) {
  throw new Error("Marketing SaaS profile is missing.");
}

const emptyReadiness = buildCarouselProfileBucketReadiness({
  bucketCounts: [],
  categorySlug: "marketing-saas",
  profile: marketingProfile,
});
const firstPriorityPlan = buildCarouselProfileBucketSeedPlan({
  categorySlug: "marketing-saas",
  maxBuckets: 3,
  profile: marketingProfile,
  readiness: emptyReadiness,
  scope: "priority",
});

assertBucketOrder(
  firstPriorityPlan.buckets.map((bucket) => bucket.bucketId),
  ["laptop-desk", "phone-notification", "desk-chaos"],
  "empty marketing-saas priority seed order",
);

if (firstPriorityPlan.deferredBucketCount !== 5) {
  failures.push({
    actual: firstPriorityPlan.deferredBucketCount,
    expected: 5,
    field: "deferredBucketCount",
    plan: "firstPriorityPlan",
  });
}

const laptopDeskPlanBucket = firstPriorityPlan.buckets.find(
  (bucket) => bucket.bucketId === "laptop-desk",
);

if (laptopDeskPlanBucket?.seedTargetCount !== 40) {
  failures.push({
    actual: laptopDeskPlanBucket?.seedTargetCount,
    expected: 40,
    field: "seedTargetCount",
    plan: "firstPriorityPlan",
  });
}

const partialReadiness = buildCarouselProfileBucketReadiness({
  bucketCounts: [
    { readyCount: 40, visualBucketId: "laptop-desk" },
    { readyCount: 14, visualBucketId: "phone-notification" },
  ],
  categorySlug: "marketing-saas",
  profile: marketingProfile,
});
const partialPriorityPlan = buildCarouselProfileBucketSeedPlan({
  categorySlug: "marketing-saas",
  maxBuckets: 3,
  profile: marketingProfile,
  readiness: partialReadiness,
  scope: "priority",
});

assertBucketOrder(
  partialPriorityPlan.buckets.map((bucket) => bucket.bucketId),
  ["phone-notification", "desk-chaos", "calendar-overload"],
  "partial marketing-saas priority seed order",
);

const phoneNotification = partialPriorityPlan.buckets.find(
  (bucket) => bucket.bucketId === "phone-notification",
);

if (phoneNotification?.missingCount !== 26) {
  failures.push({
    actual: phoneNotification?.missingCount,
    expected: 26,
    field: "missingCount",
    plan: "partialPriorityPlan",
  });
}

const requiredPlan = buildCarouselProfileBucketSeedPlan({
  categorySlug: "marketing-saas",
  profile: marketingProfile,
  readiness: emptyReadiness,
  scope: "required",
});

if (requiredPlan.selectedBucketCount !== marketingProfile.requiredBucketIds.length) {
  failures.push({
    actual: requiredPlan.selectedBucketCount,
    expected: marketingProfile.requiredBucketIds.length,
    field: "selectedBucketCount",
    plan: "requiredPlan",
  });
}

console.log(
  JSON.stringify(
    {
      firstPriorityPlan: summarizePlan(firstPriorityPlan),
      partialPriorityPlan: summarizePlan(partialPriorityPlan),
      requiredPlan: summarizePlan(requiredPlan),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}

function assertBucketOrder(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push({
      actual,
      expected,
      field: "bucketOrder",
      label,
    });
  }
}

function summarizePlan(plan) {
  return {
    categorySlug: plan.categorySlug,
    deferredBucketCount: plan.deferredBucketCount,
    profileId: plan.profileId,
    scope: plan.scope,
    selectedBucketCount: plan.selectedBucketCount,
    totalScopedMissingBucketCount: plan.totalScopedMissingBucketCount,
    buckets: plan.buckets.map((bucket) => ({
      bucketId: bucket.bucketId,
      missingCount: bucket.missingCount,
      readyCount: bucket.readyCount,
      seedTargetCount: bucket.seedTargetCount,
    })),
  };
}
