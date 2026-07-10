# Carousel System Context

Last updated: 2026-07-10

This document is the source of truth for Carousel product rules, architecture,
image safety, matching, readiness, rollout, and current implementation status.
Read it before changing Carousel API routes, workers, image sourcing, matching,
rendering, database schema, review scripts, or frontend behavior.

## Product Goal

Generate complete, visually coherent social carousels from website/business
analysis. Each candidate is one complete carousel with its own angle and slides.
The system should prefer highly relevant images, but it must degrade gracefully
to safe profile-specific backgrounds instead of failing on weak tag relevance.

The priority order is:

1. Human safety and manual approval.
2. Complete carousel output.
3. Image relevance.
4. Image uniqueness.
5. Library scale and readiness quality.

Relevance and uniqueness may degrade. Safety may not.

## Non-Negotiable Image Safety

Carousel background images must not contain any human presence:

- faces
- hands or arms
- bodies or cropped bodies
- silhouettes
- reflections containing people
- people in the background
- people shown on screens
- people shown on packaging or printed material

The project is not using a Vision API for this decision. Manual review is the
authority. An asset is selectable only when all current safety fields agree:

```text
status = ready
subject_review_status = approved
image_subject_class = object-only
has_human = false
face_count = 0
person_count = 0
```

Because the schema does not currently have `hand_count`, manual approval as
`object-only` also means the reviewer confirmed there are no hands, arms, or
other human traces. Unreviewed or rejected assets are never selectable.

## Image Taxonomy

### Legacy narrow buckets

`visual_bucket` records where an older asset originally came from, for example
`laptop-desk`, `calendar-overload`, or `gym-phone`.

Keep it temporarily for:

- migration history
- contact-sheet review
- mapping and tag debugging
- old-versus-new matcher comparison
- rollback diagnostics

It is not the future runtime routing field. New broad-v1 assets may have
`visual_bucket = null`.

### Broad runtime buckets

`broad_visual_bucket` is the new runtime pool. Taxonomy version is `broad-v1`.
The current broad buckets are:

- `workspace-objects`
- `phone-and-devices`
- `data-and-screens`
- `notes-and-planning`
- `home-lifestyle`
- `food-and-table`
- `fitness-wellness-objects`
- `product-still-life`
- `abstract-backgrounds`
- `clean-texture-backgrounds`

Detailed meaning comes from `content_tags`, `object_tags`, and `mood_tags`.
Example:

```json
{
  "visual_bucket": "gym-phone",
  "broad_visual_bucket": "phone-and-devices",
  "bucket_taxonomy_version": "broad-v1",
  "content_tags": ["phone", "fitness", "tracking"],
  "object_tags": ["phone", "dumbbells"],
  "mood_tags": ["focused"]
}
```

Before an approved asset becomes selectable by the broad matcher, it must have
a valid `broad_visual_bucket`. Unreviewed assets may be incomplete temporarily.

## Broad Bucket Requirements

The canonical definitions live in
`lib/carousel/broad-visual-bucket-taxonomy.ts`.

Marketing SaaS currently requires:

- `workspace-objects`
- `phone-and-devices`
- `data-and-screens`
- `notes-and-planning`
- `abstract-backgrounds`
- `clean-texture-backgrounds`

Fitness Health currently requires:

- `food-and-table`
- `phone-and-devices`
- `fitness-wellness-objects`
- `home-lifestyle`
- `abstract-backgrounds`
- `product-still-life`

Other profiles are defined in the same taxonomy file. Each profile must also
declare an explicit logical fallback list made from broad buckets already
allowed for that profile. A fallback pool is configuration, not a new physical
bucket, S3 folder, or duplicated asset collection.

Example:

```json
{
  "profile": "marketing-saas",
  "fallbackBroadBuckets": [
    "clean-texture-backgrounds",
    "abstract-backgrounds",
    "workspace-objects"
  ]
}
```

The images stay in their normal broad buckets. The profile's fallback list only
controls which existing safe pools the matcher may search after stronger
matches are exhausted. Do not dynamically borrow an unrelated category.

## Runtime Matching Contract

Tags are scoring signals, not hard blockers. Missing an exact tag match lowers
relevance; it does not make a safe asset unusable.

Selection order:

1. Same broad bucket with a strong tag match.
2. Same broad bucket with a partial tag match.
3. Same broad bucket with weak or no tag match.
4. Approved safe asset from an explicit fallback broad bucket for the profile.
5. Approved shared asset whose `usable_profiles` includes the profile.
6. Reuse an already-used approved safe asset if no unique asset remains.
7. Fail only when no approved safe asset exists anywhere in the permitted pool.

