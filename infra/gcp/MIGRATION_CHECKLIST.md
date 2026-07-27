# AWS to GCP Migration Checklist

Last checked: 2026-07-19

Use this checklist as the migration source of truth. Check an item only when it
is live and verified, not merely planned or coded.

## Git Release State

- [x] Local commit `9793993` created for the GCP video-render worker slice.
- [x] Local commit `264955d` created for the GCP AI-generation worker slice.
- [x] Local commit `caa9263` created for the media-processing retirement slice.
- [ ] Push local commits to remote Git. The local branch is ahead of
  `origin/main` by local migration commits, but direct `git push origin main` was blocked by
  the current environment policy.

## GCP Foundation

- [x] Terraform remote state bucket exists: `ugcsaas-terraform-state`.
- [x] GCP project configured: `ugcsaas` / `58051192797`.
- [x] Primary region selected: `us-central1`.
- [x] Worker Artifact Registry exists:
  `us-central1-docker.pkg.dev/ugcsaas/ugc-worker`.
- [x] Media bucket exists: `ugcsaas-media`.
- [x] GCP service accounts exist for app, worker, scheduler, and deploy.
- [x] Required Secret Manager versions exist for the migrated worker slices.
- [x] Cloud Logging/Monitoring receives Cloud Run worker logs.

## Queue Migration

- [x] GCP Pub/Sub topics exist for all active and canary logical queues:
  `ugc-ai-generation`, `ugc-carousel`, `ugc-video-render`,
  `ugc-media-processing`, and `ugc-social-publish`.
- [x] GCP Pub/Sub subscriptions exist for all active and canary logical queues:
  `ugc-ai-generation-sub`, `ugc-carousel-sub`, `ugc-video-render-sub`,
  `ugc-media-processing-sub`, and `ugc-social-publish-sub`.
- [x] Pub/Sub DLQs exist for all active and canary logical queues.
- [x] Application code can publish through GCP Pub/Sub when
  `QUEUE_PROVIDER=gcp` is set.
- [x] Worker code can consume Pub/Sub when `WORKER_QUEUE_PROVIDER=gcp` is set.
- [x] `ai-generation` queue is live on GCP and passed a no-spend worker canary.
- [x] `carousel` queue is live on GCP and passed a real Carousel generation
  smoke test.
- [x] `video-render` queue is live on GCP and passed a real MP4 render smoke
  test.
- [x] `social-publish` queue is live on GCP and passed a fake-target canary.
- [x] `media-processing` is retired as a production worker queue. The GCP
  topic/subscription remains for the generic `test_worker_job` infrastructure
  canary only. Handlerless legacy job names were removed from active app and
  worker routing.
- [ ] AWS SQS queues have not been removed.

## Worker Migration

- [x] Carousel worker migrated to Cloud Run Service:
  `ugc-carousel-worker`, subscription `ugc-carousel-sub`, job type
  `generate_carousel`.
- [x] AI-generation worker migrated to Cloud Run Service:
  `ugc-ai-generation-worker`, subscription `ugc-ai-generation-sub`, job types
  `generate_avatar`, `generate_image`, and `generate_hook_video`.
- [x] Video-render worker migrated to Cloud Run Service:
  `ugc-video-render-worker`, subscription `ugc-video-render-sub`, job types
  `render_edit_video` and `render_schedule_combination`.
- [x] Social-publish worker migrated to Cloud Run Service:
  `ugc-social-publish-worker`, subscription `ugc-social-publish-sub`, job type
  `publish_social_post`, with reconciliation disabled for the first live phase.
- [x] Media-processing production worker decision complete: no separate Cloud
  Run service is required for current production behavior.
- [ ] Real paid AI generation canary has not been run by choice, to avoid
  spending provider credits.
- [ ] Real social-provider publish canary has not been run. Pick the account,
  platform, and visibility intentionally before doing this.

## Scheduler Migration

- [x] Carousel Trigger.dev cron replacement exists as Cloud Scheduler plus
  Cloud Run Job:
  `ugc-carousel-replenishment-quarter-hour` ->
  `ugc-carousel-replenishment`.
- [x] Carousel replenishment Cloud Run Job passed manual execution.
- [ ] Carousel Cloud Scheduler job remains paused. Automatic production
  replenishment is not enabled yet.
- [x] Social publish scheduler replacement exists as Cloud Tasks queue:
  `ugc-social-publish-scheduler`.
- [x] Production Cloud Tasks dispatch canary passed against
  `/api/internal/schedules/dispatch`.
