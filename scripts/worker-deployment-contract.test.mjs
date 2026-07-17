import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { hasWorkerJobHandler } from "../worker/dist/jobs/index.js";
import {
  implementedWorkerJobTypes,
  workerProfiles,
} from "./worker-deployment-profiles.mjs";

const dockerfile = readProjectFile("worker/Dockerfile");
const deployScript = readProjectFile("scripts/deploy-worker-service.mjs");
const carouselDeploymentChecker = readProjectFile(
  "scripts/check-carousel-worker-deployment.mjs",
);

test("every deployable worker job type has a compiled handler", () => {
  for (const [profileName, profile] of Object.entries(workerProfiles)) {
    for (const jobType of profile.jobTypes) {
      assert.equal(
        implementedWorkerJobTypes.has(jobType),
        true,
        `${profileName} is missing from the deployment handler registry`,
      );
      assert.equal(
        hasWorkerJobHandler(jobType),
        true,
        `${profileName} has no compiled worker handler for ${jobType}`,
      );
    }
  }
});

test("the ECS social-publish profile targets the current worker and queue", () => {
  assert.deepEqual(workerProfiles["social-publish"].jobTypes, [
    "publish_social_post",
  ]);
  assert.equal(workerProfiles["social-publish"].queueName, "social-publish");
  assert.equal(
    workerProfiles["social-publish"].defaultServiceName,
    "ugc-social-publish-worker-service",
  );
  assert.equal(
    workerProfiles["social-publish"].defaultTaskFamily,
    "ugc-social-publish-worker-task",
  );
  assert.equal(
    workerProfiles["social-publish"].defaultVisibilityTimeoutSeconds,
    "300",
  );
  assert.deepEqual(workerProfiles["social-publish"].secretKeys, [
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
  ]);
  assert.equal(
    workerProfiles["social-publish"].secretSources.GOOGLE_CLIENT_ID.required,
    true,
  );
  assert.equal(
    workerProfiles["social-publish"].secretSources.GOOGLE_CLIENT_SECRET.required,
    true,
  );
});

test("the ECS carousel profile stays live with an LLM-capable lease", () => {
  assert.deepEqual(workerProfiles.carousel.jobTypes, ["generate_carousel"]);
  assert.equal(workerProfiles.carousel.queueName, "carousel");
  assert.equal(workerProfiles.carousel.defaultDesiredCount, "1");
  assert.equal(workerProfiles.carousel.defaultVisibilityTimeoutSeconds, "900");
  assert.deepEqual(workerProfiles.carousel.secretKeys, ["OPENAI_API_KEY"]);
});

test("the carousel deployment checker verifies service capacity and its real log group", () => {
  assert.match(
    carouselDeploymentChecker,
    /workerContainer\.logConfiguration\?\.options\?\.\["awslogs-group"\]/,
  );
  assert.match(carouselDeploymentChecker, /ecs\.desiredCountIsPositive/);
  assert.match(carouselDeploymentChecker, /ecs\.runningCountMatchesDesired/);
  assert.match(carouselDeploymentChecker, /ecs\.pendingCount/);
  assert.match(carouselDeploymentChecker, /ecs\.primaryRolloutState/);
  assert.match(carouselDeploymentChecker, /ecs\.visibilityTimeoutSeconds/);
  assert.match(carouselDeploymentChecker, /ecs\.openAiSecretConfigured/);
  assert.match(carouselDeploymentChecker, /log\.carouselContentPlannerMode/);
  assert.match(carouselDeploymentChecker, /log\.carouselOpenAiConfigured/);
});

test("the task definition receives immutable worker identity and routing", () => {
  assert.match(
    deployScript,
    /WORKER_JOB_TYPES:\s*profile\.jobTypes\.join\(","\)/,
  );
  assert.match(deployScript, /WORKER_QUEUE_NAME:\s*profile\.queueName/);
  assert.match(deployScript, /WORKER_GIT_COMMIT:\s*workerGitCommit/);
  assert.match(deployScript, /WORKER_VERSION:\s*imageTag/);
  assert.match(deployScript, /image:\s*newImageUri/);
});

test("the production image runs the compiled current worker entrypoint", () => {
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /COPY --from=build \/app\/dist \.\/dist/);
  assert.match(dockerfile, /CMD \["node", "dist\/index\.js"\]/);
});

function readProjectFile(relativePath) {
  return readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    "utf8",
  );
}