Duplicate avoidance is a preference, never a hard rule. Prefer different images
inside one carousel first. Also prefer avoiding duplicates across a generated
candidate batch when the approved pool is large enough. Apply a scoring penalty
before reuse, but reuse an approved safe asset whenever uniqueness would
otherwise prevent a complete carousel.

Unrelated cross-category fallback is prohibited. The intended meaning of
`CAROUSEL_DISABLE_CATEGORY_FALLBACK=true` is:

- block unrelated category fallback
- allow declared same-profile broad fallback
- allow shared assets only when the current profile is explicitly permitted

Every selection should produce diagnostics such as:

```json
{
  "selectedAssetId": "asset_123",
  "broadVisualBucket": "data-and-screens",
  "score": 92,
  "fallbackReason": "partial_tag_match",
  "duplicatePenaltyApplied": false,
  "matchReason": [
    "matched broad bucket data-and-screens",
    "matched tags analytics and dashboard",
    "approved object-only with zero human signals"
  ]
}
```

Supported reason names should include:

- `exact_match`
- `partial_tag_match`
- `broad_bucket_fallback`
- `profile_fallback`
- `shared_profile_fallback`
- `generic_background_fallback`
- `duplicate_safe_reuse`
- `no_safe_asset_available`

## Shared Assets

Preferred model: one physical and database asset row that may serve multiple
profiles. Do not duplicate the same asset into multiple category rows.

Target shape (`usable_profiles` is a JSONB array of strings):

```json
{
  "category_slug": "shared",
  "asset_scope": "shared",
  "broad_visual_bucket": "workspace-objects",
  "usable_profiles": [
    "marketing-saas",
    "productivity-saas",
    "generic-business"
  ],
  "subject_review_status": "approved"
}
```

If compatibility temporarily requires duplicate metadata rows, they must point
to one canonical asset or share a stable source/image hash. Runtime deduplication
must use canonical asset identity, S3 key, Pexels ID, or image hash, not only row
ID.

The first shared-pool compatibility path is implemented for `home-lifestyle`.
It uses one physical row per image with `category_slug = shared`; it does not
duplicate rows into each profile category. Productivity SaaS, Fitness Health,
Wellness, Beauty Skincare, and Generic Business may load this source category,
but the broad matcher still requires the bucket to support the active profile
and all strict safety fields to pass. Marketing SaaS does not load this pool.
Per-row `asset_scope` and `usable_profiles` fields are still planned and are not
implemented yet, so only deliberately universal shared pools may use this
compatibility path. Cross-category reuse is also constrained by an explicit
profile + source-category + broad-bucket policy. A profile does not receive
every asset from an allowed source category. For example, Wellness may reuse
Fitness Health food/wellness/product pools and Marketing SaaS clean textures,
but it may not reuse Marketing SaaS analytics/data screens as Wellness abstract
backgrounds.

## Readiness and Sourcing

Readiness is diagnostic in the current product phase. It must not block normal
generation while an approved safe profile fallback exists.

Readiness levels per required broad bucket:

- 20 approved object-only assets: internal canary minimum
- 40 approved object-only assets: beta minimum
- 60-100 approved object-only assets: production target

Forty is a minimum, not a cap. Keep every approved safe surplus asset.

Sourcing model:

1. Fetch 80-120 Pexels candidates per batch when a pool needs a top-up.
2. Store new candidates as unreviewed and non-selectable.
3. Generate a contact sheet and review manifest.
4. Manually approve only strict object-only assets.
5. Preserve exact reject reasons such as human, face, hand, duplicate, or low
   quality.
6. Keep all approved safe assets; never trim a pool back to 40.
7. Repeat controlled top-ups until the desired readiness level is reached or the
   configured attempt limit is reached.

Contact sheets should show:

- broad bucket as the primary label
- legacy narrow bucket as secondary history
- content, object, and mood tags
- source query
- review status and reject reason

Readiness reports should include candidate, approval, rejection, duplicate,
minimum target, surplus, and status counts. Readiness warnings should be logged
and returned diagnostically, not converted into a user-facing 409 solely because
the ideal image count was missed.

## Feature Flags and Rollout

Use:

```text
CAROUSEL_BROAD_MATCHER_MODE=off|dry-run|enabled
CAROUSEL_DISABLE_CATEGORY_FALLBACK=true
```

- `off`: legacy matcher selects images.
- `dry-run`: legacy matcher still selects; broad matcher runs in shadow and logs
  comparisons.
