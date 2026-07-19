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
const gcpImageScript = readProjectFile("scripts/build-push-gcp-worker-image.mjs");
const gcpCanaryScript = readProjectFile("scripts/run-gcp-test-worker-job.mjs");
const carouselDeploymentChecker = readProjectFile(
  "scripts/check-carousel-worker-deployment.mjs",
);
const gcpWorkerCanaryMain = readProjectFile(
  "infra/gcp/worker-canary/main.tf",
);
const gcpWorkerCanaryVariables = readProjectFile(
  "infra/gcp/worker-canary/variables.tf",
);
const gcpCarouselSchedulerMain = readProjectFile(
  "infra/gcp/carousel-scheduler/main.tf",
);
const gcpCarouselSchedulerVariables = readProjectFile(
  "infra/gcp/carousel-scheduler/variables.tf",
);
const gcpCarouselSchedulerTfvars = readProjectFile(
  "infra/gcp/carousel-scheduler/terraform.tfvars.example",
);
const gcpCarouselWorkerMain = readProjectFile(
  "infra/gcp/carousel-worker/main.tf",
);
const gcpCarouselWorkerVariables = readProjectFile(
  "infra/gcp/carousel-worker/variables.tf",
);
const gcpCarouselWorkerTfvars = readProjectFile(
  "infra/gcp/carousel-worker/terraform.tfvars.example",
);
const gcpVideoRenderWorkerMain = readProjectFile(
  "infra/gcp/video-render-worker/main.tf",
);
const gcpVideoRenderWorkerVariables = readProjectFile(
  "infra/gcp/video-render-worker/variables.tf",
);
const gcpVideoRenderWorkerTfvars = readProjectFile(
  "infra/gcp/video-render-worker/terraform.tfvars.example",
);
const gcpVideoRenderSmokeScript = readProjectFile(
  "scripts/test-video-render-gcp.mjs",
);
const gcpAiGenerationWorkerMain = readProjectFile(
  "infra/gcp/ai-generation-worker/main.tf",
);
const gcpAiGenerationWorkerVariables = readProjectFile(
  "infra/gcp/ai-generation-worker/variables.tf",
);
const gcpAiGenerationWorkerTfvars = readProjectFile(
  "infra/gcp/ai-generation-worker/terraform.tfvars.example",
);
const gcpAiGenerationWorkerServiceCanaryScript = readProjectFile(
  "scripts/test-ai-generation-worker-service-gcp.mjs",
);
const gcpSocialPublishWorkerMain = readProjectFile(
  "infra/gcp/social-publish-worker/main.tf",
);
const gcpSocialPublishWorkerVariables = readProjectFile(
  "infra/gcp/social-publish-worker/variables.tf",
);
const gcpSocialPublishWorkerTfvars = readProjectFile(
  "infra/gcp/social-publish-worker/terraform.tfvars.example",
);
const gcpSocialDispatchCanaryScript = readProjectFile(
  "scripts/test-social-dispatch-cloud-tasks-gcp.mjs",
);
const gcpSocialPublishWorkerCanaryScript = readProjectFile(
  "scripts/test-social-publish-worker-gcp.mjs",
);
const gcpSocialPublishWorkerServiceCanaryScript = readProjectFile(
  "scripts/test-social-publish-worker-service-gcp.mjs",
);
const productionGcpCutoverAuditScript = readProjectFile(
  "scripts/test-production-gcp-cutover-audit.mjs",
);
const productionGcpCutoverAuditRoute = readProjectFile(
  "app/api/internal/gcp-cutover/audit/route.ts",
);
const productionGcpStorageAuditScript = readProjectFile(
  "scripts/test-production-gcp-storage-audit.mjs",
);
const productionGcpStorageAuditRoute = readProjectFile(
  "app/api/internal/gcp-storage/audit/route.ts",
);
const gcpMediaCdnCutoverCheckScript = readProjectFile(
  "scripts/check-gcp-media-cdn-cutover.mjs",
);
const gcpSocialPublishCutoverCheckScript = readProjectFile(
  "scripts/check-social-publish-gcp-cutover.mjs",
);
const awsSocialSchedulerMigrationScript = readProjectFile(
  "scripts/migrate-aws-social-schedules-to-gcp.mjs",
);
const gcpSocialDispatchRoute = readProjectFile(
  "app/api/internal/schedules/dispatch/route.ts",
);
const carouselReplenishmentRunner = readProjectFile(
  "worker/src/lib/carousel-replenishment.ts",
);
const carouselReplenishmentEntrypoint = readProjectFile(
  "worker/src/scheduler/replenish-daily-carousels.ts",
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

test("the GCP image script targets Artifact Registry without deploying workers", () => {
  assert.match(gcpImageScript, /us-central1/);
  assert.match(gcpImageScript, /ugc-worker/);
  assert.match(gcpImageScript, /docker\(\[\s*"build"/);
  assert.match(gcpImageScript, /"\.\/worker"/);
  assert.match(gcpImageScript, /"--cloud-build"/);
  assert.match(gcpImageScript, /"builds",\s*"submit"/);
  assert.match(gcpImageScript, /"artifacts",\s*"repositories",\s*"describe"/);
  assert.match(gcpImageScript, /"auth",\s*"print-access-token"/);
  assert.doesNotMatch(gcpImageScript, /run",\s*"deploy"/);
});

test("the GCP canary uses a one-off Cloud Run Job and the test queue", () => {
  assert.match(gcpWorkerCanaryMain, /google_cloud_run_v2_job/);
  assert.match(gcpWorkerCanaryMain, /WORKER_QUEUE_PROVIDER/);
  assert.match(gcpWorkerCanaryMain, /WORKER_RUN_ONCE/);
  assert.match(gcpWorkerCanaryMain, /social_publish_worker_canary/);
  assert.match(gcpWorkerCanaryMain, /SOCIAL_RECONCILIATION_ENABLED/);
  assert.match(gcpWorkerCanaryVariables, /test_worker_job/);
  assert.match(gcpWorkerCanaryVariables, /ugc-media-processing-sub/);
  assert.match(gcpWorkerCanaryVariables, /publish_social_post/);
  assert.match(gcpWorkerCanaryVariables, /ugc-social-publish-sub/);
  assert.match(gcpWorkerCanaryVariables, /ugc-social-publish-worker-canary/);
  assert.match(gcpWorkerCanaryVariables, /social_publish_worker_poll_max_messages/);
  assert.match(gcpCanaryScript, /publishMessage/);
  assert.match(gcpCanaryScript, /"run",\s*"jobs",\s*"execute"/);
});

test("the GCP Carousel worker service consumes the Carousel Pub/Sub queue", () => {
  assert.match(gcpCarouselWorkerMain, /google_cloud_run_v2_service/);
  assert.match(gcpCarouselWorkerMain, /INGRESS_TRAFFIC_INTERNAL_ONLY/);
  assert.match(gcpCarouselWorkerMain, /cpu_idle\s*=\s*false/);
  assert.match(gcpCarouselWorkerMain, /min_instance_count/);
  assert.match(gcpCarouselWorkerMain, /max_instance_count/);
  assert.match(gcpCarouselWorkerMain, /WORKER_QUEUE_PROVIDER/);
  assert.match(gcpCarouselWorkerMain, /WORKER_PUBSUB_SUBSCRIPTION/);
  assert.match(gcpCarouselWorkerMain, /WORKER_JOB_TYPES/);
  assert.match(gcpCarouselWorkerMain, /STORAGE_PROVIDER/);
  assert.match(gcpCarouselWorkerMain, /GCP_STORAGE_PUBLIC_BASE_URL/);
  assert.match(gcpCarouselWorkerMain, /OPENAI_API_KEY/);
  assert.match(gcpCarouselWorkerVariables, /generate_carousel/);
  assert.match(gcpCarouselWorkerVariables, /ugc-carousel-sub/);
  assert.match(gcpCarouselWorkerVariables, /ugcsaas-media/);
  assert.match(gcpCarouselWorkerTfvars, /enable_carousel_worker = false/);
  assert.match(gcpCarouselWorkerTfvars, /worker_job_types\s*=\s*"generate_carousel"/);
});

test("the GCP video-render worker service consumes only video render jobs", () => {
  assert.match(gcpVideoRenderWorkerMain, /google_cloud_run_v2_service/);
  assert.match(gcpVideoRenderWorkerMain, /INGRESS_TRAFFIC_INTERNAL_ONLY/);
  assert.match(gcpVideoRenderWorkerMain, /cpu_idle\s*=\s*false/);
  assert.match(gcpVideoRenderWorkerMain, /WORKER_QUEUE_PROVIDER/);
  assert.match(gcpVideoRenderWorkerMain, /WORKER_PUBSUB_SUBSCRIPTION/);
  assert.match(gcpVideoRenderWorkerMain, /WORKER_JOB_TYPES/);
  assert.match(gcpVideoRenderWorkerMain, /STORAGE_PROVIDER/);
  assert.match(gcpVideoRenderWorkerMain, /GCP_STORAGE_PUBLIC_BASE_URL/);
  assert.match(gcpVideoRenderWorkerMain, /UGC_INTERNAL_APP_URL/);
  assert.match(gcpVideoRenderWorkerMain, /UGC_INTERNAL_SCHEDULING_SECRET/);
  assert.match(
    gcpVideoRenderWorkerVariables,
    /render_edit_video,render_schedule_combination/,
  );
  assert.match(gcpVideoRenderWorkerVariables, /ugc-video-render-sub/);
  assert.match(gcpVideoRenderWorkerVariables, /ugcsaas-media/);
  assert.match(gcpVideoRenderWorkerTfvars, /enable_video_render_worker = false/);
  assert.match(
    gcpVideoRenderWorkerTfvars,
    /worker_job_types\s*=\s*"render_edit_video,render_schedule_combination"/,
  );
});

test("the GCP video-render smoke test uses Pub/Sub and expects GCS output", () => {
  assert.match(gcpVideoRenderSmokeScript, /"render_edit_video"/);
  assert.match(gcpVideoRenderSmokeScript, /publishMessage/);
  assert.match(gcpVideoRenderSmokeScript, /"ugc-video-render"/);
  assert.match(gcpVideoRenderSmokeScript, /"video-render"/);
  assert.match(gcpVideoRenderSmokeScript, /video_render_jobs/);
  assert.match(gcpVideoRenderSmokeScript, /editable_videos/);
  assert.match(gcpVideoRenderSmokeScript, /GCP_STORAGE_PUBLIC_BASE_URL/);
  assert.match(gcpVideoRenderSmokeScript, /startsWith\(expectedStorageBaseUrl\)/);
});

test("the GCP AI-generation worker service consumes only AI generation jobs", () => {
  assert.match(gcpAiGenerationWorkerMain, /google_cloud_run_v2_service/);
  assert.match(gcpAiGenerationWorkerMain, /INGRESS_TRAFFIC_INTERNAL_ONLY/);
  assert.match(gcpAiGenerationWorkerMain, /cpu_idle\s*=\s*false/);
  assert.match(gcpAiGenerationWorkerMain, /WORKER_QUEUE_PROVIDER/);
  assert.match(gcpAiGenerationWorkerMain, /WORKER_PUBSUB_SUBSCRIPTION/);
  assert.match(gcpAiGenerationWorkerMain, /WORKER_JOB_TYPES/);
  assert.match(gcpAiGenerationWorkerMain, /STORAGE_PROVIDER/);
  assert.match(gcpAiGenerationWorkerMain, /GCP_STORAGE_PUBLIC_BASE_URL/);
  assert.match(gcpAiGenerationWorkerMain, /OPENAI_API_KEY/);
  assert.match(gcpAiGenerationWorkerMain, /OPENAI_IMAGE_MODEL/);
  assert.match(gcpAiGenerationWorkerMain, /GEMINI_API_KEY/);
  assert.match(gcpAiGenerationWorkerMain, /RUNWAYML_API_SECRET/);
  assert.match(
    gcpAiGenerationWorkerVariables,
    /generate_avatar,generate_image,generate_hook_video/,
  );
  assert.match(gcpAiGenerationWorkerVariables, /ugc-ai-generation-sub/);
  assert.match(gcpAiGenerationWorkerVariables, /ugcsaas-media/);
  assert.match(gcpAiGenerationWorkerTfvars, /enable_ai_generation_worker = false/);
  assert.match(
    gcpAiGenerationWorkerTfvars,
    /worker_job_types\s*=\s*"generate_avatar,generate_image,generate_hook_video"/,
  );
});

test("the GCP AI-generation service canary avoids paid provider calls", () => {
  assert.match(gcpAiGenerationWorkerServiceCanaryScript, /ugc-ai-generation-worker/);
  assert.match(gcpAiGenerationWorkerServiceCanaryScript, /publishMessage/);
  assert.match(gcpAiGenerationWorkerServiceCanaryScript, /generate_image/);
  assert.match(gcpAiGenerationWorkerServiceCanaryScript, /ugc-ai-generation/);
  assert.match(gcpAiGenerationWorkerServiceCanaryScript, /ai-generation/);
  assert.match(
    gcpAiGenerationWorkerServiceCanaryScript,
    /gcp-ai-generation-worker-service-invalid-input/,
  );
  assert.match(
    gcpAiGenerationWorkerServiceCanaryScript,
    /generate_image requires input\.prompt/,
  );
  assert.match(gcpAiGenerationWorkerServiceCanaryScript, /assertNoOpenRealAiGenerationJobs/);
  assert.doesNotMatch(gcpAiGenerationWorkerServiceCanaryScript, /jobs",\s*"execute"/);
  assert.doesNotMatch(gcpAiGenerationWorkerServiceCanaryScript, /OPENAI_API_KEY/);
  assert.doesNotMatch(gcpAiGenerationWorkerServiceCanaryScript, /GEMINI_API_KEY/);
  assert.doesNotMatch(gcpAiGenerationWorkerServiceCanaryScript, /RUNWAYML_API_SECRET/);
});

test("the production GCP cutover audit uses the deployed app before polling the worker", () => {
  assert.match(productionGcpCutoverAuditRoute, /getQueueProviderName/);
  assert.match(productionGcpCutoverAuditRoute, /getStorageProviderName/);
  assert.match(productionGcpCutoverAuditRoute, /getSocialSchedulerProviderName/);
  assert.match(productionGcpCutoverAuditRoute, /sendJobMessage/);
  assert.match(productionGcpCutoverAuditRoute, /generate_image/);
  assert.match(productionGcpCutoverAuditRoute, /message\.provider !== "gcp"/);
  assert.match(
    productionGcpCutoverAuditRoute,
    /production-gcp-cutover-invalid-ai-generation/,
  );
  assert.match(productionGcpCutoverAuditScript, /https:\/\/getugcpilot\.com/);
  assert.match(productionGcpCutoverAuditScript, /generate_image requires input\.prompt/);
  assert.match(productionGcpCutoverAuditScript, /assertNoOpenRealAiGenerationJobs/);
  assert.match(productionGcpCutoverAuditScript, /worker_id/);
  assert.doesNotMatch(productionGcpCutoverAuditScript, /OPENAI_API_KEY/);
  assert.doesNotMatch(productionGcpCutoverAuditScript, /GEMINI_API_KEY/);
  assert.doesNotMatch(productionGcpCutoverAuditScript, /RUNWAYML_API_SECRET/);
});

test("the production GCP storage audit exercises the signed upload path and cleans up", () => {
  assert.match(productionGcpStorageAuditRoute, /getStorageProviderName/);
  assert.match(productionGcpStorageAuditRoute, /storageProvider !== "gcp"/);
  assert.match(productionGcpStorageAuditRoute, /createMediaUploadTarget/);
  assert.match(productionGcpStorageAuditRoute, /createPresignedPutUrl/);
  assert.match(productionGcpStorageAuditRoute, /createUploadingMediaAsset/);
  assert.match(productionGcpStorageAuditRoute, /headS3Object/);
  assert.match(productionGcpStorageAuditRoute, /markMediaAssetReady/);
  assert.match(productionGcpStorageAuditRoute, /deleteS3Object/);
  assert.match(productionGcpStorageAuditRoute, /softDeleteMediaAsset/);
  assert.match(productionGcpStorageAuditRoute, /image\/png/);
  assert.match(productionGcpStorageAuditScript, /api\/internal\/gcp-storage\/audit/);
  assert.match(productionGcpStorageAuditScript, /https:\/\/getugcpilot\.com/);
  assert.match(
    productionGcpStorageAuditScript,
    /GCP_CUTOVER_AUDIT_SIGNATURE_HEADER/,
  );
  assert.match(productionGcpStorageAuditScript, /objectDeleted/);
  assert.match(productionGcpStorageAuditScript, /mediaAssetSoftDeleted/);
  assert.doesNotMatch(productionGcpStorageAuditScript, /OPENAI_API_KEY/);
  assert.doesNotMatch(productionGcpStorageAuditScript, /GEMINI_API_KEY/);
  assert.doesNotMatch(productionGcpStorageAuditScript, /RUNWAYML_API_SECRET/);
});

test("the GCP media CDN cutover checker validates DNS and HTTPS before env cutover", () => {
  assert.match(gcpMediaCdnCutoverCheckScript, /media\.getugcpilot\.com/);
  assert.match(gcpMediaCdnCutoverCheckScript, /8\.233\.40\.78/);
  assert.match(gcpMediaCdnCutoverCheckScript, /dns\.lookup/);
  assert.match(gcpMediaCdnCutoverCheckScript, /https:\/\/\$\{host\}/);
  assert.match(gcpMediaCdnCutoverCheckScript, /DNS is not cut over/);
  assert.match(gcpMediaCdnCutoverCheckScript, /GCP media CDN DNS and HTTPS check passed/);
  assert.doesNotMatch(gcpMediaCdnCutoverCheckScript, /GOOGLE_CLOUD_CREDENTIALS_JSON/);
});

test("the GCP social-publish worker service is queue-only for first canary", () => {
  assert.match(gcpSocialPublishWorkerMain, /google_cloud_run_v2_service/);
  assert.match(gcpSocialPublishWorkerMain, /INGRESS_TRAFFIC_INTERNAL_ONLY/);
  assert.match(gcpSocialPublishWorkerMain, /WORKER_QUEUE_PROVIDER/);
  assert.match(gcpSocialPublishWorkerMain, /WORKER_PUBSUB_SUBSCRIPTION/);
  assert.match(gcpSocialPublishWorkerMain, /WORKER_JOB_TYPES/);
  assert.match(gcpSocialPublishWorkerMain, /SOCIAL_RECONCILIATION_ENABLED/);
  assert.match(gcpSocialPublishWorkerMain, /OAUTH_TOKEN_ENCRYPTION_KEY/);
  assert.match(gcpSocialPublishWorkerMain, /TIKTOK_CLIENT_KEY/);
  assert.match(gcpSocialPublishWorkerMain, /GOOGLE_CLIENT_ID/);
  assert.match(gcpSocialPublishWorkerMain, /STORAGE_PROVIDER/);
  assert.match(gcpSocialPublishWorkerVariables, /ugc-social-publish-sub/);
  assert.match(gcpSocialPublishWorkerVariables, /publish_social_post/);
  assert.match(gcpSocialPublishWorkerVariables, /default\s*=\s*false/);
  assert.match(gcpSocialPublishWorkerTfvars, /enable_social_publish_worker = false/);
  assert.match(gcpSocialPublishWorkerTfvars, /worker_job_types\s*=\s*"publish_social_post"/);
  assert.match(
    gcpSocialPublishWorkerTfvars,
    /social_reconciliation_enabled\s*=\s*false/,
  );
});

test("the GCP social dispatch canary tests Cloud Tasks without real providers", () => {
  assert.match(gcpSocialDispatchCanaryScript, /--execute/);
  assert.match(gcpSocialDispatchCanaryScript, /--yes/);
  assert.match(gcpSocialDispatchCanaryScript, /randomUUID/);
  assert.match(gcpSocialDispatchCanaryScript, /buildGcpCloudTasksCreateTaskRequest/);
  assert.match(gcpSocialDispatchCanaryScript, /publish_social_post/);
  assert.match(gcpSocialDispatchCanaryScript, /gcp-cloud-tasks-social-dispatch/);
  assert.match(gcpSocialDispatchCanaryScript, /waitForDispatchOutcome/);
  assert.match(gcpSocialDispatchCanaryScript, /isExpectedSafeWorkerFailure/);
  assert.match(gcpSocialDispatchCanaryScript, /Publish target was not found/);
  assert.match(gcpSocialDispatchCanaryScript, /cancelQueuedCanaryJob/);
  assert.doesNotMatch(gcpSocialDispatchCanaryScript, /from\("scheduled_posts"\)/);
  assert.doesNotMatch(gcpSocialDispatchCanaryScript, /from\("scheduled_post_targets"\)/);
  assert.doesNotMatch(gcpSocialDispatchCanaryScript, /from\("social_connections"\)/);
});

test("the GCP social-publish worker canary consumes a fake target only", () => {
  assert.match(gcpSocialPublishWorkerCanaryScript, /--execute/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /--yes/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /randomUUID/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /publishMessage/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /SubscriberClient/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /drainTerminalCanaryMessages/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /publish_social_post/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /ugc-social-publish/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /ugc-social-publish-worker-canary/);
  assert.match(gcpSocialPublishWorkerCanaryScript, /Publish target was not found/);
  assert.doesNotMatch(gcpSocialPublishWorkerCanaryScript, /from\("scheduled_posts"\)/);
  assert.doesNotMatch(gcpSocialPublishWorkerCanaryScript, /from\("scheduled_post_targets"\)/);
  assert.doesNotMatch(gcpSocialPublishWorkerCanaryScript, /from\("social_connections"\)/);
});

test("the GCP social-publish cutover guard refuses open real work", () => {
  assert.match(gcpSocialPublishCutoverCheckScript, /ugc-social-publish-sub/);
  assert.match(gcpSocialPublishCutoverCheckScript, /publish_social_post/);
  assert.match(gcpSocialPublishCutoverCheckScript, /SubscriberClient/);
  assert.match(gcpSocialPublishCutoverCheckScript, /modifyAckDeadline/);
  assert.match(gcpSocialPublishCutoverCheckScript, /drainTerminalCanary/);
  assert.match(gcpSocialPublishCutoverCheckScript, /queued", "processing"/);
  assert.match(gcpSocialPublishCutoverCheckScript, /Cutover guard failed/);
  assert.doesNotMatch(gcpSocialPublishCutoverCheckScript, /from\("scheduled_posts"\)/);
  assert.doesNotMatch(gcpSocialPublishCutoverCheckScript, /from\("scheduled_post_targets"\)/);
  assert.doesNotMatch(gcpSocialPublishCutoverCheckScript, /from\("social_connections"\)/);
});

test("the AWS social scheduler migration creates GCP tasks before deleting EventBridge schedules", () => {
  assert.match(awsSocialSchedulerMigrationScript, /ListSchedulesCommand/);
  assert.match(awsSocialSchedulerMigrationScript, /DeleteScheduleCommand/);
  assert.match(
    awsSocialSchedulerMigrationScript,
    /buildGcpCloudTasksCreateTaskRequest/,
  );
  assert.match(awsSocialSchedulerMigrationScript, /from\("scheduled_post_targets"\)/);
  assert.match(awsSocialSchedulerMigrationScript, /scheduler_deleted_at/);
  assert.match(awsSocialSchedulerMigrationScript, /publish_job_id/);
  assert.match(awsSocialSchedulerMigrationScript, /--execute/);
  assert.match(awsSocialSchedulerMigrationScript, /--yes/);
  assert.match(awsSocialSchedulerMigrationScript, /deleteOrphans/);
  assert.match(awsSocialSchedulerMigrationScript, /minimumFutureSeconds/);
  assert.match(awsSocialSchedulerMigrationScript, /createCloudTaskForTarget/);
  assert.match(awsSocialSchedulerMigrationScript, /deleteAwsSchedule/);
  assert.match(awsSocialSchedulerMigrationScript, /updateTargetToGcpSchedule/);
});

test("the GCP social-publish service canary waits for the always-on worker", () => {
  assert.match(gcpSocialPublishWorkerServiceCanaryScript, /ugc-social-publish-worker/);
  assert.match(gcpSocialPublishWorkerServiceCanaryScript, /publishMessage/);
  assert.match(gcpSocialPublishWorkerServiceCanaryScript, /publish_social_post/);
  assert.match(
    gcpSocialPublishWorkerServiceCanaryScript,
    /gcp-social-publish-worker-service-fake-target/,
  );
  assert.match(gcpSocialPublishWorkerServiceCanaryScript, /Publish target was not found/);
  assert.doesNotMatch(gcpSocialPublishWorkerServiceCanaryScript, /jobs",\s*"execute"/);
  assert.doesNotMatch(gcpSocialPublishWorkerServiceCanaryScript, /from\("scheduled_posts"\)/);
  assert.doesNotMatch(gcpSocialPublishWorkerServiceCanaryScript, /from\("scheduled_post_targets"\)/);
  assert.doesNotMatch(gcpSocialPublishWorkerServiceCanaryScript, /from\("social_connections"\)/);
});

test("the GCP social dispatch route accepts canonical UUID identifiers", () => {
  assert.match(
    gcpSocialDispatchRoute,
    /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/,
  );
});

test("the GCP Carousel scheduler replaces cron with a paused Cloud Run Job trigger", () => {
  assert.match(gcpCarouselSchedulerMain, /google_cloud_run_v2_job/);
  assert.match(gcpCarouselSchedulerMain, /google_cloud_run_v2_job_iam_member/);
  assert.match(gcpCarouselSchedulerMain, /google_cloud_scheduler_job/);
  assert.match(gcpCarouselSchedulerMain, /roles\/run\.invoker/);
  assert.match(gcpCarouselSchedulerMain, /roles\/iam\.serviceAccountTokenCreator/);
  assert.match(gcpCarouselSchedulerMain, /app_base_url_secret_id/);
  assert.match(gcpCarouselSchedulerMain, /carousel_secret_id/);
  assert.match(gcpCarouselSchedulerTfvars, /app_base_url/);
  assert.match(gcpCarouselSchedulerTfvars, /ugc-internal-carousel-secret/);
  assert.match(
    gcpCarouselSchedulerMain,
    /dist\/scheduler\/replenish-daily-carousels\.js/,
  );
  assert.match(
    gcpCarouselSchedulerMain,
    /run\.googleapis\.com\/v2\/projects\/\$\{var\.project_id\}\/locations\/\$\{var\.region\}\/jobs\/\$\{var\.job_name\}:run/,
  );
  assert.match(gcpCarouselSchedulerVariables, /scheduler_paused/);
  assert.match(gcpCarouselSchedulerTfvars, /enable_replenishment_scheduler = false/);
  assert.match(gcpCarouselSchedulerTfvars, /scheduler_paused = true/);
  assert.match(carouselReplenishmentRunner, /while \(true\)/);
  assert.match(carouselReplenishmentRunner, /createCarouselReplenishmentSignature/);
  assert.match(
    carouselReplenishmentRunner,
    /x-ugc-carousel-replenishment-signature/,
  );
  assert.match(
    carouselReplenishmentEntrypoint,
    /runDailyCarouselReplenishmentSweep/,
  );
});

function readProjectFile(relativePath) {
  return readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    "utf8",
  );
}
