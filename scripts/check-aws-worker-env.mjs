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
];

const workerSecretExpectedKeys = [
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "CLOUDFRONT_DOMAIN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "RUNWAYML_API_SECRET",
  "PEXELS_API_KEY",
  "UGC_AI_GENERATION_QUEUE_URL",
  "UGC_CAROUSEL_QUEUE_URL",
  "UGC_VIDEO_RENDER_QUEUE_URL",
  "UGC_MEDIA_PROCESSING_QUEUE_URL",
  "UGC_SOCIAL_PUBLISH_QUEUE_URL",
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
}

console.log("");
console.log("Confirm these keys exist inside the ECS worker Secrets Manager secret:");

for (const key of workerSecretExpectedKeys) {
  console.log(`CHECK ${key}`);
}

if (hasFailure) {
  process.exitCode = 1;
}
