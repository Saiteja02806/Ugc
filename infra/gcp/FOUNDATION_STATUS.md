# GCP Foundation Status

Last verified: 2026-07-18

## Project

- Project ID: `ugcsaas`
- Project number: `58051192797`
- Primary region: `us-central1`
- Terraform state bucket: `ugcsaas-terraform-state`
- Foundation Terraform state prefix: `terraform/gcp-foundation`

## Applied Foundation Outputs

- Media bucket: `ugcsaas-media`
- Media CDN IP: `8.233.40.78`
- Artifact Registry repository: `us-central1-docker.pkg.dev/ugcsaas/ugc-worker`
- Cloud Tasks queue: `ugc-social-publish-scheduler`

Service accounts:

- App/API: `ugc-app-sa@ugcsaas.iam.gserviceaccount.com`
- Worker: `ugc-worker-sa@ugcsaas.iam.gserviceaccount.com`
- Scheduler: `ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com`
- Deploy: `ugc-deploy-sa@ugcsaas.iam.gserviceaccount.com`

Pub/Sub topics:

- `ugc-ai-generation`
- `ugc-carousel`
- `ugc-video-render`
- `ugc-media-processing`
- `ugc-social-publish`

Pub/Sub subscriptions:

- `ugc-ai-generation-sub`
- `ugc-carousel-sub`
- `ugc-video-render-sub`
- `ugc-media-processing-sub`
- `ugc-social-publish-sub`

Pub/Sub DLQ topics:

- `ugc-ai-generation-dlq`
- `ugc-carousel-dlq`
- `ugc-video-render-dlq`
- `ugc-media-processing-dlq`
- `ugc-social-publish-dlq`

## Verification

- `terraform plan -detailed-exitcode` returned no changes after apply.
- `gs://ugcsaas-media` exists in `US` multi-region.
- Public access prevention is `inherited`.
- Uniform bucket-level access is enabled.
- `allUsers` has `roles/storage.objectViewer` on `gs://ugcsaas-media` for
  generated testing-phase media URLs.
- CORS allows `GET`, `HEAD`, and `PUT` from production and local dev origins.
- App and worker service accounts have `roles/storage.objectAdmin` on the media bucket.
- Authenticated smoke test uploaded, described, and deleted
  `gs://ugcsaas-media/smoke/terraform-foundation-2026-07-18.txt`.
- Application code can now publish background jobs to Pub/Sub when
  `QUEUE_PROVIDER=gcp` is set, and the worker can pull Pub/Sub subscriptions
  when `WORKER_QUEUE_PROVIDER=gcp` is set.
- Vercel/non-GCP app runtimes need explicit service-account credentials for
  Pub/Sub publishing. The app supports `GOOGLE_CLOUD_CREDENTIALS_JSON` or the
  split `GOOGLE_CLOUD_CLIENT_EMAIL` / `GOOGLE_CLOUD_PRIVATE_KEY` pair for this.
- GCP worker image tooling now exists for Artifact Registry:
  `npm run worker:gcp:image:dry-run` and `npm run worker:gcp:image:push`.
- First GCP worker image was built with Cloud Build and pushed to Artifact
  Registry:
  `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718111431`
  with digest
  `sha256:3e80721c3396ee8bf97fd0f195064766ca8e599e5636c08f079bf8d729a48ee9`.
- A fresh GCP worker image with the Cloud Run Service health listener was built
  with Cloud Build and pushed to Artifact Registry:
  `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718142523`
  with digest
  `sha256:2c8a2bc1ba6b285864452a0cd7614cdfc6e9158e4cf1bd87dd085df36cfacc6d`.
- The GCP worker canary stack has been applied from
  `infra/gcp/worker-canary`. It created Cloud Run Job
  `ugc-worker-canary-test`, which runs `test_worker_job` from
  `ugc-media-processing-sub` with `WORKER_QUEUE_PROVIDER=gcp`.
- Initial canary executions with `WORKER_POLL_WAIT_SECONDS=0` exited before
  Pub/Sub returned a message. The canary config was updated to
  `WORKER_POLL_WAIT_SECONDS=10`, stale failed test messages were acknowledged,
  and final execution `ugc-worker-canary-test-bbd2b` passed. The verified
  Supabase background job was `24391910-4824-42a3-b432-2ff31f6bf775`, Pub/Sub
  message `20340083469053839`, with output worker `gcp-cloud-run-job`.
- The Carousel scheduler stack has been applied from
  `infra/gcp/carousel-scheduler`. It created Cloud Run Job
  `ugc-carousel-replenishment` and Cloud Scheduler job
  `ugc-carousel-replenishment-quarter-hour`. The scheduler is `PAUSED`.
