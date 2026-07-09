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

const workerProfiles = {
  "ai-generation": {
    defaultDesiredCount: "1",
    defaultImageModel: "gpt-image-1",
    defaultLogStreamPrefix: "ai-generation",
    defaultServiceName: "ugc-ai-generation-worker-service",
    defaultTaskFamily: "ugc-ai-generation-worker-task",
    defaultVisibilityTimeoutSeconds: "1800",
    envPrefix: "ECS_AI_GENERATION",
    jobTypes: ["generate_avatar", "generate_image", "generate_hook_video"],
    queueName: "ai-generation",
    queueUrlEnv: "UGC_AI_GENERATION_QUEUE_URL",
    secretKeys: ["OPENAI_API_KEY", "GEMINI_API_KEY", "RUNWAYML_API_SECRET"],
  },
  carousel: {
    defaultDesiredCount: "1",
    defaultLogStreamPrefix: "carousel-worker",
    defaultServiceName: "ugc-carousel-worker-service",
    defaultTaskFamily: "ugc-carousel-worker-task",
    defaultVisibilityTimeoutSeconds: "900",
    envPrefix: "ECS_CAROUSEL",
    jobTypes: ["generate_carousel"],
    queueName: "carousel",
    queueUrlEnv: "UGC_CAROUSEL_QUEUE_URL",
    secretKeys: ["OPENAI_API_KEY"],
  },
  "video-render": {
    defaultDesiredCount: "1",
    defaultLogStreamPrefix: "video-render",
    defaultServiceName: "ugc-video-render-worker-service",
    defaultTaskFamily: "ugc-video-render-worker-task",
    defaultVisibilityTimeoutSeconds: "900",
    envPrefix: "ECS_VIDEO_RENDER",
    jobTypes: ["render_edit_video"],
    queueName: "video-render",
    queueUrlEnv: "UGC_VIDEO_RENDER_QUEUE_URL",
  },
};

const implementedWorkerJobTypes = new Set([
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "render_edit_video",
  "test_worker_job",
]);

const options = parseArguments(process.argv.slice(2));
const region = getRequiredEnv("AWS_REGION");
const clusterName = getRequiredEnv("ECS_CLUSTER_NAME");
const repositoryUri = getRequiredEnv("ECR_REPOSITORY_URI");
const workerSecretArn = getRequiredEnv("WORKER_SECRET_ARN");
const imageTag = getImageTag();
const imageUri = `${repositoryUri}:${imageTag}`;
const workerGitCommit = getWorkerGitCommit();
const registryHost = repositoryUri.split("/")[0];
const tempDir = mkdtempSync(join(tmpdir(), "ugc-worker-deploy-"));
const dockerConfigDir = join(tempDir, "docker-config");
const taskDefinitionCache = new Map();