- `enabled`: broad matcher selects; legacy output may remain as shadow telemetry
  during rollout.

Safe rollout:

1. Local dry-run using Marketing SaaS.
2. AWS dry-run/shadow logs.
3. Compare safety, relevance, fallback, and duplicate behavior.
4. Enable for a small Marketing SaaS canary.
5. Run visual render canaries.
6. Expand to Productivity SaaS, Fitness Health, Wellness, Beauty Skincare, and
   Generic Business after each profile passes its own validation.

Do not deploy a worker merely because local code changed. Build, publish, update
the ECS task/service, and verify worker version, git commit, safety policy, and
matcher version in logs.

## Content and Rendering

Website analysis provides business context. The Carousel planner uses an LLM
(`gpt-4o-mini` by default in the current implementation) to create structured
slide content and visual intent, with a deterministic fallback planner if the
LLM path fails.

The planner supports varied text modes rather than forcing a headline and body
on every slide. Rendering is performed with Sharp in the worker. Text must be
rendered into the final image with measured typography, safe wrapping, adaptive
font sizing, proper padding, and no heading-pill overflow.

The renderer must avoid fake app UI:

- no role chips
- no CTA buttons drawn as controls
- no unnecessary white boxes
- no dashboard-like components

The frontend displays already-rendered slide URLs and should not reconstruct the
slide typography.

## Live Architecture

```text
Frontend
  -> Next.js API route (thin controller)
  -> Supabase generation/job metadata
  -> AWS worker
  -> LLM slide plan + safe image matcher + Sharp renderer
  -> S3 rendered slides
  -> CloudFront delivery
  -> Supabase slide/generation status
  -> Frontend polling and candidate/slide navigation
```

Supabase stores analysis, assets, generation metadata, and slide metadata. S3
stores source assets and rendered slides. Pexels is used for controlled library
sourcing, not for ad hoc unsafe selection during a live render. The live heavy
Carousel worker is AWS, not a Supabase Edge Function.

Core tables:

- `website_analyses`
- `category_image_assets`
- `carousel_generations`
- `carousel_slides`

## Trending Carousel Outputs

As of 2026-07-10, Trending is a carousel-only, owner-scoped frontend feed for
real generated carousel outputs. It reads
`GET /api/carousel/history`, which requires a Firebase bearer token and returns
only the caller's carousel generations for the caller's single business profile.

- The feed uses the first ready, runtime-safe `renderedUrl` as the thumbnail.
- Processing and failed generations keep their real lifecycle state; they are
  not represented as template artwork.
- Generated candidates are presented in a real-data cover-flow deck: the active
  candidate is centered, neighboring candidates remain visible behind it, and
  arrow, dot, and swipe controls move through the same real records. Clicking a
  candidate opens its real `generationBatchId` preview/editor.
- Trending must show a clear profile-needed, preparing, ready, or
  failed/retry state. It must never fall back to static template artwork.
- Trending must not expose `All`, `Video`, `Avatar`, or `Image` format tabs,
  and it must not render template/inspiration cards. The separate Carousel
  Studio and its existing Generate button remain unchanged.
- New website analyses, initial Carousel generation, and additional candidate
  generation require Firebase authentication so their stored `user_id` matches
  the owner used by the Trending feed.
- Carousel status reads require Firebase authentication and are limited to the
  owner of the requested candidate or generation batch.
- Existing legacy rows owned by the former test user are intentionally not
  re-assigned by this frontend slice. Migrate them explicitly only after the
  intended owner is confirmed.

## Business Profile Automation

As of 2026-07-10, Carousel generation is business-profile-driven, not
Generate-button-driven.

1. One Firebase account has one business profile for the current product phase.
   `project_id` remains an internal default reference; no project selector is
   part of Trending.
2. Business context enters through one of three paths: website scrape with
   Firecrawl plus structured LLM analysis, an AI-IDE context paste parsed into
   the same structured analysis, or direct manual fields.
3. Saving a completed profile automatically prepares ten Carousel candidates,
   each with five slides, in the background. This targets fifty rendered slides
   per business-profile version. The profile's normalized analysis remains the
   worker input so the existing AWS planner, safe matcher, and Sharp renderer
   do not need to change.
4. Automatic generation rows carry the real Firebase `user_id`,
   `business_profile_id`, profile version, and `generation_source =
   auto_generated`. This makes repeat submissions idempotent per profile
   version and keeps future profile refreshes distinct.
5. The Generate button is intentionally unchanged in this phase. It must not
   enqueue, open, or otherwise initiate Carousel generation.
