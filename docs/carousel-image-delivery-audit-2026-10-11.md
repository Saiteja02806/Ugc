# Productivity carousel image use and delivery audit — 2026-10-11

The supplied images are present and completed slide records use their assigned images. However, image rotation measures reservations, not successful delivery to each user. Failed renders, unused completed inventory, and cycle changes can cause repeated images before a user receives the full pool. The editor's Hook library is also separate from the automatic image pool.

## Scope and verification

Read-only production audit on October 11, approximately 14:45–14:56 IST:

- Rehashed all **586 remaining productivity source files**, including 48 part-3 files, and matched exact SHA-256 values against all 1,338 backend assets with source hashes.
- Traced **3,785 productivity image reservations** across **645 carousels and 15 business profiles**, through slides, assignments, daily feeds, and saved Library records.
- Ran the application's actual image-read and storage-readiness functions against production. All **608 completed carousels** passed readiness. The other **37 image-reserved carousels** failed.
- All **3,565 completed slides** match their reserved asset ID and slide number. There are **zero role mismatches**, **zero hooks outside slide 1**, and **zero duplicate asset IDs within a carousel**.
- Twelve sampled rendered images from the four latest completed carousels returned HTTP 200 with image content types. The real production domain returned 200.
- Production is READY at deployment `dpl_Uc4rAU1xyMq6QEEi6trJBvPpCM4A`, commit `e4cd22228b72e9b0c41f5cc3cd00e860082f281b`. Relevant read, feed, and Hook-library files match that release after normalizing line endings.

The 645-carousels count covers generations with productivity image reservations; failures before image selection are counted separately below.

## Are the supplied images used?

| Ordinary productivity role | Active unique images | Assigned at least once | In a complete carousel linked to a user feed |
| --- | ---: | ---: | ---: |
| Hook | 59 | 21 | 21 |
| Human body | 239 | 239 | 239 |
| Static body | 132 | 132 | 132 |

All **392 active older images** have reached a ready feed-linked carousel somewhere across the user population. This does not mean every individual user received every image.

The **38 new part-3 hooks** are approved, active, readable, and eligible, but have **zero reservations** at this snapshot. Import finished October 11 at **14:32:36 IST**. The last generation using productivity images started October 11 at **00:50:27 IST** and completed at **00:52:27 IST**, before the import. Zero usage is therefore not evidence of a failed import.

Generated carousels and the saved daily pack keep their existing backgrounds. Importing new images does not replace already-rendered backgrounds. A new selection must happen before the new hooks appear automatically.

## Every source file is accounted for

The accompanying CSV records source path, exact hash, backend category/role, canonical source and asset ID, reservations, completed slides, and feed placements for each remaining image. Duplicate files share one canonical asset's counts, so summing CSV counts would double-count use.

- **532 file copies** map to active productivity assets represented in ready user feeds.
- **40 file copies** map to the 38 new hooks with no assignments yet; two are exact duplicate copies.
- **11 retained copies** match retired hashes and remain blocked for new selection.
- **2 files** were omitted as requested: the unrelated painting and lower-resolution café duplicate.
- **1 productivity hook copy** was globally deduplicated into the **gym** hook pool. It exists but cannot be chosen as a productivity hook: `productivity_hook/hook1 (2)/ChatGPT Image Aug 10, 2026, 12_28_20 PM.png`. Its SHA is `694c5027f68fd06a1a1195d627009b06873e17205f90fe480be53f097e6b3de4`. The gym canonical asset has six completed carousels and four server-marked deliveries. This is a category-access gap from global deduplication.

Two static-folder images are exact copies of human-role images and use human canonical rows. Six part-3 hook-folder images are exact copies of existing human-role images; the import preserved their body roles and existing history. They are used, but are not additional hook choices.

The 40 wrong images remain archived and excluded. **No reservations occurred for them after retirement.**

## Confirmed delivery and repetition problems

### Failed generations consume freshness

The live `reserve_carousel_role_assets_v2` checks previous use through `carousel_image_usage.usage_type = 'assigned'`. It does not require a completed generation, a feed assignment, or delivery.

The **37 failed image-reserved carousels consumed 220 reservations**: 37 hook, 74 human, 74 static, and 35 product-asset placements. Thirty-five failed with the Structure 2 slide-metadata constraint on October 9; two older failures were text-fitting errors. These historical failures were not caused by the part-3 import.

