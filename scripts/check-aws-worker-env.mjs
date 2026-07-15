import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envFileName = ".env.local";
const envFilePath = join(process.cwd(), envFileName);
const gitignorePath = join(process.cwd(), ".gitignore");

const groups = [
  {
    name: "Core backend",
    keys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    name: "Media storage",
    keys: ["AWS_REGION", "AWS_S3_BUCKET", "CLOUDFRONT_DOMAIN"],
  },
  {
    name: "AI video providers",
    keys: ["GEMINI_API_KEY", "RUNWAYML_API_SECRET"],
  },
  {
    name: "App SQS enqueue",
    keys: [
      "AWS_APP_ENQUEUE_ACCESS_KEY_ID",
      "AWS_APP_ENQUEUE_SECRET_ACCESS_KEY",
    ],
  },
  {
    name: "Optional ECS deploy credentials",
    optional: true,
    keys: [
      "AWS_DEPLOY_ACCESS_KEY_ID",
      "AWS_DEPLOY_SECRET_ACCESS_KEY",
      "AWS_DEPLOY_SESSION_TOKEN",
    ],
  },
  {
    name: "ECS worker deployment",
    keys: [
      "ECS_CLUSTER_NAME",
      "WORKER_SECURITY_GROUP_ID",
      "WORKER_SUBNET_IDS",
      "ECR_REPOSITORY_URI",
      "WORKER_SECRET_ARN",
      "ECS_TASK_EXECUTION_ROLE_ARN",
      "ECS_TASK_ROLE_ARN",
      "CLOUDWATCH_LOG_GROUP",
    ],
  },
  {
    name: "SQS queues",
    keys: [
      "UGC_AI_GENERATION_QUEUE_URL",
      "UGC_AI_GENERATION_QUEUE_ARN",
      "UGC_AI_GENERATION_DLQ_ARN",
      "UGC_CAROUSEL_QUEUE_URL",
      "UGC_CAROUSEL_QUEUE_ARN",
      "UGC_CAROUSEL_DLQ_ARN",
      "UGC_VIDEO_RENDER_QUEUE_URL",
      "UGC_VIDEO_RENDER_QUEUE_ARN",
      "UGC_VIDEO_RENDER_DLQ_ARN",
      "UGC_MEDIA_PROCESSING_QUEUE_URL",
      "UGC_MEDIA_PROCESSING_QUEUE_ARN",
      "UGC_MEDIA_PROCESSING_DLQ_ARN",
      "UGC_SOCIAL_PUBLISH_QUEUE_URL",
      "UGC_SOCIAL_PUBLISH_QUEUE_ARN",
      "UGC_SOCIAL_PUBLISH_DLQ_ARN",
    ],
  },
  {
    name: "Social scheduling",
    keys: [
      "UGC_EVENTBRIDGE_SCHEDULE_GROUP",
      "UGC_EVENTBRIDGE_SCHEDULER_ROLE_ARN",
    ],
  },
  {
    name: "Social OAuth connections",
    keys: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
      "INSTAGRAM_APP_ID",
      "INSTAGRAM_APP_SECRET",
    ],
    oneOf: [["OAUTH_TOKEN_ENCRYPTION_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY"]],
  },
  {
    name: "Optional social worker secret overrides",
    optional: true,
    keys: [
      "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_ID_SECRET_ARN",
      "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_SECRET_SECRET_ARN",
    ],
  },
];

const baseWorkerSecretExpectedChecks = [
  { key: "AWS_REGION" },
  { key: "AWS_S3_BUCKET" },
  { key: "CLOUDFRONT_DOMAIN" },
  { key: "SUPABASE_URL" },
  { key: "SUPABASE_SERVICE_ROLE_KEY" },
  { key: "OPENAI_API_KEY" },
  { key: "GEMINI_API_KEY" },
  { key: "RUNWAYML_API_SECRET" },
  { key: "PEXELS_API_KEY" },
  { key: "UGC_AI_GENERATION_QUEUE_URL" },
  { key: "UGC_CAROUSEL_QUEUE_URL" },
  { key: "UGC_VIDEO_RENDER_QUEUE_URL" },
  { key: "UGC_MEDIA_PROCESSING_QUEUE_URL" },
  { key: "UGC_SOCIAL_PUBLISH_QUEUE_URL" },
  { oneOf: ["OAUTH_TOKEN_ENCRYPTION_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY"] },
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return new Map();
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries = new Map();

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
    const values = entries.get(key) ?? [];

    values.push(cleanEnvValue(rawValue));
    entries.set(key, values);
  }

  return entries;
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