6. When Trending reads an older current-profile batch with fewer than ten
   candidates, it invokes an authenticated, idempotent preparation endpoint to
   complete that same batch. This is automatic profile preparation, not the
   manual Generate-button workflow.
7. Legacy `test-user-001` rows are development data until audited. Do not
   migrate or delete them blindly. Any cleanup must first confirm they are not
   demo or seed content and must remove dependent rows/assets deliberately.

## Current Implementation Status

Implemented:

- Pexels category asset library stored in S3 and referenced by Supabase.
- Manual review and strict object-only safety fields.
- Legacy narrow bucket taxonomy, matcher, readiness, seeding, and QA scripts.
- Broad-v1 taxonomy and profile requirements.
- Supabase columns `broad_visual_bucket`, `bucket_taxonomy_version`, and
  `object_tags`, with constraints and indexes.
- Broad metadata backfill for the Marketing SaaS and Fitness Health rows that
  were present during the 2026-07-06 backfill.
- Explicit logical fallback broad-bucket lists for every business profile.
- Broad runtime matcher v1 in both app and AWS-worker source, with strict safety
  filtering, soft tag scoring, runtime relevance exclusions, near-duplicate
  group avoidance, uniqueness preference, and safe duplicate reuse.
- `off|dry-run|enabled` broad matcher orchestration, defaulting to `off`.
- Structured legacy-versus-broad comparison diagnostics and deterministic app
  and worker checks.
- A live no-render Marketing SaaS audit that writes
  `.tmp/carousel-broad-matcher/marketing-saas-dry-run.json`.
- Expanded Marketing SaaS AWS shadow sampler
  `scripts/run-carousel-marketing-saas-shadow-sampling.mjs`, exposed as
  `npm run carousel:shadow-sample:marketing`. It queues controlled Marketing
  SaaS jobs, collects broad matcher dry-run logs from CloudWatch, writes a JSON
  report, review manifest, and visual contact sheet, and fails on missing logs,
  missing broad selections, failed jobs, or strict safety violations.
- Broad runtime matcher v2 in app and worker source. It adds deterministic
  candidate-spread scoring so similarly relevant assets rotate across sibling
  candidates while strict safety remains hard and approved duplicate reuse
  remains allowed when needed.
- Live Marketing SaaS broad matcher audit supports multi-candidate local
  diversity simulation with `--candidates`.
- Carousel worker deployment verifier
  `scripts/check-carousel-worker-deployment.mjs`, exposed as
  `npm run worker:carousel-deployment:check`. It verifies the ECS task
  definition env and the latest CloudWatch startup log for matcher mode,
  broad matcher version, image safety policy, and renderer version.
- LLM slide planner with deterministic fallback.
- Professional Sharp text renderer and AWS Carousel worker path.
- Supabase relevance metadata `runtime_exclusion_reason` and
  `near_duplicate_group`, including database constraints and a ready-pool index.
- Marketing SaaS asset cleanup for wrong-bucket, human-form, people-on-screen,
  and manually confirmed duplicate assets.