Concrete example: profile `c79a8b99-3f2a-45f5-9638-3ba03d9e97ee` has ready feed-linked carousels using **131 of 132** active static images. **54 of those images have repeat deliveries**, while the missing image exists only in a failed generation for that profile:

- Source: `not been/productivity_static/pinterest_013.jpg`.
- Asset: `338572aa-dd08-4bce-90be-80c637bd7131`.
- Failed carousel: `4d9a014b-3d60-489e-a0bc-172c693ec823`.
- Error: “Carousel text could not fit within 4 lines at the fixed 44px font size.”

That profile also has four human images reserved only by failed generations. This directly supports the reported problem: an image can count as used without becoming a delivered slide.

### Completion is not feed delivery

**50 of the 608 completed carousels have no user-carousel assignment.** Of 558 assigned carousels, 555 have a server first-shown marker; three are pending without one. There are 557 unified-feed links and 558 legacy-feed links.

Completed inventory may legitimately await later delivery, or fall outside the current profile version or concept selection. This audit does not label all 50 as lost. It establishes that reservation and rendering are insufficient evidence of delivery to the current feed.

### The same daily pack can repeat an image

There are **27 image/day/profile combinations** where one asset appears in different carousels of the same daily pack: **20 static, 5 hook, and 2 human**, across two profiles and 11 packs.

The allocator prevents repeats within one carousel and one role cycle. It has no daily-pack exclusion; a new cycle can start while preparing the same pack.

Example: profile `90d2fc5e-0af2-47f7-925b-9795832125f0`, September 15: `not been/productivity_static (12)/pinterest_010.jpg`, asset `b1f72226-081d-48b4-9e6f-a02d26091afa`, appears in carousels `195c54ab-8992-496e-b246-6c011a68648d` and `60b55469-b3bf-4065-b4b1-62af1d5031d0`. Their reservations are in **cycles 1 and 2**.

No assignment was carried into multiple daily packs in the audited set. These repeats are different generated carousels reusing an image.

### Different users start with the same recent images

Rotation is per business profile, category, and role. Fresh assets are ordered by `created_at DESC, id`. Global use count does not rank selection. New profiles can therefore receive the same newest images even after other profiles received them.

There are zero active exact-hash duplicate groups. The current reservation function does not exclude byte-different images through a perceptual duplicate family.

### The manual Hook library is disconnected from the automatic pool

The deployed editor calls `/api/trending/carousel-hyper-hooks`. This returns the **15 packaged Hyper Hooks** from `lib/carousel/hyper-hook-library.ts`; it does not query the productivity role pool.

The part-3 import does not synchronize that manual library. Automatic generation and the user's Hook-library choices are separate flows.

## Additional backend failure

Job `03838628-5612-4bd8-86dd-138fa445b12e` failed October 11 at **00:27:40 IST**:

> Could not resolve the Carousel batch to Structure 2: canceling statement due to statement timeout

Five linked marketing-SaaS carousel rows are failed, with **zero image reservations**. This happened before image selection and is separate from the 37 image-reserved failures above. The most recent carousel job completed October 11 at **00:52:29 IST**. There were **zero active generate_carousel jobs** when checked. A later successful job does not prove this timeout path is fixed.

## Changes needed

1. Track delivered image use separately from reservations; prioritize failed or undelivered images while preserving retry idempotency and archived-source exclusions.
2. Exclude recently delivered images across the daily pack, including cycle boundaries.
3. Connect the manual Hook library to reviewed eligible category hooks if uploaded hooks should be selectable there.
4. Support exact duplicate availability in each intended category without unsafe duplicate rows or rewriting usage history.
5. Investigate the Structure 2 batch-resolution database timeout.

No allocator, worker, production data, deployment, or customer content was changed during this audit. Reports remain local as requested.

## Evidence limits

`first_shown_at` is a server availability marker written during feed preparation, not a browser impression. The read-only feed path does not record individual image views. This audit verifies generated records, runtime readiness, feed linkage, and sampled image availability; it cannot prove that a user actually viewed every slide.

Raw snapshots, runtime verification, source reconciliation, live reservation SQL, and per-profile analysis are under `.tmp/carousel-image-delivery-audit/`.

