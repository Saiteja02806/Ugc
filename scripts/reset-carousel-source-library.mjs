import { Storage } from "@google-cloud/storage";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OBJECT_PREFIX = "category-library/";
const EXECUTE = process.argv.includes("--execute");
const CONFIRMED = process.argv.includes("--yes");

if (EXECUTE && !CONFIRMED) {
  throw new Error("Pass --yes with --execute to reset the Carousel source library.");
}

loadEnvFile(path.resolve(".env.local"));

const supabaseUrl = requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const supabaseAccessToken = requiredEnv("SUPABASE_ACCESS_TOKEN");
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const storageBucket = requiredEnv("GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET");
const googleCredentials = getGoogleCredentials();
const storage = new Storage({
  ...(googleCredentials ? { credentials: googleCredentials } : {}),
  ...(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
    ? { projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT }
    : {}),
});
const bucket = storage.bucket(storageBucket);

const inventory = await queryDatabase(
  `select id, base_s3_key, thumb_s3_key, source_original_s3_key
   from public.category_image_assets
   order by id`,
);
const objectKeys = unique(
  inventory.flatMap((asset) => [
    asset.base_s3_key,
    asset.thumb_s3_key,
    asset.source_original_s3_key,
  ]),
);

assertOnlyCarouselLibraryKeys(objectKeys);

const initialState = await queryDatabase(`
  select
    (select count(*)::int from public.category_image_assets) as asset_count,
    (
      select count(*)::int
      from public.background_jobs
      where job_type in ('generate_carousel', 'render_trending_carousel_edit')
        and status not in ('completed', 'failed', 'cancelled')
    ) as active_carousel_job_count,
    (
      select count(*)::int
      from public.user_carousel_assignments
      where state in ('pending', 'in_progress', 'accepted')
    ) as active_assignment_count,
    (select count(*)::int from public.carousel_slides where category_image_asset_id is not null)
      as source_pointer_count,
    (select count(*)::int from public.carousel_image_usage) as image_usage_count
`);
const state = initialState[0];

if (!state) {
  throw new Error("Could not read the Carousel reset preflight state.");
}

if (Number(state.asset_count) !== inventory.length) {
  throw new Error(
    `Carousel asset inventory changed during preflight (${state.asset_count} rows versus ${inventory.length} fetched). Re-run the reset.`,
  );
}

const report = {
  assetCount: inventory.length,
  dryRun: !EXECUTE,
  gcsObjectCount: objectKeys.length,
  activeCarouselJobCount: Number(state.active_carousel_job_count),
  activeAssignmentCount: Number(state.active_assignment_count),
  sourcePointerCount: Number(state.source_pointer_count),
  imageUsageCount: Number(state.image_usage_count),
};

if (!EXECUTE) {
  console.log(JSON.stringify({ ...report, action: "dry_run" }, null, 2));
  process.exit(0);
}

if (Number(state.active_carousel_job_count) > 0) {
  throw new Error(
    "Carousel source reset stopped because Carousel jobs are active. Cancel or finish them, then re-run this command.",
  );
}

await assertStorageDeletePermission();

const archived = await queryDatabase(`
  begin;
  select pg_advisory_xact_lock(hashtext('carousel-source-library-reset-v1'));

  do $$
  begin
    if exists (
      select 1
      from public.background_jobs
      where job_type in ('generate_carousel', 'render_trending_carousel_edit')
        and status not in ('completed', 'failed', 'cancelled')
    ) then
      raise exception 'carousel_source_library_reset_has_active_jobs';
    end if;
  end;
  $$;

  with retired as (
    update public.user_carousel_assignments
    set
      state = 'failed',
      completion_action = null,
      completed_at = now(),
      updated_at = now()
    where state in ('pending', 'in_progress', 'accepted')
    returning 1
  ), archived_assets as (
    update public.category_image_assets
    set status = 'archived', updated_at = now()
    where status <> 'archived'
    returning 1
  )
  select
    (select count(*)::int from retired) as retired_assignment_count,
    (select count(*)::int from archived_assets) as archived_asset_count;
  commit;
`);

const archivedState = archived.at(-1);

await deleteGcsObjects(objectKeys);

const finalized = await queryDatabase(`
  begin;
  select pg_advisory_xact_lock(hashtext('carousel-source-library-reset-v1'));

  do $$
  begin
    if exists (
      select 1
      from public.background_jobs
      where job_type in ('generate_carousel', 'render_trending_carousel_edit')
        and status not in ('completed', 'failed', 'cancelled')
    ) then
      raise exception 'carousel_source_library_reset_has_active_jobs';
    end if;
  end;
  $$;

  with cleared_pointers as (
    update public.carousel_slides
    set category_image_asset_id = null, updated_at = now()
    where category_image_asset_id is not null
    returning 1
  ), deleted_usage as (
    delete from public.carousel_image_usage
    returning 1
  ), deleted_assets as (
    delete from public.category_image_assets
    returning 1
  )
  select
    (select count(*)::int from cleared_pointers) as cleared_source_pointer_count,
    (select count(*)::int from deleted_usage) as deleted_image_usage_count,
    (select count(*)::int from deleted_assets) as deleted_asset_count;
  commit;
`);