- AWS Carousel worker revision 7 deployed in shadow mode with
  `CAROUSEL_BROAD_MATCHER_MODE=dry-run` and
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`.
- Non-blocking readiness diagnostics in `POST /api/carousel/generate` and
  `POST /api/carousel/generate-more`: low image count and missing bucket target
  coverage now return warnings on successful responses instead of user-blocking
  `409` errors.
- The carousel frontend shows the first readiness warning as a compact
  non-blocking diagnostic banner.
- AWS Carousel worker revision 8 deployed after the readiness slice. It keeps
  broad matching in `dry-run`, keeps unrelated category fallback disabled, and
  only pre-blocks rendering when zero approved object-only assets are available.

Not implemented or not live yet:

- Broad matching is not authoritative. AWS runs it only in `dry-run`; the
  legacy matcher still selects rendered images.
- Per-row shared asset fields (`asset_scope` and `usable_profiles`) are not
  implemented. The explicit shared source-category compatibility policy is
  deployed to AWS only in broad-matcher `dry-run` mode; it is not authoritative
  live behavior yet.
- App and worker contain duplicated Carousel planner, matcher, and renderer code;
  changes must remain synchronized until that duplication is deliberately
  removed.

Latest Marketing SaaS validation (2026-07-07):

- Pexels `14331365` was archived for `wrong_broad_bucket`; its object-only
  safety classification was preserved.
- Pexels `6177636` was archived as the manually rejected duplicate. Pexels
  `6177637` remains ready, and both rows use near-duplicate group
  `marketing-workspace-6177636-6177637`.
- Pexels `8386558` was rejected after AWS shadow visual review because the
  skeleton is a human-form/anatomy subject.
- Pexels `5473313` was archived as irrelevant for Marketing SaaS because it is
  a coding/terminal workstation incorrectly tagged as spreadsheet analytics.
- False `human` content tags were removed from 51 manually approved, strictly
  object-only Marketing SaaS rows. Strict safety fields remain authoritative.
- Local broad routing passes 6/6 selections with zero missing selections, zero
  profile fallback, and zero duplicate reuse.
- AWS worker revision 7 reports broad matcher v1 in `dry-run`, safety policy
  `object-only-no-human-v1`, legacy matcher v2, and renderer v3.
- Final five-slide Marketing SaaS AWS canary
  `dd6cf9e6-cb68-4625-ae3e-4f771efd385b` completed successfully. Shadow
  selections were manually inspected and contained no humans, faces, hands,
  bodies, silhouettes, skeletons, or obvious wrong-category images.
- Readiness slice deployed AWS worker revision 8
  (`worker-20260706194410`). Startup logs verified broad matcher mode `dry-run`,
  safety policy `object-only-no-human-v1`, legacy matcher v2, broad matcher v1,
  and renderer v3.
- Post-deploy AWS canary `3ca6a8d1-75c3-4f19-889a-83c48460fc01` completed 5/5
  rendered slides.
- Expanded Marketing SaaS AWS shadow sample
  `marketing-shadow-20260707-1` completed 20/20 jobs and 100/100 slide
  comparisons. Report:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 55 exact
  matches, 34 partial tag matches, and 11 broad-bucket fallback selections.
  The sample selected 30 unique broad assets across 100 slide selections. This
  is safe but too concentrated for production quality; the top repeated asset
  appeared 12 times across the batch.
- Local broad matcher v2 audit for Marketing SaaS with `--candidates 20`
  completed against the current Supabase image library. It selected 39 unique
  assets across 120 slide selections, with the top repeated asset appearing
  9 times. This improves diversity versus the earlier shadow sample, but the
  image library remains below beta readiness.
- Pre-refill strict approved object-only Marketing SaaS broad-v1 baseline:
  `workspace-objects` 14, `phone-and-devices` 17, `data-and-screens` 10,
  `notes-and-planning` 10, `abstract-backgrounds` 9,
  `clean-texture-backgrounds` 7. Marketing SaaS also has 12 safe
  `home-lifestyle` assets, but that bucket is not a required Marketing SaaS
  broad bucket. Required Marketing SaaS broad buckets total 67 safe assets.
  Canary target is 120 total across the six required buckets, beta target is
  240, and production target starts around 360. At that time, deficits were 53
  for canary, 173 for beta, and about 293 for 60-per-bucket production.
- AWS Carousel worker revision 9 deployed with image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:worker-20260707044426`
  and task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:9`.
  `npm run worker:carousel-deployment:check` verified ECS env
  `CAROUSEL_BROAD_MATCHER_MODE=dry-run`,
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`, and CloudWatch startup values:
  broad matcher `broad-runtime-matcher-v2`, safety policy
  `object-only-no-human-v1`, runtime matcher `runtime-bucket-matcher-v2`, and
  renderer `social-bubble-renderer-v3`.
- Expanded Marketing SaaS AWS shadow sample
  `marketing-shadow-v2-20260707-1` completed 20/20 jobs and 100/100 slide
  comparisons after worker revision 9 deployment. Report:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-v2-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-v2-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 53 exact
  matches, 36 partial tag matches, and 11 broad-bucket fallback selections.
  The sample selected 35 unique broad assets across 100 slide selections, and
  the top repeated asset appeared 7 times. This improves the previous AWS
  sample from 30 unique assets and 12 top repeats.
- Marketing SaaS over-sourced broad-bucket refill tooling is implemented.
  `scripts/seed-marketing-saas-broad-refill.mjs` is exposed as
  `npm run carousel:marketing-broad-refill`. It computes broad bucket gaps,
  plans candidate fetches with `max(50, approved_gap * 5)` capped at 120 by
  default, skips buckets with pending unreviewed candidates, and never makes
  new rows selectable without manual approval. The low-level Pexels seeder can
  now write `broad_visual_bucket`, `bucket_taxonomy_version = broad-v1`, and
  object/mood tags at insert time. Explicit candidate limits below the old
  default of 80 are allowed so small gaps can still use controlled 40-60 style
  batches. The broad contact-sheet script now supports `--review-status
  unreviewed`, and the review applier supports broad-bucket review manifests.
  It also supports a narrow per-bucket
  `allowSubjectMetadataResetIndexes` override for explicitly reviewed,
  approved assets whose old non-face subject metadata is stale; clear-face or
  face-count positives remain blocked.
