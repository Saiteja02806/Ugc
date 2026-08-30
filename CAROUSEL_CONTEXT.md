# Carousel System Context

Last updated: 2026-08-29

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

### 2026-08-23 complete daily-pack delivery and Free allowance

Free receives exactly 10 combined posts per user-local day and defaults to
3 Slideshows, 4 Wall-of-text posts, and 3 Hooks until the user saves another
valid mix. Free, Starter, and Growth may all adjust the percentage balance;
each format may range from 0% to 100%, and all three percentages must total
100%. Starter remains 20 posts and Growth remains 50 posts.

Migration `20260823130857_raise_free_trending_allowance.sql` raises the
persisted Free entitlement to 10. If a smaller feed was already created for
the current day, the planning RPC appends the newly entitled slots, updates the
feed snapshot, and resumes preparation instead of leaving that user at the old
allowance until tomorrow. Existing ready or decided positions are preserved.

Carousel, Wall-of-text, and Hook preparation are dispatched as independent
background work. `GET /api/trending/feed` uses a read-only request fast path:
it reads the existing plan and ready provider rows, returns the current public
state without creating rows or enqueueing work in the request, and schedules
the idempotent/coalesced preparation boundary with Next.js `after`. The first
two preparation polls use a two-second interval, then back off through 3.5 and
6 seconds to a ten-second maximum; a hidden tab does not poll. This avoids both
the former request-time orchestration delay and a fixed tight polling loop.

The unified feed exposes preview-ready assignments while unresolved format
slots continue in background work, so Carousel, Wall-of-text, and Hook results
may enter the review queue at different times even though their preparation is
dispatched concurrently. The client distinguishes the number of cards ready
now from the complete number of daily content pieces still remaining. One
Carousel card occupies exactly one daily feed slot regardless of whether that
Carousel contains five or another supported number of internal slides; slides
must never be counted as separate daily posts. The blank dark 9:16 skeleton is
used only when no preview-ready assignment is available yet.

After a response includes preview-ready items, left and right swipes only
dismiss the current in-memory item and select the next in-memory item. Swipe
completion no longer waits for the decision API or refreshes the feed. Decisions enter an
account-scoped browser outbox first, are retried in the background with bounded
backoff, and are filtered from a reload while still pending. The server remains
the durable source of truth and its idempotent decision route still retires the
daily slot without replenishment.

The browser no longer calls the format-specific Hook or Wall preparation
routes from the Trending workspace. `readUnifiedTrendingDailyFeed` is the
request-time reader; `ensureUnifiedTrendingDailyFeed` is the single deferred
orchestration boundary for recovery, attachment, preparation, and readiness.
A terminal enqueue/provider failure is persisted as feed state `failed` so the
next read offers a retry instead of polling a skeleton forever.

The next two mounted deck cards prewarm their presentation assets. Protected
Hook preview cookies are keyed by video ID, allowing multiple upcoming Hook
sessions to coexist; inactive Hook videos preload without playing and become
active without requesting a new generation or feed response. Carousel images
and Wall video metadata retain their existing look-ahead preload behavior.

Hooks are part of the daily entitlement and are enabled when
`TRENDING_HOOK_VIDEOS_ENABLED` is true or absent. An explicit false value is an
emergency kill switch; it is not the normal production configuration.

The Trending-wide Adjust button opens the authenticated content-mix API for
Free, Starter, and Growth. The header control on an active card remains Edit.
Inside the accepted Hook composer, “Adjust opening clip” changes only the
opening video's start and end times; it does not change the daily content mix.
Saving any content-mix preference never mutates an already-created daily pack,
including its unbound positions. If today's pack exists, the preference
starts with the next local-day pack; if no pack exists yet, it is used to create
today's pack. This immutable boundary avoids discarding or duplicating work
while an atomic pack is still preparing.

Free's runtime allowance is fixed at 10 even if the entitlement row is briefly
stale during a migration-first rollout. The database migration remains required
to expand an already-created three-slot feed and keep persisted plan metadata
consistent.

The complete-pack reliability path has these format-specific safeguards:

- a preview-ready active Wall assignment is returned before old Wall creative
  inventory is checked for a stale generator version; historical v6 rows must
  not hide a current v7 assignment;
- the internal Wall preparation route accepts the immediately previous worker
  payload by defaulting a missing requested count to six and deriving the same
  stable legacy request key as the worker, so app/worker rolling deployments do
  not turn valid jobs into HTTP 400 failures;
- Hook generation requests at least six source candidates and may persist the
  validated subset when one candidate exhausts review and repair. A later
  idempotent refill fills any remaining Hook slot instead of failing the whole
  batch because one source was rejected; composition generation still requires
  its complete candidate contract;
- Structure 1 remains fail-closed and atomically transfers an untouched batch
  to Structure 2 after two planning failures. Structure 2 uses its dedicated
  LLM batch plus one isolated LLM repair for a structurally invalid item. If
  that repair still fails the publishing contract, the batch fails; it never
  substitutes authored runtime story copy.

Hook and Wall preparation share the AI-generation Cloud Tasks queue but are
independent jobs. The queue permits four concurrent deliveries, and the Cloud
Run AI-generation service may scale to four one-request instances so those
formats are not serialized behind one another or behind an unrelated AI job.
Carousel keeps its separate controlled-batch queue and worker boundary. Every
Cloud Run worker profile sets an explicit worker ID containing service name,
release version, and Git commit so a failed `background_jobs` row identifies
the deployed revision instead of an ambiguous container hostname.

### 2026-08-20 unified combined-feed architecture

The source implementation now treats Carousel as one format inside a single
persisted daily Trending allowance alongside Wall-of-text and Hook Video. This
is a source decision and must not be described as deployed until migration
`20260820084842_create_unified_daily_trending_feed.sql`, the Next.js release,
and the background workers are verified in production.

The stable billing keys are intentionally retained while their visible plan
names and combined daily limits change:

- no active paid-plan row -> **Free** -> 10 combined posts per user-local day,
  fixed at 3 Slideshow / 4 Wall-of-text / 3 Hook;
- `pro` -> **Starter** -> 20 combined posts per user-local day;
- `creator` -> **Growth** -> 50 combined posts per user-local day;
- `ultra_pro` remains an inactive legacy entitlement and is not assigned to
  new users.

Do not migrate existing user plan keys merely to make the labels appear more
intuitive. Runtime entitlement resolution and pricing display must use the
exact mapping above.

The paid-plan default daily mix is 25% Carousel, 50% Wall-of-text, and 25% Hook Video.
Each format may range from 0% to 100%; all three integer percentages must total
exactly 100%. Largest
remainder allocation produces whole posts. Starter therefore receives
5 Carousel / 10 Wall / 5 Hook by default. Growth receives
13 Carousel / 25 Wall / 12 Hook. Keeping the half-post remainder on Carousel
allows the default Hook allocation to fit one validated twelve-candidate worker
batch instead of serializing a second AI job for one slot; the total remains 50.

Migration `20260820084842_create_unified_daily_trending_feed.sql` adds:

- `subscription_entitlements.daily_trending_limit`;
- server-only `trending_content_mix_preferences`;
- one `daily_trending_feeds` snapshot per `user_id + local_date`;
- exactly 10, 20, or 50 ordered `daily_trending_feed_slots` rows; and
- service-role-only planning, assignment, mix-save, unbound-replan, and slot
  completion RPCs protected by advisory locks.

The slot list is the cross-format source of truth. Slots are allocated and
interleaved before content is attached, so the frontend must order by the
persisted slot position rather than grouping formats into blocks. Only a ready
assignment may attach to its matching reserved format. Assigned or decided
slots are immutable for that day.

A successful left or right decision retires exactly one reserved slot. It must
never create a replacement on the same local day. After all 10, 20, or 50 slots are
decided, the correct state is caught up until the next local day. Background
preparation fills only still-unbound slots; it is started during onboarding,
the daily sweep, an Adjust save, or safe GET recovery, and it must never clear
already visible items.

The content-mix API stores owner-scoped preferences for every plan separately.
Once a daily pack exists, saving a new mix does not replan any of its positions, including
`planned` or `failed` unbound slots. The preference applies on the next local
day. A saved 0% for a format does not hide that format's posts that are already
reserved today.

The older `daily_carousel_feeds` and `daily_carousel_feed_items` tables remain
an internal Carousel inventory source during this migration. They are not the
user's combined daily limit and must not control visible cross-format ordering.
Their internal ceiling may be raised when a Growth allocation needs 12 or 13
Carousel assets, but surplus inventory is not exposed outside the unified
slots.

The remainder of this section documents the older Carousel-only feed layer and
its still-relevant inventory, completion-evidence, worker, and rollout rules.

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

1. recover only an assignment already created for that same date but not yet
   attached because an earlier request stopped between durable writes;
2. assign already-ready, unassigned eligible inventory;
3. count viable unassigned processing inventory; and
4. reserve and enqueue only the remaining shortfall to the persisted daily
   limit.

Examples for a daily limit of ten:

- ten completed yesterday -> generate ten for the new day;
- five current-day assignments already attached -> generate five;
- no current-day assignments -> generate ten.

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
(`gpt-4o-mini`, pinned in source for both Structure 1 and Structure 2) to create
structured slide content and visual intent. A stale deployment model variable
cannot silently split the two Carousel writers across models.
Worker startup metadata records the planner mode/version and whether the OpenAI
secret is configured. This proves runtime capability, not a successful model
call; acceptance of a generated carousel must also verify its persisted
planner source/model provenance.

The planner supports varied text modes rather than forcing a headline and body
on every slide. Rendering is performed with Sharp in the worker. Text must be
rendered into the final image with measured typography, safe wrapping, fixed
44px type, proper padding, and no heading-pill overflow. Adaptive font sizing is
reserved for Wall-of-Text and must not be introduced into either Carousel
structure.

Balanced carousel copy rules:

- A heading or hook is optional. When present, it must be 3-16 words, at most 100
  characters, use no more than four visual lines, and must not be forced into a
  single line by over-shrinking.
- Slide 1 supporting content must be one complete sentence of 8-40 words, at
  most 240 characters, and fit within eight visual lines. Supporting content
  on Slides 2-5 may use 8-50 words, at most 300 characters, and must fit within
  ten visual lines. Each body explains one specific idea and avoids repeating
  the heading. List items may use up to two visual lines each, with an
  eight-line total group cap.
- Previously generated legacy rows without a reserved content format retain
  their stored five-slide Hook, Problem, Consequence, Solution, and Result/CTA
  story for read/edit compatibility. The planner no longer creates that legacy
  story. New automatic Trending rows use the exact five roles defined by their
  reserved V1 content format, while retaining the existing coarse slide types
  for renderer and matcher compatibility.
- The renderer is the final source of truth for line limits. It must wrap using
  the production font stack, actual font size, available width, padding, and
  card dimensions, then keep headings to at most four rendered lines, Slide 1
  body text to at most eight rendered lines, and body text on Slides 2-5 to at
  most ten rendered lines.
- A headline and its supporting copy remain two distinct text groups. Structure
  1 and Structure 2 both render every visible group as ordinary white SVG text
  directly on the image. Neither structure receives a white SVG background.
- Both structures retain measured wrapping and safe-area containment with
  fixed-size white type plus a restrained dark outline/shadow for legibility.
  Never shrink, truncate, add an ellipsis, or substitute fallback copy.
- JSON/schema validity, the backend-selected format, exact slide order and
  roles, required fields, renderer character limits, product timing, prohibited
  visual subjects, and unsupported/prohibited claims are publishing gates.
  A failing item may receive one isolated LLM repair; a second failure remains
  failed instead of receiving hardcoded replacement copy.
- Word-count minimums, perspective quality, CTA phrasing, generic wording,
  grammar style, headline/body overlap, and recent repetition remain prompt
  guidance and persisted advisory diagnostics. Structure 1's absolute body
  maximum is a publishing gate: 40 words on Slide 1 and 50 words on each of
  Slides 2-5. These rules do not rewrite accepted AI copy.
- The application does not run a hardcoded post-LLM copy normalizer. Accepted
  headline, body, list, story, and CTA strings are preserved apart from the
  whitespace normalization required to parse and render their JSON fields.
- Object-only safety validation treats clock and watch hands as object parts,
  while continuing to reject human hands and other prohibited human subjects.
- Unsupported-claim validation rejects unsubstantiated quantified social proof
  and money/revenue/profit/sales/conversion outcomes, plus CamelCase product or brand
  names that do not appear in the stored website analysis.
