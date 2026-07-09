import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const envFilePath = join(process.cwd(), ".env.local");
const workerDir = join(process.cwd(), "worker");
const runId = `ecs-smoke-${randomUUID()}`;
const testMessage =
  process.argv.slice(2).filter((arg) => !arg.startsWith("--")).join(" ").trim() ||
  "hello ecs fargate worker";

loadLocalEnv();

const requiredEnvKeys = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "CLOUDWATCH_LOG_GROUP",
  "ECR_REPOSITORY_URI",
  "ECS_CLUSTER_NAME",
  "ECS_TASK_EXECUTION_ROLE_ARN",
  "ECS_TASK_ROLE_ARN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "UGC_MEDIA_PROCESSING_QUEUE_URL",
  "WORKER_SECRET_ARN",
  "WORKER_SECURITY_GROUP_ID",
  "WORKER_SUBNET_IDS",
];

for (const key of requiredEnvKeys) {
  getRequiredEnv(key);
}

const config = {
  assignPublicIp: getOptionalEnv("ECS_WORKER_ASSIGN_PUBLIC_IP", "ENABLED"),
  awsRegion: getRequiredEnv("AWS_REGION"),
  cloudWatchLogGroup: getRequiredEnv("CLOUDWATCH_LOG_GROUP"),
  clusterName: getRequiredEnv("ECS_CLUSTER_NAME"),
  containerName: getOptionalEnv("ECS_WORKER_CONTAINER_NAME", "ugc-worker"),
  cpu: getOptionalEnv("ECS_WORKER_CPU", "512"),
  ecrRepositoryUri: getRequiredEnv("ECR_REPOSITORY_URI"),
  executionRoleArn: getRequiredEnv("ECS_TASK_EXECUTION_ROLE_ARN"),
  imageTag: getOptionalEnv("ECS_TEST_IMAGE_TAG", createImageTag()),
  logStreamPrefix: getOptionalEnv("ECS_WORKER_LOG_STREAM_PREFIX", "worker-smoke"),
  maxTaskRuns: getIntegerEnv("ECS_TEST_MAX_TASK_RUNS", 3, {
    max: 10,
    min: 1,
  }),
  mediaProcessingQueueUrl: getRequiredEnv("UGC_MEDIA_PROCESSING_QUEUE_URL"),
  memory: getOptionalEnv("ECS_WORKER_MEMORY", "1024"),
  securityGroupId: getRequiredEnv("WORKER_SECURITY_GROUP_ID"),
  skipImagePush:
    process.argv.includes("--skip-image-push") ||
    process.env.ECS_TEST_SKIP_IMAGE_PUSH?.trim() === "true",
  subnets: splitCsvEnv("WORKER_SUBNET_IDS"),
  taskFamily: getOptionalEnv("ECS_WORKER_TASK_FAMILY", "ugc-worker-test"),
  taskRoleArn: getRequiredEnv("ECS_TASK_ROLE_ARN"),
  workerSecretArn: getRequiredEnv("WORKER_SECRET_ARN"),
};

config.imageUri =
  process.env.ECS_TEST_IMAGE_URI?.trim() ||
  `${config.ecrRepositoryUri}:${config.imageTag}`;

const awsCliEnv = {
  ...process.env,
  AWS_ACCESS_KEY_ID:
    process.env.AWS_DEPLOY_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID,
  AWS_DEFAULT_REGION: config.awsRegion,
  AWS_REGION: config.awsRegion,
  AWS_SECRET_ACCESS_KEY:
    process.env.AWS_DEPLOY_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN:
    process.env.AWS_DEPLOY_SESSION_TOKEN?.trim() ||
    process.env.AWS_SESSION_TOKEN,
};
const awsCli = resolveAwsCliInvocation();
const dockerCli = resolveDockerCliInvocation();
const dockerConfigDir = mkdtempSync(join(tmpdir(), "ugc-docker-config-"));
const dockerCliEnv = {
  ...process.env,
  DOCKER_CONFIG: dockerConfigDir,
};

