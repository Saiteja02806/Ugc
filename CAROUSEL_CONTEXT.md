# Carousel System Context

Last updated: 2026-08-12

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

## Library-to-Social Scheduling Boundary

Scheduling entry points operate only on complete carousels saved in the server
Library with a real `library_items.id`. Browser-only fallback items cannot open
the scheduling flow.

Both Trending and Library use the same inline Carousel scheduling modal.
Trending first saves the complete carousel to the server Library, then keeps
the user on Trending while the modal collects the exact connected account,
optional caption, provider settings, and publish time. Library opens the same
modal directly for server-backed items. Normal Carousel scheduling must not
navigate to the Scheduling page.

The scheduling backend stores server-backed `scheduled_posts` and
`scheduled_post_targets` rows and creates delayed GCP Cloud Tasks for connected
social accounts. Scheduler payloads contain only `{ version, targetId }`;
captions, media URLs, OAuth tokens, cookies, and other secrets do not pass
through Cloud Tasks.

Saved carousels are scheduled as `library_item` sources; they must never be
silently replaced with a video media asset. The Scheduling editor preserves the
Library item, collects an exact connected account plus wall-clock date/time,
and only then creates Cloud Tasks. Undated drafts remain visible in the
Drafts list and do not appear as timed calendar entries.

Social scheduling uses one server-owned five-minute minimum lead for ready
media, including ready Library carousels. Date/time controls use one-minute
steps and must not round choices or defaults to quarter-hour boundaries. The
lead check aligns `now` to the current minute so a whole-minute selection such
as 15:05 remains valid when the request reaches the server a few seconds after
15:00. The API exposes the configured minimum to all scheduling clients, while
the server remains authoritative. A combined-video render may reuse the
originally validated publish time only when enough time remains to create its
exact-time Cloud Task; otherwise finalization fails clearly and requires a new
future time. The delayed GCP Cloud Task architecture and atomic publish claim
remain unchanged.

The visible Scheduling workspace and inline Carousel scheduling modal are
Instagram-only for new posts and Carousel recovery edits. Their account pickers
offer Instagram connections only. The portaled inline modal applies the
Instagram theme directly, and each account presents selection, connection
status, and reconnect in one publishing-account row instead of duplicated
connection and selection sections. Existing TikTok and YouTube provider
definitions, validation, and publishing logic remain preserved as dormant
multi-platform support, and legacy non-Instagram planned targets must not be
silently removed when an older draft is edited. This does not change the inline
Carousel scheduling boundary described above.

Instagram OAuth distinguishes adding an account from reconnecting one. Adding
must never revoke or replace another connection. Reconnect sessions persist the
selected `social_connections.id`, and the callback must verify that the returned
Instagram account ID matches that connection before updating credentials. Both
Settings and the inline account picker expose Add another account; the picker
may select up to five exact Instagram connections, with each selected account
remaining a separate publish target.

The modal flow is Step 1 action choice, Step 2 exact account selection, Step 3
optional caption and provider settings, and Step 4 ASAP or later scheduling.
`Next` changes only the modal step. It must not create a visible Drafts-page
outcome or navigate away. Cancel before final submission creates no schedule.
On final submission, the app creates or reuses an internal server draft with
the exact planned targets and wall-clock time, then calls the schedule publish
endpoint. Only a successful durable platform schedule closes the modal and
shows success. If final scheduling fails after draft persistence, the modal
stays on the origin page and may offer `/scheduling?draft=<id>` solely as a
recovery path. Direct visits to that deep link must still open the exact draft
editor, and the same recovery path remains reusable for Hook videos.

Carousel captions are optional. A blank caption must remain blank through
scheduling and publishing; do not synthesize provider text from the Carousel
title and do not require an LLM caption call. The visible Instagram editor may
offer an editable optional caption, but caption presence must never block
account/date/time scheduling. Dormant legacy TikTok targets keep their existing
caption support.

The social publish worker loads the ordered `library_carousel_slides` rows at
publish time. Instagram publishes a 2-10 image carousel through child media
containers plus one persisted parent container. Before container creation, the
worker converts the rendered WebP slides to deterministic GCS-backed
JPEG publish copies; the Library carousel and frontend renders remain
unchanged. Dormant legacy TikTok targets publish the verified WebP URLs as a
2-35 image photo post through the Content Posting API and persist the publish
ID. YouTube remains unavailable for carousel scheduling because its upload API
is video-only. New inline Carousel scheduling does not render TikTok or YouTube
connections; their provider definitions and legacy target handling remain in
code so old schedules are not damaged. Existing Reel, TikTok video, and YouTube
video paths remain separate. Do not describe a scheduled post as actually
published until the worker updates its target row to `published`.

Carousel generation uses the shared durable job contract. Supabase
`background_jobs` and `background_job_events` are authoritative for ownership,
idempotency, claims, checkpoints, cancellation, retries, recovery, and terminal
state. The app dispatches a versioned `{ jobId, jobType, attempt }` payload to a
deterministically named GCP Cloud Task. An authenticated Cloud Run HTTP worker
reloads the full input from Supabase; the queue payload is never the source of
truth. Carousel has no selectable alternate queue provider.

For the Vercel app runtime, GCP queue publishing cannot rely on
`GOOGLE_APPLICATION_CREDENTIALS` unless it points to a real file. The app
supports `GOOGLE_CLOUD_CREDENTIALS_JSON` or the split
`GOOGLE_CLOUD_CLIENT_EMAIL` / `GOOGLE_CLOUD_PRIVATE_KEY` env pair for the
`ugc-app-sa` service account. Carousel API runtime validation checks Supabase
and the configured app queue provider; worker-side storage is validated through
the deployed worker profile and GCP smoke test.

Trending feed readiness is GCP-storage-aware:
completed Carousel rows are display-ready only when every ready slide URL is
trusted by GCS storage. Historical rows with URLs from retired providers are
not display-ready. Do not rewrite old rendered URLs in place; reset affected
feed items and let the app generate fresh GCP Carousel inventory instead.

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

## Local Curated Image Packs

As of 2026-07-12, local curated carousel image packs are being audited before
any upload or production selection change. The known source folders are:

- `C:\Users\chund\Downloads\calory tracking` -> `calorie_tracking`
- `C:\Users\chund\Downloads\gym_carousel_images_pack\...` -> `gym`
- `C:\Users\chund\Downloads\personal_finance_carousel_images_pack\...` ->
  `personal_finance`
- `C:\Users\chund\Downloads\productivity` -> `productivity`

The audit command is:

```text
npm run carousel:local-images:audit
```

This command is intentionally read-only. It creates a local report under
`.tmp/local-carousel-image-pack-audit`, does not upload files, does not write to
Supabase, does not rename source folders, and does not approve any asset.

The local pack import model must extend the existing `category_image_assets`
pipeline. Do not create a disconnected runtime table such as
`carousel_image_assets` unless the app, worker, matcher, review tooling, and
slide foreign keys are deliberately migrated together.

Local source folder categories are not always runtime categories. The current
runtime mapping is:

- `beauty_skincare` -> `beauty-skincare`
- `calorie_tracking` -> `fitness-health`
- `gym` -> `fitness-health`
- `marketing` -> `marketing-saas`
- `outdoor_lifestyle` -> `shared`
- `personal_finance` -> `personal-finance`
- `productivity` -> `productivity-saas`

Keep the original local category in source metadata for provenance and review
debugging.

For a multi-folder pack, first create compact review sheets directly from the
audit report. `--category` can limit a sheet run to one source category:

```text
npm run carousel:local-images:review-sheets -- --audit-report <report.json> --category <source-category>
```

After full-resolution safety decisions are recorded, build a fail-closed
per-file review map:

```text
npm run carousel:local-images:review-map -- --audit-report <report.json> --tag-manifest <unreviewed-tag-manifest.json> --safety-review <review.json> --out-file <review-map.json>
```

The preferred reviewed tag-manifest command is:

```text
npm run carousel:local-images:tag -- --audit-report <report.json> --review-map <review-map.json>
```

It reads the latest audit report and writes a structured manifest under
`.tmp/local-carousel-image-tags`. The manifest includes one asset entry per
visual family, inferred category tags, object tags, broad runtime bucket,
caption, quality score, duplicate-family ID, text-safe areas, and source-file
links. It does not upload files and does not write to Supabase.

`local-curated-image-tags-v2` uses whole normalized terms rather than unsafe
substring matches, keeps category defaults narrow, and adds literal
content/object tags that the current runtime matcher can actually score.
Per-file overrides are required when an opaque generated filename contains no
semantic information. Review-map tags augment inferred tags; they do not erase
specific object terms inferred from the file path. Broad category mapping,
semantic tagging, duplicate decisions, and strict object-only safety decisions
remain separate concerns.

The local prepare command is:

```text
npm run carousel:local-images:prepare
```

It reads the latest tag manifest and writes an upload-ready local package under
`.tmp/local-carousel-image-import`. It normalizes every runtime image to
`base-1080x1350.webp`, creates a `thumb-320x400.webp`, keeps the original file
for provenance, and writes the exact `category_image_assets` row payload that
the importer will use. This command does not upload files and does not write to
Supabase.

The local import command is:

```text
npm run carousel:local-images:import
```

Before importing, run the checkpoint validator:

```text
npm run carousel:local-images:check
```

It verifies runtime category mapping, allowed broad buckets, strict safety
fields, duplicate object-key/hash identities, and prepared base/thumb
dimensions.

Then run the live structure preflight:

```text
npm run carousel:local-images:remote-structure
```

