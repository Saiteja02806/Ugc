import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  buildPublicStorageUrl,
  deleteStorageObject,
  getMissingStorageEnvVars,
  getStorageProviderName,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const QUERY_CHUNK_SIZE = 100;
const WRITE_CHUNK_SIZE = 20;
const REMOTE_REQUEST_TIMEOUT_MS = 30_000;
const REPORT_ROOT = ".tmp/carousel-role-library-reconcile";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const dryRun = !execute || Boolean(args["dry-run"]);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to reconcile without --yes. Run the dry-run first, then use --execute --yes.",
  );
}

const manifestPath = path.resolve(requiredArg("manifest"));
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const desiredPrefixes = parsePrefixes(requiredArg("desired-prefixes"));
const reconcilePrefixes = parsePrefixes(requiredArg("reconcile-prefixes"));
const refreshPrefixes = parsePrefixes(requiredArg("refresh-prefixes"));
const expected = {
  additions: parseExpectedCount(args["expected-additions"]),
  refreshes: parseExpectedCount(args["expected-refreshes"]),
  stale: parseExpectedCount(args["expected-stale"]),
};

const manifestAssets = validateManifest(manifest, manifestDir);
const desiredAssets = manifestAssets.filter((asset) =>
  matchesAnyPrefix(asset.source.relativePath, desiredPrefixes),
);

if (desiredAssets.length === 0) {
  throw new Error("No manifest assets matched the desired source prefixes.");
}

requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(
  requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  },
);

const remoteAssets = await loadRemoteRoleAssets();
const plan = buildPlan({
  desiredAssets,
  reconcilePrefixes,
  refreshPrefixes,
  remoteAssets,
});

assertExpectedCount("additions", plan.additions.length, expected.additions);
assertExpectedCount("refreshes", plan.refreshes.length, expected.refreshes);
assertExpectedCount("stale", plan.stale.length, expected.stale);

const preflight = await readPreflight(plan.stale.map((item) => item.id));
const report = {
  completedAt: null,
  desiredPrefixes,
  dryRun,
  executed: false,
  manifestPath,
  plan: summarizePlan(plan),
  preflight,
  reconcilePrefixes,
  refreshPrefixes,
  startedAt: new Date().toISOString(),
};
const reportPath = writeReport(report);

printPlan(plan, preflight, reportPath);

if (dryRun) {
  console.log("Dry run complete. No database or storage write was performed.");
  process.exit(0);
}

assertEnvironmentReady();

try {
  if (plan.stale.length > 0) {
    await deleteStaleDatabaseRows(plan.stale);
    await deleteStaleStorageObjects(plan.stale);
  }

  const writeAssets = [...plan.refreshes, ...plan.additions];
  await uploadAssets(writeAssets);
  await persistAssets({
    additions: plan.additions,
    refreshes: plan.refreshes,
  });
  const verification = await verifyResult({ desiredAssets, plan });
  const completed = {
    ...report,
    completedAt: new Date().toISOString(),
    dryRun: false,
    executed: true,
    verification,
  };
  writeReport(completed, reportPath);

  console.log("");
  console.log(`Inserted: ${plan.additions.length}`);
  console.log(`Refreshed: ${plan.refreshes.length}`);
  console.log(`Removed stale: ${plan.stale.length}`);
  console.log(`Verified storage objects: ${verification.storageObjectCount}`);
  console.log(`Result: ${reportPath}`);
} catch (error) {
  writeReport(
    {
      ...report,
      failedAt: new Date().toISOString(),
      failure: error instanceof Error ? error.message : String(error),
    },
    reportPath,
  );
  throw error;
}

