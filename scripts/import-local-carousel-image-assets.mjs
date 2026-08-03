import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  buildPublicStorageUrl as buildStoragePublicUrl,
  getMissingStorageEnvVars,
  getStorageProviderName,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const RESULT_FILE_NAME = "import-result.json";
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const REQUIRED_ENV_VARS = ["SUPABASE_SERVICE_ROLE_KEY"];
const INSERT_BATCH_SIZE = 25;
const QUERY_BATCH_SIZE = 100;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest || findLatestManifest(DEFAULT_IMPORT_ROOT, "import-manifest.json"),
);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const execute = Boolean(args.execute);
const dryRun = !execute || Boolean(args.dryRun);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to import without --yes. Run dry-run first, then use --execute --yes.",
  );
}

assertCleanManifest(manifest);

const importPlan = buildImportPlan({ assets, manifestDir });
printPlan(importPlan, { dryRun, manifestPath });

if (dryRun) {
  console.log("");
  console.log(
    "Dry run complete. No object-storage upload or Supabase write was performed.",
  );
  process.exit(0);
}

assertRequiredEnvVars(REQUIRED_ENV_VARS);
assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
assertGcpStorageReady();

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const result = {
  completedAt: null,
  inserted: [],
  manifestPath,
  skippedExisting: [],
  startedAt: new Date().toISOString(),
  storageProvider: getStorageProviderName(),
  uploadedOnlyBeforeFailure: [],
};

