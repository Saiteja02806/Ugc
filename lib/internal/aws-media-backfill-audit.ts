import { createClient } from "@supabase/supabase-js";

type Env = Record<string, string | undefined>;
type Row = Record<string, unknown>;

export type AwsMediaBackfillTableSpec = {
  identityColumns: string[];
  mediaColumns: string[];
  name: string;
};

type StorageMatch = {
  host: string | null;
};

type StorageMatcher = {
  hostHints: Set<string>;
  match: (value: string) => StorageMatch | null;
};

type SupabaseReadClient = {
  from: (table: string) => {
    select: (columns: string) => {
      range: (
        from: number,
        to: number,
      ) => Promise<{
        data: Row[] | null;
        error: { code?: string; message: string } | null;
      }>;
    };
  };
};

type ValueMatch = {
  host: string | null;
  kind: "aws-media" | "gcp-media" | "legacy-named-key";
  path: string;
  value: string;
};

type ColumnSummary = {
  awsMediaReferences: number;
  gcpMediaReferences: number;
  legacyNamedKeyValues: number;
};

export type AwsMediaBackfillTableReport = {
  awsMediaReferences: number;
  byColumn: Record<string, ColumnSummary>;
  error: string | null;
  gcpMediaReferences: number;
  legacyNamedKeyValues: number;
  name: string;
  rowsWithAwsMediaReferences: number;
  rowsWithGcpMediaReferences: number;
  rowsWithLegacyNamedKeyValues: number;
  samples: Array<{
    columnPath: string;
    host: string | null;
    row: Row;
    value: string;
  }>;
  scannedRows: number;
  skipped: boolean;
};

export type AwsMediaBackfillAuditReport = {
  awsHostHints: string[];
  envFile?: string;
  gcpHostHints: string[];
  note: string;
  pageSize: number;
  sampleLimit: number;
  startedAt: string;
  supabaseProjectRef: string;
  tableReports: AwsMediaBackfillTableReport[];
  totals: {
    awsMediaReferences: number;
    gcpMediaReferences: number;
    legacyNamedKeyValues: number;
    rowsWithAwsMediaReferences: number;
    rowsWithGcpMediaReferences: number;
    rowsWithLegacyNamedKeyValues: number;
    scannedRows: number;
    skippedTables: number;
    tables: number;
  };
};

export type AwsMediaBackfillAuditOptions = {
  env?: Env;
  envFile?: string;
  pageSize?: number | null;
  sampleLimit?: number | null;
};

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_SAMPLE_LIMIT = 25;