try {
  mkdirSync(dockerConfigDir, { recursive: true });
  validateProfileHandlers(options.profileNames);
  validateAwsIdentity();
  validateRepository();

  const targets = options.profileNames.map((profileName) =>
    resolveDeploymentTarget(profileName),
  );

  printDeploymentPlan(targets);

  if (options.dryRun) {
    console.log("Dry run completed. No Docker or AWS resources were changed.");
    process.exitCode = 0;
  } else {
    validateDockerDaemon();
    buildAndPushImage();

    for (const target of targets) {
      deployTarget(target);
    }

    console.log("Worker deployment completed successfully.");
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

function parseArguments(args) {
  const flags = new Set(args.filter((argument) => argument.startsWith("--")));
  const positional = args.filter((argument) => !argument.startsWith("--"));
  const supportedFlags = new Set([
    "--all",
    "--confirm-all",
    "--create",
    "--dry-run",
    "--push-latest",
    "--register-only",
  ]);

  for (const flag of flags) {
    if (!supportedFlags.has(flag)) {
      throw new Error(`Unknown option ${flag}.`);
    }
  }

  if (flags.has("--all") && positional.length > 0) {
    throw new Error("Use either a worker profile or --all, not both.");
  }

  if (!flags.has("--all") && positional.length !== 1) {
    throw new Error(
      `Usage: node scripts/deploy-worker-service.mjs <${Object.keys(workerProfiles).join("|")}> [--dry-run] [--create]`,
    );
  }

  const profileNames = flags.has("--all")
    ? Object.keys(workerProfiles)
    : positional;

  for (const profileName of profileNames) {
    if (!workerProfiles[profileName]) {
      throw new Error(
        `Unknown worker profile "${profileName}". Available profiles: ${Object.keys(workerProfiles).join(", ")}.`,
      );
    }
  }

  if (
    flags.has("--all") &&
    !flags.has("--dry-run") &&
    !flags.has("--confirm-all")
  ) {
    throw new Error("A real --all deployment also requires --confirm-all.");
  }

  if (flags.has("--all") && flags.has("--register-only")) {
    throw new Error("--register-only must target one worker profile.");
  }

  return {
    create: flags.has("--create"),
    dryRun: flags.has("--dry-run"),
    profileNames,
    pushLatest: flags.has("--push-latest"),
    registerOnly: flags.has("--register-only"),
  };
}

function validateProfileHandlers(profileNames) {
  for (const profileName of profileNames) {
    const missingHandlers = workerProfiles[profileName].jobTypes.filter(
      (jobType) => !implementedWorkerJobTypes.has(jobType),
    );

    if (missingHandlers.length > 0) {
      throw new Error(
        `Worker profile ${profileName} cannot deploy because handlers are missing: ${missingHandlers.join(", ")}.`,
      );
    }
  }
}

function validateAwsIdentity() {
  const identity = awsJson(["sts", "get-caller-identity"]);
  const repositoryAccountId = registryHost.split(".")[0];

  if (identity.Account !== repositoryAccountId) {
    throw new Error(
      `AWS account ${identity.Account} does not match ECR account ${repositoryAccountId}.`,
    );
  }

  console.log(`AWS identity: ${identity.Arn}`);
}

function validateRepository() {
  const repositoryName = repositoryUri.split("/").at(-1);
  const result = awsJson([
    "ecr",
    "describe-repositories",
    "--region",
    region,
    "--repository-names",
    repositoryName,
  ]);
  const repository = result.repositories?.[0];

  if (!repository || repository.repositoryUri !== repositoryUri) {
    throw new Error(`ECR repository ${repositoryUri} was not found.`);
  }
}

function resolveDeploymentTarget(profileName) {
  const profile = workerProfiles[profileName];
  const queueUrl = getRequiredEnv(profile.queueUrlEnv);
  const explicitServiceName = process.env[`${profile.envPrefix}_SERVICE_NAME`]?.trim();
  let service = explicitServiceName
    ? describeServiceOrNull(explicitServiceName)
    : describeServiceOrNull(profile.defaultServiceName);

  if (explicitServiceName && !service && !options.create) {
    throw new Error(
      `Configured ECS service ${explicitServiceName} was not found. Correct ${profile.envPrefix}_SERVICE_NAME or use --create intentionally.`,
    );
  }

  if (!service && !explicitServiceName) {
    const matches = discoverMatchingServices(profile, queueUrl);

    if (matches.length > 1) {
      throw new Error(
        `Multiple ECS services match ${profileName}: ${matches.map((entry) => entry.serviceName).join(", ")}. Set ${profile.envPrefix}_SERVICE_NAME explicitly.`,
      );
    }

    service = matches[0] ?? null;
  }

  if (!service && !options.create) {
    throw new Error(
      `No ECS service matches ${profileName}. Set ${profile.envPrefix}_SERVICE_NAME or rerun with --create after configuring a template task definition.`,
    );
  }

  const serviceName =
    service?.serviceName || explicitServiceName || profile.defaultServiceName;
  const currentTaskDefinition = service?.taskDefinition
    ? describeTaskDefinition(service.taskDefinition)
    : getCreateTemplate(profile);
  const registration = buildTaskDefinitionRegistrationInput(
    profile,
    currentTaskDefinition,
    imageUri,
    Boolean(service),
  );

  return {
    currentTaskDefinition,
    profile,
    profileName,
    queueUrl,
    registration,
    service,
    serviceName,
  };
}

function discoverMatchingServices(profile, queueUrl) {
  const matches = [];

  for (const chunk of chunkArray(listAllServiceArns(), 10)) {
    const services = awsJson([
      "ecs",
      "describe-services",
      "--region",
      region,
      "--cluster",
      clusterName,
      "--services",
      ...chunk,
    ]).services ?? [];

    for (const service of services) {
      if (!service.taskDefinition) {
        continue;
      }

      const taskDefinition = describeTaskDefinition(service.taskDefinition);

      if (taskDefinitionMatchesProfile(taskDefinition, profile, queueUrl)) {
        matches.push(service);
      }
    }
  }

  return matches;
}

function taskDefinitionMatchesProfile(taskDefinition, profile, queueUrl) {
  return (taskDefinition.containerDefinitions ?? []).some((container) => {
    const environment = new Map(
      (container.environment ?? []).map((entry) => [entry.name, entry.value]),
    );
    const configuredJobTypes = String(
      environment.get("WORKER_JOB_TYPES") ?? "",
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return (
      profile.jobTypes.every((jobType) => configuredJobTypes.includes(jobType)) ||
      environment.get("WORKER_QUEUE_NAME") === profile.queueName ||
      environment.get("WORKER_QUEUE_URL") === queueUrl
    );
  });
}

function getCreateTemplate(profile) {
  const templateName =
    process.env[`${profile.envPrefix}_TEMPLATE_TASK_DEFINITION`]?.trim() ||
    process.env.ECS_WORKER_TEMPLATE_TASK_DEFINITION?.trim();

  if (!templateName) {
    throw new Error(
      `Creating ${profile.queueName} requires ${profile.envPrefix}_TEMPLATE_TASK_DEFINITION or ECS_WORKER_TEMPLATE_TASK_DEFINITION. The deployer will not copy an arbitrary service.`,
    );
  }

  return describeTaskDefinition(templateName);
}

function buildTaskDefinitionRegistrationInput(
  profile,
  taskDefinition,
  newImageUri,
  updatingExistingService,
) {
  const containerName =
    process.env.ECS_WORKER_CONTAINER_NAME?.trim() ||
    findWorkerContainerName(taskDefinition);
  const containerDefinitions = taskDefinition.containerDefinitions.map(
    (container) => {
      if (container.name !== containerName) {
        return container;
      }

      const existingEnvironment = new Map(
        (container.environment ?? []).map((entry) => [entry.name, entry.value]),
      );
      const profileSecrets = {
        SUPABASE_SERVICE_ROLE_KEY: `${workerSecretArn}:SUPABASE_SERVICE_ROLE_KEY::`,
        SUPABASE_URL: `${workerSecretArn}:SUPABASE_URL::`,
      };

      for (const secretName of profile.secretKeys ?? []) {
        profileSecrets[secretName] = `${workerSecretArn}:${secretName}::`;
      }

      return {
        ...container,
        environment: upsertEnvironment(container.environment ?? [], {
          AWS_REGION: region,
          AWS_S3_BUCKET: getRequiredEnv("AWS_S3_BUCKET"),
          CLOUDFRONT_DOMAIN: getRequiredEnv("CLOUDFRONT_DOMAIN"),
          ...(profile.defaultImageModel
            ? {
                OPENAI_IMAGE_MODEL:
                  process.env.OPENAI_IMAGE_MODEL?.trim() ||
                  profile.defaultImageModel,
              }
            : {}),
          ...(profile.queueName === "carousel"
            ? {
                CAROUSEL_BROAD_MATCHER_MODE: getProfileEnv(
                  profile,
                  "BROAD_MATCHER_MODE",
                  process.env.CAROUSEL_BROAD_MATCHER_MODE?.trim() ||
                    existingEnvironment.get("CAROUSEL_BROAD_MATCHER_MODE") ||
                    "off",
                ),
                CAROUSEL_DISABLE_CATEGORY_FALLBACK:
                  process.env.CAROUSEL_DISABLE_CATEGORY_FALLBACK?.trim() ||
                  existingEnvironment.get(
                    "CAROUSEL_DISABLE_CATEGORY_FALLBACK",
                  ) ||
                  "true",
                OPENAI_CAROUSEL_PLANNER_MODEL:
                  process.env.OPENAI_CAROUSEL_PLANNER_MODEL?.trim() ||
                  "gpt-4o-mini",
              }
            : {}),
          WORKER_JOB_TYPES: profile.jobTypes.join(","),
          WORKER_POLL_MAX_MESSAGES: getProfileEnv(
            profile,
            "POLL_MAX_MESSAGES",
            existingEnvironment.get("WORKER_POLL_MAX_MESSAGES") || "1",
          ),
          WORKER_POLL_WAIT_SECONDS: getProfileEnv(
            profile,
            "POLL_WAIT_SECONDS",
            existingEnvironment.get("WORKER_POLL_WAIT_SECONDS") || "10",
          ),
          WORKER_QUEUE_NAME: profile.queueName,
          WORKER_QUEUE_URL: getRequiredEnv(profile.queueUrlEnv),
          WORKER_GIT_COMMIT: workerGitCommit,
          WORKER_VISIBILITY_TIMEOUT_SECONDS: getProfileEnv(
            profile,
            "VISIBILITY_TIMEOUT_SECONDS",
            profile.defaultVisibilityTimeoutSeconds,
          ),
          WORKER_VERSION: imageTag,
        }),
        image: newImageUri,
        logConfiguration: buildLogConfiguration(
          profile,
          container.logConfiguration,
        ),
        secrets: upsertSecrets(container.secrets ?? [], profileSecrets),
      };
    },
  );

  if (!containerDefinitions.some((container) => container.name === containerName)) {
    throw new Error(`Worker container ${containerName} was not found.`);
  }

  return removeUndefined({
    containerDefinitions,
    cpu: taskDefinition.cpu,
    enableFaultInjection: taskDefinition.enableFaultInjection,
    ephemeralStorage: taskDefinition.ephemeralStorage,
    executionRoleArn:
      taskDefinition.executionRoleArn ||
      getRequiredEnv("ECS_TASK_EXECUTION_ROLE_ARN"),
    family: updatingExistingService
      ? taskDefinition.family
      : getProfileEnv(profile, "TASK_FAMILY", profile.defaultTaskFamily),
    inferenceAccelerators: taskDefinition.inferenceAccelerators,
    ipcMode: taskDefinition.ipcMode,
    memory: taskDefinition.memory,
    networkMode: taskDefinition.networkMode,
    pidMode: taskDefinition.pidMode,
    placementConstraints: taskDefinition.placementConstraints,
    proxyConfiguration: taskDefinition.proxyConfiguration,
    requiresCompatibilities: taskDefinition.requiresCompatibilities,
    runtimePlatform: taskDefinition.runtimePlatform,
    taskRoleArn:
      taskDefinition.taskRoleArn || getRequiredEnv("ECS_TASK_ROLE_ARN"),
    volumes: taskDefinition.volumes,
  });
}

function buildLogConfiguration(profile, currentConfiguration) {
  return {
    ...(currentConfiguration ?? {}),
    logDriver: currentConfiguration?.logDriver || "awslogs",
    options: {
      ...(currentConfiguration?.options ?? {}),
      "awslogs-group": getRequiredEnv("CLOUDWATCH_LOG_GROUP"),
      "awslogs-region": region,
      "awslogs-stream-prefix": getProfileEnv(
        profile,
        "LOG_STREAM_PREFIX",
        profile.defaultLogStreamPrefix,
      ),
    },
  };
}

function printDeploymentPlan(targets) {
  console.log(`Mode: ${options.dryRun ? "dry-run" : "deploy"}`);
  console.log(`Cluster: ${clusterName}`);
  console.log(`Image: ${imageUri}`);
  console.log(`Git commit: ${workerGitCommit}`);
  console.log(`Push latest: ${options.pushLatest ? "yes" : "no"}`);

  for (const target of targets) {
    const registeredWorkerContainer = target.registration.containerDefinitions.find(
      (container) =>
        (container.environment ?? []).some(
          (entry) => entry.name === "WORKER_JOB_TYPES",
        ),
    );
    const registeredEnvironment = new Map(
      (registeredWorkerContainer?.environment ?? []).map((entry) => [
        entry.name,
        entry.value,
      ]),
    );
    const rollbackEnabled =
      target.service?.deploymentConfiguration?.deploymentCircuitBreaker?.rollback ===
      true;

    console.log(`\nWorker profile: ${target.profileName}`);
    console.log(`Service: ${target.serviceName}`);
    console.log(
      `Operation: ${options.registerOnly ? "register task definition only" : target.service ? "update" : "create"}`,
    );
    console.log(`Queue name: ${target.profile.queueName}`);
    console.log(`Queue variable: ${target.profile.queueUrlEnv}`);
    console.log(`Job types: ${target.profile.jobTypes.join(", ")}`);
    if (target.profileName === "carousel") {
      console.log(
        `Broad matcher mode: ${registeredEnvironment.get("CAROUSEL_BROAD_MATCHER_MODE") || "missing"}`,
      );
      console.log(
        `Unrelated category fallback disabled: ${registeredEnvironment.get("CAROUSEL_DISABLE_CATEGORY_FALLBACK") || "missing"}`,
      );
    }
    console.log(
      `Current task definition: ${target.service?.taskDefinition ?? "none"}`,
    );
    console.log(
      `Network configuration: ${target.service ? "preserve current ECS service settings" : "use WORKER_SUBNET_IDS and WORKER_SECURITY_GROUP_ID"}`,
    );
    console.log(
      `Deployment rollback: ${rollbackEnabled ? "already enabled" : "will be enabled during deployment"}`,
    );
  }
}

function validateDockerDaemon() {
  const result = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    encoding: "utf8",
    env: commandEnv(),
    stdio: "pipe",
  });

  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      "Docker is installed but its daemon is not running. Start Docker Desktop before deploying.",
    );
  }
}

