# GCP Migration Infrastructure

This folder starts the AWS to GCP migration safely for project `ugcsaas`
(`58051192797`). It creates infrastructure only. It does not copy secrets and it
does not change application traffic by itself.

## Layout

- `bootstrap/`: creates the GCS bucket used for Terraform remote state.
- `foundation/`: creates the first GCP foundation resources for the app.
- `worker-canary/`: creates an optional one-off Cloud Run Job for a Pub/Sub
  worker canary.
- `carousel-worker/`: creates an always-on Cloud Run Service that consumes
  `generate_carousel` jobs from `ugc-carousel-sub`.
- `video-render-worker/`: creates an always-on Cloud Run Service that consumes
  `render_edit_video` and `render_schedule_combination` jobs from
  `ugc-video-render-sub`.
- `social-publish-worker/`: creates an always-on Cloud Run Service that
  consumes `publish_social_post` jobs from `ugc-social-publish-sub`.
- `carousel-scheduler/`: creates an optional Cloud Run Job plus Cloud Scheduler
  trigger that replaces the removed Trigger.dev Carousel cron.

## What The Foundation Creates

- Required Google Cloud APIs
- Service accounts replacing AWS IAM roles
- Secret Manager secret containers, without secret values
- Artifact Registry repository for worker Docker images
- Cloud Storage media bucket
- Cloud CDN load balancer pieces for media delivery
- Pub/Sub job topics, subscriptions, and DLQs
- Cloud Tasks queue for scheduled social publish dispatch
- Optional Pub/Sub DLQ alert policies

## Safe Apply Order

Run these from `C:\Users\chund\OneDrive\Desktop\UGC`.

If you installed the local Terraform and Google Cloud CLI toolchain for this
repo, open a configured PowerShell session first:

```powershell
powershell -ExecutionPolicy Bypass -NoProfile -NoExit -File .\infra\gcp\use-local-tools.ps1
```

The `-ExecutionPolicy Bypass` flag is needed on Windows machines that block
local `.ps1` scripts by default.

```powershell
cd infra\gcp\bootstrap
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Then initialize the main foundation:

```powershell
cd ..\foundation
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

If you change the bootstrap state bucket name, update `foundation/backend.tf`
before running `terraform init`.

## Secret Values

Terraform creates only empty Secret Manager containers. Add values after apply
using the Google Cloud console, CI/CD, or `gcloud secrets versions add`.

Do not commit `.env.local`, `terraform.tfvars`, state files, or downloaded
Terraform provider directories.

## Application Storage Slice

The app now supports a dark-launched GCP object storage path behind the existing
`lib/storage/s3.ts` compatibility exports. AWS remains the default unless
`STORAGE_PROVIDER=gcp` or `UGC_STORAGE_PROVIDER=gcp` is set.

Testing-phase cutover can happen after:

- the `foundation/` Terraform has been applied;
- the media bucket exists and the app/worker service accounts can write to it;
- `GCP_STORAGE_BUCKET` and `GCP_STORAGE_PUBLIC_BASE_URL` are configured;
- Cloud CDN/DNS/public read access is verified for generated media URLs;
- existing S3 media has either been copied to GCS or the team accepts that only
  new generated media will be on GCS during testing.

Do not remove the AWS S3/CloudFront env vars until all stored database media
URLs and scheduled/pending worker jobs no longer depend on AWS-hosted objects.

Current checkpoint: `gs://ugcsaas-media` allows public object reads for
testing-phase generated media, and GCP Carousel output uses
`https://storage.googleapis.com/ugcsaas-media`.

## Application Queue Slice

The app now supports a dark-launched GCP queue path behind the existing
`lib/aws/sqs.ts` compatibility exports. AWS/SQS remains the default unless
`QUEUE_PROVIDER=gcp` or `UGC_QUEUE_PROVIDER=gcp` is set.

When the app runs on Vercel, also set a Vercel-safe GCP credential for the app
publisher. Use either `GOOGLE_CLOUD_CREDENTIALS_JSON` with the `ugc-app-sa`
service-account JSON, or the split `GOOGLE_CLOUD_CLIENT_EMAIL` /
`GOOGLE_CLOUD_PRIVATE_KEY` pair. Do not use `GOOGLE_APPLICATION_CREDENTIALS` on
Vercel unless it points to an actual file.

The worker now supports `WORKER_QUEUE_PROVIDER=aws` for the existing SQS loop
and `WORKER_QUEUE_PROVIDER=gcp` for Pub/Sub pull subscriptions. Pub/Sub uses the
same durable background job message body as AWS:

```json
{ "jobId": "<background_jobs.id>", "jobType": "generate_carousel" }
```

The GCP defaults match the Terraform topic and subscription names:

- app publisher topics: `ugc-ai-generation`, `ugc-carousel`,
  `ugc-video-render`, `ugc-media-processing`, `ugc-social-publish`
- worker subscriptions: `ugc-ai-generation-sub`, `ugc-carousel-sub`,
  `ugc-video-render-sub`, `ugc-media-processing-sub`,
  `ugc-social-publish-sub`

Safe dark test order:

