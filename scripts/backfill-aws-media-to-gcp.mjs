import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { AWS_MEDIA_BACKFILL_TABLE_SPECS } from "../lib/internal/aws-media-backfill-audit.ts";
import { buildCloudFrontUrl, headS3Object, uploadBufferToS3 } from "../lib/storage/s3.ts";

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_OBJECTS = 25;
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

const PRIMARY_KEY_BY_TABLE = new Map([["video_render_jobs", "render_id"]]);
const LOCAL_ADC_PATH = resolve(
  ".tools",
  "gcloud-config",
  "application_default_credentials.json",
);

const options = parseArguments(process.argv.slice(2));
const envFilePath = resolve(options.envFile ?? ".env.local");

loadEnvFile(envFilePath, { override: !options.preserveEnv });
configureGcpStorageRuntime();

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

const plan = await buildBackfillPlan();
const selectedObjects = selectObjectsForRun(plan);
const selectedKeys = new Set(selectedObjects.map((object) => object.key));
const writableRows = selectWritableRows(plan, selectedKeys);

if (options.json && options.mode === "dry-run") {
  console.log(
    JSON.stringify(buildDryRunSummary(plan, selectedObjects, writableRows), null, 2),
  );
  process.exit(0);
}

if (options.mode !== "execute") {
  printDryRunSummary(plan, selectedObjects, writableRows);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to backfill production media without --yes. Run dry-run first, then use --execute --yes.",
  );
}

const execution = await executeBackfill({
  objects: selectedObjects,
  rows: writableRows,
});

if (options.json) {
  console.log(JSON.stringify(execution, null, 2));
} else {
  printExecutionSummary(execution);
}

if (execution.failedObjects.length > 0 || execution.failedRows.length > 0) {
  process.exitCode = 1;
}

async function buildBackfillPlan() {
  const tableFilters = new Set(options.tables);
  const tablePlans = [];
  const objectByKey = new Map();
  let scannedRows = 0;
  let awsReferences = 0;
  let rowsWithAwsReferences = 0;
  let skippedTables = 0;

  for (const spec of AWS_MEDIA_BACKFILL_TABLE_SPECS) {
    if (tableFilters.size > 0 && !tableFilters.has(spec.name)) {
      continue;
    }

    const tablePlan = await scanTable(spec);
    tablePlans.push(tablePlan);

    if (tablePlan.skipped) {
      skippedTables += 1;
      continue;
    }

    scannedRows += tablePlan.scannedRows;
    rowsWithAwsReferences += tablePlan.rows.length;

    for (const rowPlan of tablePlan.rows) {
      awsReferences += rowPlan.references.length;

      for (const reference of rowPlan.references) {
        if (!objectByKey.has(reference.key)) {
          objectByKey.set(reference.key, {
            contentType: reference.contentType,
            key: reference.key,
            references: 0,
            sourceUrl: reference.sourceUrl,
            sourceUrls: new Set(),
            targetUrl: reference.targetUrl,
          });
        }

        const object = objectByKey.get(reference.key);
        object.references += 1;
        object.sourceUrls.add(reference.sourceUrl);
      }
    }
  }

  return {
    envFile: envFilePath,
    gcpPublicBaseUrl: getRequiredEnv(
      "GCP_STORAGE_PUBLIC_BASE_URL",
      "GCS_PUBLIC_BASE_URL",
    ),
    storageBucket: getRequiredEnv("GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET"),
    supabaseProjectRef: getSupabaseProjectRef(
      getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    ),
    tablePlans,
    totals: {
      awsReferences,
      scannedRows,
      skippedTables,
      tables: tablePlans.length,
      uniqueObjects: objectByKey.size,
      writableRows: rowsWithAwsReferences,
    },
    uniqueObjects: [...objectByKey.values()].map((object) => ({
      ...object,
      sourceUrls: [...object.sourceUrls],
    })),
  };
}

