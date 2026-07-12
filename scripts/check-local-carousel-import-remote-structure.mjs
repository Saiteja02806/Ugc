import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const RESULT_FILE_NAME = "remote-structure-check.json";
const REQUIRED_RUNTIME_CATEGORIES = [
  "fitness-health",
  "personal-finance",
  "productivity-saas",
];
const SAMPLE_SOURCE_CATEGORIES = [
  "fitness-health",
  "marketing-saas",
  "personal-finance",
  "productivity-saas",
  "shared",
];
const REQUIRED_COLUMNS = [
  "id",
  "asset_scope",
  "asset_variant",
  "base_s3_key",
  "base_url",
  "best_for_slide_types",
  "broad_visual_bucket",
  "bucket_taxonomy_version",
  "category_slug",
  "content_tags",
  "face_count",
  "has_human",
  "height",
  "image_subject_class",
  "mood_tags",
  "near_duplicate_group",
  "object_tags",
  "orientation",
  "person_count",
  "quality_score",
  "runtime_exclusion_reason",
  "source_file_sha256",
  "source_filename",
  "source_folder",
  "source_metadata",
  "source_original_s3_key",
  "source_original_url",
  "source_perceptual_hash",
  "source_provider",
  "source_query",
  "status",
  "subject_analysis",
  "subject_analyzed_at",
  "subject_analyzer_version",
  "subject_review_status",
  "thumb_s3_key",
  "thumb_url",
  "usable_profiles",
  "visual_setting",
  "visual_style",
  "visual_keywords",
  "width",
];

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest || findLatestManifest(DEFAULT_IMPORT_ROOT, "import-manifest.json"),
);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];

assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
assertRequiredEnvVars(["SUPABASE_SERVICE_ROLE_KEY"]);

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

const report = {
  checkedAt: new Date().toISOString(),
  duplicateChecks: null,
  existingSamples: [],
  importedCategoryPlan: summarizeAssets(assets),
  manifestPath,
  ok: false,
  schema: null,
  strictExistingCounts: [],
};

const errors = [];

await checkRemoteSchema();
await checkExistingStructure();
await checkPotentialDuplicates();
await checkStrictCounts();

report.ok = errors.length === 0;
report.errors = errors;

const resultPath = path.join(manifestDir, RESULT_FILE_NAME);
writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("Local carousel remote structure check");
console.log(`Manifest: ${manifestPath}`);
console.log(`Result: ${resultPath}`);
console.log("");

for (const category of report.importedCategoryPlan) {
  console.log(
    `Prepared ${category.categorySlug}: ${category.assetCount} assets; buckets ${formatObject(
      category.buckets,
    )}`,
  );
}

console.log("");
for (const item of report.strictExistingCounts) {
  console.log(
    `Existing strict approved ${item.categorySlug}: ${item.count} assets across ${formatObject(
      item.buckets,
    )}`,
  );
}

console.log("");

if (errors.length > 0) {
  console.log(`FAILED: ${errors.length} issue(s) found.`);
  for (const error of errors) {
    console.log(`- ${error}`);
  }
  process.exit(1);
}

console.log("OK: remote schema, existing row shape, and duplicate checks are ready.");

async function checkRemoteSchema() {
  const { data, error } = await supabase
    .from("category_image_assets")
    .select(REQUIRED_COLUMNS.join(","))
    .limit(1);

  if (error) {
    errors.push(`Remote schema is missing required columns: ${error.message}`);
    report.schema = { ok: false, message: error.message };
    return;
  }

  report.schema = {
    ok: true,
    sampleRowReturned: Array.isArray(data) && data.length > 0,
  };
}