1. Keep production `QUEUE_PROVIDER=aws`.
2. Dry-run the image plan:

   ```powershell
   npm run worker:gcp:image:dry-run
   ```

3. Push a worker image to Artifact Registry:

   ```powershell
   npm run worker:gcp:image:push
   ```

   If Docker Desktop is not running locally but Cloud Build is enabled, build
   remotely instead:

   ```powershell
   npm run worker:gcp:image:push -- --cloud-build
   ```

   The image URI shape is:

   ```text
   us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:<tag>
   ```

4. Add Secret Manager values for at least `supabase-url` and
   `supabase-service-role-key`.
5. Enable and apply the one-off Cloud Run Job canary in
   `infra/gcp/worker-canary`. This canary uses `WORKER_QUEUE_PROVIDER=gcp`,
   `WORKER_RUN_ONCE=true`, `WORKER_JOB_TYPES=test_worker_job`, and
   `WORKER_PUBSUB_SUBSCRIPTION=ugc-media-processing-sub`. Keep
   `WORKER_POLL_WAIT_SECONDS` non-zero, currently `10`, so the one-shot Cloud
   Run Job does not exit before Pub/Sub returns the message.
6. Run the canary smoke test:

   ```powershell
   npm run worker:gcp:canary:test
   ```

   The script creates one durable `test_worker_job`, publishes one Pub/Sub
   message, executes the Cloud Run Job, and verifies Supabase completion.

Current checkpoint: Cloud Run Job `ugc-worker-canary-test` has been applied.
The final canary execution `ugc-worker-canary-test-bbd2b` passed after the
worker canary pull wait was changed from `0` to `10` seconds. Verified
background job `24391910-4824-42a3-b432-2ff31f6bf775` completed with output
worker `gcp-cloud-run-job`.

## Carousel Worker Slice

The production-shaped GCP Carousel worker is a Cloud Run Service, not a
one-off Job, because it must keep consuming Pub/Sub messages after the app queue
provider is flipped. The worker image exposes `/healthz` for Cloud Run startup
checks, while the same process runs the background Pub/Sub loop.

The Terraform stack lives in `infra/gcp/carousel-worker` and configures:

- Cloud Run Service: `ugc-carousel-worker`
- min/max instances: `1/1`
- ingress: internal only
- CPU always allocated: `cpu_idle = false`
- subscription: `ugc-carousel-sub`
- queue/job profile: `carousel` / `generate_carousel`
- output storage: `STORAGE_PROVIDER=gcp`
- public media base URL: `https://storage.googleapis.com/ugcsaas-media`

Current checkpoint: image
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718142523`
has been pushed, Terraform has applied `ugc-carousel-worker`, and
`terraform plan -detailed-exitcode` for `infra/gcp/carousel-worker` reports no
changes. The real GCP Carousel smoke test passed with Carousel
`433cf650-3a79-4f00-a6d4-b1107f38b785`, background job
`ad451643-fdee-4e1f-93ce-ef925762584d`, and Pub/Sub message
`19919982775905874`; it rendered 5 GCS-backed slides and downloaded them
successfully.

Do not remove SQS queues or EventBridge scheduling until every worker profile
and scheduled social publish path has completed this queue cutover.

## Video Render Worker Slice

The next production-shaped GCP worker target is video rendering. This maps the
old AWS `video-render` worker profile to a Cloud Run Service that consumes the
existing Pub/Sub subscription `ugc-video-render-sub`.

The Terraform stack lives in `infra/gcp/video-render-worker` and configures:

- Cloud Run Service: `ugc-video-render-worker`
- min/max instances: `1/1`
- ingress: internal only
- CPU always allocated: `cpu_idle = false`
- subscription: `ugc-video-render-sub`
- queue/job profile: `video-render` /
  `render_edit_video,render_schedule_combination`
- output storage: `STORAGE_PROVIDER=gcp`
- public media base URL: `https://storage.googleapis.com/ugcsaas-media`
- schedule finalization callback URL: `https://getugcpilot.com`

The stack is disabled by default:

```powershell
cd infra\gcp\video-render-worker
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

Enable it only after:

- the same worker image used for Carousel has been pushed to Artifact Registry;
- Secret Manager has enabled versions for `supabase-url`,
  `supabase-service-role-key`, and `ugc-internal-scheduling-secret`;
- the production app has the matching `UGC_INTERNAL_SCHEDULING_SECRET`;
- GCS public reads are verified for rendered MP4s.

After applying with `enable_video_render_worker = true`, run:

```powershell
npm run worker:test:video-render:gcp
```

The smoke test creates one `render_edit_video` background job, publishes it to
`ugc-video-render`, waits for the Cloud Run worker to complete it, verifies the
database rows, and downloads the GCS-backed MP4.

## Social Publish Worker Slice

The GCP replacement for the AWS `social-publish` worker profile is implemented
as disabled-by-default infrastructure in `infra/gcp/social-publish-worker`.

The Terraform stack configures:

- Cloud Run Service: `ugc-social-publish-worker`
- min/max instances: `1/1`
- ingress: internal only
- CPU always allocated: `cpu_idle = false`
- subscription: `ugc-social-publish-sub`
- queue/job profile: `social-publish` / `publish_social_post`
- output/helper storage: `STORAGE_PROVIDER=gcp`
- token encryption secret: `oauth-token-encryption-key`
- provider secrets: TikTok client key/secret and Google client ID/secret

The stack is disabled by default:

```powershell
cd infra\gcp\social-publish-worker
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

