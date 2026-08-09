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

const DEFAULT_LIBRARY_ROOT = "D:\\walloftext_sound\\wall_audio_library_v2";
const METADATA_RELATIVE_PATH = "metadata/wall_audio_assets.json";
const RESULT_ROOT = ".tmp/wall-audio-import";
const STORAGE_PREFIX = "audio/wall-text/library-v2";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const STORAGE_RETRY_ATTEMPTS = 4;
const STORAGE_RETRY_BASE_DELAY_MS = 500;
const ACTIVE_STATUS = "active";
const APPROVED_REVIEW_STATUS = "approved";
const MOODS = new Set([
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
]);
const MESSAGE_TYPES = new Set([
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
const missingOnly = Boolean(args["missing-only"]);
const libraryRoot = path.resolve(
  String(args.library || DEFAULT_LIBRARY_ROOT),
);
const metadataPath = path.join(libraryRoot, METADATA_RELATIVE_PATH);
const manifest = JSON.parse(readFileSync(metadataPath, "utf8"));
const fullPlan = buildImportPlan({ libraryRoot, manifest });
const canaryCount = args.canary
  ? getPositiveInteger(args.canary, "--canary")
  : null;
const items = canaryCount
  ? selectDiverseCanary(fullPlan.items, canaryCount)
  : fullPlan.items;
const plan = {
  ...fullPlan,
  items,
  mode: canaryCount ? `canary-${items.length}` : "approved-active",
};

if (execute && verify) {
  throw new Error("Choose only one remote mode: --execute or --verify.");
}

if (missingOnly && !execute) {
  throw new Error("--missing-only can be used only with --execute.");
}

if (execute && !args.yes) {
  throw new Error(
    "Refusing to upload without --yes. Run the dry-run first, then use --execute --yes.",
  );
}

printPlan({
  libraryRoot,
  metadataPath,
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
  console.log(`Verified ${result.verified.length} approved Wall audio assets.`);
  process.exit(0);
}

const result = {
  completedAt: null,
  imported: [],
  libraryRoot,
  manifestSchemaVersion: manifest.schemaVersion,
  mode: plan.mode,
  skippedExisting: [],
  startedAt: new Date().toISOString(),
};

try {
  const existingById = await loadExistingRows(plan.items);
  const executionItems = missingOnly
    ? plan.items.filter((item) => !existingById.has(item.asset.id))
    : plan.items;

  if (missingOnly) {
    console.log(
      `Resume mode: ${executionItems.length} missing, ${existingById.size} already stored.`,
    );
  }

  for (const [index, item] of executionItems.entries()) {
    console.log(`[${index + 1}/${executionItems.length}] ${item.asset.id}`);
    const existing = existingById.get(item.asset.id);

    if (existing) {
      assertExistingRowMatches(existing, item);
      await verifyStoredObject(item);
      result.skippedExisting.push(item.asset.id);
      continue;
    }

    await withStorageRetry(
      () =>
        uploadBufferToStorage({
          buffer: readFileSync(item.filePath),
          cacheControl: CACHE_CONTROL,
          contentType: "audio/mpeg",
          key: item.storageKey,
        }),
      `upload ${item.asset.id}`,
    );
    await verifyStoredObject(item);

    const { data, error } = await supabase
      .from("wall_audio_assets")
      .insert(toDatabaseRow(item, manifest))
      .select("id,sha256,status,review_status,storage_key")
      .single();

    if (error || !data) {
      throw new Error(
        `Could not save ${item.asset.id}: ${error?.message ?? "no row returned"}`,
      );
    }

    result.imported.push(data.id);
  }

  const verification = await verifyRemoteItems(executionItems);
  result.completedAt = new Date().toISOString();
  result.verification = verification;
  writeRunResult("execute", result);
  console.log(
    `Import complete: ${result.imported.length} imported, ${result.skippedExisting.length} already present, ${verification.verified.length} verified.`,
  );
} catch (error) {
  writeRunResult("failed", {
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

function buildImportPlan({ libraryRoot: root, manifest: value }) {
  if (
    value.schemaVersion !== "wall-audio-library-v2" ||
    value.preparationVersion !== "wall-audio-preparation-v2" ||
    !Array.isArray(value.assets)
  ) {
    throw new Error("Wall audio metadata is not a supported V2 manifest.");
  }

  const activeAssets = value.assets.filter(
    (asset) =>
      asset.status === ACTIVE_STATUS &&
      asset.reviewStatus === APPROVED_REVIEW_STATUS,
  );
  const items = activeAssets.map((asset) => {
    validateApprovedAsset(asset);
    const filePath = path.resolve(root, asset.storagePath);
    assertPathWithin(root, filePath);

    if (!existsSync(filePath) || path.extname(filePath).toLowerCase() !== ".mp3") {
      throw new Error(`Approved audio file is missing: ${asset.id}.`);
    }

    const sizeBytes = statSync(filePath).size;
    if (sizeBytes <= 0 || sizeBytes > MAX_AUDIO_BYTES) {
      throw new Error(`${asset.id} has an invalid file size.`);
    }

    const sha256 = createHash("sha256")
      .update(readFileSync(filePath))
      .digest("hex");
    const storageKey = `${STORAGE_PREFIX}/${asset.id}.mp3`;

    return {
      asset,
      audioUrl: buildPublicStorageUrl(storageKey),
      filePath,
      sha256,
      sizeBytes,
      storageKey,
    };
  });

  const idCount = new Set(items.map((item) => item.asset.id)).size;
  const hashCount = new Set(items.map((item) => item.sha256)).size;
  if (idCount !== items.length || hashCount !== items.length) {
    throw new Error("Approved Wall audio contains duplicate IDs or files.");
  }

  return {
    approvedCount: items.length,
    items,
    pendingCount: value.assets.filter(
      (asset) => asset.status === "pending_review",
    ).length,
    totalManifestCount: value.assets.length,
  };
}

function validateApprovedAsset(asset) {
  if (!/^audio_[0-9]{3}(_segment_[0-9]{2})?$/u.test(asset.id)) {
    throw new Error(`Invalid Wall audio ID: ${asset.id}.`);
  }
  if (!/^audio_[0-9]{3}$/u.test(asset.sourceAudioId)) {
    throw new Error(`Invalid source ID for ${asset.id}.`);
  }
  if (
    !Number.isFinite(asset.durationSeconds) ||
    asset.durationSeconds <= 0 ||
    asset.durationSeconds > 600 ||
    !Number.isFinite(asset.sourceStartSeconds) ||
    !Number.isFinite(asset.sourceEndSeconds) ||
    asset.sourceStartSeconds < 0 ||
    asset.sourceEndSeconds <= asset.sourceStartSeconds ||
    !Number.isFinite(asset.cueStartSeconds) ||
    asset.cueStartSeconds < 0 ||
    asset.cueStartSeconds >= asset.durationSeconds
  ) {
    throw new Error(`Invalid timing metadata for ${asset.id}.`);
  }
  if (
    !Array.isArray(asset.moods) ||
    asset.moods.length < 1 ||
    asset.moods.length > 3 ||
    !asset.moods.every((value) => MOODS.has(value)) ||
    !Array.isArray(asset.messageTypes) ||
    asset.messageTypes.length < 1 ||
    asset.messageTypes.length > 4 ||
    !asset.messageTypes.every((value) => MESSAGE_TYPES.has(value)) ||
    !ENERGY_LEVELS.has(asset.energy) ||
    typeof asset.loopable !== "boolean" ||
    !asset.reviewedAt
  ) {
    throw new Error(`Approved tags are incomplete for ${asset.id}.`);
  }
  if (
    !Number.isFinite(asset.normalization?.measuredIntegratedLufs) ||
    Math.abs(asset.normalization.measuredIntegratedLufs + 14) > 1 ||
    !Number.isFinite(asset.normalization?.measuredTruePeakDb) ||
    asset.normalization.measuredTruePeakDb > -1.5
  ) {
    throw new Error(`Normalized loudness is invalid for ${asset.id}.`);
  }
}

function toDatabaseRow(item, manifest) {
  return {
    audio_url: item.audioUrl,
    cue_start_seconds: item.asset.cueStartSeconds,
    duration_seconds: item.asset.durationSeconds,
    energy: item.asset.energy,
    file_size_bytes: item.sizeBytes,
    id: item.asset.id,
    loopable: item.asset.loopable,
    measured_integrated_lufs:
      item.asset.normalization.measuredIntegratedLufs,
    measured_true_peak_db: item.asset.normalization.measuredTruePeakDb,
    message_types: item.asset.messageTypes,
    moods: item.asset.moods,
    preparation_version: manifest.preparationVersion,
    review_notes: item.asset.reviewNotes ?? null,
    review_status: item.asset.reviewStatus,
    reviewed_at: new Date(item.asset.reviewedAt).toISOString(),
    schema_version: manifest.schemaVersion,
    sha256: item.sha256,
    source_audio_id: item.asset.sourceAudioId,
    source_end_seconds: item.asset.sourceEndSeconds,
    source_start_seconds: item.asset.sourceStartSeconds,
    status: item.asset.status,
    storage_key: item.storageKey,
    storage_provider: "gcp",
    tagging_version: "wall-audio-tagging-v1",
    updated_at: new Date().toISOString(),
  };
}

async function assertRemoteSchemaReady() {
  const { error } = await supabase
    .from("wall_audio_assets")
    .select(
      "id,storage_key,audio_url,duration_seconds,moods,message_types,energy,loopable,review_status,status,sha256",
    )
    .limit(1);

  if (error) {
    throw new Error(`Remote Wall audio schema is not ready: ${error.message}`);
  }
}

async function loadExistingRows(items) {
  const result = new Map();
  for (const ids of chunk(items.map((item) => item.asset.id), 100)) {
    const { data, error } = await supabase
      .from("wall_audio_assets")
      .select("id,storage_key,audio_url,status,review_status,sha256,file_size_bytes")
      .in("id", ids);
    if (error) {
      throw new Error(`Could not inspect existing Wall audio: ${error.message}`);
    }
    for (const row of data ?? []) result.set(row.id, row);
  }
  return result;
}

function assertExistingRowMatches(row, item) {
  if (
    row.sha256 !== item.sha256 ||
    row.storage_key !== item.storageKey ||
    row.audio_url !== item.audioUrl ||
    Number(row.file_size_bytes) !== item.sizeBytes ||
    row.status !== "active" ||
    row.review_status !== "approved"
  ) {
    throw new Error(`Existing row does not match ${item.asset.id}.`);
  }
}

async function verifyStoredObject(item) {
  await withStorageRetry(
    () => verifyStoredObjectOnce(item),
    `verify ${item.asset.id}`,
  );
}

async function verifyStoredObjectOnce(item) {
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

async function withStorageRetry(operation, label) {
  let lastError;
  for (let attempt = 1; attempt <= STORAGE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableStorageError(error) || attempt === STORAGE_RETRY_ATTEMPTS) {
        throw error;
      }
      const delayMs = STORAGE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `${label} hit a transient storage error; retrying ${attempt}/${STORAGE_RETRY_ATTEMPTS - 1}.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function isRetryableStorageError(error) {
  const code = error && typeof error === "object" ? error.code : null;
  const status = error && typeof error === "object" ? error.statusCode : null;
  return (
    ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"].includes(code) ||
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  );
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

function selectDiverseCanary(items, count) {
  const selected = [];
  const usedSources = new Set();
  for (const item of items) {
    if (selected.length >= count) break;
    if (usedSources.has(item.asset.sourceAudioId)) continue;
    selected.push(item);
    usedSources.add(item.asset.sourceAudioId);
  }
  return selected;
}

function printPlan({ libraryRoot: root, metadataPath: metadata, operation, plan: value }) {
  console.log("Wall audio import plan");
  console.log(`Operation: ${operation}`);
  console.log(`Library: ${root}`);
  console.log(`Metadata: ${metadata}`);
  console.log(`Manifest assets: ${value.totalManifestCount}`);
  console.log(`Approved and active: ${value.approvedCount}`);
  console.log(`Pending human review: ${value.pendingCount}`);
  console.log(`Selected for this run: ${value.items.length} (${value.mode})`);
  console.log(
    `Duration range: ${Math.min(...value.items.map((item) => item.asset.durationSeconds)).toFixed(3)}s-${Math.max(...value.items.map((item) => item.asset.durationSeconds)).toFixed(3)}s`,
  );
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
    throw new Error(`Missing runtime configuration: ${[...new Set(missing)].join(", ")}`);
  }
}

function assertPathWithin(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Audio path escapes the library root: ${target}.`);
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
