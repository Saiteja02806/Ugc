import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFilePath = resolve(".env.local");
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_SAMPLE_LIMIT = 25;

const tableSpecs = [
  {
    identityColumns: ["id", "user_id", "project_id", "source_type", "status"],
    mediaColumns: ["storage_key", "url", "thumbnail_url", "metadata"],
    name: "media_assets",
  },
  {
    identityColumns: ["id", "category_slug", "status"],
    mediaColumns: [
      "base_s3_key",
      "thumb_s3_key",
      "source_original_s3_key",
      "base_url",
      "thumb_url",
      "source_original_url",
    ],
    name: "category_image_assets",
  },
  {
    identityColumns: ["id", "carousel_generation_id", "status"],
    mediaColumns: ["rendered_s3_key", "rendered_url"],
    name: "carousel_slides",
  },
  {
    identityColumns: ["id", "user_id", "project_id", "source_type", "status"],
    mediaColumns: ["cover_url", "thumbnail_url", "metadata"],
    name: "library_items",
  },
  {
    identityColumns: [
      "id",
      "library_item_id",
      "carousel_generation_id",
      "carousel_slide_id",
    ],
    mediaColumns: ["rendered_s3_key", "rendered_url", "metadata"],
    name: "library_carousel_slides",
  },
  {
    identityColumns: ["id", "user_id", "project_id", "status"],
    mediaColumns: [
      "source_s3_key",
      "source_video_url",
      "thumbnail_url",
      "rendered_video_url",
      "draft_json",
    ],
    name: "demo_videos",
  },
  {
    identityColumns: [
      "id",
      "user_id",
      "project_id",
      "source",
      "source_video_id",
      "status",
    ],
    mediaColumns: [
      "source_video_url",
      "thumbnail_url",
      "rendered_video_url",
      "draft_json",
    ],
    name: "editable_videos",
  },
  {
    identityColumns: [
      "render_id",
      "user_id",
      "project_id",
      "source_video_id",
      "status",
    ],
    mediaColumns: ["source_video_url", "output_s3_key", "output_url", "draft_json"],
    name: "video_render_jobs",
  },
  {
    identityColumns: ["id", "name", "status"],
    mediaColumns: ["source_s3_key", "source_video_url", "thumbnail_url", "metadata"],
    name: "avatar_assets",
  },
  {
    identityColumns: ["id", "asset_type", "status"],
    mediaColumns: [
      "s3_key",
      "preview_url",
      "thumbnail_s3_key",
      "thumbnail_url",
      "vision_metadata",
    ],
    name: "overlay_media_assets",
  },
  {
    identityColumns: ["id", "user_id", "project_id", "job_type", "queue_name", "status"],
    mediaColumns: ["input_json", "output_json"],
    name: "background_jobs",
  },
  {
    identityColumns: ["id", "user_id", "status"],
    mediaColumns: ["preview_thumbnail_url", "metadata"],
    name: "hook_video_drafts",
  },
];

const options = parseArguments(process.argv.slice(2));
const loadedEnvFilePath = resolve(options.envFile ?? envFilePath);

loadEnvFile(loadedEnvFilePath);