function buildPlan(params) {
  const remoteById = new Map(
    params.remoteAssets.map((item) => [item.library_asset_id, item]),
  );
  const remoteByHash = new Map(
    params.remoteAssets.map((item) => [item.source_file_sha256, item]),
  );
  const desiredIds = new Set(
    params.desiredAssets.map((item) => item.libraryAssetId),
  );
  const additions = [];
  const retained = [];
  const staleById = new Map();

  for (const asset of params.desiredAssets) {
    const existing = remoteById.get(asset.libraryAssetId);

    if (existing) {
      assertRemoteIdentity(asset, existing);
      retained.push({ ...asset, remoteId: existing.id });
      continue;
    }

    const collision = remoteByHash.get(asset.dbRow.source_file_sha256);

    if (collision) {
      staleById.set(collision.id, {
        ...collision,
        staleReason: `canonical identity moves to ${asset.libraryAssetId}`,
      });
    }

    additions.push(asset);
  }

  for (const remote of params.remoteAssets) {
    const sourcePath = getRemoteSourcePath(remote);

    if (
      matchesAnyPrefix(sourcePath, params.reconcilePrefixes) &&
      !desiredIds.has(remote.library_asset_id)
    ) {
      staleById.set(remote.id, {
        ...remote,
        staleReason: "source file is no longer present in the reconciled folder",
      });
    }
  }

  const refreshes = retained.filter((asset) =>
    matchesAnyPrefix(asset.source.relativePath, params.refreshPrefixes),
  );
  const stale = [...staleById.values()].sort((left, right) =>
    left.library_asset_id.localeCompare(right.library_asset_id),
  );

  for (const item of stale) {
    if (
      !matchesAnyPrefix(getRemoteSourcePath(item), params.reconcilePrefixes) &&
      !additions.some(
        (asset) =>
          asset.dbRow.source_file_sha256 === item.source_file_sha256,
      )
    ) {
      throw new Error(
        `Refusing unrelated stale asset ${item.library_asset_id}.`,
      );
    }
  }

  return { additions, refreshes, retained, stale };
}

async function loadRemoteRoleAssets() {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(
        "id,asset_role,base_s3_key,category_slug,is_active,library_asset_id,source_file_sha256,source_filename,source_folder,source_metadata,source_original_s3_key,status,subject_review_status,thumb_s3_key",
      )
      .not("library_asset_id", "is", null)
      .order("id")
      .range(from, from + QUERY_CHUNK_SIZE - 1);

    if (error) {
      throw new Error(`Could not load remote role assets: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < QUERY_CHUNK_SIZE) break;
    from += QUERY_CHUNK_SIZE;
  }

  return rows;
}

async function readPreflight(staleIds) {
  const idArray = sqlUuidArray(staleIds);
  const rows = await queryDatabase(`
    select
      (
        select count(*)::int
        from public.background_jobs
        where job_type in ('generate_carousel', 'render_trending_carousel_edit')
          and status not in ('completed', 'failed', 'cancelled')
      ) as active_carousel_job_count,
      (
        select count(*)::int
        from public.carousel_slides
        where category_image_asset_id = any(${idArray})
      ) as stale_source_pointer_count,
      (
        select count(*)::int
        from public.carousel_image_usage
        where asset_id = any(${idArray})
      ) as stale_usage_count
  `);
  const row = rows[0];

  if (!row) throw new Error("Could not read reconciliation preflight state.");

  return {
    activeCarouselJobCount: Number(row.active_carousel_job_count),
    staleSourcePointerCount: Number(row.stale_source_pointer_count),
    staleUsageCount: Number(row.stale_usage_count),
  };
}

async function deleteStaleDatabaseRows(items) {
  const ids = items.map((item) => item.id);
  const libraryIds = items.map((item) => item.library_asset_id);
  const idArray = sqlUuidArray(ids);
  const libraryIdArray = sqlTextArray(libraryIds);

  await queryDatabase(`
    begin;
    select pg_advisory_xact_lock(hashtext('carousel-role-library-reconcile-v1'));

    do $$
    begin
      if exists (
        select 1
        from public.background_jobs
        where job_type in ('generate_carousel', 'render_trending_carousel_edit')
          and status not in ('completed', 'failed', 'cancelled')
      ) then
        raise exception 'carousel_role_library_reconcile_has_active_jobs';
      end if;
    end;
    $$;

    update public.carousel_image_rotation_pools
    set last_asset_id = null, updated_at = now()
    where last_asset_id = any(${idArray});

    update public.carousel_slides
    set category_image_asset_id = null, updated_at = now()
    where category_image_asset_id = any(${idArray});

    delete from public.carousel_image_usage
    where asset_id = any(${idArray});

    delete from public.category_image_assets
    where id = any(${idArray})
      and library_asset_id = any(${libraryIdArray});

    do $$
    begin
      if exists (
        select 1
        from public.category_image_assets
        where id = any(${idArray})
      ) then
        raise exception 'carousel_role_library_reconcile_delete_incomplete';
      end if;
    end;
    $$;
    commit;
  `);
}

async function deleteStaleStorageObjects(items) {
  const keys = unique(
    items.flatMap((item) => [
      item.base_s3_key,
      item.thumb_s3_key,
      item.source_original_s3_key,
    ]),
  );

  assertCarouselKeys(keys);
  await runWithConcurrency(keys, 12, (key) =>
    deleteStorageObject({ key }),
  );
}

async function uploadAssets(items) {
  await runWithConcurrency(items, 4, async (asset) => {
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
  });
}

async function persistAssets(params) {
  for (const chunk of chunkValues(params.additions, WRITE_CHUNK_SIZE)) {
    const { error } = await supabase
      .from("category_image_assets")
      .insert(chunk.map(toPersistedRow));

    if (error) {
      throw new Error(`Could not insert reconciled assets: ${error.message}`);
    }
  }

  for (const chunk of chunkValues(params.refreshes, WRITE_CHUNK_SIZE)) {
    const { error } = await supabase.from("category_image_assets").upsert(
      chunk.map((asset) => ({
        ...withoutUsageCount(toPersistedRow(asset)),
        id: asset.remoteId,
      })),
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Could not refresh reconciled assets: ${error.message}`);
    }
  }
}