- Marketing SaaS refill dry-run on 2026-07-07 originally found all six required
  broad buckets had pending unreviewed candidate pools, so no additional Pexels
  sourcing was run. Dry-run report:
  `.tmp/marketing-saas-broad-refill/refill-dry-run-2026-07-07T05-14-08-040Z.json`.
- Unreviewed Marketing SaaS broad-bucket contact sheets were generated for
  manual review:
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/workspace-objects`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/phone-and-devices`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/data-and-screens`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/notes-and-planning`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/abstract-backgrounds`,
  and
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/clean-texture-backgrounds`.
- Manual review decisions in
  `scripts/data/marketing-saas-broad-image-review-2026-07-07.json` were applied
  to Supabase on 2026-07-07. The applier reviewed 448 rows, approved 409,
  archived 39 rejects, and reset stale non-face subject metadata for one
  visually approved object-only asset. Additional notes-and-planning rejects
  were added after visual inspection found hands, arms, bodies, and heads in
  the contact sheet. Applied review report:
  `.tmp/carousel-image-review/applied-review.json`.
- Post-apply Marketing SaaS refill/readiness dry-run shows zero pending review
  rows and all six required broad buckets above canary target. Strict approved
  object-only counts are: `workspace-objects` 106, `phone-and-devices` 100,
  `data-and-screens` 85, `notes-and-planning` 21,
  `abstract-backgrounds` 77, and `clean-texture-backgrounds` 87. Required
  bucket total is 476 against the 120 canary target. `notes-and-planning` is
  canary-ready but remains the beta weak spot because it is still below the
  40-asset beta target. Readiness report:
  `.tmp/marketing-saas-broad-refill/refill-dry-run-2026-07-07T05-37-03-096Z.json`.
- Local Marketing SaaS broad matcher audit after review apply selected from 488
  safe approved broad-v1 assets, including the 12 safe `home-lifestyle` assets
  outside the required Marketing SaaS buckets. With `--candidates 20`, it
  produced 94 unique assets across 120 simulated slide selections, zero missing
  broad selections, zero profile fallback, and zero duplicate safe reuse. Local
  audit report:
  `.tmp/carousel-broad-matcher/marketing-saas-dry-run.json`.
- Productivity SaaS can now reuse compatible Marketing SaaS broad assets without
  duplicating database rows. This is a compatibility source-category read, not
  the final shared-asset schema. `productivity-saas` reads its own approved
  object-only assets plus `marketing-saas` assets when the broad bucket is valid
  for the Productivity profile and all strict safety fields pass. Live local
  audit on 2026-07-07 selected 6/6 broad assets for Productivity SaaS with zero
  missing broad selections, zero profile fallback, and zero duplicate safe
  reuse. The selected sample sourced all six assets from Marketing SaaS, proving
  that the reuse path works. Report:
  `.tmp/carousel-broad-matcher/productivity-saas-dry-run.json`.
