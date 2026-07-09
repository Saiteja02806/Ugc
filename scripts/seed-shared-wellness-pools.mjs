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
const categorySlug = "shared";
const candidateFetchLimit = 80;
const minimumApprovedTarget = 40;
const batchSize = 20;
const usableProfiles = ["fitness-health", "wellness", "beauty-skincare"];
const poolDefinitions = [
  {
    broadVisualBucket: "product-still-life",
    queries: [
      "wellness product bottles still life",
      "supplement bottles still life",
      "essential oil bottles minimal",
      "skincare jars product display",
      "wellness packaging still life",
      "soap bottle bathroom still life",
      "vitamin container tabletop",
      "cosmetic bottles neutral background",
    ],
    visualKeywords: [
      "wellness",
      "product",
      "still-life",
      "bottle",
      "packaging",
      "object-only",
    ],
  },
  {
    broadVisualBucket: "abstract-backgrounds",
    queries: [
      "calm abstract paper texture",
      "soft neutral abstract background",
      "organic shadow wall texture",
      "minimal pastel geometric background",
      "water ripple abstract texture",
      "stone surface neutral background",
      "botanical shadow wall background",
      "fabric folds abstract background",
    ],
    visualKeywords: [
      "wellness",
      "abstract",
      "neutral",
      "texture",
      "calm",
      "object-only",
    ],
  },
  {
    broadVisualBucket: "fitness-wellness-objects",
    queries: [
      "dumbbells water bottle towel gym",
      "yoga mat blocks water bottle",
      "running shoes gym bag",
      "resistance bands workout equipment",
      "kettlebell towel water bottle",
      "foam roller recovery equipment",
      "home workout equipment still life",
      "sports bottle training gear",
    ],
    visualKeywords: [
      "fitness",
      "wellness",
      "workout",
      "recovery",
      "equipment",
      "object-only",
    ],
  },
];

if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to source the shared Wellness pools.");
}

for (const pool of poolDefinitions) {
  validateQueries(pool.queries, pool.broadVisualBucket);
}

const { seedCategoryImageLibrary } = await jiti.import(
  "../lib/carousel/seed-category-image-library.ts",
);
const { getCategoryImageAssetSourcingState } = await jiti.import(
  "../lib/carousel/supabase.ts",
);

const plan = [];

for (const pool of poolDefinitions) {
  const state = await getCategoryImageAssetSourcingState({
    broadVisualBucketId: pool.broadVisualBucket,
    categorySlug,
  });
  const skipReason =
    state.unreviewedCount > 0
      ? "pending_manual_review"
      : state.approvedObjectOnlyCount >= minimumApprovedTarget
        ? "target_met"
        : null;

  plan.push({
    ...pool,
    candidateFetchLimit,
    minimumApprovedTarget,
    skipReason,
    state,
  });
}

const results = [];

if (execute) {
  for (const pool of plan) {
    if (pool.skipReason) {
      results.push({
        broadVisualBucket: pool.broadVisualBucket,
        skipped: true,
        skipReason: pool.skipReason,
      });
      continue;
    }

    try {
      const result = await seedCategoryImageLibrary({
        batchSize,
        broadVisualBucketId: pool.broadVisualBucket,
        candidateFetchLimit,
        categorySlug,
        maxSourceAttempts: 12,
        minimumApprovedTarget,
        queries: pool.queries,
        subjectAnalysisMode: "manual",
        visualKeywords: [
          "shared",
          pool.broadVisualBucket,
          ...pool.visualKeywords,
        ],
      });

      results.push({
        broadVisualBucket: pool.broadVisualBucket,
        errors: result.errors,
        rawCandidateCountAfter: result.rawCandidateCountAfter,
        seededCount: result.seededCount,
        skipped: false,
        unreviewedCountAfter: result.unreviewedCountAfter,
      });
    } catch (error) {
      results.push({
        broadVisualBucket: pool.broadVisualBucket,
        error: error instanceof Error ? error.message : String(error),
        skipped: false,
      });
    }
  }
}

const reviewCommands = plan.map((pool) => ({
  broadVisualBucket: pool.broadVisualBucket,
  command: [
    "npm run carousel:broad-bucket-contact-sheet --",
    "--category shared",
    `--bucket ${pool.broadVisualBucket}`,
    "--review-status unreviewed",
    "--sort oldest",
  ].join(" "),
}));
const report = {
  batchSize,
  candidateFetchLimit,
  categorySlug,
  dryRun: !execute,
  generatedAt: new Date().toISOString(),
  minimumApprovedTarget,
  plan,
  results,
  reviewCommands,
  usableProfiles,
};
const outputDirectory = path.resolve(
  workspaceRoot,
  ".tmp",
  "shared-wellness-pools",
);
const outputPath = path.join(
  outputDirectory,
  `seed-${execute ? "execute" : "dry-run"}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`,
);

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, outputPath }, null, 2));

function validateQueries(queries, broadVisualBucket) {
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

  for (const query of queries) {
    const matches = blockedTerms.filter((term) =>
      new RegExp(`\\b${term}\\b`, "i").test(query),
    );

    if (matches.length > 0) {
      throw new Error(
        `${broadVisualBucket} query "${query}" contains blocked terms: ${matches.join(", ")}.`,
      );
    }
  }
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

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

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
