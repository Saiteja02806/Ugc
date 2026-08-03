import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_AUDIT_ROOT = ".tmp/local-carousel-image-pack-audit";
const DEFAULT_OUTPUT_ROOT = ".tmp/local-carousel-image-tags";
const FINAL_REVIEW_STATUS = "final_full_resolution_review";
const SUPPORTED_RECOMMENDATIONS = new Set([
  "canonical_original",
  "cropped_only_candidate",
  "flat_candidate",
]);
const ALLOWED_BUCKETS_BY_RUNTIME_CATEGORY = {
  "fitness-health": new Set([
    "abstract-backgrounds",
    "fitness-wellness-objects",
    "food-and-table",
    "home-lifestyle",
    "phone-and-devices",
    "product-still-life",
  ]),
  "productivity-saas": new Set([
    "abstract-backgrounds",
    "data-and-screens",
    "home-lifestyle",
    "notes-and-planning",
    "phone-and-devices",
    "workspace-objects",
  ]),
  shared: new Set([
    "abstract-backgrounds",
    "clean-texture-backgrounds",
    "fitness-wellness-objects",
    "food-and-table",
    "home-lifestyle",
    "notes-and-planning",
    "phone-and-devices",
    "product-still-life",
    "workspace-objects",
  ]),
};

const CATEGORY_CONFIG = {
  calorie_tracking: {
    captionNoun: "calorie tracking visual",
    defaultBroadBucket: "food-and-table",
    defaultContentTags: ["food", "meal", "nutrition", "calorie-tracking"],
    defaultObjects: ["food"],
    defaultProfiles: ["fitness-health", "wellness"],
    defaultScene: "food-table",
    runtimeCategorySlug: "fitness-health",
  },
  gym: {
    captionNoun: "fitness visual",
    defaultBroadBucket: "fitness-wellness-objects",
    defaultContentTags: ["fitness", "workout", "gym"],
    defaultObjects: ["fitness-equipment"],
    defaultProfiles: ["fitness-health", "wellness"],
    defaultScene: "gym",
    runtimeCategorySlug: "fitness-health",
  },
  personal_finance: {
    captionNoun: "personal finance visual",
    defaultBroadBucket: "notes-and-planning",
    defaultContentTags: ["finance", "budgeting", "planning"],
    defaultObjects: ["documents"],
    defaultProfiles: ["generic-business"],
    defaultScene: "desk",
    runtimeCategorySlug: "personal-finance",
  },
  productivity: {
    captionNoun: "productivity visual",
    defaultBroadBucket: "workspace-objects",
    defaultContentTags: ["productivity", "workspace", "planning"],
    defaultObjects: ["desk"],
    defaultProfiles: ["productivity-saas", "generic-business"],
    defaultScene: "workspace",
    runtimeCategorySlug: "productivity-saas",
  },
};

