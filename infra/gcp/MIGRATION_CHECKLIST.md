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
- [x] GCP media CDN HTTPS resources exist for `media.getugcpilot.com` on the
  reserved global IP `8.233.40.78`: managed certificate
  `ugc-prod-media-cdn-cert`, HTTPS proxy `ugc-prod-media-cdn-https-proxy`, and
  forwarding rule `ugc-prod-media-cdn-https`.
- [x] Vercel DNS for `media.getugcpilot.com` has been cut over to the GCP
  media CDN IP `8.233.40.78`.
- [ ] The GCP managed certificate for `media.getugcpilot.com` is still
  provisioning, so app/worker env must stay on
  `https://storage.googleapis.com/ugcsaas-media` until HTTPS passes.
- [x] Read-only AWS media backfill audit script exists:
  `npm run storage:gcp-backfill:audit`.
- [x] The audit can scan the production Supabase project
  `kltxwijhluawgveykfbt`. Production currently has 5,174 scanned rows and
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
- [ ] Existing S3/CloudFront media has not yet been fully copied to GCS. Start
  with larger reviewed batches until
  `npm run production:gcp-media-backfill:audit` reports 0 AWS-hosted media URLs.
- [ ] Final CDN env cutover is not complete. Current testing URLs use
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

- [ ] Continue AWS-to-GCS media backfill in larger batches. Recommended next
  step:
  `npm run storage:gcp-backfill:dry-run -- --table category_image_assets --max-objects 250`,
  then execute that same reviewed slice and rerun production audit.
- [ ] After the CDN certificate becomes `ACTIVE`, update production Vercel and
  Cloud Run worker `GCP_STORAGE_PUBLIC_BASE_URL` values to
  `https://media.getugcpilot.com` and rerun the production GCP storage audit.
