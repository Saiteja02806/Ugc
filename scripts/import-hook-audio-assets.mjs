import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  buildPublicStorageUrl,
  getMissingStorageEnvVars,
  getStorageObject,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_CATALOG_PATH = "scripts/data/hook-audio-catalog-v1.json";
const DEFAULT_SOURCE_ROOTS = {
  hook_audio_tagging_package_v1:
    "D:\\hook sound\\hook_audio_tagging_package_v1\\hook_audio_tagging_package_v1",
  hook_audio_tagged_batch_v1:
    "D:\\hook sound\\hook_audio_tagged_batch_v1\\hook_audio_tagged_batch_v1",
  hook_audio_tagged_batch_21_28_v1:
    "D:\\hook sound\\hook_audio_tagged_batch_21_28_v1\\hook_audio_tagged_batch_21_28_v1",
};
const RESULT_ROOT = ".tmp/hook-audio-import";
const STORAGE_PREFIX = "audio/hook/library-v1";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MOODS = new Set([
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
]);
const HOOK_TYPES = new Set([
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
]);
const ENERGY_LEVELS = new Set(["low", "medium", "high"]);

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const verify = Boolean(args.verify);
if (execute && verify) {
  throw new Error("Choose only one remote mode: --execute or --verify.");
}
if (execute && !args.yes) {
  throw new Error(
    "Refusing to upload without --yes. Run the dry-run first, then use --execute --yes.",
  );
}

const catalogPath = path.resolve(String(args.catalog || DEFAULT_CATALOG_PATH));
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const sourceRoots = buildSourceRoots(args);
const fullPlan = buildImportPlan({ catalog, sourceRoots });
const canaryCount = args.canary
  ? getPositiveInteger(args.canary, "--canary")
  : null;
const items = canaryCount
  ? selectDiverseCanary(fullPlan.items, canaryCount)
  : fullPlan.items;
const plan = {
  ...fullPlan,
  items,
  mode: canaryCount ? `canary-${items.length}` : "all-pending-inactive",
};

printPlan({
  catalogPath,
  operation: verify ? "verify" : execute ? "execute" : "dry-run",
  plan,
});

if (!execute && !verify) {
  console.log("Dry run complete. No GCP object or Supabase row was changed.");
  process.exit(0);
}

assertRuntimeReady();

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await assertRemoteSchemaReady();

if (verify) {
  const result = await verifyRemoteItems(plan.items);
  writeRunResult("verify", { ...result, mode: plan.mode });
  console.log(`Verified ${result.verified.length} pending Hook audio assets.`);
  process.exit(0);
}

const result = {
  catalogSchemaVersion: catalog.schemaVersion,
  completedAt: null,
  imported: [],
  mode: plan.mode,
  skippedExisting: [],
  updatedMetadata: [],
  startedAt: new Date().toISOString(),
};