const TERM_RULES = [
  {
    broadBucket: "phone-and-devices",
    categories: ["calorie_tracking", "gym", "personal_finance", "productivity"],
    contentTags: ["phone", "app", "tracking"],
    objects: ["phone"],
    subcategories: ["app_tracking"],
    terms: ["app", "mobile", "phone", "smartphone", "tracker", "tracking"],
  },
  {
    broadBucket: "food-and-table",
    categories: ["calorie_tracking"],
    contentTags: ["breakfast", "meal", "food"],
    objects: ["breakfast", "food"],
    subcategories: ["breakfast"],
    terms: ["avena", "breakfast", "oat", "oatmeal", "poha"],
  },
  {
    broadBucket: "food-and-table",
    categories: ["calorie_tracking"],
    contentTags: ["meal", "lunch", "dinner", "nutrition"],
    objects: ["meal", "plate"],
    subcategories: ["mixed_meal"],
    terms: ["bowl", "chicken", "dinner", "lunch", "meal", "paneer", "pasta", "plate", "salad"],
  },
  {
    broadBucket: "food-and-table",
    categories: ["calorie_tracking"],
    contentTags: ["grocery", "vegetables", "fresh-food"],
    objects: ["groceries", "vegetables"],
    subcategories: ["grocery_shopping", "vegetables"],
    terms: ["broccoli", "carrot", "grocery", "vegetable", "veggie"],
  },
  {
    broadBucket: "food-and-table",
    categories: ["calorie_tracking"],
    contentTags: ["protein", "shake", "nutrition"],
    objects: ["protein-shake"],
    subcategories: ["protein_snack"],
    terms: ["protein", "shake", "smoothie"],
  },
  {
    broadBucket: "fitness-wellness-objects",
    categories: ["gym"],
    contentTags: ["gym", "strength-training", "equipment"],
    objects: ["gym-equipment"],
    subcategories: ["gym_equipment", "strength_training"],
    terms: ["barbell", "crossfit", "dumbbell", "functional", "gym", "kettlebell", "plate", "rack", "rope", "weight", "weights"],
  },
  {
    broadBucket: "fitness-wellness-objects",
    categories: ["gym"],
    contentTags: ["cardio", "workout", "fitness"],
    objects: ["cardio-equipment"],
    subcategories: ["cardio"],
    terms: ["cardio", "treadmill", "bike", "cycle", "elliptical"],
  },
  {
    broadBucket: "fitness-wellness-objects",
    categories: ["gym"],
    contentTags: ["recovery", "wellness", "fitness"],
    objects: ["yoga-mat", "water-bottle"],
    subcategories: ["recovery", "hydration"],
    terms: ["bottle", "mat", "pilates", "reformer", "recovery", "towel", "water", "yoga"],
  },
  {
    broadBucket: "fitness-wellness-objects",
    categories: ["gym"],
    contentTags: ["boxing", "fitness", "training"],
    objects: ["punching-bag"],
    subcategories: ["strength_training"],
    terms: ["boxing", "punching"],
  },
  {
    broadBucket: "data-and-screens",
    categories: ["personal_finance", "productivity"],
    contentTags: ["banking", "dashboard", "finance"],
    objects: ["laptop", "screen"],
    subcategories: ["banking_app", "financial_planning"],
    terms: ["app", "banking", "chart", "dashboard", "investment", "laptop", "screen", "spreadsheet"],
  },
  {
    broadBucket: "notes-and-planning",
    categories: ["personal_finance"],
    contentTags: ["budgeting", "bills", "finance"],
    objects: ["calculator", "documents"],
    subcategories: ["budgeting", "bills"],
    terms: ["bill", "budget", "calculator", "debt", "invoice", "receipt", "saving", "tax"],
  },
  {
    broadBucket: "notes-and-planning",
    categories: ["productivity"],
    contentTags: ["planning", "calendar", "notes"],
    objects: ["calendar", "notebook", "planner"],
    subcategories: ["planning", "task_management"],
    terms: ["calendar", "note", "notebook", "planner", "schedule", "sticky"],
  },
  {
    broadBucket: "workspace-objects",
    categories: ["productivity", "personal_finance"],
    contentTags: ["desk", "workspace", "focus"],
    objects: ["desk", "laptop"],
    subcategories: ["workspace", "focus"],
    terms: ["desk", "focus", "keyboard", "laptop", "office", "workspace"],
  },
  {
    broadBucket: "home-lifestyle",
    categories: ["productivity", "calorie_tracking", "gym"],
    contentTags: ["home", "routine", "lifestyle"],
    objects: ["home-objects"],
    subcategories: ["home_routine"],
    terms: ["bedside", "couch", "home", "kitchen", "morning", "routine"],
  },
  {
    broadBucket: "home-lifestyle",
    categories: ["personal_finance"],
    contentTags: ["household-expense", "saving", "finance"],
    objects: ["household-item"],
    subcategories: ["saving", "expense_tracking"],
    terms: ["cleaning", "entertainment", "grocery", "home", "key", "keys", "lunch", "repair", "repairs", "sponge"],
  },
  {
    broadBucket: "notes-and-planning",
    categories: ["personal_finance"],
    contentTags: ["money", "finance", "still-life"],
    objects: ["cash", "card", "coins"],
    subcategories: ["saving", "payment"],
    terms: ["card", "cash", "coin", "credit", "money", "wallet"],
  },
];

const args = parseArgs(process.argv.slice(2));
const auditReportPath = path.resolve(
  args["audit-report"] || findLatestAuditReport(DEFAULT_AUDIT_ROOT),
);
const outputRoot = path.resolve(args["out-dir"] || DEFAULT_OUTPUT_ROOT);
const generatedAt = new Date().toISOString();
const outputDir = path.join(outputRoot, generatedAt.replace(/[:.]/g, "-"));
const audit = JSON.parse(readFileSync(auditReportPath, "utf8"));
const reviewMapPath = args["review-map"]
  ? path.resolve(args["review-map"])
  : null;
const reviewMap = reviewMapPath
  ? loadAndValidateReviewMap({ audit, reviewMapPath })
  : null;
const manualReviewApproved = reviewMap
  ? reviewMap.reviewStatus === FINAL_REVIEW_STATUS
  : Boolean(args["manual-review-approved"]);

