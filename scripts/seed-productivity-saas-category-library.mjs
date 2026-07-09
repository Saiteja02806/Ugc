import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

config({ path: path.join(workspaceRoot, ".env.local") });

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": workspaceRoot,
  },
});

const PRODUCTIVITY_SAAS_QUERIES = [
  "modern workspace laptop productivity app",
  "team collaboration office laptop",
  "minimal desk setup software dashboard",
  "startup team planning whiteboard",
  "project management dashboard laptop",
  "remote team video meeting workspace",
  "office productivity software desk",
  "business workflow automation laptop",
];

async function main() {
  const { seedCategoryImageLibrary } = await jiti.import(
    "../lib/carousel/seed-category-image-library.ts",
  );
  const result = await seedCategoryImageLibrary({
    batchSize: 20,
    categorySlug: "productivity-saas",
    queries: PRODUCTIVITY_SAAS_QUERIES,
    subjectAnalysisMode: "manual",
    targetCount: 100,
    visualKeywords: ["workspace", "laptop", "dashboard", "team", "planning"],
  });

  console.log(
    JSON.stringify(
      {
        batchSize: result.batchSize,
        batchesProcessed: result.batchesProcessed,
        categorySlug: result.categorySlug,
        errorCount: result.errors.length,
        readyCountAfter: result.readyCountAfter,
        readyCountBefore: result.readyCountBefore,
        reviewCandidateCountAfter: result.reviewCandidateCountAfter,
        reviewCandidateCountBefore: result.reviewCandidateCountBefore,
        seededCount: result.seededCount,
        skippedDuplicateCount: result.skippedDuplicateCount,
        subjectAnalysisMode: result.subjectAnalysisMode,
        targetCount: result.targetCount,
      },
      null,
      2,
    ),
  );

  if (result.readyCountAfter < result.targetCount) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