async function verifyResult(params) {
  const desiredIds = params.desiredAssets.map((asset) => asset.libraryAssetId);
  const rows = [];

  for (const chunk of chunkValues(desiredIds, QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(
        "id,asset_role,base_s3_key,category_slug,is_active,library_asset_id,source_file_sha256,source_original_s3_key,status,subject_review_status,thumb_s3_key",
      )
      .in("library_asset_id", chunk);

    if (error) {
      throw new Error(`Could not verify reconciled rows: ${error.message}`);
    }
    rows.push(...(data ?? []));
  }

  if (rows.length !== params.desiredAssets.length) {
    throw new Error(
      `Reconciled row count is ${rows.length}; expected ${params.desiredAssets.length}.`,
    );
  }

  const rowsById = new Map(rows.map((row) => [row.library_asset_id, row]));

  for (const asset of params.desiredAssets) {
    const row = rowsById.get(asset.libraryAssetId);
    if (!row) throw new Error(`${asset.libraryAssetId} is missing after reconciliation.`);
    assertRemoteIdentity(asset, row);
    if (
      row.is_active !== true ||
      row.status !== "ready" ||
      row.subject_review_status !== "approved"
    ) {
      throw new Error(`${asset.libraryAssetId} is not active and approved.`);
    }
  }

  if (params.plan.stale.length > 0) {
    const { count, error } = await supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true })
      .in(
        "id",
        params.plan.stale.map((item) => item.id),
      );

    if (error) throw new Error(`Could not verify stale removal: ${error.message}`);
    if ((count ?? 0) !== 0) throw new Error("Stale role-library rows remain.");
  }

  const storageKeys = unique(
    params.desiredAssets.flatMap((asset) => Object.values(asset.storage)),
  );
  let storageObjectCount = 0;

  await runWithConcurrency(storageKeys, 12, async (key) => {
    const metadata = await headStorageObject({ key });
    if (!metadata) throw new Error(`Storage object is missing after reconciliation: ${key}`);
    storageObjectCount += 1;
  });

  return {
    databaseRowCount: rows.length,
    staleRowCount: 0,
    storageObjectCount,
  };
}