It checks the remote `category_image_assets` schema, samples existing row
shape, counts current strict-approved assets, and confirms the prepared
`base_s3_key` and `source_file_sha256` values do not already exist.

It is dry-run by default. The execute form is:

```text
npm run carousel:local-images:import -- --execute --yes
```

The importer uploads original, base, and thumbnail files to GCS under
`category-library/<runtime-category>/<broad-bucket>/<asset-id>/`, then inserts
the corresponding rows into `category_image_assets`. It checks for existing
local rows by `base_s3_key` and `source_file_sha256` before inserting, and it
preflights the remote schema before the first GCS upload. The `*_s3_key`
column names are legacy schema names only.

After importing, run:

```text
npm run carousel:local-images:verify-import
```

It reads the import manifest and import result, verifies all production rows
match the manifest, and can optionally sample uploaded GCS URLs.

Original files are the canonical source when an `originals` folder is present.
`carousel_4x5` or `carousel_1080x1350` files are derived renditions of the same
visual family, not separate fresh images. A crop and its original must share
canonical identity or duplicate-family metadata so the matcher cannot select
both inside one carousel or count both as unique inventory. Cropped-only packs
may be imported as lower-resolution canonical candidates only when originals
cannot be recovered.

For carousel runtime, prefer the manually prepared 4:5 rendition
(`carousel_4x5` or `carousel_1080x1350`) whenever it exists. Keep the original
as the provenance/canonical source and store it separately. A 9:16 vertical
image is not the preferred carousel runtime source; use it only when no 4:5
rendition exists and crop it to 4:5 during import.

All local imported assets must start as unreviewed and non-selectable. They
become selectable only after the same strict manual object-only review used for
Pexels assets. The importer must preserve source/provenance metadata when
available and store SHA-256 plus perceptual/near-duplicate metadata for
cross-crop and cross-pack duplicate control.

When the user explicitly confirms a local pack has already been manually
reviewed as strict object-only, the tag manifest may mark those entries as
manual-approved for the import pipeline. That still does not publish them by
itself; upload, database import, and runtime selectability remain separate
steps.

Current local checkpoint from the reviewed folders:

- Tagged assets: 184
- Skipped source files represented by canonical/crop pairs or rejected
  recommendations: 100
- Prepared import assets: 184
- Preparation errors: 0
- Runtime category split:
  - `fitness-health`: 84 assets (`food-and-table`: 26,
    `fitness-wellness-objects`: 58)
  - `personal-finance`: 80 assets (`home-lifestyle`: 11,
    `notes-and-planning`: 66, `phone-and-devices`: 2,
    `workspace-objects`: 1)
  - `productivity-saas`: 20 assets (`phone-and-devices`: 1,
    `workspace-objects`: 19)
- Runtime crop split:
  - 98 assets used an existing carousel-ready 4:5 rendition.
  - 86 assets were normalized/cropped to 4:5 during preparation.
- Latest tag manifest:
  `.tmp/local-carousel-image-tags/2026-07-12T19-35-03-831Z/tag-manifest.json`
- Latest import manifest:
  `.tmp/local-carousel-image-import/2026-07-12T19-35-09-675Z/import-manifest.json`

Production upload checkpoint:

- The local-image metadata migration `20260712170500` was applied to the
  linked Supabase project and marked applied in migration history.
- Remote structure preflight passed before upload. It confirmed the live schema,
  existing row shape, and duplicate checks against the prepared S3 keys and
  source hashes.
- Import completed with 184 inserted rows and 0 skipped existing rows.
- Production row verification found 184/184 manifest rows.
- Imported category split:
  - `fitness-health`: 84 rows (`food-and-table`: 26,
    `fitness-wellness-objects`: 58)
  - `personal-finance`: 80 rows (`home-lifestyle`: 11,
    `notes-and-planning`: 66, `phone-and-devices`: 2,
    `workspace-objects`: 1)
  - `productivity-saas`: 20 rows (`phone-and-devices`: 1,
    `workspace-objects`: 19)
- Six uploaded CloudFront base URL samples were checked successfully.
- Import result:
  `.tmp/local-carousel-image-import/2026-07-12T19-35-09-675Z/import-result.json`
- Post-import verification:
  `.tmp/local-carousel-image-import/2026-07-12T19-35-09-675Z/post-import-verification.json`

The schema foundation for this is migration
`20260712170500_add_local_carousel_image_asset_metadata.sql`. It extends
`category_image_assets` with local source, original, hash, canonical identity,
asset-scope, and usable-profile metadata, and creates `carousel_image_usage`
for future per-user image freshness tracking. This does not by itself import
or approve any local image. Runtime duplicate identity now prefers
`canonical_asset_id`, then `source_file_sha256`, then `source_perceptual_hash`,
then existing Pexels/object-key identity.

## Daily Trending Feed

As of 2026-07-16, Trending has a server-backed daily feed layer. The
frontend should not treat the generic carousel history endpoint as the product
feed. It now requests:

```text
GET /api/trending/feed?timezone=<iana-timezone>
```

The route uses Firebase bearer authentication, keeps Firebase UID as the user
ID, resolves the user's local date from the browser-supplied IANA timezone, and
creates or returns one persisted feed for:

```text
user_id + local_date
```

The schema foundation is migration
`20260712173000_create_daily_carousel_feeds.sql`. It creates:

- `subscription_entitlements`
- `user_subscription_plans`
- `user_carousel_assignments`
- `daily_carousel_feeds`
- `daily_carousel_feed_items`

Migration `20260717100000_add_daily_carousel_replenishment.sql` adds
`daily_carousel_refill_batches`, the persisted profile timezone, daily-origin
and availability metadata on `carousel_generations`, batch-local candidate
uniqueness, idempotency keys for background jobs, and a delivery timestamp used
to lease Carousel Cloud Tasks redelivery attempts. It also adds the singleton daily
replenishment sweep checkpoint and service-role-only claim/advance RPCs.

Default entitlement rows are `pro` with 10 daily carousels and `ultra_pro` with
20 daily carousels. The frontend must read `dailyCarouselLimit` from the feed
response and must not hardcode plan limits.

The daily limit is an inventory target, not a one-time lifetime batch. On each
new user-local date, the feed must:

1. carry unfinished, runtime-safe assignments from earlier dates;
2. assign already-ready, unassigned eligible inventory;
3. count viable unassigned processing inventory; and
4. reserve and enqueue only the remaining shortfall to the persisted daily
   limit.

Examples for a daily limit of ten:

- ten completed yesterday -> generate ten for the new day;
- five completed and five unfinished -> carry five and generate five;
- none completed -> carry all ten and generate zero.

Completing an item does not refill its occupied position during the same local
day. The shortfall is calculated only against a new day's feed. Daily refill
reservations are idempotent per persisted feed and business-profile version,
and failed reserved candidates may extend that refill batch only after the
15-minute repair cooldown. Daily generation indexes are batch-local so worker
selection cost does not increase indefinitely as a profile accumulates daily
history.

Visible feed-item insertion and daily refill reservation both validate the
current `business_profiles.profile_version` inside service-role RPCs before
committing user-visible rows or reserving new generation work. A stale request
from an older business profile version must stop before enqueuing refill work
for that obsolete version.

Ready inventory is paged by a stable `created_at + id` cursor until the
required viable count is found or history is exhausted; assigned or failed
newer rows must never hide older valid unassigned inventory. Duplicate
rejection fingerprints ordered user-visible headline, supporting text, and CTA
copy only. Internal category and angle labels are not part of that identity.
New fingerprints are version-prefixed, and the feed recomputes visible-copy
fingerprints in memory for pre-release assignment rows so existing production
history remains compatible with the corrected duplicate rule.

An existing daily feed is read without rewriting its persisted feed row. Its
plan and daily limit are a snapshot for that local day. If the feed has fewer
items than that persisted limit, later GET requests append newly ready items to
the remaining positions. A partial feed therefore fills as existing generation
work completes instead of freezing after its first non-empty response.

The response exposes `feed.state` with these values:

- `ready`: at least one runtime-safe active carousel is available and no
  unfinished slot is waiting on a processing generation.
- `preparing`: the feed has an unfinished slot and at least one generation for
  the current profile version is genuinely processing.
- `caught_up`: the user completed the available assignments and there is no
  generation work to poll for.
- `exhausted`: no runtime-safe active carousel or processing inventory remains.

The frontend polls every six seconds while `feed.state` is `preparing`. If a
feed still has unfilled positions but no active processing job, it uses a
one-minute repair poll so an open tab discovers scheduler recovery without a
tight permanent loop. Empty exhausted and caught-up feeds must not be inferred
as genuinely processing. Before an unfinished assignment is carried into a new
local day, its generation is revalidated as complete and strict runtime-safe;
invalid carries are marked failed and their slots are offered to valid carries
or newly ready unassigned carousels.
If concurrent population requests create an active current-day assignment
before one feed-item insert loses a uniqueness race, the next top-up recovers
that unpersisted assignment before claiming another fresh carousel.

Completion is recorded through:

```text
POST /api/trending/feed/actions
```

Allowed completion actions are:

- left swipe succeeds -> `completed_skipped`
- right swipe + Library save succeeds -> `completed_saved`
- right swipe + a timed platform schedule succeeds -> `completed_scheduled`

Changing between slides, opening a card, closing the page, cancelling the
right-swipe modal, or failing a save/schedule request must not complete an
assignment.