try {
  await assertRemoteImportReady();
  const pendingItems = await filterExistingAssets(importPlan.items);
  const preparedRows = await uploadPreparedAssets(pendingItems);
  await insertPreparedRows(preparedRows);

  result.completedAt = new Date().toISOString();
  writeResult(result);
  console.log("");
  console.log(`Imported ${result.inserted.length} local carousel image assets.`);
  console.log(`Skipped existing rows: ${result.skippedExisting.length}`);
  console.log(`Result: ${path.join(manifestDir, RESULT_FILE_NAME)}`);
} catch (error) {
  writeResult({
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function assertRemoteImportReady() {
  const requiredColumns = [
    "id",
    "asset_scope",
    "asset_variant",
    "base_s3_key",
    "base_url",
    "broad_visual_bucket",
    "bucket_taxonomy_version",
    "category_slug",
    "face_count",
    "has_human",
    "image_subject_class",
    "person_count",
    "runtime_exclusion_reason",
    "source_file_sha256",
    "source_original_s3_key",
    "source_original_url",
    "source_perceptual_hash",
    "source_provider",
    "subject_review_status",
    "thumb_s3_key",
    "thumb_url",
    "usable_profiles",
  ];
  const { error } = await supabase
    .from("category_image_assets")
    .select(requiredColumns.join(","))
    .limit(1);

  if (error) {
    throw new Error(
      `Remote category image schema is not ready for local imports: ${error.message}`,
    );
  }
}

async function filterExistingAssets(items) {
  const existingByBaseKey = new Map();
  const existingBySourceHash = new Map();
  const baseKeys = items.map((item) => item.asset.storage.baseKey);
  const sourceHashes = items
    .map((item) => item.asset.dbRow.source_file_sha256)
    .filter(Boolean);

  for (const chunk of chunkValues(baseKeys, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select("id,base_s3_key,category_slug,source_file_sha256,status")
      .in("base_s3_key", chunk);

    if (error) {
      throw new Error(`Could not check existing base storage keys: ${error.message}`);
    }

    for (const row of data ?? []) {
      existingByBaseKey.set(row.base_s3_key, row);
    }
  }

  for (const chunk of chunkValues(sourceHashes, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select("id,base_s3_key,category_slug,source_file_sha256,status")
      .eq("source_provider", "local")
      .in("source_file_sha256", chunk);

    if (error) {
      throw new Error(`Could not check existing source hashes: ${error.message}`);
    }

    for (const row of data ?? []) {
      existingBySourceHash.set(row.source_file_sha256, row);
    }
  }

  return items.filter((item) => {
    const existingByKey = existingByBaseKey.get(item.asset.storage.baseKey);
    const sourceHash = item.asset.dbRow.source_file_sha256;
    const existingByHash = sourceHash
      ? existingBySourceHash.get(sourceHash)
      : null;
    const existing = existingByKey ?? existingByHash;

    if (!existing) {
      return true;
    }

    const reason = existingByKey
      ? `legacy base object key already exists (${item.asset.storage.baseKey})`
      : `source_file_sha256 already exists (${sourceHash})`;

    console.log(`SKIP existing ${item.asset.assetKey}: ${reason}`);
    result.skippedExisting.push({
      assetKey: item.asset.assetKey,
      existingId: existing.id,
      reason,
    });
    return false;
  });
}

async function uploadPreparedAssets(items) {
  const preparedRows = [];

  for (const item of items) {
    console.log(`Uploading ${item.asset.assetKey} to GCP object storage`);
    await putImageObject({
      contentType: "image/webp",
      filePath: item.files.basePath,
      key: item.asset.storage.baseKey,
    });
    await putImageObject({
      contentType: "image/webp",
      filePath: item.files.thumbPath,
      key: item.asset.storage.thumbKey,
    });
    await putImageObject({
      contentType: getImageContentType(item.files.originalPath),
      filePath: item.files.originalPath,
      key: item.asset.storage.originalKey,
    });

    result.uploadedOnlyBeforeFailure.push(item.asset.assetKey);
    preparedRows.push({
      item,
      row: {
        ...item.asset.dbRow,
        base_url: buildStoragePublicUrl(item.asset.storage.baseKey),
        source_original_url: buildStoragePublicUrl(item.asset.storage.originalKey),
        thumb_url: buildStoragePublicUrl(item.asset.storage.thumbKey),
      },
    });
  }

  return preparedRows;
}

async function insertPreparedRows(preparedRows) {
  for (const batch of chunkValues(preparedRows, INSERT_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .insert(batch.map((entry) => entry.row))
      .select("id,base_s3_key,category_slug");

    if (error) {
      throw new Error(
        `Could not insert a batch of ${batch.length} category image assets: ${error.message}`,
      );
    }

    const insertedByBaseKey = new Map(
      (data ?? []).map((row) => [row.base_s3_key, row]),
    );

    for (const entry of batch) {
      const inserted = insertedByBaseKey.get(entry.item.asset.storage.baseKey);

      if (!inserted) {
        throw new Error(
          `Supabase did not return the inserted row for ${entry.item.asset.assetKey}.`,
        );
      }

      result.inserted.push({
        assetKey: entry.item.asset.assetKey,
        categorySlug: entry.item.asset.categorySlug,
        id: inserted.id,
        sourceLocalCategorySlug: entry.item.asset.sourceLocalCategorySlug,
      });
      result.uploadedOnlyBeforeFailure =
        result.uploadedOnlyBeforeFailure.filter(
          (assetKey) => assetKey !== entry.item.asset.assetKey,
        );
    }
  }
}

async function putImageObject({ contentType, filePath, key }) {
  await uploadBufferToStorage({
    buffer: readFileSync(filePath),
    cacheControl: IMAGE_CACHE_CONTROL,
    contentType,
    key: key.replace(/^\//, ""),
  });
}

function chunkValues(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function buildImportPlan({ assets, manifestDir }) {
  if (assets.length === 0) {
    throw new Error("Import manifest has no assets.");
  }

  const items = assets.map((asset) => {
    assertAssetReadyForImport(asset);

    const files = {
      basePath: resolveManifestFile(manifestDir, asset.files.base),
      originalPath: resolveManifestFile(manifestDir, asset.files.original),
      thumbPath: resolveManifestFile(manifestDir, asset.files.thumb),
    };

    return {
      asset,
      files,
    };
  });

  return {
    categories: summarizeCategories(items.map((item) => item.asset)),
    items,
  };
}

function assertCleanManifest(manifest) {
  if (manifest.errors?.length > 0) {
    throw new Error(
      `Import manifest has ${manifest.errors.length} errors. Fix preparation before importing.`,
    );
  }
}

function assertAssetReadyForImport(asset) {
  const row = asset.dbRow ?? {};
  const requiredRowFields = [
    "base_s3_key",
    "category_slug",
    "source_file_sha256",
    "source_original_s3_key",
    "source_perceptual_hash",
    "source_provider",
    "status",
    "subject_review_status",
    "thumb_s3_key",
  ];
  const missingFields = requiredRowFields.filter((field) => !row[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `${asset.assetKey} is missing DB fields: ${missingFields.join(", ")}`,
    );
  }

  if (row.category_slug !== asset.categorySlug) {
    throw new Error(`${asset.assetKey} has mismatched runtime category.`);
  }

  if (row.base_s3_key !== asset.storage.baseKey) {
    throw new Error(`${asset.assetKey} has mismatched base object key.`);
  }

  if (row.thumb_s3_key !== asset.storage.thumbKey) {
    throw new Error(`${asset.assetKey} has mismatched thumb object key.`);
  }

  if (row.source_original_s3_key !== asset.storage.originalKey) {
    throw new Error(`${asset.assetKey} has mismatched original object key.`);
  }

  if (
    row.status !== "ready" ||
    row.subject_review_status !== "approved" ||
    row.image_subject_class !== "object-only" ||
    row.has_human !== false ||
    row.face_count !== 0 ||
    row.person_count !== 0 ||
    row.runtime_exclusion_reason !== null
  ) {
    throw new Error(
      `${asset.assetKey} is not marked as strict approved object-only inventory.`,
    );
  }
}

function resolveManifestFile(manifestDir, relativePath) {
  const filePath = path.resolve(manifestDir, relativePath);

  if (!filePath.startsWith(`${manifestDir}${path.sep}`)) {
    throw new Error(`Manifest file path escapes import directory: ${relativePath}`);
  }

  if (!existsSync(filePath)) {
    throw new Error(`Prepared file does not exist: ${filePath}`);
  }

  const stats = statSync(filePath);

  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`Prepared file is empty or not a file: ${filePath}`);
  }

  return filePath;
}

function summarizeCategories(assets) {
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

function printPlan(plan, { dryRun, manifestPath }) {
  console.log("Local carousel image import plan");
  console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Assets: ${plan.items.length}`);
  console.log("");

  for (const category of plan.categories) {
    console.log(
      `${category.categorySlug}: ${category.assetCount} assets from ${formatObject(
        category.sourceLocalCategories,
      )}; buckets ${formatObject(category.buckets)}`,
    );
  }
}

function writeResult(value) {
  const resultPath = path.join(manifestDir, RESULT_FILE_NAME);

  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertGcpStorageReady() {
  const storageProviderName = getStorageProviderName();

  if (storageProviderName !== "gcp") {
    throw new Error(
      `This reviewed Carousel import is approved for GCP storage only. Set STORAGE_PROVIDER=gcp; current provider is ${storageProviderName}.`,
    );
  }

  const missing = getMissingStorageEnvVars();

  if (missing.length > 0) {
    throw new Error(
      `Missing required GCP storage configuration: ${missing.join(", ")}`,
    );
  }
}

function getImageContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
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

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key]) {
      continue;
    }

    process.env[key] = cleanEnvValue(rawValue);
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

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}

function assertRequiredEnvVars(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function assertOneRequiredEnvVar(names) {
  if (!names.some((name) => process.env[name]?.trim())) {
    throw new Error(`Missing required env var: ${names.join(" or ")}`);
  }
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
