import { GoogleAuth } from "google-auth-library";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";
import {
  buildBillingUsageFlushAudience,
  buildBillingUsageFlushTargetUrl,
  buildBillingUsageSchedulerRequest,
  DEFAULT_BILLING_USAGE_SCHEDULE,
  DEFAULT_BILLING_USAGE_SCHEDULER_JOB,
} from "../lib/billing/usage-scheduler.ts";
import {
  DEFAULT_GCP_CLOUD_TASKS_LOCATION,
  getDefaultGcpSchedulerServiceAccountEmail,
} from "../lib/scheduling/gcp-cloud-tasks-scheduler-logic.ts";

loadEnvFile(resolve(".env.local"));

const options = parseArguments(process.argv.slice(2));
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim();
const location =
  options.location ||
  process.env.GCP_CLOUD_TASKS_LOCATION?.trim() ||
  process.env.GCP_REGION?.trim() ||
  DEFAULT_GCP_CLOUD_TASKS_LOCATION;
const baseUrl =
  options.baseUrl ||
  process.env.APP_BASE_URL?.trim() ||
  "https://getugcpilot.com";
const audience =
  options.audience ||
  process.env.GCP_BILLING_USAGE_FLUSH_AUDIENCE?.trim() ||
  buildBillingUsageFlushAudience(baseUrl);
const targetUrl =
  options.targetUrl || buildBillingUsageFlushTargetUrl(baseUrl, options.limit);
const jobName =
  options.jobName ||
  process.env.GCP_BILLING_USAGE_SCHEDULER_JOB?.trim() ||
  DEFAULT_BILLING_USAGE_SCHEDULER_JOB;
const schedule =
  options.schedule ||
  process.env.GCP_BILLING_USAGE_SCHEDULE?.trim() ||
  DEFAULT_BILLING_USAGE_SCHEDULE;
const serviceAccountEmail =
  options.serviceAccountEmail ||
  process.env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL?.trim() ||
  process.env.GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL?.trim() ||
  (projectId
    ? getDefaultGcpSchedulerServiceAccountEmail({
        namePrefix: process.env.GCP_RESOURCE_NAME_PREFIX,
        projectId,
      })
    : "");

if (!projectId) {
  throw new Error("Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
}

if (!serviceAccountEmail) {
  throw new Error("Set GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL.");
}

if (!/^[A-Za-z0-9_-]{1,500}$/.test(jobName)) {
  throw new Error("Invalid Cloud Scheduler job name.");
}

const request = buildBillingUsageSchedulerRequest({
  audience,
  jobName,
  location,
  projectId,
  schedule,
  serviceAccountEmail,
  targetUrl,
});
const plan = {
  audience,
  jobName,
  location,
  projectId,
  schedule,
  serviceAccountEmail,
  targetUrl,
};

if (options.mode === "dry-run") {
  console.log("Billing usage scheduler dry run");
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to create or update the Cloud Scheduler job without --yes.",
  );
}

const existingJob = await getExistingJob(request.jobEndpoint);
const endpoint = existingJob ? request.updateEndpoint : request.collectionEndpoint;
const method = existingJob ? "PATCH" : "POST";
const response = await fetch(endpoint, {
  body: JSON.stringify(request.requestBody),
  cache: "no-store",
  headers: {
    Authorization: await getAuthorizationHeader(endpoint),
    "Content-Type": "application/json",
  },
  method,
});

if (!response.ok) {
  throw new Error(
    `Could not ${existingJob ? "update" : "create"} Cloud Scheduler job: ${response.status} ${await getResponseSummary(response)}`,
  );
}

const configuredJob = await response.json();
console.log(
  `${existingJob ? "Updated" : "Created"} Cloud Scheduler job ${configuredJob.name || request.jobPath}`,
);
console.log(JSON.stringify(plan, null, 2));

let googleAuth;

function getGoogleAuth() {
  if (googleAuth) return googleAuth;

  const credentials = getGoogleServiceAccountCredentials();
  const localCredentialsPath = resolve(
    ".tools",
    "gcloud-config",
    "application_default_credentials.json",
  );
  const keyFile =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    (existsSync(localCredentialsPath) ? localCredentialsPath : "");

  googleAuth = new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    ...(!credentials && keyFile ? { keyFile } : {}),
    projectId,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return googleAuth;
}

async function getAuthorizationHeader(url) {
  const headers = await getGoogleAuth().getRequestHeaders(url);
  const authorization =
    typeof headers.get === "function"
      ? headers.get("authorization")
      : headers.authorization || headers.Authorization;

  if (!authorization) {
    throw new Error("Could not authorize the Cloud Scheduler request.");
  }

  return authorization;
}

async function getExistingJob(jobEndpoint) {
  const response = await fetch(jobEndpoint, {
    cache: "no-store",
    headers: { Authorization: await getAuthorizationHeader(jobEndpoint) },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `Could not inspect Cloud Scheduler job: ${response.status} ${await getResponseSummary(response)}`,
    );
  }

  return response.json();
}

function parseArguments(args) {
  const parsed = {
    audience: null,
    baseUrl: null,
    jobName: null,
    limit: 50,
    location: null,
    mode: "dry-run",
    projectId: null,
    schedule: null,
    serviceAccountEmail: null,
    targetUrl: null,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run" || argument === "--execute") {
      parsed.mode = argument === "--execute" ? "execute" : "dry-run";
      continue;
    }

    if (argument === "--yes") {
      parsed.yes = true;
      continue;
    }

    const optionNames = {
      "--audience": "audience",
      "--base-url": "baseUrl",
      "--job-name": "jobName",
      "--location": "location",
      "--project-id": "projectId",
      "--schedule": "schedule",
      "--service-account-email": "serviceAccountEmail",
      "--target-url": "targetUrl",
    };
    const optionName = optionNames[argument];

    if (optionName) {
      parsed[optionName] = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--limit") {
      parsed.limit = Number(getRequiredArgumentValue(args, (index += 1), argument));
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return parsed;
}

function getRequiredArgumentValue(args, index, optionName) {
  const value = args[index]?.trim();

  if (!value) throw new Error(`Missing value for ${optionName}.`);
  return value;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[name] ||= value.replace(/\\n/g, "\n");
  }
}

async function getResponseSummary(response) {
  return (await response.text().catch(() => "")).slice(0, 500);
}
