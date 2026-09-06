import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  getMissingStorageEnvVars,
  getStorageProviderName,
  getStorageObject,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_MANIFEST_PATH = path.join(
  process.cwd(),
  "artifacts",
  "reaction-asset-review",
  "reaction-manifest-template.json",
);
const VALIDATOR_PATH = path.resolve(
  "scripts",
  "validate-reaction-asset-manifest.mjs",
);
const RESULT_ROOT = path.resolve(".tmp", "reaction-asset-import");
const STORAGE_PREFIX = "reaction-format/v1";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 500;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(String(args.manifest ?? DEFAULT_MANIFEST_PATH));
const execute = Boolean(args.execute);
const verify = Boolean(args.verify);

if (execute && verify) {
  throw new Error("Choose only one remote mode: --execute or --verify.");
}
if (execute && !args.yes) {
  throw new Error(
    "Refusing to import without --yes. Run the dry run first, then use --execute --yes.",
  );
}

assertManifestIsActiveAndValid(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const plan = buildImportPlan(manifest, { requireLocalSource: !verify });
const operation = verify ? "verify" : execute ? "execute" : "dry-run";

printPlan({ manifestPath, operation, plan });

if (!execute && !verify) {
  console.log("Dry run complete. No object-storage upload or database write was performed.");
  process.exit(0);
}

assertRuntimeReady();
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await assertRemoteSchemaReady(supabase);

if (verify) {
  const verification = await verifyRemoteItems(supabase, plan);
  writeRunResult("verify", verification);
  console.log(
    `Verified ${verification.clips.length} clips and ${verification.backgrounds.length} backgrounds.`,
  );
  process.exit(0);
}

const result = {
  completedAt: null,
  importedBackgrounds: [],
  importedClips: [],
  manifestPath,
  skippedExistingBackgrounds: [],
  skippedExistingClips: [],
  startedAt: new Date().toISOString(),
  storageProvider: getStorageProviderName(),
};

try {
  await importItems({
    existingLabel: "clips",
    importLabel: "clip",
    items: plan.clips,
    onImported: (assetKey) => result.importedClips.push(assetKey),
    onSkipped: (assetKey) => result.skippedExistingClips.push(assetKey),
    supabase,
    table: "reaction_clip_assets",
  });
  await importItems({
    existingLabel: "backgrounds",
    importLabel: "background",
    items: plan.backgrounds,
    onImported: (assetKey) => result.importedBackgrounds.push(assetKey),
    onSkipped: (assetKey) => result.skippedExistingBackgrounds.push(assetKey),
    supabase,
    table: "reaction_background_assets",
  });

  const verification = await verifyRemoteItems(supabase, plan);
  result.completedAt = new Date().toISOString();
  result.verification = verification;
  writeRunResult("execute", result);
  console.log(
    `Import complete: ${result.importedClips.length} clips and ${result.importedBackgrounds.length} backgrounds activated.`,
  );
} catch (error) {
  writeRunResult("failed", {
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

function assertManifestIsActiveAndValid(inputPath) {
  try {
    execFileSync(
      process.execPath,
      [VALIDATOR_PATH, "--manifest", inputPath, "--require-active"],
      { stdio: "pipe" },
    );
  } catch (error) {
    const detail = error instanceof Error && "stderr" in error
      ? Buffer.from(error.stderr ?? "").toString("utf8").trim()
      : "";
    throw new Error(`Reaction manifest is not ready for import. ${detail}`.trim());
  }
}

function buildImportPlan(value, { requireLocalSource }) {
  if (
    value?.schemaVersion !== "reaction-asset-manifest-v2" ||
    !Array.isArray(value.videos) ||
    !Array.isArray(value.backgrounds)
  ) {
    throw new Error("Reaction import requires a reaction-asset-manifest-v2 manifest.");
  }

  const clips = value.videos
    .filter((asset) => asset.status === "active")
    .map((asset) => buildItem(asset, "clip", { requireLocalSource }));
  const backgrounds = value.backgrounds
    .filter((asset) => asset.status === "active")
    .map((asset) => buildItem(asset, "background", { requireLocalSource }));

  assertUnique(clips, "clip");
  assertUnique(backgrounds, "background");

  return { backgrounds, clips };
}

function buildItem(asset, kind, { requireLocalSource }) {
  const sourceRoot = path.resolve(asset.sourceRoot);
  const sourcePath = path.resolve(sourceRoot, asset.sourceFileName);
  assertPathWithin(sourceRoot, sourcePath);
  const extension = path.extname(sourcePath).toLowerCase();
  const contentType = getContentType(kind, extension);
  const storageKey = `${STORAGE_PREFIX}/${kind === "clip" ? "clips" : "backgrounds"}/${asset.sourceSha256}${extension}`;

  // A production verification checks the immutable reviewed hash from storage;
  // it must not require the source drive to remain mounted after import.
  if (!requireLocalSource) {
    return {
      asset,
      contentType,
      kind,
      sizeBytes: null,
      sourcePath: null,
      sourceSha256: asset.sourceSha256,
      storageKey,
    };
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`${asset.assetId} source file is missing: ${sourcePath}.`);
  }

  const sizeBytes = statSync(sourcePath).size;
  if (sizeBytes <= 0) {
    throw new Error(`${asset.assetId} source file is empty.`);
  }

  const sourceSha256 = getFileSha256(sourcePath);
  if (sourceSha256 !== asset.sourceSha256) {
    throw new Error(`${asset.assetId} source checksum no longer matches the reviewed manifest.`);
  }

  return {
    asset,
    contentType,
    kind,
    sizeBytes,
    sourcePath,
    sourceSha256,
    storageKey,
  };
}

function getContentType(kind, extension) {
  const videoTypes = new Map([
    [".mov", "video/quicktime"],
    [".mp4", "video/mp4"],
    [".webm", "video/webm"],
  ]);
  const imageTypes = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".webp", "image/webp"],
  ]);
  const contentType = (kind === "clip" ? videoTypes : imageTypes).get(extension);
  if (!contentType) {
    throw new Error(`Unsupported ${kind} source extension: ${extension || "none"}.`);
  }
  return contentType;
}