writeFileSync(join(dockerConfigDir, "config.json"), "{}\n");

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const sqs = new SQSClient({
  credentials: getSqsEnqueueCredentials(),
  region: config.awsRegion,
});

let job = null;

try {
  await assertAwsCliAvailable();

  if (!config.skipImagePush) {
    await assertDockerAvailable();
    await buildAndPushWorkerImage();
  } else {
    console.log(`Skipping image build/push. Using ${config.imageUri}`);
    await verifyEcrImageExists(config.imageUri);
  }

  const taskDefinitionArn = await registerTaskDefinition();
  console.log(`Registered task definition ${taskDefinitionArn}`);

  job = await createTestJob();
  console.log(`Created background job ${job.id}`);

  const sendResult = await enqueueTestJob(job.id);
  console.log(`Enqueued SQS message ${sendResult.MessageId ?? "unknown"}`);
  await attachAwsMessageId(job.id, sendResult.MessageId ?? null);

  const finalJob = await runTasksUntilJobCompletes(taskDefinitionArn, job.id);
  const output = asObject(finalJob.output_json);

  if (
    output.receivedMessage !== testMessage ||
    output.worker !== "ecs-fargate"
  ) {
    throw new Error(`Job ${job.id} completed with unexpected output shape.`);
  }

  console.log(`Job ${job.id} completed through ECS/Fargate`);
  console.log(`Output worker: ${output.worker}`);
  console.log("ECS test_worker_job smoke test passed");
} catch (error) {
  console.error(`ECS test_worker_job smoke test failed: ${getErrorMessage(error)}`);

  if (job?.id) {
    await markJobFailed(job.id, getErrorMessage(error)).catch((markError) => {
      console.error(
        `Could not mark failed test job ${job.id}: ${getErrorMessage(markError)}`,
      );
    });
  }

  process.exitCode = 1;
}

async function buildAndPushWorkerImage() {
  console.log(`Building worker image ${config.imageUri}`);

  const passwordResult = await runAwsCommand(
    ["ecr", "get-login-password", "--region", config.awsRegion],
    {
      quiet: true,
    },
  );

  await runDockerCommand(
    [
      "login",
      "--username",
      "AWS",
      "--password-stdin",
      getRegistryHost(config.ecrRepositoryUri),
    ],
    {
      input: passwordResult.stdout,
      quiet: true,
    },
  );

  await runDockerCommand(["build", "--pull", "-t", config.imageUri, "."], {
    cwd: workerDir,
  });

  await runDockerCommand(["push", config.imageUri]);
}

async function verifyEcrImageExists(imageUri) {
  const imageReference = parseEcrImageReference(imageUri);

  await runAwsJsonCommand("ecr", [
    "describe-images",
    "--repository-name",
    imageReference.repositoryName,
    "--image-ids",
    `imageTag=${imageReference.imageTag}`,
  ]).catch((error) => {
    throw new Error(
      `Prebuilt worker image ${imageUri} was not found or cannot be read: ${getErrorMessage(error)}`,
    );
  });
}