function validateManifest(value, directory) {
  if (value.version !== "carousel-role-library-v1") {
    throw new Error(`Unsupported manifest version: ${String(value.version)}`);
  }
  if ((value.errors ?? []).length > 0) {
    throw new Error(`Manifest has ${value.errors.length} preparation errors.`);
  }
  const assets = Array.isArray(value.assets) ? value.assets : [];
  if (assets.length !== value.summary?.deduplicated?.total) {
    throw new Error("Manifest is partial or its deduplicated count is stale.");
  }

  for (const asset of assets) {
    if (
      !asset.libraryAssetId ||
      !asset.dbRow?.source_file_sha256 ||
      !asset.source?.relativePath
    ) {
      throw new Error("Manifest contains an incomplete asset.");
    }
    resolveAssetPaths(asset, directory);
  }
  return assets;
}

function assertRemoteIdentity(asset, row) {
  const expected = {
    asset_role: asset.role,
    base_s3_key: asset.storage.baseKey,
    category_slug: asset.category,
    library_asset_id: asset.libraryAssetId,
    source_file_sha256: asset.dbRow.source_file_sha256,
    source_original_s3_key: asset.storage.originalKey,
    thumb_s3_key: asset.storage.thumbKey,
  };

  for (const [field, value] of Object.entries(expected)) {
    if (row[field] !== value) {
      throw new Error(
        `${asset.libraryAssetId} remote ${field} mismatch: expected ${String(value)}, received ${String(row[field])}.`,
      );
    }
  }
}

function toPersistedRow(asset) {
  return {
    ...asset.dbRow,
    base_url: buildPublicStorageUrl(asset.storage.baseKey),
    source_original_url: buildPublicStorageUrl(asset.storage.originalKey),
    thumb_url: buildPublicStorageUrl(asset.storage.thumbKey),
  };
}

function withoutUsageCount(row) {
  const persisted = { ...row };
  delete persisted.usage_count;
  return persisted;
}

function resolveAssetPaths(asset, directory) {
  const paths = {};

  for (const name of ["base", "thumb", "original"]) {
    const filePath = path.resolve(directory, asset.files?.[name] ?? "");
    const relative = path.relative(directory, filePath);

    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`${asset.libraryAssetId} ${name} escapes the manifest directory.`);
    }
    if (!existsSync(filePath)) {
      throw new Error(`${asset.libraryAssetId} is missing ${name}: ${filePath}`);
    }
    paths[name] = filePath;
  }
  return paths;
}

function getRemoteSourcePath(row) {
  const metadataPath = row.source_metadata?.sourceRelativePath;
  if (typeof metadataPath === "string" && metadataPath.trim()) {
    return normalizePath(metadataPath);
  }
  return normalizePath(
    [row.source_folder, row.source_filename].filter(Boolean).join("/"),
  );
}

function parsePrefixes(value) {
  const prefixes = String(value)
    .split(",")
    .map((item) => normalizePath(item).replace(/^\/+/, ""))
    .filter(Boolean)
    .map((item) => (item.endsWith("/") ? item : `${item}/`));

  if (prefixes.length === 0 || prefixes.some((item) => item.includes(".."))) {
    throw new Error("Source prefixes must be explicit paths within the manifest root.");
  }
  return [...new Set(prefixes)];
}