- CTA commands that introduce a capitalized product name must use a name found
  in the analysis. `businessName` remains authoritative for named products and
  quantified social proof remains an unsupported-claim blocker when the saved
  analysis does not support it.
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
  normal LLM request creates one complete carousel. A single LLM repair request
  is allowed only when the first result fails a publishing gate. The writer
  never falls through to authored runtime copy.
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
  compact topic label. Repetition remains a selection and writing signal, and
  is persisted as an advisory diagnostic rather than replacing usable AI copy.
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
- Pending generations use one dark 9:16 post skeleton in the exact first-card
  position. The skeleton has no readable placeholder content, no slide dots,
  and no Carousel stack. It uses a restrained pulse and is replaced in place
  by the first preview-ready item. Never render one lifecycle card for every
  pending candidate. Failed candidates use one aggregate retry state rather
  than a wall of repeated failure cards.
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
4. Product demos come only after a right swipe, from the caller's Content
   Library or a new owner upload saved into that Content Library. The durable
   Content record is `demo_videos`; its ready `media_assets` row with
   `source_type = demo_upload` is an internal composition projection, not
   Creative Assets membership. The first screen shows only `Upload demo video`
   and `Choose existing`; Content demos are fetched and displayed only after
   the user opens the existing-demo picker. Selecting or uploading a demo moves
   a prefilled Trending Hook directly to Review. Save and Schedule remain final
   composition actions.
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
8. Hook ideas are part of the daily Trending allowance. The server-only
   `TRENDING_HOOK_VIDEOS_ENABLED` variable may be set to `false` as an emergency
   kill switch; `true` or a missing value keeps Hook preparation enabled.

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
- LLM slide planner with one structurally scoped LLM repair pass and no
  published hardcoded copy fallback. Generated rows store the raw initial/repair
  responses, normalized plan, planner version, actual model, source, fallback
  reason, validation result, and renderer version.
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
- Trending never renders non-ready cards. When no preview-ready item exists and
  generation is active, the customer sees one dark 9:16 post skeleton in the
  first real-card slot with no preparation copy or Carousel-style placeholder
  details. The sidebar background-job indicator and the Trending
  render-progress/failure panels are removed from customer UI; job tables,
  polling, queues, workers, and backend logs remain unchanged.
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

## 2026-08-13 Repetition Repair and Broad-Matcher Release

- A production assignment created after the v23 rollout proved that the new
  selector and renderer were live, but its visible result still resembled the
  old architecture. The LLM repair repeated a recent angle and the repair
  prompt did not include the recent-history evidence. Strict validation then
  rejected the repair and restored the older generic deterministic copy. At
  the same time, the broad matcher ran only in `dry-run`, so the renderer used
  the legacy image selection even though v3 proposed reviewed local assets.
- Planner `llm-carousel-planner-v25-format-aware-fallback` supplies normalized
  recent history to the repair request, permits a repair to select a different
  saved audience/problem/goal/topic combination when repetition caused the
  failure, and requires all five slides to be rebuilt rather than paraphrasing
  the rejected story.
- The grammar-aware deterministic safety path now rotates through saved,
  evidence-backed strategy combinations, rejects recent topic/hook/angle
  repetition, and writes distinct five-slide copy for the reserved content
  format. The July generic copy remains only for legacy/manual inputs that do
  not carry a reserved V1 format and compatible hook family.
- Global `CAROUSEL_BROAD_MATCHER_MODE=enabled` is now the release decision.
  Object-only/no-human review, approved-asset status, per-generation duplicate
  prevention, and disabled category fallback remain mandatory. The canary
  allowlists stay empty because global enabled mode does not need them.
- The first v24 production canary exposed two release blockers and traffic was
  returned to the verified v23 revision before changing any customer
  assignment. An action-led topic was shortened into the awkward phrase
  `Speed up meal`, and generic fallback image directions such as `clean
  premium` and `product-forward` outweighed the nutrition copy and routed
  three slides to shared skincare/product-still-life assets.
- v25 converts action-led topics into complete headline noun phrases (for
  example, `Speed up meal logging` becomes `meal logging`). Broad matcher
  `broad-runtime-matcher-v4` excludes the six exact generic slide-plan image
  directions from semantic routing while retaining specific LLM image
  directions. Visible headline/body/list/CTA copy remains authoritative, so a
  nutrition Resource Collection routes to food-and-table assets instead of
  unrelated skincare packaging. Matching app and worker regression checks
  enforce that boundary.
- This change continues to use the existing authenticated
  `ugc-carousel-worker` Cloud Run service. It does not create a new Carousel AI
  worker or a parallel text-generation pipeline.
- Replacement visual QA then exposed a separate compatibility defect before
  the customer feed was changed. V1 body-only and takeaway slides intentionally
  have no headline, but `carousel_slides.headline` is a legacy non-null column.
  The worker promoted the body into that column and also persisted the same
  body as `subtext`, so downstream edit/read flows could receive duplicate
  visible copy even though the flattened renderer drew the sentence once.
- Planner `llm-carousel-planner-v26-specific-fallback-copy` and the matching
  persistence adapter are the corrective architecture. The adapter promotes
  body-only copy into the legacy headline column but clears a normalized-equal
  subtext. The deterministic Examples and Resources safety paths now describe
  the saved topic and customer goal directly instead of repeating abstract
  phrases such as `current routine` and `supporting context`. Resource evidence
  prioritizes specific multi-word profile facts, rejects weak standalone labels
  such as `AI` or `support`, and uses semantic similarity that permits a
  distinct guide and checklist without admitting near-duplicate resources.
  Regression tests cover all 15 V1 grammars, compact resource evidence,
  repetition avoidance, and persistence-level copy deduplication.
- Do not mutate or overwrite the rendered URLs of the affected assignment.
  Once v26 is deployed and a replacement has completed production validation,
  retire the stale assignment and expose the new generation through the
  existing assignment/feed records.
- v26 production validation completed from Cloud Build
  `7a5b6a13-a895-40a8-a4ab-a4220022f834`. Image
  `carousel-v26-65ab455` has digest
  `sha256:62da0d886a051f5bde8713e628b237a006537cfd6eebfe427cf83a0579c05215`
  and source commit `65ab455ad75848d370718c0a382b04018467da86`.
  The isolated deterministic canary generated customer replacement
  `5505987f-735f-4b95-a562-8e6272baa00a` through background job
  `cc233321-76a1-4a19-ae58-ebd426979a2a`.
- That replacement contains five distinct approved object-only assets, all
  five immutable WebP URLs returned HTTP 200 at 1080x1350, the v4 broad
  matcher selected `food-and-table` on every slide, and the renderer reported
  zero escaped text pixels on all five slides. Manual contact-sheet review
  confirmed coherent nutrition imagery, specific six-resource copy, and no
  duplicated persisted headline/subtext on its body-only takeaway.
- Final production revision `ugc-carousel-worker-carousel-v26-65ab455` now
  receives 100% of Carousel worker traffic. Temporary v25 replacement and v26
  canary tags were removed. Startup logs verify normal `llm` planner mode,
  planner `llm-carousel-planner-v26-specific-fallback-copy`, global broad
  matcher `enabled` with `broad-runtime-matcher-v4`, and the exact source
  commit above.
- The final feed-assignment redirect was not performed in this release step:
  the managed approval service timed out on the guarded Supabase mutation and
  its permitted retry. The customer feed therefore remains on assignment
  `9d8d9d58-9317-49d0-85d3-1f6e889dec3b`; no original generation or rendered
  asset was deleted or overwritten. Re-audit edits, Library saves, and
  Trending decisions before retrying the idempotent redirect.

## 2026-08-13 Carousel V1-Only Generation Guard

- At that release, the supplied Carousel architecture used one current
  Business Profile, backend selection of one of 15 five-slide formats and one
  compatible hook family, one compact history snapshot of at most ten prior
  Carousels, strict validation, and a validated deterministic safety fallback.
  The per-Carousel request boundary described in this original guard was
  superseded by the controlled five-Carousel batch decision below, and the
  deterministic publishing fallback was later retired by the 2026-08-23 copy
  preservation decision.
- Every Carousel still begins with one hook. Diversity means rotating the
  backend-selected hook family and writing fresh wording; it does not mean
  producing a Carousel without a hook.
- New Carousel rows may now be created through the automatic Business Profile
  and daily-inventory preparation path only. The old authenticated
  `POST /api/carousel/generate` and `POST /api/carousel/generate-more` routes
  return HTTP 410 with `carousel_manual_generation_retired`; they no longer
  create rows or enqueue jobs. This enforces the earlier product decision that
  Trending is automatic and has no manual Generate workflow.
- The application database creation boundary now requires a Business Profile
  ID, exact profile version, V1 content assignment, and
  `generation_source = auto_generated`. A TypeScript caller cannot create an
  unassigned legacy generation through that function.
- Planner `llm-carousel-planner-v28-controlled-five-carousel-batch` fails before any LLM
  or deterministic writing when a request is not exactly five slides or lacks
  a valid compatible format/hook-family assignment. The legacy generic planner
  prompt and the generic fitness/business fallback are no longer part of the
  active writer. Existing stored legacy Carousels remain readable and are not
  deleted, rewritten, or re-rendered.
- Compact recent history is present in the initial prompt and is now also
  present in every repair prompt when history exists, even when the first
  validation failure was not itself classified as repetition. The later
  2026-08-23 decision keeps repetition advisory and does not use fallback copy.
- The deterministic V1 behavior described by this historical release remains
  only as legacy compatibility/test code; active publishing calls fail closed.
- Validation telemetry now distinguishes `fallbackUsed` from `repaired`. A
  deterministic fallback records `fallbackUsed = true` and `repaired = false`;
  a successful LLM repair records the inverse. This prevents quality reports
  from presenting fallback output as a successful AI repair.
- These V1-only route, application, planner, test, and documentation changes
  are local source changes. They require the database migration, normal
  application and Carousel worker release, plus an authenticated production
  canary before being called live.

## 2026-08-13 Controlled Five-Carousel Format Testing

- The existing stable format IDs remain canonical. They are not renamed to
  numbered IDs. Every format definition now stores an integer `rotationOrder`
  from 1 through 15 and an integer `version` (currently 1).
- A controlled experiment batch always contains exactly five Carousel slots.
  Batch sequence 0 attempts rotation positions 1-5, sequence 1 attempts 6-10,
  and sequence 2 attempts 11-15. Later cycles rotate both the first group and
  the positions inside each group to reduce timing and position bias.
- Rotation state is durable per Business Profile. The application reserves
  `carousel_experiment_batches` through one advisory-lock-protected database
  transaction before creating generation rows or asking AI for text. Failed,
  deleted, or skipped output never rewinds the monotonically increasing batch
  sequence.
- Each reserved batch persists five normalized
  `carousel_experiment_assignments`. It records the originally assigned
  format, format version, selected compatible hook family, actual generated
  format, replacement origin, linked generation, and lifecycle status.
- New generation rows link to their experiment batch and assignment and store
  both `content_assigned_format_id` and the actual `content_format_id`, plus
  `content_format_version`. The actual ID is authoritative for rendering,
  history, and later performance evaluation.
- Hook families rotate deterministically within each format's compatible
  family list. The selector uses persisted/recent attempts for that format; it
  does not choose families or formats using a pseudo-random seed score.
- One `generate_carousel` background job now owns one experiment batch and one
  initial structured AI request returns all five Carousel plans. The request
  receives only the five required format definitions, their assigned hook
  families, saved business context, compact recent history, and normalized
  saved analysis for evidence validation.
- Every returned Carousel is parsed and validated independently. A broken item
  receives one small isolated repair request; the other four accepted items
  are never regenerated by that repair.
- The AI may return `not_applicable` for a slot only when the saved context
  cannot honestly support that format. The worker deterministically reuses an
  already applicable format and hook family from the same batch, asks only for
  that one replacement Carousel, still returns five outputs, and persists the
  repeated format as the normal actual `content_format_id`. It never mutates
  the saved Business Profile to make a format fit.
- Recent history remains compact and capped at ten. It now includes the stable
  audience ID alongside hook, topic, angle, format, and hook-family fields;
  full prior slide copy is not sent.
- Daily inventory deficits are rounded up to a whole five-item experiment
  batch, capped at 50, so an initial text request is never split into fewer
  than five Carousel outputs.
- Experiment tables enable RLS, expose no `anon` or `authenticated` access,
  and explicitly grant only the server `service_role` the required Data API
  privileges. This accounts for Supabase's 2026 explicit-grant behavior for
  new public tables.