async function registerTaskDefinition() {
  const taskDefinition = {
    containerDefinitions: [
      {
        environment: [
          {
            name: "AWS_REGION",
            value: config.awsRegion,
          },
          {
            name: "UGC_MEDIA_PROCESSING_QUEUE_URL",
            value: config.mediaProcessingQueueUrl,
          },
          {
            name: "WORKER_QUEUE_URL",
            value: config.mediaProcessingQueueUrl,
          },
          {
            name: "WORKER_QUEUE_NAME",
            value: "media-processing",
          },
          {
            name: "WORKER_JOB_TYPES",
            value: "test_worker_job",
          },
          {
            name: "WORKER_ID",
            value: runId,
          },
          {
            name: "WORKER_POLL_MAX_MESSAGES",
            value: "10",
          },
          {
            name: "WORKER_POLL_WAIT_SECONDS",
            value: "10",
          },
          {
            name: "WORKER_RUN_ONCE",
            value: "true",
          },
          {
            name: "WORKER_VISIBILITY_TIMEOUT_SECONDS",
            value: "60",
          },
        ],
        essential: true,
        image: config.imageUri,
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": config.cloudWatchLogGroup,
            "awslogs-region": config.awsRegion,
            "awslogs-stream-prefix": config.logStreamPrefix,
          },
        },
        name: config.containerName,
        secrets: [
          {
            name: "SUPABASE_URL",
            valueFrom: `${config.workerSecretArn}:SUPABASE_URL::`,
          },
          {
            name: "SUPABASE_SERVICE_ROLE_KEY",
            valueFrom: `${config.workerSecretArn}:SUPABASE_SERVICE_ROLE_KEY::`,
          },
        ],
      },
    ],
    cpu: config.cpu,
    executionRoleArn: config.executionRoleArn,
    family: config.taskFamily,
    memory: config.memory,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    taskRoleArn: config.taskRoleArn,
  };
  const result = await runAwsJsonCommand("ecs", [
    "register-task-definition",
    "--cli-input-json",
    writeTempJsonFile(taskDefinition),
  ]);
  const taskDefinitionArn = result.taskDefinition?.taskDefinitionArn;

  if (!taskDefinitionArn) {
    throw new Error("AWS did not return a task definition ARN.");
  }

  return taskDefinitionArn;
}

async function createTestJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      created_at: now,
      input_json: {
        message: testMessage,
        source: "ecs-fargate-smoke-test",
      },
      job_type: "test_worker_job",
      queue_name: "media-processing",
      status: "queued",
      updated_at: now,
      user_id: process.env.TEST_WORKER_USER_ID?.trim() || "ecs-e2e-test",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create background job: ${error.message}`);
  }

  return data;
}

async function enqueueTestJob(jobId) {
  return sqs.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify({
        jobId,
        jobType: "test_worker_job",
      }),
      QueueUrl: config.mediaProcessingQueueUrl,
    }),
  );
}

async function attachAwsMessageId(jobId, messageId) {
  if (!messageId) {
    return;
  }

  const { error } = await supabase
    .from("background_jobs")
    .update({
      aws_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Could not attach SQS message id: ${error.message}`);
  }
}

async function runTasksUntilJobCompletes(taskDefinitionArn, jobId) {
  for (let attempt = 1; attempt <= config.maxTaskRuns; attempt += 1) {
    console.log(`Starting ECS worker attempt ${attempt}/${config.maxTaskRuns}`);

    const taskArn = await runWorkerTask(taskDefinitionArn);
    console.log(`Started ECS task ${taskArn}`);

    const task = await waitForTaskStopped(taskArn);
    await printTaskLogs(taskArn).catch((error) => {
      console.warn(`Could not read ECS task logs: ${getErrorMessage(error)}`);
    });

    const container = task.containers?.find(
      (candidate) => candidate.name === config.containerName,
    );
    const exitCode = container?.exitCode;

    if (typeof exitCode === "number" && exitCode !== 0) {
      throw new Error(`ECS worker container exited with code ${exitCode}.`);
    }

    const currentJob = await getJob(jobId);

    if (currentJob.status === "completed") {
      return currentJob;
    }

    if (currentJob.status === "failed" || currentJob.status === "cancelled") {
      throw new Error(
        `Job ${jobId} reached terminal status ${currentJob.status}: ${
          currentJob.error_message ?? "no error message"
        }`,
      );
    }

    console.log(`Job ${jobId} is still ${currentJob.status}`);
  }

  throw new Error(
    `Job ${jobId} did not complete after ${config.maxTaskRuns} ECS task run(s).`,
  );
}