The actions API enforces this completion evidence server-side. `saved`
requires an owner-scoped, non-deleted `generated_carousel` Library item for the
assignment's carousel. `scheduled` additionally requires an owner-scoped
`scheduled_posts` row linked to that Library item in a usable non-draft state.
Same-action retries are idempotent; conflicting completed actions return 409.
Trending creates or reuses the schedule record as an idempotent internal draft
only when the user submits the inline scheduling modal. Account selection or
draft creation alone is not completion. The assignment is recorded as
`completed_scheduled` only after the user chooses an exact account and time and
provider scheduling succeeds; this is still not a claim that the provider has
published the post yet.

The first feed layer only reused completed carousel generations that already
existed for the current business profile. The 2026-07-17 source slice adds the
missing daily refill ledger, batch-local generation identity, lazy feed
reconciliation, persisted user timezone, open-tab local-date refresh, and a
signed internal replenishment route. The active cycle ID and last successful
UUID cursor are persisted in Supabase. A retry, timeout, or later scheduled run
claims that active cycle and resumes from its saved cursor; only after
completion may a new scheduled cycle start. Cursor advances use a locked
compare-and-set RPC, so a response is never allowed to silently overwrite a
newer checkpoint. Completed cycle timestamps are monotonic: an older or equal
delayed retry is an idempotent no-op and cannot replace a newer completed
sweep. A failed profile is logged and counted without preventing later profiles
in that sweep. Each page calls a HMAC-authenticated Next.js route. It only
reserves generation rows and sends the normal background worker jobs; the
Carousel worker remains the only live LLM, matcher, Sharp render, storage, and
completion path. Queued or stale-processing Carousel jobs are redelivered after
the worker's 30-minute reclaim boundary using the same background-job ID. An
atomic database delivery lease prevents six-second frontend polling or
concurrent scheduler requests from flooding the queue, and the worker's atomic
claim prevents duplicate delivery from causing duplicate LLM/render execution.

A business-profile update does not remove Carousel assignments already placed
in that day's feed. Existing positions remain the day's delivered snapshot;
any still-empty positions use a refill reservation for the new profile version.
Feed-item insertion locks and rechecks the selected business-profile version in
the database transaction. If the profile changed after selection, no stale
assignment may enter an empty position; only assignments created by that losing
attempt are invalidated, and the caller retries against the latest profile.
This source behavior must not be described as deployed until the migration,
Vercel release, replacement scheduler, and running Carousel worker are all
verified.

Daily-refill production rollout order is database migration first, then verify
the Carousel worker has desired and running count one, configure the dedicated
`UGC_INTERNAL_CAROUSEL_SECRET` wherever the scheduler replacement runs with
`APP_BASE_URL=https://www.getugcpilot.com`, deploy Next.js, run a one-user
production canary, and enable the replacement schedule last. The GCP scheduler
replacement lives in `infra/gcp/carousel-scheduler`: Cloud Scheduler starts a
Cloud Run Job that runs `dist/scheduler/replenish-daily-carousels.js`, signs the
internal replenishment route, and pages until the sweep cycle completes. Keep
that scheduler paused until the Cloud Run Job has been manually executed and
verified. Do not copy `.env.local` or expose the Supabase service-role key
merely to use the signing fallback.

As of 2026-07-18, the first GCP worker image for this path is in Artifact
Registry:
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718111431`.
Terraform has applied Cloud Run Job `ugc-carousel-replenishment` and Cloud
Scheduler job `ugc-carousel-replenishment-quarter-hour`, and the scheduler is
paused. The automatic GCP replacement schedule is not live until that scheduler
is explicitly unpaused.

Later on 2026-07-18, the first two manual Cloud Run executions failed with
HTTP 401 because the deployed Vercel production route had an old invalid
`UGC_INTERNAL_CAROUSEL_SECRET` value. The Vercel production environment value
was updated to match GCP Secret Manager and the current production deployment
was redeployed. Manual execution `ugc-carousel-replenishment-ckb6c` then
completed successfully with one page, 3 processed profiles, and 0 failures.
The Cloud Scheduler job remained paused after the canary.

Historical note: the following 2026-07-18 Pub/Sub canary and AWS comparison
record is retained only as migration evidence. Both transports are retired;
the current implementation uses Cloud Tasks, Cloud Run, Supabase, and GCS.

The generic GCP Pub/Sub worker canary was validated. Terraform applied
Cloud Run Job `ugc-worker-canary-test` from `infra/gcp/worker-canary`, running
`test_worker_job` against `ugc-media-processing-sub` with
`WORKER_QUEUE_PROVIDER=gcp`. Early executions with `WORKER_POLL_WAIT_SECONDS=0`
exited before Pub/Sub returned messages, so the canary now uses a 10-second
pull wait. Final execution `ugc-worker-canary-test-bbd2b` completed Supabase
background job `24391910-4824-42a3-b432-2ff31f6bf775` with output worker
`gcp-cloud-run-job`.

The dedicated GCP Carousel worker profile is now deployed and verified.
Because a real queue consumer must keep running, the profile uses Cloud Run
Service `ugc-carousel-worker` from `infra/gcp/carousel-worker`, not a one-off
Cloud Run Job. The worker image
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718142523`
includes a `/healthz` listener for Cloud Run startup checks while the same
process keeps polling Pub/Sub. The service runs with one internal always-on
instance, `WORKER_QUEUE_PROVIDER=gcp`, `WORKER_JOB_TYPES=generate_carousel`,
`WORKER_PUBSUB_SUBSCRIPTION=ugc-carousel-sub`,
`CAROUSEL_BROAD_MATCHER_MODE=dry-run`,
`CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`, and `STORAGE_PROVIDER=gcp`.
Generated Carousel slides now use
`https://storage.googleapis.com/ugcsaas-media`, and `gs://ugcsaas-media` has
public object read enabled for the testing-phase GCP media cutover.

The real GCP Carousel generation smoke test on 2026-07-18 completed Carousel
`433cf650-3a79-4f00-a6d4-b1107f38b785` from Supabase background job
`ad451643-fdee-4e1f-93ce-ef925762584d` and Pub/Sub message
`19919982775905874`. Cloud Run logs showed message receipt, content planning,
image matching, text-containment validation, and job completion. The smoke
script verified 5 rendered slides and downloaded the GCS public URLs. This
validated the GCP Carousel worker path at that time. The current application
is GCP-only and ignores alternate queue-provider values.

The scheduler only includes profiles with a persisted Trending timezone. The
first authenticated browser feed request records the user's IANA timezone and
also performs lazy reconciliation immediately. Treating an unknown timezone as
UTC in the background sweep is forbidden because it can pre-create a feed for
the wrong user-local date; after the first visit, the scheduled sweep keeps that
profile replenished without requiring the tab to remain open.

Semantic near-duplicate concept rejection and deliberate visual-preset rotation
remain follow-up work.

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
Worker startup metadata records the planner mode/version and whether the OpenAI
secret is configured. This proves runtime capability, not a successful model
call; acceptance of a generated carousel must also verify its persisted
planner source/model provenance.

The planner supports varied text modes rather than forcing a headline and body
on every slide. Rendering is performed with Sharp in the worker. Text must be
rendered into the final image with measured typography, safe wrapping, adaptive
font sizing, proper padding, and no heading-pill overflow.

Balanced carousel copy rules:

- A heading or hook is optional. When present, it must be 3-8 words, at most 50
  characters, use no more than two visual lines, and must not be forced into a
  single line by over-shrinking.
- Supporting content must be one complete sentence of 8-20 words, at most 120
  characters, normally render as no more than three visual lines, explain one
  specific idea, and avoid repeating the heading. List modes may use four total
  visual lines.
- Legacy rows without a reserved content format keep the five-slide Hook,
  Problem, Consequence, Solution, and Result/CTA story. New automatic Trending
  rows use the exact five roles defined by their reserved V1 content format.
  Both paths retain the existing coarse slide types for renderer and matcher
  compatibility.
- The renderer is the final source of truth for line limits. It must wrap using
  the production font stack, actual font size, available width, padding, and
  card dimensions, then keep headings to at most two rendered lines and body
  text to at most four rendered lines.
- A headline and its supporting copy remain two distinct text groups. Within
  either group, paint one measured rounded rectangle directly behind each line
  and overlap adjacent rectangles vertically by 6-9px. Use an opaque-enough
  fill so overlap does not create a visible dark seam. Do not clip one large
  rectangle through a fragile silhouette.
- Reserve horizontal corner safety of at least `radius + 6px` on each side in
  addition to normal padding. Never cap a line rectangle below its required
  visible text width. Rewrap first, reduce type slightly only when rewrapping
  cannot fit, and reject the render if a text-mask pixel falls outside the
  white-background mask.
- Planner validation rejects repeated punctuation, fragments, incomplete
  endings, generic copy, repeated ideas, unsupported claims, grammar problems,
  and overlong copy. Invalid LLM output receives one short repair pass before a
  validated deterministic fallback is considered.
- Because headlines are optional, a repaired headline that still violates the
  3-8 word or 50-character limit is removed and its valid body is preserved as
  `body_only`; it must not force the whole repaired LLM plan into fallback.
- Object-only safety validation treats clock and watch hands as object parts,
  while continuing to reject human hands and other prohibited human subjects.
- Unsupported-claim validation rejects unsubstantiated quantified social proof
  and money/revenue/profit/sales/conversion outcomes, plus CamelCase product or brand
  names that do not appear in the stored website analysis.
- CTA commands that introduce a capitalized product name must use a name found
  in the analysis. Text mode is normalized again after a repeated or invalid
  optional headline is removed, so valid body copy remains renderable.
- Headline/body overlap at 60% or more drops the optional headline, and body
  grammar validation rejects nearby repeated content words such as
  `leads to lost leads`.
- `businessName` is authoritative for CTA brand names. Deterministic fallback
  sanitizes stale or mismatched CTA ideas, and quantified social proof is
  rejected even when an old analysis contains it.
