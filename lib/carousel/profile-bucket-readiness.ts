import {
  getCarouselBusinessProfileBucketTargetCount,
  type CarouselBusinessVisualProfile,
} from "@/lib/carousel/business-visual-profile";
import { countReadyCategoryImageAssetsByVisualBucket } from "@/lib/carousel/db";
import {
  getVisualBucket,
  type VisualBucketId,
} from "@/lib/carousel/visual-bucket-taxonomy";

export type CarouselProfileBucketReadinessBucket = {
  bucketId: string;
  bucketType: "universal" | "vertical";
  isReady: boolean;
  isSeedPriority: boolean;
  label: string;
  readyCount: number;
  targetCount: number;
};

export type CarouselProfileBucketReadiness = {
  buckets: CarouselProfileBucketReadinessBucket[];
  categorySlug: string;
  isReady: boolean;
  missingBucketCount: number;
  profileId: string;
  profileLabel: string;
  readyBucketCount: number;
  seedPriorityReadyBucketCount: number;
  seedPriorityTotalBucketCount: number;
  totalBucketCount: number;
};

type BucketCount = {
  readyCount: number;
  visualBucketId: string;
};

export function buildCarouselProfileBucketReadiness(params: {
  bucketCounts: BucketCount[];
  categorySlug: string;
  profile: CarouselBusinessVisualProfile;
}) {
  const countByBucketId = new Map(
    params.bucketCounts.map((count) => [count.visualBucketId, count.readyCount]),
  );
  const buckets = params.profile.requiredBucketIds
    .map((bucketId) => {
      const bucket = getVisualBucket(bucketId);

      if (!bucket) {
        return null;
      }

      const readyCount = countByBucketId.get(bucket.id) ?? 0;
      const isSeedPriority = params.profile.seedPriorityBucketIds.includes(
        bucket.id as VisualBucketId,
      );
      const targetCount = getCarouselBusinessProfileBucketTargetCount(
        params.profile,
        bucket.id as VisualBucketId,
      );

      return {
        bucketId: bucket.id,
        bucketType: bucket.bucketType,
        isReady: readyCount >= targetCount,
        isSeedPriority,
        label: bucket.label,
        readyCount,
        targetCount,
      } satisfies CarouselProfileBucketReadinessBucket;
    })
    .filter((bucket): bucket is CarouselProfileBucketReadinessBucket =>
      Boolean(bucket),
    );
  const readyBucketCount = buckets.filter((bucket) => bucket.isReady).length;
  const seedPriorityBuckets = buckets.filter((bucket) => bucket.isSeedPriority);
  const seedPriorityReadyBucketCount = seedPriorityBuckets.filter(
    (bucket) => bucket.isReady,
  ).length;

  return {
    buckets,
    categorySlug: params.categorySlug,
    isReady: readyBucketCount === buckets.length,
    missingBucketCount: buckets.length - readyBucketCount,
    profileId: params.profile.id,
    profileLabel: params.profile.label,
    readyBucketCount,
    seedPriorityReadyBucketCount,
    seedPriorityTotalBucketCount: seedPriorityBuckets.length,
    totalBucketCount: buckets.length,
  } satisfies CarouselProfileBucketReadiness;
}

export async function getCarouselProfileBucketReadiness(params: {
  categorySlug: string;
  profile: CarouselBusinessVisualProfile;
}) {
  const bucketCounts = await countReadyCategoryImageAssetsByVisualBucket({
    categorySlug: params.categorySlug,
    profileId: params.profile.id,
    visualBucketIds: [...params.profile.requiredBucketIds],
  });

  return buildCarouselProfileBucketReadiness({
    bucketCounts,
    categorySlug: params.categorySlug,
    profile: params.profile,
  });
}

export function summarizeMissingProfileBuckets(
  readiness: CarouselProfileBucketReadiness,
  limit = 5,
) {
  return readiness.buckets
    .filter((bucket) => !bucket.isReady)
    .sort((left, right) => {
      if (left.isSeedPriority !== right.isSeedPriority) {
        return left.isSeedPriority ? -1 : 1;
      }

      return left.readyCount - right.readyCount;
    })
    .slice(0, limit)
    .map((bucket) => `${bucket.bucketId}: ${bucket.readyCount}/${bucket.targetCount}`)
    .join(", ");
}
