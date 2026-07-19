import { v1 } from "@google-cloud/pubsub";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envFilePath = join(process.cwd(), ".env.local");
const terminalJobStatuses = new Set(["cancelled", "completed", "failed"]);

loadLocalEnv();

const options = parseArguments(process.argv.slice(2));
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const pubsubSubscription =
  options.subscription ||
  process.env.UGC_SOCIAL_PUBLISH_PUBSUB_SUBSCRIPTION?.trim() ||
  "ugc-social-publish-sub";
const queueName = options.queueName || "social-publish";
const maxMessages = normalizeInteger(options.maxMessages, 20, 1, 100);

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
const subscriber = new v1.SubscriberClient({ projectId });

const [openJobs, pulledMessages] = await Promise.all([
  listOpenSocialPublishJobs(),
  pullInspectableMessages(),
]);
const messageInspection = await inspectPulledMessages(pulledMessages);

await releaseOrDrainPulledMessages(messageInspection);

printReport({
  messageInspection,
  openJobs,
  projectId,
  pubsubSubscription,
  queueName,
});

const hasUnsafeMessages = messageInspection.some((entry) => entry.isUnsafe);

if (openJobs.length > 0 || hasUnsafeMessages) {
  process.exitCode = 1;
}

async function listOpenSocialPublishJobs() {
  const { data, error } = await supabase
    .from("background_jobs")
    .select(
      "id,status,job_type,queue_name,user_id,created_at,updated_at,next_attempt_at,attempt_count,worker_id,input_json",
    )
    .eq("job_type", "publish_social_post")
    .eq("queue_name", queueName)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Could not list open social publish jobs: ${error.message}`);
  }

  return data ?? [];
}

async function pullInspectableMessages() {
  const subscription = getSubscriptionPath();
  const [response] = await subscriber.pull({
    maxMessages,
    returnImmediately: true,
    subscription,
  });

  return response.receivedMessages ?? [];
}

async function inspectPulledMessages(receivedMessages) {
  const inspections = [];

  for (const receivedMessage of receivedMessages) {
    const parsedMessage = parsePulledWorkerMessage(receivedMessage);
    const ackId = receivedMessage.ackId ?? null;
    const messageId = receivedMessage.message?.messageId ?? "unknown-message";
    const attributes = receivedMessage.message?.attributes ?? {};
    const job = parsedMessage?.jobId
      ? await getJobByIdOrNull(parsedMessage.jobId)
      : null;
    const isSafeCanary = job ? isSafeCanaryJob(job) : false;
    const isTerminal = job ? terminalJobStatuses.has(job.status) : false;
    const isUnsafe =
      Boolean(job) &&
      !isTerminal &&
      job.job_type === "publish_social_post" &&
      job.queue_name === queueName;

    inspections.push({
      ackId,
      attributes,
      isSafeCanary,
      isTerminal,
      isUnsafe,
      job,
      messageId,
      parsedMessage,
    });
  }

  return inspections;
}

async function releaseOrDrainPulledMessages(inspections) {
  const subscription = getSubscriptionPath();
  const ackIds = [];
  const releaseIds = [];

  for (const inspection of inspections) {
    if (!inspection.ackId) {
      continue;
    }

    if (
      options.drainTerminalCanary &&
      options.yes &&
      inspection.isTerminal &&
      inspection.isSafeCanary
    ) {
      ackIds.push(inspection.ackId);
      continue;
    }

    releaseIds.push(inspection.ackId);
  }

  if (ackIds.length > 0) {
    await subscriber.acknowledge({
      ackIds,
      subscription,
    });
  }

  if (releaseIds.length > 0) {
    await subscriber.modifyAckDeadline({
      ackDeadlineSeconds: 0,
      ackIds: releaseIds,
      subscription,
    });
  }
}

async function getJobByIdOrNull(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select(
      "id,status,job_type,queue_name,user_id,created_at,updated_at,next_attempt_at,attempt_count,worker_id,input_json",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read background job ${jobId}: ${error.message}`);
  }

  return data;
}

