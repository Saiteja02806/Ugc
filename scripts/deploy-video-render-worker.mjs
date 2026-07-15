import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

loadEnvFile(resolve(".env.local"));

const region = getRequiredEnv("AWS_REGION");
const clusterName = getRequiredEnv("ECS_CLUSTER_NAME");
const repositoryUri = getRequiredEnv("ECR_REPOSITORY_URI");
const workerSecretArn = getRequiredEnv("WORKER_SECRET_ARN");
const videoRenderQueueUrl = getRequiredEnv("UGC_VIDEO_RENDER_QUEUE_URL");
const imageTag =
  process.env.ECS_VIDEO_RENDER_IMAGE_TAG?.trim() ||
  `video-render-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const imageUri = `${repositoryUri}:${imageTag}`;
const latestImageUri = `${repositoryUri}:latest`;
const registryHost = repositoryUri.split("/")[0];
const tempDir = mkdtempSync(join(tmpdir(), "ugc-video-worker-deploy-"));
const dockerConfigDir = join(tempDir, "docker-config");

try {
  mkdirSync(dockerConfigDir, {
    recursive: true,
  });
  writeFileSync(join(tempDir, "task-definition.json"), "{}\n");
  writeFileSync(join(tempDir, "empty"), "");

  console.log(`Building worker image ${imageUri}`);
  docker(["build", "-t", imageUri, "./worker"]);
  docker(["tag", imageUri, latestImageUri]);

  console.log(`Logging in to ECR ${registryHost}`);
  const password = awsText(["ecr", "get-login-password", "--region", region]);
  docker(["login", "--username", "AWS", "--password-stdin", registryHost], {
    input: password,
    stdio: "pipe",
  });

  console.log(`Pushing worker image ${imageUri}`);
  docker(["push", imageUri]);
  console.log(`Pushing worker image ${latestImageUri}`);
  docker(["push", latestImageUri]);

  const serviceName = await findVideoRenderServiceName();
  console.log(`Using ECS service ${serviceName}`);

  const service = describeService(serviceName);
  const currentTaskDefinitionArn = service.taskDefinition;

  if (!currentTaskDefinitionArn) {
    throw new Error(`ECS service ${serviceName} does not have a task definition.`);
  }

  const currentTaskDefinition = awsJson([
    "ecs",
    "describe-task-definition",
    "--task-definition",
    currentTaskDefinitionArn,
  ]).taskDefinition;
  const registerInput = buildTaskDefinitionRegistrationInput(
    currentTaskDefinition,
    imageUri,
  );
  const taskDefinitionPath = join(tempDir, "task-definition.json");

  writeFileSync(taskDefinitionPath, JSON.stringify(registerInput, null, 2));

  const registered = awsJson([
    "ecs",
    "register-task-definition",
    "--cli-input-json",
    `file://${taskDefinitionPath}`,
  ]);
  const newTaskDefinitionArn = registered.taskDefinition?.taskDefinitionArn;

  if (!newTaskDefinitionArn) {
    throw new Error("AWS did not return a new task definition ARN.");
  }

  console.log(`Registered task definition ${newTaskDefinitionArn}`);
  awsJson([
    "ecs",
    "update-service",
    "--cluster",
    clusterName,
    "--service",
    serviceName,
    "--task-definition",
    newTaskDefinitionArn,
  ]);
  console.log("Waiting for ECS service to become stable");
  aws([
    "ecs",
    "wait",
    "services-stable",
    "--cluster",
    clusterName,
    "--services",
    serviceName,
  ]);

  const updatedService = describeService(serviceName);
  console.log("Video render worker deployment completed");
  console.log(`Service: ${updatedService.serviceName}`);
  console.log(`Task definition: ${updatedService.taskDefinition}`);
  console.log(`Desired/running: ${updatedService.desiredCount}/${updatedService.runningCount}`);
  console.log(`Image: ${imageUri}`);
} finally {
  rmSync(tempDir, {
    force: true,
    recursive: true,
  });
}

