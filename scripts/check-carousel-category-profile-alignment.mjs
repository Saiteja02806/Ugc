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

const { resolveCarouselCategoryProfile } = await jiti.import(
  "../lib/carousel/category-profile-resolver.ts",
);
const { buildCarouselProfileBucketReadiness } = await jiti.import(
  "../lib/carousel/profile-bucket-readiness.ts",
);
const { getCarouselBusinessVisualProfile } = await jiti.import(
  "../lib/carousel/business-visual-profile.ts",
);

const cases = [
  {
    name: "marketing-saas",
    input: {
      category: "Marketing SaaS",
      productSummary:
        "AI campaign automation for marketing teams managing ads and content calendars.",
      valueProps: ["Automate campaign follow-up", "Clean up manual reports"],
      visualKeywords: ["campaign", "crm", "calendar"],
    },
    expectedCategorySlug: "marketing-saas",
    expectedLegacyCategorySlug: "marketing-saas",
    expectedProfileId: "marketing-saas",
  },
  {
    name: "fitness-health",
    input: {
      category: "Calorie tracking app",
      productSummary: "Nutrition tracking for meals, calories, workouts, and protein.",
      valueProps: ["Track food without guessing portions"],
      visualKeywords: ["meal", "fitness", "nutrition"],
    },
    expectedCategorySlug: "fitness-health",
    expectedLegacyCategorySlug: "fitness-nutrition",
    expectedProfileId: "fitness-health",
  },
  {
    name: "generic-business",
    input: {
      category: "Local service booking",
      productSummary: "Appointment requests for neighborhood service providers.",
      valueProps: ["Make appointment requests easier to manage"],
      visualKeywords: ["booking", "service"],
    },
    expectedCategorySlug: "local-service-booking",
    expectedLegacyCategorySlug: "local-service-booking",
    expectedProfileId: "generic-business",
  },
];
const failures = [];
const resolutions = cases.map((item) => {
  const resolution = resolveCarouselCategoryProfile(item.input);

  if (resolution.categorySlug !== item.expectedCategorySlug) {
    failures.push({
      actual: resolution.categorySlug,
      expected: item.expectedCategorySlug,
      field: "categorySlug",
      name: item.name,
    });
  }

  if (resolution.legacyCategorySlug !== item.expectedLegacyCategorySlug) {
    failures.push({
      actual: resolution.legacyCategorySlug,
      expected: item.expectedLegacyCategorySlug,
      field: "legacyCategorySlug",
      name: item.name,
    });
  }

  if (resolution.businessVisualProfile.id !== item.expectedProfileId) {
    failures.push({
      actual: resolution.businessVisualProfile.id,
      expected: item.expectedProfileId,
      field: "businessVisualProfile.id",
      name: item.name,
    });
  }

  if (!resolution.candidateCategorySlugs.includes(resolution.categorySlug)) {
    failures.push({
      candidateCategorySlugs: resolution.candidateCategorySlugs,
      field: "candidateCategorySlugs",
      missing: resolution.categorySlug,
      name: item.name,
    });
  }

  return {
    businessVisualProfileId: resolution.businessVisualProfile.id,
    candidateCategorySlugs: resolution.candidateCategorySlugs,
    categorySlug: resolution.categorySlug,
    legacyCategorySlug: resolution.legacyCategorySlug,
    name: item.name,
  };
});

const marketingProfile = getCarouselBusinessVisualProfile("marketing-saas");

if (!marketingProfile) {
  throw new Error("Marketing SaaS profile is missing.");
}

const readiness = buildCarouselProfileBucketReadiness({
  bucketCounts: [
    { readyCount: 40, visualBucketId: "calendar-overload" },
    { readyCount: 3, visualBucketId: "spreadsheet-chaos" },
    { readyCount: 40, visualBucketId: "laptop-desk" },
  ],
  categorySlug: "marketing-saas",
  profile: marketingProfile,
});

if (readiness.readyBucketCount !== 2 || readiness.missingBucketCount === 0) {
  failures.push({
    field: "profileBucketReadiness",
    message: "Readiness report should show partial bucket coverage.",
    readiness,
  });
}

console.log(
  JSON.stringify(
    {
      readiness: {
        categorySlug: readiness.categorySlug,
        missingBucketCount: readiness.missingBucketCount,
        profileId: readiness.profileId,
        readyBucketCount: readiness.readyBucketCount,
        seedPriorityReadyBucketCount: readiness.seedPriorityReadyBucketCount,
        seedPriorityTotalBucketCount: readiness.seedPriorityTotalBucketCount,
        totalBucketCount: readiness.totalBucketCount,
      },
      resolutions,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
