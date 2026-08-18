import { createClient } from "@supabase/supabase-js";
import { Storage } from "@google-cloud/storage";
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";
import {
  getMissingStorageEnvVars,
  headStorageObject,
  isTrustedStorageUrl,
} from "../lib/storage/storage.ts";
import {
  CAROUSEL_LIBRARY_CATEGORIES,
  CAROUSEL_LIBRARY_ROLES,
  assertCarouselRolePoolMinimums,
  summarizeCarouselRoleAssets,
} from "./carousel-role-library.mjs";

const DEFAULT_ROOT = ".tmp/carousel-role-library";
const MANIFEST_FILE_NAME = "role-library-manifest.json";
const RESULT_FILE_NAME = "role-library-verification.json";
const QUERY_CHUNK_SIZE = 100;
const REMOTE_REQUEST_TIMEOUT_MS = 30_000;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest || findLatestManifest(DEFAULT_ROOT, MANIFEST_FILE_NAME),
);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const samplesPerPool = parsePositiveInteger(args["samples-per-pool"], 1);
const errors = [];

if (assets.length === 0) {
  throw new Error("Role-library manifest has no assets.");
}

requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const missingStorage = getMissingStorageEnvVars();
if (missingStorage.length > 0) {
  throw new Error(`Missing GCP storage configuration: ${missingStorage.join(", ")}`);
}

const supabase = createClient(
  requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  },
);
const rows = [];
const inventoryCounts = await readInventoryCounts();
const storageInventory = await readStorageInventory(assets);

if (inventoryCounts.activeSharedRoleRows !== assets.length) {
  errors.push(
    `Active shared role inventory has ${inventoryCounts.activeSharedRoleRows} rows, expected ${assets.length}.`,
  );
}

if (inventoryCounts.legacyNonRoleRows !== 0) {
  errors.push(
    `Old/non-role category image rows remain: ${inventoryCounts.legacyNonRoleRows}.`,
  );
}

if (inventoryCounts.inactiveRoleRows !== 0) {
  errors.push(
    `Inactive role-library rows remain: ${inventoryCounts.inactiveRoleRows}.`,
  );
}

if (storageInventory.missingKeys.length > 0) {
  errors.push(
    `GCP is missing ${storageInventory.missingKeys.length} manifest object(s); first: ${storageInventory.missingKeys[0]}.`,
  );
}

if (storageInventory.unexpectedKeys.length > 0) {
  errors.push(
    `Old/unexpected Carousel objects remain in GCP: ${storageInventory.unexpectedKeys.length}; first: ${storageInventory.unexpectedKeys[0]}.`,
  );
}

for (const chunk of chunkValues(
  assets.map((asset) => asset.libraryAssetId),
  QUERY_CHUNK_SIZE,
)) {
  const { data, error } = await supabase
    .from("category_image_assets")
    .select(
      "id,asset_role,base_s3_key,base_url,category_slug,is_active,library_asset_id,owner_business_profile_id,runtime_exclusion_reason,source_file_sha256,source_original_s3_key,source_original_url,status,subject_review_status,thumb_s3_key,thumb_url",
    )
    .in("library_asset_id", chunk);

  if (error) {
    throw new Error(`Could not fetch role-library rows: ${error.message}`);
  }
  rows.push(...(data ?? []));
}

const rowsByLibraryId = new Map(rows.map((row) => [row.library_asset_id, row]));
const databaseAssets = [];
const sourceHashes = new Set();

for (const asset of assets) {
  const row = rowsByLibraryId.get(asset.libraryAssetId);

  if (!row) {
    errors.push(`${asset.libraryAssetId}: missing database row`);
    continue;
  }

  databaseAssets.push({ category: row.category_slug, role: row.asset_role });
  const checks = {
    asset_role: asset.role,
    base_s3_key: asset.storage.baseKey,
    category_slug: asset.category,
    is_active: true,
    owner_business_profile_id: null,
    runtime_exclusion_reason: null,
    source_file_sha256: asset.dbRow.source_file_sha256,
    source_original_s3_key: asset.storage.originalKey,
    status: "ready",
    subject_review_status: "approved",
    thumb_s3_key: asset.storage.thumbKey,
  };

  for (const [field, expected] of Object.entries(checks)) {
    if (row[field] !== expected) {
      errors.push(
        `${asset.libraryAssetId}: ${field} expected ${String(expected)}, received ${String(row[field])}`,
      );
    }
  }

  if (sourceHashes.has(row.source_file_sha256)) {
    errors.push(`${asset.libraryAssetId}: duplicate source SHA-256 in database result`);
  }
  sourceHashes.add(row.source_file_sha256);

  for (const [field, url] of [
    ["base_url", row.base_url],
    ["thumb_url", row.thumb_url],
    ["source_original_url", row.source_original_url],
  ]) {
    if (!url || !isTrustedStorageUrl(url)) {
      errors.push(`${asset.libraryAssetId}: ${field} is not a trusted GCP URL`);
    }
  }
}

const expectedSummary = summarizeCarouselRoleAssets(assets);
const actualSummary = summarizeCarouselRoleAssets(databaseAssets);

