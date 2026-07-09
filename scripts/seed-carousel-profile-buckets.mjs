import { existsSync, readFileSync } from "node:fs";
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
const { seedCarouselProfileBucketLibrary } = await jiti.import(
  "../lib/carousel/profile-bucket-seeding-runner.ts",
);

loadEnvFile(path.resolve(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const refillPlan = loadRefillPlan(
  getArg("refillPlan", "refill-plan", "plan"),
);
const explicitBucketIds = parseList(getArg("buckets", "bucket") ?? "");
const maxBucketsArg = getPositiveInt(getArg("maxBuckets", "max-buckets"));
const refillPlanBuckets = getRefillPlanBuckets({
  explicitBucketIds,
  limit: explicitBucketIds.length > 0 ? undefined : maxBucketsArg,
  phase: getArg("phase", "bucket-phase"),
  refillPlan,
});
const execute = args.execute === "true";
const dryRun = !execute;

if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to seed images.");
}

const result = await seedCarouselProfileBucketLibrary({
  batchSize:
    getPositiveInt(getArg("batchSize", "batch-size")) ??
    refillPlan?.seedBatch?.batchSize,
  bucketIds: refillPlanBuckets.map((bucket) => bucket.bucketId),
  categorySlug:
    getArg("categorySlug", "category-slug", "category") ??
    refillPlan?.categorySlug,
  dryRun,
  maxBuckets:
    maxBucketsArg ??
    (refillPlanBuckets.length > 0 ? refillPlanBuckets.length : 4),
  maxSourceAttempts:
    getPositiveInt(getArg("maxSourceAttempts", "max-source-attempts")) ??
    refillPlan?.seedBatch?.maxSourceAttempts,
  candidateFetchLimit:
    getPositiveInt(
      getArg("candidateFetchLimit", "candidate-fetch-limit", "candidate-limit"),
    ) ??
    getPositiveInt(
      getArg("maxSeededPerBucket", "max-seeded-per-bucket", "seed-limit"),
    ) ??
    refillPlan?.seedBatch?.candidateFetchLimit ??
    refillPlan?.seedBatch?.maxSeededPerBucket,
  maxSeededPerBucket:
    getPositiveInt(
      getArg("maxSeededPerBucket", "max-seeded-per-bucket", "seed-limit"),
    ) ?? refillPlan?.seedBatch?.maxSeededPerBucket,
  profileId:
    getArg("profileId", "profile-id", "profile") ??
    refillPlan?.profileId ??
    "marketing-saas",
  queryOverrides: getQueryOverrides(refillPlanBuckets),
  scope: args.scope ?? "priority",
  subjectAnalysisMode: getSubjectAnalysisMode(
    getArg("subjectAnalysis", "subject-analysis") ??
      refillPlan?.seedBatch?.subjectAnalysisMode,
  ),
  targetCount: getPositiveInt(getArg("targetCount", "target-count")),
});

console.log(
  JSON.stringify(
    {
      dryRun: result.dryRun,
      errors: result.errors,
      failedBucketCount: result.failedBucketCount,
      ok: result.ok,
      plan: summarizePlan(result.plan),
      refillPlan: refillPlan
        ? {
            phase: getArg("phase", "bucket-phase") ?? null,
            planId: refillPlan.planId,
            selectedBucketIds: refillPlanBuckets.map((bucket) => bucket.bucketId),
          }
        : null,
      readinessAfter: result.readinessAfter
        ? {
            categorySlug: result.readinessAfter.categorySlug,
            missingBucketCount: result.readinessAfter.missingBucketCount,
            readyBucketCount: result.readinessAfter.readyBucketCount,
            seedPriorityReadyBucketCount:
              result.readinessAfter.seedPriorityReadyBucketCount,
            totalBucketCount: result.readinessAfter.totalBucketCount,
          }
        : null,
      results: result.results.map((item) => ({
        approvedObjectOnlyCountAfter: item.approvedObjectOnlyCountAfter,
        approvedObjectOnlyCountBefore: item.approvedObjectOnlyCountBefore,
        awaitingManualReview: item.awaitingManualReview,
        bucketType: item.bucketType,
        candidateFetchLimit: item.candidateFetchLimit,
        categorySlug: item.categorySlug,
        isReady: item.isReady,
        maxSeededCount: item.maxSeededCount,
        minimumApprovedTarget: item.minimumApprovedTarget,
        rawCandidateCountAfter: item.rawCandidateCountAfter,
        rawCandidateCountBefore: item.rawCandidateCountBefore,
        readyCountAfter: item.readyCountAfter,
        readyCountBefore: item.readyCountBefore,
        rejectedCountAfter: item.rejectedCountAfter,
        rejectedCountBefore: item.rejectedCountBefore,
        reviewCandidateCountAfter: item.reviewCandidateCountAfter,
        reviewCandidateCountBefore: item.reviewCandidateCountBefore,
        seededCount: item.seededCount,
        sourceAttemptLimit: item.sourceAttemptLimit,
        surplusApprovedCount: item.surplusApprovedCount,
        skippedClearFaceCount: item.skippedClearFaceCount,
        skippedHumanCount: item.skippedHumanCount,
        skippedDuplicateCount: item.skippedDuplicateCount,
        subjectAnalysisMode: item.subjectAnalysisMode,
        targetCount: item.targetCount,
        unreviewedCountAfter: item.unreviewedCountAfter,
        unreviewedCountBefore: item.unreviewedCountBefore,
        visualBucketId: item.visualBucketId,
      })),
      seededCount: result.seededCount,
    },
    null,
    2,
  ),
);

if (!result.ok) {
  process.exitCode = 1;
}

function summarizePlan(plan) {
  return {
    categorySlug: plan.categorySlug,
    deferredBucketCount: plan.deferredBucketCount,
    isProfileReady: plan.isProfileReady,
    isScopeReady: plan.isScopeReady,
    maxBuckets: plan.maxBuckets,
    profileId: plan.profileId,
    scope: plan.scope,
    selectedBucketCount: plan.selectedBucketCount,
    targetCountOverride: plan.targetCountOverride,
    totalMissingBucketCount: plan.totalMissingBucketCount,
    totalScopedMissingBucketCount: plan.totalScopedMissingBucketCount,
    buckets: plan.buckets.map((bucket) => ({
      bucketId: bucket.bucketId,
      bucketType: bucket.bucketType,
        isSeedPriority: bucket.isSeedPriority,
        missingCount: bucket.missingCount,
        readyCount: bucket.readyCount,
        seedQueries: bucket.seedQueries,
        seedTargetCount: bucket.seedTargetCount,
        targetCount: bucket.targetCount,
      })),
  };
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

function getPositiveInt(value) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected positive integer, received "${value}".`);
  }

  return Math.max(Math.trunc(parsed), 1);
}

function parseList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSubjectAnalysisMode(value) {
  if (value === undefined) {
    return "manual";
  }

  if (value === "manual" || value === "auto") {
    return value;
  }

  throw new Error(
    `Expected --subject-analysis to be "manual" or "auto", received "${value}".`,
  );
}

function getArg(...keys) {
  for (const key of keys) {
    const value = args[key];

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function loadRefillPlan(planPath) {
  if (!planPath) {
    return null;
  }

  const resolvedPath = path.resolve(workspaceRoot, planPath);
  const plan = JSON.parse(readFileSync(resolvedPath, "utf8"));

  if (!Array.isArray(plan.buckets)) {
    throw new Error(`Refill plan ${resolvedPath} must include buckets.`);
  }

  return {
    ...plan,
    resolvedPath,
  };
}

function getRefillPlanBuckets({ explicitBucketIds, limit, phase, refillPlan }) {
  if (!refillPlan) {
    return explicitBucketIds.map((bucketId) => ({ bucketId, seedQueries: [] }));
  }

  const planBuckets = refillPlan.buckets.filter((bucket) => {
    const phaseMatches = phase ? bucket.phase === phase : true;
    const bucketMatches =
      explicitBucketIds.length > 0
        ? explicitBucketIds.includes(bucket.bucketId)
        : true;

    return phaseMatches && bucketMatches;
  });

  if (planBuckets.length === 0) {
    throw new Error(
      `Refill plan ${refillPlan.resolvedPath} did not match any buckets.`,
    );
  }

  return limit ? planBuckets.slice(0, limit) : planBuckets;
}

function getQueryOverrides(refillPlanBuckets) {
  return Object.fromEntries(
    refillPlanBuckets
      .filter((bucket) => bucket.seedQueries?.length > 0)
      .map((bucket) => [bucket.bucketId, bucket.seedQueries]),
  );
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] === undefined) {
      process.env[key] = cleanEnvValue(rawValue);
    }
  }
}

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
