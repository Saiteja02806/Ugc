# Carousel System Context

Last updated: 2026-07-13

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

Both Trending and Library use the same platform-selection modal. Trending first
saves the complete carousel to the server Library, then opens the modal with the
server `libraryItemId`, source `carouselId`, and return location. Library opens
the same modal directly for server-backed items.

The current scheduling slice stops after account connection and platform
selection. It does not create local scheduling drafts, mark Trending assignments
as scheduled, choose a date or time, enqueue publishing, or publish content.
After at least one connected platform is selected, the UI confirms the selection
and closes the modal while clearly stating that no post has been scheduled yet.

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

- `calorie_tracking` -> `fitness-health`
- `gym` -> `fitness-health`
- `personal_finance` -> `personal-finance`
- `productivity` -> `productivity-saas`

Keep the original local category in source metadata for provenance and review
debugging.

The local tag-manifest command is:

```text
npm run carousel:local-images:tag -- --manual-review-approved
```

It reads the latest audit report and writes a structured manifest under
`.tmp/local-carousel-image-tags`. The manifest includes one asset entry per
visual family, inferred category tags, object tags, broad runtime bucket,
caption, quality score, duplicate-family ID, text-safe areas, and source-file
links. It does not upload files and does not write to Supabase.

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
fields, duplicate S3/hash identities, and prepared base/thumb dimensions.

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

The importer uploads original, base, and thumbnail files to S3/CloudFront under
`category-library/<runtime-category>/<broad-bucket>/<asset-id>/`, then inserts
the corresponding rows into `category_image_assets`. It checks for existing
local rows by `base_s3_key` and `source_file_sha256` before inserting, and it
preflights the remote schema before the first S3 upload.

After importing, run:

```text
npm run carousel:local-images:verify-import
```

It reads the import manifest and import result, verifies all production rows
match the manifest, and can optionally sample uploaded CloudFront URLs.

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
then existing Pexels/S3 identity.

## Daily Trending Feed

As of 2026-07-12, Trending has a first server-backed daily feed layer. The
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

Default entitlement rows are `pro` with 10 daily carousels and `ultra_pro` with
20 daily carousels. The frontend must read `dailyCarouselLimit` from the feed
response and must not hardcode plan limits.

Completion is recorded through:

```text
POST /api/trending/feed/actions
```

Allowed completion actions are:

- left swipe succeeds -> `completed_skipped`
- right swipe + Library save succeeds -> `completed_saved`
- right swipe + schedule draft creation succeeds -> `completed_scheduled`

Changing between slides, opening a card, closing the page, cancelling the
right-swipe modal, or failing a save/schedule request must not complete an
assignment.

This first feed layer reuses completed carousel generations that already exist
for the current business profile. It carries unfinished assignments forward on
the next local day and fills new feed slots only from ready, unassigned
generated carousels. It does not yet add a scheduled daily worker, server-backed
social scheduling, semantic near-duplicate concept rejection, visual-preset
rotation, or automatic generation beyond the existing carousel preparation
flow. Those should remain follow-up work before enabling high-volume Pro or
Ultra Pro daily limits in production.

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

Balanced carousel copy rules:

- A heading or hook is optional. When present, it must be 3-8 words, at most 50
  characters, use no more than two visual lines, and must not be forced into a
  single line by over-shrinking.
- Supporting content must be one complete sentence of 8-20 words, at most 120
  characters, normally render as no more than three visual lines, explain one
  specific idea, and avoid repeating the heading. List modes may use four total
  visual lines.
- The five-slide default story is Hook, Problem, Consequence, Solution, and
  Result/CTA. Because the current slide schema does not have a separate
  `consequence` slide type, consequence remains problem-style copy internally
  until the schema is deliberately expanded.
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
- `library_items`
- `library_carousel_slides`

## Trending Carousel Outputs

As of 2026-07-10, Trending is a carousel-only, owner-scoped frontend feed for
real generated carousel outputs. It reads
`GET /api/carousel/history`, which requires a Firebase bearer token and returns
only the caller's carousel generations for the caller's single business profile.

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
- The active portrait card is approximately 300px wide and capped for narrow
  mobile viewports. All slides for the active candidate and the selected slide
  of the next candidate are preloaded when the active candidate changes.
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
  advances to the next complete carousel. Schedule Post first creates or reuses
  the same server-backed Library item, then creates the current browser-local
  scheduling draft with `sourceType = generated_carousel` and opens Scheduling
  on the Drafts tab. Replacing scheduling drafts with server-backed publishing
  remains a separate slice.
- The Library content tab lists server-backed carousel Library items first. As
  a transition path for older sessions, it may also display legacy
  browser-local entries from `ugc-studio.carousel-library.v1` when the same
  carousel is not already present on the server. This compatibility display
  must not replace the server-backed save API for new saves.
- Trending is the only visible Carousel product surface in the app. Clicking an
  image, slide, dots, or slide arrows must never open a separate Carousel Ads
  workspace.
- Trending must show a clear profile-needed, preparing, ready, or
  failed/retry state. It must never fall back to static template artwork.
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
- LLM slide planner with one copy-repair pass, validated deterministic
  fallback, and `gpt-4.1-mini` as the default quality model. Generated rows
  store the raw initial/repair responses, normalized plan, planner version,
  model, source, fallback reason, validation result, and renderer version.
- Professional Sharp text renderer and AWS Carousel worker path.
- AWS Carousel worker revision 28 runs image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:carousel-20260713152632`
  from task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:28`.
  Startup metadata reports git commit
  `fa9b0a6733086d26419fcdd19a53a774e9279dc5`, planner
  `llm-carousel-planner-v16-solution-story-guard`, renderer
  `social-bubble-renderer-v7-contained-line-rectangles`, broad matcher
  `broad-runtime-matcher-v2` in `dry-run`, safety policy
  `object-only-no-human-v1`, and Geist Regular available at
  `/usr/local/share/fonts/geist/Geist-Regular.ttf`.
- Renderer `social-bubble-renderer-v7-contained-line-rectangles` replaces the
  clipped connected silhouette with one radius-safe rounded rectangle per text
  line. Rectangles overlap vertically to read as one bubble. Width is based on
  measured visible ink plus horizontal padding and `radius + 6px` corner
  safety; over-wide lines rewrap before any font reduction. A separate text
  and background mask rejects a render whenever a visible text pixel falls
  outside the white background.
- Fresh production canary `167c2dd7-8372-4d25-ad7f-26429cb428fa` completed on
  worker revision 28 with five new renderer-v7 CloudFront URLs. Its stored plan
  uses model `gpt-4.1-mini`, source `llm`, planner v16, renderer v7, and a clean
  five-step story. Visual review passed all five WebPs. CloudWatch containment
  diagnostics reported `escapedTextPixels = 0` and
  `textPixelContainmentPassed = true` on slides 1 through 5.
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
- Never overwrite a rendered Carousel asset behind an immutable URL. Rendered
  keys must change when either the renderer version or output bytes change.
- Keep the production Carousel worker font files in sync with the font family
  used for text measurement and SVG rendering.
- Update this file whenever a product rule or architecture decision changes.