async function runWorkerTask(taskDefinitionArn) {
  const runTaskInput = {
    cluster: config.clusterName,
    count: 1,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: config.assignPublicIp,
        securityGroups: [config.securityGroupId],
        subnets: config.subnets,
      },
    },
    platformVersion: "LATEST",
    taskDefinition: taskDefinitionArn,
  };
  const result = await runAwsJsonCommand("ecs", [
    "run-task",
    "--cli-input-json",
    writeTempJsonFile(runTaskInput),
  ]);

  if (result.failures?.length) {
    throw new Error(
      `ECS run-task failed: ${JSON.stringify(result.failures)}`,
    );
  }

  const taskArn = result.tasks?.[0]?.taskArn;

  if (!taskArn) {
    throw new Error("AWS did not return an ECS task ARN.");
  }

  return taskArn;
}

async function waitForTaskStopped(taskArn) {
  const deadline = Date.now() + getIntegerEnv("ECS_TEST_TIMEOUT_SECONDS", 300, {
    max: 1800,
    min: 60,
  }) * 1000;

  while (Date.now() < deadline) {
    const result = await describeTask(taskArn);
    const task = result.tasks?.[0];

    if (!task) {
      throw new Error(`Could not describe ECS task ${taskArn}.`);
    }

    console.log(`ECS task status: ${task.lastStatus}`);

    if (task.lastStatus === "STOPPED") {
      return task;
    }

    await sleep(5000);
  }

  throw new Error(`Timed out waiting for ECS task ${taskArn} to stop.`);
}

async function describeTask(taskArn) {
  return runAwsJsonCommand("ecs", [
    "describe-tasks",
    "--cluster",
    config.clusterName,
    "--tasks",
    taskArn,
  ]);
}

async function printTaskLogs(taskArn) {
  const taskId = taskArn.split("/").pop();
  const logStreamName = `${config.logStreamPrefix}/${config.containerName}/${taskId}`;
  const result = await runAwsJsonCommand("logs", [
    "get-log-events",
    "--log-group-name",
    config.cloudWatchLogGroup,
    "--log-stream-name",
    logStreamName,
    "--limit",
    "50",
    "--start-from-head",
  ]);

  for (const event of result.events ?? []) {
    if (event.message) {
      console.log(`[ecs-log] ${event.message}`);
    }
  }
}

async function getJob(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data;
}

