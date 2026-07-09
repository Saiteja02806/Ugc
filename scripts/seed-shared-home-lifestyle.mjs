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
const broadVisualBucket = "home-lifestyle";
const candidateFetchLimit = 80;
const minimumApprovedTarget = 40;
const batchSize = 20;
const usableProfiles = [
  "productivity-saas",
  "fitness-health",
  "wellness",
  "beauty-skincare",
  "generic-business",
];
const seedQueries = [
  "empty living room couch evening",
  "bedside table lamp book",
  "cozy home interior still life",
  "coffee table books candle",
  "empty home office evening",
  "bedroom nightstand alarm clock",
  "folded blanket couch interior",
  "home routine objects still life",
];

if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to source the shared home-lifestyle pool.");
}

validateQueries(seedQueries);

const { seedCategoryImageLibrary } = await jiti.import(
  "../lib/carousel/seed-category-image-library.ts",
);
const { getCategoryImageAssetSourcingState } = await jiti.import(
  "../lib/carousel/supabase.ts",
);

const stateBefore = await getCategoryImageAssetSourcingState({
  broadVisualBucketId: broadVisualBucket,
  categorySlug,
});

if (execute && stateBefore.unreviewedCount > 0) {
  throw new Error(
    `Shared home-lifestyle already has ${stateBefore.unreviewedCount} unreviewed assets. Review that batch instead of sourcing more.`,
  );
}

let result = null;

if (execute) {
  result = await seedCategoryImageLibrary({
    batchSize,
    broadVisualBucketId: broadVisualBucket,
    candidateFetchLimit,
    categorySlug,
    maxSourceAttempts: 12,
    minimumApprovedTarget,
    queries: seedQueries,
    subjectAnalysisMode: "manual",
    visualKeywords: [
      "shared",
      broadVisualBucket,
      "home",
      "interior",
      "routine",
      "evening",
      "object-only",
    ],
  });
}

const report = {
  broadVisualBucket,
  candidateFetchLimit,
  categorySlug,
  dryRun: !execute,
  generatedAt: new Date().toISOString(),
  minimumApprovedTarget,
  result,
  seedQueries,
  stateBefore,
  usableProfiles,
  reviewCommand:
    "npm run carousel:broad-bucket-contact-sheet -- --category shared --bucket home-lifestyle --review-status unreviewed --sort oldest",
};
const outputDirectory = path.resolve(
  workspaceRoot,
  ".tmp",
  "shared-home-lifestyle",
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

function validateQueries(queries) {
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
        `Shared home-lifestyle query "${query}" contains blocked terms: ${matches.join(", ")}.`,
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