function printReport(params) {
  const unsafeMessages = params.messageInspection.filter(
    (entry) => entry.isUnsafe,
  );
  const drainedCount = params.messageInspection.filter(
    (entry) =>
      options.drainTerminalCanary &&
      options.yes &&
      entry.isTerminal &&
      entry.isSafeCanary,
  ).length;

  console.log("GCP social-publish cutover guard");
  console.log(`Project: ${params.projectId}`);
  console.log(`Subscription: ${params.pubsubSubscription}`);
  console.log(`Queue: ${params.queueName}`);
  console.log(`Open publish_social_post jobs: ${params.openJobs.length}`);
  console.log(`Pulled Pub/Sub messages for inspection: ${params.messageInspection.length}`);
  console.log(`Unsafe Pub/Sub messages: ${unsafeMessages.length}`);
  console.log(`Terminal canary messages drained: ${drainedCount}`);

  for (const job of params.openJobs) {
    console.log(
      [
        "OPEN_JOB",
        `id=${job.id}`,
        `status=${job.status}`,
        `attempts=${job.attempt_count}`,
        `nextAttemptAt=${job.next_attempt_at ?? "none"}`,
        `user=${job.user_id ?? "none"}`,
      ].join(" "),
    );
  }

  for (const entry of params.messageInspection) {
    const job = entry.job;
    console.log(
      [
        "PUBSUB_MESSAGE",
        `id=${entry.messageId}`,
        `jobId=${entry.parsedMessage?.jobId ?? "none"}`,
        `jobType=${entry.parsedMessage?.jobType ?? "none"}`,
        `jobStatus=${job?.status ?? "missing"}`,
        `canary=${entry.isSafeCanary}`,
        `unsafe=${entry.isUnsafe}`,
      ].join(" "),
    );
  }

  if (params.openJobs.length > 0 || unsafeMessages.length > 0) {
    console.error(
      "Cutover guard failed: enabling the always-on worker could consume real social publish work.",
    );
    return;
  }

  console.log("Cutover guard passed: no open social publish jobs or unsafe Pub/Sub messages were found.");
}

function parseArguments(args) {
  const parsed = {
    drainTerminalCanary: false,
    maxMessages: null,
    projectId: null,
    queueName: null,
    subscription: null,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--drain-terminal-canary") {
      parsed.drainTerminalCanary = true;
      continue;
    }

    if (argument === "--yes") {
      parsed.yes = true;
      continue;
    }

    if (argument === "--max-messages") {
      parsed.maxMessages = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    if (argument === "--project-id") {
      parsed.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--queue-name") {
      parsed.queueName = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--subscription") {
      parsed.subscription = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  if (parsed.drainTerminalCanary && !parsed.yes) {
    throw new Error(
      "Refusing to drain terminal canary messages without --yes.",
    );
  }

  return parsed;
}

function parsePulledWorkerMessage(receivedMessage) {
  const rawBody = decodePubSubData(receivedMessage.message?.data ?? null);

  if (!rawBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawBody);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function decodePubSubData(data) {
  if (!data) {
    return null;
  }

  if (typeof data !== "string") {
    return Buffer.from(data).toString("utf8");
  }

  const decodedValue = Buffer.from(data, "base64").toString("utf8");

  return decodedValue.trim().startsWith("{") ? decodedValue : data;
}

function isSafeCanaryJob(job) {
  const input = asObject(job.input_json);
  const canaryName = typeof input.canary === "string" ? input.canary : "";
  const userId = typeof job.user_id === "string" ? job.user_id : "";

  return (
    job.job_type === "publish_social_post" &&
    job.queue_name === queueName &&
    (userId.startsWith("gcp-social-") ||
      canaryName.startsWith("gcp-social-publish-worker"))
  );
}

function getSubscriptionPath() {
  return subscriber.subscriptionPath(projectId, pubsubSubscription);
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

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
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