const pageSize = normalizeInteger(
  options.pageSize,
  DEFAULT_PAGE_SIZE,
  1,
  1000,
);
const sampleLimit = normalizeInteger(
  options.sampleLimit,
  DEFAULT_SAMPLE_LIMIT,
  0,
  100,
);
const awsMatchers = buildAwsMediaMatchers();
const gcpMatchers = buildGcpMediaMatchers();
const supabaseUrl = getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const supabase = createClient(
  supabaseUrl,
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const report = await auditAwsMediaReferences();

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (options.strict && report.totals.awsMediaReferences > 0) {
  process.exitCode = 1;
}

async function auditAwsMediaReferences() {
  const startedAt = new Date().toISOString();
  const tableReports = [];
  const totals = {
    awsMediaReferences: 0,
    gcpMediaReferences: 0,
    legacyNamedKeyValues: 0,
    rowsWithAwsMediaReferences: 0,
    rowsWithGcpMediaReferences: 0,
    rowsWithLegacyNamedKeyValues: 0,
    scannedRows: 0,
    skippedTables: 0,
    tables: tableSpecs.length,
  };

  for (const spec of tableSpecs) {
    const tableReport = await scanTable(spec);
    tableReports.push(tableReport);

    if (tableReport.skipped) {
      totals.skippedTables += 1;
      continue;
    }

    totals.scannedRows += tableReport.scannedRows;
    totals.awsMediaReferences += tableReport.awsMediaReferences;
    totals.gcpMediaReferences += tableReport.gcpMediaReferences;
    totals.legacyNamedKeyValues += tableReport.legacyNamedKeyValues;
    totals.rowsWithAwsMediaReferences += tableReport.rowsWithAwsMediaReferences;
    totals.rowsWithGcpMediaReferences += tableReport.rowsWithGcpMediaReferences;
    totals.rowsWithLegacyNamedKeyValues += tableReport.rowsWithLegacyNamedKeyValues;
  }

  return {
    awsHostHints: [...awsMatchers.hostHints],
    envFile: loadedEnvFilePath,
    gcpHostHints: [...gcpMatchers.hostHints],
    note:
      "Read-only audit. AWS media references are URL/string values matching S3, CloudFront, or configured AWS media host hints. Legacy *_s3_key column names are counted separately because new GCS rows may still use old column names.",
    pageSize,
    sampleLimit,
    startedAt,
    supabaseProjectRef: getSupabaseProjectRef(supabaseUrl),
    tableReports,
    totals,
  };
}

async function scanTable(spec) {
  const selectedColumns = [...spec.identityColumns, ...spec.mediaColumns];
  const tableReport = {
    awsMediaReferences: 0,
    byColumn: {},
    error: null,
    gcpMediaReferences: 0,
    legacyNamedKeyValues: 0,
    name: spec.name,
    rowsWithAwsMediaReferences: 0,
    rowsWithGcpMediaReferences: 0,
    rowsWithLegacyNamedKeyValues: 0,
    samples: [],
    scannedRows: 0,
    skipped: false,
  };

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(spec.name)
      .select(selectedColumns.join(","))
      .range(from, from + pageSize - 1);

    if (error) {
      tableReport.error = error.message;
      tableReport.skipped = isMissingRelationOrColumnError(error);
      return tableReport;
    }

    const rows = data ?? [];
    tableReport.scannedRows += rows.length;

    for (const row of rows) {
      scanRow({
        row,
        spec,
        tableReport,
      });
    }

    if (rows.length < pageSize) {
      return tableReport;
    }
  }
}

function scanRow(params) {
  const rowAwsMatches = [];
  let rowGcpMatchCount = 0;
  let rowLegacyNamedKeyCount = 0;

  for (const column of params.spec.mediaColumns) {
    const value = params.row[column];
    const valueMatches = collectStorageReferenceMatches(value, column);

    for (const match of valueMatches) {
      if (match.kind === "aws-media") {
        rowAwsMatches.push(match);
        params.tableReport.awsMediaReferences += 1;
        incrementColumnSummary(params.tableReport, column, "awsMediaReferences");
        continue;
      }

      if (match.kind === "gcp-media") {
        rowGcpMatchCount += 1;
        params.tableReport.gcpMediaReferences += 1;
        incrementColumnSummary(params.tableReport, column, "gcpMediaReferences");
        continue;
      }

      if (match.kind === "legacy-named-key") {
        rowLegacyNamedKeyCount += 1;
        params.tableReport.legacyNamedKeyValues += 1;
        incrementColumnSummary(
          params.tableReport,
          column,
          "legacyNamedKeyValues",
        );
      }
    }
  }

  if (rowAwsMatches.length > 0) {
    params.tableReport.rowsWithAwsMediaReferences += 1;
    addSamples({
      matches: rowAwsMatches,
      row: params.row,
      spec: params.spec,
      tableReport: params.tableReport,
    });
  }

  if (rowGcpMatchCount > 0) {
    params.tableReport.rowsWithGcpMediaReferences += 1;
  }

  if (rowLegacyNamedKeyCount > 0) {
    params.tableReport.rowsWithLegacyNamedKeyValues += 1;
  }
}

function collectStorageReferenceMatches(value, column, path = column) {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    return classifyStringValue(value, column, path);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectStorageReferenceMatches(entry, column, `${path}[${index}]`),
    );
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      collectStorageReferenceMatches(nestedValue, column, `${path}.${key}`),
    );
  }

  return [];
}