try {
  assertCarouselRolePoolMinimums(actualSummary);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (JSON.stringify(actualSummary) !== JSON.stringify(expectedSummary)) {
  errors.push("Database category/role counts do not match the manifest.");
}

const storageSamples = selectStorageSamples(assets, samplesPerPool);
const storageChecks = [];

await runWithConcurrency(storageSamples, 6, async (sample) => {
  for (const [rendition, key] of Object.entries(sample.storage)) {
    try {
      const metadata = await headStorageObject({ key });
      storageChecks.push({
        key,
        libraryAssetId: sample.libraryAssetId,
        ok: Boolean(metadata),
        rendition,
      });
      if (!metadata) {
        errors.push(`${sample.libraryAssetId}: missing ${rendition} object ${key}`);
      }
    } catch (error) {
      storageChecks.push({
        error: error instanceof Error ? error.message : String(error),
        key,
        libraryAssetId: sample.libraryAssetId,
        ok: false,
        rendition,
      });
      errors.push(`${sample.libraryAssetId}: ${rendition} object check failed`);
    }
  }
});

const verification = {
  actualSummary,
  checkedAt: new Date().toISOString(),
  errors,
  expectedSummary,
  inventoryCounts,
  manifestPath,
  rowCount: rows.length,
  storageInventory,
  storageChecks,
  success: errors.length === 0,
};
const resultPath = path.join(manifestDir, RESULT_FILE_NAME);
writeFileSync(resultPath, `${JSON.stringify(verification, null, 2)}\n`);

console.log("Carousel role-library verification");
console.log(`Manifest assets: ${assets.length}`);
console.log(`Database rows: ${rows.length}`);
console.log(`All category image rows: ${inventoryCounts.totalRows}`);
console.log(`Old/non-role rows: ${inventoryCounts.legacyNonRoleRows}`);
console.log(`Carousel GCP objects: ${storageInventory.actualObjectCount}`);
console.log(`Old/unexpected GCP objects: ${storageInventory.unexpectedKeys.length}`);
console.log(`Storage objects sampled: ${storageChecks.length}`);
for (const category of CAROUSEL_LIBRARY_CATEGORIES) {
  const counts = actualSummary.byCategoryRole[category];
  console.log(
    `${category}: hook ${counts.hook}, human ${counts.human}, static ${counts.static}`,
  );
}
console.log(`Errors: ${errors.length}`);
console.log(`Result: ${resultPath}`);

if (errors.length > 0) {
  for (const error of errors.slice(0, 20)) console.error(`- ${error}`);
  process.exitCode = 1;
}

async function readInventoryCounts() {
  const countQueries = await Promise.all([
    supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true })
      .is("asset_role", null),
    supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true })
      .in("asset_role", ["hook", "human", "static"])
      .eq("is_active", false),
    supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true })
      .in("asset_role", ["hook", "human", "static"])
      .eq("is_active", true)
      .is("owner_business_profile_id", null),
    supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true })
      .eq("asset_role", "product_asset"),
  ]);

  for (const result of countQueries) {
    if (result.error) {
      throw new Error(`Could not audit role-library inventory: ${result.error.message}`);
    }
  }

  return {
    activeSharedRoleRows: countQueries[3].count ?? 0,
    inactiveRoleRows: countQueries[2].count ?? 0,
    legacyNonRoleRows: countQueries[1].count ?? 0,
    productAssetRows: countQueries[4].count ?? 0,
    totalRows: countQueries[0].count ?? 0,
  };
}

async function readStorageInventory(items) {
  const credentials = getGoogleServiceAccountCredentials();
  const projectId =
    process.env.GCP_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    credentials?.project_id;
  const bucketName = requiredEnv(
    "GCP_STORAGE_BUCKET",
    "GOOGLE_CLOUD_STORAGE_BUCKET",
  );
  const storage = new Storage({
    ...(credentials ? { credentials } : {}),
    ...(projectId ? { projectId } : {}),
  });
  const [files] = await storage.bucket(bucketName).getFiles({
    prefix: "category-library/",
  });
  const actualKeys = new Set(files.map((file) => file.name));
  const expectedKeys = new Set(
    items.flatMap((asset) => Object.values(asset.storage ?? {})),
  );

  return {
    actualObjectCount: actualKeys.size,
    expectedObjectCount: expectedKeys.size,
    missingKeys: Array.from(expectedKeys)
      .filter((key) => !actualKeys.has(key))
      .sort(),
    unexpectedKeys: Array.from(actualKeys)
      .filter((key) => !expectedKeys.has(key))
      .sort(),
  };
}

function selectStorageSamples(items, perPool) {
  const selected = [];

  for (const category of CAROUSEL_LIBRARY_CATEGORIES) {
    for (const role of CAROUSEL_LIBRARY_ROLES) {
      selected.push(
        ...items
          .filter((asset) => asset.category === category && asset.role === role)
          .slice(0, perPool),
      );
    }
  }

  return selected;
}

async function runWithConcurrency(values, maximum, callback) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await callback(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(maximum, values.length) }, () => worker()),
  );
}

function findLatestManifest(root, fileName) {
  const absoluteRoot = path.resolve(root);
  const latestDirectory = readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteRoot, entry.name))
    .sort()
    .at(-1);
  if (!latestDirectory) throw new Error(`No role-library build under ${absoluteRoot}.`);
  const filePath = path.join(latestDirectory, fileName);
  if (!existsSync(filePath)) throw new Error(`Missing ${fileName}: ${latestDirectory}`);
  return filePath;
}

function chunkValues(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${String(value)}`);
  }
  return parsed;
}

function requiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || line.trim().startsWith("#") || process.env[match[1]]) continue;
    const raw = match[2].trim();
    process.env[match[1]] =
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function fetchWithTimeout(input, init = {}) {
  const timeout = AbortSignal.timeout(REMOTE_REQUEST_TIMEOUT_MS);
  const signal =
    init.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([init.signal, timeout])
      : init.signal || timeout;
  return fetch(input, { ...init, signal });
}
