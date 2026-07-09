import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": workspaceRoot } });

loadEnvFile(path.resolve(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = args.execute === "true";
const categorySlug = args.category || args.categorySlug || "marketing-saas";
const profileId = "marketing-saas";
const canaryTarget = parsePositiveInteger(args.target, 20);
const batchSize = parsePositiveInteger(args.batchSize || args["batch-size"], 20);
const multiplier = parsePositiveInteger(args.multiplier, 5);
const minCandidateFetch = parsePositiveInteger(
  args.minCandidateFetch || args["min-candidate-fetch"],
  50,
);
const maxCandidateFetch = parsePositiveInteger(
  args.maxCandidateFetch || args["max-candidate-fetch"],
  120,
);
const selectedBuckets = parseList(args.buckets || args.bucket || "");

if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to seed Marketing SaaS broad buckets.");
}

const {
  getBroadBucketRequirementsForProfile,
  getBroadVisualBucket,
} = await jiti.import("../lib/carousel/broad-visual-bucket-taxonomy.ts");
const { seedCategoryImageLibrary } = await jiti.import(
  "../lib/carousel/seed-category-image-library.ts",
);
const { getCategoryImageAssetSourcingState } = await jiti.import(
  "../lib/carousel/supabase.ts",
);

const requiredBuckets = getBroadBucketRequirementsForProfile(profileId);
const bucketIds =
  selectedBuckets.length > 0
    ? selectedBuckets.filter((bucketId) => requiredBuckets.includes(bucketId))
    : [...requiredBuckets];
const invalidBucketIds = selectedBuckets.filter(
  (bucketId) => !requiredBuckets.includes(bucketId),
);

if (invalidBucketIds.length > 0) {
  throw new Error(
    `These buckets are not required by ${profileId}: ${invalidBucketIds.join(", ")}`,
  );
}

validateQueryOverrides(bucketIds);

const plan = [];

for (const bucketId of bucketIds) {
  const state = await getCategoryImageAssetSourcingState({
    broadVisualBucketId: bucketId,
    categorySlug,
  });
  const approvedGap = Math.max(canaryTarget - state.approvedObjectOnlyCount, 0);
  const candidateFetchLimit =
    approvedGap > 0
      ? Math.min(
          maxCandidateFetch,
          Math.max(minCandidateFetch, approvedGap * multiplier),
        )
      : 0;
  const skipReason =
    approvedGap === 0
      ? "target_met"
      : state.unreviewedCount > 0
        ? "pending_manual_review"
        : null;

  plan.push({
    approvedGap,
    approvedObjectOnlyCount: state.approvedObjectOnlyCount,
    broadVisualBucket: bucketId,
    candidateFetchLimit,
    minimumApprovedTarget: canaryTarget,
    rawCandidateCount: state.rawCandidateCount,
    rejectedCount: state.rejectedCount,
    seedQueries: getSeedQueries(bucketId),
    skipReason,
    unreviewedCount: state.unreviewedCount,
  });
}

const results = [];

if (execute) {
  for (const bucketPlan of plan) {
    if (bucketPlan.skipReason) {
      results.push({
        broadVisualBucket: bucketPlan.broadVisualBucket,
        skipped: true,
        skipReason: bucketPlan.skipReason,
      });
      continue;
    }

    const result = await seedCategoryImageLibrary({
      batchSize,
      broadVisualBucketId: bucketPlan.broadVisualBucket,
      candidateFetchLimit: bucketPlan.candidateFetchLimit,
      categorySlug,
      minimumApprovedTarget: canaryTarget,
      queries: bucketPlan.seedQueries,
      subjectAnalysisMode: "manual",
      visualKeywords: getVisualKeywords(bucketPlan.broadVisualBucket),
    });

    results.push({
      approvedObjectOnlyCountAfter: result.approvedObjectOnlyCountAfter,
      approvedObjectOnlyCountBefore: result.approvedObjectOnlyCountBefore,
      awaitingManualReview: result.awaitingManualReview,
      broadVisualBucket: bucketPlan.broadVisualBucket,
      candidateFetchLimit: result.candidateFetchLimit,
      rawCandidateCountAfter: result.rawCandidateCountAfter,
      rawCandidateCountBefore: result.rawCandidateCountBefore,
      rejectedCountAfter: result.rejectedCountAfter,
      rejectedCountBefore: result.rejectedCountBefore,
      seededCount: result.seededCount,
      skipped: false,
      unreviewedCountAfter: result.unreviewedCountAfter,
      unreviewedCountBefore: result.unreviewedCountBefore,
    });
  }
}

const report = {
  batchSize,
  canaryTarget,
  categorySlug,
  dryRun: !execute,
  generatedAt: new Date().toISOString(),
  maxCandidateFetch,
  minCandidateFetch,
  multiplier,
  plan,
  profileId,
  results,
  reviewCommands: buildReviewCommands(plan),
  summary: {
    bucketCount: plan.length,
    candidateFetchPlanned: plan.reduce(
      (total, bucket) =>
        total + (bucket.skipReason ? 0 : bucket.candidateFetchLimit),
      0,
    ),
    currentApprovedTotal: plan.reduce(
      (total, bucket) => total + bucket.approvedObjectOnlyCount,
      0,
    ),
    currentGapTotal: plan.reduce((total, bucket) => total + bucket.approvedGap, 0),
    skippedForPendingReviewCount: plan.filter(
      (bucket) => bucket.skipReason === "pending_manual_review",
    ).length,
    targetTotal: plan.length * canaryTarget,
  },
};
const outputDir = path.resolve(
  workspaceRoot,
  ".tmp",
  "marketing-saas-broad-refill",
);
const outputPath = path.join(
  outputDir,
  `refill-${execute ? "execute" : "dry-run"}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`,
);

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, outputPath }, null, 2));