- Performance weighting now extends this controlled rotation through the
  bounded learning decision below. Generated, accepted, saved, scheduled,
  published, and evaluated remain separate concepts; only a comparable
  evaluated publisher snapshot may change a later selection multiplier.
- This architecture is implemented and production-build validated locally.
  Migration `20260813110309_add_controlled_carousel_experiment_batches.sql`,
  the application, and the worker must all deploy together before the feature
  can be called live. Existing completed legacy Carousels remain readable and
  are not deleted or rewritten.

## 2026-08-13 Bounded Carousel Performance Learning

- Performance learning extends the controlled five-Carousel selector; it does
  not replace the V1 architecture, delete the rotation, or create another
  background worker. The existing Instagram content-analytics sync performs
  best-effort Carousel attribution after it loads real platform results.
- Evidence must trace through an owner-scoped `published`
  `scheduled_post_target`, its server Library item, and the original completed
  `carousel_generations` row. The platform post ID, social connection, owner,
  actual `content_format_id`, hook family, and Business Profile must all agree.
  Generated, accepted, saved, or merely scheduled Carousels never count.
- A Library Carousel with a `trendingCreativeEdit` is excluded. Its visible
  text may no longer faithfully represent the originally assigned hook family,
  so attributing its outcome to that assignment would contaminate learning.
- Evaluation policy `carousel-performance-seven-day-v1` freezes one publisher
  view snapshot around seven days after publication. A snapshot is comparable
  only within 24 hours before or after the seven-day due time. Once frozen,
  later lifetime views never replace it. Missing or late analytics remain
  unevaluated rather than being treated as zero or compared unfairly.
- Views are the only Carousel learning metric. The Carousel observation and
  ranking path does not collect, store, or score reach, likes, comments,
  shares, saves, or total interactions. Those values may remain available to
  the separate general Analytics and Hook-video systems, but they cannot
  influence Carousel format or hook-family selection.
- Format ranking starts only after at least two formats each have four
  evaluated posts. Median views are the primary result, variation relative to
  average views penalizes inconsistency, and confidence grows gradually after
  the fourth result. Only the latest 20 evaluated posts per format from the
  last 180 days participate, preventing old history from locking selection.
- Learning is multi-winner, not winner-takes-all. Every consistently successful
  format may receive a higher multiplier at the same time. One viral spike is
  limited by the median, consistency penalty, minimum sample size, and a hard
  format multiplier range of `0.85` to `1.25`.
- When comparable format evidence exists, four of five batch slots use
  retry-stable weighted selection without same-batch format duplication. One
  of five slots always remains controlled exploration, and the exploration
  sequence still covers all 15 stable formats. Without enough evidence, all
  five slots keep the existing deterministic rotation.
- Hook-family learning is separate and is compared only inside the same
  content format. It also requires at least two compatible hook families with
  four evaluated posts each, uses the same robust consistency rule, caps its
  multiplier from `0.90` to `1.20`, and preserves 25% controlled hook-family
  exploration. Performance selects a family; the writer must still create
  fresh hook wording and pass recent-history validation.
- Every experiment assignment persists its controlled-rotation candidate,
  actual assigned format, format and hook selection modes, and the capped
  multiplier snapshots used at reservation time. Retried or concurrent
  preparation therefore reuses the original persisted assignment even if
  analytics changes later.
- Migration `20260813122724_add_carousel_performance_learning.sql`, the
  analytics attribution module, bounded selector, preparation integration,
  and regression tests are implemented and production-build validated
  locally. The database migration must deploy before the application code;
  this behavior is not live or production-verified yet.

## 2026-08-13 Trending Onboarding Prebuild

- Final onboarding completion now supplies the browser's validated IANA
  timezone to the server. The completed Business Profile starts today's
  Carousel feed preparation with `markItemsShown = false` before the client
  redirects to Trending.
- Carousel prebuild failures do not roll back a successfully completed
  onboarding profile. The existing authenticated Trending feed endpoint
  remains the idempotent recovery path.
- Wall-of-text preparation is scheduled in the same prebuild orchestration.
  Hook preparation is included only where the existing Hook feature gate is
  already enabled; production Hook behavior is not widened by this change.
- These changes are locally build- and contract-tested. They require the normal
  application and worker release, working Cloud Tasks configuration, and an
  authenticated production canary before being called live.

## 2026-08-20 Trending Preparing Skeleton

- The customer-facing preparation sentence and Carousel-shaped loading stack
  are retired. Initial loading and a genuinely preparing empty feed render one
  dark charcoal 9:16 skeleton at the exact width and position of a Hook or
  Wall-of-text Trending card.
- The skeleton contains no fake text, thumbnails, slide dots, or metadata. A
  separate, faint 32%-wide gradient highlight travels left to right over the
  stable `#18191c` base in a two-second linear loop. The card background,
  opacity, scale, border, and shadow do not animate, and reduced-motion users
  receive the stationary base without the travelling highlight.
- The preview-ready post and skeleton share the same reserved card dimensions
  and crossfade in place over 200ms. Both transition layers remain mounted
  through the handoff, so the change does not require a timer, per-frame React
  updates, or a layout-moving replacement.
- Caught-up and terminal exhausted states remain explicit text states; they do
  not pretend that generation is active.

## 2026-08-17 Carousel Source-Library Reset

- The testing-phase legacy Carousel source library is intentionally being
  retired before a replacement library and tagging model are introduced. This
  is an explicit exception to the normal rule to retain approved surplus
  assets.
- Reset scope is limited to `category_image_assets`, its
  `category-library/` GCS source objects, `carousel_image_usage`, and the
  source-asset foreign keys on `carousel_slides`. It does not delete immutable
  rendered Carousel output, Library child-slide records, scheduled posts, or
  any avatar, overlay, Hook, Wall-of-text, or unrelated media catalog.
- Before deleting source assets, the reset retires active Carousel assignments
  and requires both `generate_carousel` and
  `render_trending_carousel_edit` jobs to be terminal. Stored legacy
  Carousels consequently remain historical rendered artifacts only; they are
  not editable or eligible for a new Trending assignment after the reset.
- The reset deletes the physical source objects and the old asset rows rather
  than retaining archived metadata. The next library must be imported under
  the existing `category_image_assets` contract with its new, reviewed tagging
  structure before Carousel generation resumes.

## Next Implementation Slice

Name: **Verify v26 and replace the stale production assignment**

1. Obtain explicit approval for the guarded Supabase assignment mutation.
2. Re-audit the stale assignment for intervening edits, saves, or Trending
   decisions. If still untouched, point only feed item
   `5b63f84e-a33a-48a3-9b70-6dfef658be38` at a new pending assignment for
   generation `5505987f-735f-4b95-a562-8e6272baa00a` and mark the old
   assignment `completed_skipped`.
3. Verify the authenticated production Trending card after refresh while
   retaining all original generations and rendered assets.

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

## 2026-08-20 Creative Assets Presentation Simplification

- Videos and Images no longer place the optional group switcher inside a
  dedicated explanatory card. `All assets`, every owner-created group, and the
  compact `Create group` button remain available in one bare control row; group
  storage, membership, upload, rename, and delete behavior are unchanged.
- Saved no longer renders the introductory `Saved content` card or enclosing
  format panels. Its format filters remain as a compact control row, and Hook,
  Wall-of-Text, and Carousel results render through a flat embedded
  presentation. The existing owner-scoped APIs, preview, refresh, removal, and
  scheduling behavior remain unchanged.

## 2026-08-22 Inline Carousel Scheduling Bundle Boundary

- Trending and Library now load the shared Carousel scheduling modal only after
  a real `SchedulePlatformContext` has been created. The closed modal is not
  part of either route's initial client bundle.
- While the modal chunk opens, a blocking status surface keeps the existing
  page in place and clearly reports that scheduling is opening.
- The modal's account loading, selection limits, optional caption, publishing
  settings, date/time validation, durable-draft recovery, submission callbacks,
  and close/reset behavior are unchanged. Closing still clears the parent
  scheduling context, so a later open starts with fresh modal state.

## 2026-08-22 Creative Assets Saved Bundle Boundary

- The default Videos view and the Images view keep the existing
  `UserMediaCollection` path and behavior. The Saved collection is now a named
  dynamic import from the client workspace and is requested only when Saved is
  the active tab.
- A direct `/avatars?tab=saved` visit still selects Saved on the server and
  shows a content-only loading status while its client chunk arrives. Normal
  Videos and Images navigation no longer downloads the inactive Saved
  collection's Hook, Wall-of-Text, and Carousel library code up front.
- Saved format filters, owner-scoped APIs, preview, refresh, removal,
  scheduling, and storage behavior are unchanged. This boundary does not add a
  cache or alter any data-fetching contract.

## 2026-08-22 Trending Hook Flow Bundle Boundaries

- The live Trending feed keeps Hook composition state in its existing parent
  wrapper, but loads the large `HookVideoComposer` client module only after an
  accepted Hook enters composition. Closing the composer clears the parent
  composition and returns to the already-loaded in-memory daily pack; it does
  not refresh or regenerate the feed.
- The shared Hook/Wall scheduling drawer is loaded only when its existing
  open or pending-schedule state is present in Trending, Hook composition, or
  the Saved Hook library. A blocking scheduling status covers the short chunk
  load without unmounting the parent creative or library state.
- Preview-session creation, demo and suggestion selection, drafts, connected
  account loading, publishing settings, schedule validation, submission,
  completion, and close/reset behavior are unchanged. These boundaries alter
  client-code delivery only; they do not change API or storage contracts.

## 2026-08-22 Shared Account Scheduling Queries

- The active Scheduling, Analytics, Settings, Carousel scheduling, and
  Hook/Wall scheduling surfaces now read social connections and schedules
  through shared React Query entries keyed by the current Firebase UID.
- Fresh account data is reused for at most 15 seconds and retained inactive for
  30 minutes. The account-keyed query provider is still remounted when the UID
  changes, so no cached connection or schedule can cross accounts.
- A full schedule read also seeds the smaller scheduling-configuration query,
  avoiding a second request when a scheduling drawer opens immediately after
  Scheduling or Analytics. A stale full schedule is never treated as fresh
  configuration.
- Existing correctness-sensitive refreshes remain explicit: OAuth completion,
  manual account refresh, user-initiated Scheduling catalog refresh, and the
  two-second active-schedule poll bypass the freshness window. Schedule
  mutations update the open Scheduling cache directly or invalidate the shared
  schedule query before another route can reuse it.
- API routes, durable schedule creation/publishing behavior, recovery errors,
  account selection, lead-time validation, and visible loading/error behavior
  are unchanged. Dormant legacy multi-platform workspaces remain untouched.

## 2026-08-22 Scheduling Editor Bundle Boundary

- The Scheduling calendar, list, tabs, schedule polling, and action dialogs stay
  in the initial `/scheduling` client module. The large create/edit drawer is a
  named dynamic import requested only when a new, edit, or deep-linked draft
  flow has set the existing parent-owned `drawerOpen` state.
- The workspace still owns the open/edit identity, selected server schedule,
  account-scoped catalogs, connections, mutations, refreshes, and error state.
  The deferred editor owns only the same temporary form state it owned before
  extraction, so opening, saving, closing, and reopening retain their previous
  reset and preservation behavior.
- Presenter preparation still uses the authenticated `/api/media/from-avatar`
  request through a parent callback. Manual media refresh remains a forced
  account-scoped catalog refresh, and saved account targets, hidden legacy
  platforms, carousel sources, captions, five-minute lead validation, and
  TikTok publishing settings are unchanged.
- A blocking loading surface is shown only while the editor chunk is arriving.
  This boundary changes client-code delivery, not scheduling API, database,
  publishing, recovery, or ownership contracts.

## 2026-08-23 Creative Assets Premium Pill Navigation & Unified Saved Presentation

- The primary Creative Assets collection switcher (`Videos`, `Images`, `Saved`)
  now uses a premium floating pill capsule track with elevated active tabs,
  matching the secondary format switcher in Saved.
- The `Saved` tab retains its dynamic bundle boundary and owner-scoped Hook,
  Wall-of-Text, and Carousel stores, but now unifies their presentation:
  - When filtering by `All`, empty sub-libraries do not render placeholder
    boxes that push down populated content.
  - If all formats are empty, a single unified onboarding empty state is
    displayed with shortcuts to explore Trending.
  - When specific format filters (`Hook videos`, `Wall-of-Text`, `Carousels`)
    are selected, only the targeted format is rendered.