function assertUnique(items, kind) {
  const assetKeys = new Set();
  const hashes = new Set();
  const storageKeys = new Set();
  for (const item of items) {
    if (
      assetKeys.has(item.asset.assetId) ||
      hashes.has(item.sourceSha256) ||
      storageKeys.has(item.storageKey)
    ) {
      throw new Error(`Active reaction ${kind}s contain a duplicate asset or source.`);
    }
    assetKeys.add(item.asset.assetId);
    hashes.add(item.sourceSha256);
    storageKeys.add(item.storageKey);
  }
}

async function importItems(params) {
  const existingByHash = await loadExistingRows(params.supabase, params.table, params.items);
  for (const [index, item] of params.items.entries()) {
    console.log(
      `[${params.importLabel} ${index + 1}/${params.items.length}] ${item.asset.assetId}`,
    );
    const existing = existingByHash.get(item.sourceSha256);
    if (existing) {
      assertExistingRowMatches(existing, item);
      await ensureStoredObject(item);
      params.onSkipped(item.asset.assetId);
      continue;
    }

    await ensureStoredObject(item);
    const { data, error } = await params.supabase
      .from(params.table)
      .upsert(toDatabaseRow(item), { onConflict: "source_sha256" })
      .select("id,asset_key,source_sha256,source_storage_key,status")
      .single();

    if (error || !data) {
      throw new Error(
        `Could not save ${item.asset.assetId}: ${error?.message ?? "no row returned"}`,
      );
    }
    assertExistingRowMatches(data, item, { lightweight: true });
    params.onImported(item.asset.assetId);
  }
  console.log(`Checked ${params.items.length} ${params.existingLabel}.`);
}

function toDatabaseRow(item) {
  const base = {
    asset_key: item.asset.assetId,
    height: item.asset.height,
    source_file_name: item.asset.sourceFileName,
    source_sha256: item.sourceSha256,
    source_storage_key: item.storageKey,
    status: "active",
    width: item.asset.width,
  };

  if (item.kind === "background") {
    return {
      ...base,
      context_tags: item.asset.contextTags.map(normalizeContextTag),
      foreground_placement: item.asset.foregroundPlacement,
    };
  }

  return {
    ...base,
    codec: item.asset.codec,
    composition: item.asset.composition,
    duration_seconds: item.asset.durationSeconds,
    foreground_anchor: item.asset.placement.anchor,
    foreground_height_percent: item.asset.placement.heightPercent,
    has_alpha: true,
    pixel_format: item.asset.pixelFormat,
    reactions: item.asset.reactions,
    subject_count: item.asset.subjectCount,
  };
}

function normalizeContextTag(value) {
  return value.trim().toLowerCase();
}

async function verifyRemoteItems(supabase, plan) {
  const clips = await verifyRemoteItemGroup(
    supabase,
    "reaction_clip_assets",
    plan.clips,
  );
  const backgrounds = await verifyRemoteItemGroup(
    supabase,
    "reaction_background_assets",
    plan.backgrounds,
  );
  return { backgrounds, clips, verifiedAt: new Date().toISOString() };
}

async function verifyRemoteItemGroup(supabase, table, items) {
  const rows = await loadExistingRows(supabase, table, items);
  const verified = [];
  for (const item of items) {
    const row = rows.get(item.sourceSha256);
    if (!row) {
      throw new Error(`Database row is missing for ${item.asset.assetId}.`);
    }
    assertExistingRowMatches(row, item);
    await verifyStoredObject(item);
    verified.push(item.asset.assetId);
  }
  return verified;
}