- A single shared `home-lifestyle` candidate pool was sourced and reviewed on
  2026-07-07. It contains exactly 80 Pexels candidates under
  `category_slug = shared` and `broad_visual_bucket = home-lifestyle`. Manual
  review approved 72 strict object-only assets, archived 8 human-positive
  assets, and left zero pending rows. Four user-reported rejects were joined by
  four additional strict-policy rejects found during high-resolution review:
  a printed human face, people visible through windows, a face/hands/body scene,
  and prominent human figures in wall art. The source batch uses one physical
  pool for Productivity SaaS, Fitness Health, Wellness, Beauty Skincare, and
  Generic Business. Contact sheets and the review manifest are under
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/shared/home-lifestyle`.
- App and worker source now recognize the explicit `shared` source category for
  those five profiles. Generic Business treats `home-lifestyle` as an optional
  profile fallback, not a readiness requirement. Strict approval and broad
  profile suitability checks remain unchanged. These source changes are present
  in AWS worker revision 11, but only as dry-run broad matcher shadow behavior.
- Post-review local Productivity SaaS audit loads 488 Marketing SaaS rows, 78
  Productivity SaaS rows, and 72 shared rows. Its combined `home-lifestyle`
  count is 84, it selected 6/6 slides with zero missing selections, and it used
  no duplicate-safe reuse. Report:
  `.tmp/carousel-broad-matcher/productivity-saas-dry-run.json`.
- Generic Business now reuses Marketing SaaS and shared rows without sourcing a
  separate category library. Its local audit selected 6/6 slides with zero
  missing selections and 93 unique assets across 120 simulated selections.
  Report: `.tmp/carousel-broad-matcher/generic-business-dry-run.json`.
- Wellness reuse is implemented locally with source-bucket restrictions. It may
  use Fitness Health `food-and-table`, `fitness-wellness-objects`, and
  `product-still-life`; Marketing SaaS `clean-texture-backgrounds`; and shared
  `home-lifestyle`. The corrected local audit excludes irrelevant Marketing
  analytics/dashboard assets. Current usable Wellness counts are:
  `food-and-table` 155, `fitness-wellness-objects` 10,
  `clean-texture-backgrounds` 87, and `home-lifestyle` 72. It can produce 6/6
  safe fallback selections, but `product-still-life` and Wellness-safe
  `abstract-backgrounds` remain at zero. Report:
  `.tmp/carousel-broad-matcher/wellness-dry-run.json`. This pre-refill state is
  superseded by the post-review shared-pool Wellness state below.
- Wellness gap sourcing is implemented as a shared-pool slice. The script
  `scripts/seed-shared-wellness-pools.mjs`, exposed as
  `npm run carousel:shared-wellness-pools:seed`, sources one controlled batch
  per missing/weak pool, skips any pool with pending review, and keeps every new
  candidate non-selectable. On 2026-07-07 it sourced exactly 80 unreviewed
  candidates for each of `product-still-life`, Wellness-safe
  `abstract-backgrounds`, and `fitness-wellness-objects` under
  `category_slug = shared`. All three batches completed with zero sourcing
  errors. These shared pools are permitted only for Fitness Health, Wellness,
  and Beauty Skincare. Productivity SaaS, Marketing SaaS, and Generic Business
  cannot use them. Each bucket has four contact-sheet pages and a manifest under
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/shared/<bucket>`.
  Manual review decisions in
  `scripts/data/shared-wellness-pools-review-2026-07-07.json` were applied to
  Supabase on 2026-07-07. The applier reviewed 240 rows, approved 204, archived
  36 rejects, and left zero pending review rows. Shared pool counts after review
  are: `product-still-life` 79 approved / 1 rejected, `abstract-backgrounds` 80
  approved / 0 rejected, and `fitness-wellness-objects` 45 approved / 35
  rejected.
- Post-review local Wellness broad matcher audit loads 528 safe approved
  broad-v1 assets across permitted source categories: Fitness Health 165,
  Marketing SaaS 87, and Shared 276. Required Wellness bucket coverage is:
  `abstract-backgrounds` 80, `clean-texture-backgrounds` 87,
  `fitness-wellness-objects` 55, `food-and-table` 155, `home-lifestyle` 72,
  and `product-still-life` 79. The audit selected 6/6 slides with zero missing
  broad selections, zero profile fallback, zero duplicate safe reuse, and 82
  unique assets across 120 simulated selections. Report:
  `.tmp/carousel-broad-matcher/wellness-dry-run.json`.
- Beauty Skincare reuse is implemented with source-bucket restrictions.
  It may use shared `home-lifestyle`, `fitness-wellness-objects`,
  `product-still-life`, and `abstract-backgrounds`, plus Marketing SaaS
  `clean-texture-backgrounds`. A pre-change Beauty audit could produce 6/6
  selections but had zero `clean-texture-backgrounds` and used profile fallback
  for clean texture slides. The source policy was updated in app and worker code
  to allow only Marketing SaaS `clean-texture-backgrounds` for Beauty Skincare.
  Post-change local Beauty audit loads 363 safe approved broad-v1 assets:
  `abstract-backgrounds` 80, `clean-texture-backgrounds` 87,
  `fitness-wellness-objects` 45, `home-lifestyle` 72, and
  `product-still-life` 79. It selected 6/6 slides with zero missing broad
  selections, zero profile fallback, zero duplicate safe reuse, and 83 unique
  assets across 120 simulated selections. Report:
  `.tmp/carousel-broad-matcher/beauty-skincare-dry-run.json`. No fresh Beauty
  Skincare sourcing is needed for canary or beta readiness.
- The profile-aware AWS shadow sampler is implemented in
  `scripts/run-carousel-marketing-saas-shadow-sampling.mjs` and exposed as
  `npm run carousel:shadow-sample:profile`. It keeps the Marketing SaaS command
  as the default, but can now run controlled dry-run samples for
  `productivity-saas`, `generic-business`, `wellness`, and `beauty-skincare`.