- [ ] Old AWS EventBridge social schedules have not been removed. Current audit
  found no active future AWS-backed targets, but AWS cleanup still remains.

## Storage And CDN

- [x] New generated media can be stored in GCS under `ugcsaas-media`.
- [x] GCP Carousel and video-render smoke tests produced GCS-backed media URLs.
- [x] Production app upload/signing path uses GCP Storage. The deployed app
  passed `npm run production:gcp-storage:audit` against
  `https://getugcpilot.com`, uploaded a 68-byte PNG to `ugcsaas-media`, read it
  through `storage.googleapis.com`, and cleaned up the temporary object/media
  row.
- [x] The GCP media CDN and HTTPS path were created and validated, then disabled
  on 2026-07-27 for testing-phase cost control.
- [x] Terraform `enable_media_cdn = false` removed exactly the eight optional
  Compute delivery resources while leaving `ugcsaas-media` and its IAM bindings
  unchanged.
- [ ] Remove the stale DNS record for `media.getugcpilot.com`; it still resolves
  to released former load-balancer IP `8.233.40.78`.
- [x] Read-only AWS media backfill audit script exists:
  `npm run storage:gcp-backfill:audit`.
- [x] The audit can scan the production Supabase project
  `kltxwijhluawgveykfbt`. Its initial baseline had 5,174 scanned rows and
  8,981 AWS-hosted media references.
- [x] Signed production Supabase media backfill audit route and runner are
  implemented locally: `POST /api/internal/gcp-media-backfill/audit` and
  `npm run production:gcp-media-backfill:audit`.
- [x] Deployed production media backfill audit ran against
  `https://getugcpilot.com` and confirmed Vercel production uses Supabase
  project `kltxwijhluawgveykfbt` with `STORAGE_PROVIDER=gcp`.
- [x] Guarded AWS-to-GCS media backfill tool exists:
  `npm run storage:gcp-backfill:dry-run` and
  `npm run storage:gcp-backfill:execute`.
- [x] Small `category_image_assets` backfill canary passed. It copied 5
  CloudFront objects to `ugcsaas-media`, updated 3 Supabase rows, and reduced
  production AWS media references from 8,981 to 8,976.
- [x] Canonical Carousel image migration is complete. Production
  `category_image_assets`, `carousel_slides`, `library_items`, and
  `library_carousel_slides` have zero AWS URLs. All 6,998 unique referenced
  keys exist in GCS and are non-zero.
- [x] All 4,730 AWS `category-library/` image keys exist in GCS. The 50
  AWS-only `carousels/rendered/` objects are unreferenced by canonical Carousel
  or Library rows and are intentionally excluded.
- [x] Global avatar/overlay replacement work, historical `background_jobs`,
  test/E2E rows, and unreferenced renders are explicitly outside the Carousel
  migration completion boundary.
- [x] Final CDN env cutover is intentionally deferred during testing. Current
  app and worker URLs use
  `https://storage.googleapis.com/ugcsaas-media`.
- [ ] AWS S3/CloudFront resources have not been removed.

## Completed Recent Slice

- [x] Production app cutover audit:
  verify Vercel is using `QUEUE_PROVIDER=gcp`, `STORAGE_PROVIDER=gcp`, and
  `SOCIAL_SCHEDULER_PROVIDER=gcp`; then confirm normal app-created jobs land on
  the GCP topics and are consumed by the live Cloud Run workers.
- [x] Production cutover audit route and runner have been implemented locally:
  `POST /api/internal/gcp-cutover/audit` and
  `npm run production:gcp-cutover:audit`.
- [x] Deployed production audit passed after Vercel propagation. The route
  confirmed all three providers resolved to `gcp`, enqueued invalid
  `generate_image` job `343104d6-8131-42cf-8f1a-8bfc1dc5dfd6` through the
  deployed app, attached Pub/Sub message `20104874044688178`, and the live GCP
  AI worker failed it safely with `generate_image requires input.prompt.`

## Current Next Slice

- [x] Stop indiscriminate AWS-to-GCS backfill: the important canonical Carousel
  image scope is complete. Do not migrate historical jobs, test data, avatars
  scheduled for replacement, or unreferenced renders solely to make a global
  AWS reference counter reach zero.
- [ ] Remove the stale `media.getugcpilot.com` DNS record. If a custom media
  domain is needed later, first set `enable_media_cdn = true`, apply Terraform,
  point DNS to the newly allocated output IP, wait for the managed certificate
  to become active, verify HTTPS, and only then update app/worker public media
  base URLs.