function getKeyState(entries, key) {
  const fileValues = entries.get(key) ?? [];

  if (fileValues.length > 1) {
    return "duplicate";
  }

  const value = fileValues[0] ?? process.env[key] ?? "";

  return value.trim() ? "present" : "missing";
}

function checkGitignore() {
  if (!existsSync(gitignorePath)) {
    return {
      ok: false,
      message: ".gitignore is missing.",
    };
  }

  const lines = readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim());
  const ignoresEnvFiles = lines.includes(".env*");
  const allowsExample = lines.includes("!.env.example");

  return {
    ok: ignoresEnvFiles && allowsExample,
    message:
      ignoresEnvFiles && allowsExample
        ? ".env files are ignored and .env.example is allowed."
        : ".gitignore should include .env* and !.env.example.",
  };
}

const entries = parseEnvFile(envFilePath);
const workerSecretExpectedChecks = buildWorkerSecretExpectedChecks(entries);
const gitignoreCheck = checkGitignore();
let hasFailure = false;

console.log("AWS worker environment check");
console.log(`Env source: ${existsSync(envFilePath) ? envFileName : "process.env"}`);
console.log("");
console.log(`${gitignoreCheck.ok ? "OK" : "FAIL"} ${gitignoreCheck.message}`);

if (!gitignoreCheck.ok) {
  hasFailure = true;
}

for (const group of groups) {
  console.log("");
  console.log(group.name);

  for (const key of group.keys) {
    const state = getKeyState(entries, key);
    const label = state === "present" ? "OK" : state === "missing" ? "MISS" : "DUP";

    if (state !== "present" && !group.optional) {
      hasFailure = true;
    }

    console.log(`${label} ${key}`);
  }

  for (const alternatives of group.oneOf ?? []) {
    const states = alternatives.map((key) => ({
      key,
      state: getKeyState(entries, key),
    }));
    const duplicate = states.find((entry) => entry.state === "duplicate");
    const present = states.find((entry) => entry.state === "present");

    if (duplicate) {
      hasFailure = true;
      console.log(`DUP one of ${alternatives.join(" or ")} (${duplicate.key})`);
      continue;
    }

    if (!present) {
      if (!group.optional) {
        hasFailure = true;
      }
      console.log(`MISS one of ${alternatives.join(" or ")}`);
      continue;
    }

    console.log(`OK one of ${alternatives.join(" or ")} (${present.key})`);
  }
}

console.log("");
console.log("Confirm these keys exist inside the ECS worker Secrets Manager secret:");

for (const check of workerSecretExpectedChecks) {
  if (check.key) {
    console.log(`CHECK ${check.key}`);
  } else if (check.externalSecret) {
    console.log(
      `CHECK ${check.externalSecret} supplies ${check.suppliesKey}`,
    );
  } else {
    console.log(`CHECK one of ${check.oneOf.join(" or ")}`);
  }
}

if (hasFailure) {
  process.exitCode = 1;
}

function buildWorkerSecretExpectedChecks(entries) {
  const checks = [...baseWorkerSecretExpectedChecks];
  const googleClientIdSecretState = getKeyState(
    entries,
    "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_ID_SECRET_ARN",
  );
  const googleClientSecretSecretState = getKeyState(
    entries,
    "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_SECRET_SECRET_ARN",
  );

  if (googleClientIdSecretState === "present") {
    checks.push({
      externalSecret: "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_ID_SECRET_ARN",
      suppliesKey: "GOOGLE_CLIENT_ID",
    });
  } else {
    checks.push({ key: "GOOGLE_CLIENT_ID" });
  }

  if (googleClientSecretSecretState === "present") {
    checks.push({
      externalSecret: "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_SECRET_SECRET_ARN",
      suppliesKey: "GOOGLE_CLIENT_SECRET",
    });
  } else {
    checks.push({ key: "GOOGLE_CLIENT_SECRET" });
  }

  return checks;
}
