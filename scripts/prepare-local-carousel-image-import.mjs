import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import sharp from "sharp";

const DEFAULT_TAG_ROOT = ".tmp/local-carousel-image-tags";
const DEFAULT_OUTPUT_ROOT = ".tmp/local-carousel-image-import";
const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1350;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 400;

const args = parseArgs(process.argv.slice(2));
const tagManifestPath = path.resolve(
  args["tag-manifest"] || findLatestManifest(DEFAULT_TAG_ROOT, "tag-manifest.json"),
);
const outputRoot = path.resolve(args["out-dir"] || DEFAULT_OUTPUT_ROOT);
const generatedAt = new Date().toISOString();
const outputDir = path.join(outputRoot, generatedAt.replace(/[:.]/g, "-"));
const manifest = JSON.parse(readFileSync(tagManifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];

mkdirSync(outputDir, { recursive: true });

const preparedAssets = [];
const errors = [];

for (const asset of assets) {
  try {
    const prepared = await prepareAsset(asset, outputDir);
    preparedAssets.push(prepared);
  } catch (error) {
    errors.push({
      assetKey: asset.assetKey,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const summary = buildSummary(preparedAssets, errors);
const importManifest = {
  generatedAt,
  input: {
    tagManifestPath,
  },
  policy: {
    baseRendition: `${BASE_WIDTH}x${BASE_HEIGHT} webp, fit cover, center crop`,
    thumbnailRendition: `${THUMB_WIDTH}x${THUMB_HEIGHT} webp, fit cover, center crop`,
    uploadCheckpoint:
      "This package is local-only. The import uploader should upload original, base, and thumbnail files through the configured object-storage provider, then insert category_image_assets rows.",
  },
  summary,
  assets: preparedAssets,
  errors,
};

const manifestPath = path.join(outputDir, "import-manifest.json");
const csvPath = path.join(outputDir, "import-manifest.csv");
const summaryPath = path.join(outputDir, "summary.md");

writeFileSync(manifestPath, `${JSON.stringify(importManifest, null, 2)}\n`);
writeFileSync(csvPath, renderCsv(preparedAssets));
writeFileSync(summaryPath, renderSummary(importManifest));

console.log("Local carousel image import package complete");
console.log(`Manifest: ${manifestPath}`);
console.log(`Summary: ${summaryPath}`);
console.log(`CSV: ${csvPath}`);
console.log("");
console.log(`Prepared assets: ${preparedAssets.length}`);
console.log(`Errors: ${errors.length}`);
for (const category of summary.categories) {
  console.log(
    `${category.categorySlug}: ${category.assetCount} assets, ${category.generatedCropCount} generated crops, ${category.preparedCarouselRenditionCount} existing carousel renditions`,
  );
}

if (errors.length > 0) {
  process.exitCode = 1;
}

async function prepareAsset(asset, outputDir) {
  const assetId = asset.assetKey.split("/").at(-1);
  const assetDir = path.join(outputDir, "assets", asset.categorySlug, assetId);
  const originalFile = resolveSourceFile(asset.sourceFiles.canonical);
  const renderFile = resolveSourceFile(asset.sourceFiles.preferredRender);
  const originalExtension =
    path.extname(originalFile).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".jpg";
  const originalOutputPath = path.join(assetDir, `original${originalExtension}`);
  const baseOutputPath = path.join(assetDir, "base-1080x1350.webp");
  const thumbOutputPath = path.join(assetDir, "thumb-320x400.webp");

  mkdirSync(assetDir, { recursive: true });
  copyFileSync(originalFile, originalOutputPath);

  const sourceForRuntime = readFileSync(renderFile);
  const baseBuffer = await sharp(sourceForRuntime, { failOn: "none" })
    .rotate()
    .resize(BASE_WIDTH, BASE_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 88 })
    .toBuffer();
  const thumbBuffer = await sharp(baseBuffer)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 78 })
    .toBuffer();

  writeFileSync(baseOutputPath, baseBuffer);
  writeFileSync(thumbOutputPath, thumbBuffer);

  const storagePrefix = `category-library/${asset.categorySlug}/${asset.broadVisualBucket}/${assetId}`;
  const generatedCrop =
    asset.runtime.preferredFileRole !== "carousel_rendition" ||
    asset.sourceFiles.preferredRender.width !== BASE_WIDTH ||
    asset.sourceFiles.preferredRender.height !== BASE_HEIGHT;

  return {
    ...asset,
    dbRow: buildDbRow({
      asset,
      baseObjectKey: `${storagePrefix}/base-1080x1350.webp`,
      originalObjectKey: `${storagePrefix}/original${originalExtension}`,
      thumbObjectKey: `${storagePrefix}/thumb-320x400.webp`,
    }),
    files: {
      base: toRelativePath(baseOutputPath, outputDir),
      original: toRelativePath(originalOutputPath, outputDir),
      thumb: toRelativePath(thumbOutputPath, outputDir),
    },
    generatedCrop,
    importAssetId: assetId,
    storage: {
      baseKey: `${storagePrefix}/base-1080x1350.webp`,
      originalKey: `${storagePrefix}/original${originalExtension}`,
      thumbKey: `${storagePrefix}/thumb-320x400.webp`,
    },
  };
}

function buildDbRow({
  asset,
  baseObjectKey,
  originalObjectKey,
  thumbObjectKey,
}) {
  return {
    asset_scope: asset.assetScope,
    asset_variant:
      asset.assetVariant === "canonical_with_carousel_rendition"
        ? "canonical"
        : asset.assetVariant,
    base_s3_key: baseObjectKey,
    best_for_slide_types: asset.subcategories,
    broad_visual_bucket: asset.broadVisualBucket,
    bucket_taxonomy_version: asset.bucketTaxonomyVersion,
    category_slug: asset.categorySlug,
    content_tags: asset.contentTags,
    face_count: 0,
    has_human: false,
    height: BASE_HEIGHT,
    image_query: asset.caption,
    image_subject_class: "object-only",
    license_information: asset.licenseInformation,
    max_face_area_ratio: 0,
    mood_tags: asset.moodTags,
    near_duplicate_group: asset.duplicateFamilyId,
    object_tags: asset.objectTags,
    orientation: "portrait",
    person_count: 0,
    quality_score: asset.qualityScore,
    runtime_exclusion_reason: null,
    source_file_sha256: asset.sourceFileSha256,
    source_filename: asset.sourceFiles.canonical.fileName,
    source_folder: asset.sourceFiles.canonical.rootPath,
    source_metadata: {
      caption: asset.caption,
      duplicateFamilyId: asset.duplicateFamilyId,
      localCategorySlug: asset.sourceLocalCategorySlug,
      sourceCanonicalRelativePath: asset.sourceFiles.canonical.relativePath,
      sourcePreferredRenderRelativePath:
        asset.sourceFiles.preferredRender.relativePath,
      subcategories: asset.subcategories,
      textSafeAreas: asset.textSafeAreas,
      review: asset.review,
      warnings: asset.warnings,
    },
    source_original_s3_key: originalObjectKey,
    source_perceptual_hash: asset.sourcePerceptualHash,
    source_provider: "local",
    source_query: asset.caption,
    status: "ready",
    subject_analysis: {
      analyzer_version: "manual-local-image-review-v1",
      mode: "manual-review-confirmed",
      policy: "object-only-backgrounds-required",
      review: asset.review,
      reviewed: true,
      source: "local-tag-manifest",
    },
    subject_analyzed_at: new Date().toISOString(),
    subject_analyzer_version: "manual-local-image-review-v1",
    subject_review_status: asset.reviewStatus === "approved" ? "approved" : "unreviewed",
    thumb_s3_key: thumbObjectKey,
    usable_profiles: asset.usableProfiles,
    visual_setting: asset.visualSetting,
    visual_style: asset.visualStyle,
    visual_keywords: asset.contentTags,
    width: BASE_WIDTH,
  };
}

function buildSummary(assets, errors) {
  const byCategory = new Map();

  for (const asset of assets) {
    const summary = byCategory.get(asset.categorySlug) ?? {
      assetCount: 0,
      categorySlug: asset.categorySlug,
      generatedCropCount: 0,
      preparedCarouselRenditionCount: 0,
      sourceLocalCategories: new Map(),
    };

    summary.assetCount += 1;
    summary.generatedCropCount += asset.generatedCrop ? 1 : 0;
    summary.preparedCarouselRenditionCount += asset.generatedCrop ? 0 : 1;
    summary.sourceLocalCategories.set(
      asset.sourceLocalCategorySlug,
      (summary.sourceLocalCategories.get(asset.sourceLocalCategorySlug) ?? 0) + 1,
    );
    byCategory.set(asset.categorySlug, summary);
  }

  return {
    assets: assets.length,
    categories: Array.from(byCategory.values()).map((category) => ({
      ...category,
      sourceLocalCategories: Object.fromEntries(
        category.sourceLocalCategories.entries(),
      ),
    })),
    errors: errors.length,
  };
}

function renderSummary(manifest) {
  const lines = [
    "# Local Carousel Image Import Package",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Tag manifest: ${manifest.input.tagManifestPath}`,
    "",
    "## Summary",
    "",
    `- Prepared assets: ${manifest.summary.assets}`,
    `- Errors: ${manifest.summary.errors}`,
    "",
    "## Runtime Categories",
    "",
    "| Runtime category | Assets | Existing 4:5 renditions | Generated crops | Source folders |",
    "|---|---:|---:|---:|---|",
  ];

  for (const category of manifest.summary.categories) {
    lines.push(
      `| ${category.categorySlug} | ${category.assetCount} | ${category.preparedCarouselRenditionCount} | ${category.generatedCropCount} | ${Object.entries(
        category.sourceLocalCategories,
      )
        .map(([sourceCategory, count]) => `${sourceCategory}: ${count}`)
        .join(", ")} |`,
    );
  }

  lines.push(
    "",
    "## Checkpoint",
    "",
    "- All prepared assets now have local 1080x1350 base webp files.",
    "- Existing carousel-ready 4:5 images were normalized to the same output format.",
    "- Flat and 9:16 inputs were center-cropped to 4:5.",
    "- This command does not upload to object storage and does not write to Supabase.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function renderCsv(assets) {
  const headers = [
    "assetKey",
    "categorySlug",
    "sourceLocalCategorySlug",
    "broadVisualBucket",
    "generatedCrop",
    "baseFile",
    "thumbFile",
    "originalFile",
    "baseObjectKey",
    "thumbObjectKey",
    "originalObjectKey",
  ];
  const rows = assets.map((asset) => [
    asset.assetKey,
    asset.categorySlug,
    asset.sourceLocalCategorySlug,
    asset.broadVisualBucket,
    String(asset.generatedCrop),
    asset.files.base,
    asset.files.thumb,
    asset.files.original,
    asset.storage.baseKey,
    asset.storage.thumbKey,
    asset.storage.originalKey,
  ]);

  return `${[headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

function resolveSourceFile(file) {
  const absolutePath = path.join(file.rootPath, file.relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Source file is missing: ${absolutePath}`);
  }

  return absolutePath;
}

function findLatestManifest(root, fileName) {
  const absoluteRoot = path.resolve(root);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Manifest root not found: ${absoluteRoot}`);
  }

  const latestDir = readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteRoot, entry.name))
    .sort()
    .at(-1);

  if (!latestDir) {
    throw new Error(`No manifest directories found under ${absoluteRoot}`);
  }

  const manifestPath = path.join(latestDir, fileName);

  if (!existsSync(manifestPath)) {
    throw new Error(`Latest manifest directory has no ${fileName}: ${latestDir}`);
  }

  return manifestPath;
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

function toRelativePath(filePath, rootPath) {
  return path.relative(rootPath, filePath).replaceAll("\\", "/");
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
