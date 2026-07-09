import {
  getCarouselBusinessVisualProfile,
  type CarouselBusinessVisualProfile,
  type CarouselBusinessVisualProfileId,
} from "@/lib/carousel/business-visual-profile";
import { normalizeCategorySlug } from "@/lib/carousel/category-resolver";
import {
  getCarouselProfileBucketReadiness,
  type CarouselProfileBucketReadiness,
} from "@/lib/carousel/profile-bucket-readiness";
import {
  seedCategoryImageLibrary,
  type CarouselImageSubjectAnalysisMode,
  type SeedCategoryImageLibraryResult,
} from "@/lib/carousel/seed-category-image-library";
import {
  getVisualBucket,
  type VisualBucket,
  type VisualBucketId,
} from "@/lib/carousel/visual-bucket-taxonomy";

export const CAROUSEL_PROFILE_BUCKET_SEED_SCOPES = [
  "priority",
  "required",
] as const;
export const DEFAULT_CAROUSEL_PROFILE_BUCKET_SEED_MAX_BUCKETS = 4;

export type CarouselProfileBucketSeedScope =
  (typeof CAROUSEL_PROFILE_BUCKET_SEED_SCOPES)[number];

export type CarouselProfileBucketSeedPlanBucket = {
  bucketId: string;
  bucketType: "universal" | "vertical";
  isSeedPriority: boolean;
  label: string;
  missingCount: number;
  readyCount: number;
  seedQueries: string[];
  seedTargetCount: number;
  targetCount: number;
};

export type CarouselProfileBucketSeedPlan = {
  buckets: CarouselProfileBucketSeedPlanBucket[];
  categorySlug: string;
  deferredBucketCount: number;
  isProfileReady: boolean;
  isScopeReady: boolean;
  maxBuckets: number | null;
  profileId: CarouselBusinessVisualProfileId;
  profileLabel: string;
  scope: CarouselProfileBucketSeedScope;
  selectedBucketCount: number;
  targetCountOverride: number | null;
  totalMissingBucketCount: number;
  totalScopedMissingBucketCount: number;
};

export type CarouselProfileBucketSeedRunnerInput = {
  batchSize?: number;
  bucketIds?: string[];
  candidateFetchLimit?: number;
  categorySlug?: string;
  dryRun?: boolean;
  maxBuckets?: number;
  /** @deprecated Use candidateFetchLimit. */
  maxSeededPerBucket?: number;
  maxSourceAttempts?: number;
  profileId: CarouselBusinessVisualProfileId;
  queryOverrides?: Record<string, string[]>;
  scope?: CarouselProfileBucketSeedScope;
  subjectAnalysisMode?: CarouselImageSubjectAnalysisMode;
  targetCount?: number;
};

export type CarouselProfileBucketSeedError = {
  bucketId: string;
  message: string;
};

export type CarouselProfileBucketSeedRunnerResult = {
  dryRun: boolean;
  errors: CarouselProfileBucketSeedError[];
  failedBucketCount: number;
  ok: boolean;
  plan: CarouselProfileBucketSeedPlan;
  readinessAfter: CarouselProfileBucketReadiness | null;
  results: SeedCategoryImageLibraryResult[];
  seededCount: number;
};

const MAX_SEED_TARGET_COUNT = 250;

function unique<T>(values: T[]) {
  return values.filter((value, index, items) => items.indexOf(value) === index);
}

