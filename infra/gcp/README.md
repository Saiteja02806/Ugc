# UGC Pilot GCP infrastructure

GCP is the only supported runtime platform for queues, workers, scheduling,
and object storage. Supabase is the durable source of truth for background-job
state and audit events.

## Runtime architecture

1. An authenticated app route inserts a `background_jobs` row in Supabase.
2. The app creates one deterministic HTTP task in the workload's Cloud Tasks
   queue.
3. Cloud Tasks invokes `POST /tasks/jobs` on the appropriate private Cloud Run
   worker with the scheduler service account's OIDC token.
4. The worker atomically claims the Supabase job, persists stages and real
   progress, heartbeats the lease, writes output to GCS/Supabase, then marks the
   job terminal.
5. Cloud Scheduler invokes `/api/internal/jobs/recover` every five minutes to
   recover stale or undelivered jobs.

Cloud Tasks is the delivery transport. Supabase is authoritative; task state
must never be used as frontend state.

## Infrastructure layout

- `bootstrap/`: Terraform remote-state bucket.
- `foundation/`: APIs, service accounts, secrets, GCS/CDN, Cloud Tasks queues,
  and the optional recovery scheduler.
- `ai-generation-worker/`: request-based AI generation, Hook/Wall copy, media
  analysis, and analytics synchronization jobs. It scales from zero to its
  Terraform maximum only while Cloud Tasks has work to deliver.
- `carousel-worker/`: Carousel generation jobs.
- `video-render-worker/`: a request-based compatibility receiver plus the
  authoritative one-shot `ugc-video-render-job` for edit,
  schedule-combination, and wall-text renders. A Job starts for one render and
  exits when that render ends; it has no idle minimum instance.
- `social-publish-worker/`: social publish jobs.
- `carousel-scheduler/`: scheduled Carousel replenishment.

The retired Pub/Sub worker transport and canary stack are no longer defined.
Cloud Tasks is the only job-delivery system in the repository.
The Pub/Sub API remains enabled during and after cutover so legacy resources
can be inspected safely; enabling the API does not make Pub/Sub an active
runtime transport. Cloud Monitoring also remains enabled for production
observability.

## Cloud Tasks queues

The foundation creates:

- `ugc-ai-generation`
- `ugc-carousel`
- `ugc-media-processing`
- `ugc-social-publish`
- `ugc-video-render`
- `ugc-social-publish-scheduler` for future-dated social targets

Rate and concurrency limits live in `foundation/cloud-tasks.tf` and should be
kept below downstream provider quotas.

## Required app environment

```text
GCP_PROJECT_ID=ugcsaas
GCP_REGION=us-central1
GCP_CLOUD_TASKS_LOCATION=us-central1
GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com
GCP_AI_GENERATION_TASK_URL=<Cloud Run service URL>
GCP_CAROUSEL_TASK_URL=<Cloud Run service URL>
GCP_MEDIA_PROCESSING_TASK_URL=<Cloud Run service URL>
GCP_SOCIAL_PUBLISH_TASK_URL=<Cloud Run service URL>
# Must be the internal app launcher, not the legacy video worker service.
# It starts the one-shot ugc-video-render-job for each render.
GCP_VIDEO_RENDER_TASK_URL=https://www.getugcpilot.com/api/internal/jobs/launch-render
GCP_STORAGE_BUCKET=ugcsaas-media
GCP_STORAGE_PUBLIC_BASE_URL=https://storage.googleapis.com/ugcsaas-media
```

For an app hosted outside GCP, also configure the `ugc-app-sa` credential using
`GOOGLE_CLOUD_CREDENTIALS_JSON`, or the split client-email/private-key values.
Never commit credentials.

## Safe apply order

1. Apply the Supabase migrations in timestamp order.
2. Plan and apply `foundation/` to create Cloud Tasks queues.
3. Build and push the worker image with `npm run worker:gcp:image:push`. Record
   the exact source SHA used for that image.
4. Apply each enabled Cloud Run worker stack. Service workers use request-based
   billing and scale from their configured minimum only while a request is
   active. The video Job is different: it is a one-shot instance that exits
   after its render. The stacks set
   `WORKER_TRANSPORT=cloud-tasks` and grant the scheduler service account
   `roles/run.invoker`.
5. Configure the worker URLs in the app environment and deploy the app from
   the same source SHA as the worker image. Do not mark a background-job change
   released when only the web app or only a Cloud Run worker has been deployed.
6. Run a no-spend `test_worker_job` through `POST /api/jobs` and verify its
   Supabase status through `GET /api/jobs/{jobId}`. For a Wall canary, also
   confirm that the persisted `background_jobs.worker_id` contains the expected
   source SHA; this is the release-parity check between the app and the worker.
7. Set `enable_background_job_recovery_scheduler=true` in the foundation only
   after the deployed recovery route passes an authenticated manual check.
8. Verify authenticated production flows on `https://www.getugcpilot.com`.

Before applying the foundation after this migration, review the plan for the
expected removal of retired Pub/Sub resources and confirm there are no
in-flight legacy deliveries.

## Media cleanup audit

`npm run storage:gcp-backfill:audit` is intentionally read-only. It reports
historical non-GCP media URLs that still need a separately reviewed migration;
it cannot enqueue work, mutate rows, or select a runtime provider.
