import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GCP_CUTOVER_AUDIT_SIGNATURE_HEADER,
  GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER,
  createGcpCutoverAuditSignature,
  deriveGcpCutoverAuditSecret,
  isValidGcpCutoverAuditSecret,
} from "../lib/internal/gcp-cutover-audit-signature.ts";

const envFilePath = join(process.cwd(), ".env.local");

loadLocalEnv();

const options = parseArguments(process.argv.slice(2));
const baseUrl = (
  options.baseUrl ||
  process.env.PRODUCTION_APP_BASE_URL?.trim() ||
  "https://getugcpilot.com"
).replace(/\/$/, "");
const endpoint = `${baseUrl}/api/internal/gcp-media-backfill/audit`;
const expectedSupabaseProjectRef =
  options.expectedSupabaseProjectRef ||
  process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() ||
  getSupabaseProjectRef(
    process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      "",
  );
const pageSize = normalizeInteger(options.pageSize, 500, 1, 1000);
const sampleLimit = normalizeInteger(options.sampleLimit, 10, 0, 25);
const shouldExecute = options.mode === "execute";

const auditPlan = {
  endpoint,
  expectedSupabaseProjectRef,
  expectedStorageProvider: "gcp",
  expectedAwsMediaReferences: options.allowAwsMediaReferences ? "any" : 0,
  sampleLimit,
  writesNothing: true,
};

if (!shouldExecute) {
  printDryRunPlan(auditPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to run the production media backfill audit without --yes.",
  );
}

validateExecuteEnv();

const auditResponse = await requestProductionAudit();

assertProductionAuditResponse(auditResponse);
printResult(auditResponse);

function parseArguments(args) {
  const parsed = {
    allowAwsMediaReferences: false,
    allowSkippedTables: false,
    baseUrl: null,
    expectedSupabaseProjectRef: null,
    mode: "dry-run",
    pageSize: null,
    sampleLimit: null,
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

    if (argument === "--allow-aws-media-references") {
      parsed.allowAwsMediaReferences = true;
      continue;
    }

    if (argument === "--allow-skipped-tables") {
      parsed.allowSkippedTables = true;
      continue;
    }

    if (argument === "--base-url") {
      parsed.baseUrl = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--expected-supabase-project-ref") {
      parsed.expectedSupabaseProjectRef = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
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

function printDryRunPlan(plan) {
  console.log("Production GCP media backfill audit dry run");
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "This calls the deployed app's signed internal route, scans production Supabase media-bearing tables, and verifies whether AWS S3/CloudFront media URLs remain. It does not write database rows, copy files, or call AI providers.",
  );
  console.log("Run with --execute --yes after the route is deployed.");
}

function validateExecuteEnv() {
  getRequiredAuditSecret();

  if (!expectedSupabaseProjectRef) {
    throw new Error(
      "Missing expected Supabase project ref. Set PRODUCTION_SUPABASE_PROJECT_REF or SUPABASE_URL.",
    );
  }
}

async function requestProductionAudit() {
  const rawBody = JSON.stringify({
    pageSize,
    sampleLimit,
  });
  const timestamp = Date.now().toString();
  const signature = createGcpCutoverAuditSignature({
    body: rawBody,
    secret: getRequiredAuditSecret(),
    timestamp,
  });
  const response = await fetch(endpoint, {
    body: rawBody,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      [GCP_CUTOVER_AUDIT_SIGNATURE_HEADER]: signature,
      [GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER]: timestamp,
    },
    method: "POST",
  });
  const text = await response.text();
  const data = parseJsonResponse(text);

  if (!response.ok || !data.ok) {
    throw new Error(
      `Production media backfill audit endpoint failed: ${response.status} ${summarizeResponse(data, text)}`,
    );
  }

  return data;
}

function assertProductionAuditResponse(response) {
  const audit = response.audit ?? {};
  const runtime = response.runtime ?? {};
  const totals = audit.totals ?? {};

  if (runtime.storageProvider !== "gcp") {
    throw new Error(
      `Expected production STORAGE_PROVIDER=gcp, got ${runtime.storageProvider ?? "unknown"}.`,
    );
  }

  if (audit.supabaseProjectRef !== expectedSupabaseProjectRef) {
    throw new Error(
      `Expected production Supabase project ${expectedSupabaseProjectRef}, got ${audit.supabaseProjectRef ?? "unknown"}.`,
    );
  }

  if (!options.allowSkippedTables && totals.skippedTables > 0) {
    throw new Error(
      `Production audit skipped ${totals.skippedTables} table(s). Run with --allow-skipped-tables only after confirming those tables are intentionally absent.`,
    );
  }

  if (!options.allowAwsMediaReferences && totals.awsMediaReferences > 0) {
    throw new Error(
      `Production still has ${totals.awsMediaReferences} AWS media reference(s). Backfill/copy is still required.`,
    );
  }
}

function printResult(response) {
  const audit = response.audit;
  const totals = audit.totals;

  console.log("Production GCP media backfill audit passed");
  console.log(`Supabase project ref: ${audit.supabaseProjectRef}`);
  console.log(`Storage provider: ${response.runtime.storageProvider}`);
  console.log(`Storage bucket: ${response.runtime.storageBucket ?? "unknown"}`);
  console.log(`Rows scanned: ${totals.scannedRows}`);
  console.log(`Tables skipped: ${totals.skippedTables}`);
  console.log(`AWS media references: ${totals.awsMediaReferences}`);
  console.log(`GCP media references: ${totals.gcpMediaReferences}`);
  console.log(`Legacy *_s3_key values: ${totals.legacyNamedKeyValues}`);
}

function getRequiredAuditSecret() {
  const dedicatedSecret =
    process.env.UGC_INTERNAL_CUTOVER_AUDIT_SECRET?.trim();

  if (dedicatedSecret !== undefined) {
    if (!isValidGcpCutoverAuditSecret(dedicatedSecret)) {
      throw new Error("UGC_INTERNAL_CUTOVER_AUDIT_SECRET is too short.");
    }

    return dedicatedSecret;
  }

  return deriveGcpCutoverAuditSecret(getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
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

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function summarizeResponse(data, text) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return JSON.stringify({
      message: data.message,
      missingRuntimeEnv: data.missingRuntimeEnv,
      runtime: data.runtime,
    });
  }

  return text.slice(0, 500);
}

function getSupabaseProjectRef(value) {
  try {
    const host = new URL(value).hostname;
    const [projectRef] = host.split(".");

    return projectRef || "";
  } catch {
    return "";
  }
}

function loadLocalEnv() {
  if (!existsSync(envFilePath)) {
    return;
  }

  const lines = readFileSync(envFilePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
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

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}