- AWS Carousel worker revision 10 initially deployed the shared source-policy
  updates in `dry-run`, but the first Beauty Skincare shadow sample exposed a
  resolver bug: Beauty analysis could resolve as `wellness` because the profile
  resolver checked Wellness keywords such as `habit` before Beauty keywords.
  The resolver now first honors explicit category/slug/label matches and then
  uses scored keyword matching. The fix is present in both app and worker code,
  and the regression is covered by app and worker broad-matcher checks.
- AWS Carousel worker revision 11 deployed the resolver fix with image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:worker-20260707095551`
  and task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:11`.
  `npm run worker:carousel-deployment:check -- --minutes 30` verified ECS env
  `CAROUSEL_BROAD_MATCHER_MODE=dry-run`,
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`, and CloudWatch startup values:
  broad matcher `broad-runtime-matcher-v2`, safety policy
  `object-only-no-human-v1`, runtime matcher `runtime-bucket-matcher-v2`,
  content planner `llm-carousel-planner-v1`, and renderer
  `social-bubble-renderer-v3`.
- Beauty Skincare AWS visual QA after worker revision 11 archived seven
  previously approved but visually unsafe selected assets: Pexels `26733176`
  and `9475406` from shared `product-still-life` for hands; Pexels `30499766`
  and `10567234` from Marketing SaaS `clean-texture-backgrounds` for hands or
  arms; and Pexels `5797939`, `9908658`, and `5594349` from Marketing SaaS
  `clean-texture-backgrounds` for printed-human or human-like figure content.
  The log-level strict safety report had not caught these because their
  database safety metadata was stale, so visual contact-sheet inspection remains
  required before live enablement.
- Current AWS Beauty Skincare shadow sample
  `beauty-skincare-source-policy-v5-cleaned-20260707-1` completed 10/10 jobs
  and 50/50 slide comparisons against worker revision 11 after the cleanup.
  Raw broad matcher logs show `profileId = beauty-skincare` and
  `categorySlug = beauty-skincare`. Report:
  `.tmp/carousel-shadow-sampling/beauty-skincare/beauty-skincare-source-policy-v5-cleaned-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/beauty-skincare/beauty-skincare-source-policy-v5-cleaned-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 26 exact
  matches, 15 partial tag matches, 9 broad-bucket fallback selections, and 35
  unique selected assets across 50 selections. The v5 contact sheet was visually
  inspected, then the user manually rejected index 23. That mapped to shared
  `product-still-life` Pexels `36650046`, and it was archived on 2026-07-07.
  A fresh Beauty shadow sample should be run before treating Beauty as visually
  cleared again.
- AWS Wellness shadow sample `wellness-source-policy-20260707-1` completed
  10/10 jobs and 50/50 slide comparisons under the deployed source-policy dry
  run. Report:
  `.tmp/carousel-shadow-sampling/wellness/wellness-source-policy-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/wellness/wellness-source-policy-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 7 exact
  matches, 35 partial tag matches, 8 broad-bucket fallback selections, and 44
  unique selected assets across 50 selections. The user manually rejected index
  15, which maps to shared `fitness-wellness-objects` Pexels `4853707`. The
  archive dry-run targeted the correct row, but the execute step was blocked by
  the approval/usage system before it could run, so this rejection remains
  pending.

Do not describe planned behavior as deployed behavior.

## Next Implementation Slice

Name: **Finish dry-run shadow validation before live broad matcher enablement**

1. Keep `CAROUSEL_BROAD_MATCHER_MODE=dry-run` and
   `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`.
2. Run controlled AWS dry-run/shadow samples for Productivity SaaS and Generic
   Business against worker revision 11.
3. Manually inspect the Beauty Skincare and Wellness contact sheets before
   considering live enablement.
4. If the remaining profile samples have zero missing selections, zero safety
   violations, and acceptable repeated-asset concentration, prepare a separate
   one-profile live canary plan.
5. Do not enable broad matching live in the same slice as shadow validation.
   Do not source more images unless a dry-run profile shows missing selections,
   safety violations, or unacceptable repeated-asset concentration.

## Working Rules

- Make one behavior change per slice and validate it before deployment.
- Keep API routes thin; heavy generation belongs in the AWS worker.
- Never use Supabase Edge Functions for Sharp rendering.
- Never make unreviewed assets selectable.
- Never silently fall back to an unrelated category.
- Never trim approved surplus assets.
- Never claim AWS behavior changed until the deployed worker version is verified.
- Update this file whenever a product rule or architecture decision changes.