function buildAndPushImage() {
  console.log(`Building worker image ${imageUri}`);
  docker(["build", "-t", imageUri, "./worker"]);

  console.log(`Logging in to ECR ${registryHost}`);
  const password = awsText(["ecr", "get-login-password", "--region", region]);
  docker(["login", "--username", "AWS", "--password-stdin", registryHost], {
    input: password,
    stdio: "pipe",
  });

  console.log(`Pushing worker image ${imageUri}`);
  docker(["push", imageUri]);

  if (options.pushLatest) {
    const latestImageUri = `${repositoryUri}:latest`;
    console.log(`Updating optional convenience tag ${latestImageUri}`);
    docker(["tag", imageUri, latestImageUri]);
    docker(["push", latestImageUri]);
  }
}

function deployTarget(target) {
  const taskDefinitionPath = join(
    tempDir,
    `${target.profileName}-task-definition.json`,
  );
  writeFileSync(
    taskDefinitionPath,
    JSON.stringify(target.registration, null, 2),
  );

  const registered = awsJson([
    "ecs",
    "register-task-definition",
    "--region",
    region,
    "--cli-input-json",
    `file://${taskDefinitionPath}`,
  ]);
  const newTaskDefinitionArn = registered.taskDefinition?.taskDefinitionArn;

  if (!newTaskDefinitionArn) {
    throw new Error("AWS did not return a task definition ARN.");
  }

  console.log(`Registered ${newTaskDefinitionArn}`);

  if (options.registerOnly) {
    console.log(
      `Register-only completed for ${target.profileName}. No ECS service was created or updated.`,
    );
    return;
  }

  if (target.service) {
    awsJson([
      "ecs",
      "update-service",
      "--region",
      region,
      "--cluster",
      clusterName,
      "--service",
      target.serviceName,
      "--task-definition",
      newTaskDefinitionArn,
      "--deployment-configuration",
      "deploymentCircuitBreaker={enable=true,rollback=true}",
    ]);
  } else {
    awsJson([
      "ecs",
      "create-service",
      "--region",
      region,
      "--cluster",
      clusterName,
      "--service-name",
      target.serviceName,
      "--task-definition",
      newTaskDefinitionArn,
      "--desired-count",
      getProfileEnv(
        target.profile,
        "DESIRED_COUNT",
        target.profile.defaultDesiredCount,
      ),
      "--launch-type",
      "FARGATE",
      "--network-configuration",
      buildNetworkConfiguration(),
      "--deployment-configuration",
      "deploymentCircuitBreaker={enable=true,rollback=true}",
    ]);
  }

  console.log(`Waiting for ${target.serviceName} to become stable`);
  aws([
    "ecs",
    "wait",
    "services-stable",
    "--region",
    region,
    "--cluster",
    clusterName,
    "--services",
    target.serviceName,
  ]);

  const updatedService = describeServiceOrNull(target.serviceName);

  if (!updatedService) {
    throw new Error(`ECS service ${target.serviceName} disappeared after deployment.`);
  }

  if (updatedService.runningCount !== updatedService.desiredCount) {
    throw new Error(
      `ECS service ${target.serviceName} is stable but only ${updatedService.runningCount}/${updatedService.desiredCount} tasks are running.`,
    );
  }

  console.log(`Deployed ${target.profileName}`);
  console.log(`Service: ${target.serviceName}`);
  console.log(`Task definition: ${updatedService.taskDefinition}`);
  console.log(
    `Desired/running: ${updatedService.desiredCount}/${updatedService.runningCount}`,
  );
  console.log(`Image: ${imageUri}`);

  if (target.service?.taskDefinition) {
    console.log(
      `Rollback: aws ecs update-service --region ${region} --cluster ${clusterName} --service ${target.serviceName} --task-definition ${target.service.taskDefinition}`,
    );
  }
}

