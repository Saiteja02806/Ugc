import { Storage } from "@google-cloud/storage";
import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";

const ALLOWED_GCP_PREFIXES = [
  "avatars/global/",
  "avatars/thumbnails/",
];
const RESULT_ROOT = ".tmp/hook-video-catalog-reset";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to reset the Hook catalog without --yes. Run the dry-run first, then use --execute --yes.",
  );
}

assertGcpStorageProvider();

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
const bucketName = getRequiredEnv(
  "GCP_STORAGE_BUCKET",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
);
const projectId = getOptionalEnv("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT");
const credentials = getGoogleServiceAccountCredentials();
const storage = new Storage({
  ...(credentials ? { credentials } : {}),
  ...(projectId ? { projectId } : {}),
});
const bucket = storage.bucket(bucketName);
const generatedAt = new Date().toISOString();
const resultDir = path.resolve(
  RESULT_ROOT,
  generatedAt.replace(/[:.]/g, "-"),
);
const manifestPath = path.join(resultDir, "before-reset.json");
const resultPath = path.join(resultDir, "reset-result.json");

const [
  avatarAssets,
  avatarPreferences,
  hookSuggestions,
  hookAssignments,
  hookDrafts,
  bucketMetadata,
  gcpObjects,
] = await Promise.all([
  selectAll("avatar_assets", "*"),
  selectAll("user_avatar_preferences", "*"),
  selectAll("hook_video_suggestions", "*"),
  selectAll("user_hook_video_assignments", "*"),
  selectAll("hook_video_drafts", "*"),
  getBucketMetadata(),
  listTargetedGcpObjects(),
]);

const catalogSuggestions = hookSuggestions.filter(
  (suggestion) => suggestion.influencer_source === "catalog",
);
const catalogSuggestionIds = new Set(
  catalogSuggestions.map((suggestion) => suggestion.id),
);
const catalogAssignments = hookAssignments.filter((assignment) =>
  catalogSuggestionIds.has(assignment.hook_suggestion_id),
);
const catalogDrafts = hookDrafts.filter(
  (draft) => draft.influencer_source === "catalog",
);

assertResetSafety({
  avatarAssets,
  catalogAssignments,
  catalogDrafts,
  catalogSuggestions,
  gcpObjects,
});

const manifest = {
  generatedAt,
  scope: {
    database: [
      "avatar_assets",
      "user_avatar_preferences rows linked to avatar_assets",
      "catalog-backed hook_video_suggestions",
      "user_hook_video_assignments linked to catalog-backed suggestions",
    ],
    gcpPrefixes: ALLOWED_GCP_PREFIXES,
    preserved: [
      "Carousel assets and records",
      "Wall-of-text assets and records",
      "User-uploaded Hook videos",
      "Hook suggestions and drafts backed by user-uploaded videos",
    ],
  },
  database: {
    avatarAssets,
    avatarPreferences,
    catalogAssignments,
    catalogSuggestions,
    hookDrafts,
  },
  gcp: {
    bucket: bucketName,
    objectVersioningEnabled: Boolean(bucketMetadata.versioning?.enabled),
    softDeletePolicy: bucketMetadata.softDeletePolicy ?? null,
    objects: gcpObjects,
  },
};