Keep `enable_social_publish_worker = false` until social publishing is ready
for an intentional canary. For the first enabled canary, keep:

```hcl
social_reconciliation_enabled = false
```

That prevents the GCP worker from recovering older due social publish jobs from
the database without an explicit Pub/Sub delivery. This is important because a
recovered social publish job can publish to a real connected account.

Before enabling the worker, confirm Secret Manager has enabled versions for:

- `supabase-url`
- `supabase-service-role-key`
- `oauth-token-encryption-key`
- `tiktok-client-key`
- `tiktok-client-secret`
- `google-client-id`
- `google-client-secret`

Do not run a real social publish canary until the target account, platform, and
post visibility are intentionally chosen. TikTok photo carousel publishing also
requires a verified pull URL host; `storage.googleapis.com` is not a final
production media domain.

## Social Schedule Dispatcher Slice

The app now has a GCP replacement path for AWS EventBridge Scheduler, behind
`SOCIAL_SCHEDULER_PROVIDER=gcp`. AWS remains the default until that variable is
changed.

When `SOCIAL_SCHEDULER_PROVIDER=gcp`, the app creates one Cloud Tasks HTTP task
per scheduled social target in the existing Terraform queue:

```text
ugc-social-publish-scheduler
```

At the scheduled time, Cloud Tasks calls:

```text
POST /api/internal/schedules/dispatch
```

That internal route verifies the Google OIDC token minted for:

```text
ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com
```

After verification, the route only enqueues the existing
`publish_social_post` background job through the current queue provider. It does
not generate media and does not directly publish to social platforms.

Required production app env before switching this provider:

- `SOCIAL_SCHEDULER_PROVIDER=gcp`
- `QUEUE_PROVIDER=gcp`
- `GCP_PROJECT_ID=ugcsaas`
- `GOOGLE_CLOUD_CREDENTIALS_JSON` for `ugc-app-sa`
- `APP_BASE_URL` or `UGC_INTERNAL_APP_URL`
- `GCP_CLOUD_TASKS_LOCATION=us-central1`
- `GCP_SOCIAL_PUBLISH_TASKS_QUEUE=ugc-social-publish-scheduler`
- `GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com`

Before enabling this for normal scheduling, apply and test the GCP
social-publish worker with an intentional canary account/post. Otherwise Cloud
Tasks can correctly enqueue jobs that no GCP social worker is ready to consume.

To test only the Cloud Tasks dispatcher handoff without a real social account or
real publish, use the guarded canary:

```powershell
npm run social-dispatch:gcp:dry-run
```

When the dry-run plan looks correct, intentionally execute it:

```powershell
npm run social-dispatch:gcp:canary
```

The canary creates one fake `publish_social_post` background job, creates one
Cloud Task against the deployed `/api/internal/schedules/dispatch` route,
verifies that the route attached a Pub/Sub message id, then cancels the dummy
job. It does not create scheduled post rows, does not use a connected social
account, and does not publish. If it reports that the dummy job was consumed by
a worker, stop and inspect the GCP social worker before enabling normal social
scheduling.

## Carousel Scheduler Slice

Trigger.dev has been removed. The replacement is a Cloud Scheduler job that
starts a Cloud Run Job. The Cloud Run Job runs:

```text
node dist/scheduler/replenish-daily-carousels.js
```

The runner signs calls to the existing internal route:

```text
POST /api/internal/carousels/replenish
```

using `UGC_INTERNAL_CAROUSEL_SECRET`, then keeps requesting pages until the
database sweep state reports the cycle is complete.

The Terraform stack is disabled by default:

```powershell
cd infra\gcp\carousel-scheduler
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

Enable it only after:

- a worker image has been pushed to Artifact Registry;
- Secret Manager has enabled versions for `app_base_url` and
  `ugc-internal-carousel-secret`;
- the production app has the same `UGC_INTERNAL_CAROUSEL_SECRET`;
- a production canary of the internal replenishment route succeeds.

Keep `scheduler_paused = true` for the first apply. Unpause only after manually
executing the Cloud Run Job and checking Cloud Run logs plus Supabase sweep
state.

Current checkpoint: image
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718111431`
has been pushed, Terraform has applied Cloud Run Job
`ugc-carousel-replenishment`, and Cloud Scheduler job
`ugc-carousel-replenishment-quarter-hour` is still paused. Manual execution
`ugc-carousel-replenishment-ckb6c` completed successfully after the production
Vercel `UGC_INTERNAL_CAROUSEL_SECRET` was corrected; it processed one page with
3 profiles and 0 failures.

## Cache Decision

This app needs Cloud CDN as the CloudFront replacement. It does not need Redis,
Upstash, or Memorystore for the first migration because Supabase already stores
job state, locks, retries, and scheduling metadata.
