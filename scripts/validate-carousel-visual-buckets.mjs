import {
  assertValidVisualBucketTaxonomy,
  CAROUSEL_VERTICALS,
  VISUAL_BUCKETS,
} from "../lib/carousel/visual-bucket-taxonomy.ts";

const EXPECTED_BUCKET_COUNT = 20;
const EXPECTED_TARGET_COUNT = 15;

assertValidVisualBucketTaxonomy();

if (VISUAL_BUCKETS.length !== EXPECTED_BUCKET_COUNT) {
  throw new Error(
    `Expected ${EXPECTED_BUCKET_COUNT} visual buckets, found ${VISUAL_BUCKETS.length}.`,
  );
}

const universalBuckets = VISUAL_BUCKETS.filter(
  (bucket) => bucket.bucketType === "universal",
);
const verticalBuckets = VISUAL_BUCKETS.filter(
  (bucket) => bucket.bucketType === "vertical",
);

if (universalBuckets.length !== 10 || verticalBuckets.length !== 10) {
  throw new Error(
    `Expected a 10/10 universal-to-vertical split, found ${universalBuckets.length}/${verticalBuckets.length}.`,
  );
}

for (const vertical of CAROUSEL_VERTICALS) {
  const matchingBuckets = VISUAL_BUCKETS.filter((bucket) =>
    bucket.usableVerticals.includes(vertical),
  );

  if (matchingBuckets.length === 0) {
    throw new Error(`No visual buckets are available for "${vertical}".`);
  }
}

const invalidTargetCounts = VISUAL_BUCKETS.filter(
  (bucket) => bucket.targetCount !== EXPECTED_TARGET_COUNT,
);

if (invalidTargetCounts.length > 0) {
  throw new Error(
    `Phase 1 buckets must target ${EXPECTED_TARGET_COUNT} assets: ${invalidTargetCounts
      .map((bucket) => bucket.id)
      .join(", ")}`,
  );
}

console.log(
  `Carousel visual taxonomy valid: ${VISUAL_BUCKETS.length} buckets (${universalBuckets.length} universal, ${verticalBuckets.length} vertical).`,
);
