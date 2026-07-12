import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1350;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 400;

const SOURCE_CATEGORY_RUNTIME_MAP = {
  calorie_tracking: "fitness-health",
  gym: "fitness-health",
  personal_finance: "personal-finance",
  productivity: "productivity-saas",
};

const ALLOWED_BUCKETS_BY_RUNTIME_CATEGORY = {
  "fitness-health": new Set([
    "abstract-backgrounds",
    "fitness-wellness-objects",
    "food-and-table",
    "home-lifestyle",
    "phone-and-devices",
    "product-still-life",
  ]),
  "personal-finance": new Set([
    "abstract-backgrounds",
    "clean-texture-backgrounds",
    "data-and-screens",
    "home-lifestyle",
    "notes-and-planning",
    "phone-and-devices",
    "workspace-objects",
  ]),
  "productivity-saas": new Set([
    "abstract-backgrounds",
    "data-and-screens",
    "home-lifestyle",
    "notes-and-planning",
    "phone-and-devices",
    "workspace-objects",
  ]),
};

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest || findLatestManifest(DEFAULT_IMPORT_ROOT, "import-manifest.json"),
);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const errors = [];
const seenAssetKeys = new Set();
const seenBaseS3Keys = new Set();
const seenSourceHashes = new Set();

for (const asset of assets) {
  await checkAsset(asset);
}

if (manifest.errors?.length > 0) {
  errors.push(`Import manifest has ${manifest.errors.length} preparation errors.`);
}

const summary = summarizeAssets(assets);

console.log("Local carousel image import checkpoint");
console.log(`Manifest: ${manifestPath}`);
console.log(`Assets checked: ${assets.length}`);
console.log("");
for (const category of summary) {
  console.log(
    `${category.categorySlug}: ${category.assetCount} assets; buckets ${formatObject(
      category.buckets,
    )}; sources ${formatObject(category.sourceLocalCategories)}`,
  );
}
console.log("");

if (errors.length > 0) {
  console.log(`FAILED: ${errors.length} issue(s) found.`);
  for (const error of errors.slice(0, 30)) {
    console.log(`- ${error}`);
  }

  if (errors.length > 30) {
    console.log(`- ...and ${errors.length - 30} more`);
  }

  process.exit(1);
}

console.log("OK: tags, runtime categories, safety fields, S3 keys, and image dimensions are valid.");

async function checkAsset(asset) {
  const expectedRuntimeCategory =
    SOURCE_CATEGORY_RUNTIME_MAP[asset.sourceLocalCategorySlug];

  if (!expectedRuntimeCategory) {
    errors.push(`${asset.assetKey}: unknown source category ${asset.sourceLocalCategorySlug}`);
  } else if (asset.categorySlug !== expectedRuntimeCategory) {
    errors.push(
      `${asset.assetKey}: expected runtime category ${expectedRuntimeCategory}, got ${asset.categorySlug}`,
    );
  }

  const allowedBuckets = ALLOWED_BUCKETS_BY_RUNTIME_CATEGORY[asset.categorySlug];

  if (!allowedBuckets?.has(asset.broadVisualBucket)) {
    errors.push(
      `${asset.assetKey}: broad bucket ${asset.broadVisualBucket} is not allowed for ${asset.categorySlug}`,
    );
  }

  checkUnique(seenAssetKeys, asset.assetKey, `${asset.assetKey}: duplicate assetKey`);
  checkUnique(
    seenBaseS3Keys,
    asset.s3?.baseKey,
    `${asset.assetKey}: duplicate base S3 key ${asset.s3?.baseKey}`,
  );
  checkUnique(
    seenSourceHashes,
    asset.dbRow?.source_file_sha256,
    `${asset.assetKey}: duplicate source hash ${asset.dbRow?.source_file_sha256}`,
  );

  checkDbRow(asset);
  await checkImageDimensions({
    assetKey: asset.assetKey,
    expectedHeight: BASE_HEIGHT,
    expectedWidth: BASE_WIDTH,
    label: "base",
    manifestDir,
    relativePath: asset.files?.base,
  });
  await checkImageDimensions({
    assetKey: asset.assetKey,
    expectedHeight: THUMB_HEIGHT,
    expectedWidth: THUMB_WIDTH,
    label: "thumb",
    manifestDir,
    relativePath: asset.files?.thumb,
  });
}