function matchesAnyPrefix(value, prefixes) {
  const normalized = normalizePath(value).replace(/^\/+/, "");
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

function normalizePath(value) {
  return String(value ?? "").trim().replaceAll("\\", "/").replace(/\/+/g, "/");
}

function summarizePlan(value) {
  return {
    additionCount: value.additions.length,
    additions: value.additions.map(toAssetReference),
    refreshCount: value.refreshes.length,
    refreshes: value.refreshes.map(toAssetReference),
    retainedCount: value.retained.length,
    stale: value.stale.map((item) => ({
      category: item.category_slug,
      id: item.id,
      libraryAssetId: item.library_asset_id,
      role: item.asset_role,
      sourcePath: getRemoteSourcePath(item),
      staleReason: item.staleReason,
      storageKeys: unique([
        item.base_s3_key,
        item.thumb_s3_key,
        item.source_original_s3_key,
      ]),
    })),
    staleCount: value.stale.length,
  };
}

function toAssetReference(asset) {
  return {
    category: asset.category,
    libraryAssetId: asset.libraryAssetId,
    role: asset.role,
    sourcePath: asset.source.relativePath,
  };
}

function printPlan(value, preflight, reportPath) {
  console.log("Carousel role-library targeted reconciliation");
  console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Desired scoped assets: ${desiredAssets.length}`);
  console.log(`Additions: ${value.additions.length}`);
  console.log(`Retained: ${value.retained.length}`);
  console.log(`Refreshed: ${value.refreshes.length}`);
  console.log(`Stale removals: ${value.stale.length}`);
  console.log(`Active Carousel jobs: ${preflight.activeCarouselJobCount}`);
  console.log(`Stale slide pointers: ${preflight.staleSourcePointerCount}`);
  console.log(`Stale usage rows: ${preflight.staleUsageCount}`);
  console.log(`Report: ${reportPath}`);
}

function writeReport(value, existingPath = null) {
  const reportDir = path.resolve(REPORT_ROOT);
  mkdirSync(reportDir, { recursive: true });
  const reportPath =
    existingPath ??
    path.join(
      reportDir,
      `reconcile-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
  writeFileSync(reportPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return reportPath;
}

function assertExpectedCount(name, actual, expectedCount) {
  if (expectedCount !== null && actual !== expectedCount) {
    throw new Error(
      `Reconciliation ${name} changed: expected ${expectedCount}, found ${actual}.`,
    );
  }
}

function assertEnvironmentReady() {
  requiredEnv("SUPABASE_ACCESS_TOKEN");
  if (getStorageProviderName() !== "gcp") {
    throw new Error(`Expected GCP storage, received ${getStorageProviderName()}.`);
  }
  const missing = getMissingStorageEnvVars();
  if (missing.length > 0) {
    throw new Error(`Missing GCP storage configuration: ${missing.join(", ")}`);
  }
}

function assertCarouselKeys(keys) {
  const unsafe = keys.find(
    (key) => !String(key).startsWith("category-library/v2/"),
  );
  if (unsafe) throw new Error(`Refusing non-role-library storage key: ${unsafe}`);
}

function sqlUuidArray(values) {
  if (values.length === 0) return "array[]::uuid[]";
  for (const value of values) {
    if (!/^[a-f0-9-]{36}$/i.test(value)) throw new Error(`Invalid UUID: ${value}`);
  }
  return `array[${values.map((value) => `'${value}'::uuid`).join(",")}]`;
}

function sqlTextArray(values) {
  if (values.length === 0) return "array[]::text[]";
  return `array[${values.map((value) => `'${sqlEscape(value)}'::text`).join(",")}]`;
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

async function queryDatabase(query) {
  const supabaseUrl = requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("SUPABASE_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(REMOTE_REQUEST_TIMEOUT_MS),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase SQL request failed (${response.status}): ${body}`);
  }
  return JSON.parse(body);
}

async function putObject(filePath, key, contentType) {
  await uploadBufferToStorage({
    buffer: readFileSync(filePath),
    cacheControl: CACHE_CONTROL,
    contentType,
    key,
  });
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
      throw new Error(`Unsupported image extension: ${filePath}`);
  }
}

async function runWithConcurrency(values, maximum, callback) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      await callback(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(maximum, values.length) }, () => worker()),
  );
}

function chunkValues(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseExpectedCount(value) {
  if (value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative count, received ${String(value)}.`);
  }
  return parsed;
}

function requiredArg(name) {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing --${name}.`);
  }
  return value.trim();
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
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
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
