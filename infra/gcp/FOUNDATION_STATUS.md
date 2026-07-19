# GCP Foundation Status

Last verified: 2026-07-19

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
- The video-render worker stack has been applied from
  `infra/gcp/video-render-worker`. It created Cloud Run Service
  `ugc-video-render-worker`, revision `ugc-video-render-worker-00001-4s6`,
  with `WORKER_QUEUE_PROVIDER=gcp`,
  `WORKER_JOB_TYPES=render_edit_video,render_schedule_combination`,
  `WORKER_PUBSUB_SUBSCRIPTION=ugc-video-render-sub`, and
  `STORAGE_PROVIDER=gcp`.
- `ugc-internal-scheduling-secret` now has enabled Secret Manager version `1`.
  The value is derived from `SUPABASE_SERVICE_ROLE_KEY`, matching the production
  app's existing finalization-secret fallback when
  `UGC_INTERNAL_SCHEDULING_SECRET` is not set in Vercel.
- Real GCP video-render smoke test passed:
  render `8e9fda30-2192-4234-810b-eee289617f22`, background job
  `5c55d0ff-83ad-4674-a851-704f67b1421e`, Pub/Sub message
  `20499814925163732`. The worker completed the render and the smoke script
  downloaded the GCS public MP4 URL successfully.
- The social-publish GCP worker slice was first implemented as disabled
  Terraform in `infra/gcp/social-publish-worker`. It keeps
  `social_reconciliation_enabled = false` for the first live phase so the
  worker cannot recover and publish older due jobs without an explicit Pub/Sub
  delivery.
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
- The always-on social-publish worker stack has been applied from
  `infra/gcp/social-publish-worker`. It created Cloud Run Service
  `ugc-social-publish-worker`, revision
  `ugc-social-publish-worker-00001-pvs`, with `WORKER_QUEUE_PROVIDER=gcp`,
  `WORKER_JOB_TYPES=publish_social_post`,
  `WORKER_PUBSUB_SUBSCRIPTION=ugc-social-publish-sub`,
  `STORAGE_PROVIDER=gcp`, and `SOCIAL_RECONCILIATION_ENABLED=false`.
- Required social-publish Secret Manager versions were verified as enabled:
  `supabase-url`, `supabase-service-role-key`,
  `oauth-token-encryption-key`, `tiktok-client-key`,
  `tiktok-client-secret`, `google-client-id`, and
  `google-client-secret`.
- The GCP social-publish cutover guard passed before and after enabling the
  worker: 0 open `publish_social_post` jobs, 0 Pub/Sub messages inspected, and
  0 unsafe messages.
- The always-on social-publish worker fake-target canary passed. Background job
  `3c63f479-6351-4a17-be82-636bc0424cb1` was published to Pub/Sub message
  `20487418590912439`, consumed by Cloud Run Service
  `ugc-social-publish-worker`, and failed with the expected safe error
  `Publish target was not found.`
- `terraform plan -detailed-exitcode` for
  `infra/gcp/social-publish-worker` returned no changes after apply.
- Vercel production `SOCIAL_SCHEDULER_PROVIDER` has been set to `gcp`.
- The GCP Cloud Tasks social dispatcher canary passed against production.
  Cloud Task
  `projects/ugcsaas/locations/us-central1/queues/ugc-social-publish-scheduler/tasks/ugc-social-gcp-1527883f-9958-436f-89d2-e14e735808a5`
  called `/api/internal/schedules/dispatch`, attached Pub/Sub message
  `20102510015581694` to background job
  `bef7648b-7539-4506-adff-5ae6231ab63b`, and the always-on GCP social worker
  failed the fake target safely with `Publish target was not found.`
- Added the guarded AWS social scheduler migration script:
  `npm run social-scheduler:aws-migration:dry-run`.
- Dry-run audit found 16 old AWS-backed Supabase social target rows, all in
  non-active states: 7 `published`, 5 `action_required`, and 4 `failed`.
  It found no active future AWS-backed target to migrate to Cloud Tasks.
- The AI-generation GCP worker stack has been applied from
  `infra/gcp/ai-generation-worker`. It created Cloud Run Service
  `ugc-ai-generation-worker`, revision `ugc-ai-generation-worker-00001-97p`,
  with `WORKER_QUEUE_PROVIDER=gcp`,
  `WORKER_PUBSUB_SUBSCRIPTION=ugc-ai-generation-sub`, queue
  `ai-generation`, and job types
  `generate_avatar,generate_image,generate_hook_video`.
- A no-spend AI-generation service canary has been added as
  `npm run ai-generation:gcp:service-dry-run` and
  `npm run ai-generation:gcp:service-canary`. It passed against the live Cloud
  Run Service. Background job `081aa700-90e9-4886-a543-f46bb2530b8f` was
  published to Pub/Sub message `20561160922574488`, consumed by
  `ugc-ai-generation-worker`, and failed with
  `generate_image requires input.prompt.` before OpenAI, Gemini, or Runway can
  be called.
- `terraform plan -detailed-exitcode` for
  `infra/gcp/ai-generation-worker` returned no changes after apply.

## Not Yet Cut Over

- No AWS resources were removed.
- Production Vercel/app environment must be confirmed before treating every
  app-created job as fully cut over to GCP queues. The GCP worker
  infrastructure is ready for the migrated profiles.
- AI generation has a live GCP worker and passed the no-spend Pub/Sub worker
  canary. Media processing still remains on the AWS/SQS path. Video render has
  a live GCP worker and passed the direct Pub/Sub smoke test.
- The always-on GCP social-publish worker is live and has passed a fake-target
  Pub/Sub canary. A real social-provider publish canary still has not been run;
  choose the account, platform, and visibility intentionally before testing
  real publishing.
- Scheduled social publish handoff is configured for GCP Cloud Tasks in Vercel
  production. Existing AWS EventBridge schedules are not removed yet because
  the current AWS app enqueue user lacks `scheduler:ListSchedules` on
  `arn:aws:scheduler:us-east-2:831963379461:schedule/*/*`.
- The GCP Carousel Scheduler job remains paused; production automatic
  replenishment has not been enabled.
- Existing S3 media has not been copied to GCS.
- CDN DNS/domain is not configured yet.