function normalizeOptionalCount(value: number | undefined, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function normalizeSeedScope(
  value: CarouselProfileBucketSeedScope | undefined,
): CarouselProfileBucketSeedScope {
  return value ?? "priority";
}

function normalizeStringList(values: readonly string[] | undefined) {
  return unique(
    (values ?? [])
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function normalizeQueryOverrides(
  queryOverrides: Record<string, string[]> | undefined,
) {
  if (!queryOverrides) {
    return {};
  }

  const entries: Array<[string, string[]]> = [];

  for (const [bucketId, queries] of Object.entries(queryOverrides)) {
    const normalizedBucketId = bucketId.trim();
    const normalizedQueries = normalizeStringList(queries);

    if (normalizedBucketId && normalizedQueries.length > 0) {
      entries.push([normalizedBucketId, normalizedQueries]);
    }
  }

  return Object.fromEntries(entries);
}

function getProfileOrThrow(profileId: CarouselBusinessVisualProfileId) {
  const profile = getCarouselBusinessVisualProfile(profileId);

  if (!profile) {
    throw new Error(`Unknown carousel business visual profile "${profileId}".`);
  }

  return profile;
}

function getScopedBucketIds(
  profile: CarouselBusinessVisualProfile,
  scope: CarouselProfileBucketSeedScope,
) {
  if (scope === "priority") {
    return [...profile.seedPriorityBucketIds];
  }

  return unique([
    ...profile.seedPriorityBucketIds,
    ...profile.requiredBucketIds,
  ]);
}

function getSeedTargetCount(params: {
  profileBucketTargetCount: number;
  targetCount?: number;
}) {
  return (
    normalizeOptionalCount(params.targetCount, MAX_SEED_TARGET_COUNT) ??
    params.profileBucketTargetCount
  );
}

function getBucketVisualKeywords(params: {
  bucket: VisualBucket;
  profile: CarouselBusinessVisualProfile;
}) {
  return unique([
    params.profile.id,
    params.profile.primaryVertical,
    params.bucket.id,
    ...params.bucket.defaultMoodTags,
  ]);
}

export function buildCarouselProfileBucketSeedPlan(params: {
  categorySlug: string;
  maxBuckets?: number;
  profile: CarouselBusinessVisualProfile;
  readiness: CarouselProfileBucketReadiness;
  scope?: CarouselProfileBucketSeedScope;
  targetCount?: number;
}) {
  const scope = normalizeSeedScope(params.scope);
  const maxBuckets = normalizeOptionalCount(
    params.maxBuckets,
    params.profile.requiredBucketIds.length,
  );
  const readinessByBucketId = new Map(
    params.readiness.buckets.map((bucket) => [bucket.bucketId, bucket]),
  );
  const scopedBucketIds = getScopedBucketIds(params.profile, scope);
  const scopedMissingBuckets: CarouselProfileBucketSeedPlanBucket[] = [];

  for (const bucketId of scopedBucketIds) {
    const bucket = getVisualBucket(bucketId);
    const readinessBucket = readinessByBucketId.get(bucketId);

    if (!bucket || !readinessBucket) {
      continue;
    }

    const seedTargetCount = getSeedTargetCount({
      profileBucketTargetCount: readinessBucket.targetCount,
      targetCount: params.targetCount,
    });

    if (readinessBucket.readyCount >= seedTargetCount) {
      continue;
    }

    scopedMissingBuckets.push({
      bucketId: bucket.id,
      bucketType: bucket.bucketType,
      isSeedPriority: params.profile.seedPriorityBucketIds.includes(
        bucket.id as VisualBucketId,
      ),
      label: bucket.label,
      missingCount: seedTargetCount - readinessBucket.readyCount,
      readyCount: readinessBucket.readyCount,
      seedQueries: [...bucket.seedQueries],
      seedTargetCount,
      targetCount: readinessBucket.targetCount,
    });
  }

  const selectedBuckets = maxBuckets
    ? scopedMissingBuckets.slice(0, maxBuckets)
    : scopedMissingBuckets;
  const totalMissingBucketCount = params.readiness.buckets.filter(
    (bucket) => !bucket.isReady,
  ).length;

  return {
    buckets: selectedBuckets,
    categorySlug: normalizeCategorySlug(params.categorySlug, params.profile.categorySlug),
    deferredBucketCount: scopedMissingBuckets.length - selectedBuckets.length,
    isProfileReady: params.readiness.isReady,
    isScopeReady: scopedMissingBuckets.length === 0,
    maxBuckets,
    profileId: params.profile.id,
    profileLabel: params.profile.label,
    scope,
    selectedBucketCount: selectedBuckets.length,
    targetCountOverride: normalizeOptionalCount(
      params.targetCount,
      MAX_SEED_TARGET_COUNT,
    ),
    totalMissingBucketCount,
    totalScopedMissingBucketCount: scopedMissingBuckets.length,
  } satisfies CarouselProfileBucketSeedPlan;
}

export async function getCarouselProfileBucketSeedPlan(params: {
  categorySlug?: string;
  maxBuckets?: number;
  profileId: CarouselBusinessVisualProfileId;
  scope?: CarouselProfileBucketSeedScope;
  targetCount?: number;
}) {
  const profile = getProfileOrThrow(params.profileId);
  const categorySlug = normalizeCategorySlug(
    params.categorySlug ?? profile.categorySlug,
    profile.categorySlug,
  );
  const readiness = await getCarouselProfileBucketReadiness({
    categorySlug,
    profile,
  });

  return buildCarouselProfileBucketSeedPlan({
    categorySlug,
    maxBuckets: params.maxBuckets,
    profile,
    readiness,
    scope: params.scope,
    targetCount: params.targetCount,
  });
}

function applySeedRequestOverrides(params: {
  bucketIds: string[];
  plan: CarouselProfileBucketSeedPlan;
  queryOverrides: Record<string, string[]>;
}) {
  const bucketsById = new Map(
    params.plan.buckets.map((bucket) => [bucket.bucketId, bucket]),
  );
  const selectedBuckets =
    params.bucketIds.length > 0
      ? params.bucketIds
          .map((bucketId) => bucketsById.get(bucketId))
          .filter((bucket): bucket is CarouselProfileBucketSeedPlanBucket =>
            Boolean(bucket),
          )
      : params.plan.buckets;
  const buckets = selectedBuckets.map((bucket) => ({
    ...bucket,
    seedQueries: params.queryOverrides[bucket.bucketId] ?? bucket.seedQueries,
  }));

  return {
    ...params.plan,
    buckets,
    deferredBucketCount: Math.max(
      params.plan.totalScopedMissingBucketCount - buckets.length,
      0,
    ),
    maxBuckets:
      params.bucketIds.length > 0 ? params.bucketIds.length : params.plan.maxBuckets,
    selectedBucketCount: buckets.length,
  } satisfies CarouselProfileBucketSeedPlan;
}

export async function seedCarouselProfileBucketLibrary(
  input: CarouselProfileBucketSeedRunnerInput,
) {
  const profile = getProfileOrThrow(input.profileId);
  const categorySlug = normalizeCategorySlug(
    input.categorySlug ?? profile.categorySlug,
    profile.categorySlug,
  );
  const requestedBucketIds = normalizeStringList(input.bucketIds);
  const invalidBucketIds = requestedBucketIds.filter(
    (bucketId) =>
      !profile.requiredBucketIds.includes(bucketId as VisualBucketId),
  );

  if (invalidBucketIds.length > 0) {
    throw new Error(
      `Requested buckets are not required by ${profile.id}: ${invalidBucketIds.join(
        ", ",
      )}`,
    );
  }

  const queryOverrides = normalizeQueryOverrides(input.queryOverrides);
  const basePlan = await getCarouselProfileBucketSeedPlan({
    categorySlug,
    maxBuckets: requestedBucketIds.length
      ? undefined
      : input.maxBuckets ?? DEFAULT_CAROUSEL_PROFILE_BUCKET_SEED_MAX_BUCKETS,
    profileId: profile.id,
    scope: requestedBucketIds.length ? "required" : input.scope,
    targetCount: input.targetCount,
  });
  const plan = applySeedRequestOverrides({
    bucketIds: requestedBucketIds,
    plan: basePlan,
    queryOverrides,
  });

  if (input.dryRun) {
    return {
      dryRun: true,
      errors: [],
      failedBucketCount: 0,
      ok: true,
      plan,
      readinessAfter: null,
      results: [],
      seededCount: 0,
    } satisfies CarouselProfileBucketSeedRunnerResult;
  }

  const results: SeedCategoryImageLibraryResult[] = [];
  const errors: CarouselProfileBucketSeedError[] = [];

  for (const planBucket of plan.buckets) {
    const bucket = getVisualBucket(planBucket.bucketId);

    if (!bucket) {
      errors.push({
        bucketId: planBucket.bucketId,
        message: `Unknown visual bucket "${planBucket.bucketId}".`,
      });
      continue;
    }

    try {
      const result = await seedCategoryImageLibrary({
        batchSize: input.batchSize,
        candidateFetchLimit:
          input.candidateFetchLimit ?? input.maxSeededPerBucket,
        categorySlug: plan.categorySlug,
        maxSourceAttempts: input.maxSourceAttempts,
        minimumApprovedTarget: planBucket.seedTargetCount,
        queries: planBucket.seedQueries,
        subjectAnalysisMode: input.subjectAnalysisMode,
        visualBucketId: bucket.id,
        visualKeywords: getBucketVisualKeywords({ bucket, profile }),
      });

      results.push(result);
    } catch (error) {
      errors.push({
        bucketId: bucket.id,
        message: error instanceof Error ? error.message : "Unknown seed error.",
      });
    }
  }

  const readinessAfter = await getCarouselProfileBucketReadiness({
    categorySlug: plan.categorySlug,
    profile,
  });
  const seededCount = results.reduce(
    (count, result) => count + result.seededCount,
    0,
  );

  return {
    dryRun: false,
    errors,
    failedBucketCount: errors.length,
    ok: errors.length === 0,
    plan,
    readinessAfter,
    results,
    seededCount,
  } satisfies CarouselProfileBucketSeedRunnerResult;
}
