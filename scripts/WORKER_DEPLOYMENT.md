# Worker Deployment

The shared deployer is additive. The legacy carousel and video-render deploy
scripts remain available until the shared path passes the migration checks
below.

## Shared commands

```bash
npm run worker:deploy:shared:carousel:dry-run
npm run worker:deploy:shared:ai-generation:dry-run
npm run worker:deploy:shared:video-render:dry-run
npm run worker:deploy:shared:carousel
npm run worker:deploy:shared:ai-generation
npm run worker:deploy:shared:video-render
npm run worker:deploy:shared:all
```

The deployer builds one worker image, pushes a unique ECR tag, registers a new
task-definition revision, updates the selected ECS service, enables the ECS
deployment circuit breaker with rollback, and waits for service stability.

`--dry-run` performs AWS read operations only. It does not build or push an
image, register a task definition, or update a service.

The existing ECS service is always used as its own task-definition template.
Its CPU, memory, roles, runtime, volumes, and service networking are preserved.
Creating a missing service requires both `--create` and an explicit template
task-definition environment variable.

## Legacy removal checkpoint

Do not remove `deploy-carousel-worker.mjs` or
`deploy-video-render-worker.mjs` until all of these checks pass:

1. Shared dry runs resolve the correct service, queue, and job types for both
   workers.
2. The shared deployer updates the carousel service successfully.
3. A real carousel generation job completes after that deployment.
4. The shared deployer updates the video-render service successfully.
5. A real edited-video render completes and its CloudFront output opens.
6. Both services remain stable through the agreed rollback observation window.
7. The previous task-definition ARNs are recorded and rollback has been tested
   or operationally verified.

After these checks, change the canonical package commands to the shared script,
keep the old commands under a `:legacy` name for one release, and then remove
the legacy scripts in a later cleanup commit.

## Validation record

Validated on 2026-07-01:

- Carousel and video-render shared dry runs resolved the correct live services.
- Carousel deployed through the shared script from task revision 2 to 3.
- Carousel canary job `6a50d473-4f51-4839-8056-e8ee06870594` completed with
  five CloudFront-backed slides.
- Video render deployed through the shared script from task revision 9 to 10.
- Video-render canary job `ecc506b4-eb6e-416e-990c-40f78e4ba655` completed and
  produced a CloudFront-backed MP4.
- Both ECS services are active at desired/running count 1/1.
- Deployment circuit-breaker rollback is enabled on both services.

AI image generation validated on 2026-07-01:

- The `generate_image` handler was added to the AWS worker.
- An isolated run-once Fargate task verified worker secret injection and AI
  queue permissions before service creation.
- `ugc-ai-generation-worker-service` was created on task revision 2 and
  reached desired/running count 1/1.
- API job `68058620-87e2-4da4-95f4-b3a98c8a1ac9` completed through
  `background_jobs`, SQS, ECS, OpenAI, S3, and CloudFront.
- The generated CloudFront PNG returned HTTP 200.
- The obsolete `generate-image-test` async task was removed after the AWS canary
  passed.

Avatar image generation validated on 2026-07-01:

- The `generate_avatar` handler and avatar prompt builder were added to the AWS
  worker.
- The existing AI-generation service was expanded to accept both
  `generate_image` and `generate_avatar` jobs on task revision 3.
- API job `92b3408e-7210-4ed5-bf15-e56a10ca3a56` completed through
  `background_jobs`, SQS, ECS, OpenAI, S3, and CloudFront.
- The generated avatar CloudFront PNG returned HTTP 200.
- The obsolete avatar Trigger task and its unused app-side image helpers were
  removed.

Hook-video AWS migration prepared on 2026-07-02:

- The `generate_hook_video` handler was added to the AWS worker with Veo and
  Runway provider support.
- The hook-video API route now creates a `background_jobs` row and enqueues to
  the AI-generation SQS queue.
- The hook-video status route and UI now poll by AWS `jobId`.
- Supabase `background_jobs.job_type` now allows `generate_hook_video`.
- `ugc-ai-generation-worker-service` was deployed to task revision 5 with
  `generate_avatar`, `generate_image`, and `generate_hook_video` allowed.
- The AI worker task definition injects `GEMINI_API_KEY` and
  `RUNWAYML_API_SECRET`; no video canary has been run yet by design.
- `WORKER_VISIBILITY_TIMEOUT_SECONDS` is set to 1800 for the AI worker.
- The legacy hook-video rollback task has since been removed. Use the durable
  `background_jobs` plus worker path for hook-video validation.

Still required before legacy deletion:

- Complete the agreed observation window with no worker deployment regression.
- Operationally verify rollback to the recorded previous task revisions, or
  retain those revisions through the observation window as the documented
  rollback path.

## GCP video-render worker slice

