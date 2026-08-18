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
  buildPublicStorageUrl,
  getMissingStorageEnvVars,
  getStorageProviderName,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";
import {
  assertCarouselRolePoolMinimums,
  summarizeCarouselRoleAssets,
} from "./carousel-role-library.mjs";

const DEFAULT_IMPORT_ROOT = ".tmp/carousel-role-library";
const MANIFEST_FILE_NAME = "role-library-manifest.json";
const RESULT_FILE_NAME = "role-library-import-result.json";
const CHECKPOINT_SIZE = 10;
const QUERY_CHUNK_SIZE = 100;
const UPLOAD_CONCURRENCY = 3;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const REMOTE_REQUEST_TIMEOUT_MS = 30_000;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const dryRun = !execute || Boolean(args["dry-run"]);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to import without --yes. Run the dry-run first, then use --execute --yes.",
  );
}

const manifestPath = path.resolve(
  args.manifest || findLatestManifest(DEFAULT_IMPORT_ROOT, MANIFEST_FILE_NAME),
);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = validateManifest(manifest, manifestDir);
const summary = summarizeCarouselRoleAssets(assets);

console.log("Carousel role-library import");
console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Assets: ${assets.length}`);
printSummary(summary);

if (dryRun) {
  console.log("");
  console.log("Dry run complete. No storage or database write was performed.");
  process.exit(0);
}

assertEnvironmentReady();

const supabase = createClient(
  requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
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
  await assertRemoteSchemaReady();
  const pending = await determinePendingAssets(assets);

  console.log(`Pending inserts: ${pending.length}`);
  console.log(`Resume-safe existing rows: ${result.skippedExisting.length}`);

  const checkpoints = chunkValues(pending, CHECKPOINT_SIZE);

  for (let index = 0; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index];
    const preparedRows = await uploadCheckpoint(checkpoint);
    await insertCheckpoint(preparedRows);
    writeResult({
      ...result,
      checkpointedAt: new Date().toISOString(),
      pendingAssets: Math.max(
        pending.length - (index + 1) * CHECKPOINT_SIZE,
        0,
      ),
    });
    console.log(
      `Checkpoint ${index + 1}/${checkpoints.length}: ${result.inserted.length} inserted`,
    );
  }

  result.completedAt = new Date().toISOString();
  writeResult(result);
  console.log("");
  console.log(`Inserted: ${result.inserted.length}`);
  console.log(`Skipped existing: ${result.skippedExisting.length}`);
  console.log(`Result: ${path.join(manifestDir, RESULT_FILE_NAME)}`);
} catch (error) {
  writeResult({
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function assertRemoteSchemaReady() {
  const requiredColumns = [
    "asset_role",
    "base_s3_key",
    "base_url",
    "category_slug",
    "is_active",
    "library_asset_id",
    "owner_business_profile_id",
    "source_file_sha256",
    "status",
    "subject_review_status",
  ];
  const { error } = await supabase
    .from("category_image_assets")
    .select(requiredColumns.join(","))
    .limit(1);

  if (error) {
    throw new Error(
      `Remote schema is not ready for the role library: ${error.message}`,
    );
  }
}

async function determinePendingAssets(items) {
  const existingRows = new Map();
  const lookupFields = [
    ["library_asset_id", items.map((asset) => asset.libraryAssetId)],
    ["base_s3_key", items.map((asset) => asset.storage.baseKey)],
    [
      "source_file_sha256",
      items.map((asset) => asset.dbRow.source_file_sha256),
    ],
  ];

  for (const [field, values] of lookupFields) {
    for (const chunk of chunkValues(values, QUERY_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("category_image_assets")
        .select(
          "id,asset_role,base_s3_key,category_slug,is_active,library_asset_id,source_file_sha256,status,subject_review_status,thumb_s3_key,source_original_s3_key",
        )
        .in(field, chunk);

      if (error) {
        throw new Error(`Could not check existing ${field} values: ${error.message}`);
      }

      for (const row of data ?? []) {
        existingRows.set(row.id, row);
      }
    }
  }

  const rowsByLibraryId = new Map();
  const rowsByBaseKey = new Map();
  const rowsByHash = new Map();

  for (const row of existingRows.values()) {
    if (row.library_asset_id) rowsByLibraryId.set(row.library_asset_id, row);
    if (row.base_s3_key) rowsByBaseKey.set(row.base_s3_key, row);
    if (row.source_file_sha256) rowsByHash.set(row.source_file_sha256, row);
  }

  return items.filter((asset) => {
    const exact = rowsByLibraryId.get(asset.libraryAssetId);

    if (exact) {
      assertExistingRowMatches(asset, exact);
      result.skippedExisting.push({
        id: exact.id,
        libraryAssetId: asset.libraryAssetId,
        reason: "exact library asset already imported",
      });
      return false;
    }

    const collision =
      rowsByBaseKey.get(asset.storage.baseKey) ??
      rowsByHash.get(asset.dbRow.source_file_sha256);

    if (collision) {
      throw new Error(
        `${asset.libraryAssetId} collides with existing row ${collision.id} without the same library_asset_id. Stop and inspect before importing.`,
      );
    }

    return true;
  });
}

function assertExistingRowMatches(asset, row) {
  const checks = {
    asset_role: asset.role,
    base_s3_key: asset.storage.baseKey,
    category_slug: asset.category,
    is_active: true,
    source_file_sha256: asset.dbRow.source_file_sha256,
    source_original_s3_key: asset.storage.originalKey,
    status: "ready",
    subject_review_status: "approved",
    thumb_s3_key: asset.storage.thumbKey,
  };

  for (const [field, expected] of Object.entries(checks)) {
    if (row[field] !== expected) {
      throw new Error(
        `${asset.libraryAssetId} existing row mismatch for ${field}: expected ${String(expected)}, received ${String(row[field])}`,
      );
    }
  }
}

async function uploadCheckpoint(checkpoint) {
  const rows = new Array(checkpoint.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < checkpoint.length) {
      const index = nextIndex;
      nextIndex += 1;
      const asset = checkpoint[index];
      const paths = resolveAssetPaths(asset, manifestDir);

      await Promise.all([
        putObject(paths.base, asset.storage.baseKey, "image/webp"),
        putObject(paths.thumb, asset.storage.thumbKey, "image/webp"),
        putObject(
          paths.original,
          asset.storage.originalKey,
          imageContentType(paths.original),
        ),
      ]);

      result.uploadedOnlyBeforeFailure.push(asset.libraryAssetId);
      rows[index] = {
        asset,
        row: {
          ...asset.dbRow,
          base_url: buildPublicStorageUrl(asset.storage.baseKey),
          source_original_url: buildPublicStorageUrl(asset.storage.originalKey),
          thumb_url: buildPublicStorageUrl(asset.storage.thumbKey),
        },
      };
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, checkpoint.length) },
      () => worker(),
    ),
  );
  return rows;
}

async function insertCheckpoint(entries) {
  const { data, error } = await supabase
    .from("category_image_assets")
    .insert(entries.map((entry) => entry.row))
    .select("id,library_asset_id");

  if (error) {
    throw new Error(
      `Could not insert ${entries.length} role-library rows: ${error.message}`,
    );
  }

  const rowsByLibraryId = new Map(
    (data ?? []).map((row) => [row.library_asset_id, row]),
  );

  for (const entry of entries) {
    const inserted = rowsByLibraryId.get(entry.asset.libraryAssetId);

    if (!inserted) {
      throw new Error(
        `Supabase did not return ${entry.asset.libraryAssetId} after insert.`,
      );
    }

    result.inserted.push({
      category: entry.asset.category,
      id: inserted.id,
      libraryAssetId: entry.asset.libraryAssetId,
      role: entry.asset.role,
    });
    result.uploadedOnlyBeforeFailure = result.uploadedOnlyBeforeFailure.filter(
      (libraryAssetId) => libraryAssetId !== entry.asset.libraryAssetId,
    );
  }
}

async function putObject(filePath, key, contentType) {
  await uploadBufferToStorage({
    buffer: readFileSync(filePath),
    cacheControl: CACHE_CONTROL,
    contentType,
    key,
  });
}

function validateManifest(value, manifestDirectory) {
  if (value.version !== "carousel-role-library-v1") {
    throw new Error(`Unsupported role-library manifest version: ${value.version}`);
  }

  if ((value.errors ?? []).length > 0) {
    throw new Error(`Manifest contains ${value.errors.length} preparation errors.`);
  }

  const items = Array.isArray(value.assets) ? value.assets : [];

  if (
    items.length === 0 ||
    items.length !== value.summary?.deduplicated?.total
  ) {
    throw new Error(
      `Manifest is partial: ${items.length} prepared assets versus ${String(value.summary?.deduplicated?.total)} audited unique assets.`,
    );
  }

  const uniqueIds = new Set();
  const uniqueHashes = new Set();
  const uniqueKeys = new Set();

  for (const asset of items) {
    if (!asset.libraryAssetId || !asset.category || !asset.role) {
      throw new Error("Manifest asset is missing libraryAssetId, category, or role.");
    }

    if (uniqueIds.has(asset.libraryAssetId)) {
      throw new Error(`Duplicate libraryAssetId: ${asset.libraryAssetId}`);
    }
    uniqueIds.add(asset.libraryAssetId);

    const sourceHash = asset.dbRow?.source_file_sha256;
    if (!sourceHash || uniqueHashes.has(sourceHash)) {
      throw new Error(`Missing or duplicate source hash: ${asset.libraryAssetId}`);
    }
    uniqueHashes.add(sourceHash);

    for (const key of Object.values(asset.storage ?? {})) {
      if (!key || uniqueKeys.has(key)) {
        throw new Error(`Missing or duplicate storage key: ${asset.libraryAssetId}`);
      }
      uniqueKeys.add(key);
    }

    if (
      asset.dbRow.library_asset_id !== asset.libraryAssetId ||
      asset.dbRow.category_slug !== asset.category ||
      asset.dbRow.asset_role !== asset.role ||
      asset.dbRow.is_active !== true ||
      asset.dbRow.status !== "ready" ||
      asset.dbRow.subject_review_status !== "approved" ||
      asset.dbRow.runtime_exclusion_reason !== null
    ) {
      throw new Error(`${asset.libraryAssetId} has unsafe or mismatched DB metadata.`);
    }

    resolveAssetPaths(asset, manifestDirectory);
  }

  const summary = summarizeCarouselRoleAssets(items);
  assertCarouselRolePoolMinimums(summary);
  return items;
}

function resolveAssetPaths(asset, manifestDirectory) {
  const paths = {};

  for (const name of ["base", "thumb", "original"]) {
    const filePath = path.resolve(manifestDirectory, asset.files?.[name] ?? "");
    const relative = path.relative(manifestDirectory, filePath);

    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(
        `${asset.libraryAssetId} ${name} file escapes or equals the manifest directory.`,
      );
    }

    if (!existsSync(filePath)) {
      throw new Error(`${asset.libraryAssetId} is missing ${name} file: ${filePath}`);
    }

    const stats = statSync(filePath);
    if (!stats.isFile() || stats.size <= 0) {
      throw new Error(`${asset.libraryAssetId} has an empty ${name} file.`);
    }
    paths[name] = filePath;
  }

  return paths;
}

function assertEnvironmentReady() {
  requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (getStorageProviderName() !== "gcp") {
    throw new Error(`Expected GCP storage, received ${getStorageProviderName()}.`);
  }

  const missing = getMissingStorageEnvVars();
  if (missing.length > 0) {
    throw new Error(`Missing GCP storage configuration: ${missing.join(", ")}`);
  }
}

function imageContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".heic":
      return "image/heic";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      throw new Error(`Unsupported original image extension: ${filePath}`);
  }
}

function printSummary(value) {
  for (const [category, roles] of Object.entries(value.byCategoryRole)) {
    console.log(
      `${category}: hook ${roles.hook}, human ${roles.human}, static ${roles.static}`,
    );
  }
}

function writeResult(value) {
  const resultPath = path.join(manifestDir, RESULT_FILE_NAME);
  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`);
}

function findLatestManifest(root, fileName) {
  const absoluteRoot = path.resolve(root);
  const latestDirectory = readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteRoot, entry.name))
    .sort()
    .at(-1);

  if (!latestDirectory) {
    throw new Error(`No prepared role-library directory exists under ${absoluteRoot}.`);
  }

  const filePath = path.join(latestDirectory, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Latest preparation has no ${fileName}: ${latestDirectory}`);
  }
  return filePath;
}

function chunkValues(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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