mkdirSync(resultDir, { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

printPlan({
  avatarAssets,
  avatarPreferences,
  catalogAssignments,
  catalogDrafts,
  catalogSuggestions,
  execute,
  gcpObjects,
  manifestPath,
});

if (!execute) {
  console.log("Dry run complete. GCP and Supabase were not changed.");
  process.exit(0);
}

const resetResult = {
  completedAt: null,
  database: null,
  failedAt: null,
  failure: null,
  gcp: null,
  manifestPath,
  startedAt: new Date().toISOString(),
};

try {
  resetResult.database = await resetDatabase({
    avatarAssetIds: avatarAssets.map((asset) => asset.id),
    catalogSuggestionIds: [...catalogSuggestionIds],
  });
  writeResult();

  resetResult.gcp = await deleteGcpObjects(gcpObjects);
  writeResult();

  await verifyReset({
    avatarAssetIds: avatarAssets.map((asset) => asset.id),
    catalogSuggestionIds: [...catalogSuggestionIds],
  });

  resetResult.completedAt = new Date().toISOString();
  writeResult();
  console.log("Hook catalog reset complete.");
  console.log(`Result: ${resultPath}`);
} catch (error) {
  resetResult.failedAt = new Date().toISOString();
  resetResult.failure =
    error instanceof Error ? error.message : String(error);
  writeResult();
  throw error;
}

function writeResult() {
  writeFileSync(resultPath, `${JSON.stringify(resetResult, null, 2)}\n`);
}

async function selectAll(table, columns) {
  const rows = [];
  const pageSize = 500;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(start, start + pageSize - 1);

    if (error) {
      throw new Error(`Could not load ${table}: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      return rows;
    }
  }
}

async function getBucketMetadata() {
  const [metadata] = await bucket.getMetadata();

  return metadata;
}

async function listTargetedGcpObjects() {
  const objectsByIdentity = new Map();

  for (const prefix of ALLOWED_GCP_PREFIXES) {
    const [files] = await bucket.getFiles({
      autoPaginate: true,
      prefix,
      versions: true,
    });

    for (const file of files) {
      if (!file.name.startsWith(prefix)) {
        throw new Error(
          `GCP returned an object outside the requested prefix: ${file.name}`,
        );
      }

      const [metadata] = await file.getMetadata();
      const generation = String(metadata.generation ?? file.generation ?? "");
      const identity = `${file.name}#${generation}`;

      objectsByIdentity.set(identity, {
        contentType: metadata.contentType ?? null,
        crc32c: metadata.crc32c ?? null,
        generation: generation || null,
        md5Hash: metadata.md5Hash ?? null,
        name: file.name,
        size: metadata.size ?? null,
        storageClass: metadata.storageClass ?? null,
        timeCreated: metadata.timeCreated ?? null,
        updated: metadata.updated ?? null,
      });
    }
  }

  return [...objectsByIdentity.values()].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);

    if (nameOrder !== 0) {
      return nameOrder;
    }

    return String(left.generation).localeCompare(String(right.generation));
  });
}

function assertResetSafety({
  avatarAssets,
  catalogAssignments,
  catalogDrafts,
  catalogSuggestions,
  gcpObjects,
}) {
  if (catalogDrafts.length > 0) {
    throw new Error(
      `Refusing to reset: ${catalogDrafts.length} saved Hook draft(s) still reference catalog videos.`,
    );
  }

  const unsafeAssetKeys = avatarAssets
    .map((asset) => asset.source_s3_key)
    .filter(
      (key) =>
        typeof key !== "string" ||
        !key.startsWith("avatars/global/"),
    );

  if (unsafeAssetKeys.length > 0) {
    throw new Error(
      `Refusing to reset: ${unsafeAssetKeys.length} avatar asset key(s) are outside avatars/global/.`,
    );
  }

  const unsafeObjects = gcpObjects.filter(
    (object) =>
      !ALLOWED_GCP_PREFIXES.some((prefix) =>
        object.name.startsWith(prefix),
      ),
  );

  if (unsafeObjects.length > 0) {
    throw new Error(
      `Refusing to reset: ${unsafeObjects.length} GCP object(s) are outside the Hook catalog prefixes.`,
    );
  }

  const catalogSuggestionIdSet = new Set(
    catalogSuggestions.map((suggestion) => suggestion.id),
  );
  const unsafeAssignments = catalogAssignments.filter(
    (assignment) =>
      !catalogSuggestionIdSet.has(assignment.hook_suggestion_id),
  );

  if (unsafeAssignments.length > 0) {
    throw new Error(
      "Refusing to reset: a Hook assignment is outside the catalog suggestion set.",
    );
  }
}

async function resetDatabase({
  avatarAssetIds,
  catalogSuggestionIds,
}) {
  const deletedCatalogSuggestionIds = await deleteRowsByIds(
    "hook_video_suggestions",
    catalogSuggestionIds,
  );
  const deletedAvatarAssetIds = await deleteRowsByIds(
    "avatar_assets",
    avatarAssetIds,
  );

  return {
    deletedAvatarAssetCount: deletedAvatarAssetIds.length,
    deletedCatalogSuggestionCount: deletedCatalogSuggestionIds.length,
  };
}

async function deleteRowsByIds(table, ids) {
  const deletedIds = [];
  const chunkSize = 100;

  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);

    if (chunk.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from(table)
      .delete()
      .in("id", chunk)
      .select("id");

    if (error) {
      throw new Error(`Could not delete ${table}: ${error.message}`);
    }

    deletedIds.push(...(data ?? []).map((row) => row.id));
  }

  if (deletedIds.length !== ids.length) {
    throw new Error(
      `Expected to delete ${ids.length} ${table} row(s), but deleted ${deletedIds.length}.`,
    );
  }

  return deletedIds;
}