if (reviewMap && args["manual-review-approved"]) {
  throw new Error(
    "Use either --review-map or --manual-review-approved, not both. A review map already contains per-file approval decisions.",
  );
}

mkdirSync(outputDir, { recursive: true });

const cropByOriginalKey = new Map();
const originalByCropKey = new Map();
for (const pair of audit.originalCropPairs ?? []) {
  cropByOriginalKey.set(getFileKey(pair.original), pair.crop);
  originalByCropKey.set(getFileKey(pair.crop), pair.original);
}

const assets = [];
const skippedFiles = [];

for (const recommendation of audit.recommendations ?? []) {
  const fileKey = getFileKey(recommendation);
  const pairedCrop = cropByOriginalKey.get(fileKey);
  const reviewDecision = reviewMap?.decisionsByFile.get(
    normalizeReviewFileName(recommendation.relativePath),
  );

  if (reviewDecision?.decision === "rejected") {
    skippedFiles.push({
      file: toFileReference(recommendation),
      reason: `Manual review rejected this file: ${reviewDecision.reason}`,
      recommendation: recommendation.recommendation,
      reviewDecision,
    });
    continue;
  }

  if (recommendation.recommendation === "derived_crop" && originalByCropKey.has(fileKey)) {
    skippedFiles.push({
      file: toFileReference(recommendation),
      reason: "Represented by its paired original asset entry.",
      recommendation: recommendation.recommendation,
    });
    continue;
  }

  if (!SUPPORTED_RECOMMENDATIONS.has(recommendation.recommendation)) {
    skippedFiles.push({
      file: toFileReference(recommendation),
      reason: recommendation.reason,
      recommendation: recommendation.recommendation,
    });
    continue;
  }

  assets.push(
    buildTaggedAsset({
      audit,
      canonicalFile: recommendation,
      manualReviewApproved:
        reviewDecision?.decision === "approved"
          ? manualReviewApproved
          : manualReviewApproved && !reviewMap,
      preferredRenderFile: pairedCrop ?? recommendation,
      reviewDecision,
      reviewMapPath,
      reviewStatus: reviewMap?.reviewStatus ?? null,
    }),
  );
}

const summary = buildSummary(assets, skippedFiles);
const manifest = {
  generatedAt,
  input: {
    auditReportPath,
    manualReviewApproved,
    reviewMapPath,
    reviewStatus: reviewMap?.reviewStatus ?? null,
  },
  policy: {
    carouselRuntimeSource:
      "Use the 4:5 carousel rendition as the runtime image when present. Keep the original as provenance/canonical source.",
    manualReview:
      reviewMap
        ? `Per-file decisions came from ${reviewMapPath}. Only approved files from a ${FINAL_REVIEW_STATUS} map are importable.`
        : manualReviewApproved
        ? "User confirmed the source set was manually reviewed. Manifest marks assets approved for the import pipeline, but still does not upload or publish them."
        : "Manifest keeps assets unreviewed. Pass --manual-review-approved only after manual strict object-only review.",
    verticalImages:
      "9:16 vertical images are not preferred for carousel runtime. Use them only when no 4:5 carousel rendition exists, then crop to 4:5 during import.",
  },
  summary,
  assets,
  skippedFiles,
};

const manifestPath = path.join(outputDir, "tag-manifest.json");
const csvPath = path.join(outputDir, "tag-manifest.csv");
const summaryPath = path.join(outputDir, "summary.md");

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(csvPath, renderCsv(assets));
writeFileSync(summaryPath, renderSummary(manifest));

console.log("Local carousel image tagging manifest complete");
console.log(`Manifest: ${manifestPath}`);
console.log(`Summary: ${summaryPath}`);
console.log(`CSV: ${csvPath}`);
console.log("");
console.log(`Tagged assets: ${assets.length}`);
console.log(`Skipped files: ${skippedFiles.length}`);
for (const category of summary.categories) {
  console.log(
    `${category.categorySlug}: ${category.assetCount} tagged assets, ${category.manualApprovedCount} manual-approved, ${category.needsCropOrQualityReviewCount} crop/quality warnings`,
  );
}