async function scanTable(spec) {
  const selectedColumns = [
    ...new Set([...spec.identityColumns, ...spec.mediaColumns]),
  ];
  const rows = [];
  let scannedRows = 0;

  for (let from = 0; ; from += options.pageSize) {
    const { data, error } = await supabase
      .from(spec.name)
      .select(selectedColumns.join(","))
      .range(from, from + options.pageSize - 1);

    if (error) {
      if (isMissingRelationOrColumnError(error)) {
        return {
          error: error.message,
          name: spec.name,
          rows,
          scannedRows,
          skipped: true,
        };
      }

      throw new Error(`Failed to scan ${spec.name}: ${error.message}`);
    }

    const pageRows = data ?? [];
    scannedRows += pageRows.length;

    for (const row of pageRows) {
      const rowPlan = buildRowPlan(spec, row);

      if (rowPlan.references.length > 0) {
        rows.push(rowPlan);
      }
    }

    if (pageRows.length < options.pageSize) {
      return {
        error: null,
        name: spec.name,
        rows,
        scannedRows,
        skipped: false,
      };
    }
  }
}

function buildRowPlan(spec, row) {
  const primaryKeyColumn = PRIMARY_KEY_BY_TABLE.get(spec.name) ?? "id";
  const primaryKeyValue = row[primaryKeyColumn];

  if (primaryKeyValue === undefined || primaryKeyValue === null) {
    throw new Error(
      `Cannot backfill ${spec.name}: missing primary key column ${primaryKeyColumn}.`,
    );
  }

  const references = [];

  for (const column of spec.mediaColumns) {
    collectAwsMediaReferences({
      column,
      path: column,
      references,
      value: row[column],
    });
  }

  return {
    primaryKeyColumn,
    primaryKeyValue,
    references,
    row,
    spec,
  };
}

function collectAwsMediaReferences(params) {
  const { column, path, references, value } = params;

  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    const match = getAwsMediaObject(value);

    if (match) {
      references.push({
        column,
        contentType: guessContentType(match.key),
        key: match.key,
        path,
        sourceUrl: match.sourceUrl,
        targetUrl: buildCloudFrontUrl(match.key),
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectAwsMediaReferences({
        column,
        path: `${path}[${index}]`,
        references,
        value: entry,
      });
    });
    return;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectAwsMediaReferences({
        column,
        path: `${path}.${key}`,
        references,
        value: nestedValue,
      });
    }
  }
}

function selectObjectsForRun(plan) {
  if (options.all) {
    return plan.uniqueObjects;
  }

  return plan.uniqueObjects.slice(0, options.maxObjects);
}

function selectWritableRows(plan, selectedKeys) {
  return plan.tablePlans.flatMap((tablePlan) => {
    if (tablePlan.skipped) {
      return [];
    }

    return tablePlan.rows
      .map((rowPlan) => {
        const selectedReferences = rowPlan.references.filter((reference) =>
          selectedKeys.has(reference.key),
        );

        return {
          ...rowPlan,
          selectedReferences,
        };
      })
      .filter((rowPlan) => rowPlan.selectedReferences.length > 0);
  });
}

async function executeBackfill(params) {
  const copiedObjects = [];
  const existingObjects = [];
  const failedObjects = [];
  const replacementBySourceUrl = new Map();

  for (const object of params.objects) {
    try {
      const alreadyExists = await gcpObjectExists(object.key);

      if (alreadyExists) {
        existingObjects.push(object);
      } else {
        await copyObjectToGcp(object);
        copiedObjects.push(object);
      }

      for (const sourceUrl of object.sourceUrls) {
        replacementBySourceUrl.set(sourceUrl, object.targetUrl);
      }
    } catch (error) {
      failedObjects.push({
        error: getErrorMessage(error),
        key: object.key,
        sourceUrl: object.sourceUrl,
      });
    }
  }

  const updatedRows = [];
  const unchangedRows = [];
  const failedRows = [];
  let rewrittenReferences = 0;

  for (const rowPlan of params.rows) {
    const rewrite = buildRowPatch(rowPlan, replacementBySourceUrl);

    if (Object.keys(rewrite.patch).length === 0) {
      unchangedRows.push({
        primaryKey: rowPlan.primaryKeyValue,
        table: rowPlan.spec.name,
      });
      continue;
    }

    try {
      const { error } = await supabase
        .from(rowPlan.spec.name)
        .update(rewrite.patch)
        .eq(rowPlan.primaryKeyColumn, rowPlan.primaryKeyValue);

      if (error) {
        throw error;
      }

      updatedRows.push({
        columns: Object.keys(rewrite.patch),
        primaryKey: rowPlan.primaryKeyValue,
        references: rewrite.rewrittenReferences,
        table: rowPlan.spec.name,
      });
      rewrittenReferences += rewrite.rewrittenReferences;
    } catch (error) {
      failedRows.push({
        error: getErrorMessage(error),
        primaryKey: rowPlan.primaryKeyValue,
        table: rowPlan.spec.name,
      });
    }
  }

  return {
    copiedObjects,
    existingObjects,
    failedObjects,
    failedRows,
    mode: "execute",
    rewrittenReferences,
    selectedObjects: params.objects.length,
    skippedRowsWithoutCopiedObjects: unchangedRows,
    updatedRows,
  };
}