async function deleteGcpObjects(gcpObjects) {
  const deleted = [];
  const failures = [];
  const concurrency = 10;

  for (let start = 0; start < gcpObjects.length; start += concurrency) {
    const batch = gcpObjects.slice(start, start + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (object) => {
        const file = bucket.file(object.name, {
          ...(object.generation
            ? { generation: object.generation }
            : {}),
        });

        await file.delete({ ignoreNotFound: true });
        return object;
      }),
    );

    for (let index = 0; index < batchResults.length; index += 1) {
      const outcome = batchResults[index];
      const object = batch[index];

      if (outcome.status === "fulfilled") {
        deleted.push(object);
      } else {
        failures.push({
          generation: object.generation,
          message:
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason),
          name: object.name,
        });
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Could not delete ${failures.length} GCP Hook object(s): ${JSON.stringify(failures)}`,
    );
  }

  return {
    deletedObjectCount: deleted.length,
    deletedObjects: deleted,
  };
}

async function verifyReset({
  avatarAssetIds,
  catalogSuggestionIds,
}) {
  const [
    remainingAssets,
    remainingSuggestions,
    remainingAssignments,
    remainingGcpObjects,
  ] = await Promise.all([
    countRowsByIds("avatar_assets", avatarAssetIds),
    countRowsByIds("hook_video_suggestions", catalogSuggestionIds),
    countAssignmentsBySuggestionIds(catalogSuggestionIds),
    listTargetedGcpObjects(),
  ]);

  if (
    remainingAssets !== 0 ||
    remainingSuggestions !== 0 ||
    remainingAssignments !== 0 ||
    remainingGcpObjects.length !== 0
  ) {
    throw new Error(
      [
        "Hook catalog reset verification failed.",
        `avatar_assets=${remainingAssets}`,
        `catalog_suggestions=${remainingSuggestions}`,
        `catalog_assignments=${remainingAssignments}`,
        `gcp_objects=${remainingGcpObjects.length}`,
      ].join(" "),
    );
  }
}

async function countRowsByIds(table, ids) {
  if (ids.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("id", ids);

  if (error) {
    throw new Error(`Could not verify ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function countAssignmentsBySuggestionIds(ids) {
  if (ids.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("user_hook_video_assignments")
    .select("id", { count: "exact", head: true })
    .in("hook_suggestion_id", ids);

  if (error) {
    throw new Error(
      `Could not verify Hook assignments: ${error.message}`,
    );
  }

  return count ?? 0;
}

function printPlan({
  avatarAssets,
  avatarPreferences,
  catalogAssignments,
  catalogDrafts,
  catalogSuggestions,
  execute,
  gcpObjects,
  manifestPath,
}) {
  console.log(execute ? "Hook catalog reset" : "Hook catalog reset dry run");
  console.log(`Recovery manifest: ${manifestPath}`);
  console.log(`GCP bucket: ${bucketName}`);
  console.log(`GCP prefixes: ${ALLOWED_GCP_PREFIXES.join(", ")}`);
  console.log(`GCP object versions to delete: ${gcpObjects.length}`);
  console.log(`avatar_assets rows to delete: ${avatarAssets.length}`);
  console.log(
    `user_avatar_preferences rows removed by cascade: ${avatarPreferences.length}`,
  );
  console.log(
    `catalog hook_video_suggestions rows to delete: ${catalogSuggestions.length}`,
  );
  console.log(
    `user_hook_video_assignments rows removed by cascade: ${catalogAssignments.length}`,
  );
  console.log(`saved catalog Hook drafts: ${catalogDrafts.length}`);
}

function assertGcpStorageProvider() {
  const provider = (
    process.env.STORAGE_PROVIDER ??
    process.env.UGC_STORAGE_PROVIDER ??
    ""
  )
    .trim()
    .toLowerCase();

  if (provider !== "gcp" && provider !== "gcs") {
    throw new Error(
      `Refusing to reset: configured storage provider is "${provider || "unset"}", not GCP.`,
    );
  }
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getRequiredEnv(...names) {
  const value = getOptionalEnv(...names);

  if (!value) {
    throw new Error(`Missing ${names.join(" or ")}`);
  }

  return value;
}

function getOptionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function parseArgs(rawArgs) {
  return Object.fromEntries(
    rawArgs
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => [arg.slice(2), true]),
  );
}