async function checkExistingStructure() {
  const { data, error } = await supabase
    .from("category_image_assets")
    .select(REQUIRED_COLUMNS.join(","))
    .in("category_slug", SAMPLE_SOURCE_CATEGORIES)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    errors.push(`Could not read existing category image rows: ${error.message}`);
    return;
  }

  report.existingSamples = (data ?? []).map((row) => ({
    assetScope: row.asset_scope,
    assetVariant: row.asset_variant,
    baseS3Key: row.base_s3_key,
    broadVisualBucket: row.broad_visual_bucket,
    bucketTaxonomyVersion: row.bucket_taxonomy_version,
    categorySlug: row.category_slug,
    hasBaseUrl: Boolean(row.base_url),
    hasThumbUrl: Boolean(row.thumb_url),
    imageSubjectClass: row.image_subject_class,
    sourceProvider: row.source_provider,
    status: row.status,
    subjectReviewStatus: row.subject_review_status,
  }));

  for (const row of data ?? []) {
    if (!row.base_s3_key?.startsWith("category-library/")) {
      errors.push(`Existing row ${row.id} has unexpected base_s3_key: ${row.base_s3_key}`);
    }

    if (row.base_url && !row.base_url.includes(row.base_s3_key)) {
      errors.push(`Existing row ${row.id} base_url does not contain base_s3_key.`);
    }

    if (row.thumb_s3_key && row.thumb_url && !row.thumb_url.includes(row.thumb_s3_key)) {
      errors.push(`Existing row ${row.id} thumb_url does not contain thumb_s3_key.`);
    }
  }
}

async function checkPotentialDuplicates() {
  const baseKeys = assets.map((asset) => asset.s3.baseKey);
  const sourceHashes = assets
    .map((asset) => asset.dbRow?.source_file_sha256)
    .filter(Boolean);
  const existingBaseKeyRows = await queryExistingValues({
    column: "base_s3_key",
    values: baseKeys,
  });
  const existingHashRows = await queryExistingValues({
    column: "source_file_sha256",
    values: sourceHashes,
  });

  report.duplicateChecks = {
    existingBaseKeyRows,
    existingHashRows,
    importedBaseKeys: baseKeys.length,
    importedSourceHashes: sourceHashes.length,
  };

  if (existingBaseKeyRows.length > 0) {
    errors.push(`${existingBaseKeyRows.length} prepared base S3 keys already exist remotely.`);
  }

  if (existingHashRows.length > 0) {
    errors.push(`${existingHashRows.length} prepared source hashes already exist remotely.`);
  }
}

async function checkStrictCounts() {
  for (const categorySlug of REQUIRED_RUNTIME_CATEGORIES) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select("broad_visual_bucket")
      .eq("category_slug", categorySlug)
      .eq("status", "ready")
      .eq("subject_review_status", "approved")
      .eq("image_subject_class", "object-only")
      .eq("has_human", false)
      .eq("face_count", 0)
      .eq("person_count", 0)
      .is("runtime_exclusion_reason", null);

    if (error) {
      errors.push(`Could not count strict approved rows for ${categorySlug}: ${error.message}`);
      continue;
    }

    const buckets = {};

    for (const row of data ?? []) {
      const bucket = row.broad_visual_bucket ?? "missing";
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }

    report.strictExistingCounts.push({
      buckets,
      categorySlug,
      count: data?.length ?? 0,
    });
  }
}

async function queryExistingValues({ column, values }) {
  const rows = [];
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));

  for (let index = 0; index < uniqueValues.length; index += 100) {
    const chunk = uniqueValues.slice(index, index + 100);
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(`id,category_slug,${column}`)
      .in(column, chunk);

    if (error) {
      errors.push(`Could not check existing ${column}: ${error.message}`);
      continue;
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

function summarizeAssets(assets) {
  const byCategory = new Map();

  for (const asset of assets) {
    const summary = byCategory.get(asset.categorySlug) ?? {
      assetCount: 0,
      buckets: new Map(),
      categorySlug: asset.categorySlug,
    };

    summary.assetCount += 1;
    summary.buckets.set(
      asset.broadVisualBucket,
      (summary.buckets.get(asset.broadVisualBucket) ?? 0) + 1,
    );
    byCategory.set(asset.categorySlug, summary);
  }

  return Array.from(byCategory.values()).map((summary) => ({
    ...summary,
    buckets: Object.fromEntries(summary.buckets.entries()),
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