- Every generation stores raw initial/repair LLM responses, the normalized
  plan, planner version/model/source/fallback reason, validation result, and
  renderer version on `carousel_generations`.

### 2026-08-10 Automatic Content Grammar V1

- This architecture reuses the one onboarding `business_profiles` row. The
  authoritative automatic-generation input is that row's current
  `context_json`, loaded by exact profile ID, Firebase owner, and
  `profile_version`; the linked `website_analyses` row remains provenance and
  a legacy/manual fallback. It does not create a second business profile, a
  parallel analysis table, a copied profile snapshot, or another onboarding
  flow. A stale profile-version job stops before completion instead of silently
  generating from old context.
- The current profile analysis is converted deterministically into controlled
  audience, customer-problem, customer-goal, and topic options. Stable option
  IDs let the model choose among supplied facts without inventing a new profile
  or starting another analysis request.
- Versioned JSON is the source of truth for 15 five-slide content formats and
  10 hook families in `worker/src/lib/carousel-config/formats.json` and
  `worker/src/lib/carousel-config/hook-families.json`. The configuration is
  validated at worker startup and fails closed on unknown IDs, invalid modes,
  incompatible hooks, or a format that is not exactly five slides.
- Before an automatic generation job is dispatched, the backend reserves one
  content-format ID and one compatible hook-family ID on the existing
  `carousel_generations` row. Selection is deterministic for a profile batch,
  preserves an existing reservation on retry, and scores recent usage to avoid
  immediate repetition across the ten candidates.
- `carousel_generations.format` continues to mean the canvas ratio such as
  `4:5`. Content structure is stored separately in `content_format_id`; do not
  overload or rename the ratio field.
- A compact snapshot of at most ten prior content summaries is stored with the
  reservation. It contains only format, hook family, hook, topic label/stable
  topic ID, and angle summary fields needed for retry-stable repetition checks;
  it never copies complete prior slide plans.
- Immediately before planning, the worker combines that reserved history with
  already-planned siblings from the same generation batch and persists the
  resulting compact ten-item snapshot. The current dedicated GCP Carousel
  worker remains limited to one instance with request concurrency one, so
  sibling planning is serialized and each later candidate can see earlier
  planned ideas. Do not increase either limit until same-batch idea reservation
  is made atomic in Postgres.
- The planner receives exactly one reserved format, one compatible hook family,
  the controlled profile options, and the compact recent-history snapshot. One
  normal LLM request creates one complete carousel. A single repair request is
  allowed only when the first result fails validation; otherwise the validated
  deterministic fallback is used.
- Automatic V1 output is always exactly five slides. Each slide stores its
  format-specific role while retaining the existing coarse `slideType` and
  `textMode`, so current image matching and rendering remain compatible.
- The final slide is a practical takeaway. A soft CTA is optional and must not
  be forced when it would weaken the content.
- Precise nutrition, calorie, protein, percentage, currency, time, audience,
  or performance numbers must be present in the saved analysis evidence. The
  planner rejects invented exact numbers; a calorie-tracking business may use
  formats such as Checklist, How-To, Swap, Comparison, or Myth vs Fact without
  fabricating nutritional values.
- Recent-topic validation uses the stable controlled topic ID as well as the
  compact topic label. A repeated topic is rejected while another saved topic
  option remains unused. Once every saved topic has appeared, controlled topic
  reuse is allowed so a small profile cannot deadlock generation; hook and
  angle freshness checks still apply. The deterministic fallback follows the
  same unused-topic-first selection rule.
- Object-only image safety, manual-review authority, matching policy, rendering,
  and scheduling boundaries are unchanged by the content-grammar slice.
- The V1 schema, selector, planner, app, worker, tests, and this architecture
  record are local worktree changes as of 2026-08-10. They are not deployed or
  production-verified until the additive migration is applied, app and worker
  revisions are released, and the authenticated production Trending flow is
  checked on `https://www.getugcpilot.com`.

The renderer must avoid fake app UI:

- no role chips
- no CTA buttons drawn as controls
- no unnecessary white boxes
- no dashboard-like components

The frontend displays already-rendered slide URLs and should not reconstruct the
slide typography.

## Current Live Architecture

```text
Frontend
  -> Next.js API route (thin controller)
  -> Supabase generation/job metadata
  -> GCP Cloud Tasks
  -> private Cloud Run worker
  -> LLM slide plan + safe image matcher + Sharp renderer
  -> GCS rendered slides
  -> Supabase slide/generation status
  -> Frontend polling and candidate/slide navigation
```

Supabase stores analysis, assets, durable job state, generation metadata, and
slide metadata. GCS stores source assets and rendered slides. Pexels is used
for controlled library sourcing, not for ad hoc unsafe selection during a live
render. Cloud Tasks is the only Carousel delivery queue; the worker runs on
Cloud Run.

Core tables:

- `website_analyses`
- `category_image_assets`
- `carousel_generations`
- `carousel_slides`
- `library_items`
- `library_carousel_slides`

## 2026-07-27 Frontend Presentation Rollback

- At the user's direction, the production-facing pages, components, and UI
  assets were restored to the last known old production presentation at Git
  commit `b874cc9`.
- This is a frontend-only rollback. The newer API routes, server libraries,
  tests, database migrations, worker logic, and GCP infrastructure remain in
  place.
- The old production light palette remains authoritative:
  `--background: #fcfbfa`, `--foreground: #17171b`, and
  `--primary: #c94716`.
- Later Trending, Analytics, AI Studio, Settings, and navigation presentation
  changes must not be treated as live after this rollback unless they are
  deliberately reintroduced and verified in production.

## Trending Carousel Outputs

As of 2026-07-25, the approved product target is one owner-scoped Trending
feed containing preview-ready completed Carousels, Hook videos, and
Wall-of-text videos in one Tinder-style deck. Users must not choose a format
before browsing. The side-by-side "Remixed from" reference preview is a future
feature and is not part of the current implementation.

The first implementation slice adds a format-independent `TrendingFeedItem`
contract and provider orchestration in `lib/trending/feed-items.ts`.
`GET /api/trending/feed` now returns unified `items` and provider availability
alongside the legacy `carousels` field for compatibility. Only completed
Carousel assignments whose full slide set has usable rendered URLs are adapted
into `format = carousel`, `readiness = preview_ready` items. Processing and
failed assignments remain in the legacy lifecycle data used by the existing
preparation and error states; they do not enter the unified deck. The Carousel
matcher, renderer, storage, save, scheduling, and completion paths remain
unchanged.

Hook feed items use a separate Hook text payload and become preview-ready when
the protected short source video, business-profile-generated Hook text, source
duration, and trim values are all available. A product demo is intentionally not
part of the Trending Hook card. A right swipe carries that exact Hook text and
source video into product-demo selection. The unified deck contains ready
Carousel, Hook, and Wall-of-text items and the former Carousel/Hook mode
selector is removed. Items are grouped by format in this fixed display order:

1. All Wall-of-text videos.
2. All Hook videos.
3. All Carousels.

Persisted feed position orders items only within its own format group. The
backend and frontend use the same shared comparator so the page cannot
accidentally restore interleaving.

Text data must not be flattened into one generic `text` field across formats:

- Carousel content remains slide-specific: ordered headline, subtext, slide
  type, and CTA semantics.
- Hook content is one short business-profile-generated overlay with
  duration-aware readability limits and Hook-specific placement/style metadata.
- Wall-of-text content is one continuous text value with its own validation and
  full-overlay layout rules. It has no separate headline, body, or closing
  fields.

The shared feed owns only common assignment, position, readiness, and format
metadata. Each format keeps separate generation, validation, persistence, and
rendering rules.

Wall-of-text preparation is implemented behind
`POST /api/trending/wall-text/feed/prepare`. Preview-ready Wall creatives are
included in the unified feed. The preparation path:

- selects only active, analyzed, 9:16 video rows from the shared
  `overlay_media_assets` catalog;
- prefers low-usage videos and avoids the caller's recently prepared
  backgrounds when fresh inventory exists, while allowing safe reuse rather
  than failing when the catalog is small;
- generates one continuous Wall-specific text value from the caller's current
  business profile;
- applies deterministic full-overlay layout metadata rather than asking the
  text model to invent placement;
- stores generated, owner-scoped `wall_text_creatives` and
  `user_wall_text_assignments` without duplicating the shared source video; and
- validates current business-profile ownership/version and source readiness in
  the database before a candidate can be persisted.

Migration `20260726100000_create_trending_wall_text_creatives.sql` adds those
generated creative and assignment layers. Assignment insertion increments the
shared source asset's global usage counter atomically. Browser clients have no
direct table privileges; the authenticated server route owns preparation.

The source catalog remains storage-provider neutral at runtime. Wall
preparation reads the source key/URL metadata produced by the configured media
upload path and contains no fixed GCS bucket, GCP hostname, S3 bucket, or
CloudFront hostname. Source upload tooling and final MP4 export remain separate
from feed preview.

- The feed receives the real ordered slide records for every returned candidate,
  including `renderedUrl`, slide number, type, text metadata, and status.
- Processing and failed generations keep their real lifecycle state; they are
  not represented as template artwork.
- Pending generations are summarized in one aggregate preparation state with a
  controlled three-card skeleton and total slide progress. Never render one
  large lifecycle card for every pending candidate. When completed candidates
  already exist, use the compact aggregate progress row instead. Failed
  candidates use one aggregate retry state rather than a wall of repeated
  failure cards.
- Generated candidates appear in a focused Tinder-style deck. One complete
  carousel candidate, including all five slides, is one outer deck card. Never
  flatten slides into the outer deck.