- Existing preview dialogs, Instagram/TikTok scheduling drawers, deletion APIs,
  and recovery error handling remain unchanged.

## 2026-08-23 Production Color Palette Modernization

- Upgraded the central light design tokens in `app/globals.css` from the legacy warm/brownish palette to the modern production palette:
  - `--primary: #ff5a1f` (Electric Coral-Orange) replacing legacy `#c94716`
  - `--primary-hover: #e04810` replacing legacy `#ad3c12`
  - `--brand: #ff5a1f` and `--brand-soft: #fff7ed`
  - `--background: #f8fafc` (Ghost White / Slate 50) replacing `#f8f8f7`
  - `--foreground: #0f172a` (Deep Slate 900) replacing `#181817`
  - `--muted: #475569` (Slate 600) replacing `#666663`
  - `--muted-subtle: #94a3b8` (Slate 400) replacing `#73736f`
  - `--border: #e2e8f0` (Slate 200) and `--border-strong: #cbd5e1` replacing `#e5e5e2` / `#d4d4d0`
  - `--card-muted: #f1f5f9` and `--surface-subtle: #f1f5f9` (Slate 100)
  - `--success: #10b981` (Emerald 500) replacing `#168a4a`
- Updated pricing checklist checkmarks to use `text-success` (`#10b981`).
- All layout dimensions, responsive behaviors, component trees, API contracts, and business logic remain completely unchanged.

## 2026-08-24 Trending Centered Stacked Review Stage

- Trending presents one interactive active creative in a centered review stage,
  with the next two real feed items mounted as a quiet visual stack behind it.
  The next card peeks above the active creative at rest, and the deeper preload
  layer remains visible enough to communicate that more content is ready.
- Both background cards remain non-interactive, inert, and hidden from
  assistive technology. They retain protected Hook preview preparation,
  Carousel image preloading, and Wall video warm-up without creating duplicate
  controls or another accessible review target.
- Dragging the active card in either direction progressively promotes the same
  next card using the absolute horizontal drag distance. A small left or right
  movement therefore reveals real prepared media immediately; cancelling the
  gesture returns the stack to rest, while a completed decision promotes that
  already-mounted item without a blank intermediate frame.
- The active Carousel uses a compact responsive 4:5 width capped at 270px.
  Hook and Wall-of-Text previews use a compact responsive 9:16 width capped at
  230px. Both formats remain constrained by the available dynamic viewport
  height so decision controls stay visible on short screens.
- Slideshow media covers the complete fixed 4:5 review frame. A source whose
  aspect ratio does not match the frame may crop only its excess edges instead
  of exposing empty left or right gutters; the card dimensions remain unchanged.
- The format label is attached directly above the active card and uses a compact,
  flat treatment. Reject and Accept stay centered immediately below the active
  creative and do not use ambient elevation.
- The format label uses a neutral 22px surface with 10px medium-weight copy. Only
  its small icon carries the format identity color; the pill itself has no glow,
  ring, shadow, blur, or format-colored background.
- The active creative's own responsive frame is the geometric center of the
  review area. The format pill and decision controls are positioned outside that
  frame, so neither changes the card's horizontal or vertical center.
- The pill stays visible above the complete prepared stack in reserved space.
  It clears ordinary same-height stacks by 40px and clears a taller 9:16
  background item behind an active 4:5 Slideshow by 72px, preventing the label
  from covering any media or overlay copy.
- The deck reserves 94px above the active frame for the pill/stack clearance
  and 107px below it for Skip/Accept. These rails keep both control groups out
  of the Trending subtitle and neighboring layout even at constrained desktop
  heights.
- Responsive card sizing subtracts the 348px page/deck chrome budget before
  applying each format ratio. The normal desktop caps remain 270px for
  Slideshow and 230px for 9:16 video, while shorter viewports reduce the media
  instead of forcing the controls off-screen.
- Keyboard focus is drawn around the active card-sized frame rather than a
  full-width deck container. The Trending section retains horizontal clipping
  for swipe exits without exposing a large empty focus outline.
- Hook and Wall-of-Text share one authoritative responsive 9:16 frame class.
  Their outer articles therefore have identical width and height at every
  breakpoint; only their media and overlay content differ.
- Swipe, keyboard, Edit, decision outbox, Carousel slide navigation, and feed
  ordering behavior are unchanged.
- User-facing Trending language calls the generated outputs `content`, never
  `ideas`. This applies to preparation, empty and failure states, card labels,
  and accessibility text; internal candidate and idea naming remains an
  implementation detail.
- The shared `creative-reject`, `creative-accept`, and `creative-edit` button
  variants are shadowless by default. Their separation comes from a quiet border,
  semantic icon color, hover fill, and the existing keyboard focus ring.
- Hook and Wall-of-Text audio controls use a compact flat overlay without ambient
  shadow or backdrop blur. Hook cards, rendered Carousel/Wall cards, edited
  badges, and the Trending loading card also avoid ambient elevation.
- The Trending header's `Adjust` and item-level `Edit` actions share the same
  compact 36px pill size, padding, typography, icon scale, border weight, hover
  treatment, and focus behavior. Their labels and semantics remain distinct.
- The Adjust content-mix dialog keeps one identity color per format everywhere
  that format is represented: Slideshows use the existing primary orange,
  Wall-of-Text uses the existing product purple, and Hooks use the existing info
  blue. The composition segments, icon badges, percentages, slider progress,
  and slider thumbs use that same mapping. The composition ribbon and slider
  tracks use a slimmer six-pixel treatment for a quieter premium hierarchy.

## 2026-08-23 Carousel AI Copy Preservation and Model Pin

- Structure 1 and Structure 2 Carousel writing requests use the shared
  source-pinned `gpt-4o-mini` model. The worker logs that exact model plus both
  planner versions at startup, and stored generation provenance remains the
  authority for confirming the model that produced a particular Carousel.
- The publishing contract separates blockers from writing preferences. Invalid
  JSON, changed selected format, wrong slide order or role, missing required
  fields, renderer length/shape violations, product-timing violations,
  prohibited visual subjects, and unsupported or prohibited claims may block
  or trigger one isolated LLM repair. Word-count targets, perspective style,
  CTA semantics, generic phrasing, grammar style, and repetition are advisory
  diagnostics only.
- When an AI response passes the publishing contract, its copy is preserved.
  The worker no longer replaces or augments accepted text through a hardcoded
  post-processing copy rewriter.
- Structure 2's authored deterministic story fallback is removed from the
  planner and its active batch runtime. If the initial structured batch and one
  isolated LLM repair cannot produce a publishable item, generation fails and
  can be retried; no template sentence is published in its place. Structure 1
  is also LLM-only: its deterministic writer, enable/disable switch, fallback
  result type, and authored persistence placeholder have been removed rather
  than merely disabled at publishing call sites.
- Historical rows whose provenance says `deterministic-fallback` remain
  immutable records of the earlier implementation. They are not rewritten or
  presented as LLM output.
- This source change is locally build- and regression-tested. It is not live
  until the Carousel worker is deployed and an authenticated production canary
  verifies `content_planner_model = gpt-4o-mini`, `content_plan_source = llm`,
  and preserved visible copy on both structures.

## 2026-08-24 Structure Contract and Live-Output Validation

- Structure 1 planner `llm-carousel-planner-v30-llm-only-structure-contract`
  has no deterministic writing mode or authored-copy fallback. Missing OpenAI
  configuration, an invalid initial response, and a failed isolated repair all
  fail closed. The historical `content_plan_fallback_reason` and
  `fallbackUsed` persistence fields remain readable for old rows but new
  Structure 1 planner results always use source `llm`, a null fallback reason,
  and `fallbackUsed = false`.
- The Structure 1 JSON contract binds every returned slide to the assigned
  slide number, role, slide type, allowed text modes, CTA position, and exact
  list-item count. A role without `listItemCount` must return an empty list;
  extra list copy is a structural failure eligible for the one LLM repair, not
  ignored data and not replacement prose.
- Slide persistence no longer invents `Slide N` when an impossible empty-copy
  record reaches it. It throws before persistence because every published
  visible string must originate in the accepted AI plan.
- Structure 2 remains LLM-only. The historical `productMechanism` selection and
  forced Slide 4 product sentence have been removed. The writer now receives the
  minimal saved `businessDescription`, one open creative seed plus emotion, the
  selected format as a flexible reference, and recent accepted copy. Unsupported
  precise features, proof, metrics, customers, guarantees, and outcome claims
  remain blockers; valid original AI wording is not replaced.
- The shared runtime slide-plan module now contains types only; its old authored
  deterministic builder was removed. The scale-readiness audit owns a local
  synthetic fixture instead, so offline matcher testing cannot become published
  copy by being imported into a runtime path.
- Local contract validation covers all 15 Structure 1 formats and all eight
  Structure 2 formats. A live `gpt-4o-mini` planner audit returned one valid
  Structure 1 plan and five valid Structure 2 plans with LLM provenance and no
  fallback copy. Structure 2 still produced advisory word-count and writing
  quality findings; these are retained as diagnostics, consistent with the
  decision not to replace structurally valid AI wording.
- Structure 1's two-attempt recovery to Structure 2 is allowed only for an
  automatic rotation batch whose five items already have durable content-plan
  provenance. An explicit Structure 1 request fails as Structure 1. Recovery
  preserves the same reserved creative seeds and emotions and only changes the
  LLM presentation structure; neither writer may publish deterministic prose.
- These changes are local source changes and must not be described as live
  until the Carousel worker is deployed and the authenticated production flow
  is verified on `https://www.getugcpilot.com`.

## 2026-08-24 Carousel 30-Day Creative Plan Architecture

- A business profile keeps its complete analysis for existing product and
  operational uses. Carousel creative planning does not replace or truncate
  that stored analysis. It deliberately projects only the saved
  `businessDescription` into the creative-plan and slideshow-writing prompts so
  the writer receives factual grounding without a fixed problem, audience,
  workflow, outcome, or product-mechanism storyline.
- Each 30-day plan contains 150 durable items: five organizational slots for
  each of 30 days. The day grouping is inventory organization, not a daily usage
  limit. Every item contains exactly an open-ended `creativeSeed` and a required
  `emotion`; it must not contain finished slide copy, a hook, CTA, full story,
  format, structure, or product mechanism.
- Structure 1 and Structure 2 consume the same neutral item inventory. A request
  reserves the required number of items atomically, attaches them to the job,
  and consumes each item only after successful Carousel persistence. Failed
  requests release their reservations, and expired reservations can be reused.
  The next 30-day plan is generated when the current planning period needs a new
  inventory.
- Both writers receive the reserved `creativeSeed`, its `emotion`, the minimal
  `businessDescription`, their selected format reference, and the exact visible
  copy from the last ten accepted Carousels (hook/headline, every slide's visible
  text, CTA, structure, format, generation ID, and content-plan item ID). The
  history is not reduced to an LLM-generated summary.
- Structure 1's format contract is unchanged. Structure 2 remains exactly five
  slides, but its eight formats are creative references rather than a compulsory
  sentence-by-sentence story backbone. Examples and role guidance may inspire
  the LLM, while the five-slide count, selected format ID, required fields, and
  renderability remain structural. CTA presence and slide position are creative
  choices and never publishing gates.
- Content-plan generation and both slideshow writers are source-pinned to
  `gpt-4o-mini`. Structural invalidity can trigger one isolated LLM repair or a
  failure. Structurally valid AI copy is preserved even when advisory diagnostics
  identify generic phrasing, repetition, CTA quality, perspective, or word-count
  drift.
- The database foundation, lifecycle, asynchronous plan-generation job, and
  Carousel provenance link are introduced by migrations `20260824150000`
  through `20260824153000`. They must be applied before deploying the app and
  worker revisions that use the plan-first contract.

## 2026-08-25 Private Carousel Creative-Brief Layer

- Carousel remains a 150-item, 30-day inventory: five usable ideas per
  organizational day. Wall-of-Text is explicitly outside this plan and must
  receive its own future planning architecture.
- New Carousel plans create 30 private creative briefs, each producing exactly
  five durable `creativeSeed + emotion` items. The six brief fields are
  `creativeSeed`, `audienceContext`, `humanMoment`, `emotionalTension`,
  `supportedAngle`, and `preferredFormatFamily`. They are internal AI context,
  never frontend labels, slide fields, or user-visible output JSON.