function classifyStringValue(rawValue, column, path) {
  const value = rawValue.trim();

  if (!value) {
    return [];
  }

  const awsMatch = awsMatchers.match(value);

  if (awsMatch) {
    return [
      {
        host: awsMatch.host,
        kind: "aws-media",
        path,
        value: summarizeValue(value),
      },
    ];
  }

  const gcpMatch = gcpMatchers.match(value);

  if (gcpMatch) {
    return [
      {
        host: gcpMatch.host,
        kind: "gcp-media",
        path,
        value: summarizeValue(value),
      },
    ];
  }

  if (isLegacyNamedObjectKeyColumn(column) && looksLikeObjectKey(value)) {
    return [
      {
        host: null,
        kind: "legacy-named-key",
        path,
        value: summarizeValue(value),
      },
    ];
  }

  return [];
}

function buildAwsMediaMatchers() {
  const hostHints = new Set(
    [
      process.env.CLOUDFRONT_DOMAIN,
      process.env.AWS_CLOUDFRONT_DOMAIN,
      process.env.AWS_STORAGE_PUBLIC_BASE_URL,
      process.env.AWS_S3_BUCKET && `${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`,
      process.env.AWS_S3_BUCKET &&
        process.env.AWS_REGION &&
        `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
    ]
      .filter(Boolean)
      .map(normalizeHostname)
      .filter(Boolean),
  );

  return {
    hostHints,
    match: (value) => {
      if (/^(s3:\/\/|arn:aws:s3)/i.test(value)) {
        return { host: "s3" };
      }

      const parsedUrl = parseUrl(value);

      if (!parsedUrl) {
        return null;
      }

      const host = parsedUrl.hostname.toLowerCase();

      if (hostHints.has(host)) {
        return { host };
      }

      if (
        host.endsWith(".cloudfront.net") ||
        host === "s3.amazonaws.com" ||
        host.endsWith(".s3.amazonaws.com") ||
        /\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host) ||
        /^s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host)
      ) {
        return { host };
      }

      return null;
    },
  };
}

function buildGcpMediaMatchers() {
  const hostHints = new Set(
    [
      process.env.GCP_STORAGE_PUBLIC_BASE_URL,
      process.env.GCS_PUBLIC_BASE_URL,
      process.env.GCP_STORAGE_BUCKET &&
        `${process.env.GCP_STORAGE_BUCKET}.storage.googleapis.com`,
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
        `${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}.storage.googleapis.com`,
      "storage.googleapis.com",
    ]
      .filter(Boolean)
      .map(normalizeHostname)
      .filter(Boolean),
  );
  const buckets = new Set(
    [process.env.GCP_STORAGE_BUCKET, process.env.GOOGLE_CLOUD_STORAGE_BUCKET]
      .filter(Boolean)
      .map((bucket) => bucket.trim().toLowerCase())
      .filter(Boolean),
  );

  return {
    hostHints,
    match: (value) => {
      const parsedUrl = parseUrl(value);

      if (!parsedUrl) {
        return null;
      }

      const host = parsedUrl.hostname.toLowerCase();

      if (hostHints.has(host) && host !== "storage.googleapis.com") {
        return { host };
      }

      if (host.endsWith(".storage.googleapis.com")) {
        const bucket = host.replace(/\.storage\.googleapis\.com$/, "");

        if (buckets.size === 0 || buckets.has(bucket)) {
          return { host };
        }
      }

      if (host === "storage.googleapis.com") {
        const bucket = parsedUrl.pathname.split("/").filter(Boolean)[0]?.toLowerCase();

        if (bucket && (buckets.size === 0 || buckets.has(bucket))) {
          return { host };
        }
      }

      return null;
    },
  };
}

function incrementColumnSummary(tableReport, column, field) {
  tableReport.byColumn[column] ??= {
    awsMediaReferences: 0,
    gcpMediaReferences: 0,
    legacyNamedKeyValues: 0,
  };
  tableReport.byColumn[column][field] += 1;
}

function addSamples(params) {
  for (const match of params.matches) {
    if (params.tableReport.samples.length >= sampleLimit) {
      return;
    }

    params.tableReport.samples.push({
      columnPath: match.path,
      host: match.host,
      row: buildRowIdentity(params.row, params.spec.identityColumns),
      value: match.value,
    });
  }
}

function buildRowIdentity(row, columns) {
  return Object.fromEntries(
    columns
      .filter((column) => row[column] !== undefined && row[column] !== null)
      .map((column) => [column, row[column]]),
  );
}

function isLegacyNamedObjectKeyColumn(column) {
  return (
    column === "s3_key" ||
    column === "source_s3_key" ||
    column === "thumb_s3_key" ||
    column === "thumbnail_s3_key" ||
    column === "rendered_s3_key" ||
    column === "output_s3_key" ||
    column === "base_s3_key" ||
    column === "source_original_s3_key"
  );
}

function looksLikeObjectKey(value) {
  if (/^https?:\/\//i.test(value) || /^(data:|blob:)/i.test(value)) {
    return false;
  }

  return /^[A-Za-z0-9][A-Za-z0-9._!$'()+,;=@/-]{2,}$/.test(value);
}

function isMissingRelationOrColumnError(error) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist|Could not find/i.test(error.message ?? "")
  );
}

function printReport(report) {
  console.log("AWS media to GCP backfill audit");
  console.log("Mode: read-only");
  console.log(`Started: ${report.startedAt}`);
  console.log(`Env file: ${report.envFile}`);
  console.log(`Supabase project ref: ${report.supabaseProjectRef}`);
  console.log(
    `AWS host hints: ${report.awsHostHints.length ? report.awsHostHints.join(", ") : "none"}`,
  );
  console.log(
    `GCP host hints: ${report.gcpHostHints.length ? report.gcpHostHints.join(", ") : "none"}`,
  );
  console.log(`Tables configured: ${report.totals.tables}`);
  console.log(`Tables skipped: ${report.totals.skippedTables}`);
  console.log(`Rows scanned: ${report.totals.scannedRows}`);
  console.log(
    `Rows with AWS media references: ${report.totals.rowsWithAwsMediaReferences}`,
  );
  console.log(`AWS media references: ${report.totals.awsMediaReferences}`);
  console.log(
    `Rows already using GCP media URLs: ${report.totals.rowsWithGcpMediaReferences}`,
  );
  console.log(`GCP media references: ${report.totals.gcpMediaReferences}`);
  console.log(
    `Legacy *_s3_key values: ${report.totals.legacyNamedKeyValues}`,
  );
  console.log("");

  for (const tableReport of report.tableReports) {
    printTableReport(tableReport);
  }

  if (report.totals.awsMediaReferences === 0) {
    console.log("Result: no AWS-hosted media URLs were found in scanned tables.");
    return;
  }

  console.log(
    "Result: AWS-hosted media URLs remain. Use this report to decide the GCS copy/update plan before removing AWS S3 or CloudFront.",
  );
}

function printTableReport(tableReport) {
  if (tableReport.skipped) {
    console.log(`SKIP ${tableReport.name}: ${tableReport.error}`);
    return;
  }

  console.log(
    [
      `TABLE ${tableReport.name}`,
      `rows=${tableReport.scannedRows}`,
      `awsRefs=${tableReport.awsMediaReferences}`,
      `gcpRefs=${tableReport.gcpMediaReferences}`,
      `legacyKeys=${tableReport.legacyNamedKeyValues}`,
    ].join(" "),
  );

  for (const [column, summary] of Object.entries(tableReport.byColumn).sort()) {
    console.log(
      [
        "  COLUMN",
        column,
        `awsRefs=${summary.awsMediaReferences}`,
        `gcpRefs=${summary.gcpMediaReferences}`,
        `legacyKeys=${summary.legacyNamedKeyValues}`,
      ].join(" "),
    );
  }

  for (const sample of tableReport.samples) {
    console.log(
      [
        "  AWS_SAMPLE",
        `column=${sample.columnPath}`,
        `host=${sample.host ?? "unknown"}`,
        `row=${JSON.stringify(sample.row)}`,
        `value=${sample.value}`,
      ].join(" "),
    );
  }
}

function parseArguments(args) {
  const parsed = {
    envFile: null,
    json: false,
    pageSize: null,
    sampleLimit: null,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--json") {
      parsed.json = true;
      continue;
    }

    if (argument === "--strict") {
      parsed.strict = true;
      continue;
    }

    if (argument === "--env-file") {
      parsed.envFile = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--page-size") {
      parsed.pageSize = Number(getRequiredArgumentValue(args, (index += 1), argument));
      continue;
    }

    if (argument === "--sample-limit") {
      parsed.sampleLimit = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return parsed;
}

function parseUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function normalizeHostname(value) {
  if (!value?.trim()) {
    return null;
  }

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

function getSupabaseProjectRef(value) {
  try {
    const host = new URL(value).hostname;
    const [projectRef] = host.split(".");

    return projectRef || "unknown";
  } catch {
    return "unknown";
  }
}

function summarizeValue(value) {
  const maxLength = 180;

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function loadEnvFile(envPath) {
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

    if (process.env[key] === undefined) {
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
