import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const RESULT_FILE_NAME = "import-result.json";
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const REQUIRED_ENV_VARS = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
  "CLOUDFRONT_DOMAIN",
  "SUPABASE_SERVICE_ROLE_KEY",
];

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

assertRequiredEnvVars(REQUIRED_ENV_VARS);
assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
assertCleanManifest(manifest);

const importPlan = buildImportPlan({ assets, manifestDir });
printPlan(importPlan, { dryRun, manifestPath });

if (dryRun) {
  console.log("");
  console.log("Dry run complete. No S3 upload or Supabase write was performed.");
  process.exit(0);
}

const s3 = new S3Client({
  credentials: {
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  },
  region: getRequiredEnv("AWS_REGION"),
});
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
  uploadedOnlyBeforeFailure: [],
};

try {
  await assertRemoteImportReady();

  for (const item of importPlan.items) {
    await importPreparedAsset(item);
  }

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

async function importPreparedAsset(item) {
  const existing = await findExistingCategoryImageAsset(item);

  if (existing) {
    console.log(`SKIP existing ${item.asset.assetKey}: ${existing.reason}`);
    result.skippedExisting.push({
      assetKey: item.asset.assetKey,
      existingId: existing.row.id,
      reason: existing.reason,
    });
    return;
  }

  console.log(`Uploading ${item.asset.assetKey}`);
  await putImageObject({
    contentType: "image/webp",
    filePath: item.files.basePath,
    key: item.asset.s3.baseKey,
  });
  await putImageObject({
    contentType: "image/webp",
    filePath: item.files.thumbPath,
    key: item.asset.s3.thumbKey,
  });
  await putImageObject({
    contentType: getImageContentType(item.files.originalPath),
    filePath: item.files.originalPath,
    key: item.asset.s3.originalKey,
  });

  result.uploadedOnlyBeforeFailure.push(item.asset.assetKey);

  const row = {
    ...item.asset.dbRow,
    base_url: buildCloudFrontUrl(item.asset.s3.baseKey),
    source_original_url: buildCloudFrontUrl(item.asset.s3.originalKey),
    thumb_url: buildCloudFrontUrl(item.asset.s3.thumbKey),
  };
  const { data, error } = await supabase
    .from("category_image_assets")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not insert ${item.asset.assetKey}: ${error.message}`);
  }

  result.inserted.push({
    assetKey: item.asset.assetKey,
    categorySlug: item.asset.categorySlug,
    id: data.id,
    sourceLocalCategorySlug: item.asset.sourceLocalCategorySlug,
  });
  result.uploadedOnlyBeforeFailure = result.uploadedOnlyBeforeFailure.filter(
    (assetKey) => assetKey !== item.asset.assetKey,
  );
}

async function findExistingCategoryImageAsset(item) {
  const byBaseKey = await findExistingRowBy("base_s3_key", item.asset.s3.baseKey);

  if (byBaseKey) {
    return {
      reason: `base_s3_key already exists (${item.asset.s3.baseKey})`,
      row: byBaseKey,
    };
  }

  const sourceHash = item.asset.dbRow.source_file_sha256;

  if (!sourceHash) {
    return null;
  }

  const { data, error } = await supabase
    .from("category_image_assets")
    .select("id,base_s3_key,category_slug,source_file_sha256,status")
    .eq("source_provider", "local")
    .eq("source_file_sha256", sourceHash)
    .limit(1);

  if (error) {
    throw new Error(
      `Could not check existing source hash for ${item.asset.assetKey}: ${error.message}`,
    );
  }

  return data?.[0]
    ? {
        reason: `source_file_sha256 already exists (${sourceHash})`,
        row: data[0],
      }
    : null;
}

async function findExistingRowBy(column, value) {
  const { data, error } = await supabase
    .from("category_image_assets")
    .select("id,base_s3_key,category_slug,source_file_sha256,status")
    .eq(column, value)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not check existing ${column}: ${error.message}`);
  }

  return data;
}

async function putImageObject({ contentType, filePath, key }) {
  await s3.send(
    new PutObjectCommand({
      Body: createReadStream(filePath),
      Bucket: getRequiredEnv("AWS_S3_BUCKET"),
      CacheControl: IMAGE_CACHE_CONTROL,
      ContentType: contentType,
      Key: key.replace(/^\//, ""),
    }),
  );
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

  if (row.base_s3_key !== asset.s3.baseKey) {
    throw new Error(`${asset.assetKey} has mismatched base S3 key.`);
  }

  if (row.thumb_s3_key !== asset.s3.thumbKey) {
    throw new Error(`${asset.assetKey} has mismatched thumb S3 key.`);
  }

  if (row.source_original_s3_key !== asset.s3.originalKey) {
    throw new Error(`${asset.assetKey} has mismatched original S3 key.`);
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

function buildCloudFrontUrl(key) {
  const cloudFrontDomain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(cloudFrontDomain)
    ? cloudFrontDomain
    : `https://${cloudFrontDomain}`;

  return `${domainWithScheme.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
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