- The planner receives an explicit definition for every private brief field:
  `creativeSeed` is a human observation rather than final copy;
  `audienceContext` is a supported, non-universal audience segment;
  `humanMoment` is a concrete everyday event; `emotionalTension` is the
  resulting inner conflict; `supportedAngle` is an approved-fact-only business
  connection rather than a sales claim or promise; and
  `preferredFormatFamily` is a soft storytelling direction. All six fields are
  used together for each set of five child ideas. The selected Carousel format
  remains authoritative.
- Brief generation receives an approved business-profile context snapshot
  (audience, pain points, differentiators, value, tone, purpose, category, and
  stated problem/promise) alongside the minimal business description. It must
  not invent factual support, audience segments, capabilities, evidence, or
  guarantees.
- A final Carousel writer receives its one durable idea plus its parent brief.
  The brief supplies human specificity but does not impose a story. The
  backend-selected Structure 1 format and hook family, or the selected
  Structure 2 format reference, remain authoritative.
- `preferredFormatFamily` is only a soft variety direction; it is not a
  renderer ID, cannot override a selected Carousel format, and cannot create a
  CTA requirement. Existing optional-CTA behavior remains unchanged.
- Each parent brief and its five child items persist atomically. The existing
  item reservation, release, provenance, and one-time consumption contract is
  unchanged. Legacy items have no parent brief and continue with their original
  seed-plus-emotion behavior.
- The additive rollout is migration
  `20260825110000_add_carousel_creative_briefs.sql`. It must be applied before
  the app and worker revisions. Existing active plans are not rewritten or
  invalidated; a new plan uses the richer brief layer once it is created.

## 2026-08-24 Carousel Human-Hook Library Reconciliation

- Source paths under `gym_part2/human_hook` classify as Gym hook assets, and
  source paths under `productivity_humanhookpart-2/human` classify as
  Productivity hook assets. They are available to the first-slide human-hook
  rotation without changing unrelated categories.
- `scripts/reconcile-carousel-role-library.mjs` is the targeted, auditable sync
  path for these three local source trees. It uploads new sources, refreshes
  changed sources, removes stale database rows and objects only within the
  selected source scopes, and verifies the resulting backend inventory.
- The live targeted reconciliation inserted 30 hook assets, refreshed 240
  retained Productivity human assets, removed 33 stale selected-scope rows, and
  verified 810 selected-scope GCS objects with no stale selected-scope rows.
  Unrelated missing Travel sources were intentionally outside this operation.

## 2026-08-23 Carousel Editor Render Fidelity

- The persisted rendered slide is the initial Carousel editor preview source of
  truth. Opening Edit must show the same crop, compositing, line breaks, font
  scale, text treatment, and text position as Trending; the editor must not
  immediately replace that asset with a browser reconstruction over the raw
  category image.
- After the user changes a field, the live preview reads the slide's real
  `structureId`, Structure 2 layout variant, text treatment, render format, and
  visual role. Structure 2 stays horizontally centered and exposes only the
  renderer-supported upper/center/lower vertical placement. Product screenshots
  preview the contained foreground over the softened cover backdrop used by the
  renderer.
- Structure 2 renderer version `story-native-renderer-v2-line-bubbles` replaces
  the oversized full-block pill with quiet line-sized white shapes and reduces
  the story and CTA font ranges. `pill` treatment uses black text on white;
  `overlay` and `outlined_overlay` use white text directly over the image.
- Structure 1 continues to use its connected line-bubble renderer and therefore
  uses black text on white. A no-bubble Structure 1 mode is not inferred in the
  editor because it is not part of the Structure 1 persistence contract.
- The editor-only SVG drop shadow is removed. Any treatment visible when Edit
  opens now comes from the actual rendered asset, and live preview geometry does
  not add a separate shadow that the worker did not render.
- The user-facing first-slide image selector is named `Hook library` and is
  presented as a simple folder. The existing `hyper-hooks` identifier and API
  remain internal compatibility details and are not user-facing product names.
- Existing immutable Carousel render files are not rewritten in place. New
  generations and saved edits use the v2 Structure 2 renderer; an already-stored
  v1 asset remains exact until it is explicitly edited and rendered again.

## 2026-08-23 Trending Adjust and Edit Action Boundary

- `Adjust` is the global Trending feed action. It opens the authenticated
  content-mix preference flow backed by `/api/trending/content-mix` and controls
  the daily percentage split between Slideshows, Wall-of-Text, and Hooks.
- `Edit` remains the active-creative action. It changes the current creative's
  copy, media, and supported placement; it does not change the daily feed mix.
- Both actions are visible together in the Trending header when an active
  creative exists. Adjust remains available while the feed is loading, empty,
  or caught up so the global preference is not coupled to a card being present.
- The mix editor keeps the three percentages at exactly 100 percent while
  respecting the existing backend caps. Changes to either video format trade
  against Slideshow; changing Slideshow proportionally redistributes the two
  capped video formats.
- Free, Starter/legacy Pro, and Growth users can all save a valid daily mix.
  Free retains 30/40/30 only as its no-preference default; a saved Free
  preference is authoritative for a newly created daily pack.
- Saving does not rewrite a completed daily pack. The existing backend contract
  applies the preference today only when no daily feed exists; otherwise it
  starts with the next local day.

## 2026-08-24 All-Plan Trending Mix Adjustment

- Every authenticated plan may adjust the daily percentage split between
  Slideshows, Wall-of-Text, and Hooks. This includes Free, Starter (the legacy
  `pro` key), and Growth.
- Free's ten-post allowance is unchanged. A Free user without a saved
  preference still receives the 30% / 40% / 30% default; after a valid save,
  that owner-scoped preference controls the next eligible daily pack.
- The existing integrity rules are unchanged: all percentages total 100%, each
  format may use the full daily allowance, and an already-created daily pack
  remains immutable. A save applies today only when no feed exists;
  otherwise it starts on the next local day.
- The Adjust dialog uses a restrained flat control-panel treatment with a 6px
  composition ribbon, 6px slider tracks, and 14px thumbs. Format identity
  colors and accessible keyboard/focus behavior remain intact.
- Migration `20260827180000_allow_full_format_content_mixes.sql` widens the
  persisted preference and daily-feed validation to 0-100 for every format.
  Hook and Wall-of-Text generation already support the 50-post maximum daily
  plan, so workers do not need to change.

## 2026-08-24 Sectioned Settings Navigation

- Customer Settings now presents one active section at a time in this fixed
  order: Account, Plan & billing, App screenshots, Connected accounts,
  Preferences, and Privacy & data.
- App screenshots remains the existing owner-scoped product-screen library;
  its upload, validation, storage, removal, and Structure 2 eligibility
  behavior are unchanged.
- The Carousel administration component and APIs remain in source, but the
  administration panel is no longer mounted in the customer Settings screen.
- Existing `#subscription-billing`, `#app-screenshots`, and
  `#instagram-publishing` deep links select the matching section instead of
  scrolling through one long settings page.

## 2026-08-24 Database-first Instagram Analytics Refresh

- Instagram Analytics reads owner-scoped durable database snapshots before it
  considers a provider refresh. The account-keyed browser query cache keeps
  those results fresh for 30 minutes, so revisiting Analytics inside that
  window neither clears visible data nor starts another synchronization job.
- Account-insight snapshots are specific to the selected 7-, 30-, or 90-day
  range. Content feed coverage is also tracked per range. Opening Analytics
  enqueues work only when that relevant saved snapshot is missing or stale;
  saved data remains visible while an eligible refresh runs in the background.
- Post metrics use the bounded age policy: posts under 24 hours refresh hourly,
  posts from one through seven days refresh every six hours, and older posts
  refresh daily. After the first range snapshot, provider feed scans use a
  one-day overlap from the last successful scan instead of re-reading the
  complete range. Manual
  Refresh bypasses freshness gates but remains an incremental range refresh.
- A successful UGC Pilot Instagram publication immediately inserts its
  non-sensitive media identity into the analytics content store. The normal
  provider synchronization later fills metrics and richer media metadata.
  Registration is best-effort after the durable publish projection and cannot
  turn a successful Instagram publication into a failed publish retry.
- Media-insight failures are isolated per post. A failed post retains its last
  saved values and error marker while other posts in the same account continue
  to refresh; a transient account/feed failure likewise keeps an existing saved
  account visible.
- Hook, Carousel, and Wall attribution no longer runs before content analytics
  is returned. Content synchronization persists the general Analytics
  snapshot, queues a separate durable `instagram_attribution` job, and returns
  without waiting for that attribution work. The existing seven-day Carousel
  performance policy, views-only learning input, evidence chain, and bounded
  selector are unchanged.
- The former three-second browser polling loop is not on the saved-data render
  path. A first-ever load may still observe its durable job, while background
  refresh observation uses a ten-second interval and the same 15-minute upper
  bound as the worker-to-application analytics request.
- These migration, application, and worker changes are local source changes.
  Deploy the additive snapshot migration before the application and worker,
  then verify the authenticated Analytics and post-publication flows on
  `https://www.getugcpilot.com` before describing the behavior as live.

## 2026-08-24 Wall Source Minimum-Duration Cleanup

- Wall-of-Text source videos must be at least 6.000 seconds and at most 60
  seconds. The six-second floor is source eligibility only; it must not be used
  as a duration-derived copy budget.
- The 16 active reviewed Wall sources below six seconds were exported locally,
  SHA-256 and duration verified, human validated, and then removed from the
  production database and GCP storage. Their 16 MP4s, manifest, dependency
  backup, and deletion result remain in
  `artifacts/wall-text-under-6s-review-2026-08-24` for recovery.
- Cleanup removed only the exact reviewed targets: four unused Wall previews,
  three rejected decisions, one historical decided daily-feed slot, one
  isolated one-item generation batch, 16 catalog rows, 16 video objects, and
  16 thumbnails. There were no accepted, selected, edited, published, or
  performance-observed dependents. Post-cleanup verification found zero
  under-six-second active Wall sources, zero orphaned Wall creatives or feed
  slots, and 128 eligible Wall source videos.
- The production database now rejects any active `wall_text_overlay` video
  below six seconds. Local application selection, user-source preparation, and
  both Wall importers apply the same floor; those application/import guards are
  not live until their source changes are deployed.
- Hook video duration eligibility and all Slideshow/Carousel behavior are
  unchanged by this decision.

## 2026-08-24 Wall V7 Spatial-Fit Copy Contract

- New Wall-of-Text writing reservations use prompt version
  `wall-text-writer-prompt-v8-spatial-fit`. Clip duration no longer creates a
  word maximum, reading-time score, or rewrite trigger for the current V7
  `wall-text-overlay-v6` content path.
- Video duration remains source and render metadata only. A current Wall source
  must still be between 6.000 and 60 seconds, but every eligible source uses the
  same copy acceptance contract.
- Each format's word range is a soft target. The layout engine also estimates a
  soft spatial target from the safe text box, but neither target is a required
  minimum or a hard rejection boundary.
- Current V7 copy has an 8-word structural minimum and a 50-word absolute safety
  ceiling. Final acceptance is authoritative measured layout: one continuous
  message must form 4-7 balanced lines inside the safe box using Inter at one of
  the supported 52, 50, 48, 46, or 44px sizes. Copy that cannot fit at 44px
  fails instead of shrinking further.
- The writer may receive one isolated repair for a real publishing failure such
  as measured overflow. The runtime does not truncate, replace, or publish
  canned fallback copy when repair is exhausted.
- A batch already reserved under the prior prompt keeps its persisted assignment
  budgets when resumed so idempotent in-flight work is not silently mutated.
  New reservations use the spatial-fit contract and store its prompt version.
- Hook copy, Hook duration handling, Wall font weight, semantic line ownership,
  and all Slideshow/Carousel behavior are unchanged in this implementation.
- These application changes are locally validated but are not live until the
  application source is deployed and the authenticated production Wall flow is
  verified on `https://www.getugcpilot.com`.

## 2026-08-24 Wall SemiBold Typography and Authoritative Lines

- Current Wall-of-Text preview, editing, validation, and final rendering use
  the bundled Inter SemiBold 600 face. The supported responsive range remains
  52, 50, 48, 46, or 44px, and 44px remains the readability floor.
- The layout engine owns the final measured 4-7 lines. The writer supplies one
  continuous message without authored line breaks; the browser and worker
  consume the saved `finalLayout.blocks[].lines` and do not independently
  reflow accepted copy.