- The deck renders the active candidate plus at most the next two candidates.
  Background candidates are vertically offset, slightly smaller, less opaque,
  and non-interactive. The deck stops at the first and last candidates rather
  than looping or deleting an item after a swipe.
- Dragging the active card left selects the next complete carousel. Dragging it
  right opens the action choice dialog for the active carousel with Save to
  Library and Schedule Post options. Keyboard left/right navigation remains for
  accessible browsing between complete ideas. These interactions are local
  frontend state and must not refetch history.
- The active card may rotate by at most five degrees while dragged and exits in
  the swipe direction before the next candidate becomes active. Reduced-motion
  users get an immediate state change. Inner controls must be excluded from the
  outer pointer gesture at pointer-down time.
- The active Carousel card is approximately 270px wide and capped for narrow
  mobile viewports. This keeps it visually closer to the 230px Hook and
  Wall-of-text cards while retaining readable 4:5 slides. All slides for the
  active candidate and the selected slide of the next candidate are preloaded
  when the active candidate changes.
- Every candidate owns its own active-slide state. The centre card renders only
  that candidate's active slide; its left/right controls and five dots are
  positioned inside the image card and move only through that candidate's five
  slides. The dots, controls, and image must not create a wide three-slide
  strip or show neighboring slides from the same carousel. Background deck
  cards never expose slide controls, and a candidate's selected slide is
  preserved when the user leaves and returns.
- Completed carousel decks do not render a title, lifecycle badge, Generate
  action, idea counter, or Previous/Next idea controls below the card. Keep the
  deck visually focused and navigate complete ideas through swipe or keyboard.
- The right-swipe action dialog is the only post-swipe action surface on
  completed carousel cards. Save to Library calls the authenticated
  `POST /api/library/carousels` route with only the `carouselId`. The server
  verifies Firebase ownership, confirms the generation is completed, loads the
  ordered ready slides, and saves one Library parent item with ordered child
  slide rows. Duplicate saves return the existing Library item. After a
  successful save, Trending stays on the page, shows a View Library action, and
  advances to the next complete carousel. Schedule Post must use a
  server-backed Library item and the server scheduling API, then complete the
  account, optional-caption, provider-setting, and time flow inside the modal
  on Trending. Only the final successful scheduling call advances the deck.
  Browser-local scheduling drafts are no longer the intended persistence path.
- The Carousel Library lists only owner-scoped server Library items. The legacy
  global browser key `ugc-studio.carousel-library.v1` is not read, merged,
  scheduled, deleted, or automatically imported. Those old records have no
  trustworthy owner identity, so attaching them to whichever account is
  currently signed in would risk cross-account data exposure.
- Trending is the only visible Carousel product surface in the app. Clicking an
  image, slide, dots, or slide arrows must never open a separate Carousel Ads
  workspace.
- Trending must show a clear profile-needed, preparing, ready, caught-up,
  exhausted, or failed/retry state. It must never fall back to static template
  artwork or label a terminal empty feed as preparing.
- Trending must not expose `All`, `Video`, `Avatar`, or `Image` format tabs,
  and it must not render template/inspiration cards.
- The standalone `/carousel` Carousel Ads workspace is removed from the visible
  product. Do not reintroduce that route, link to it, or use it as a fallback
  destination unless a new product decision explicitly restores it.
- New website analyses, initial Carousel generation, and additional candidate
  generation require Firebase authentication so their stored `user_id` matches
  the owner used by the Trending feed.
- Carousel status reads require Firebase authentication and are limited to the
  owner of the requested candidate or generation batch.
- Existing legacy rows owned by the former test user are intentionally not
  re-assigned by this frontend slice. Migrate them explicitly only after the
  intended owner is confirmed.

## Hook Video Source Status

As of 2026-07-25, Hook Video source and scheduling/library building blocks exist
in the repository. A raw catalog or owner-uploaded influencer clip remains a
source asset. A unified Trending Hook item is the protected short video plus
Hook-specific text generated from the caller's current business profile,
variable source/trim duration, and a stable owner-scoped assignment. It does not
contain a product demo.

Migration `20260728183858_add_trending_hook_ideas.sql` adds a `trending`
suggestion context to the Hook-specific suggestion table and a separate
`user_hook_video_assignments` exposure layer. Existing `composition`
suggestions remain demo-specific. The two text-generation contexts are not
interchangeable.

The Hook videos product flow, when enabled from an approved surface, is:

1. Browse real catalog or owner-uploaded influencer videos. Influencer and video
   list APIs return display metadata only; they never expose source storage keys
   or source video URLs.
2. Trending Hook text is generated before browsing from the saved business
   profile only. It is constrained by the selected source video's real trimmed
   duration; there is no hard-coded five-second assumption.
3. A left swipe records a Hook-specific skip and moves to the next mixed feed
   item. A right swipe opens composition with the same source video and Hook
   text already selected, but opening or closing that reversible composer does
   not complete the Hook assignment. The Hook is recorded as selected only
   after Save to Content succeeds or after a real schedule and render request
   succeeds. These interactions do not mutate a Carousel assignment.
4. Product demos come only after a right swipe, from the caller's ready
   `media_assets` video collection or a new owner upload. The first screen shows
   only `Upload demo video` and `Choose existing`; saved videos are fetched and
   displayed only after the user opens the existing-demo picker. Selecting or
   uploading a demo moves a prefilled Trending Hook directly to Review. Save
   and Schedule remain final composition actions.
5. The product must not fabricate demo, influencer, or Hook records when real
   inventory is empty.
6. The legacy `POST /api/trending/hook-videos/suggestions` composition path
   authenticates the Firebase user,
   verifies ownership of the selected sources, requires the user's persisted
   business profile, calls OpenAI server-side with structured output, and stores
   the returned suggestions. Static or random suggestion text is forbidden.
7. Review previews the opening and demo separately, overlays the selected hook,
   and allows trim changes only for the opening clip. Save persists an
   owner-scoped Hook video draft for Content. Schedule persists or reuses the
   same reviewed selection, creates a real `scheduled_posts` draft, and opens the
   Scheduling workspace with that exact draft ID.
8. Hook ideas are a server-gated rollout. The server-only
   `TRENDING_HOOK_VIDEOS_ENABLED` variable must equal `true` to query or return
   the Hook feed provider or to run Hook preparation. Missing or false values
   fail closed. The deployed Vercel production environment and the
   `getugcpilot.com` production hosts always override that flag to `false`;
   localhost and non-production preview environments can explicitly enable it
   for testing.

Protected influencer playback uses a five-minute, HTTP-only, same-origin preview
session. The preview route revalidates the signed video, influencer, source, and
user claims before streaming the S3 object and does not return the underlying
source URL to the browser. Production should set a dedicated
`HOOK_VIDEO_PREVIEW_SECRET`.

Migration `20260717143000_create_hook_video_drafts.sql` adds the service-role-only
`hook_video_suggestions` and `hook_video_drafts` tables. Migration
`20260717150000_index_hook_video_foreign_keys.sql` adds the supporting foreign-key
indexes. Both tables use RLS with no browser-role policies; Hook APIs perform
Firebase ownership checks and use server credentials.

The combination renderer receives the verified opening and demo assets, opening
trim values, selected hook text, and a composition fingerprint. It trims only the
opening segment, burns hook text only into that opening, normalizes both segments,
and concatenates opening then demo. The fingerprint includes both asset versions,
trim values, hook text, and ratio so a changed composition cannot reuse a stale
combined render.

This Hook videos behavior is implemented and locally validated in the current
source. Do not describe the app or video-render worker behavior as deployed until
the corresponding Next.js and worker releases are pushed and verified.

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
5. There is no standalone Carousel Studio Generate screen in this phase. Manual
   Generate controls must not enqueue, open, or otherwise initiate Carousel
   generation unless a new product decision explicitly restores that workflow.
6. When Trending reads an older current-profile batch with fewer than ten
   candidates, it invokes an authenticated, idempotent preparation endpoint to
   complete that same batch. This is automatic profile preparation, not the
   manual Generate-button workflow.
7. Legacy `test-user-001` rows are development data until audited. Do not
   migrate or delete them blindly. Any cleanup must first confirm they are not
   demo or seed content and must remove dependent rows/assets deliberately.

### 2026-08-03 Required Onboarding Context v1

- A saved business-profile row is no longer sufficient proof that onboarding is
  complete. Generation access requires persisted `onboarding_status =
  completed`, onboarding version 1 or newer, and a runtime completeness check
  against the stored context.
- Onboarding v1 collects only generation-critical context: B2B/B2C model,
  category or product type, primary audience, current problem, desired outcome,
  differentiator or mechanism, brand tone, and one or more campaign purposes.
  Team size, revenue, and user role are not part of this gate.
- Website, AI-IDE, and manual intake remain supported. Their normalized facts
  are merged with the owner's required onboarding answers before a new profile
  version starts automatic preparation. Existing `claimsToAvoid` are retained;
  onboarding does not create an approved numeric-claims system.
- Legacy profiles default to incomplete. Their existing category, audience,
  problem, promise, differentiator, and tone may prefill the form, but they are
  never marked complete unless every v1 area, including business model and
  campaign purpose, is present. Daily replenishment excludes incomplete
  profiles and also rechecks context completeness in application code.
- The primary Trending feed and format-preparation routes enforce the same
  server-side check and return HTTP 409 with `code = onboarding_required`.
  Client redirects improve navigation but are not the authorization boundary.

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
  broad matcher version, image safety policy, planner version, renderer
  version, and Geist font availability.
