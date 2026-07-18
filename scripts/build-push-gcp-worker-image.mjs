import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const options = parseArguments(process.argv.slice(2));
loadEnvFile(resolve(".env.local"));

const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const region = options.region || process.env.GCP_REGION?.trim() || "us-central1";
const repository =
  options.repository ||
  process.env.GCP_WORKER_ARTIFACT_REPOSITORY?.trim() ||
  "ugc-worker";
const imageName =
  options.imageName || process.env.GCP_WORKER_IMAGE_NAME?.trim() || "ugc-worker";
const imageTag = options.tag || getImageTag();
const workerGitCommit = getWorkerGitCommit();
const registryHost = `${region}-docker.pkg.dev`;
const imageUri = `${registryHost}/${projectId}/${repository}/${imageName}:${imageTag}`;
const latestImageUri = `${registryHost}/${projectId}/${repository}/${imageName}:latest`;
const gcloudCommand = getGcloudCommand();
const tempDir = mkdtempSync(join(tmpdir(), "ugc-gcp-worker-image-"));
const dockerConfigDir = join(tempDir, "docker-config");

try {
  mkdirSync(dockerConfigDir, { recursive: true });
  printPlan();

  if (options.dryRun) {
    console.log("Dry run completed. No Docker or GCP resources were changed.");
    process.exitCode = 0;
  } else {
    validateGcloud();
    validateArtifactRepository();
    if (options.buildMode === "cloud-build") {
      buildAndPushImageWithCloudBuild();
    } else {
      validateDockerDaemon();
      buildImage();
      loginToArtifactRegistry();
      pushImage();
    }
    console.log("GCP worker image push completed successfully.");
    console.log(`Image URI: ${imageUri}`);
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

function parseArguments(args) {
  const options = {
    buildMode: "local-docker",
    dryRun: false,
    imageName: null,
    projectId: null,
    pushLatest: false,
    region: null,
    repository: null,
    tag: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--cloud-build") {
      options.buildMode = "cloud-build";
      continue;
    }

    if (argument === "--push-latest") {
      options.pushLatest = true;
      continue;
    }

    if (argument === "--image-name") {
      options.imageName = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--project-id") {
      options.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--region") {
      options.region = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--repository") {
      options.repository = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--tag") {
      options.tag = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return options;
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printPlan() {
  validateDockerTag(imageTag);

  console.log(`Mode: ${options.dryRun ? "dry-run" : "build-and-push"}`);
  console.log(`Project: ${projectId}`);
  console.log(`Region: ${region}`);
  console.log(`Artifact Registry repository: ${repository}`);
  console.log(`Image: ${imageUri}`);
  console.log(`Git commit: ${workerGitCommit}`);
  console.log(`Build mode: ${options.buildMode}`);
  console.log(`Push latest: ${options.pushLatest ? "yes" : "no"}`);
  console.log(`gcloud: ${gcloudCommand}`);
}

function validateGcloud() {
  const account = gcloudText([
    "auth",
    "list",
    "--filter=status:ACTIVE",
    "--format=value(account)",
  ]).trim();

  if (!account) {
    throw new Error("gcloud is not authenticated. Run gcloud auth login first.");
  }

  console.log(`gcloud account: ${account}`);
}

function validateArtifactRepository() {
  const repositoryJson = gcloudText([
    "artifacts",
    "repositories",
    "describe",
    repository,
    "--location",
    region,
    "--project",
    projectId,
    "--format=json",
  ]);
  const repositoryInfo = JSON.parse(repositoryJson);

  if (repositoryInfo.format !== "DOCKER") {
    throw new Error(
      `Artifact Registry repository ${repository} exists but is not a Docker repository.`,
    );
  }
}

function validateDockerDaemon() {
  const result = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    encoding: "utf8",
    env: {
      ...commandEnv(),
      DOCKER_CONFIG: dockerConfigDir,
    },
    stdio: "pipe",
  });

  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      "Docker is installed but its daemon is not running. Start Docker Desktop before pushing the worker image.",
    );
  }
}

function buildImage() {
  console.log(`Building worker image ${imageUri}`);
  docker([
    "build",
    "--label",
    `org.opencontainers.image.revision=${workerGitCommit}`,
    "--label",
    "com.ugc.migration.target=gcp",
    "-t",
    imageUri,
    "./worker",
  ]);
}

function loginToArtifactRegistry() {
  console.log(`Logging in to Artifact Registry ${registryHost}`);
  const accessToken = gcloudText(["auth", "print-access-token"]);

  docker(
    [
      "login",
      "-u",
      "oauth2accesstoken",
      "--password-stdin",
      `https://${registryHost}`,
    ],
    {
      input: accessToken,
      stdio: "pipe",
    },
  );
}

function pushImage() {
  console.log(`Pushing worker image ${imageUri}`);
  docker(["push", imageUri]);

  if (options.pushLatest) {
    console.log(`Updating optional convenience tag ${latestImageUri}`);
    docker(["tag", imageUri, latestImageUri]);
    docker(["push", latestImageUri]);
  }
}

function buildAndPushImageWithCloudBuild() {
  console.log(`Building and pushing worker image with Cloud Build ${imageUri}`);
  gcloud([
    "builds",
    "submit",
    "./worker",
    "--tag",
    imageUri,
    "--project",
    projectId,
    "--timeout",
    "1800s",
  ]);

  if (options.pushLatest) {
    console.log(`Updating optional convenience tag ${latestImageUri}`);
    gcloud([
      "artifacts",
      "docker",
      "tags",
      "add",
      imageUri,
      latestImageUri,
      "--project",
      projectId,
    ]);
  }
}

function getImageTag() {
  const configuredTag =
    process.env.GCP_WORKER_IMAGE_TAG?.trim() ||
    process.env.WORKER_IMAGE_TAG?.trim();

  if (configuredTag) {
    validateDockerTag(configuredTag);
    return configuredTag;
  }

  return `worker-gcp-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;
}

function validateDockerTag(tag) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag)) {
    throw new Error(`Invalid worker image tag: ${tag}`);
  }
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

function getGcloudCommand() {
  const configuredCommand =
    process.env.GCLOUD_BIN?.trim() || process.env.GCLOUD_PATH?.trim();

  if (configuredCommand) {
    return configuredCommand;
  }

  const localGcloud = resolve(".tools", "google-cloud-sdk", "bin", "gcloud.cmd");

  if (existsSync(localGcloud)) {
    return localGcloud;
  }

  return "gcloud";
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

function gcloudText(args) {
  return run(gcloudCommand, args, {
    env: commandEnv(),
    stdio: "pipe",
  }).stdout;
}

function gcloud(args, runOptions = {}) {
  return run(gcloudCommand, args, {
    ...runOptions,
    env: commandEnv(),
  });
}

function run(command, args, runOptions = {}) {
  const spawnOptions = {
    cwd: process.cwd(),
    encoding: "utf8",
    env: runOptions.env ?? commandEnv(),
    input: runOptions.input,
    stdio: runOptions.stdio ?? "inherit",
  };
  const isWindowsCommandScript =
    process.platform === "win32" && /\.cmd$/i.test(command);
  const result = isWindowsCommandScript
    ? spawnSync(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/c", command, ...args],
        spawnOptions,
      )
    : spawnSync(command, args, spawnOptions);

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
  return {
    ...process.env,
    CLOUDSDK_CORE_PROJECT: projectId,
  };
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
