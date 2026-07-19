import {
  DeleteScheduleCommand,
  ListSchedulesCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";
import {
  buildGcpCloudTasksCreateTaskRequest,
  buildSocialPublishDispatchUrl,
  DEFAULT_GCP_CLOUD_TASKS_LOCATION,
  DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE,
  getDefaultGcpSchedulerServiceAccountEmail,
  getGcpSocialPublishScheduleName,
} from "../lib/scheduling/gcp-cloud-tasks-scheduler-logic.ts";

const AWS_SOCIAL_SCHEDULE_PREFIX = "ugc-social-";
const GCP_SOCIAL_SCHEDULE_PREFIX = "ugc-social-gcp-";
const ACTIVE_MIGRATABLE_STATUSES = new Set(["scheduled", "scheduling"]);
const TERMINAL_CLEANUP_STATUSES = new Set([
  "action_required",
  "cancelled",
  "failed",
  "published",
  "skipped",
]);
const localApplicationDefaultCredentialsPath = resolve(
  ".tools",
  "gcloud-config",
  "application_default_credentials.json",
);

loadEnvFile(resolve(".env.local"));

const options = parseArguments(process.argv.slice(2));
const shouldExecute = options.mode === "execute";
const awsRegion =
  options.awsRegion || process.env.AWS_REGION?.trim() || "us-east-1";
const awsScheduleGroup =
  options.awsScheduleGroup ||
  process.env.UGC_EVENTBRIDGE_SCHEDULE_GROUP?.trim() ||
  "";
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const location =
  options.location ||
  process.env.GCP_CLOUD_TASKS_LOCATION?.trim() ||
  process.env.GCP_REGION?.trim() ||
  DEFAULT_GCP_CLOUD_TASKS_LOCATION;
const cloudTasksQueue =
  options.cloudTasksQueue ||
  process.env.GCP_SOCIAL_PUBLISH_TASKS_QUEUE?.trim() ||
  DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE;
const appBaseUrl =
  options.baseUrl ||
  process.env.APP_BASE_URL?.trim() ||
  process.env.UGC_INTERNAL_APP_URL?.trim() ||
  "https://getugcpilot.com";
const dispatchUrl =
  options.dispatchUrl ||
  process.env.GCP_SOCIAL_PUBLISH_DISPATCH_URL?.trim() ||
  buildSocialPublishDispatchUrl(appBaseUrl);
const schedulerServiceAccountEmail =
  options.serviceAccountEmail ||
  process.env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL?.trim() ||
  getDefaultGcpSchedulerServiceAccountEmail({ projectId });
const minimumFutureSeconds = normalizeInteger(
  options.minimumFutureSeconds,
  300,
  0,
  24 * 60 * 60,
);
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
const scheduler = new SchedulerClient({
  ...getAwsClientOptions(),
  region: awsRegion,
});
let cloudTasksAuth = null;

validateReadEnv();

if (shouldExecute) {
  validateExecuteEnv();
}

const dbTargets = await listAwsBackedScheduleTargets();
const awsInspection = await listAwsSocialSchedulesSafe();
const plan = buildMigrationPlan({
  awsInspectionError: awsInspection.error,
  awsSchedules: awsInspection.schedules,
  dbTargets,
  nowMs: Date.now(),
});

printPlan(plan);

if (!shouldExecute) {
  if (options.strict && hasAwsSchedulerResidue(plan)) {
    process.exitCode = 1;
  }

  process.exit();
}

if (!options.yes) {
  throw new Error("Refusing to migrate AWS schedules without --yes.");
}

await executePlan(plan);

const remainingDbTargets = await listAwsBackedScheduleTargets();
const remainingAwsInspection = await listAwsSocialSchedulesSafe();
const remainingPlan = buildMigrationPlan({
  awsInspectionError: remainingAwsInspection.error,
  awsSchedules: remainingAwsInspection.schedules,
  dbTargets: remainingDbTargets,
  nowMs: Date.now(),
});

console.log("");
console.log("Post-migration audit");
printPlan(remainingPlan);

if (hasAwsSchedulerResidue(remainingPlan)) {
  process.exitCode = 1;
}

function parseArguments(args) {
  const parsed = {
    awsRegion: null,
    awsScheduleGroup: null,
    baseUrl: null,
    cloudTasksQueue: null,
    deleteOrphans: false,
    dispatchUrl: null,
    location: null,
    minimumFutureSeconds: null,
    mode: "dry-run",
    projectId: null,
    serviceAccountEmail: null,
    strict: false,
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

    if (argument === "--strict") {
      parsed.strict = true;
      continue;
    }

    if (argument === "--delete-orphans") {
      parsed.deleteOrphans = true;
      continue;
    }

    if (argument === "--aws-region") {
      parsed.awsRegion = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--aws-schedule-group") {
      parsed.awsScheduleGroup = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--base-url") {
      parsed.baseUrl = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--cloud-tasks-queue") {
      parsed.cloudTasksQueue = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--dispatch-url") {
      parsed.dispatchUrl = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--location") {
      parsed.location = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--minimum-future-seconds") {
      parsed.minimumFutureSeconds = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    if (argument === "--project-id") {
      parsed.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--service-account-email") {
      parsed.serviceAccountEmail = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  if (parsed.deleteOrphans && (!parsed.yes || parsed.mode !== "execute")) {
    throw new Error(
      "Refusing to delete orphan AWS schedules without --execute --yes.",
    );
  }

  return parsed;
}

function validateReadEnv() {
  const missing = [];

  if (!awsRegion) {
    missing.push("AWS_REGION");
  }

  if (!awsScheduleGroup) {
    missing.push("UGC_EVENTBRIDGE_SCHEDULE_GROUP");
  }

  if (!getEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env for AWS schedule audit: ${missing.join(", ")}`);
  }
}

function validateExecuteEnv() {
  const missing = [];

  if (!projectId) {
    missing.push("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (!schedulerServiceAccountEmail) {
    missing.push("GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL");
  }

  if (
    !getGoogleServiceAccountCredentials() &&
    !getEnv("GOOGLE_APPLICATION_CREDENTIALS") &&
    !getLocalApplicationDefaultCredentialsPath() &&
    !getEnv("CLOUDSDK_CONFIG")
  ) {
    missing.push(
      "GOOGLE_CLOUD_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS or local ADC",
    );
  }

  validateDispatchUrl(dispatchUrl);

  if (missing.length > 0) {
    throw new Error(`Missing required env for AWS to GCP migration: ${missing.join(", ")}`);
  }
}

async function listAwsBackedScheduleTargets() {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("scheduled_post_targets")
      .select(
        "id,user_id,scheduled_post_id,platform,status,scheduled_for,scheduler_schedule_name,scheduler_schedule_arn,scheduler_deleted_at,publish_job_id,last_error_code,last_error_message,updated_at,created_at",
      )
      .not("scheduler_schedule_name", "is", null)
      .is("scheduler_deleted_at", null)
      .like("scheduler_schedule_name", `${AWS_SOCIAL_SCHEDULE_PREFIX}%`)
      .not("scheduler_schedule_name", "like", `${GCP_SOCIAL_SCHEDULE_PREFIX}%`)
      .order("scheduled_for", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Could not list AWS-backed social schedule targets: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function listAwsSocialSchedules() {
  const schedules = [];
  let nextToken = undefined;

  do {
    const response = await scheduler.send(
      new ListSchedulesCommand({
        GroupName: awsScheduleGroup,
        MaxResults: 100,
        NamePrefix: AWS_SOCIAL_SCHEDULE_PREFIX,
        NextToken: nextToken,
      }),
    );

    for (const schedule of response.Schedules ?? []) {
      if (isAwsSocialScheduleName(schedule.Name)) {
        schedules.push({
          arn: schedule.Arn ?? null,
          groupName: schedule.GroupName ?? awsScheduleGroup,
          name: schedule.Name,
          state: schedule.State ?? null,
          targetArn: schedule.Target?.Arn ?? null,
        });
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return schedules.sort((left, right) => left.name.localeCompare(right.name));
}

async function listAwsSocialSchedulesSafe() {
  try {
    return {
      error: null,
      schedules: await listAwsSocialSchedules(),
    };
  } catch (error) {
    if (shouldExecute) {
      throw error;
    }

    return {
      error,
      schedules: [],
    };
  }
}

function buildMigrationPlan(params) {
  const awsSchedulesByName = new Map(
    params.awsSchedules.map((schedule) => [schedule.name, schedule]),
  );
  const dbTargetsByScheduleName = new Map();
  const migratableTargets = [];
  const terminalTargets = [];
  const blockedTargets = [];
  const staleDbTargets = [];
  const statusCounts = new Map();

  for (const target of params.dbTargets) {
    const scheduleName = target.scheduler_schedule_name;

    statusCounts.set(target.status, (statusCounts.get(target.status) ?? 0) + 1);

    if (scheduleName) {
      dbTargetsByScheduleName.set(scheduleName, target);
    }

    const targetPlan = classifyTarget(
      target,
      awsSchedulesByName,
      params.nowMs,
      params.awsInspectionError,
    );

    if (targetPlan.action === "migrate") {
      migratableTargets.push(targetPlan);
      continue;
    }

    if (targetPlan.action === "delete-terminal") {
      terminalTargets.push(targetPlan);
      continue;
    }

    if (targetPlan.action === "mark-stale-deleted") {
      staleDbTargets.push(targetPlan);
      continue;
    }

    blockedTargets.push(targetPlan);
  }

  const orphanSchedules = params.awsSchedules
    .filter((schedule) => !dbTargetsByScheduleName.has(schedule.name))
    .map((schedule) => ({
      action: "delete-orphan",
      schedule,
    }));

  return {
    blockedTargets,
    cloudTasksQueue,
    deleteOrphans: options.deleteOrphans,
    dispatchUrl,
    awsInspectionError: params.awsInspectionError,
    minimumFutureSeconds,
    migratableTargets,
    orphanSchedules,
    projectId,
    schedulerServiceAccountEmail,
    statusCounts,
    staleDbTargets,
    terminalTargets,
    totals: {
      awsSchedules: params.awsSchedules.length,
      dbAwsTargets: params.dbTargets.length,
    },
  };
}

function classifyTarget(target, awsSchedulesByName, nowMs, awsInspectionError) {
  const scheduleName = target.scheduler_schedule_name;
  const schedule = scheduleName ? awsSchedulesByName.get(scheduleName) : null;
  const scheduledAtMs = Date.parse(target.scheduled_for);
  const secondsUntilDue = Number.isFinite(scheduledAtMs)
    ? Math.floor((scheduledAtMs - nowMs) / 1000)
    : null;
  const basePlan = {
    gcpTaskName: getGcpSocialPublishScheduleName(target.id),
    schedule,
    secondsUntilDue,
    target,
  };

  if (ACTIVE_MIGRATABLE_STATUSES.has(target.status)) {
    const reasons = [];

    if (awsInspectionError) {
      reasons.push("AWS schedule inspection failed");
    }

    if (!target.publish_job_id) {
      reasons.push("missing publish_job_id");
    }

    if (!Number.isFinite(scheduledAtMs)) {
      reasons.push("invalid scheduled_for");
    } else if (secondsUntilDue < minimumFutureSeconds) {
      reasons.push(
        `scheduled_for is due in ${secondsUntilDue}s, below ${minimumFutureSeconds}s safety window`,
      );
    }

    if (reasons.length > 0) {
      return {
        ...basePlan,
        action: "blocked",
        reasons,
      };
    }

    return {
      ...basePlan,
      action: "migrate",
    };
  }

  if (target.status === "publishing") {
    return {
      ...basePlan,
      action: "blocked",
      reasons: ["target is already publishing"],
    };
  }

  if (TERMINAL_CLEANUP_STATUSES.has(target.status)) {
    if (awsInspectionError) {
      return {
        ...basePlan,
        action: "blocked",
        reasons: ["AWS schedule inspection failed"],
      };
    }

    return schedule
      ? {
          ...basePlan,
          action: "delete-terminal",
        }
      : {
          ...basePlan,
          action: "mark-stale-deleted",
          reasons: ["AWS schedule is already missing"],
        };
  }

  return {
    ...basePlan,
    action: "blocked",
    reasons: [`unsupported status ${target.status}`],
  };
}

function printPlan(plan) {
  console.log("AWS social scheduler to GCP migration audit");
  console.log(`Mode: ${shouldExecute ? "execute" : "dry-run"}`);
  console.log(`AWS region: ${awsRegion}`);
  console.log(`AWS schedule group: ${awsScheduleGroup}`);
  console.log(`GCP project: ${plan.projectId}`);
  console.log(`GCP location: ${location}`);
  console.log(`GCP Cloud Tasks queue: ${plan.cloudTasksQueue}`);
  console.log(`Dispatch URL: ${plan.dispatchUrl}`);
  console.log(`Minimum future safety window: ${plan.minimumFutureSeconds}s`);
  console.log(`DB AWS-backed targets: ${plan.totals.dbAwsTargets}`);
  console.log(
    `AWS EventBridge schedules: ${
      plan.awsInspectionError ? "unknown" : plan.totals.awsSchedules
    }`,
  );
  if (plan.awsInspectionError) {
    console.log(`AWS inspection error: ${getErrorMessage(plan.awsInspectionError)}`);
  }
  console.log(`Migratable active targets: ${plan.migratableTargets.length}`);
  console.log(`Terminal targets to clean: ${plan.terminalTargets.length}`);
  console.log(`Stale DB targets to mark deleted: ${plan.staleDbTargets.length}`);
  console.log(`Orphan AWS schedules: ${plan.orphanSchedules.length}`);
  console.log(`Blocked targets: ${plan.blockedTargets.length}`);

  for (const [status, count] of [...plan.statusCounts.entries()].sort()) {
    console.log(`STATUS_COUNT status=${status} count=${count}`);
  }

  printPlanEntries("MIGRATE", plan.migratableTargets);
  printPlanEntries("DELETE_TERMINAL", plan.terminalTargets);
  printPlanEntries("MARK_STALE_DELETED", plan.staleDbTargets);
  printPlanEntries("BLOCKED", plan.blockedTargets);

  for (const entry of plan.orphanSchedules) {
    console.log(
      [
        "ORPHAN_AWS_SCHEDULE",
        `schedule=${entry.schedule.name}`,
        `state=${entry.schedule.state ?? "unknown"}`,
        `delete=${plan.deleteOrphans}`,
      ].join(" "),
    );
  }

  if (!shouldExecute) {
    console.log(
      "Dry run only. Use --execute --yes to migrate eligible targets and clean terminal schedules.",
    );
  }
}

function printPlanEntries(label, entries) {
  for (const entry of entries) {
    const target = entry.target;
    console.log(
      [
        label,
        `target=${target.id}`,
        `post=${target.scheduled_post_id}`,
        `status=${target.status}`,
        `scheduledFor=${target.scheduled_for}`,
        `secondsUntilDue=${entry.secondsUntilDue ?? "unknown"}`,
        `awsSchedule=${target.scheduler_schedule_name ?? "none"}`,
        `awsExists=${entry.schedule ? "true" : "false"}`,
        `gcpTask=${entry.gcpTaskName}`,
        entry.reasons?.length ? `reason=${entry.reasons.join(";")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

async function executePlan(plan) {
  const results = {
    migrated: 0,
    orphanDeleted: 0,
    staleMarkedDeleted: 0,
    terminalDeleted: 0,
  };

  for (const entry of plan.migratableTargets) {
    await migrateTarget(entry);
    results.migrated += 1;
  }

  for (const entry of plan.terminalTargets) {
    await deleteTerminalSchedule(entry);
    results.terminalDeleted += 1;
  }

  for (const entry of plan.staleDbTargets) {
    await markDbScheduleDeleted(entry.target);
    results.staleMarkedDeleted += 1;
  }

  if (plan.deleteOrphans) {
    for (const entry of plan.orphanSchedules) {
      await deleteAwsSchedule(entry.schedule.name);
      results.orphanDeleted += 1;
    }
  }

  console.log("");
  console.log(
    [
      "Migration execution complete.",
      `migrated=${results.migrated}`,
      `terminalDeleted=${results.terminalDeleted}`,
      `staleMarkedDeleted=${results.staleMarkedDeleted}`,
      `orphanDeleted=${results.orphanDeleted}`,
    ].join(" "),
  );
}

async function migrateTarget(entry) {
  const target = entry.target;
  const previousScheduleName = target.scheduler_schedule_name;
  let createdTask = null;

  console.log(
    `Migrating target ${target.id}: AWS ${previousScheduleName} -> GCP ${entry.gcpTaskName}`,
  );

  try {
    createdTask = await createCloudTaskForTarget(entry);
  } catch (error) {
    throw new Error(
      `Could not create GCP Cloud Task for target ${target.id}: ${getErrorMessage(
        error,
      )}`,
    );
  }

  try {
    if (previousScheduleName) {
      await deleteAwsSchedule(previousScheduleName);
    }
  } catch (error) {
    if (createdTask.created) {
      await deleteCloudTask(createdTask.taskPath).catch((rollbackError) => {
        console.error(
          `Could not roll back GCP task ${createdTask.taskPath}: ${getErrorMessage(
            rollbackError,
          )}`,
        );
      });
    }

    throw new Error(
      `Could not delete AWS schedule ${previousScheduleName} for target ${target.id}: ${getErrorMessage(
        error,
      )}`,
    );
  }

  await updateTargetToGcpSchedule({
    gcpScheduleArn: createdTask.taskPath,
    gcpScheduleName: entry.gcpTaskName,
    previousScheduleName,
    target,
  });
}

async function deleteTerminalSchedule(entry) {
  const scheduleName = entry.target.scheduler_schedule_name;

  if (scheduleName) {
    await deleteAwsSchedule(scheduleName);
  }

  await markDbScheduleDeleted(entry.target);
}

async function createCloudTaskForTarget(entry) {
  const target = entry.target;
  const request = buildGcpCloudTasksCreateTaskRequest({
    audience: dispatchUrl,
    dispatchUrl,
    input: {
      jobId: target.publish_job_id,
      scheduledFor: target.scheduled_for,
      targetId: target.id,
    },
    location,
    projectId,
    queueName: cloudTasksQueue,
    serviceAccountEmail: schedulerServiceAccountEmail,
    taskName: entry.gcpTaskName,
  });
  const response = await fetch(request.endpoint, {
    body: JSON.stringify(request.requestBody),
    cache: "no-store",
    headers: {
      Authorization: await getCloudTasksAuthorizationHeader(request.endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 409) {
    console.log(`GCP Cloud Task already exists ${request.taskPath}`);
    return {
      created: false,
      taskPath: request.taskPath,
    };
  }

  if (!response.ok) {
    throw new Error(
      `${response.status} ${await getResponseSummary(response)}`,
    );
  }

  console.log(`Created GCP Cloud Task ${request.taskPath}`);
  return {
    created: true,
    taskPath: request.taskPath,
  };
}

async function updateTargetToGcpSchedule(params) {
  const now = new Date().toISOString();
  let query = supabase
    .from("scheduled_post_targets")
    .update({
      last_error_code: null,
      last_error_message: null,
      last_reconciled_at: now,
      scheduler_deleted_at: null,
      scheduler_schedule_arn: params.gcpScheduleArn,
      scheduler_schedule_name: params.gcpScheduleName,
      updated_at: now,
    })
    .eq("id", params.target.id)
    .eq("user_id", params.target.user_id)
    .is("scheduler_deleted_at", null)
    .in("status", [...ACTIVE_MIGRATABLE_STATUSES]);

  if (params.previousScheduleName) {
    query = query.eq("scheduler_schedule_name", params.previousScheduleName);
  }

  const { data, error } = await query
    .select("id,scheduler_schedule_name,scheduler_schedule_arn")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not update target ${params.target.id}: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      `Target ${params.target.id} changed before the GCP schedule could be recorded.`,
    );
  }
}

async function markDbScheduleDeleted(target) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("scheduled_post_targets")
    .update({
      last_error_code: null,
      last_error_message: null,
      last_reconciled_at: now,
      scheduler_deleted_at: now,
      updated_at: now,
    })
    .eq("id", target.id)
    .eq("user_id", target.user_id)
    .not("scheduler_schedule_name", "is", null);

  if (error) {
    throw new Error(`Could not mark target ${target.id} deleted: ${error.message}`);
  }
}

async function deleteAwsSchedule(scheduleName) {
  if (!isAwsSocialScheduleName(scheduleName)) {
    throw new Error(`Refusing to delete non-social AWS schedule ${scheduleName}`);
  }

  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        GroupName: awsScheduleGroup,
        Name: scheduleName,
      }),
    );
    console.log(`Deleted AWS EventBridge schedule ${scheduleName}`);
  } catch (error) {
    if (isAwsResourceNotFound(error)) {
      console.log(`AWS EventBridge schedule already missing ${scheduleName}`);
      return;
    }

    throw error;
  }
}

async function deleteCloudTask(taskPath) {
  const response = await fetch(`https://cloudtasks.googleapis.com/v2/${taskPath}`, {
    cache: "no-store",
    headers: {
      Authorization: await getCloudTasksAuthorizationHeader(taskPath),
    },
    method: "DELETE",
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not delete GCP Cloud Task: ${response.status} ${await getResponseSummary(
        response,
      )}`,
    );
  }
}

function hasAwsSchedulerResidue(plan) {
  return (
    plan.totals.dbAwsTargets > 0 ||
    plan.totals.awsSchedules > 0 ||
    plan.blockedTargets.length > 0 ||
    plan.orphanSchedules.length > 0
  );
}

function getCloudTasksAuth() {
  if (cloudTasksAuth) {
    return cloudTasksAuth;
  }

  const credentials = getGoogleServiceAccountCredentials();
  const keyFile =
    getEnv("GOOGLE_APPLICATION_CREDENTIALS") ||
    getLocalApplicationDefaultCredentialsPath();

  cloudTasksAuth = new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    ...(!credentials && keyFile ? { keyFile } : {}),
    projectId,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return cloudTasksAuth;
}

async function getCloudTasksAuthorizationHeader(url) {
  const headers = await getCloudTasksAuth().getRequestHeaders(url);
  const authorization =
    typeof headers.get === "function"
      ? headers.get("authorization")
      : headers.authorization || headers.Authorization;

  if (!authorization) {
    throw new Error("Could not authorize GCP Cloud Tasks request.");
  }

  return authorization;
}

function getAwsClientOptions() {
  const accessKeyId = getEnv(
    "AWS_APP_ENQUEUE_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  );
  const secretAccessKey = getEnv(
    "AWS_APP_ENQUEUE_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  );

  if (!accessKeyId || !secretAccessKey) {
    return {};
  }

  return {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function normalizeInteger(value, fallback, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

function isAwsSocialScheduleName(name) {
  return Boolean(
    name &&
      name.startsWith(AWS_SOCIAL_SCHEDULE_PREFIX) &&
      !name.startsWith(GCP_SOCIAL_SCHEDULE_PREFIX),
  );
}

function isAwsResourceNotFound(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    String(error.name) === "ResourceNotFoundException"
  );
}

function validateDispatchUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Cloud Tasks dispatch URL must use https.");
  }
}

async function getResponseSummary(response) {
  const body = await response.text().catch(() => "");

  return body.slice(0, 500);
}

function getRequiredEnv(...names) {
  const value = getEnv(...names);

  if (!value) {
    throw new Error(`Missing ${names.join(" or ")}`);
  }

  return value;
}

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function getLocalApplicationDefaultCredentialsPath() {
  return existsSync(localApplicationDefaultCredentialsPath)
    ? localApplicationDefaultCredentialsPath
    : "";
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

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}