- Current V7 validation requires normalized `sourceContent.text`, `fullText`,
  and the joined authoritative final lines to represent the same message. A
  mismatch fails closed instead of truncating, replacing, or silently
  reformatting the content.
- Legacy database rows and already-queued render payloads with weight 700 stay
  readable during rollout. They are accepted at the boundary and normalized to
  600 in active preview/render specifications without changing their saved
  line text. The production constraint accepts both 600 and 700 and was
  validated without rewriting existing rows.
- Existing rendered MP4 files are immutable and are not retroactively changed.
  Newly generated or re-rendered Wall videos receive the 600 face after the
  worker and application source are deployed.
- The rolling production database migration is live. The application and
  worker source changes are locally validated but are not live until they are
  deployed and the authenticated Wall flow is verified on
  `https://www.getugcpilot.com`.
- Hook typography and text flow, Hook duration behavior, and all
  Slideshow/Carousel behavior are unchanged by this implementation.

## 2026-08-24 Hook Authoritative-Line and Fallback Contract

- The approved Hook writing structure remains one continuous opening thought
  expressed in 1-3 intentional semantic lines, with at most 12 words total,
  7 words per line, and 78 characters. The existing Global Hook text formats,
  evidence requirements, duration-aware human review, and 34-60px readable
  font range are unchanged.
- `hook-overlay-layout-v1` identifies the current authoritative render layout.
  Validated `opening_lines` and the measured `visual_fit.fontSize` now travel
  together through feed preview, editing, draft saving, scheduling, saved-video
  rendering, and the worker. The joined lines must represent the same text.
- Current layouts fail closed when their saved lines, font size, or text do not
  match. The preview does not silently reflow them, the editor does not slice
  extra in-progress lines, and the renderer does not truncate or substitute a
  different line arrangement.
- Hook feed and editor previews now share the export typography contract: the
  exact Geist SemiBold browser face, weight 600, a 5px black outline at the
  1080px render width, and the same emoji/CJK fallback families. Preview-only
  bold and shadow treatments were removed, so review no longer shows heavier
  or softer text than the finished video.
- Old queued jobs and old stored edits without the layout version retain one
  isolated compatibility path that derives a layout once and upgrades it in
  memory. Versioned current content never enters that legacy path.
- A generated Hook receives at most one targeted repair for a real validation
  or review failure. If the repaired result still fails, that candidate is
  excluded; the system does not run a repeated rewrite loop or publish canned
  fallback copy.
- The Wall editor's client-side save gate was also aligned with the already
  approved 8-50-word, measured 4-7-line contract; it no longer repeats the old
  12-word or clip-duration message.
- A final source scan confirmed that clip-time word formulas remain only in
  validation for pre-V7 Wall layout versions. New V7 Wall copy uses the
  duration-independent 8-50 absolute bounds plus measured 4-7-line fit, while
  one targeted content repair remains the only quality rewrite attempt for
  both current Wall and Hook generation.
- These application and worker changes are locally validated but are not live
  until deployed and verified in the authenticated Hook flow on
  `https://www.getugcpilot.com`. Wall rendering behavior and all
  Slideshow/Carousel behavior are otherwise unchanged.

## 2026-08-24 Trending Hook Demo Content Boundary

- A demo uploaded during Trending Hook composition is Content. Trending uses
  the same `/api/demo/create-upload-url` and `/api/demo/complete-upload`
  persistence path as the Content screen, creating an owner-scoped
  `demo_videos` row before using its ready media projection in composition.
- `Choose existing` lists only ready `media_assets` projections whose
  `source_type = demo_upload`. General Creative Assets uploads, generated
  videos, and Edit exports are not eligible as product demos.
- The `demo_upload` projection exists so Hook validation and rendering can use
  the unified media contract. It must remain excluded from Creative Assets and
  visible in the Content Library at `/library`.
- Failed Trending demo uploads are cleaned up through the demo delete API, so
  the Content record, media projection, and raw storage object retain their
  existing synchronized-deletion behavior.
- This application change is locally validated but is not live until deployed
  and verified in the authenticated Trending and Content flows on
  `https://www.getugcpilot.com`.

## 2026-08-24 Carousel Content Plans and Flexible Structure 2 Flow

- Automatic Carousel preparation is now backed by an owner- and
  business-profile-version-scoped 30-day content plan. Each plan item owns one
  creative seed and one emotion; plans activate only after all required items
  are complete.
- Content-plan writing runs as the durable
  `carousel_content_plan_generation` background job. Writer work is partitioned
  into five-item batches, is idempotently attached to its plan, and uses the
  normal retry/recovery lifecycle instead of making a page request wait for AI.
- Plan items are reserved atomically for Carousel generation and consumed only
  by a completed generation with matching owner, profile, plan, and item
  provenance. Failed or abandoned work can release an unconsumed reservation;
  another user or profile version cannot reuse it.
- The planning tables, reservation functions, job completion function, and
  generation link are additive, service-role-only database changes. Deploy the
  five ordered `2026082415*` migrations before application and worker code.
- Structure 2 format metadata is versioned as
  `carousel-structure-2-formats-v4-expanded-copy-centered` with story reference
  version `carousel-structure-2-story-reference-v4`. Each format still uses the same
  five known roles exactly once, but their order is no longer a fixed runtime
  backbone. Format-specific example flows guide the writer, while only the
  format ID and five-slide output shape remain structural requirements. CTA
  presence and placement remain AI-owned and optional.
- Structure 2 remains LLM-only and source-pinned to `gpt-4o-mini`. It receives
  the minimal saved business description, the reserved creative seed and
  emotion, its format reference, and the last ten exact accepted copies. One
  isolated LLM repair is allowed; the runtime does not publish deterministic
  substitute prose.
- These changes are locally validated but are not live until the ordered
  migrations, application, and worker are deployed and the authenticated
  Carousel flow is verified on `https://www.getugcpilot.com`.

## 2026-08-24 Wall-of-Text Accepted Action Surface

- Accepting or right-swiping a Wall-of-Text idea opens one compact action card
  with the smaller 9:16 video preview on the left and only two actions on the
  right: `Create a Schedule` and `Save to Creative Assets`.
- The accepted action surface does not repeat the format label, title,
  explanatory copy, overlay-copy label, or full overlay text outside the video.
  The rendered overlay remains visible inside the video preview itself.
- `Create a Schedule` is the primary action and opens the existing inline
  scheduling dialog on Trending. Its first step collects an exact Instagram
  account plus date and time; its review step confirms the destination and
  publish time before durable scheduling.
- `Save to Creative Assets` keeps the existing owner-scoped Wall draft save and
  render-preparation behavior. Loading and failure feedback remain visible
  because they communicate the state of the two requested actions.
- This is a presentation-only decision. Wall copy generation, authoritative
  line layout, video/audio preview, edit persistence, rendering, scheduling,
  ownership, and completion contracts are unchanged.

## 2026-08-24 Fixed Hook and Slideshow Typography Contract

- Adaptive typography belongs only to Wall-of-Text. Its existing measured
  52/50/48/46/44px range and 44px readability floor remain unchanged.
- Current Hook layouts use fixed 52px Geist SemiBold type under
  `hook-overlay-layout-v2-fixed`. Hook writing still owns one to three semantic
  lines and the existing word/character limits. If those authoritative lines
  do not fit at 52px, the candidate receives the existing single targeted LLM
  repair and then fails; the renderer never shrinks, truncates, adds an
  ellipsis, or publishes fallback wording.
- Stored and already-queued `hook-overlay-layout-v1` layouts remain readable at
  their saved 34-60px size through an explicit legacy path. Current v2 payloads
  are rejected unless their saved font is exactly 52px and their lines match
  their text.
- Structure 1 and Structure 2 Carousel renders use fixed 44px typography.
  Pre-render validation checks Structure 1 headline/body/list groups and
  Structure 2 story/CTA groups against their fixed-size line capacities. A
  failing AI plan gets the existing one isolated repair and then fails closed.
- Structure 1 renderer `social-plain-text-renderer-v15-structure-parity`
  renders headline, body, list, and CTA groups as direct white text with the
  same fixed 44px type, dark outline, and no-background SVG treatment as
  Structure 2. Its former headline-bubble containment retry is retired because
  there is no longer a white background shape to contain.
- Structure 2 renderer
  `story-native-renderer-v5-plain-white-story-text` renders story and CTA copy
  as direct white text with a restrained dark outline. Stored legacy treatment
  labels remain readable, but new Structure 2 specs normalize the effective
  treatment to the plain overlay.
- Existing rendered Carousel WebPs and Hook videos are immutable. The new
  renderer/layout versions apply only to new generations and explicit
  re-renders after the application and worker are deployed.
- These are local source changes. Do not describe them as live until the
  application and GCP workers are deployed and authenticated production
  canaries verify both Carousel structures and Hook rendering on
  `https://www.getugcpilot.com`.

## 2026-08-24 Structure 2 Server-Owned Ordering and Hook V4 Contract Repair

- Structure 2 AI responses no longer own `slideNumber`, `slotIndex`,
  `candidateIndex`, or `storyFormatId`. The structured-output contract uses
  five required named positions for the batch and for each plan. The worker
  maps those positions to the already-reserved assignments, injects slide
  numbers 1 through 5 from position, and injects the backend-selected format
  before publishing validation and persistence.
- This removes the former `items.anyOf` ambiguity that allowed duplicate or
  reordered numeric identities to satisfy the model-facing JSON schema before
  failing the stricter application parser. Persisted Carousel plans and slides
  still retain their normal numeric slot/slide metadata; only AI ownership of
  that metadata is removed.
- The exact-key parser remains a second fail-closed boundary. Extra structural
  fields, missing named positions, invalid roles, or render-fit failures still
  receive at most the existing isolated LLM repair; no deterministic story copy
  is introduced. A missing CTA or a CTA on any slide is valid and does not enter
  the repair path.
- Migration `20260824180000_align_hook_fixed_type_validation.sql` makes the Hook
  persistence boundary rolling-safe for the matched V3 and fixed-type V4
  validator/overlay pairs. It does not allow a V4 validator with a V3 overlay,
  or vice versa.
- A Hook job whose database error is a deterministic generation/persistence
  contract failure is no longer replaced three more times. Transient worker or
  provider failures retain the existing recovery path, while a later normal
  refill may choose new candidates after a terminal content failure.
- These source and migration changes are locally validated but are not live.
  Apply the Hook migration before releasing the application and workers, then
  verify Hook persistence plus a new Structure 2 batch through the authenticated
  production Trending flow on `https://www.getugcpilot.com`.

## 2026-08-25 Structure 2 Optional CTA Contract

- Structure 2 no longer requires exactly one CTA and no longer owns a fixed CTA
  slide. The model-facing schema permits `ctaText` to be either a non-empty
  string or `null` on every slide.
- The planner prompt treats CTA presence and placement as creative choices. The
  parser does not count CTA fields or compare them with format metadata, so a
  missing CTA, a CTA on any slide, or more than one natural CTA cannot reject an
  otherwise publishable Carousel.
- When `ctaText` is null, the renderer omits the separate CTA bubble and gives
  the story copy the available space. When CTA copy exists, its existing fixed
  44px render-fit and safety checks still apply; unrenderable text is not
  published merely because CTA placement is flexible.
- Exact five-slide shape, server-owned slide order, required story fields,
  renderer fit, human-image safety, unsupported-claim checks, and ownership
  boundaries remain unchanged. This removes a copy-format rigidity, not the
  publishing and safety boundaries that protect usable output.
- Planner version
  `llm-carousel-structure-2-flexible-seed-writer-v9-plain-white-story-text`, story schema
  `carousel-structure-2-flexible-story-v5-plain-white-story-text`, and format metadata
  `carousel-structure-2-formats-v4-expanded-copy-centered` identify this contract. These
  source changes are not live until the updated Carousel worker is deployed and
  a production Structure 2 batch is verified.

## 2026-08-25 Progressive Trending Delivery and Carousel Assignment Binding

- Daily Trending slots remain the ordered, durable source of truth. A resolved
  slot is public immediately; another slot being planned, preparing, failed, or
  unavailable must not hide a ready Carousel, Hook, or Wall-of-Text idea.
- The feed returns only resolved items, in the existing durable order. It uses a
  whole-screen failure only when there are no usable ideas at all. A partial
  failure is isolated to that slot, while planned/preparing slots may continue
  through their normal background path.
