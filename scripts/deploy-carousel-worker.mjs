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
const carouselQueueUrl = getRequiredEnv("UGC_CAROUSEL_QUEUE_URL");
const imageTag =
  process.env.ECS_CAROUSEL_IMAGE_TAG?.trim() ||
  `carousel-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const imageUri = `${repositoryUri}:${imageTag}`;
const latestImageUri = `${repositoryUri}:latest`;
const workerGitCommit = getWorkerGitCommit();
const registryHost = repositoryUri.split("/")[0];
const serviceName =
  process.env.ECS_CAROUSEL_SERVICE_NAME?.trim() ||
  "ugc-carousel-worker-service";
const tempDir = mkdtempSync(join(tmpdir(), "ugc-carousel-worker-deploy-"));
const dockerConfigDir = join(tempDir, "docker-config");

try {
  mkdirSync(dockerConfigDir, {
    recursive: true,
  });

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

  const templateTaskDefinition = getTemplateTaskDefinition();
  const registerInput = buildTaskDefinitionRegistrationInput(
    templateTaskDefinition,
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
  const taskDefinitionArn = registered.taskDefinition?.taskDefinitionArn;

  if (!taskDefinitionArn) {
    throw new Error("AWS did not return a task definition ARN.");
  }

  console.log(`Registered task definition ${taskDefinitionArn}`);

  if (serviceExists(serviceName)) {
    console.log(`Updating ECS service ${serviceName}`);
    awsJson([
      "ecs",
      "update-service",
      "--cluster",
      clusterName,
      "--service",
      serviceName,
      "--task-definition",
      taskDefinitionArn,
    ]);
  } else {
    console.log(`Creating ECS service ${serviceName}`);
    awsJson([
      "ecs",
      "create-service",
      "--cluster",
      clusterName,
      "--service-name",
      serviceName,
      "--task-definition",
      taskDefinitionArn,
      "--desired-count",
      process.env.ECS_CAROUSEL_DESIRED_COUNT?.trim() || "1",
      "--launch-type",
      "FARGATE",
      "--network-configuration",
      buildNetworkConfiguration(),
    ]);
  }

  console.log("Waiting for carousel ECS service to become stable");
  aws([
    "ecs",
    "wait",
    "services-stable",
    "--cluster",
    clusterName,
    "--services",
    serviceName,
  ]);

  const service = describeService(serviceName);

  console.log("Carousel worker deployment completed");
  console.log(`Service: ${service.serviceName}`);
  console.log(`Task definition: ${service.taskDefinition}`);
  console.log(`Desired/running: ${service.desiredCount}/${service.runningCount}`);
  console.log(`Image: ${imageUri}`);
} finally {
  rmSync(tempDir, {
    force: true,
    recursive: true,
  });
}

function getTemplateTaskDefinition() {
  const explicitTemplate = process.env.ECS_CAROUSEL_TEMPLATE_TASK_DEFINITION?.trim();

  if (explicitTemplate) {
    return describeTaskDefinition(explicitTemplate);
  }

  const serviceArns = listAllServiceArns();

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
      if (!service.taskDefinition) {
        continue;
      }

      return describeTaskDefinition(service.taskDefinition);
    }
  }

  throw new Error(
    "Could not find an existing ECS task definition to use as a template.",
  );
}

function describeTaskDefinition(taskDefinitionArn) {
  return awsJson([
    "ecs",
    "describe-task-definition",
    "--task-definition",
    taskDefinitionArn,
  ]).taskDefinition;
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

function serviceExists(name) {
  const result = awsJson([
    "ecs",
    "describe-services",
    "--cluster",
    clusterName,
    "--services",
    name,
  ]);

  return Boolean(result.services?.[0] && result.services[0].status !== "INACTIVE");
}

function describeService(name) {
  const result = awsJson([
    "ecs",
    "describe-services",
    "--cluster",
    clusterName,
    "--services",
    name,
  ]);
  const service = result.services?.[0];

  if (!service) {
    throw new Error(`ECS service ${name} was not found.`);
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
      logConfiguration: getCarouselLogConfiguration(container.logConfiguration),
      environment: upsertEnvironment(container.environment ?? [], {
        AWS_REGION: region,
        AWS_S3_BUCKET: getRequiredEnv("AWS_S3_BUCKET"),
        CAROUSEL_BROAD_MATCHER_MODE:
          process.env.CAROUSEL_BROAD_MATCHER_MODE?.trim() || "dry-run",
        CAROUSEL_DISABLE_CATEGORY_FALLBACK:
          process.env.CAROUSEL_DISABLE_CATEGORY_FALLBACK?.trim() || "true",
        CLOUDFRONT_DOMAIN: getRequiredEnv("CLOUDFRONT_DOMAIN"),
        WORKER_GIT_COMMIT: workerGitCommit,
        WORKER_JOB_TYPES: "generate_carousel",
        WORKER_POLL_MAX_MESSAGES: "1",
        WORKER_QUEUE_NAME: "carousel",
        WORKER_QUEUE_URL: carouselQueueUrl,
        WORKER_VISIBILITY_TIMEOUT_SECONDS:
          process.env.ECS_CAROUSEL_VISIBILITY_TIMEOUT_SECONDS?.trim() || "900",
        WORKER_VERSION: imageTag,
      }),
      secrets: upsertSecrets(container.secrets ?? [], {
        SUPABASE_SERVICE_ROLE_KEY: `${workerSecretArn}:SUPABASE_SERVICE_ROLE_KEY::`,
        SUPABASE_URL: `${workerSecretArn}:SUPABASE_URL::`,
      }),
    };
  });

  if (!containerDefinitions.some((container) => container.name === containerName)) {
    throw new Error(`Could not find worker container ${containerName}.`);
  }

  return removeUndefined({
    containerDefinitions,
    cpu: taskDefinition.cpu,
    ephemeralStorage: taskDefinition.ephemeralStorage,
    executionRoleArn: taskDefinition.executionRoleArn,
    family:
      process.env.ECS_CAROUSEL_TASK_FAMILY?.trim() ||
      "ugc-carousel-worker-task",
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

function getCarouselLogConfiguration(logConfiguration) {
  if (!logConfiguration) {
    return logConfiguration;
  }

  return {
    ...logConfiguration,
    options: {
      ...(logConfiguration.options ?? {}),
      "awslogs-group": getRequiredEnv("CLOUDWATCH_LOG_GROUP"),
      "awslogs-region": region,
      "awslogs-stream-prefix":
        process.env.ECS_CAROUSEL_LOG_STREAM_PREFIX?.trim() ||
        "carousel-worker",
    },
  };
}

function buildNetworkConfiguration() {
  const subnets = splitCsvEnv("WORKER_SUBNET_IDS");
  const securityGroupId = getRequiredEnv("WORKER_SECURITY_GROUP_ID");
  const assignPublicIp =
    process.env.ECS_WORKER_ASSIGN_PUBLIC_IP?.trim() || "ENABLED";

  return `awsvpcConfiguration={subnets=[${subnets.join(
    ",",
  )}],securityGroups=[${securityGroupId}],assignPublicIp=${assignPublicIp}}`;
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

function splitCsvEnv(name) {
  return getRequiredEnv(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getWorkerGitCommit() {
  const configuredCommit =
    process.env.WORKER_GIT_COMMIT?.trim() ||
    process.env.GIT_COMMIT?.trim();

  if (configuredCommit) {
    return configuredCommit;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: commandEnv(),
    stdio: "pipe",
  });

  return result.status === 0 && result.stdout.trim()
    ? result.stdout.trim()
    : "unknown";
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
    AWS_REGION: region,
    AWS_SECRET_ACCESS_KEY:
      process.env.AWS_DEPLOY_SECRET_ACCESS_KEY?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
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