const finalState = await queryDatabase(`
  select
    (select count(*)::int from public.category_image_assets) as asset_count,
    (select count(*)::int from public.carousel_slides where category_image_asset_id is not null)
      as source_pointer_count,
    (select count(*)::int from public.carousel_image_usage) as image_usage_count
`);
const finalCounts = finalState[0];

if (
  !finalCounts ||
  Number(finalCounts.asset_count) !== 0 ||
  Number(finalCounts.source_pointer_count) !== 0 ||
  Number(finalCounts.image_usage_count) !== 0
) {
  throw new Error("Carousel source reset finished with unexpected database rows remaining.");
}

const completionReport = {
  ...report,
  action: "executed",
  archivedAssetCount: Number(archivedState?.archived_asset_count ?? 0),
  retiredAssignmentCount: Number(archivedState?.retired_assignment_count ?? 0),
  clearedSourcePointerCount: Number(finalized.at(-1)?.cleared_source_pointer_count ?? 0),
  deletedAssetCount: Number(finalized.at(-1)?.deleted_asset_count ?? 0),
  deletedImageUsageCount: Number(finalized.at(-1)?.deleted_image_usage_count ?? 0),
  finalAssetCount: Number(finalCounts.asset_count),
  finalImageUsageCount: Number(finalCounts.image_usage_count),
  finalSourcePointerCount: Number(finalCounts.source_pointer_count),
};

const reportDirectory = path.resolve(".tmp", "carousel-source-library-reset");
mkdirSync(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, `reset-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(reportPath, `${JSON.stringify(completionReport, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ ...completionReport, reportPath }, null, 2));

async function queryDatabase(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase SQL request failed (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}

async function deleteGcsObjects(keys) {
  const concurrency = 24;
  let nextIndex = 0;
  const failures = [];

  async function worker() {
    while (nextIndex < keys.length) {
      const key = keys[nextIndex++];

      try {
        await bucket.file(key).delete({ ignoreNotFound: true });
      } catch (error) {
        failures.push({
          error: error instanceof Error ? error.message : String(error),
          key,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, keys.length) }, () => worker()),
  );

  if (failures.length > 0) {
    throw new Error(
      `GCS deletion failed for ${failures.length} Carousel source object(s). First failure: ${JSON.stringify(failures[0])}`,
    );
  }
}

async function assertStorageDeletePermission() {
  const [permissions] = await bucket.iam.testPermissions([
    "storage.objects.delete",
  ]);

  if (!permissions["storage.objects.delete"]) {
    throw new Error(
      `The current Google Cloud credentials cannot delete objects from gs://${storageBucket}.`,
    );
  }
}

function assertOnlyCarouselLibraryKeys(keys) {
  if (keys.length === 0) {
    throw new Error("No Carousel source objects were found. Refusing an empty reset.");
  }

  const unsafeKey = keys.find((key) => !key.startsWith(OBJECT_PREFIX));

  if (unsafeKey) {
    throw new Error(
      `Refusing to delete a source object outside ${OBJECT_PREFIX}: ${unsafeKey}`,
    );
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    const value = match[2].trim();
    process.env[match[1]] =
      value.length >= 2 &&
      value.charCodeAt(0) === value.charCodeAt(value.length - 1) &&
      [34, 39].includes(value.charCodeAt(0))
        ? value.slice(1, -1)
        : value;
  }
}

function requiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}

function getGoogleCredentials() {
  const json = firstEnv(
    "GOOGLE_CLOUD_CREDENTIALS_JSON",
    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    "GCP_SERVICE_ACCOUNT_KEY_JSON",
  );

  if (json) {
    const parsed = parseJsonOrBase64Json(json);

    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
      throw new Error("Google Cloud credentials JSON is incomplete.");
    }

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  }

  const clientEmail = firstEnv("GOOGLE_CLOUD_CLIENT_EMAIL", "GCP_CLIENT_EMAIL");
  const privateKey = firstEnv("GOOGLE_CLOUD_PRIVATE_KEY", "GCP_PRIVATE_KEY");

  if (!clientEmail && !privateKey) {
    return null;
  }

  if (!clientEmail || !privateKey) {
    throw new Error("Google Cloud credentials are incomplete.");
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

function firstEnv(...names) {
  return names.map((name) => process.env[name]?.trim()).find(Boolean) || null;
}

function parseJsonOrBase64Json(value) {
  for (const candidate of [value, Buffer.from(value, "base64").toString("utf8")]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next supported encoding.
    }
  }

  throw new Error("Google Cloud credentials JSON is invalid.");
}