- A new local day does not reuse a Carousel assignment from an earlier date.
  The legacy Carousel feed may recover only a same-day assignment that was
  created but not attached during an interrupted request. The unified feed's
  per-`feed_id` Carousel binding index remains compatible with historic rows;
  new work does not use it to carry an idea into another day. Hook and Wall
  assignments remain globally unique.
- Feed status is derived from durable slots under the same per-user/day
  advisory lock used for assignment attachment. A delayed failure update cannot
  overwrite a feed that already has ready slots, and the migration normalizes
  legacy stale `failed` statuses without changing user content assignments.
- This is a Trending availability and recovery decision only. It does not
  change Carousel structures, CTA flexibility, source selection, rendering,
  swipe decisions, plan allowance, or worker generation contracts.

## 2026-08-25 Trending Video Deck Presentation Boundary

- In Trending review, Hook and Wall-of-Text use an in-media format pill and
  may show one inert, subtle right-side preview of the next video card. This
  is a visual cue only; the existing horizontal swipe decisions, preloading,
  and accessibility boundaries remain unchanged.
- A next Carousel is never shown in that video-side preview. When Carousel is
  active, it retains the existing centered multi-layer review treatment and
  its external format pill. Carousel generation, source data, slide controls,
  editing, scheduling, and readiness behavior are unchanged.

## 2026-08-25 Bound Hook Assignment Integrity

- A current-day Hook assignment that is bound to a `ready` daily Trending slot
  is part of that user's durable pack. A later Hook refill may supersede only
  unbound active Hook assignments; it cannot retire an assignment that the
  daily-feed reader still needs to display.
- The database enforces this boundary for every Hook writer through the
  assignment-state transition itself, rather than relying on one refill caller
  to remember the rule. The rule applies equally to Free, Starter, and Growth
  plans.
- The rolling repair reopens only today's `ready` Hook slots whose linked
  assignment was already superseded. It leaves the old assignment as history,
  preserves every decided slot, and lets the normal prepared-feed attachment
  path bind an eligible active Hook. It neither deletes user content nor adds
  posts beyond the plan's existing durable slot count.

## 2026-08-25 App Screenshot Signed Upload CORS Contract

- Settings and the Trending Carousel editor upload app screenshots directly to
  the configured GCS media bucket through a V4 signed `PUT` URL.
- Browser uploads send only the signed `Content-Type` header. They do not send
  `Cache-Control`; production bucket CORS did not authorize that request header,
  so its preflight omitted CORS response headers and the browser surfaced only
  `TypeError: Failed to fetch` after the API had already created a pending row.
- The GCP foundation CORS contract includes `Cache-Control` as an allowed shared
  header for forward compatibility, while the current screenshot upload keeps
  the smallest required request-header surface. Failed uploads continue to
  archive their pending owner-scoped database row.

## 2026-08-25 Durable Trending Delivery Reconciliation

- The `daily_trending_feed_slots` table is the immutable delivery ledger. A
  feed is complete only when it has exactly `daily_limit` physical positions
  and every one is decided. Re-entering the daily-plan reservation is therefore
  an idempotent repair for a missing position; it preserves formats already
  promised at existing positions and never deletes or recreates decided work.
- A `ready` Hook or Wall assignment is pinned to its daily slot across safe
  mutable-source changes (prompt/version or Creative Assets selection). A
  genuinely retired assignment, deleted/ineligible source asset, or missing
  provider item reopens only that undecided slot for normal replacement. A
  provider outage cannot reopen a slot because reconciliation requires a
  successful provider read.
- Every successful Hook, Wall, Carousel-plan, and Carousel worker completion
  atomically writes a durable Trending-reconciliation outbox record in the
  same database transaction that marks the source job complete. The worker
  attempts the signed internal application call immediately; a failed call is
  rescheduled from that durable record with capped exponential backoff and is
  drained by the authenticated background-job recovery scheduler. Browser
  polling is only a read mechanism, never the trigger that advances completed
  backend work.
- The recovery scheduler also finds current feeds whose physical slot count is
  not exactly `daily_limit`. This repairs a historical interrupted 9/10 (or
  analogous 19/20 and 49/50) feed even after its last existing card is swiped,
  without marking it complete or waiting for another browser refresh.
- A content-plan record is marked failed only after its owning background job
  reaches a terminal failed state. Retriable worker errors leave the plan
  generating. The Wall-of-Text content planner also uses the supported model
  defaults rather than sending an unsupported temperature override.
- Deploy this as one compatibility slice: apply migrations
  `20260825140000_harden_trending_daily_delivery.sql` and
  `20260825153000_make_trending_delivery_reconciliation_durable.sql`, deploy
  the app route, then deploy both AI-generation and Carousel workers (the
  latter requires the internal URL and secret environment variables). Enable
  the authenticated background-job recovery scheduler only after its deployed
  route passes a production check; it is required for durable retry when all
  immediate callback attempts fail. Verify a Free canary plus Starter and
  Growth canaries on the authenticated production Trending flow. Existing
  content remains untouched; only unresolved current slots can be repaired.

## 2026-08-26 Carousel Expanded Copy Capacity and Centered Placement

- The automatic Carousel writers now treat more complete copy as permissible,
  rather than forcing the short one-to-two-line output that had become the
  common result. This doubles the maximum capacity only; it does not double a
  minimum or force every slide to be longer.
- Structure 1 accepts up to 100 headline characters / 16 words on every slide.
  Slide 1 body copy accepts up to 240 characters / 40 words, while each body on
  Slides 2-5 accepts up to 300 characters / 50 words. The body word ceilings
  are publishing gates; lower word targets remain guidance. CTA copy remains
  capped at 68 characters and each list item at 88 characters. At the fixed
  44px type size, the rendering caps are four headline lines, eight Slide 1
  body lines, ten body lines on Slides 2-5, two lines per list item, and eight
  lines for a complete list group.
- Structure 2 accepts up to 720 story characters and 360 CTA characters. Its
  fixed 44px caps are twelve story lines and six CTA lines. When both groups
  are present, the stricter square-canvas combined-safe-area calculation is
  also a publishing gate, so the doubled independent caps cannot create an
  unsafe or clipped slide.
- Structure 2 format word maxima now provide the doubled advisory reference:
  28 words on the opening slide, 60 words on slides two through four, and 64
  words on slide five. The existing lower word targets remain unchanged and
  word ranges remain writing guidance rather than a copy-replacement rule.
- New automatic Structure 1 and Structure 2 slides place text in the vertical
  center. Structure 1 no longer selects top/bottom placement from text mode or
  slide type, and Structure 2 no longer selects upper/lower placement from
  story role, asset role, or slide number. In Structure 2, an optional CTA
  travels with its story as one centered text block instead of remaining
  bottom-anchored. Existing immutable renders are not rewritten, and an
  explicit editor placement remains user-controlled.
- Fixed typography, measured wrapping, direct white headline/body/list/story/CTA
  text, no-shrink, no-truncation, human-image safety, and all five-slide format contracts remain
  unchanged. New versions are
  `llm-carousel-planner-v36-followup-copy-50`,
  `social-plain-text-renderer-v16-followup-copy-50`,
  `llm-carousel-structure-2-flexible-seed-writer-v9-plain-white-story-text`,
  `carousel-structure-2-flexible-story-v5-plain-white-story-text`,
  `carousel-structure-2-formats-v4-expanded-copy-centered`, and
  `story-native-renderer-v5-plain-white-story-text`.
- Structure 1's balanced line selection uses bounded dynamic programming with
  the same rag and short-final-line scoring. This prevents a valid 50-word
  follow-up body from causing exponential render time while preserving the
  renderer's measured-fit decision.
- This is a local source decision. It is not live until the worker is deployed
  and new Structure 1 and Structure 2 output is verified through the
  authenticated production Trending flow on `https://www.getugcpilot.com`.

## 2026-08-26 Unified Plain SVG Text Treatment

- Structure 1 and Structure 2 now use the same direct-white-text SVG
  treatment: fixed 44px Geist SemiBold type, a restrained black outline, and no
  white text background. Structure 1 retains separate headline/body/list/CTA
  groups and Structure 2 retains its story/CTA groups; this changes only their
  visual treatment.
- The shared Carousel text outline is 3px black at 72% opacity with rounded
  joins. It is deliberately stronger than the former 2px treatment while
  remaining lighter than the 4px Wall-of-Text outline.
- Structure 1's connected white headline bubble, black headline text, bubble
  shadow, and text-pixel containment retry are retired for new renders. Both
  structures preserve their existing measured wrapping, line caps, safe areas,
  centered automatic placement, no-shrink/no-truncation policy, and explicit
  editor positioning.
- Existing rendered images are immutable. The new renderer applies only to new
  Structure 1 generations and explicit Structure 1 edit re-renders after the
  worker deployment and production verification.

## 2026-08-26 GCP Worker Demand Scaling Boundary

- All HTTP Cloud Run workers use request-based CPU allocation. Their instances
  start only when Cloud Tasks delivers an HTTP job and may scale to zero when
  the queue is idle; a minimum instance count of zero is intentional for the
  current testing/early-production cost boundary.
- AI generation has an initial ceiling of ten single-concurrency instances and
  its Cloud Tasks queue may dispatch up to ten jobs concurrently. This is a
  controlled burst limit, not a guarantee that every provider generation will
  finish within two minutes. Any increase requires provider-quota and
  production latency verification.
- Carousel remains request-based but fixed at one concurrent worker and one
  Cloud Tasks dispatch. Its idea/assignment reservation is not yet safe for
  parallel Carousel writers; scaling it above one would risk duplicate or
  conflicting Carousel assignments.
- Every task-serving Cloud Run service explicitly sends 100% of traffic to its
  latest healthy revision. This prevents a historical revision pin from
  leaving a successful Carousel, social-publish, or video compatibility-worker
  deployment ready but unable to receive new Cloud Tasks jobs.
- Long video rendering is authoritative only through `ugc-video-render-job`.
  Each Cloud Run Job execution starts for one durable render and exits when it
  finishes. The legacy video HTTP service remains a request-based,
  zero-minimum compatibility receiver until the deployed task URL is verified
  to use the internal Job launcher. It must not be configured with idle,
  always-allocated CPU.
- Cloud Tasks' video-render limits throttle app launcher requests, not active
  Cloud Run Job executions. Before increasing parallel video launch capacity,
  introduce a durable database render-slot gate so a burst cannot create an
  unbounded number of paid Job executions.

## 2026-08-26 Atomic Carousel Batch Ownership

- A `generate_carousel` background job remains one five-Carousel experiment
  batch; no second Carousel job type or duplicate job table is introduced.
- Before Cloud Tasks can deliver that job, one service-role database transaction
  creates or reuses its deterministic job record, binds the exact five existing
  generation rows, their experiment assignments, and their five already-reserved
  content-plan items. The job ID is recorded on every one of those records in
  the same commit.
- The transaction locks only its own experiment batch. Different users and
  different batches remain free to prepare concurrently. A second request for
  the same batch returns the original job instead of taking ideas a second time.
- If the app stops before Cloud Tasks delivery, the database still shows the
  complete owner/job relationship. Recovery can redeliver that same job; it
  cannot create duplicate Carousel ideas or attach a different batch's ideas.
- A queued job with no recorded delivery is immediately eligible for a safe
  send on the next preparation attempt. The delivery claim is compare-and-set,
  so two observers may race to recover it but only one can send the task.
- The preparation path also repairs the narrow interrupted-write case where a
  generation row exists but its experiment-assignment link was not yet written.
  A conflicting existing link fails closed.
- This removes the database-ownership blocker for later controlled parallel
  Carousel workers. The deployed/local Terraform concurrency remains one until
  this migration, app code, worker compatibility, and a concurrency load test
  are deployed and verified together. Scaling is a separate rollout, not part
  of this database change.

## 2026-08-28 Controlled Demand-Scaling Safeguards (local, not deployed)

- The future scaling target is up to ten concurrent demand-driven workers for
  Carousel, long video rendering, and social publishing. This is a capacity
  ceiling, not ten permanently running servers: Cloud Run remains at zero when
  there is no work.
- Before any queue or Cloud Run limit is increased, long video rendering uses a
  database-backed pool of ten render slots. A launcher must hold one durable
  slot before it starts a Cloud Run Job; a duplicate task sees the existing
  lease instead of starting a second render. Slots are released only when a
  launch fails or the durable background job leaves active processing.
- Social publishing remains parallel across different connected accounts, but
  each platform/connection pair has one durable account lane. A second post for
  the same account waits and retries without consuming a provider-failure
  attempt. This supplements—not replaces—the existing per-target publish
  idempotency operation.