- The production Vercel `UGC_INTERNAL_CAROUSEL_SECRET` was corrected to match
  local `.env.local` and GCP Secret Manager, then the existing production
  deployment was redeployed so the route picked up the value.
- Manual Cloud Run canary execution `ugc-carousel-replenishment-ckb6c`
  completed successfully. Logs reported one page, `processedCount: 3`, and
  `failedCount: 0`.
- The Carousel worker stack has been applied from `infra/gcp/carousel-worker`.
  It created Cloud Run Service `ugc-carousel-worker` with one always-on
  internal instance, `WORKER_QUEUE_PROVIDER=gcp`, `WORKER_JOB_TYPES=generate_carousel`,
  `WORKER_PUBSUB_SUBSCRIPTION=ugc-carousel-sub`, and `STORAGE_PROVIDER=gcp`.
- Real GCP Carousel generation smoke test passed:
  Carousel `433cf650-3a79-4f00-a6d4-b1107f38b785`, background job
  `ad451643-fdee-4e1f-93ce-ef925762584d`, Pub/Sub message
  `19919982775905874`. The worker completed 5 rendered slides and the smoke
  script downloaded the GCS public slide URLs successfully.
- The next slice has been implemented locally as Terraform and smoke-test code:
  `infra/gcp/video-render-worker` plus `npm run worker:test:video-render:gcp`.
  It is disabled by default and has not been applied yet.
- The social-publish GCP worker slice has been implemented locally as disabled
  Terraform in `infra/gcp/social-publish-worker`. It keeps
  `social_reconciliation_enabled = false` by default so an initial canary cannot
  recover and publish older due jobs without an explicit Pub/Sub delivery.
- A separate fake-target social-publish worker canary has been added to
  `infra/gcp/worker-canary` as Cloud Run Job
  `ugc-social-publish-worker-canary`, disabled by default. The matching script
  is `npm run social-publish:gcp:worker-canary`; it expects the worker to fail a
  fake target with `Publish target was not found.` so no provider publish call
  can happen.
- A fresh GCP worker image with the permanent missing-target retry fix was built
  with Cloud Build and pushed to Artifact Registry:
  `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718203317`
  with digest
  `sha256:df802f3e3218fd7f48b88016372f6dc4e15ad2b3bc1658ca72844d817d418c38`.
- The fake-target social-publish worker canary passed after draining 2 terminal
  canary Pub/Sub messages. Cloud Run execution
  `ugc-social-publish-worker-canary-x6qm5` consumed background job
  `a76048d0-2c66-4ddf-b829-96b75c8285bc`, Pub/Sub message
  `20639648512021525`, and failed it with `Publish target was not found.` before
  any provider publish call.
- The social schedule dispatcher slice has been implemented locally behind
  `SOCIAL_SCHEDULER_PROVIDER=gcp`. AWS EventBridge Scheduler remains the default.
  The GCP path creates Cloud Tasks entries in
  `ugc-social-publish-scheduler`, calls
  `/api/internal/schedules/dispatch` at the scheduled time, verifies the
  `ugc-scheduler-sa` OIDC token, and then enqueues the existing
  `publish_social_post` background job through the configured queue provider.
- A guarded social dispatch canary now exists as
  `npm run social-dispatch:gcp:dry-run` and
  `npm run social-dispatch:gcp:canary`. It tests only the Cloud Tasks to
  deployed dispatcher to Pub/Sub handoff using a fake target, then cancels the
  dummy background job.

## Not Yet Cut Over

- Production still defaults to AWS/SQS background queues.
- No AWS resources were removed.
- No production env was changed to `QUEUE_PROVIDER=gcp` or
  `WORKER_QUEUE_PROVIDER=gcp`.
- Normal app-created jobs still default to AWS/SQS until Vercel/app env is
  changed to `QUEUE_PROVIDER=gcp`.
- AI generation, media processing, video render, and the always-on social publish worker
  profiles still remain on the AWS/SQS path. The video-render GCP stack exists
  in code but must still be applied and smoke-tested before traffic is moved.
  The social-publish GCP stack exists in code but must still be applied as the
  always-on worker and then tested with an intentionally selected account/post
  before traffic is moved.
- Scheduled social publish handoff still defaults to AWS EventBridge Scheduler
  until production is changed to `SOCIAL_SCHEDULER_PROVIDER=gcp`.
- The GCP Carousel Scheduler job remains paused; production automatic
  replenishment has not been enabled.
- Existing S3 media has not been copied to GCS.
- CDN DNS/domain is not configured yet.
