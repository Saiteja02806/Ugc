import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const RESULT_FILE_NAME = "metadata-sync-result.json";
const QUERY_BATCH_SIZE = 100;
const UPDATE_BATCH_SIZE = 25;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest ??
    findLatestManifest(DEFAULT_IMPORT_ROOT, "import-manifest.json"),
);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const execute = Boolean(args.execute);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to sync metadata without --yes. Run the default dry-run first, then use --execute --yes.",
  );
}

if (assets.length === 0 || manifest.errors?.length > 0) {
  throw new Error("Metadata sync requires a non-empty, error-free import manifest.");
}

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
const existingRows = await fetchExistingRows(assets);
const existingByBaseKey = new Map(
  existingRows.map((row) => [row.base_s3_key, row]),
);
const updates = assets.map((asset) =>
  buildValidatedUpdate(asset, existingByBaseKey.get(asset.storage.baseKey)),
);
const result = {
  completedAt: null,
  manifestPath,
  mode: execute ? "execute" : "dry-run",
  rowsMatched: updates.length,
  rowsUpdated: 0,
  startedAt: new Date().toISOString(),
};

printPlan(updates);

if (!execute) {
  console.log("");
  console.log("Dry run complete. No Supabase rows were changed.");
} else {
  for (const batch of chunkValues(updates, UPDATE_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .upsert(
        batch.map((item) => item.row),
        { onConflict: "id" },
      )
      .select("id,base_s3_key");

    if (error) {
      throw new Error(
        `Could not sync a batch of ${batch.length} category image rows: ${error.message}`,
      );
    }

    result.rowsUpdated += data?.length ?? 0;
  }

  if (result.rowsUpdated !== updates.length) {
    throw new Error(
      `Supabase returned ${result.rowsUpdated} updated rows; expected ${updates.length}.`,
    );
  }

  result.completedAt = new Date().toISOString();
  const resultPath = path.join(manifestDir, RESULT_FILE_NAME);
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`Updated ${result.rowsUpdated} local Carousel metadata rows.`);
  console.log(`Result: ${resultPath}`);
}

async function fetchExistingRows(manifestAssets) {
  const rows = [];
  const baseKeys = manifestAssets.map((asset) => asset.storage.baseKey);

  for (const chunk of chunkValues(baseKeys, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(
        [
          "id",
          "base_s3_key",
          "base_url",
          "source_file_sha256",
          "source_original_url",
          "thumb_url",
        ].join(","),
      )
      .in("base_s3_key", chunk);

    if (error) {
      throw new Error(`Could not read existing Carousel rows: ${error.message}`);
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

function buildValidatedUpdate(asset, existing) {
  if (!existing) {
    throw new Error(`${asset.assetKey}: production row does not exist.`);
  }

  if (existing.source_file_sha256 !== asset.dbRow.source_file_sha256) {
    throw new Error(
      `${asset.assetKey}: source hash differs from the production row; refusing to update metadata.`,
    );
  }

  if (
    !existing.base_url ||
    !existing.thumb_url ||
    !existing.source_original_url
  ) {
    throw new Error(
      `${asset.assetKey}: production storage URLs are incomplete; refusing metadata-only sync.`,
    );
  }

  return {
    asset,
    row: {
      ...asset.dbRow,
      base_url: existing.base_url,
      id: existing.id,
      source_original_url: existing.source_original_url,
      thumb_url: existing.thumb_url,
    },
  };
}

function printPlan(updates) {
  const groups = new Map();

  for (const update of updates) {
    const key = `${update.asset.categorySlug}/${update.asset.broadVisualBucket}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  console.log("Local Carousel metadata sync plan");
  console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Rows: ${updates.length}`);
  console.log("");

  for (const [key, count] of groups) {
    console.log(`${key}: ${count}`);
  }
}

function chunkValues(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
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
    throw new Error(`Latest manifest has no ${fileName}: ${latestDir}`);
  }

  return latestManifestPath;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (!process.env[key]) {
      process.env[key] = cleanEnvValue(rawValue);
    }
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
