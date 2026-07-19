# AWS to GCP Migration Checklist

Last checked: 2026-07-19

Use this checklist as the migration source of truth. Check an item only when it
is live and verified, not merely planned or coded.

## Git Release State

- [x] Local commit `9793993` created for the GCP video-render worker slice.
- [x] Local commit `264955d` created for the GCP AI-generation worker slice.
- [ ] Push local commits to remote Git. The local branch is ahead of
  `origin/main` by 2 commits, but direct `git push origin main` was blocked by
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

- [x] GCP Pub/Sub topics exist for all logical queues:
  `ugc-ai-generation`, `ugc-carousel`, `ugc-video-render`,
  `ugc-media-processing`, and `ugc-social-publish`.
- [x] GCP Pub/Sub subscriptions exist for all logical queues:
  `ugc-ai-generation-sub`, `ugc-carousel-sub`, `ugc-video-render-sub`,
  `ugc-media-processing-sub`, and `ugc-social-publish-sub`.
- [x] Pub/Sub DLQs exist for all logical queues.
- [x] Application code can publish through GCP Pub/Sub when
  `QUEUE_PROVIDER=gcp` is set.
- [x] Worker code can consume Pub/Sub when `WORKER_QUEUE_PROVIDER=gcp` is set.
- [x] `ai-generation` queue is live on GCP and passed a no-spend worker canary.
- [x] `carousel` queue is live on GCP and passed a real Carousel generation
  smoke test.
- [x] `video-render` queue is live on GCP and passed a real MP4 render smoke
  test.
- [x] `social-publish` queue is live on GCP and passed a fake-target canary.
- [ ] `media-processing` is not fully migrated. The GCP topic/subscription and
  generic `test_worker_job` canary exist, but no production Cloud Run worker
  profile is live for `extract_video_metadata`, `generate_thumbnail`, or
  `render_demo_video`.
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
- [ ] Media-processing production worker still needs a migration decision and
  implementation.
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

## Current Next Slice

- [ ] Media-processing migration slice:
  verify whether `extract_video_metadata`, `generate_thumbnail`, and
  `render_demo_video` are still required; then either migrate those handlers to
  a GCP Cloud Run worker profile or remove/redirect obsolete queue usage.

