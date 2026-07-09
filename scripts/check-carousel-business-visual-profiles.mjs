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
  CAROUSEL_BUSINESS_VISUAL_PROFILES,
  getCarouselBusinessProfileBucketTargetCount,
  validateCarouselBusinessVisualProfile,
} = await jiti.import("../lib/carousel/business-visual-profile.ts");
const { getVisualBucket } = await jiti.import(
  "../lib/carousel/visual-bucket-taxonomy.ts",
);

const args = parseArgs(process.argv.slice(2));
const selectedProfileId = args.profile || null;
const profiles = selectedProfileId
  ? CAROUSEL_BUSINESS_VISUAL_PROFILES.filter(
      (profile) => profile.id === selectedProfileId,
    )
  : CAROUSEL_BUSINESS_VISUAL_PROFILES;

if (selectedProfileId && profiles.length === 0) {
  throw new Error(`Unknown business visual profile "${selectedProfileId}".`);
}

const report = profiles.map((profile) => {
  const errors = validateCarouselBusinessVisualProfile(profile);
  const buckets = profile.requiredBucketIds.map((bucketId) => {
    const bucket = getVisualBucket(bucketId);

    if (!bucket) {
      return {
        bucketId,
        missing: true,
      };
    }

    return {
      bucketId: bucket.id,
      bucketType: bucket.bucketType,
      bestForSlideTypes: [...bucket.bestForSlideTypes],
      seedQueries: [...bucket.seedQueries],
      defaultTargetCount: bucket.targetCount,
      targetCount: getCarouselBusinessProfileBucketTargetCount(
        profile,
        bucket.id,
      ),
    };
  });

  return {
    id: profile.id,
    label: profile.label,
    categorySlug: profile.categorySlug,
    primaryVertical: profile.primaryVertical,
    requiredBucketCount: profile.requiredBucketIds.length,
    seedPriorityBucketIds: [...profile.seedPriorityBucketIds],
    requiredSlideIntents: [...profile.requiredSlideIntents],
    knownGaps: [...(profile.knownGaps ?? [])],
    errors,
    isValid: errors.length === 0,
    buckets,
  };
});

console.log(JSON.stringify({ profiles: report }, null, 2));

const invalidProfiles = report.filter((profile) => !profile.isValid);

if (invalidProfiles.length > 0) {
  process.exitCode = 1;
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}