function buildTaggedAsset({
  audit,
  canonicalFile,
  manualReviewApproved,
  preferredRenderFile,
  reviewDecision,
  reviewMapPath,
  reviewStatus,
}) {
  const categoryConfig = getCategoryConfig(canonicalFile.categorySlug);
  const text = normalizeText([
    canonicalFile.relativePath,
    canonicalFile.fileName,
    preferredRenderFile.relativePath,
  ]);
  const inferred = inferTags({
    categoryConfig,
    categorySlug: canonicalFile.categorySlug,
    text,
  });
  const dimensions = {
    aspectRatio: Number((preferredRenderFile.width / preferredRenderFile.height).toFixed(4)),
    height: preferredRenderFile.height,
    orientation: getOrientation(preferredRenderFile.width, preferredRenderFile.height),
    width: preferredRenderFile.width,
  };
  const qualityWarnings = unique([
    ...asArray(canonicalFile.qualityWarnings),
    ...asArray(preferredRenderFile.qualityWarnings),
  ]);
  const duplicateFamilyId = getDuplicateFamilyId(audit, canonicalFile, preferredRenderFile);
  const runtimeCategorySlug =
    reviewDecision?.runtimeCategory ?? categoryConfig.runtimeCategorySlug;
  const assetScope =
    reviewDecision?.assetScope ??
    (runtimeCategorySlug === "shared" ? "shared" : "category");
  const broadVisualBucket =
    reviewDecision?.broadVisualBucket ?? inferred.broadVisualBucket;
  const contentTags = unique(
    reviewDecision?.contentTags?.length
      ? reviewDecision.contentTags
      : inferred.contentTags,
  );
  const objectTags = unique(
    reviewDecision?.objectTags?.length
      ? reviewDecision.objectTags
      : inferred.objectTags,
  );
  const moodTags = unique(
    reviewDecision?.moodTags?.length
      ? reviewDecision.moodTags
      : inferred.moodTags,
  );
  const usableProfiles = unique(
    reviewDecision?.usableProfiles?.length
      ? reviewDecision.usableProfiles
      : getDefaultProfilesForRuntimeCategory(
          runtimeCategorySlug,
          categoryConfig.defaultProfiles,
        ),
  );
  const assetIdSeed = [
    canonicalFile.categorySlug,
    canonicalFile.sha256Hash,
    canonicalFile.rootPath,
    canonicalFile.relativePath,
  ].join("|");

  return {
    assetKey: `${runtimeCategorySlug}/${crypto
      .createHash("sha1")
      .update(assetIdSeed)
      .digest("hex")
      .slice(0, 16)}`,
    assetScope,
    assetVariant: getAssetVariant(canonicalFile, preferredRenderFile),
    broadVisualBucket,
    bucketTaxonomyVersion: "broad-v1",
    caption: createCaption({
      categoryConfig,
      contentTags,
      objectTags,
      scene: inferred.scene,
    }),
    categorySlug: runtimeCategorySlug,
    contentTags,
    duplicateFamilyId,
    hasFace: false,
    hasPerson: false,
    imageSubjectClass: "object-only",
    importantObjectArea: inferImportantObjectArea(dimensions.orientation),
    licenseInformation: "User-provided/manual-reviewed local image pack",
    moodTags,
    objectTags,
    qualityScore: getQualityScore({
      preferredRenderFile,
      qualityWarnings,
    }),
    reviewStatus: manualReviewApproved ? "approved" : "unreviewed",
    runtime: {
      preferredFileRole:
        preferredRenderFile.relativePath === canonicalFile.relativePath
          ? "canonical"
          : "carousel_rendition",
      reason:
        preferredRenderFile.relativePath === canonicalFile.relativePath
          ? "No paired carousel crop was found; importer should crop this source to 4:5 if needed."
          : "Paired 4:5 carousel rendition exists and should be used for carousel runtime.",
      sourceProvider: "local",
    },
    scene: inferred.scene,
    review: reviewDecision
      ? {
          decision: reviewDecision.decision,
          reviewMapPath,
          reviewStatus,
          runtimeCategory: runtimeCategorySlug,
        }
      : null,
    sourceFiles: {
      canonical: toFileReference(canonicalFile),
      preferredRender: toFileReference(preferredRenderFile),
    },
    sourceFileSha256: canonicalFile.sha256Hash,
    sourceLocalCategorySlug: canonicalFile.categorySlug,
    sourcePerceptualHash: canonicalFile.perceptualHash ?? null,
    statusForImport: manualReviewApproved ? "tagged_manual_approved" : "tagged_pending_review",
    subcategories: inferred.subcategories,
    textSafeAreas: asArray(preferredRenderFile.textSafeAreaHint).length
      ? asArray(preferredRenderFile.textSafeAreaHint)
      : inferTextSafeAreas(dimensions.orientation),
    usableProfiles,
    visualSetting: inferred.scene,
    visualStyle: "object-only",
    warnings: getImportWarnings({
      canonicalFile,
      preferredRenderFile,
      qualityWarnings,
    }),
    ...dimensions,
  };
}

