import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

loadEnvFile(path.resolve(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const region = getRequiredEnv("AWS_REGION");
const clusterName = getRequiredEnv("ECS_CLUSTER_NAME");
const serviceName =
  args.service ||
  process.env.ECS_CAROUSEL_SERVICE_NAME?.trim() ||
  "ugc-carousel-worker-service";
const expected = {
  broadMatcherMode: args["broad-mode"] || "dry-run",
  broadMatcherVersion: args["broad-version"] || "broad-runtime-matcher-v2",
  contentPlannerVersion:
    args["planner-version"] || "llm-carousel-planner-v12-concrete-outcome-guard",
  fallbackDisabled: args["fallback-disabled"] || "true",
  rendererVersion:
    args["renderer-version"] ||
    "social-bubble-renderer-v7-contained-line-rectangles",
  safetyPolicyVersion:
    args["safety-version"] || "object-only-no-human-v1",
};
const logMinutes = getIntegerArg("minutes", 60, { min: 1, max: 240 });

const service = getService();
const taskDefinitionArn = service.taskDefinition;
const taskDefinition = describeTaskDefinition(taskDefinitionArn);
const workerContainer = findCarouselWorkerContainer(taskDefinition);
const environment = new Map(
  (workerContainer.environment ?? []).map((entry) => [entry.name, entry.value]),
);
const startupLog = getLatestStartupLog({
  sinceMs: Date.now() - logMinutes * 60_000,
  workerVersion: environment.get("WORKER_VERSION") ?? null,
});
const checks = [
  checkEqual(
    "ecs.carouselBroadMatcherMode",
    environment.get("CAROUSEL_BROAD_MATCHER_MODE"),
    expected.broadMatcherMode,
  ),
  checkEqual(
    "ecs.carouselDisableCategoryFallback",
    environment.get("CAROUSEL_DISABLE_CATEGORY_FALLBACK"),
    expected.fallbackDisabled,
  ),
  checkEqual(
    "log.carouselBroadMatcherMode",
    startupLog?.metadata?.carouselBroadMatcherMode,
    expected.broadMatcherMode,
  ),
  checkEqual(
    "log.carouselBroadMatcherVersion",
    startupLog?.metadata?.carouselBroadMatcherVersion,
    expected.broadMatcherVersion,
  ),
  checkEqual(
    "log.carouselImageSafetyPolicyVersion",
    startupLog?.metadata?.carouselImageSafetyPolicyVersion,
    expected.safetyPolicyVersion,
  ),
  checkEqual(
    "log.carouselContentPlannerVersion",
    startupLog?.metadata?.carouselContentPlannerVersion,
    expected.contentPlannerVersion,
  ),
  checkEqual(
    "log.carouselRendererVersion",
    startupLog?.metadata?.carouselRendererVersion,
    expected.rendererVersion,
  ),
  checkEqual(
    "log.carouselFont.available",
    startupLog?.metadata?.carouselFont?.available,
    true,
  ),
];
const failures = checks.filter((check) => !check.ok);

console.log(
  JSON.stringify(
    {
      checks,
      clusterName,
      latestStartupLog: startupLog
        ? {
            metadata: startupLog.metadata,
            timestamp: startupLog.timestamp,
          }
        : null,
      serviceName,
      taskDefinitionArn,
      workerImage: workerContainer.image,
      workerVersion: environment.get("WORKER_VERSION") ?? null,
    },
    null,
    2,
  ),
);

if (!startupLog) {
  console.error(
    JSON.stringify(
      {
        error: `No carousel UGC worker startup log found in the last ${logMinutes} minutes.`,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}

function getService() {
  const response = awsJson([
    "ecs",
    "describe-services",
    "--region",
    region,
    "--cluster",
    clusterName,
    "--services",
    serviceName,
  ]);
  const service = response.services?.[0];

  if (!service || service.status === "INACTIVE") {
    throw new Error(`ECS service "${serviceName}" was not found.`);
  }

  return service;
}

function describeTaskDefinition(taskDefinitionArn) {
  const response = awsJson([
    "ecs",
    "describe-task-definition",
    "--region",
    region,
    "--task-definition",
    taskDefinitionArn,
  ]);

  if (!response.taskDefinition) {
    throw new Error(`Could not describe task definition ${taskDefinitionArn}.`);
  }

  return response.taskDefinition;
}

function findCarouselWorkerContainer(taskDefinition) {
  const container = (taskDefinition.containerDefinitions ?? []).find((entry) => {
    const environment = new Map(
      (entry.environment ?? []).map((item) => [item.name, item.value]),
    );

    return (
      environment.get("WORKER_QUEUE_NAME") === "carousel" ||
      String(environment.get("WORKER_JOB_TYPES") ?? "")
        .split(",")
        .map((value) => value.trim())
        .includes("generate_carousel")
    );
  });

  if (!container) {
    throw new Error("Could not find carousel worker container in task definition.");
  }

  return container;
}

function getLatestStartupLog({ sinceMs, workerVersion }) {
  const response = awsJson([
    "logs",
    "filter-log-events",
    "--log-group-name",
    getRequiredEnv("CLOUDWATCH_LOG_GROUP"),
    "--region",
    region,
    "--start-time",
    String(sinceMs),
    "--filter-pattern",
    '"UGC worker started"',
    "--no-paginate",
  ]);

  return (response.events ?? [])
    .map((event) => {
      try {
        return {
          ...JSON.parse(event.message),
          timestamp: event.timestamp,
        };
      } catch {
        return null;
      }
    })
    .filter(
      (entry) =>
        entry?.message === "UGC worker started" &&
        entry.metadata?.queueName === "carousel" &&
        (!workerVersion || entry.metadata?.workerVersion === workerVersion),
    )
    .sort((left, right) => right.timestamp - left.timestamp)[0] ?? null;
}

function checkEqual(name, actual, expectedValue) {
  return {
    actual: actual ?? null,
    expected: expectedValue,
    name,
    ok: actual === expectedValue,
  };
}

function awsJson(args) {
  return JSON.parse(awsText([...args, "--output", "json"]));
}

function awsText(args) {
  const result = spawnSync("aws", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: commandEnv(),
    stdio: "pipe",
    timeout: 180_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `aws ${args.join(" ")} exited with code ${result.status}: ${result.stderr?.trim()}`,
    );
  }

  return result.stdout ?? "";
}

function commandEnv() {
  const environment = {
    ...process.env,
    AWS_ACCESS_KEY_ID:
      process.env.AWS_DEPLOY_ACCESS_KEY_ID?.trim() ||
      process.env.AWS_ACCESS_KEY_ID?.trim(),
    AWS_REGION: region,
    AWS_SECRET_ACCESS_KEY:
      process.env.AWS_DEPLOY_SECRET_ACCESS_KEY?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
    AWS_PAGER: "",
  };
  const sessionToken = process.env.AWS_DEPLOY_SESSION_TOKEN?.trim();

  if (sessionToken) {
    environment.AWS_SESSION_TOKEN = sessionToken;
  } else {
    delete environment.AWS_SESSION_TOKEN;
  }

  return environment;
}

function getIntegerArg(name, defaultValue, { min, max }) {
  const rawValue = args[name];
  const value = rawValue === undefined ? defaultValue : Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a number.`);
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