async function markJobFailed(jobId, errorMessage) {
  const { error } = await supabase
    .from("background_jobs")
    .update({
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Could not mark failed background job: ${error.message}`);
  }
}

async function assertDockerAvailable() {
  try {
    await runDockerCommand(["version"], {
      quiet: true,
    });
  } catch {
    throw new Error(
      "Missing required command or running daemon: docker. Start Docker Desktop, or set ECS_TEST_SKIP_IMAGE_PUSH=true with ECS_TEST_IMAGE_URI for a prebuilt worker image.",
    );
  }
}

async function assertAwsCliAvailable() {
  try {
    await runAwsCommand(["--version"], {
      quiet: true,
    });
  } catch {
    throw new Error(
      "Missing required command: aws. Install AWS CLI v2, or install the Python awscli package, and configure deployment credentials with ECS/ECR/CloudWatch permissions.",
    );
  }
}

async function runAwsJsonCommand(service, args) {
  const result = await runAwsCommand([service, ...args, "--output", "json"], {
    quiet: true,
  });

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`AWS ${service} command returned invalid JSON.`);
  }
}

function runAwsCommand(args, options = {}) {
  return runCommand(awsCli.command, [...awsCli.args, ...args], {
    ...options,
    env: awsCliEnv,
  });
}

function runDockerCommand(args, options = {}) {
  return runCommand(dockerCli.command, [...dockerCli.args, ...args], {
    ...options,
    env: {
      ...dockerCliEnv,
      ...(options.env ?? {}),
    },
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const value = chunk.toString();
      stdout += value;

      if (!options.quiet) {
        process.stdout.write(value);
      }
    });

    child.stderr.on("data", (chunk) => {
      const value = chunk.toString();
      stderr += value;

      if (!options.quiet) {
        process.stderr.write(value);
      }
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve({
          stderr,
          stdout,
        });
        return;
      }

      reject(
        new Error(
          `${command} ${args[0] ?? ""} failed with code ${
            code ?? "unknown"
          }: ${summarizeCommandOutput(stderr || stdout)}`,
        ),
      );
    });

    if (options.input) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

function resolveAwsCliInvocation() {
  const configuredPath = process.env.AWS_CLI_PATH?.trim();

  if (configuredPath) {
    return createCommandInvocation(configuredPath);
  }

  const userAwsCmd = findUserAwsCliCommand();

  if (userAwsCmd) {
    return {
      args: ["-m", "awscli"],
      command: "python",
    };
  }

  return {
    args: [],
    command: "aws",
  };
}

function resolveDockerCliInvocation() {
  const configuredPath = process.env.DOCKER_CLI_PATH?.trim();

  if (configuredPath) {
    return createCommandInvocation(configuredPath);
  }

  if (process.platform === "win32") {
    const dockerDesktopPath = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";

    if (existsSync(dockerDesktopPath)) {
      return createCommandInvocation(dockerDesktopPath);
    }
  }

  return {
    args: [],
    command: "docker",
  };
}

function createCommandInvocation(commandPath) {
  if (process.platform === "win32" && commandPath.toLowerCase().endsWith(".cmd")) {
    return {
      args: ["/c", commandPath],
      command: "cmd.exe",
    };
  }

  return {
    args: [],
    command: commandPath,
  };
}

function findUserAwsCliCommand() {
  if (process.platform !== "win32" || !process.env.APPDATA) {
    return null;
  }

  const pythonDir = join(process.env.APPDATA, "Python");

  if (!existsSync(pythonDir)) {
    return null;
  }

  for (const entry of readdirSync(pythonDir)) {
    const candidatePath = join(pythonDir, entry, "Scripts", "aws.cmd");

    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function writeTempJsonFile(value) {
  const tempDir = mkdtempSync(join(tmpdir(), "ugc-ecs-worker-"));
  const filePath = join(tempDir, "input.json");

  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

  return `file://${filePath.replace(/\\/g, "/")}`;
}

function getSqsEnqueueCredentials() {
  const accessKeyId =
    process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing SQS enqueue credentials. Set AWS_APP_ENQUEUE_ACCESS_KEY_ID/AWS_APP_ENQUEUE_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
  };
}

function getRegistryHost(repositoryUri) {
  return repositoryUri.split("/")[0];
}

function parseEcrImageReference(imageUri) {
  const [, repositoryAndTag] = imageUri.split(/^[^/]+\//);

  if (!repositoryAndTag) {
    throw new Error(`Invalid ECR image URI: ${imageUri}`);
  }

  const tagSeparatorIndex = repositoryAndTag.lastIndexOf(":");
  const digestSeparatorIndex = repositoryAndTag.lastIndexOf("@");

  if (digestSeparatorIndex !== -1) {
    throw new Error(
      "ECS_TEST_IMAGE_URI must use an image tag for smoke-test verification, not a digest.",
    );
  }

  if (tagSeparatorIndex === -1) {
    return {
      imageTag: "latest",
      repositoryName: repositoryAndTag,
    };
  }

  return {
    imageTag: repositoryAndTag.slice(tagSeparatorIndex + 1),
    repositoryName: repositoryAndTag.slice(0, tagSeparatorIndex),
  };
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function createImageTag() {
  return `test-worker-${new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[^A-Za-z0-9_.-]/g, "-")}`;
}

function splitCsvEnv(name) {
  const values = getRequiredEnv(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!values.length) {
    throw new Error(`Missing ${name}`);
  }

  return values;
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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getOptionalEnv(name, fallback) {
  const value = process.env[name]?.trim();

  return value || fallback;
}

function getIntegerEnv(name, fallback, bounds) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue)) {
    return fallback;
  }

  return Math.min(Math.max(parsedValue, bounds.min), bounds.max);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function summarizeCommandOutput(value) {
  const output = value.trim().replace(/\s+/g, " ");

  if (output.length <= 500) {
    return output;
  }

  return `${output.slice(0, 500)}...`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
