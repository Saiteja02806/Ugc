import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getMissingStorageEnvVars,
  getStorageProviderName,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORAGE_PREFIX = "explore/recreate/v1";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONTENT_TYPES = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webp": "image/webp",
};

loadEnvFile(path.join(root, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = args.execute === true;

if (execute && args.yes !== true) {
  throw new Error("Refusing to upload without --yes. Run the dry-run first, then use --execute --yes.");
}
if (!execute && args.yes === true) {
  throw new Error("--yes is only valid together with --execute.");
}

const manifestPath = path.resolve(
  typeof args.manifest === "string"
    ? args.manifest
    : path.join(root, "lib/explore/imported-catalog.json"),
);
const assetsDirectory = path.resolve(
  typeof args.assets === "string"
    ? args.assets
    : path.join(root, ".tmp/explore-catalog/media"),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const plan = buildImportPlan({ assetsDirectory, manifest });

printPlan({ assetsDirectory, execute, manifestPath, plan });

if (!execute) {
  console.log("Dry run complete. No cloud object or catalogue metadata was changed.");
  process.exit(0);
}

assertRuntimeReady();

for (const [index, item] of plan.items.entries()) {
  console.log(`[${index + 1}/${plan.items.length}] ${item.key}`);
  const existing = await readStoredObject(item);

  if (existing) {
    console.log("  already present and verified");
    continue;
  }

  await uploadBufferToStorage({
    buffer: readFileSync(item.filePath),
    cacheControl: CACHE_CONTROL,
    contentType: item.contentType,
    key: item.key,
  });

  if (!(await readStoredObject(item))) {
    throw new Error(`Storage verification failed for ${item.key}.`);
  }
}

writePublishedManifest(manifestPath, manifest);
console.log(`Import complete: ${plan.items.length} assets are verified under ${STORAGE_PREFIX}/.`);

function buildImportPlan({ assetsDirectory: sourceDirectory, manifest: sourceManifest }) {
  if (sourceManifest?.version !== 1 || !Array.isArray(sourceManifest.items)) {
    throw new Error("Explore Recreate catalogue manifest is invalid.");
  }
  if (!["staged", "published"].includes(sourceManifest.mediaStatus)) {
    throw new Error("Explore Recreate catalogue must declare a staged or published media status.");
  }
  if (!existsSync(sourceDirectory)) {
    throw new Error(`Staged media directory does not exist: ${sourceDirectory}`);
  }

  const fileNames = new Set();
  const ids = new Set();

  for (const item of sourceManifest.items) {
    if (!item?.id || ids.has(item.id) || !Array.isArray(item.slides)) {
      throw new Error(`Invalid or duplicate catalogue item: ${item?.id ?? "unknown"}.`);
    }
    ids.add(item.id);

    const itemFiles = [
      item.posterFile,
      item.videoFile,
      ...item.slides.map((slide) => slide.file),
    ].filter(Boolean);

    for (const fileName of itemFiles) {
      if (typeof fileName !== "string" || !isSafeAssetFileName(fileName)) {
        throw new Error(`Unsafe catalogue asset name: ${String(fileName)}.`);
      }
      fileNames.add(fileName);
    }
  }

  return {
    items: [...fileNames]
      .sort((first, second) => first.localeCompare(second))
      .map((fileName) => {
        const filePath = path.join(sourceDirectory, fileName);
        const extension = path.extname(fileName).toLowerCase();
        const contentType = CONTENT_TYPES[extension];
        const stats = existsSync(filePath) ? statSync(filePath) : null;

        if (!contentType || !stats?.isFile() || stats.size <= 0) {
          throw new Error(`Missing or invalid staged asset: ${fileName}`);
        }

        const bytes = readFileSync(filePath);
        if (isContentAddressedFile(fileName) && getFileHash(bytes) !== fileName.slice(0, 64)) {
          throw new Error(`Staged asset hash does not match its catalogue name: ${fileName}`);
        }

        return {
          contentType,
          filePath,
          key: `${STORAGE_PREFIX}/${fileName}`,
          sizeBytes: stats.size,
        };
      }),
    status: sourceManifest.mediaStatus,
  };
}

async function readStoredObject(item) {
  try {
    const head = await headStorageObject({ key: item.key });
    if (head.ContentType !== item.contentType || head.ContentLength !== item.sizeBytes) {
      throw new Error(`Refusing to overwrite incompatible object: ${item.key}`);
    }
    return true;
  } catch (error) {
    if (isMissingObjectError(error)) return false;
    throw error;
  }
}

function writePublishedManifest(filePath, sourceManifest) {
  if (sourceManifest.mediaStatus === "published") return;
  writeFileSync(filePath, `${JSON.stringify({ ...sourceManifest, mediaStatus: "published" }, null, 2)}\n`);
}

function isSafeAssetFileName(value) {
  return /^[a-f0-9]{64}(?:-poster)?\.(?:jpeg|jpg|mp4|png|webp)$/u.test(value);
}

function isContentAddressedFile(fileName) {
  return !fileName.includes("-poster.");
}

function getFileHash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isMissingObjectError(error) {
  return typeof error === "object" && error !== null &&
    (("code" in error && error.code === "NoSuchKey") || ("Code" in error && error.Code === "NoSuchKey"));
}

function assertRuntimeReady() {
  const missing = getMissingStorageEnvVars();
  if (missing.length > 0) {
    throw new Error(`Missing GCP storage configuration: ${missing.join(", ")}`);
  }
  if (getStorageProviderName() !== "gcp") {
    throw new Error(`Explore Recreate media requires GCP storage; received ${getStorageProviderName()}.`);
  }
}

function printPlan({ assetsDirectory: sourceDirectory, execute: shouldExecute, manifestPath: sourceManifestPath, plan: currentPlan }) {
  console.log("Explore Recreate media import");
  console.log(`Mode: ${shouldExecute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Manifest: ${sourceManifestPath}`);
  console.log(`Staged media: ${sourceDirectory}`);
  console.log(`Current catalogue status: ${currentPlan.status}`);
  console.log(`Storage prefix: ${STORAGE_PREFIX}`);
  console.log(`Assets: ${currentPlan.items.length}`);
  console.log(`Total bytes: ${currentPlan.items.reduce((total, item) => total + item.sizeBytes, 0)}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2].trim();
    process.env[match[1]] = rawValue.startsWith('"') && rawValue.endsWith('"') || rawValue.startsWith("'") && rawValue.endsWith("'")
      ? rawValue.slice(1, -1)
      : rawValue;
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  const booleanFlags = new Set(["execute", "yes"]);
  const valueFlags = new Set(["assets", "manifest"]);

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2);
    if (booleanFlags.has(key)) {
      parsed[key] = true;
      continue;
    }
    if (!valueFlags.has(key)) throw new Error(`Unknown option: --${key}`);
    const value = rawArgs[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}
