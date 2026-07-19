import { randomUUID } from "node:crypto";
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
const expectedImageByteLength = 68;

loadLocalEnv();

const options = parseArguments(process.argv.slice(2));
const baseUrl = (
  options.baseUrl ||
  process.env.PRODUCTION_APP_BASE_URL?.trim() ||
  "https://getugcpilot.com"
).replace(/\/$/, "");
const endpoint = `${baseUrl}/api/internal/gcp-storage/audit`;
const auditId = options.auditId || randomUUID();
const canaryUserId =
  options.userId ||
  process.env.GCP_PRODUCTION_STORAGE_AUDIT_USER_ID?.trim() ||
  `production-gcp-storage-audit-${auditId}`;
const canaryProjectId =
  options.canaryProjectId ||
  process.env.GCP_PRODUCTION_STORAGE_AUDIT_PROJECT_ID?.trim() ||
  "production-gcp-storage-audit";
const expectedBucket =
  options.expectedBucket ||
  process.env.GCP_STORAGE_BUCKET?.trim() ||
  "ugcsaas-media";
const shouldExecute = options.mode === "execute";

const auditPlan = {
  endpoint,
  expected: {
    bucket: expectedBucket,
    contentType: "image/png",
    provider: "gcp",
    publicRead: true,
  },
  writesOneTemporaryObject: true,
  cleanupExpected: true,
  userId: canaryUserId,
};

if (!shouldExecute) {
  printDryRunPlan(auditPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to run the production GCP storage audit without --yes.",
  );
}

validateExecuteEnv();

const auditResponse = await requestProductionStorageAudit();

assertStorageAuditResponse(auditResponse);

console.log("Production GCP storage upload audit passed");
console.log(`Bucket: ${auditResponse.runtime.storageBucket}`);
console.log(`Storage key: ${auditResponse.asset.storageKey}`);
console.log(`Public URL host: ${auditResponse.publicRead.urlHost}`);
console.log(`Upload bytes: ${auditResponse.upload.contentLength}`);
console.log(
  `Cleanup: objectDeleted=${auditResponse.cleanup.objectDeleted}, mediaAssetSoftDeleted=${auditResponse.cleanup.mediaAssetSoftDeleted}`,
);

function parseArguments(args) {
  const parsed = {
    auditId: null,
    baseUrl: null,
    canaryProjectId: null,
    expectedBucket: null,
    mode: "dry-run",
    userId: null,
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

    if (argument === "--audit-id") {
      parsed.auditId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--base-url") {
      parsed.baseUrl = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--canary-project-id") {
      parsed.canaryProjectId = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--expected-bucket") {
      parsed.expectedBucket = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--user-id") {
      parsed.userId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return parsed;
}

function printDryRunPlan(plan) {
  console.log("Production GCP storage audit dry run");
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "This calls the deployed app, creates one signed GCP upload target, uploads a tiny PNG, verifies GCS metadata and public read access, then deletes the object and soft-deletes the media row.",
  );
  console.log("Run with --execute --yes after the route is deployed.");
}

function validateExecuteEnv() {
  getRequiredAuditSecret();
}

async function requestProductionStorageAudit() {
  const rawBody = JSON.stringify({
    auditId,
    projectId: canaryProjectId,
    userId: canaryUserId,
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
      `Production storage audit endpoint failed: ${response.status} ${summarizeResponse(data, text)}`,
    );
  }

  return data;
}

function assertStorageAuditResponse(response) {
  if (response.runtime?.storageProvider !== "gcp") {
    throw new Error(
      `Expected storageProvider=gcp, got ${response.runtime?.storageProvider ?? "unknown"}.`,
    );
  }

  if (response.runtime?.storageBucket !== expectedBucket) {
    throw new Error(
      `Expected bucket ${expectedBucket}, got ${response.runtime?.storageBucket ?? "unknown"}.`,
    );
  }

  if (response.upload?.contentType !== "image/png") {
    throw new Error(
      `Expected image/png upload, got ${response.upload?.contentType ?? "unknown"}.`,
    );
  }

  assertByteLength(response.upload?.contentLength, "upload.contentLength");
  assertByteLength(response.object?.contentLength, "object.contentLength");
  assertByteLength(
    response.publicRead?.contentLength,
    "publicRead.contentLength",
  );

  if (response.object?.contentType !== "image/png") {
    throw new Error(
      `Expected object content type image/png, got ${response.object?.contentType ?? "unknown"}.`,
    );
  }

  if (response.publicRead?.contentType?.split(";")[0] !== "image/png") {
    throw new Error(
      `Expected public read content type image/png, got ${response.publicRead?.contentType ?? "unknown"}.`,
    );
  }

  if (response.publicRead?.ok !== true || response.publicRead?.status !== 200) {
    throw new Error("Expected public GCP storage URL to be readable.");
  }

  if (!response.asset?.storageKey?.startsWith(`media/${canaryUserId}/image/`)) {
    throw new Error(
      `Unexpected audit storage key ${response.asset?.storageKey ?? "unknown"}.`,
    );
  }

  if (response.asset?.sourceType !== "upload") {
    throw new Error(
      `Expected upload media source, got ${response.asset?.sourceType ?? "unknown"}.`,
    );
  }

  if (response.asset?.status !== "ready") {
    throw new Error(
      `Expected ready media row before cleanup, got ${response.asset?.status ?? "unknown"}.`,
    );
  }

  if (response.cleanup?.objectDeleted !== true) {
    throw new Error("Expected the audit GCS object to be deleted.");
  }

  if (response.cleanup?.mediaAssetSoftDeleted !== true) {
    throw new Error("Expected the audit media asset row to be soft-deleted.");
  }

  if (Array.isArray(response.cleanup?.errors) && response.cleanup.errors.length > 0) {
    throw new Error(`Cleanup reported errors: ${response.cleanup.errors.join("; ")}`);
  }
}

function assertByteLength(value, name) {
  if (value !== expectedImageByteLength) {
    throw new Error(`Expected ${name}=${expectedImageByteLength}, got ${value}.`);
  }
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
      cleanup: data.cleanup,
      message: data.message,
      missingRuntimeEnv: data.missingRuntimeEnv,
      runtime: data.runtime,
      target: data.target,
    });
  }

  return text.slice(0, 500);
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