async function findVideoRenderServiceName() {
  const explicitServiceName = process.env.ECS_VIDEO_RENDER_SERVICE_NAME?.trim();

  if (explicitServiceName) {
    return explicitServiceName;
  }

  const serviceArns = listAllServiceArns();
  const matches = [];

  for (const chunk of chunkArray(serviceArns, 10)) {
    const services = awsJson([
      "ecs",
      "describe-services",
      "--cluster",
      clusterName,
      "--services",
      ...chunk,
    ]).services ?? [];

    for (const service of services) {
      const taskDefinitionArn = service.taskDefinition;

      if (!taskDefinitionArn) {
        continue;
      }

      const taskDefinition = awsJson([
        "ecs",
        "describe-task-definition",
        "--task-definition",
        taskDefinitionArn,
      ]).taskDefinition;

      if (isVideoRenderTaskDefinition(service, taskDefinition)) {
        matches.push(service.serviceName);
      }
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple video render ECS services matched: ${matches.join(
        ", ",
      )}. Set ECS_VIDEO_RENDER_SERVICE_NAME in .env.local.`,
    );
  }

  throw new Error(
    "Could not discover the video render ECS service. Set ECS_VIDEO_RENDER_SERVICE_NAME in .env.local.",
  );
}

function listAllServiceArns() {
  const serviceArns = [];
  let nextToken;

  do {
    const args = ["ecs", "list-services", "--cluster", clusterName];

    if (nextToken) {
      args.push("--next-token", nextToken);
    }

    const result = awsJson(args);
    serviceArns.push(...(result.serviceArns ?? []));
    nextToken = result.nextToken;
  } while (nextToken);

  return serviceArns;
}

function isVideoRenderTaskDefinition(service, taskDefinition) {
  const serviceName = String(service.serviceName ?? "").toLowerCase();
  const family = String(taskDefinition.family ?? "").toLowerCase();

  if (serviceName.includes("video") && serviceName.includes("render")) {
    return true;
  }

  if (family.includes("video") && family.includes("render")) {
    return true;
  }

  return (taskDefinition.containerDefinitions ?? []).some((container) => {
    const env = new Map(
      (container.environment ?? []).map((entry) => [entry.name, entry.value]),
    );
    const workerJobTypes = env.get("WORKER_JOB_TYPES") ?? "";
    const workerQueueName = env.get("WORKER_QUEUE_NAME") ?? "";
    const workerQueueUrl = env.get("WORKER_QUEUE_URL") ?? "";

    return (
      workerJobTypes.split(",").map((value) => value.trim()).includes("render_edit_video") ||
      workerJobTypes.split(",").map((value) => value.trim()).includes("render_schedule_combination") ||
      workerQueueName === "video-render" ||
      workerQueueUrl === videoRenderQueueUrl
    );
  });
}

function describeService(serviceName) {
  const result = awsJson([
    "ecs",
    "describe-services",
    "--cluster",
    clusterName,
    "--services",
    serviceName,
  ]);
  const service = result.services?.[0];

  if (!service) {
    throw new Error(`ECS service ${serviceName} was not found.`);
  }

  if (result.failures?.length) {
    throw new Error(`ECS describe-services returned failures: ${JSON.stringify(result.failures)}`);
  }

  return service;
}

function buildTaskDefinitionRegistrationInput(taskDefinition, newImageUri) {
  const containerName =
    process.env.ECS_WORKER_CONTAINER_NAME?.trim() ||
    findWorkerContainerName(taskDefinition);
  const containerDefinitions = taskDefinition.containerDefinitions.map((container) => {
    if (container.name !== containerName) {
      return container;
    }

    return {
      ...container,
      image: newImageUri,
      environment: upsertEnvironment(container.environment ?? [], {
        AWS_REGION: region,
        AWS_S3_BUCKET: getRequiredEnv("AWS_S3_BUCKET"),
        CLOUDFRONT_DOMAIN: getRequiredEnv("CLOUDFRONT_DOMAIN"),
        UGC_INTERNAL_APP_URL:
          process.env.UGC_INTERNAL_APP_URL?.trim() ||
          "https://www.getugcpilot.com",
        WORKER_JOB_TYPES: "render_edit_video,render_schedule_combination",
        WORKER_QUEUE_NAME: "video-render",
        WORKER_QUEUE_URL: videoRenderQueueUrl,
      }),
      secrets: upsertSecrets(container.secrets ?? [], {
        SUPABASE_SERVICE_ROLE_KEY: `${workerSecretArn}:SUPABASE_SERVICE_ROLE_KEY::`,
        SUPABASE_URL: `${workerSecretArn}:SUPABASE_URL::`,
      }),
    };
  });

  if (!containerDefinitions.some((container) => container.name === containerName)) {
    throw new Error(`Could not find worker container ${containerName} in current task definition.`);
  }

  return removeUndefined({
    containerDefinitions,
    cpu: taskDefinition.cpu,
    ephemeralStorage: taskDefinition.ephemeralStorage,
    executionRoleArn: taskDefinition.executionRoleArn,
    family:
      process.env.ECS_VIDEO_RENDER_TASK_FAMILY?.trim() ||
      taskDefinition.family,
    inferenceAccelerators: taskDefinition.inferenceAccelerators,
    ipcMode: taskDefinition.ipcMode,
    memory: taskDefinition.memory,
    networkMode: taskDefinition.networkMode,
    pidMode: taskDefinition.pidMode,
    placementConstraints: taskDefinition.placementConstraints,
    proxyConfiguration: taskDefinition.proxyConfiguration,
    requiresCompatibilities: taskDefinition.requiresCompatibilities,
    runtimePlatform: taskDefinition.runtimePlatform,
    taskRoleArn: taskDefinition.taskRoleArn,
    volumes: taskDefinition.volumes,
  });
}

function findWorkerContainerName(taskDefinition) {
  const containers = taskDefinition.containerDefinitions ?? [];

  if (containers.length === 1) {
    return containers[0].name;
  }

  const workerContainer = containers.find((container) =>
    String(container.name ?? "").toLowerCase().includes("worker"),
  );

  if (workerContainer) {
    return workerContainer.name;
  }

  throw new Error(
    "Could not infer worker container name. Set ECS_WORKER_CONTAINER_NAME in .env.local.",
  );
}

function upsertEnvironment(environment, values) {
  const byName = new Map(environment.map((entry) => [entry.name, entry]));

  for (const [name, value] of Object.entries(values)) {
    byName.set(name, {
      name,
      value,
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function upsertSecrets(secrets, values) {
  const byName = new Map(secrets.map((entry) => [entry.name, entry]));

  for (const [name, valueFrom] of Object.entries(values)) {
    byName.set(name, {
      name,
      valueFrom,
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

function chunkArray(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function docker(args, options = {}) {
  return run("docker", args, {
    ...options,
    env: {
      ...commandEnv(),
      DOCKER_CONFIG: dockerConfigDir,
    },
  });
}

function aws(args) {
  return run("aws", args, {
    env: commandEnv(),
  });
}

function awsJson(args) {
  const output = awsText([...args, "--output", "json"]);

  return JSON.parse(output);
}

function awsText(args) {
  return run("aws", args, {
    env: commandEnv(),
    stdio: "pipe",
  }).stdout;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    input: options.input,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? commandEnv(),
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }

  return {
    stdout: result.stdout ?? "",
  };
}

function commandEnv() {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID:
      process.env.AWS_DEPLOY_ACCESS_KEY_ID?.trim() ||
      process.env.AWS_ACCESS_KEY_ID?.trim(),
    AWS_SECRET_ACCESS_KEY:
      process.env.AWS_DEPLOY_SECRET_ACCESS_KEY?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
    AWS_REGION: region,
  };
  const deploySessionToken = process.env.AWS_DEPLOY_SESSION_TOKEN?.trim();

  if (deploySessionToken) {
    env.AWS_SESSION_TOKEN = deploySessionToken;
  } else {
    delete env.AWS_SESSION_TOKEN;
  }

  return env;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

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