export const AWS_MEDIA_BACKFILL_TABLE_SPECS: AwsMediaBackfillTableSpec[] = [
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

export function getMissingAwsMediaBackfillAuditEnvVars(env: Env = process.env) {
  const missing: string[] = [];

  if (!getEnv(env, "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getEnv(env, "SUPABASE_SERVICE_ROLE_KEY")) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function auditAwsMediaForGcpBackfill(
  options: AwsMediaBackfillAuditOptions = {},
): Promise<AwsMediaBackfillAuditReport> {
  const env = options.env ?? process.env;
  const pageSize = normalizeInteger(options.pageSize, DEFAULT_PAGE_SIZE, 1, 1000);
  const sampleLimit = normalizeInteger(options.sampleLimit, DEFAULT_SAMPLE_LIMIT, 0, 100);
  const awsMatchers = buildAwsMediaMatchers(env);
  const gcpMatchers = buildGcpMediaMatchers(env);
  const supabaseUrl = getRequiredEnv(env, "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const supabase = createClient(
    supabaseUrl,
    getRequiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  ) as unknown as SupabaseReadClient;
  const tableReports: AwsMediaBackfillTableReport[] = [];
  const totals: AwsMediaBackfillAuditReport["totals"] = {
    awsMediaReferences: 0,
    gcpMediaReferences: 0,
    legacyNamedKeyValues: 0,
    rowsWithAwsMediaReferences: 0,
    rowsWithGcpMediaReferences: 0,
    rowsWithLegacyNamedKeyValues: 0,
    scannedRows: 0,
    skippedTables: 0,
    tables: AWS_MEDIA_BACKFILL_TABLE_SPECS.length,
  };

  for (const spec of AWS_MEDIA_BACKFILL_TABLE_SPECS) {
    const tableReport = await scanTable({
      awsMatchers,
      gcpMatchers,
      pageSize,
      sampleLimit,
      spec,
      supabase,
    });

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
    ...(options.envFile ? { envFile: options.envFile } : {}),
    gcpHostHints: [...gcpMatchers.hostHints],
    note:
      "Read-only audit. AWS media references are URL/string values matching S3, CloudFront, or configured AWS media host hints. Legacy *_s3_key column names are counted separately because new GCS rows may still use old column names.",
    pageSize,
    sampleLimit,
    startedAt: new Date().toISOString(),
    supabaseProjectRef: getSupabaseProjectRef(supabaseUrl),
    tableReports,
    totals,
  };
}

export function printAwsMediaBackfillAuditReport(
  report: AwsMediaBackfillAuditReport,
) {
  console.log("AWS media to GCP backfill audit");
  console.log("Mode: read-only");
  console.log(`Started: ${report.startedAt}`);

  if (report.envFile) {
    console.log(`Env file: ${report.envFile}`);
  }

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
  console.log(`Legacy *_s3_key values: ${report.totals.legacyNamedKeyValues}`);
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

async function scanTable(params: {
  awsMatchers: StorageMatcher;
  gcpMatchers: StorageMatcher;
  pageSize: number;
  sampleLimit: number;
  spec: AwsMediaBackfillTableSpec;
  supabase: SupabaseReadClient;
}) {
  const selectedColumns = [...params.spec.identityColumns, ...params.spec.mediaColumns];
  const tableReport: AwsMediaBackfillTableReport = {
    awsMediaReferences: 0,
    byColumn: {},
    error: null,
    gcpMediaReferences: 0,
    legacyNamedKeyValues: 0,
    name: params.spec.name,
    rowsWithAwsMediaReferences: 0,
    rowsWithGcpMediaReferences: 0,
    rowsWithLegacyNamedKeyValues: 0,
    samples: [],
    scannedRows: 0,
    skipped: false,
  };

  for (let from = 0; ; from += params.pageSize) {
    const { data, error } = await params.supabase
      .from(params.spec.name)
      .select(selectedColumns.join(","))
      .range(from, from + params.pageSize - 1);

    if (error) {
      tableReport.error = error.message;
      tableReport.skipped = isMissingRelationOrColumnError(error);
      return tableReport;
    }

    const rows = (data ?? []) as Row[];
    tableReport.scannedRows += rows.length;

    for (const row of rows) {
      scanRow({
        awsMatchers: params.awsMatchers,
        gcpMatchers: params.gcpMatchers,
        row,
        sampleLimit: params.sampleLimit,
        spec: params.spec,
        tableReport,
      });
    }

    if (rows.length < params.pageSize) {
      return tableReport;
    }
  }
}

function scanRow(params: {
  awsMatchers: StorageMatcher;
  gcpMatchers: StorageMatcher;
  row: Row;
  sampleLimit: number;
  spec: AwsMediaBackfillTableSpec;
  tableReport: AwsMediaBackfillTableReport;
}) {
  const rowAwsMatches: ValueMatch[] = [];
  let rowGcpMatchCount = 0;
  let rowLegacyNamedKeyCount = 0;

  for (const column of params.spec.mediaColumns) {
    const valueMatches = collectStorageReferenceMatches({
      awsMatchers: params.awsMatchers,
      column,
      gcpMatchers: params.gcpMatchers,
      path: column,
      value: params.row[column],
    });

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

      rowLegacyNamedKeyCount += 1;
      params.tableReport.legacyNamedKeyValues += 1;
      incrementColumnSummary(params.tableReport, column, "legacyNamedKeyValues");
    }
  }

  if (rowAwsMatches.length > 0) {
    params.tableReport.rowsWithAwsMediaReferences += 1;
    addSamples({
      matches: rowAwsMatches,
      row: params.row,
      sampleLimit: params.sampleLimit,
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

function collectStorageReferenceMatches(params: {
  awsMatchers: StorageMatcher;
  column: string;
  gcpMatchers: StorageMatcher;
  path: string;
  value: unknown;
}): ValueMatch[] {
  if (params.value === null || params.value === undefined) {
    return [];
  }

  if (typeof params.value === "string") {
    return classifyStringValue({
      awsMatchers: params.awsMatchers,
      column: params.column,
      gcpMatchers: params.gcpMatchers,
      path: params.path,
      rawValue: params.value,
    });
  }

  if (Array.isArray(params.value)) {
    return params.value.flatMap((entry, index) =>
      collectStorageReferenceMatches({
        ...params,
        path: `${params.path}[${index}]`,
        value: entry,
      }),
    );
  }

  if (typeof params.value === "object") {
    return Object.entries(params.value).flatMap(([key, nestedValue]) =>
      collectStorageReferenceMatches({
        ...params,
        path: `${params.path}.${key}`,
        value: nestedValue,
      }),
    );
  }

  return [];
}

function classifyStringValue(params: {
  awsMatchers: StorageMatcher;
  column: string;
  gcpMatchers: StorageMatcher;
  path: string;
  rawValue: string;
}): ValueMatch[] {
  const value = params.rawValue.trim();

  if (!value) {
    return [];
  }

  const awsMatch = params.awsMatchers.match(value);

  if (awsMatch) {
    return [
      {
        host: awsMatch.host,
        kind: "aws-media",
        path: params.path,
        value: summarizeValue(value),
      },
    ];
  }

  const gcpMatch = params.gcpMatchers.match(value);

  if (gcpMatch) {
    return [
      {
        host: gcpMatch.host,
        kind: "gcp-media",
        path: params.path,
        value: summarizeValue(value),
      },
    ];
  }

  if (isLegacyNamedObjectKeyColumn(params.column) && looksLikeObjectKey(value)) {
    return [
      {
        host: null,
        kind: "legacy-named-key",
        path: params.path,
        value: summarizeValue(value),
      },
    ];
  }

  return [];
}

function buildAwsMediaMatchers(env: Env): StorageMatcher {
  const hostHints = new Set(
    [
      env.CLOUDFRONT_DOMAIN,
      env.AWS_CLOUDFRONT_DOMAIN,
      env.AWS_STORAGE_PUBLIC_BASE_URL,
      env.AWS_S3_BUCKET && `${env.AWS_S3_BUCKET}.s3.amazonaws.com`,
      env.AWS_S3_BUCKET &&
        env.AWS_REGION &&
        `${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`,
    ]
      .filter(isNonEmptyString)
      .map(normalizeHostname)
      .filter(isNonEmptyString),
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

function buildGcpMediaMatchers(env: Env): StorageMatcher {
  const hostHints = new Set(
    [
      env.GCP_STORAGE_PUBLIC_BASE_URL,
      env.GCS_PUBLIC_BASE_URL,
      env.GCP_STORAGE_BUCKET && `${env.GCP_STORAGE_BUCKET}.storage.googleapis.com`,
      env.GOOGLE_CLOUD_STORAGE_BUCKET &&
        `${env.GOOGLE_CLOUD_STORAGE_BUCKET}.storage.googleapis.com`,
      "storage.googleapis.com",
    ]
      .filter(isNonEmptyString)
      .map(normalizeHostname)
      .filter(isNonEmptyString),
  );
  const buckets = new Set(
    [env.GCP_STORAGE_BUCKET, env.GOOGLE_CLOUD_STORAGE_BUCKET]
      .filter(isNonEmptyString)
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

function incrementColumnSummary(
  tableReport: AwsMediaBackfillTableReport,
  column: string,
  field: keyof ColumnSummary,
) {
  tableReport.byColumn[column] ??= {
    awsMediaReferences: 0,
    gcpMediaReferences: 0,
    legacyNamedKeyValues: 0,
  };
  tableReport.byColumn[column][field] += 1;
}

function addSamples(params: {
  matches: ValueMatch[];
  row: Row;
  sampleLimit: number;
  spec: AwsMediaBackfillTableSpec;
  tableReport: AwsMediaBackfillTableReport;
}) {
  for (const match of params.matches) {
    if (params.tableReport.samples.length >= params.sampleLimit) {
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

function buildRowIdentity(row: Row, columns: string[]) {
  return Object.fromEntries(
    columns
      .filter((column) => row[column] !== undefined && row[column] !== null)
      .map((column) => [column, row[column]]),
  );
}

function isLegacyNamedObjectKeyColumn(column: string) {
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

function looksLikeObjectKey(value: string) {
  if (/^https?:\/\//i.test(value) || /^(data:|blob:)/i.test(value)) {
    return false;
  }

  return /^[A-Za-z0-9][A-Za-z0-9._!$'()+,;=@/-]{2,}$/.test(value);
}

function isMissingRelationOrColumnError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist|Could not find/i.test(error.message ?? "")
  );
}

function printTableReport(tableReport: AwsMediaBackfillTableReport) {
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

function parseUrl(value: string) {
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

function normalizeHostname(value: string) {
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

function getSupabaseProjectRef(value: string) {
  try {
    const host = new URL(value).hostname;
    const [projectRef] = host.split(".");

    return projectRef || "unknown";
  } catch {
    return "unknown";
  }
}

function summarizeValue(value: string) {
  const maxLength = 180;

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeInteger(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function getRequiredEnv(env: Env, ...names: string[]) {
  const value = getEnv(env, ...names);

  if (value) {
    return value;
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}

function getEnv(env: Env, ...names: string[]) {
  for (const name of names) {
    const value = env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