The GCP replacement for the AWS `video-render` ECS profile is implemented as a
Cloud Run Service in `infra/gcp/video-render-worker`.

It maps:

- AWS SQS queue: `UGC_VIDEO_RENDER_QUEUE_URL`
- GCP Pub/Sub topic: `ugc-video-render`
- GCP Pub/Sub subscription: `ugc-video-render-sub`
- Worker queue name: `video-render`
- Worker job types: `render_edit_video,render_schedule_combination`

Safe update order:

```powershell
npm run worker:gcp:image:push -- --cloud-build
cd infra\gcp\video-render-worker
```

Set `worker_image_uri` to the pushed Artifact Registry image. Keep
`enable_video_render_worker = true` only after Secret Manager has enabled
versions for `supabase-url`, `supabase-service-role-key`, and
`ugc-internal-scheduling-secret`.

```powershell
terraform init
terraform plan
terraform apply
cd ..\..\..
npm run worker:test:video-render:gcp
```

The smoke test creates one `render_edit_video` job, publishes it to Pub/Sub,
waits for Cloud Run to process it, verifies `background_jobs`,
`video_render_jobs`, and `editable_videos`, then downloads the GCS-backed MP4.

Verified GCP smoke test:

- Cloud Run Service: `ugc-video-render-worker`
- revision: `ugc-video-render-worker-00001-4s6`
- background job: `5c55d0ff-83ad-4674-a851-704f67b1421e`
- Pub/Sub message: `20499814925163732`
- render: `8e9fda30-2192-4234-810b-eee289617f22`

## GCP AI-generation worker slice

The GCP replacement for the AWS `ai-generation` ECS profile is implemented as
Cloud Run Service infrastructure in `infra/gcp/ai-generation-worker`.

It maps:

- AWS SQS queue: `UGC_AI_GENERATION_QUEUE_URL`
- GCP Pub/Sub topic: `ugc-ai-generation`
- GCP Pub/Sub subscription: `ugc-ai-generation-sub`
- Worker queue name: `ai-generation`
- Worker job types: `generate_avatar,generate_image,generate_hook_video`

Safe apply order:

```powershell
npm run worker:gcp:image:push -- --cloud-build
cd infra\gcp\ai-generation-worker
copy terraform.tfvars.example terraform.tfvars
```

Set `worker_image_uri` to the pushed Artifact Registry image. Keep
`enable_ai_generation_worker = false` for the first plan.

Required Secret Manager versions before enabling:

- `supabase-url`
- `supabase-service-role-key`
- `openai-api-key`
- `gemini-api-key`
- `runwayml-api-secret`

Before any real image/avatar/hook-video generation test, run the no-spend
service canary:

```powershell
npm run ai-generation:gcp:service-dry-run
npm run ai-generation:gcp:service-canary
```

The canary creates one invalid `generate_image` background job and expects the
GCP worker to fail it with `generate_image requires input.prompt.` This proves
the Cloud Run Service consumed the `ugc-ai-generation` Pub/Sub message before
OpenAI, Gemini, or Runway can be called.

Verified GCP no-spend canary:

- Cloud Run Service: `ugc-ai-generation-worker`
- revision: `ugc-ai-generation-worker-00001-97p`
- background job: `081aa700-90e9-4886-a543-f46bb2530b8f`
- Pub/Sub message: `20561160922574488`
- expected failure: `generate_image requires input.prompt.`

## GCP social-publish worker slice

The GCP replacement for the AWS `social-publish` ECS profile is implemented as
disabled-by-default Cloud Run Service infrastructure in
`infra/gcp/social-publish-worker`.

It maps:

- AWS SQS queue: `UGC_SOCIAL_PUBLISH_QUEUE_URL`
- GCP Pub/Sub topic: `ugc-social-publish`
- GCP Pub/Sub subscription: `ugc-social-publish-sub`
- Worker queue name: `social-publish`
- Worker job type: `publish_social_post`

Safe apply order:

```powershell
npm run worker:gcp:image:push -- --cloud-build
cd infra\gcp\social-publish-worker
copy terraform.tfvars.example terraform.tfvars
```

Set `worker_image_uri` to the pushed Artifact Registry image. Keep
`enable_social_publish_worker = false` for the first plan.

For the first enabled canary, keep:

```hcl
social_reconciliation_enabled = false
```

This prevents the GCP worker from recovering old due social publish jobs from
the database. It will only process explicit Pub/Sub deliveries.

Required Secret Manager versions before enabling:

- `supabase-url`
- `supabase-service-role-key`
- `oauth-token-encryption-key`
- `tiktok-client-key`
- `tiktok-client-secret`
- `google-client-id`
- `google-client-secret`

Do not run a real publish canary until the target account/post is intentionally
selected and approved.