function getSeedQueries(bucketId) {
  const overrides = {
    "abstract-backgrounds": [
      "abstract data background",
      "minimal abstract surface",
      "neutral texture background",
      "geometric business background",
      "abstract technology texture",
      "soft paper texture background",
    ],
    "clean-texture-backgrounds": [
      "minimal desk objects negative space",
      "clean surface still life",
      "neutral background objects",
      "stationery objects negative space",
      "minimal workspace background",
      "paper texture desk objects",
    ],
    "data-and-screens": [
      "analytics dashboard screen",
      "spreadsheet laptop screen",
      "data visualization monitor",
      "business charts display",
      "dashboard metrics monitor",
      "spreadsheet table screen close up",
    ],
    "notes-and-planning": [
      "calendar planner desk",
      "sticky notes desk planning",
      "notebook calendar workspace",
      "whiteboard notes empty office",
      "project plan table overhead",
      "schedule notebook desk",
    ],
    "phone-and-devices": [
      "smartphone desk close up",
      "phone beside laptop",
      "mobile phone table notification",
      "smartphone coffee notebook",
      "phone keyboard desk",
      "phone screen desk objects",
    ],
    "workspace-objects": [
      "minimal laptop desk still life",
      "office desk objects",
      "workspace objects overhead",
      "laptop notebook coffee desk",
      "keyboard monitor desk setup",
      "clean software desk objects",
    ],
  };

  return overrides[bucketId] ?? getBroadVisualBucket(bucketId)?.seedQueryThemes ?? [];
}

function getVisualKeywords(bucketId) {
  const bucket = getBroadVisualBucket(bucketId);

  return [
    "marketing-saas",
    "saas-work",
    bucketId,
    ...(bucket?.defaultTags ?? []),
  ];
}

function validateQueryOverrides(bucketIds) {
  const blockedTerms = [
    "arm",
    "arms",
    "body",
    "bodies",
    "boy",
    "face",
    "faces",
    "female",
    "girl",
    "hand",
    "hands",
    "human",
    "humans",
    "male",
    "man",
    "men",
    "model",
    "people",
    "person",
    "portrait",
    "selfie",
    "silhouette",
    "silhouettes",
    "woman",
    "women",
  ];

  for (const bucketId of bucketIds) {
    for (const query of getSeedQueries(bucketId)) {
      const loweredQuery = query.toLowerCase();
      const matches = blockedTerms.filter((term) =>
        new RegExp(`\\b${term}\\b`, "i").test(loweredQuery),
      );

      if (matches.length > 0) {
        throw new Error(
          `${bucketId} query "${query}" contains blocked terms: ${matches.join(
            ", ",
          )}.`,
        );
      }
    }
  }
}

function buildReviewCommands(buckets) {
  return buckets
    .filter((bucket) => bucket.approvedGap > 0)
    .map((bucket) => ({
      broadVisualBucket: bucket.broadVisualBucket,
      command: [
        "npm run carousel:broad-bucket-contact-sheet --",
        "--category marketing-saas",
        `--bucket ${bucket.broadVisualBucket}`,
        "--review-status unreviewed",
        "--sort newest",
      ].join(" "),
    }));
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const next = values[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function parseList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}