- LLM slide planner with one copy-repair pass and validated deterministic
  fallback. Generated rows store the raw initial/repair responses, normalized
  plan, planner version, actual model, source, fallback reason, validation
  result, and renderer version.
- Professional Sharp text renderer and AWS Carousel worker path.
- AWS Carousel worker revision 32 runs image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:worker-20260713184011`
  from task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:32`.
  Startup metadata reports git commit
  `5d604b9805ea6c875af6f44cf247c2ada1212f67`, planner
  `llm-carousel-planner-v16-solution-story-guard`, renderer
  `social-bubble-renderer-v11-hybrid-soft-union`, broad matcher
  `broad-runtime-matcher-v2` in `dry-run`, safety policy
  `object-only-no-human-v1`, and Geist Regular available at
  `/usr/local/share/fonts/geist/Geist-Regular.ttf`.
- Renderer `social-bubble-renderer-v11-hybrid-soft-union` preserves each
  measured line's safe `requiredWidth`. Imperceptible adjacent differences
  below 3px per side snap to the larger width. Small visible side changes use a
  vertically extended cubic transition with vertical tangents, while larger
  changes retain rounded shoulders. The visible bubble and containment mask
  use the same single connected SVG path. This does not change copy, wrapping,
  typography, padding, image processing, safe margins, or text placement.
- Fresh production canary `61b0edb4-0af2-44b0-9211-d1db40f9b1f3` completed on
  worker revision 32 with five new renderer-v11 CloudFront URLs. All five WebPs
  were visually inspected at 1080x1350. The exact reference sentence retained
  widths `542, 628, 636` and used transitions
  `rounded-shoulder, soft-curve, none`. CloudWatch diagnostics reported
  `escapedTextPixels = 0`, `textPixelContainmentPassed = true`, and no repair on
  slides 1 through 5.
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
  asset is now archived in production and cannot be selected. Its older
  `subject_review_status = approved` metadata still needs normalization to
  `rejected`, but the runtime exposure is closed because archived assets are
  ineligible.

## 2026-07-16 Production Feed and Renderer Audit

- The ten carousels surfaced in the first production feed contain 50/50 stored
  1080x1350 WebP render URLs. Five older source assets were visually found to
  violate the no-human rule even though their metadata said object-only. The
  exact five decisions are recorded in
  `scripts/data/fitness-health-production-feed-safety-review-2026-07-16.json`;
  all five assets are now archived, manually rejected, and marked as containing
  a faceless human so they cannot be selected again.
- One opened July 10 render showed body text escaping its white bubble. That
  generation predates renderer provenance and remains immutable evidence; do
  not overwrite its URL. The current/deployed
  `social-bubble-renderer-v11-hybrid-soft-union` validates the same bubble mask
  geometry against rendered text pixels, rejects any escaped pixel after one
  repair attempt, passes the connected-bubble and renderer regression suites,
  and rendered the latest five-slide canary with correct white bubbles.
- The white bubble fill is production behavior, not a test-only fallback.
  `highlight` is the automatic path. Although `plain` and `soft-gradient` are
  accepted API values, they are not yet visually distinct style systems;
  `soft-gradient` currently matches `highlight`, while `plain` only adjusts
  image brightness slightly. Do not advertise those values as materially
  different presets until they are deliberately designed.

Do not describe planned behavior as deployed behavior.

## 2026-07-27 GCP Media Delivery Cost Control

- The optional GCP media CDN/global external load balancer is disabled in the
  applied foundation state while the product is in testing. Terraform variable
  `enable_media_cdn = false` removed the two forwarding rules, HTTP and HTTPS
  target proxies, URL map, CDN backend bucket, managed certificate, and reserved
  global IP. This does not disable or remove any Cloud Run worker.
- `gs://ugcsaas-media` remains the storage source of truth and is still guarded
  by `prevent_destroy = true` and `force_destroy = false`. Testing-phase media
  remains publicly readable through
  `https://storage.googleapis.com/ugcsaas-media`; a post-removal byte-range read
  of a rendered Carousel returned HTTP 206 with `image/webp`.
- The production app and all four GCP workers already use the direct GCS public
  base URL, so removing the optional delivery layer does not change generated
  media keys or worker execution.
- `media.getugcpilot.com` still resolves to the released former load-balancer IP
  `8.233.40.78`. Treat that hostname as inactive and remove its stale DNS record.
  Do not use it in app or worker configuration.
- Re-enabling the custom media domain requires a separate reviewed change: set
  `enable_media_cdn = true`, apply Terraform, point DNS to the newly allocated
  output IP, wait for the managed certificate to become active, verify HTTPS,
  and only then consider changing the public media base URL.

## 2026-07-27 Carousel Image Migration Completion

- The production Carousel image migration acceptance boundary is the canonical
  Carousel source and output tables: `category_image_assets`,
  `carousel_slides`, `library_items`, and `library_carousel_slides`. Avatar and
  overlay catalogs, historical `background_jobs` payloads, test/E2E records,
  and unreferenced render objects are not part of Carousel migration
  completeness.
- A production database and GCS inventory audit verified 4,649 canonical rows,
  7,124 GCP URL references, and 6,998 unique referenced object keys. There are
  zero AWS URLs, zero missing GCS objects, and zero zero-byte objects in this
  scope. Public byte-range reads returned HTTP 206 with `image/webp` for a
  representative object from each canonical table.
- The AWS `category-library/` prefix contains 4,730 image objects and every one
  has the same key in `gs://ugcsaas-media`. The AWS `carousels/rendered/`
  prefix contains 2,093 image objects; 2,043 have the same key in GCP and the
  remaining 50 are not referenced by any canonical Carousel or Library row.
  Those 50 orphaned old renders are intentionally not being copied.
- No important canonical Carousel image exists only in AWS. A global
  all-media audit may still report AWS URLs from out-of-scope historical jobs,
  test data, or media systems scheduled for replacement; that is not evidence
  of a Carousel migration gap.

## 2026-07-28 Reviewed Slideshows Asset Import

- The flat source folder
  `C:/Users/chund/OneDrive/Desktop/slideshows` contained 72 readable images,
  zero corrupt files, zero exact duplicates, and zero perceptual near-duplicate
  groups. It had no provenance sidecar and included 17 already-cropped
  1080x1350 files without corresponding originals, so those files remain
  marked as cropped-only canonical sources.
- The durable per-file decision map is
  `scripts/data/slideshows-carousel-review-2026-07-28.json`. Final uncropped
  contact-sheet inspection approved 61 files and rejected 11. The second,
  larger visual pass caught `07-online-yoga-and-remote-wellness.jpg`, which
  contains a visible person on a laptop screen; it is rejected along with the
  ten previously identified person/hand images. Rejected files were not
  uploaded and have no `category_image_assets` rows.
- The 61 approved assets are mapped as follows:
  - Productivity SaaS: 15 `notes-and-planning`, 9 `workspace-objects`, and
    1 `phone-and-devices`.
  - Fitness Health: 14 `food-and-table` and 20
    `fitness-wellness-objects`.
  - Shared: 2 `home-lifestyle`, usable by Productivity SaaS, Fitness Health,
    Wellness, Beauty Skincare, and Generic Business.
- Each approved file now has a SHA-256 source hash and a perceptual hash.
  The local review-map pipeline fails closed if the map is not marked
  `final_full_resolution_review`, if any audited file is missing a decision, if
  a decision names an unknown file, or if a runtime category/broad-bucket/scope
  combination is invalid. The old whole-folder approval flag remains only for
  backward compatibility and cannot be combined with a review map.
- The import path now uses the configured storage abstraction and is explicitly
  guarded to GCP for this reviewed batch. It no longer hard-codes AWS SDK or
  CloudFront configuration. The existing `base_s3_key`, `thumb_s3_key`, and
  `source_original_s3_key` database column names remain unchanged for schema
  compatibility even though the objects live in GCS.
- On 2026-07-28, all 61 approved assets were uploaded to
  `gs://ugcsaas-media` and inserted into production
  `category_image_assets`: 25 Productivity SaaS, 34 Fitness Health, and
  2 Shared. All rows are `ready`, manually `approved`, `object-only`,
  `has_human = false`, `face_count = 0`, `person_count = 0`, and have no
  runtime exclusion reason. The import preflight found no matching storage
  keys, SHA-256 hashes, or perceptual hashes in production.
- Post-import verification found 61/61 matching production rows and successfully
  read all 183 public GCP objects: 61 originals, 61 normalized 1080x1350 WebP
  bases, and 61 320x400 WebP thumbnails. Metadata-only corrections can be
  safely re-applied with
  `scripts/sync-local-carousel-image-asset-metadata.mjs`; the command requires
  exact base-key and source-hash matches before updating a row.
- Relevance tags were validated against the production broad matcher rather
  than merely stored. Across 50 simulated candidate Carousels, all 25 new
  Productivity assets were selected at least once. In a Fitness-specific
  50-candidate audit, 33 of 34 new Fitness assets were selected, with selections
  from both `food-and-table` and `fitness-wellness-objects`. Both audits
  produced complete 6/6 selections with zero missing selection.
- An isolated GCP render canary read six newly imported production URLs—one
  from every imported category/bucket group—and rendered six valid 1080x1350
  Carousel slides. The output and report are under
  `.tmp/local-carousel-render-canary/2026-07-28T08-29-59-344Z`.
- Production `CAROUSEL_BROAD_MATCHER_MODE` remains `dry-run`. These assets are
  present, safe, and selectable by the broad matcher, but the legacy matcher is
  still authoritative for the user-facing feed. Do not describe the new local
  assets as live feed selections until a separately deployed, profile-scoped
  broad-matcher canary is verified.

