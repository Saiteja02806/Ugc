# Carousel image functionality verification

Checked 2026-10-11, through 10:12 UTC / 15:42 IST.

The reviewed repair passes the tested allocation, image-editing, permission,
retry and existing-output scenarios. Production database changes were applied
before the user deferred publication. The website and worker changes remain
local, as requested. No repair branch was pushed and no website or worker
deployment was created.

## Functional results

| Function | Result | Current activation |
| --- | --- | --- |
| Active productivity sources | 60 eligible hook, 239 human and 132 static backgrounds; all 38 part-3 hook sources are ready | Production database |
| Recovery of images held by failed jobs | Failed-only reservations no longer count as successful delivery; the previously missed `pinterest_013.jpg` ranks before already-delivered static images for the affected profile | Production allocator |
| Diversity within a daily pack | Live rollback-only allocation selected 30 distinct backgrounds for five six-slide carousels, including five part-3 hooks; no retired source was selected | Production allocator |
| Stable retries | Every repeated reservation returned the same assets and metadata; existing historical claims were retained | Production allocator and regression tests |
| Limited image pools | Tests allow reuse between carousels only as a fallback when eligible alternatives are exhausted; each carousel keeps distinct images | Allocation tests |
| Safe retirement | All 40 rejected sources remain inactive/archived and excluded; reservation replays still refuse retired backgrounds | Production database and regression tests |
| Existing carousels | All 608 previously completed productivity carousels remain application-ready, with 3,565 visible slides and no incomplete completed carousel | Read-only production queries through the actual application code |
| Reviewed Hook picker | Both structures can select a reviewed category hook, preview it, restore the original, and save it on slide 1 without changing other slides | Local browser fixtures; website deployment deferred |
| Background replacement on all six slides | Owned uploads can replace each slide independently in both structures; text and other backgrounds stay intact | Real save-normalizer tests and local browser upload checks |
| Save permissions | Foreign/incomplete carousels, unavailable image IDs, inappropriate slide roles and submitted replacement URLs are rejected or resolved from trusted server data | Local route/save tests |
| Structure 2 takeover | The previously timed-out batch successfully converted all five assignment/generation pairs in a rollback-only production probe; the repeated call returned an identical result | Production database |
| Transient database retries | Worker repeats the same atomic RPC at most three times for lock contention, timeout, serialization failure or deadlock; invalid requests are not retried and planning is not rerun | Local worker; deployment deferred |
| Shared source identity | The exact Gym-hook image supplied in both folders is explicitly eligible for productivity without duplicating the source record; existing human classifications are preserved | Production database; refresh-preservation change local |

## Safety evidence

Before and after the migrations and rollback probes, full-row checksums matched
for all 1,893 generation records, 7,121 slides, 4,693 image-usage records and
872 user assignments. Asset checksums excluding the deliberately changed
review metadata also matched for all 1,341 assets. Historical source bytes,
render URLs and reservations were not deleted or rewritten.

The production probes intentionally raised a diagnostic exception to roll back
all test allocations and temporary generation state changes. Their success
payloads were:

```json
{"retired":0,"selected":30,"part3_hooks":5,"retries_stable":true,"distinct_assets":30}
{"mode":"planning_fallback","pairs":5,"structure":"structure_2","retries_stable":true,"requested_structure":"structure_1"}
```

The real application query successfully returns 60 unique productivity Hook
choices with valid dimensions. Exact duplicate bytes are deduplicated when
category and packaged choices are combined. Both allocation RPCs retain their
previous security mode and deny anonymous/authenticated direct execution.
Completed image-usage records show zero unexpected role/slide mismatches.
No active carousel generation/edit job was present during the checks.

## Local validation

- 56 focused checks pass across image retirement, role reservation, reviewed
  category hooks, upload/save authorization, Structure 2 takeover and bounded
  worker retries.
- The main workspace passes TypeScript checking and the worker build after
  the repair is merged into the existing local changes.
- The isolated repair passes TypeScript, scoped ESLint, worker build and a
  complete Next.js production build using Webpack. The first local Turbopack
  build hit its dependency-junction filesystem restriction; the successful
  fallback build does not imply the unrelated local changes received a full
  combined website build.
- Both Structure 1 and Structure 2 browser fixtures pass Hook selection,
  preview, restore and Save, plus pending-upload Save blocking, captured slide
  targeting, failure/retry, preview cleanup and late upload completion.
- Existing reports and the earlier retirement migration filename correction
  remain local. The scoped repair commit is
  `41e05b0531ee030a5c4542cc4fcd6c83fdade312` in the attached worktree on
  `codex/carousel-image-delivery-repair`. Its source changes are also present in
  the main workspace, preserving unrelated UI/font edits.

## Production status and remaining acceptance

The applied migrations are
`20261011095743_carousel_delivery_aware_image_rotation.sql` and
`20261011095929_carousel_structure_takeover_lock_retry.sql`.
Production website code remains `e4cd22228b72e9b0c41f5cc3cd00e860082f281b`;
the carousel worker remains revision `ugc-carousel-worker-00110-lpb`.
The category Hook picker and bounded worker retry implementation therefore
must not be described as available to production users yet.

No paid render was launched, no failed customer job was requeued, and no new
customer feed content was permanently created. Historical failed jobs retain
their original status. Feed delivery means a completed carousel has a server
feed link, not that a person has viewed it. Global equal exposure and perceptual
duplicate exclusion are not guarantees of this repair.

The database takeover probe succeeds, but it does not prove the exact original
cause of the intermittent timeout or reproduce production contention. Browser
checks use isolated HTTP fixtures. A signed-in check on
`https://www.getugcpilot.com` and one real generation/save/render acceptance
flow remain appropriate after the user deploys the combined changes.