function checkDbRow(asset) {
  const row = asset.dbRow ?? {};
  const strictSafetyFields = {
    face_count: 0,
    has_human: false,
    image_subject_class: "object-only",
    person_count: 0,
    runtime_exclusion_reason: null,
    status: "ready",
    subject_review_status: "approved",
  };

  for (const [field, expected] of Object.entries(strictSafetyFields)) {
    if (row[field] !== expected) {
      errors.push(`${asset.assetKey}: dbRow.${field} must be ${String(expected)}`);
    }
  }

  if (row.category_slug !== asset.categorySlug) {
    errors.push(`${asset.assetKey}: dbRow category does not match asset category.`);
  }

  if (row.base_s3_key !== asset.s3?.baseKey) {
    errors.push(`${asset.assetKey}: dbRow base key does not match asset S3 key.`);
  }

  if (row.thumb_s3_key !== asset.s3?.thumbKey) {
    errors.push(`${asset.assetKey}: dbRow thumb key does not match asset S3 key.`);
  }

  if (row.source_original_s3_key !== asset.s3?.originalKey) {
    errors.push(`${asset.assetKey}: dbRow original key does not match asset S3 key.`);
  }
}

async function checkImageDimensions({
  assetKey,
  expectedHeight,
  expectedWidth,
  label,
  manifestDir,
  relativePath,
}) {
  const filePath = path.resolve(manifestDir, relativePath ?? "");

  if (!filePath.startsWith(`${manifestDir}${path.sep}`) || !existsSync(filePath)) {
    errors.push(`${assetKey}: missing prepared ${label} file ${relativePath}`);
    return;
  }

  const metadata = await sharp(filePath).metadata();

  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    errors.push(
      `${assetKey}: ${label} dimensions must be ${expectedWidth}x${expectedHeight}, got ${metadata.width}x${metadata.height}`,
    );
  }
}

function checkUnique(seen, value, message) {
  if (!value) {
    errors.push(message.replace("duplicate", "missing"));
    return;
  }

  if (seen.has(value)) {
    errors.push(message);
    return;
  }

  seen.add(value);
}

function summarizeAssets(assets) {
  const byCategory = new Map();

  for (const asset of assets) {
    const summary = byCategory.get(asset.categorySlug) ?? {
      assetCount: 0,
      buckets: new Map(),
      categorySlug: asset.categorySlug,
      sourceLocalCategories: new Map(),
    };

    summary.assetCount += 1;
    summary.buckets.set(
      asset.broadVisualBucket,
      (summary.buckets.get(asset.broadVisualBucket) ?? 0) + 1,
    );
    summary.sourceLocalCategories.set(
      asset.sourceLocalCategorySlug,
      (summary.sourceLocalCategories.get(asset.sourceLocalCategorySlug) ?? 0) + 1,
    );
    byCategory.set(asset.categorySlug, summary);
  }

  return Array.from(byCategory.values()).map((summary) => ({
    ...summary,
    buckets: Object.fromEntries(summary.buckets.entries()),
    sourceLocalCategories: Object.fromEntries(
      summary.sourceLocalCategories.entries(),
    ),
  }));
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

  const latestManifestPath = path.join(latestDir, fileName);

  if (!existsSync(latestManifestPath)) {
    throw new Error(`Latest manifest directory has no ${fileName}: ${latestDir}`);
  }

  return latestManifestPath;
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

function formatObject(value) {
  return Object.entries(value)
    .map(([key, count]) => `${key}: ${count}`)
    .join(", ");
}