## 2026-08-10 Power Folder Tagging Checkpoint

- The seven source folders under
  `C:/Users/chund/OneDrive/Desktop/slideshows/power` contain 594 readable
  images: finance 26, food 356, gym 33, marketing 9, outdoor/lifestyle 40,
  productivity 71, and beauty/skincare 59. The audit found 14 exact-duplicate
  groups, 19 perceptual near-duplicate groups, and an estimated 553 visual
  families.
- Folder names map to source slugs and runtime categories as follows:
  `finance` -> `personal_finance` -> Personal Finance; `food` ->
  `calorie_tracking` -> Fitness Health; `gym` -> Fitness Health; `marketing`
  -> Marketing SaaS; `outdoor_freedom_nature_walking` -> `outdoor_lifestyle`
  -> Shared; the misspelled `producitivity` folder -> `productivity` ->
  Productivity SaaS; and `skin` -> `beauty_skincare` -> Beauty Skincare.
- Compact contact sheets plus targeted full-resolution checks produced the
  durable rejection source
  `scripts/data/power-carousel-safety-review-2026-08-10.json`. The review
  rejected 87 supported candidates for visible or ambiguous human presence,
  including hands, arms, cropped bodies, background people, and people on
  printed material/screens. The audit rejected another 17 exact-duplicate
  files. All 594 audited files therefore have an explicit decision: 490
  approved and 104 rejected/skipped.
- Approved runtime inventory is local-only at this checkpoint: Beauty Skincare
  50 (8 clean texture, 16 home lifestyle, 26 product still life); Fitness
  Health 350 (321 food/table and 29 fitness objects); Marketing SaaS 7 (3
  data/screens and 4 phone/devices); Shared 18 (13 abstract/nature and 5 home
  lifestyle/cafe); Personal Finance 19 (11 notes/planning, 1 phone/device, 7
  workspace/shipping); and Productivity SaaS 46 (7 notes/planning and 39
  workspace objects).
- The approved manifest uses `local-curated-image-tags-v2`. Category defaults
  are intentionally narrow so, for example, shipping boxes do not inherit a
  generic `budgeting` match and outdoor cafes do not inherit `nature`.
  Whole-term rules attach literal objects and concepts such as `receipt`,
  `credit-card`, `grocery-budget`, `whiteboard`, `bench-press`, `serum`,
  `popcorn`, and specific social platforms. Per-file overrides cover opaque
  generated finance filenames and visually verified device types. A tag audit
  found no approved asset with fewer than four content tags or fewer than two
  object tags; repeated signatures inside homogeneous dish/vegetable packs are
  expected because the filenames contain only the dish/object family plus a
  sequence number.
- The final approved tag manifest is
  `.tmp/power-carousel-image-tags-approved-v2-final/2026-08-10T16-34-40-116Z/tag-manifest.json`.
  Its 490 approved assets were prepared locally in
  `.tmp/power-carousel-image-import-upscaled/2026-08-10T17-11-03-503Z` as one
  canonical asset each: preserved original, 1080x1350 WebP runtime rendition,
  and 320x400 WebP thumbnail. The package stores the source hash and a
  `source_metadata.rendition` record; its 99 lower-resolution sources retain
  their 0.64 quality score, original dimensions, and an
  `approved_with_low_resolution_source` rendition-review status. Upscaling does
  not reclassify these sources as natively high resolution.
- The local checkpoint passed for all 490 records: strict object-only safety,
  tags, runtime categories, hashes, object keys, and prepared image dimensions
  are valid. Remote structure preflight found four exact source hashes already
  present in `fitness-health` (two treadmills, spin bikes, and a plyo box), with
  no prepared base-key or perceptual-hash conflict. The importer treats those
  exact sources as idempotent skips, leaving 486 new canonical asset records to
  upload. Originals must never be deleted for this reason.
- The first explicit production import attempt reached the desktop command's
  ten-minute limit before returning and did not create `import-result.json`.
  A later recovery preflight confirmed that it inserted no new database rows.
  The resumed checkpointed import then inserted 486 new canonical asset rows
  and skipped the four exact existing source hashes, completing all 490
  manifest assets without duplicate rows.
- The importer now checkpoints every ten assets: it uploads the original,
  1080x1350 base, and thumbnail concurrently for each asset, inserts that
  checkpoint's rows, and writes resumable progress. A retry first skips any
  source hashes already inserted, while deterministic object keys safely reuse
  any files uploaded by the interrupted attempt.
- Production verification found 490/490 matching `category_image_assets` rows:
  Beauty Skincare 50, Fitness Health 350, Marketing SaaS 7, Shared 18,
  Personal Finance 19, and Productivity SaaS 46. It successfully checked all
  1,470 trusted GCP URLs (original, 1080x1350 base, and thumbnail) with zero
  missing or mismatched rows, safety fields, tags, storage keys, or objects.
  Reports are `import-result.json` and `post-import-verification.json` in the
  prepared package directory above. This Power-folder batch is now verified
  backend Carousel library inventory.

## 2026-07-28 Unified Trending Wall-of-text Decision

- Trending is one mixed Tinder-style feed containing preview-ready Carousel,
  Hook-video, and Wall-of-text ideas. Each format keeps its own Business
  Profile prompt and text schema; Carousel slide copy, Hook opener text, and
  Wall-of-text copy must never be reused interchangeably.
- A Wall-of-text preview is a reviewed platform background video plus
  Business-Profile-specific Wall copy and a fixed full-overlay layout. It does
  not include a product demo.
- One continuous Wall copy value is visible for the full native video duration.
  It has no separate headline, body, or closing fields. The background plays
  once and does not loop. Copy length is limited by visual fit, not by a
  reading-time calculation based on video duration.
- Wall source selection does not use motion level, readability score, text
  capacity, or recommended text position. A video must be an active reviewed
  9:16 Wall asset with one `visual_group`, one `source_batch`, and one unique
  SHA-256 hash. Selection spreads a candidate set across visual groups before
  reusing a group.
- The reviewed `videos_real` batch contains 51 unique approved videos and 15
  exact duplicate files that were rejected. The production catalog contains
  all 51 approved videos and thumbnails in GCP, with zero incomplete rows.
  The durable map is
  `scripts/data/wall-text-videos-real-2026-07-28.json`.
- The application worktree now includes the Wall provider, preparation route,
  full-overlay video card, and left-skip/right-select persistence. These
  user-facing code changes must not be described as live on the production
  domain until the application is deployed and the authenticated production
  flow is verified.

## 2026-08-02 Unified Trending Creative Decisions

- Trending uses the same review actions for every preview-ready Carousel, Hook
  video, and Wall-of-text card. The current reference layout places one labeled
  Edit pill at the top-right of the page header and centers two compact,
  circular, icon-only Reject and Accept buttons below the content card. Each
  icon-only decision has an accessible label and tooltip, while restrained
  error, neutral, and success treatments preserve meaning. This supersedes the
  earlier three-equal-labeled-buttons row. Left/right swipe, keyboard
  decisions, and the Reject/Accept buttons call the same client decision
  handler.
- Decisions are durable server records with the authenticated user ID,
  assignment ID, creative ID, format, `accepted` or `rejected`, and
  `decided_at`. The database function records the decision and retires the
  format-specific active assignment in one transaction. Identical retries are
  idempotent; a conflicting second decision fails closed.
- A decision animates first, then the card is optimistically advanced while
  persistence runs. One synchronous client lock prevents duplicate submission.
  If persistence fails, the prior card index is restored.
- Accept is a review decision, not publication. Carousel acceptance preserves
  the generated creative in an intermediate `accepted` assignment state and
  opens the existing save-or-schedule review flow. Only a successful later
  save or schedule moves it to `completed_saved` or `completed_scheduled`;
  Hook acceptance opens product-demo composition; Wall acceptance opens its
  focused final-review/render flow. The existing render, schedule, and publish
  workers remain separate downstream stages.
- Edit opens the format-specific Trending creative editor for the assigned
  creative. Saving persists an owner-scoped revision; Carousel saves wait for
  the revision-specific worker render before downstream Library use.
- Trending never renders non-ready cards. When no preview-ready item exists,
  the customer sees only "We’re preparing new content for you." The sidebar
  background-job indicator and the Trending render-progress/failure panels are
  removed from customer UI; job tables, polling, queues, workers, and backend
  logs remain unchanged.
- This implementation and its Supabase migration are local worktree changes.
  Do not describe the unified decisions as deployed or production-verified
  until the migration and application are deployed and the authenticated
  production flow is checked.

## 2026-08-02 Trending Creative Edit Persistence

- Trending edits are stored in the owner-scoped
  `trending_creative_edits` table. One row represents the latest revision for
  one assigned creative, and every content save clears prior render output.
  The editor submits its loaded revision, so a stale tab receives a conflict
  instead of overwriting a newer save.
  Source assets are resolved server-side and database validation requires a
  ready owner video (and current group membership for group selections).
- Carousel edits use the durable `render_trending_carousel_edit` background-job
  contract. The edit row is attached to the job before Cloud Tasks dispatch,
  and worker transitions are fenced by edit ID, owner, revision, and job ID so
  an older render cannot overwrite a newer edit.
- The Carousel worker reuses the production Sharp slide pipeline, preserves the
  normalized dragged X/Y anchor inside publishing-safe bounds, and uploads each
  revision under immutable content-hashed GCP keys. It reloads the original
  generation job's persisted text style so editing copy or position does not
  change the Carousel design. Render output preserves
  both the public URL and storage key for every slide.
