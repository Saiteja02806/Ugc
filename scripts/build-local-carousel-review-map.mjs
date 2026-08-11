import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FINAL_REVIEW_STATUS = "final_full_resolution_review";
const SUPPORTED_RECOMMENDATIONS = new Set([
  "canonical_original",
  "cropped_only_candidate",
  "flat_candidate",
]);

const args = parseArgs(process.argv.slice(2));
const auditReportPath = requirePathArg(args, "audit-report");
const tagManifestPath = requirePathArg(args, "tag-manifest");
const safetyReviewPath = requirePathArg(args, "safety-review");
const outputPath = path.resolve(
  args["out-file"] ?? ".tmp/local-carousel-review-map.json",
);
const audit = readJson(auditReportPath);
const tagManifest = readJson(tagManifestPath);
const safetyReview = readJson(safetyReviewPath);

if (safetyReview.reviewStatus !== FINAL_REVIEW_STATUS) {
  throw new Error(
    `Safety review must have reviewStatus=${FINAL_REVIEW_STATUS}.`,
  );
}

const recommendationsByFile = new Map();
for (const recommendation of audit.recommendations ?? []) {
  const file = normalizeFile(recommendation.relativePath);

  if (recommendationsByFile.has(file)) {
    throw new Error(`Audit contains duplicate relative path: ${file}`);
  }

  recommendationsByFile.set(file, recommendation);
}

const assetsByFile = new Map();
for (const asset of tagManifest.assets ?? []) {
  const file = normalizeFile(asset.sourceFiles?.canonical?.relativePath);

  if (!file) {
    throw new Error(`${asset.assetKey}: canonical relative path is missing.`);
  }

  if (assetsByFile.has(file)) {
    throw new Error(`Tag manifest contains duplicate relative path: ${file}`);
  }

  assetsByFile.set(file, asset);
}

const manualRejections = new Map();
for (const group of safetyReview.rejectionGroups ?? []) {
  if (!group.categorySlug || !group.reason || !Array.isArray(group.files)) {
    throw new Error(
      "Every safety rejection group needs categorySlug, reason, and files.",
    );
  }

  for (const rawFile of group.files) {
    const file = normalizeFile(rawFile);
    const recommendation = recommendationsByFile.get(file);

    if (!recommendation) {
      throw new Error(`Safety review contains unknown file: ${rawFile}`);
    }

    if (recommendation.categorySlug !== group.categorySlug) {
      throw new Error(
        `${rawFile}: expected source category ${recommendation.categorySlug}, got ${group.categorySlug}.`,
      );
    }

    if (manualRejections.has(file)) {
      throw new Error(`Safety review contains duplicate file: ${rawFile}`);
    }

    manualRejections.set(file, {
      file: recommendation.relativePath,
      reason: group.reason,
    });
  }
}

const approvedGroupsByKey = new Map();
const rejected = [];

for (const recommendation of audit.recommendations ?? []) {
  const file = normalizeFile(recommendation.relativePath);
  const manualRejection = manualRejections.get(file);

  if (manualRejection) {
    rejected.push(manualRejection);
    continue;
  }

  if (!SUPPORTED_RECOMMENDATIONS.has(recommendation.recommendation)) {
    rejected.push({
      file: recommendation.relativePath,
      reason: `audit_${recommendation.recommendation}: ${recommendation.reason}`,
    });
    continue;
  }

  const asset = assetsByFile.get(file);

  if (!asset) {
    throw new Error(
      `Approved audit candidate is missing from tag manifest: ${recommendation.relativePath}`,
    );
  }

  const usableProfiles = [...(asset.usableProfiles ?? [])].sort();
  const groupKey = [
    asset.categorySlug,
    asset.broadVisualBucket,
    asset.assetScope,
    usableProfiles.join(","),
  ].join("|");
  const group = approvedGroupsByKey.get(groupKey) ?? {
    assetScope: asset.assetScope,
    broadVisualBucket: asset.broadVisualBucket,
    contentTags: [],
    files: [],
    moodTags: [],
    objectTags: [],
    runtimeCategory: asset.categorySlug,
    usableProfiles,
  };

  group.files.push(recommendation.relativePath);
  approvedGroupsByKey.set(groupKey, group);
}

const approvedGroups = Array.from(approvedGroupsByKey.values())
  .map((group) => ({
    ...group,
    files: group.files.sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    ),
  }))
  .sort((left, right) =>
    `${left.runtimeCategory}/${left.broadVisualBucket}`.localeCompare(
      `${right.runtimeCategory}/${right.broadVisualBucket}`,
    ),
  );
rejected.sort((left, right) =>
  left.file.localeCompare(right.file, undefined, { numeric: true }),
);

const approvedCount = approvedGroups.reduce(
  (total, group) => total + group.files.length,
  0,
);
const manualRejectedCount = manualRejections.size;
const auditRejectedCount = rejected.length - manualRejectedCount;

if (approvedCount + rejected.length !== recommendationsByFile.size) {
  throw new Error("Review decisions do not cover every audited file.");
}

const reviewMap = {
  reviewStatus: FINAL_REVIEW_STATUS,
  reviewedAt: safetyReview.reviewedAt,
  policy: safetyReview.policy,
  source: {
    auditReportPath,
    safetyReviewPath,
    tagManifestPath,
  },
  summary: {
    approvedCount,
    auditRejectedCount,
    manualRejectedCount,
    rejectedCount: rejected.length,
    totalDecisionCount: recommendationsByFile.size,
  },
  approvedGroups,
  rejected,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(reviewMap, null, 2)}\n`);

console.log("Local carousel review map complete");
console.log(`Review map: ${outputPath}`);
console.log(`Approved: ${approvedCount}`);
console.log(`Manual safety rejects: ${manualRejectedCount}`);
console.log(`Audit/duplicate rejects: ${auditRejectedCount}`);
console.log(`Total decisions: ${recommendationsByFile.size}`);

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = rawArgs[index + 1];

    if (!value || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function requirePathArg(parsedArgs, key) {
  const value = parsedArgs[key];

  if (!value || value === true) {
    throw new Error(`--${key} is required.`);
  }

  return path.resolve(value);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeFile(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .toLowerCase();
}