async function gcpObjectExists(key) {
  try {
    await headS3Object({ key });
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

async function copyObjectToGcp(object) {
  const response = await fetch(object.sourceUrl, {
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download source media: ${response.status} ${response.statusText}`,
    );
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    object.contentType ||
    "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());

  await uploadBufferToS3({
    buffer,
    cacheControl: DEFAULT_CACHE_CONTROL,
    contentType,
    key: object.key,
  });
}

function buildRowPatch(rowPlan, replacementBySourceUrl) {
  const patch = {};
  let rewrittenReferences = 0;

  for (const column of rowPlan.spec.mediaColumns) {
    const rewrite = rewriteValue(rowPlan.row[column], replacementBySourceUrl);

    if (rewrite.changed) {
      patch[column] = rewrite.value;
      rewrittenReferences += rewrite.rewrittenReferences;
    }
  }

  return { patch, rewrittenReferences };
}

function rewriteValue(value, replacementBySourceUrl) {
  if (typeof value === "string") {
    const replacement = replacementBySourceUrl.get(value.trim());

    if (!replacement) {
      return {
        changed: false,
        rewrittenReferences: 0,
        value,
      };
    }

    return {
      changed: true,
      rewrittenReferences: 1,
      value: replacement,
    };
  }

  if (Array.isArray(value)) {
    let changed = false;
    let rewrittenReferences = 0;
    const rewrittenArray = value.map((entry) => {
      const rewrite = rewriteValue(entry, replacementBySourceUrl);
      changed ||= rewrite.changed;
      rewrittenReferences += rewrite.rewrittenReferences;
      return rewrite.value;
    });

    return {
      changed,
      rewrittenReferences,
      value: changed ? rewrittenArray : value,
    };
  }

  if (value && typeof value === "object") {
    let changed = false;
    let rewrittenReferences = 0;
    const rewrittenObject = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const rewrite = rewriteValue(nestedValue, replacementBySourceUrl);
      changed ||= rewrite.changed;
      rewrittenReferences += rewrite.rewrittenReferences;
      rewrittenObject[key] = rewrite.value;
    }

    return {
      changed,
      rewrittenReferences,
      value: changed ? rewrittenObject : value,
    };
  }

  return {
    changed: false,
    rewrittenReferences: 0,
    value,
  };
}

function getAwsMediaObject(rawValue) {
  const value = rawValue.trim();

  if (!/^https?:\/\//i.test(value)) {
    return null;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();

  if (!isAwsMediaHost(host)) {
    return null;
  }

  const key = extractObjectKey(parsedUrl);

  if (!key || key.endsWith("/")) {
    return null;
  }

  return {
    key,
    sourceUrl: value,
  };
}

function isAwsMediaHost(host) {
  if (
    host.endsWith(".cloudfront.net") ||
    host === "s3.amazonaws.com" ||
    host.endsWith(".s3.amazonaws.com") ||
    /\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host) ||
    /^s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host)
  ) {
    return true;
  }

  return getAwsHostHints().has(host);
}

function getAwsHostHints() {
  return new Set(
    [
      process.env.CLOUDFRONT_DOMAIN,
      process.env.AWS_CLOUDFRONT_DOMAIN,
      process.env.AWS_STORAGE_PUBLIC_BASE_URL,
      process.env.AWS_S3_BUCKET && `${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`,
      process.env.AWS_S3_BUCKET &&
        process.env.AWS_REGION &&
        `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
    ]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => normalizeHostname(value))
      .filter(Boolean),
  );
}

function extractObjectKey(parsedUrl) {
  const host = parsedUrl.hostname.toLowerCase();
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const bucket = process.env.AWS_S3_BUCKET?.trim();

  if (host === "s3.amazonaws.com" || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host)) {
    if (bucket && pathSegments[0] === bucket) {
      return decodeKeySegments(pathSegments.slice(1));
    }

    return decodeKeySegments(pathSegments);
  }

  return decodeKeySegments(pathSegments);
}

function decodeKeySegments(pathSegments) {
  return pathSegments
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

function guessContentType(key) {
  const extension = extname(key).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  if (extension === ".mp4") {
    return "video/mp4";
  }

  if (extension === ".mov") {
    return "video/quicktime";
  }

  if (extension === ".webm") {
    return "video/webm";
  }

  return "application/octet-stream";
}

function buildDryRunSummary(plan, selectedObjects, writableRows) {
  return {
    envFile: plan.envFile,
    gcpPublicBaseUrl: plan.gcpPublicBaseUrl,
    mode: "dry-run",
    selectedObjects: selectedObjects.length,
    selectedRows: writableRows.length,
    storageBucket: plan.storageBucket,
    supabaseProjectRef: plan.supabaseProjectRef,
    tables: plan.tablePlans.map((tablePlan) => ({
      awsReferences: tablePlan.rows.reduce(
        (sum, rowPlan) => sum + rowPlan.references.length,
        0,
      ),
      error: tablePlan.error,
      name: tablePlan.name,
      rowsWithAwsReferences: tablePlan.rows.length,
      scannedRows: tablePlan.scannedRows,
      skipped: tablePlan.skipped,
    })),
    totals: plan.totals,
  };
}

function printDryRunSummary(plan, selectedObjects, writableRows) {
  console.log("AWS media to GCP backfill dry run");
  console.log(`Env file: ${plan.envFile}`);
  console.log(`Supabase project ref: ${plan.supabaseProjectRef}`);
  console.log(`GCP bucket: ${plan.storageBucket}`);
  console.log(`GCP public base URL: ${plan.gcpPublicBaseUrl}`);
  console.log(`Tables scanned: ${plan.totals.tables}`);
  console.log(`Tables skipped: ${plan.totals.skippedTables}`);
  console.log(`Rows scanned: ${plan.totals.scannedRows}`);
  console.log(`Rows with AWS media URLs: ${plan.totals.writableRows}`);
  console.log(`AWS media references: ${plan.totals.awsReferences}`);
  console.log(`Unique objects to copy: ${plan.totals.uniqueObjects}`);
  console.log(`Selected objects this run: ${selectedObjects.length}`);
  console.log(`Rows selected for rewrite this run: ${writableRows.length}`);
  console.log("");

  for (const tablePlan of plan.tablePlans) {
    if (tablePlan.skipped) {
      console.log(`SKIP ${tablePlan.name}: ${tablePlan.error}`);
      continue;
    }

    const referenceCount = tablePlan.rows.reduce(
      (sum, rowPlan) => sum + rowPlan.references.length,
      0,
    );

    console.log(
      [
        `TABLE ${tablePlan.name}`,
        `rows=${tablePlan.scannedRows}`,
        `rowsWithAwsRefs=${tablePlan.rows.length}`,
        `awsRefs=${referenceCount}`,
      ].join(" "),
    );
  }

  if (selectedObjects.length > 0) {
    console.log("");
    console.log("Selected object samples:");

    for (const object of selectedObjects.slice(0, options.sampleLimit)) {
      console.log(`- ${object.key} <- ${object.sourceUrl}`);
    }
  }

  console.log("");
  console.log(
    "No writes were made. Run with --execute --yes after reviewing this plan.",
  );
}

function printExecutionSummary(execution) {
  console.log("AWS media to GCP backfill execute result");
  console.log(`Selected objects: ${execution.selectedObjects}`);
  console.log(`Copied objects: ${execution.copiedObjects.length}`);
  console.log(`Already existing GCP objects: ${execution.existingObjects?.length ?? 0}`);
  console.log(`Failed objects: ${execution.failedObjects.length}`);
  console.log(`Updated rows: ${execution.updatedRows.length}`);
  console.log(`Rewritten media references: ${execution.rewrittenReferences}`);
  console.log(`Rows skipped without copied object: ${execution.skippedRowsWithoutCopiedObjects.length}`);
  console.log(`Failed rows: ${execution.failedRows.length}`);

  if (execution.failedObjects.length > 0) {
    console.log("");
    console.log("Failed objects:");

    for (const failure of execution.failedObjects.slice(0, options.sampleLimit)) {
      console.log(`- ${failure.key}: ${failure.error}`);
    }
  }

  if (execution.failedRows.length > 0) {
    console.log("");
    console.log("Failed rows:");

    for (const failure of execution.failedRows.slice(0, options.sampleLimit)) {
      console.log(`- ${failure.table}:${failure.primaryKey}: ${failure.error}`);
    }
  }
}

function parseArguments(args) {
  const parsed = {
    all: false,
    envFile: null,
    json: false,
    maxObjects: DEFAULT_MAX_OBJECTS,
    mode: "dry-run",
    pageSize: DEFAULT_PAGE_SIZE,
    preserveEnv: false,
    sampleLimit: 10,
    tables: [],
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run") {
      parsed.mode = "dry-run";
      continue;
    }

    if (argument === "--execute") {
      parsed.mode = "execute";
      continue;
    }

    if (argument === "--yes") {
      parsed.yes = true;
      continue;
    }

    if (argument === "--all") {
      parsed.all = true;
      continue;
    }

    if (argument === "--json") {
      parsed.json = true;
      continue;
    }

    if (argument === "--preserve-env") {
      parsed.preserveEnv = true;
      continue;
    }

    if (argument === "--env-file") {
      parsed.envFile = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--table") {
      parsed.tables.push(getRequiredArgumentValue(args, (index += 1), argument));
      continue;
    }

    if (argument === "--max-objects") {
      parsed.maxObjects = normalizeInteger(
        Number(getRequiredArgumentValue(args, (index += 1), argument)),
        DEFAULT_MAX_OBJECTS,
        1,
        10000,
      );
      continue;
    }

    if (argument === "--page-size") {
      parsed.pageSize = normalizeInteger(
        Number(getRequiredArgumentValue(args, (index += 1), argument)),
        DEFAULT_PAGE_SIZE,
        1,
        1000,
      );
      continue;
    }

    if (argument === "--sample-limit") {
      parsed.sampleLimit = normalizeInteger(
        Number(getRequiredArgumentValue(args, (index += 1), argument)),
        10,
        0,
        100,
      );
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  if (parsed.tables.length > 0) {
    const validTables = new Set(
      AWS_MEDIA_BACKFILL_TABLE_SPECS.map((spec) => spec.name),
    );
    const unknownTables = parsed.tables.filter((table) => !validTables.has(table));

    if (unknownTables.length > 0) {
      throw new Error(`Unknown table(s): ${unknownTables.join(", ")}.`);
    }
  }

  return parsed;
}

function configureGcpStorageRuntime() {
  process.env.STORAGE_PROVIDER = "gcp";
  process.env.UGC_STORAGE_PROVIDER = "gcp";
  process.env.GCP_PROJECT_ID ||= process.env.GOOGLE_CLOUD_PROJECT || "ugcsaas";
  process.env.GOOGLE_CLOUD_PROJECT ||= process.env.GCP_PROJECT_ID;

  const bucket = getRequiredEnv("GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET");
  process.env.GCP_STORAGE_PUBLIC_BASE_URL ||=
    process.env.GCS_PUBLIC_BASE_URL || `https://storage.googleapis.com/${bucket}`;
  process.env.GCS_PUBLIC_BASE_URL ||= process.env.GCP_STORAGE_PUBLIC_BASE_URL;

  if (
    !process.env.GOOGLE_CLOUD_CREDENTIALS_JSON &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(LOCAL_ADC_PATH)
  ) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = LOCAL_ADC_PATH;
  }
}

function loadEnvFile(envPath, settings) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (!settings.override && process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = cleanEnvValue(rawValue);
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

function normalizeHostname(value) {
  const rawValue = value.trim();
  const valueWithScheme = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try {
    return new URL(valueWithScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isMissingRelationOrColumnError(error) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist|Could not find/i.test(error.message ?? "")
  );
}

function isNotFoundError(error) {
  return (
    error?.name === "NoSuchKey" ||
    error?.Code === "NoSuchKey" ||
    error?.code === "NoSuchKey" ||
    error?.code === 404 ||
    error?.$metadata?.httpStatusCode === 404
  );
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function normalizeInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
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

function getSupabaseProjectRef(value) {
  try {
    const host = new URL(value).hostname;
    const [projectRef] = host.split(".");

    return projectRef || "unknown";
  } catch {
    return "unknown";
  }
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
