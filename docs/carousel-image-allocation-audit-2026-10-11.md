# Carousel image allocation audit — 2026-10-11

## Scope and production evidence

Read-only audit of both Carousel structures' image routing, reservation and reuse. The connected Supabase MCP project URL was verified as `https://kltxwijhluawgveykfbt.supabase.co`. The deployed database definition of `reserve_carousel_role_assets_v2(uuid, uuid, text, jsonb, boolean)` was inspected directly. Production counts below are a snapshot taken before the requested productivity asset retirement. The completed cleanup leaves 21 hook, 239 human and 132 static assets eligible; allocation policy and historical usage remain unchanged.

The relevant role planner/category resolver and fresh-first/six-slide migrations match deployed website commit `4ab55bbee69b637930931ebfde01ea6cba568a5a`. The current `worker/src/lib/supabase.ts` differs only in unrelated job progress response size; its reservation call is unchanged. This audit did not run paid image generation, modify runtime code, or mutate the database/storage.

## The actual image flow

1. The saved business context is resolved into one of six image categories: `gym`, `food`, `productivity`, `dating`, `travel`, `skin`. Explicit category terms receive higher weight than supporting description terms; unmatched businesses default to `productivity`.
2. Both content structures call the same `buildCarouselSlideImagePlan` and database reservation function. The current role library supersedes historical broad visual bucket/semantic image scoring.
3. A six-slide carousel uses either `hook, human, static, human, static, static` or `hook, static, human, static, human, static`. Role ordering is stable for that carousel ID. For productivity there is no related-category substitution, so all ordinary images come from productivity.
4. Only gym→food, food→gym and travel→food may use a related category, only in static slots, after relevance checks, at most two slots. Related pool shortage falls back to the primary static pool.
5. Structure 1 does not request an automatic product screenshot. Structure 2 requests one; when an approved screenshot owned by the business profile exists, it replaces the last static slot, which is slide 6. Without one, slide 6 remains static. Thus ordinary pool demand is one hook, two humans, and either three statics or two statics plus one product asset.
6. The database reserves all slide assets transactionally, records `assigned` usage, increments each source's global `usage_count`, then the worker renders and stores the output. Reservation is before rendering and before the customer sees or accepts anything.

## What “fair use” currently means

Rotation is scoped to **business profile + category + role**, shared by Structure 1 and Structure 2. It is not one global rotation across all users and is not controlled by an image's view count.

- Only active, ready, approved rows with a library ID, no exclusion reason and correct ownership are candidates for new reservations.
- No asset ID can appear twice in the same carousel.
- Assets never previously assigned to this business profile are selected first, ordered **newest import first**, then asset ID. This is deterministic, not randomized. New imports can therefore receive concentrated early use across many profiles and previously imported assets can wait until the fresh queue reaches them.
- Once every currently eligible asset in the role has been assigned to the profile, a deterministic hash shuffles the next cycle. The hash includes profile, category, role, cycle and asset ID. Each asset is assigned at most once in that cycle.
- On crossing a cycle boundary, the immediately previous asset is avoided if another candidate is available. There is no time-based cooldown or recent-N-carousels exclusion.
- Global `usage_count` is updated but is **not** used to select the least-used asset. Legacy/broad matcher code that ranks this field is not the current role reservation path.
- Database row locks serialize a profile's rotations; unique indexes fence duplicate cycle assignments and duplicate slide/asset reservations. Retries of the same carousel return its original complete reservation and do not select/increment a new one.

Equal per-image global counts are therefore not promised. In particular, comparing a large human pool with a smaller static/hook pool gives a misleading impression of unfairness.

## Live productivity findings before retirement

| Role | Eligible images | Reserved at least once | Lifetime reservation range | Mean reservations per image |
|---|---:|---:|---:|---:|
| Hook | 60 | 60 | 8–22 | 10.75 |
| Human | 240 | 240 | 3–17 | 5.38 |
| Static | 132 | 132 | 11–24 | 13.61 |

All 432 ordinary eligible images also appear in at least one **completed** generation. There were 608 completed productivity generations in the inspected assignment history. This disproves a library-wide claim that some current eligible productivity images have never been used, but does not prove equal exposure for a particular customer.