function getImageTag() {
  const configuredTag = process.env.ECS_WORKER_IMAGE_TAG?.trim();
  const generatedTag = `worker-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;
  const tag = configuredTag || generatedTag;

  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag)) {
    throw new Error(`Invalid ECS_WORKER_IMAGE_TAG: ${tag}`);
  }

  return tag;
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

function getProfileEnv(profile, suffix, fallback) {
  return process.env[`${profile.envPrefix}_${suffix}`]?.trim() || fallback;
}

function buildNetworkConfiguration() {
  const subnets = splitCsvEnv("WORKER_SUBNET_IDS");
  const securityGroups = splitCsvEnv("WORKER_SECURITY_GROUP_ID");
  const assignPublicIp =
    process.env.ECS_WORKER_ASSIGN_PUBLIC_IP?.trim() || "ENABLED";

  return `awsvpcConfiguration={subnets=[${subnets.join(",")}],securityGroups=[${securityGroups.join(",")}],assignPublicIp=${assignPublicIp}}`;
}

function listAllServiceArns() {
  const serviceArns = [];
  let nextToken;

  do {
    const args = [
      "ecs",
      "list-services",
      "--region",
      region,
      "--cluster",
      clusterName,
    ];

    if (nextToken) {
      args.push("--next-token", nextToken);
    }

    const result = awsJson(args);
    serviceArns.push(...(result.serviceArns ?? []));
    nextToken = result.nextToken;
  } while (nextToken);

  return serviceArns;
}

function describeServiceOrNull(serviceName) {
  const result = awsJson([
    "ecs",
    "describe-services",
    "--region",
    region,
    "--cluster",
    clusterName,
    "--services",
    serviceName,
  ]);
  const service = result.services?.[0];

  if (!service || service.status === "INACTIVE") {
    return null;
  }

  return service;
}

function describeTaskDefinition(taskDefinitionArn) {
  if (!taskDefinitionCache.has(taskDefinitionArn)) {
    const taskDefinition = awsJson([
      "ecs",
      "describe-task-definition",
      "--region",
      region,
      "--task-definition",
      taskDefinitionArn,
    ]).taskDefinition;

    if (!taskDefinition) {
      throw new Error(`Task definition ${taskDefinitionArn} was not found.`);
    }

    taskDefinitionCache.set(taskDefinitionArn, taskDefinition);
  }

  return taskDefinitionCache.get(taskDefinitionArn);
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
    "Could not infer worker container name. Set ECS_WORKER_CONTAINER_NAME.",
  );
}

function upsertEnvironment(environment, values) {
  const byName = new Map(environment.map((entry) => [entry.name, entry]));

  for (const [name, value] of Object.entries(values)) {
    byName.set(name, { name, value });
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function upsertSecrets(secrets, values) {
  const byName = new Map(secrets.map((entry) => [entry.name, entry]));

  for (const [name, valueFrom] of Object.entries(values)) {
    byName.set(name, { name, valueFrom });
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
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

function docker(args, runOptions = {}) {
  return run("docker", args, {
    ...runOptions,
    env: {
      ...commandEnv(),
      DOCKER_CONFIG: dockerConfigDir,
    },
  });
}

function aws(args) {
  return run("aws", args, { env: commandEnv() });
}

function awsJson(args) {
  return JSON.parse(awsText([...args, "--output", "json"]));
}

function awsText(args) {
  return run("aws", args, {
    env: commandEnv(),
    stdio: "pipe",
  }).stdout;
}

function run(command, args, runOptions = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: runOptions.env ?? commandEnv(),
    input: runOptions.input,
    stdio: runOptions.stdio ?? "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = result.stderr?.trim();
    throw new Error(
      `${command} ${args.join(" ")} exited with code ${result.status}${details ? `: ${details}` : ""}`,
    );
  }

  return { stdout: result.stdout ?? "" };
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
  };
  const sessionToken = process.env.AWS_DEPLOY_SESSION_TOKEN?.trim();

  if (sessionToken) {
    environment.AWS_SESSION_TOKEN = sessionToken;
  } else {
    delete environment.AWS_SESSION_TOKEN;
  }

  return environment;
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