- The Carousel editor previews the clean source background with a live inline
  SVG white-bubble treatment instead of showing the already-flattened rendered
  slide or a plain-text substitute. The worker remains the authority for final
  wrapping, containment, safe-bound clamping, and exported pixels. Supporting
  text takes precedence over CTA text, matching the production renderer.
- Saving a Carousel to Library uses the latest edit when one exists. A queued,
  rendering, draft, failed, incomplete, or non-GCP edit is rejected rather
  than silently saving the original. A ready edit refreshes the existing
  generated-Carousel Library item and its ordered slides, including edited
  copy and normalized placement metadata.
- Hook and Wall downstream save paths resolve saved edit content and selected
  source on the server. Hook combination renders carry the normalized text
  anchor. Wall render claims include edit ID/revision so a previously ready
  render cannot mask a newer Wall edit.
- These schema, app, and worker changes are local worktree changes. Do not call
  them deployed or production-verified until the migration and worker/app
  revisions are deployed and the authenticated production flow is checked.

## 2026-08-12 Staged Carousel Architecture Rollout

- The Carousel content planner and renderer continue to run inside the existing
  authenticated `ugc-carousel-worker` Cloud Run service. This rollout does not
  create a second background worker or a parallel text-generation pipeline.
- Production canary validation exposed and corrected a sparse-profile
  deterministic-fallback defect in the Resource Collection format. Planner
  `llm-carousel-planner-v23-semantic-resource-copy` now builds a
  de-duplicated evidence-backed resource pool and fills any remaining slots
  with generic reference types, so the three middle slides always contain six
  distinct resources even when onboarding provides only a few unique options.
  Its repetition validator also retains meaningful compact terms such as
  `AI`, `UI`, and `UX`; this prevents a short resource list from being falsely
  classified as a duplicate after its distinguishing acronym is discarded.
  Evidence labels are converted into explicit topic guides and goal checklists
  instead of rendering raw tags or clipped problem sentences as though they
  were resources. Near-duplicate fallback labels are removed. Planner parsing
  and strict JSON schemas cap list items at 44 characters to match the
  renderer's one-line checklist contract.
- Broad matcher `broad-runtime-matcher-v3` normalizes hyphens and underscores
  before whole-term tag comparison, supports simple singular/plural matches,
  and considers the best reviewed asset-tag match while selecting the target
  broad bucket. This is required for literal tags such as `social-media`,
  `video-marketing`, `youtube`, `tiktok`, and `instagram` to influence runtime
  selection instead of merely being stored as metadata.
- `CAROUSEL_BROAD_MATCHER_MODE=dry-run` remains the global production default.
  Exact comma-separated IDs in
  `CAROUSEL_BROAD_MATCHER_CANARY_BUSINESS_PROFILE_IDS` or
  `CAROUSEL_BROAD_MATCHER_CANARY_USER_IDS` may promote only matching dry-run
  generations to effective `enabled` behavior. An explicit global `off` mode
  cannot be overridden by either allowlist.
- The worker logs configured mode, effective mode, canary match source, matcher
  version, and the broad-versus-legacy comparison. This makes a profile-scoped
  canary auditable without changing every Carousel generation.
- Production-catalog simulations passed for Marketing SaaS, Productivity SaaS,
  and Fitness Health. The Marketing social-platform sample selected four
  reviewed Power-folder assets, Productivity selected four, and Fitness
  selected five, with zero missing selections or unsafe duplicate reuse.
- The staged production canary completed successfully as background job
  `6a38b5a2-82e4-4169-9ce2-cacb2b153933` and generation
  `873f4005-5813-4774-a036-1cba6805e11d`. The existing worker generated and
  persisted five 1080x1350 slides. Visual containment checks reported zero
  escaped text pixels, all rendered URLs returned HTTP 200, no human imagery
  was selected, and no image was reused. Three slides used reviewed local
  assets, including `power/food/toast_03.jpg`; the remaining two used eligible
  Pexels object imagery.
- The production LLM planner attempted its normal generation and repair path.
  Because that response failed strict content validation, the same worker used
  the v23 deterministic fallback. The rendered fallback remained semantic,
  de-duplicated, and within the renderer's one-line resource limits. This is
  the intended fail-safe behavior, not a separate text-generation flow.
- Final production revision
  `ugc-carousel-worker-carousel-v23-final-653843d` receives 100% of Carousel
  worker traffic. It uses image digest
  `sha256:7af8dec75bac452a9617a96a4d7c49591d35e14e55477e8806ed3d8f93f95ca2`
  from commit `653843d0c75556df7264142e456df1b55974b8bd`. Startup logs verify planner
  `llm-carousel-planner-v23-semantic-resource-copy`, broad matcher
  `broad-runtime-matcher-v3`, renderer
  `social-bubble-renderer-v11-hybrid-soft-union`, object-only/no-human safety,
  OpenAI configuration, Cloud Tasks transport, and the exact commit.
- The temporary canary business-profile and user allowlists were removed after
  acceptance. Global `CAROUSEL_BROAD_MATCHER_MODE=dry-run` and
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true` remain in production. Enabling the
  broad matcher globally remains a separate product rollout decision.
- The production web environment points `GCP_CAROUSEL_TASK_URL` at the internal
  `ugc-carousel-worker` Cloud Run service and uses the `ugc-carousel` queue in
  `us-central1` with `QUEUE_PROVIDER=gcp`. The public production root and
  `/status` route both returned HTTP 200 after their canonical-domain redirect.

## Next Implementation Slice

Name: **Decide the broad-matcher rollout cohort**

1. Keep `CAROUSEL_BROAD_MATCHER_MODE=dry-run` and
   `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true` until a rollout cohort is
   explicitly approved.
2. Review broad-versus-legacy shadow telemetry across representative business
   profiles and content grammars, not only the completed Fitness Health canary.
3. If a beta is approved, use an explicit profile/user allowlist first and
   verify complete production outputs before expanding it.
4. Treat global `enabled` mode as a separate product and deployment decision;
   do not infer it from the successful scoped canary.

## Working Rules

- Make one behavior change per slice and validate it before deployment.
- Keep API routes thin; heavy generation belongs in authenticated GCP Cloud Run
  workers.
- Never use Supabase Edge Functions for Sharp rendering.
- Never make unreviewed assets selectable.
- Never silently fall back to an unrelated category.
- Never trim approved surplus assets.
- Never claim GCP worker behavior changed until the deployed revision is
  verified.
- Never overwrite a rendered Carousel asset behind an immutable URL. Rendered
  keys must change when either the renderer version or output bytes change.
- Keep the production Carousel worker font files in sync with the font family
  used for text measurement and SVG rendering.
- Update this file whenever a product rule or architecture decision changes.

## 2026-08-08 Shared-Browser Account Isolation

- Owner-created Carousel, schedule, and editable-video records must never use a
  global browser-storage collection as a source of truth or fallback.
- Carousel Library reads only the authenticated owner's server Library.
  Scheduling reads only owner-scoped `scheduled_posts`, and video editing reads
  and writes only through the authenticated edit APIs.
- Legacy global browser records are never read, imported, or automatically
  migrated. Their records do not contain a trustworthy owner ID, so automatic
  migration could copy User A's data into User B's account on a shared browser.
  On app load, an exact cleanup removes only the retired Carousel Library,
  schedule-draft, and editable-video keys. Owner-scoped server records and
  unrelated browser preferences are untouched.
- The application query provider is keyed by the current Firebase UID. A user
  change remounts the authenticated application subtree and creates a fresh
  query cache, preventing one account's in-memory page state from carrying into
  the next account.
- Onboarding goal selections autosave to the incomplete owner-scoped business
  profile without marking onboarding complete or changing the profile version.
  Final completion still validates at least one goal and applies the selected
  goals to generation context in one explicit action.

## 2026-08-02 Creative Assets Saved Collection and Scheduling UI

- Creative Assets now exposes a `Saved` tab beside Videos and Images. It is a
  unified customer surface over the existing owner-scoped Carousel, Hook, and
  Wall-of-Text stores; it does not duplicate rendered media or introduce a
  second source of truth.
- Trending save confirmations for all three formats link to
  `/avatars?tab=saved`. Existing saved creatives appear automatically because
  the tab reads the established Library and saved-draft APIs. Repeated saves
  keep the existing idempotent behavior of each format.
- A saved Hook is identified as a composition until the downstream scheduling
  render combines it with the selected footage. Carousel and Wall-of-Text keep
  their existing rendered/preparing states.
- Scheduling account rows now display the backend-provided
  `profilePictureUrl`, with the platform icon as an image-load fallback. The
  same shared avatar is used by Carousel, Hook, and Wall-of-Text scheduling.
- The Carousel scheduling dialog uses fixed header, scrollable-content, and
  footer grid rows. The content no longer forces a minimum height, so the Back
  and Next controls remain visible on shorter screens.
- The Carousel scheduling header is text-only and does not repeat the
  Instagram logo. Publishing-account rows still show the selected account's
  real profile picture because that identity is actionable confirmation.
- These UI changes are production-build validated locally. They are not
  deployed or authenticated-production verified yet.

## 2026-08-03 Content Library Demo-Footage Boundary

- The visible `/library` Content Library is dedicated to reusable demo footage.
  Its duplicate Carousels tab is removed, and legacy `?tab=content` links now
  resolve to the demo-footage view.
- Saved Carousels remain available under Creative Assets > Saved through the
  existing `CarouselLibraryTab`. Carousel storage, save APIs, preview,
  scheduling, publishing, and deletion behavior are unchanged.
- This is a frontend navigation and presentation decision only. It does not
  remove Carousel records, routes, workers, or the Library-backed scheduling
  source of truth.