try {
  const existingById = await loadExistingRows(plan.items);

  for (const [index, item] of plan.items.entries()) {
    console.log(`[${index + 1}/${plan.items.length}] ${item.asset.id}`);
    const existing = existingById.get(item.asset.id);

    if (existing) {
      assertExistingRowIdentityMatches(existing, item);
      await verifyStoredObject(item);
      if (semanticMetadataMatches(existing, item)) {
        result.skippedExisting.push(item.asset.id);
      } else {
        await updatePendingMetadata(item);
        result.updatedMetadata.push(item.asset.id);
      }
      continue;
    }

    await uploadBufferToStorage({
      buffer: readFileSync(item.filePath),
      cacheControl: CACHE_CONTROL,
      contentType: "audio/mpeg",
      key: item.storageKey,
    });
    await verifyStoredObject(item);

    const { data, error } = await supabase
      .from("hook_audio_assets")
      .insert(toDatabaseRow(item, catalog))
      .select("id,sha256,status,review_status,storage_key")
      .single();

    if (error || !data) {
      throw new Error(
        `Could not save ${item.asset.id}: ${error?.message ?? "no row returned"}`,
      );
    }
    result.imported.push(data.id);
  }

  const verification = await verifyRemoteItems(plan.items);
  result.completedAt = new Date().toISOString();
  result.verification = verification;
  writeRunResult("execute", result);
  console.log(
    `Import complete: ${result.imported.length} imported, ${result.updatedMetadata.length} metadata-updated, ${result.skippedExisting.length} already current, ${verification.verified.length} verified. All records remain pending/inactive.`,
  );
} catch (error) {
  writeRunResult("failed", {
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

function buildImportPlan({ catalog: value, sourceRoots: roots }) {
  if (
    value.schemaVersion !== "hook-audio-library-v1" ||
    !Array.isArray(value.assets) ||
    !Array.isArray(value.duplicates)
  ) {
    throw new Error("Hook audio catalog is not a supported V1 manifest.");
  }
  if (
    value.policy?.importReviewStatus !== "pending" ||
    value.policy?.importStatus !== "inactive" ||
    value.policy?.loopPolicy !== "never-loop"
  ) {
    throw new Error("Hook audio catalog does not use the safe import policy.");
  }

  const items = value.assets.map((asset) => {
    validatePendingAsset(asset);
    const root = roots[asset.sourcePackage];
    if (!root) {
      throw new Error(`No source root configured for ${asset.sourcePackage}.`);
    }
    const filePath = path.resolve(root, asset.sourcePath);
    assertPathWithin(root, filePath);
    if (!existsSync(filePath) || path.extname(filePath).toLowerCase() !== ".mp3") {
      throw new Error(`Hook audio file is missing: ${asset.id}.`);
    }
    const sizeBytes = statSync(filePath).size;
    if (
      sizeBytes !== Number(asset.fileSizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > MAX_AUDIO_BYTES
    ) {
      throw new Error(`${asset.id} has an invalid file size.`);
    }
    const sha256 = createHash("sha256")
      .update(readFileSync(filePath))
      .digest("hex");
    if (sha256 !== asset.sha256) {
      throw new Error(`Source hash changed for ${asset.id}.`);
    }
    const storageKey = `${STORAGE_PREFIX}/${asset.id}-${sha256.slice(0, 12)}.mp3`;
    return {
      asset,
      audioUrl: buildPublicStorageUrl(storageKey),
      filePath,
      sha256,
      sizeBytes,
      storageKey,
    };
  });

  if (
    new Set(items.map((item) => item.asset.id)).size !== items.length ||
    new Set(items.map((item) => item.sha256)).size !== items.length
  ) {
    throw new Error("Hook audio import plan contains duplicate IDs or files.");
  }
  if (
    value.duplicates.some(
      (duplicate) =>
        duplicate.reviewStatus !== "rejected" ||
        !items.some(
          (item) => item.asset.id === duplicate.canonicalAssetId,
        ),
    )
  ) {
    throw new Error("Hook audio duplicate report is invalid.");
  }

  return {
    duplicateCount: value.duplicates.length,
    items,
    taggedCount: items.filter((item) => item.asset.tagsComplete).length,
    untaggedCount: items.filter((item) => !item.asset.tagsComplete).length,
  };
}

function validatePendingAsset(asset) {
  if (!/^hook_audio_[0-9]{3}$/u.test(String(asset.id))) {
    throw new Error(`Invalid Hook audio ID: ${asset.id}.`);
  }
  if (
    asset.reviewStatus !== "pending" ||
    asset.reviewedAt !== null ||
    asset.status !== "inactive" ||
    asset.loopable !== false
  ) {
    throw new Error(`${asset.id} is not safe for the initial import.`);
  }
  if (
    asset.codec !== "mp3" ||
    !Number.isFinite(asset.durationSeconds) ||
    asset.durationSeconds <= 0 ||
    asset.durationSeconds > 600 ||
    !Array.isArray(asset.moods) ||
    !Array.isArray(asset.hookTypes) ||
    asset.moods.length > 2 ||
    asset.hookTypes.length > 4 ||
    !asset.moods.every((value) => MOODS.has(value)) ||
    !asset.hookTypes.every((value) => HOOK_TYPES.has(value))
  ) {
    throw new Error(`Invalid Hook audio metadata for ${asset.id}.`);
  }

  const tagged =
    asset.moods.length >= 1 &&
    asset.hookTypes.length >= 2 &&
    ENERGY_LEVELS.has(String(asset.energy));
  const untagged =
    asset.moods.length === 0 &&
    asset.hookTypes.length === 0 &&
    asset.energy === null;
  if ((asset.tagsComplete && !tagged) || (!asset.tagsComplete && !untagged)) {
    throw new Error(`Tag completeness is inconsistent for ${asset.id}.`);
  }
  if (
    asset.impactAtSeconds !== null &&
    (!Number.isFinite(asset.impactAtSeconds) ||
      asset.impactAtSeconds < 0 ||
      asset.impactAtSeconds >= asset.durationSeconds)
  ) {
    throw new Error(`Invalid impact timing for ${asset.id}.`);
  }
}

function toDatabaseRow(item, catalog) {
  return {
    audio_url: item.audioUrl,
    bit_rate_bps: item.asset.bitRateBps,
    channels: item.asset.channels,
    codec: item.asset.codec,
    duration_seconds: item.asset.durationSeconds,
    ...toSemanticDatabaseFields(item),
    file_size_bytes: item.sizeBytes,
    id: item.asset.id,
    loopable: false,
    review_status: "pending",
    reviewed_at: null,
    sample_rate_hz: item.asset.sampleRateHz,
    schema_version: catalog.schemaVersion,
    sha256: item.sha256,
    source_file_name: item.asset.sourceFileName,
    source_package: item.asset.sourcePackage,
    status: "inactive",
    storage_key: item.storageKey,
    storage_provider: "gcp",
    updated_at: new Date().toISOString(),
  };
}

function toSemanticDatabaseFields(item) {
  return {
    energy: item.asset.energy,
    hook_types: item.asset.hookTypes,
    impact_at_seconds: item.asset.impactAtSeconds,
    moods: item.asset.moods,
    review_notes: item.asset.reviewNotes || null,
    tagging_version: item.asset.taggingVersion,
  };
}

async function assertRemoteSchemaReady() {
  const { error } = await supabase
    .from("hook_audio_assets")
    .select(
      "id,source_package,source_file_name,storage_key,audio_url,duration_seconds,moods,hook_types,energy,loopable,review_status,status,sha256",
    )
    .limit(1);
  if (error) {
    throw new Error(`Remote Hook audio schema is not ready: ${error.message}`);
  }
}

async function loadExistingRows(items) {
  const result = new Map();
  for (const ids of chunk(items.map((item) => item.asset.id), 100)) {
    const { data, error } = await supabase
      .from("hook_audio_assets")
      .select(
        "id,source_package,source_file_name,storage_key,audio_url,status,review_status,sha256,file_size_bytes,moods,hook_types,energy,impact_at_seconds,review_notes,tagging_version",
      )
      .in("id", ids);
    if (error) {
      throw new Error(`Could not inspect existing Hook audio: ${error.message}`);
    }
    for (const row of data ?? []) result.set(row.id, row);
  }
  return result;
}

function assertExistingRowIdentityMatches(row, item) {
  if (
    row.sha256 !== item.sha256 ||
    row.storage_key !== item.storageKey ||
    row.audio_url !== item.audioUrl ||
    row.source_package !== item.asset.sourcePackage ||
    row.source_file_name !== item.asset.sourceFileName ||
    Number(row.file_size_bytes) !== item.sizeBytes ||
    row.status !== "inactive" ||
    row.review_status !== "pending"
  ) {
    throw new Error(`Existing row does not match safe import ${item.asset.id}.`);
  }
}

function assertExistingRowMatches(row, item) {
  assertExistingRowIdentityMatches(row, item);
  if (!semanticMetadataMatches(row, item)) {
    throw new Error(`Existing semantic metadata is stale for ${item.asset.id}.`);
  }
}

function semanticMetadataMatches(row, item) {
  return (
    arraysEqual(row.moods, item.asset.moods) &&
    arraysEqual(row.hook_types, item.asset.hookTypes) &&
    row.energy === item.asset.energy &&
    optionalNumberEqual(row.impact_at_seconds, item.asset.impactAtSeconds) &&
    (row.review_notes ?? null) === (item.asset.reviewNotes || null) &&
    row.tagging_version === item.asset.taggingVersion
  );
}

async function updatePendingMetadata(item) {
  const { data, error } = await supabase
    .from("hook_audio_assets")
    .update({
      ...toSemanticDatabaseFields(item),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.asset.id)
    .eq("sha256", item.sha256)
    .eq("status", "inactive")
    .eq("review_status", "pending")
    .select(
      "id,source_package,source_file_name,storage_key,audio_url,status,review_status,sha256,file_size_bytes,moods,hook_types,energy,impact_at_seconds,review_notes,tagging_version",
    )
    .single();
  if (error || !data) {
    throw new Error(
      `Could not update pending metadata for ${item.asset.id}: ${error?.message ?? "no row returned"}`,
    );
  }
  assertExistingRowMatches(data, item);
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function optionalNumberEqual(left, right) {
  if (left === null || left === undefined || left === "") {
    return right === null;
  }
  return right !== null && Number(left) === Number(right);
}

async function verifyStoredObject(item) {
  const head = await headStorageObject({ key: item.storageKey });
  if (
    head.ContentLength !== item.sizeBytes ||
    head.ContentType !== "audio/mpeg"
  ) {
    throw new Error(`Stored object metadata is invalid for ${item.asset.id}.`);
  }
  const object = await getStorageObject({ key: item.storageKey });
  const reader = object.Body.transformToWebStream().getReader();
  const hash = createHash("sha256");
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  if (hash.digest("hex") !== item.sha256) {
    throw new Error(`Stored object hash is invalid for ${item.asset.id}.`);
  }
}

async function verifyRemoteItems(items) {
  const rows = await loadExistingRows(items);
  const verified = [];
  for (const item of items) {
    const row = rows.get(item.asset.id);
    if (!row) throw new Error(`Remote row is missing for ${item.asset.id}.`);
    assertExistingRowMatches(row, item);
    await verifyStoredObject(item);
    verified.push(item.asset.id);
  }
  return { verified, verifiedAt: new Date().toISOString() };
}

function buildSourceRoots(parsedArgs) {
  return {
    hook_audio_tagging_package_v1: path.resolve(
      String(parsedArgs.raw || DEFAULT_SOURCE_ROOTS.hook_audio_tagging_package_v1),
    ),
    hook_audio_tagged_batch_v1: path.resolve(
      String(
        parsedArgs["tagged-1-20"] ||
          DEFAULT_SOURCE_ROOTS.hook_audio_tagged_batch_v1,
      ),
    ),
    hook_audio_tagged_batch_21_28_v1: path.resolve(
      String(
        parsedArgs["tagged-21-28"] ||
          DEFAULT_SOURCE_ROOTS.hook_audio_tagged_batch_21_28_v1,
      ),
    ),
  };
}

function selectDiverseCanary(items, count) {
  const selected = [];
  const usedPackages = new Set();
  for (const item of items) {
    if (selected.length >= count) break;
    if (usedPackages.has(item.asset.sourcePackage)) continue;
    selected.push(item);
    usedPackages.add(item.asset.sourcePackage);
  }
  for (const item of items) {
    if (selected.length >= count) break;
    if (selected.some((value) => value.asset.id === item.asset.id)) continue;
    selected.push(item);
  }
  return selected;
}

function printPlan({ catalogPath: manifestPath, operation, plan: value }) {
  console.log("Hook audio import plan");
  console.log(`Operation: ${operation}`);
  console.log(`Catalog: ${manifestPath}`);
  console.log(`Unique pending/inactive assets: ${value.taggedCount + value.untaggedCount}`);
  console.log(`Tagged pending assets: ${value.taggedCount}`);
  console.log(`Untagged pending assets: ${value.untaggedCount}`);
  console.log(`Rejected duplicate files excluded: ${value.duplicateCount}`);
  console.log(`Selected for this run: ${value.items.length} (${value.mode})`);
}

function assertRuntimeReady() {
  const missing = [
    ...getMissingStorageEnvVars(),
    ...(!process.env.SUPABASE_URL?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      ? ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"]
      : []),
    ...(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? ["SUPABASE_SERVICE_ROLE_KEY"]
      : []),
  ];
  if (missing.length > 0) {
    throw new Error(
      `Missing runtime configuration: ${[...new Set(missing)].join(", ")}`,
    );
  }
}

function assertPathWithin(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Audio path escapes the package root: ${target}.`);
  }
}

function chunk(values, size) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

function writeRunResult(mode, value) {
  const directory = path.resolve(RESULT_ROOT);
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${timestamp}-${mode}.json`);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Result: ${filePath}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line
      .trim()
      .match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
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
  throw new Error(`Missing ${names.join(" or ")}`);
}

function getPositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
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
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
