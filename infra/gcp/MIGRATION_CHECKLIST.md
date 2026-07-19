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
- [ ] Existing S3 media has not been copied to GCS.
- [ ] Final CDN domain/DNS is not configured. Current testing URLs use
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

- [ ] Production GCP storage upload audit:
  verify a normal production app upload/signing path uses `ugcsaas-media`
  instead of AWS S3, then verify the stored object is readable through the
  configured GCP public base URL. Local route/runner implementation is in
  progress; keep this unchecked until the deployed production audit passes.