- Carousel batch ownership remains the existing transaction keyed by experiment
  batch. A ten-way database concurrency canary must prove that one batch gets
  one job and its exact five ideas, while ten distinct batches get ten separate
  jobs. The local contract tests validate the transaction shape only; the
  database canary is a deployment gate, not proof from a unit test.
- Planned rollout after deployment and canaries: retain capacity 1 initially,
  then raise queue and service limits together to 2, then 5, then 10 while
  monitoring duplicate ownership claims, provider errors, queue age, and cost.

## 2026-08-28 Immediate Terminal Carousel Replacement

- A terminal `generate_carousel` failure for daily Trending inventory writes a
  durable reconciliation-outbox record immediately. Manual and non-daily
  Carousel failures do not start Trending preparation.
- A partially completed five-Carousel experiment job is never replayed as a
  whole. Completed generations remain immutable and failed generations remain
  diagnostic history; reconciliation calculates the true remaining daily-feed
  shortfall and reserves fresh candidate indexes for that shortfall.
- A confirmed terminal background-job state bypasses the older 15-minute refill
  repair cooldown. The cooldown remains for ambiguous queued or processing work
  so a slow healthy worker is not mistaken for a failure.
- Repeated failure notifications remain idempotent through one outbox row per
  source job, the locked daily-refill reservation, batch-local candidate-index
  uniqueness, atomic experiment-job ownership, deterministic Cloud Tasks, and
  the worker claim token. This changes recovery latency only; it does not change
  daily allowances, content formats, Carousel structures, rendering, or visible
  completed work.

## 2026-08-26 Same-day Upgrade Reconciliation

- A same-day paid upgrade appends the complete paid pack to the feed already
  promised for that day. Free-to-Starter therefore reserves 30 total slots and
  Free-to-Growth reserves 60 total slots under the current product rule.
- After that append, the stored daily feed size is authoritative for every
  later ensure and worker reconciliation. The current plan's base allowance
  must not shrink a 30-slot feed back to 20 or a 60-slot feed back to 50.
- Reconciliation preserves the stored formats and physical positions, repairs
  only unresolved work, and does not grant the paid pack a second time.

## 2026-08-26 Paid Activation Prebuild

- A successful Starter or Growth subscription activation now writes one
  idempotent `paid_trending_prebuild` background job in the same database
  transaction as the billing subscription. Cloud Tasks delivery happens only
  after that transaction commits, so a Dodo retry cannot create a second paid
  pack.
- The prebuild worker re-reads the current subscription and profile before
  calling the existing unified daily-feed preparation. A cancelled or replaced
  plan is skipped; a valid same-day Free-to-Starter or Free-to-Growth upgrade
  still uses the existing 30- or 60-slot reconciliation rule.
- This does not enable the daily replenishment scheduler. It prepares the
  current paid pack immediately after payment activation; future-day prebuild
  remains a separate, explicitly controlled rollout.

## 2026-08-27 First-Visit Trending Walkthrough

- After a completed business onboarding, an owner who has not yet completed
  the Trending walkthrough sees one auto-playing desktop canvas
  at the top of the real Trending feed area on their first visit. Its compact
  internal header reads `How our Trending feed works` and keeps the Skip
  control at the right, separated from the visual stage by one quiet
  divider. It has no surrounding tutorial copy. The walkthrough is an
  independently positioned right-hand video panel instead of a normal layout
  column or a full-feed overlay. The underlying Trending state remains fully
  visible and usable without a blur, tint, or black scrim. The completion
  timestamp is
  owner-scoped on `business_profiles`; once the animation completes it records
  idempotently, so it is not a browser-only or global preference.
- The guide reuses the real Hook and Wall-of-Text preview media from the
  landing-page swipe demo, plus its Slideshow imagery. The distinct landing
  `DEMO.mp4` screen recording is used only for the dragged Hook demo and its
  resulting composition preview; it must never reuse the Hook source. It uses a
  desktop-native visible gesture sequence: a natural hand pointer swipes the
  review card right without decorative motion lines or placeholder destination
  cards. The canvas deliberately omits the mock browser chrome, sidebar, and
  empty side regions, keeping only the media and the contextually relevant
  action surface; for Hook a cursor drags
  demo footage into the composition slot; then the cursor tip lands inside the
  Schedule button, clicks it, and the scheduled post appears. The Wall-of-Text
  and Slideshow formats visibly swipe right and schedule in the same canvas.
- Once that visual sequence completes, it keeps the real Trending workspace
  unblocked and starts a two-step coach mark rather than only flashing the
  controls. First, a small pointer card anchored to the real item-level `Edit`
  control says `Edit this post` and explains that it changes the copy, media,
  or layout of the post being viewed only. Then a matching card anchored to
  `Adjust` says `Adjust future content` and explains that it changes the mix
  of future Trending posts, not the current post. The active control receives
  the existing restrained glow, and the customer advances with `Next` then
  `Got it`; there is no dimmer, scrim, layout change, or replacement
  walkthrough container. A fresh feed can still be preparing when the canvas
  finishes, so the coach mark waits for a real active `Edit` button instead of
  silently timing out before its explanation can be shown. Content preparation
  continues through the normal Trending feed request throughout.
- Migration `20260828113000_backfill_existing_trending_walkthroughs.sql` marks
  profiles that existed at this release as complete. Profiles created after
  that migration retain the null completion timestamp and are the first users
  eligible for this education. The completion remains owner-scoped and
  idempotent after `Got it` or Skip.
- The walkthrough is absolutely anchored to the right edge of the feed and
  occupies zero layout width. It never adds a second or duplicated generation
  status card. The real feed retains its full-width layout, so its loading or
  `Generating for you` state and real pending-slot count remain centered at the
  exact same page position they use without the walkthrough. The walkthrough
  canvas stays 640px wide; on narrower viewports the page may clip its outside
  edge instead of shifting or shrinking the real feed. It disappears after
  completion or Skip. It is mounted above the feed's loading, empty, and
  preparing branches so progress refreshes cannot unmount or restart it.
- The visual canvas has a fixed internal heading strip and divider so the Skip
  action and the walkthrough purpose remain stable while scenes change. The
  media, gesture, demo, and scheduling surfaces are centered as one composition
  inside the taller stage below that header. Skip immediately records the
  walkthrough as complete and removes only the guide; it must not abort, pause,
  or replace the background Trending feed request or its generation work.
- The walkthrough is anchored to the bottom-right edge of the available feed
  viewport as an independent video-like surface. It is not vertically centered
  or top-aligned beside `Generating for you`: its lower edge meets the end of
  the real feed area and bleeds 12px downward and 16px rightward through the
  feed's inner gutter, while the generation state stays centered in that full
  area. Its developer preview preserves the same relationship. The page stays
  locked to the dynamic viewport so any allowed edge clipping cannot create a
  stray document scrollbar.
- The walkthrough is eligible only at a viewport width of at least 1024 CSS
  pixels. Phone-sized viewports do not fetch, mount, animate, or record the
  guide as complete; the same owner can therefore receive the first-visit guide
  later on a laptop. On supported laptop widths the canvas is pinned by its
  right edge, and the fixed header's Skip button cannot shrink, so any permitted
  narrow-width clipping occurs on the canvas's left side rather than cutting
  off Skip.
- The desktop canvas remains capped at 640px wide so the walkthrough stays
  focused instead of spanning the workspace, but its height may grow to 500px
  when the viewport permits. The visual stage uses all remaining height beneath
  the fixed header and re-centers each scene within it, rather than stretching
  the canvas width or leaving the media crowded against the top. Its main
  dropped-demo frame uses contain fitting so the complete supplied demo stays
  visible instead of being cropped. Hook, Wall-of-Text, and Slideshow labels
  occupy a separate compact row above their 9:16 media frame and must never
  overlap creator captions inside the media. The developer preview always runs
  the complete swipe gesture; the authenticated walkthrough still respects an
  owner's reduced-motion preference. One continuous sequence clock advances
  every preview, swipe, demo, and schedule scene so a frame render cannot reset
  or stall the walkthrough.
- An accepted swipe never ends on a context-free tick. The Hook acceptance cue
  pairs its check with `Add demo`, while Wall-of-Text and Slideshow pair theirs
  with `Schedule post`, matching the action shown immediately afterward. Scene
  layers crossfade for 420ms so the prior result remains visible while the next
  action arrives. Slideshow frames preload when the walkthrough mounts and each
  image fades into the fixed media frame, preventing a black first frame or a
  hard cut between slides. The final confirmation reads `You're ready` instead
  of displaying an unexplained check alone.
- This is product education only. It does not fetch, decide, save, edit,
  upload, create a draft for, or schedule a real Trending creative. The daily
  feed continues preparing normally behind the guide, and the user reaches the
  unchanged real Trending workspace as soon as the canvas completes; the
  unobtrusive coach mark remains only until they acknowledge the two controls.

## 2026-08-27 Free Trial Entitlements

- Free access is a one-time three-day trial that begins when a user completes
  the current business onboarding. It reserves at most ten Trending content
  slots on each of at most three daily packs. Paid Starter and Growth access
  bypasses this trial ledger and retains the existing same-day upgrade rules.
- Existing product profiles are backfilled with an expired trial, including
  incomplete profiles so they cannot receive a fresh trial by resuming old
  onboarding. Their existing feed items and scheduled posts are not deleted or
  cancelled, but new free preparation is blocked until they upgrade.
- A free trial may create no more than five Instagram schedule targets in total
  during its active window. The schedule target is counted when it is created,
  including when its publication date is in the future; cancelling it does not
  restore the trial slot. The database locks the user's trial record while
  counting, so concurrent schedule requests cannot exceed five.
- Entitlement checks occur before normal app preparation and again in database
  triggers for daily feed creation and Instagram schedule target insertion.
  Existing ready content remains readable, but an expired trial may not trigger
  more background preparation.

## 2026-08-30 Carousel Edit Preview Parity and Immutable Slide Reuse

- The Carousel editor keeps the immutable rendered image until a user changes
  that slide. Once a drag or copy edit requires a live preview, both Carousel
  structures use the renderer's direct white, 44px Geist SemiBold text with a
  3px black 72%-opacity outline. The retired white SVG text rectangles and
  white line pills must not return in the editor, because a position-only edit
  must preserve the same visual language as the saved creative.
- A Carousel edit render reuses the original immutable `rendered_url` and
  `rendered_s3_key` for a slide whose source asset, copy, normalized position,
  and visual role are unchanged. It renders and uploads only changed slides,
  while still saving one complete ordered output containing every slide. This
  reduces a Slide 1 Hook-library update from a serial five-slide render to the
  one changed slide without changing the final asset contract.
- Carousel next/previous controls advance from the latest stored slide index,
  not an index captured by an earlier render. Their full pointer interaction is
  isolated from the deck swipe gesture, so an edited Carousel can navigate
  immediately while its immutable edited slide URLs are displayed only after
  the render state is ready.

## 2026-08-30 Daily Feed Recovery and Planner Shortfall Handling

- A unified daily feed remains `preparing` while any reserved slot is pending,
  even when earlier positions are already visible. The client continues
  polling until the pending count reaches zero, then backs off to a one-minute
  cadence aligned with the server recovery scanner. A partial pack is useful
  content, but it is not a terminally ready pack.
- The recovery scanner claims feeds with stale unassigned `planned`,
  `preparing`, or `failed` slots even when the physical slot count equals the
  daily allowance. It re-enters the existing idempotent Carousel, Hook, and
  Wall preparation paths; it never replaces `ready` or `decided` assignments.
  Claims are bounded and, after repeated stale passes, only still-unassigned
  stale slots become `failed` with a durable diagnostic instead of spinning
  forever.
- Carousel and Wall content-plan duplicate validation is shortfall-aware. When
  a model response contains only duplicate ideas, the affected five-item
  brief(s) are regenerated while valid briefs in the same chunk remain intact.
  Structural or safety validation errors still reject the chunk for normal
  retry handling. This preserves complete five-item brief groups and does not
  alter the writer queue's concurrency-one guard.
- A completely unconsumed Carousel reservation may reopen only when its five
  original generation rows never received a writer job. It re-leases those
  exact five plan items and returns the jobless failed rows to `processing`;
  it never substitutes different ideas or restarts a durable writer job.
  A partially consumed daily refill is never reopened. Its completed items
  remain immutable and a terminal shortfall creates a fresh successor refill
  batch for the missing feed positions only.