function inferTags({ categoryConfig, categorySlug, text }) {
  const matches = TERM_RULES.filter((rule) =>
    (!rule.categories || rule.categories.includes(categorySlug)) &&
    rule.terms.some((term) => text.includes(term)),
  );
  const contentTags = unique([
    ...categoryConfig.defaultContentTags,
    ...matches.flatMap((match) => match.contentTags),
  ]);
  const objectTags = unique([
    ...categoryConfig.defaultObjects,
    ...matches.flatMap((match) => match.objects),
  ]);
  const subcategories = unique([
    ...matches.flatMap((match) => match.subcategories),
    ...fallbackSubcategories(categorySlug),
  ]).slice(0, 8);
  const broadVisualBucket =
    chooseCategoryAwareBroadBucket(categorySlug, matches) ||
    categoryConfig.defaultBroadBucket;

  return {
    broadVisualBucket,
    contentTags,
    moodTags: inferMoodTags(text),
    objectTags,
    scene: inferScene(categoryConfig.defaultScene, text),
    subcategories,
  };
}

function chooseCategoryAwareBroadBucket(categorySlug, matches) {
  const bucketCounts = new Map();

  for (const match of matches) {
    bucketCounts.set(match.broadBucket, (bucketCounts.get(match.broadBucket) ?? 0) + 1);
  }

  if (bucketCounts.size === 0) {
    return null;
  }

  const sorted = Array.from(bucketCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return getBucketPreference(categorySlug, left[0]) - getBucketPreference(categorySlug, right[0]);
  });

  return sorted[0]?.[0] ?? null;
}