async function assertRemoteSchemaReady(supabase) {
  for (const table of ["reaction_clip_assets", "reaction_background_assets"]) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      throw new Error(`Reaction catalog migration is not available for ${table}: ${error.message}`);
    }
  }
}

async function loadExistingRows(supabase, table, items) {
  const rows = new Map();
  for (const hashes of chunk(items.map((item) => item.sourceSha256), 100)) {
    if (hashes.length === 0) continue;
    const { data, error } = await supabase
      .from(table)
      .select("id,asset_key,source_sha256,source_storage_key,status")
      .in("source_sha256", hashes);
    if (error) {
      throw new Error(`Could not inspect ${table}: ${error.message}`);
    }
    for (const row of data ?? []) rows.set(row.source_sha256, row);
  }
  return rows;
}

function assertExistingRowMatches(row, item, options = {}) {
  if (
    row.asset_key !== item.asset.assetId ||
    row.source_sha256 !== item.sourceSha256 ||
    row.source_storage_key !== item.storageKey ||
    row.status !== "active"
  ) {
    throw new Error(`Existing catalog row conflicts with ${item.asset.assetId}.`);
  }
  if (options.lightweight) return;
}

async function ensureStoredObject(item) {
  try {
    await verifyStoredObject(item);
    return;
  } catch (error) {
    if (!isObjectNotFound(error)) throw error;
  }

  await withStorageRetry(
    () =>
      uploadBufferToStorage({
        buffer: readFileSync(item.sourcePath),
        cacheControl: CACHE_CONTROL,
        contentType: item.contentType,
        key: item.storageKey,
      }),
    `upload ${item.asset.assetId}`,
  );
  await verifyStoredObject(item);
}

async function verifyStoredObject(item) {
  await withStorageRetry(async () => {
    const head = await headStorageObject({ key: item.storageKey });
    if (
      (item.sizeBytes !== null && Number(head.ContentLength) !== item.sizeBytes) ||
      head.ContentType !== item.contentType
    ) {
      throw new Error(`Stored object metadata is invalid for ${item.asset.assetId}.`);
    }

    const object = await getStorageObject({ key: item.storageKey });
    const reader = object.Body.transformToWebStream().getReader();
    const hash = createHash("sha256");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
    if (hash.digest("hex") !== item.sourceSha256) {
      throw new Error(`Stored object hash is invalid for ${item.asset.assetId}.`);
    }
  }, `verify ${item.asset.assetId}`);
}

async function withStorageRetry(operation, label) {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableStorageError(error) || attempt === RETRY_ATTEMPTS) {
        throw error;
      }
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `${label} hit a transient storage error; retrying ${attempt}/${RETRY_ATTEMPTS - 1}.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function isObjectNotFound(error) {
  const value = error && typeof error === "object" ? error : {};
  const status = value.statusCode ?? value.status ?? value.$metadata?.httpStatusCode;
  return status === 404 || value.name === "NoSuchKey" || value.code === "NoSuchKey";
}

function isRetryableStorageError(error) {
  const value = error && typeof error === "object" ? error : {};
  const status = value.statusCode ?? value.status ?? value.$metadata?.httpStatusCode;
  return (
    ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"].includes(value.code) ||
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  );
}

function assertRuntimeReady() {
  if (getStorageProviderName() !== "gcp") {
    throw new Error(
      `Reaction import requires STORAGE_PROVIDER=gcp; current provider is ${getStorageProviderName()}.`,
    );
  }
  const missing = [
    ...getMissingStorageEnvVars(),
    ...(!process.env.SUPABASE_URL?.trim() && !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      ? ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"]
      : []),
    ...(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? ["SUPABASE_SERVICE_ROLE_KEY"]
      : []),
  ];
  if (missing.length > 0) {
    throw new Error(`Missing reaction import configuration: ${[...new Set(missing)].join(", ")}.`);
  }
}

function assertPathWithin(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Reaction source path escapes its reviewed source root: ${target}.`);
  }
}

function getFileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function chunk(values, size) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

function printPlan({ manifestPath: inputPath, operation: mode, plan: value }) {
  console.log("Reaction asset import plan");
  console.log(`Operation: ${mode}`);
  console.log(`Manifest: ${inputPath}`);
  console.log(`Active clips: ${value.clips.length}`);
  console.log(`Active backgrounds: ${value.backgrounds.length}`);
  const items = [...value.clips, ...value.backgrounds];
  const sourceBytes = items.some((item) => item.sizeBytes === null)
    ? null
    : items.reduce((total, item) => total + item.sizeBytes, 0);
  console.log(
    sourceBytes === null
      ? "Source bytes: not required for remote verification"
      : `Source bytes: ${formatBytes(sourceBytes)}`,
  );
}

function formatBytes(value) {
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function writeRunResult(mode, value) {
  mkdirSync(RESULT_ROOT, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const resultPath = path.join(RESULT_ROOT, `${timestamp}-${mode}.json`);
  writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Result: ${resultPath}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2].trim();
    process.env[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}.`);
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
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