Fifteen business profiles have productivity rotation pools. In every role, the number of profiles that had reused an image while another currently eligible image in that role had never been assigned was **zero**. Many low-volume profiles have not exhausted their pools, as expected. There were also zero duplicate `(profile, category, role, cycle, asset)` assignments, zero exact SHA-256 duplicate groups in the eligible ordinary library, and zero same-carousel SHA-256 duplicate reservations.

Newer batches show the expected first-use concentration. The eight static images imported August 20 have 23–24 reservations each, while the 124 imported August 17 range 11–24. The 29 hook images imported August 24 range 9–22, versus 8–11 for the 31 older hooks. This is consistent with newest-first priority; exact ranking alone does not establish customer-visible preference.

## Limitations and concrete issues

**Allocation counts are not exposure counts.** All 3,785 productivity usage records have `usage_type = assigned`; none are `shown`, `saved` or `published`. Thirty-seven failed productivity generations had image reservations: 37 hook, 74 human, 74 static, and 35 product assignments. These consume rotation even when a finished carousel is unavailable. A customer can therefore see an image repeated before seeing every other image, although the reservation rotation itself has exhausted those other assets.

**Fresh-first order concentrates early exposure.** New users begin with the same most recently imported assets. Hash randomization only becomes authoritative after the fresh pool is exhausted. This is an explicit deployed policy, not a broken randomizer.

**Role and pool-size imbalance is deliberate.** With 60 hooks, 240 humans and 132 statics, hook/static sources necessarily get more assignments per image. Two human slots exhaust their pool in 120 carousels, while one hook slot exhausts in 60; three static slots exhaust the static pool in 44 (or 66 with a screenshot in every carousel).

**Unsupported businesses enter productivity.** The resolver's default can increase productivity demand beyond businesses explicitly tagged productivity. There is no per-image subject matching within that role pool; the whole approved category/role pool is eligible.

**Near-duplicate appearance has no runtime family fence.** The current allocator deduplicates asset IDs. Exact file hashes were checked and are clean for productivity, but near-duplicate images with different hashes are not blocked by the allocator. `duplicate_family_id` records the file hash and does not implement perceptual-family selection exclusion.

**Retirement must account for existing reservations.** An inactive/excluded source is rejected for new reservations, but existing reservation replay returns the row without checking current eligibility. Physical source deletion can also break historical re-render/edit flows. Before retiring or deleting sources, check active jobs and affected ready assignments/edits; keep required originals and immutable rendered outputs. Retirement must block future editor selections as well as new generation.

## Validation and sources

Sixteen relevant tests passed: category resolver, related relevance rules, and role reservation schema contracts. Production data/function inspection supplies the live evidence; local tests alone would not prove live fairness or actual exposure.

- `worker/src/lib/carousel-image-library-category.ts:128` — category resolver and productivity default.
- `worker/src/lib/carousel-image-library-relevance.ts:40` and `:49` — current six-slide role patterns; `:58` — bounded related-category mappings; `:218` — deterministic role ordering.
- `worker/src/lib/carousel-generate.ts:551` — Structure 1 shared planning/reservation.
- `worker/src/lib/carousel-structure-2-generate.ts:258` — Structure 2 shared planning/reservation with `useProductAsset: true`.
- `worker/src/lib/supabase.ts:3310` — v2 reservation RPC boundary.
- `supabase/migration_archive/pre_baseline_20260829/canonical_history/20260820054247_add_carousel_related_static_reservation_v2.sql:113` — original role allocator, locking, cycles and replay.
- `supabase/migrations/20260830190513_prioritize_fresh_carousel_images_before_reuse.sql:56` — fresh-first selection; `:87` — newest-first ordering.
- `supabase/migrations/20260905044832_expand_carousel_role_asset_reservation_to_six_slides.sql` — six-slide role ratio and static/product pool minimums.
- `supabase/migrations/20260906091416_fix_carousel_six_slide_reservation_initialization.sql` — live array initialization repair.
- `supabase/migrations/20260906093500_allow_sixth_carousel_image_usage_slot.sql` — six-slot usage constraint.

No runtime change is proposed or performed by this audit. Improving exposure fairness would require an explicit product decision about whether to rotate on reservation, successful render, actual display, or publication, and whether fresh items should be randomized across profiles.