function getBucketPreference(categorySlug, bucket) {
  const preferences = {
    calorie_tracking: ["food-and-table", "phone-and-devices", "home-lifestyle"],
    gym: ["fitness-wellness-objects", "phone-and-devices", "home-lifestyle"],
    personal_finance: ["notes-and-planning", "data-and-screens", "workspace-objects", "phone-and-devices", "home-lifestyle"],
    productivity: ["workspace-objects", "notes-and-planning", "phone-and-devices", "home-lifestyle"],
  };

  const index = (preferences[categorySlug] ?? []).indexOf(bucket);

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function createCaption({ categoryConfig, contentTags, objectTags, scene }) {
  const object = objectTags[0] ?? categoryConfig.captionNoun;
  const context = contentTags.slice(0, 2).join(" and ");

  return `Object-only ${categoryConfig.captionNoun} showing ${object.replaceAll("-", " ")} in a ${scene.replaceAll("-", " ")} context${context ? ` for ${context.replaceAll("-", " ")}` : ""}.`;
}

function inferScene(defaultScene, text) {
  if (text.includes("desk") || text.includes("office") || text.includes("workspace")) {
    return "workspace";
  }

  if (text.includes("home") || text.includes("kitchen") || text.includes("bedside")) {
    return "home";
  }

  if (text.includes("gym") || text.includes("crossfit") || text.includes("pilates")) {
    return "gym";
  }

  if (text.includes("grocery") || text.includes("meal") || text.includes("food")) {
    return "food-table";
  }

  return defaultScene;
}

function inferMoodTags(text) {
  const tags = [];

  if (text.includes("clean") || text.includes("minimal") || text.includes("empty")) {
    tags.push("clean");
  }

  if (text.includes("fresh") || text.includes("healthy")) {
    tags.push("fresh");
  }

  if (text.includes("focus") || text.includes("planning")) {
    tags.push("focused");
  }

  return tags.length ? tags : ["practical"];
}

function fallbackSubcategories(categorySlug) {
  switch (categorySlug) {
    case "calorie_tracking":
      return ["meal_logging"];
    case "gym":
      return ["workout_tracking"];
    case "personal_finance":
      return ["budgeting"];
    case "productivity":
      return ["task_management"];
    default:
      return [];
  }
}

function getAssetVariant(canonicalFile, preferredRenderFile) {
  if (preferredRenderFile.relativePath !== canonicalFile.relativePath) {
    return "canonical_with_carousel_rendition";
  }

  if (canonicalFile.recommendation === "cropped_only_candidate") {
    return "cropped_only";
  }

  return "flat";
}

function getQualityScore({ preferredRenderFile, qualityWarnings }) {
  let score = 0.86;

  if (preferredRenderFile.width === 1080 && preferredRenderFile.height === 1350) {
    score = 0.95;
  } else if (preferredRenderFile.width >= 900 && preferredRenderFile.height >= 900) {
    score = 0.88;
  } else if (qualityWarnings.includes("low_resolution")) {
    score = 0.72;
  }

  if (qualityWarnings.includes("low_resolution")) {
    score -= 0.08;
  }

  return Number(Math.max(Math.min(score, 0.98), 0.5).toFixed(2));
}

function getImportWarnings({ canonicalFile, preferredRenderFile, qualityWarnings }) {
  const warnings = [...qualityWarnings];

  if (preferredRenderFile.relativePath === canonicalFile.relativePath) {
    warnings.push("no_carousel_rendition");
  }

  if (preferredRenderFile.width / preferredRenderFile.height < 0.75) {
    warnings.push("vertical_source_needs_4x5_crop");
  }

  return unique(warnings);
}

function getDuplicateFamilyId(audit, canonicalFile, preferredRenderFile) {
  const fileKeys = new Set([getFileKey(canonicalFile), getFileKey(preferredRenderFile)]);

  for (const pair of audit.originalCropPairs ?? []) {
    if (fileKeys.has(getFileKey(pair.original)) || fileKeys.has(getFileKey(pair.crop))) {
      return `pair-${hashKey(`${pair.original.rootPath}:${pair.original.relativePath}`)}`;
    }
  }

  for (const group of audit.nearDuplicateGroups ?? []) {
    if (group.files.some((file) => fileKeys.has(getFileKey(file)))) {
      return `near-${normalizeDuplicateGroupKey(group.groupKey)}`;
    }
  }

  return `sha-${hashKey(`${canonicalFile.rootPath}:${canonicalFile.relativePath}`)}`;
}

function normalizeDuplicateGroupKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function buildSummary(assets, skippedFiles) {
  const categoryMap = new Map();

  for (const asset of assets) {
    const summary = categoryMap.get(asset.categorySlug) ?? {
      assetCount: 0,
      broadBuckets: new Map(),
      categorySlug: asset.categorySlug,
      manualApprovedCount: 0,
      needsCropOrQualityReviewCount: 0,
    };

    summary.assetCount += 1;
    summary.manualApprovedCount += asset.reviewStatus === "approved" ? 1 : 0;
    summary.needsCropOrQualityReviewCount += asset.warnings.length > 0 ? 1 : 0;
    summary.broadBuckets.set(
      asset.broadVisualBucket,
      (summary.broadBuckets.get(asset.broadVisualBucket) ?? 0) + 1,
    );
    categoryMap.set(asset.categorySlug, summary);
  }

  return {
    assets: assets.length,
    categories: Array.from(categoryMap.values()).map((summary) => ({
      ...summary,
      broadBuckets: Object.fromEntries(summary.broadBuckets.entries()),
    })),
    skippedFiles: skippedFiles.length,
  };
}

function renderSummary(manifest) {
  const lines = [
    "# Local Carousel Image Tagging Manifest",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Audit report: ${manifest.input.auditReportPath}`,
    "",
    "## Summary",
    "",
    `- Tagged assets: ${manifest.summary.assets}`,
    `- Skipped files: ${manifest.summary.skippedFiles}`,
    `- Manual review approved flag: ${manifest.input.manualReviewApproved ? "yes" : "no"}`,
    `- Review map: ${manifest.input.reviewMapPath ?? "none"}`,
    `- Review status: ${manifest.input.reviewStatus ?? "none"}`,
    "",
    "## Categories",
    "",
    "| Category | Tagged assets | Manual approved | Crop/quality warnings | Broad buckets |",
    "|---|---:|---:|---:|---|",
  ];

  for (const category of manifest.summary.categories) {
    lines.push(
      `| ${category.categorySlug} | ${category.assetCount} | ${category.manualApprovedCount} | ${category.needsCropOrQualityReviewCount} | ${Object.entries(category.broadBuckets)
        .map(([bucket, count]) => `${bucket}: ${count}`)
        .join(", ")} |`,
    );
  }

  lines.push(
    "",
    "## Runtime Source Policy",
    "",
    "- Use 4:5 carousel renditions for carousel runtime when they exist.",
    "- Keep originals as provenance/canonical source files.",
    "- Use vertical 9:16 files only when no 4:5 rendition exists, and crop them to 4:5 during import.",
    "- This manifest does not upload files or write to Supabase.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function renderCsv(assets) {
  const headers = [
    "assetKey",
    "categorySlug",
    "reviewStatus",
    "broadVisualBucket",
    "subcategories",
    "contentTags",
    "objectTags",
    "qualityScore",
    "warnings",
    "canonicalPath",
    "preferredRenderPath",
    "caption",
  ];
  const rows = assets.map((asset) => [
    asset.assetKey,
    asset.categorySlug,
    asset.reviewStatus,
    asset.broadVisualBucket,
    asset.subcategories.join("|"),
    asset.contentTags.join("|"),
    asset.objectTags.join("|"),
    String(asset.qualityScore),
    asset.warnings.join("|"),
    path.join(asset.sourceFiles.canonical.rootPath, asset.sourceFiles.canonical.relativePath),
    path.join(asset.sourceFiles.preferredRender.rootPath, asset.sourceFiles.preferredRender.relativePath),
    asset.caption,
  ]);

  return `${[headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

function findLatestAuditReport(root) {
  const absoluteRoot = path.resolve(root);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Audit root not found: ${absoluteRoot}`);
  }

  const latestDir = readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteRoot, entry.name))
    .sort()
    .at(-1);

  if (!latestDir) {
    throw new Error(`No audit output directories found under ${absoluteRoot}`);
  }

  const reportPath = path.join(latestDir, "report.json");

  if (!existsSync(reportPath)) {
    throw new Error(`Latest audit directory has no report.json: ${latestDir}`);
  }

  return reportPath;
}

function getCategoryConfig(categorySlug) {
  return CATEGORY_CONFIG[categorySlug] ?? {
    captionNoun: "carousel visual",
    defaultBroadBucket: "clean-texture-backgrounds",
    defaultContentTags: [categorySlug],
    defaultObjects: ["object"],
    defaultProfiles: ["generic-business"],
    defaultScene: "still-life",
    runtimeCategorySlug: categorySlug,
  };
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = rawArgs[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function toFileReference(file) {
  return {
    averageHash: file.averageHash ?? null,
    categorySlug: file.categorySlug,
    fileName: file.fileName,
    height: Number(file.height),
    perceptualHash: file.perceptualHash ?? null,
    relativePath: file.relativePath,
    rootPath: file.rootPath,
    sha256Hash: file.sha256Hash ?? null,
    topFolder: file.topFolder,
    width: Number(file.width),
  };
}

function loadAndValidateReviewMap({ audit, reviewMapPath }) {
  if (!existsSync(reviewMapPath)) {
    throw new Error(`Review map not found: ${reviewMapPath}`);
  }

  const reviewMap = JSON.parse(readFileSync(reviewMapPath, "utf8"));

  if (reviewMap.reviewStatus !== FINAL_REVIEW_STATUS) {
    throw new Error(
      `Review map must have reviewStatus=${FINAL_REVIEW_STATUS} before it can approve imports. Got ${String(
        reviewMap.reviewStatus,
      )}.`,
    );
  }

  const auditFiles = new Map();
  for (const recommendation of audit.recommendations ?? []) {
    const fileName = normalizeReviewFileName(recommendation.relativePath);

    if (auditFiles.has(fileName)) {
      throw new Error(
        `Audit contains duplicate review file name ${fileName}. Review maps require unique relative paths.`,
      );
    }

    auditFiles.set(fileName, recommendation);
  }

  const decisionsByFile = new Map();

  for (const group of reviewMap.approvedGroups ?? []) {
    validateApprovedGroup(group);

    for (const file of group.files ?? []) {
      addReviewDecision(decisionsByFile, file, {
        assetScope:
          group.assetScope ??
          (group.runtimeCategory === "shared" ? "shared" : "category"),
        broadVisualBucket: group.broadVisualBucket,
        contentTags: normalizeStringArray(group.contentTags),
        decision: "approved",
        moodTags: normalizeStringArray(group.moodTags),
        objectTags: normalizeStringArray(group.objectTags),
        runtimeCategory: group.runtimeCategory,
        usableProfiles: normalizeStringArray(group.usableProfiles),
      });
    }
  }

  for (const rejected of reviewMap.rejected ?? []) {
    if (!rejected?.file || !rejected?.reason) {
      throw new Error("Every rejected review item must include file and reason.");
    }

    addReviewDecision(decisionsByFile, rejected.file, {
      decision: "rejected",
      reason: String(rejected.reason),
    });
  }

  const unknownFiles = Array.from(decisionsByFile.keys()).filter(
    (fileName) => !auditFiles.has(fileName),
  );
  const missingFiles = Array.from(auditFiles.keys()).filter(
    (fileName) => !decisionsByFile.has(fileName),
  );

  if (unknownFiles.length > 0 || missingFiles.length > 0) {
    throw new Error(
      [
        unknownFiles.length
          ? `Review map contains unknown files: ${unknownFiles.join(", ")}`
          : null,
        missingFiles.length
          ? `Review map is missing audit files: ${missingFiles.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const approvedCount = Array.from(decisionsByFile.values()).filter(
    (decision) => decision.decision === "approved",
  ).length;
  const rejectedCount = decisionsByFile.size - approvedCount;

  if (
    reviewMap.summary?.files !== undefined &&
    Number(reviewMap.summary.files) !== decisionsByFile.size
  ) {
    throw new Error(
      `Review map summary.files=${reviewMap.summary.files} does not match ${decisionsByFile.size} decisions.`,
    );
  }

  if (
    reviewMap.summary?.approvedCandidates !== undefined &&
    Number(reviewMap.summary.approvedCandidates) !== approvedCount
  ) {
    throw new Error(
      `Review map summary.approvedCandidates=${reviewMap.summary.approvedCandidates} does not match ${approvedCount} approved decisions.`,
    );
  }

  if (
    reviewMap.summary?.rejected !== undefined &&
    Number(reviewMap.summary.rejected) !== rejectedCount
  ) {
    throw new Error(
      `Review map summary.rejected=${reviewMap.summary.rejected} does not match ${rejectedCount} rejected decisions.`,
    );
  }

  const auditRootPaths = unique(
    (audit.recommendations ?? []).map((item) =>
      normalizeComparablePath(item.rootPath),
    ),
  );

  if (
    reviewMap.sourceFolder &&
    auditRootPaths.length === 1 &&
    normalizeComparablePath(reviewMap.sourceFolder) !== auditRootPaths[0]
  ) {
    throw new Error(
      `Review map sourceFolder does not match the audited folder: ${reviewMap.sourceFolder}`,
    );
  }

  return {
    decisionsByFile,
    reviewStatus: reviewMap.reviewStatus,
  };
}

function validateApprovedGroup(group) {
  if (!group?.runtimeCategory || !group?.broadVisualBucket) {
    throw new Error(
      "Every approved review group must include runtimeCategory and broadVisualBucket.",
    );
  }

  if (!Array.isArray(group.files) || group.files.length === 0) {
    throw new Error("Every approved review group must contain at least one file.");
  }

  const allowedBuckets = ALLOWED_BUCKETS_BY_RUNTIME_CATEGORY[group.runtimeCategory];

  if (!allowedBuckets?.has(group.broadVisualBucket)) {
    throw new Error(
      `Broad bucket ${group.broadVisualBucket} is not allowed for runtime category ${group.runtimeCategory}.`,
    );
  }

  const assetScope =
    group.assetScope ??
    (group.runtimeCategory === "shared" ? "shared" : "category");

  if (
    (group.runtimeCategory === "shared" && assetScope !== "shared") ||
    (group.runtimeCategory !== "shared" && assetScope !== "category")
  ) {
    throw new Error(
      `Review group ${group.runtimeCategory}/${group.broadVisualBucket} has incompatible assetScope ${assetScope}.`,
    );
  }

  if (
    group.runtimeCategory === "shared" &&
    normalizeStringArray(group.usableProfiles).length === 0
  ) {
    throw new Error("Shared review groups must include usableProfiles.");
  }
}

function addReviewDecision(decisionsByFile, file, decision) {
  const fileName = normalizeReviewFileName(file);

  if (decisionsByFile.has(fileName)) {
    throw new Error(`Review map contains more than one decision for ${fileName}.`);
  }

  decisionsByFile.set(fileName, decision);
}

function normalizeReviewFileName(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function normalizeComparablePath(value) {
  return path.resolve(String(value)).replaceAll("\\", "/").toLowerCase();
}

function normalizeStringArray(value) {
  return unique(
    asArray(value)
      .map((item) => String(item).trim())
      .filter(Boolean),
  );
}

function getDefaultProfilesForRuntimeCategory(runtimeCategory, fallback) {
  switch (runtimeCategory) {
    case "fitness-health":
      return ["fitness-health", "wellness"];
    case "productivity-saas":
      return ["productivity-saas", "generic-business"];
    default:
      return fallback;
  }
}

function getFileKey(file) {
  return `${file.rootPath}::${file.relativePath}`;
}

function normalizeText(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/g, " ")
    .replace(/[_#()\-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getOrientation(width, height) {
  const ratio = width / height;

  if (ratio < 0.85) {
    return "portrait";
  }

  if (ratio > 1.15) {
    return "landscape";
  }

  return "square";
}

function inferTextSafeAreas(orientation) {
  return orientation === "portrait"
    ? ["top", "bottom"]
    : ["top", "upper_left", "upper_right"];
}

function inferImportantObjectArea(orientation) {
  return orientation === "portrait" ? "center" : "center_left";
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value.split("|").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hashKey(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
