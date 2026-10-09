# Carousel and slideshow production verification

Checked on 10 October 2026, approximately 01:40 IST (9 October, 20:10 UTC).
This was an inspection: no production data, configuration, deployment, schedule,
or publishing state was changed. Existing production activity continued during
the audit, so the counts below are snapshots rather than final totals.

## Verdict

The slideshow changes are included in the deployed application and worker.
Production is **not fully healthy**: new automatic Structure 2 carousels encounter
database persistence failures, copy-validation failures, and reservation conflicts.
Existing-carousel editing has succeeded on the new worker, but that does not
establish that automatic generation or every new upload workflow works.

The inspected story is Trending/Explore slideshow UI -> authenticated API ->
Supabase durable state -> Cloud Tasks/Cloud Run -> rendered slide storage ->
saved output and frontend polling.

## Deployment evidence

- Remote main and the release branch both resolve to
  `526f26a20ca50326220d87885c033393addafcaf`.
- Vercel production deployment `dpl_J2N8tsHf11e14XonKuXtpkciwEgY` is READY,
  with `getugcpilot.com` and `www.getugcpilot.com` assigned. Its exact source SHA
  is `526f26a20ca50326220d87885c033393addafcaf`, and its ready timestamp is
  `2026-10-09T20:06:50.103Z`.
- The per-slide upload commit `19f2fe7` is an ancestor of that deployed commit.
- Carousel Cloud Run revision `ugc-carousel-worker-00107-qd5` is Ready and
  serves 100% of traffic. Minimum and maximum instances are both 1, and
  container concurrency is 1.
- Worker source is `3f352026e9ecefeba5877242738efdc65b3d86b1`, built by successful
  Cloud Build `afee5a4d-f94a-485a-beb7-b3e3ef03aaf3`. Its immutable image is
  `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:b7b0e5eccb3337ce27970fdb2af6c8b1bfd1b66164e9c928a89abb6ac3167f2d`.
- AI generation, video render and social publish services also serve that
  image/SHA at 100%. `worker/src` has no diff between that worker commit and
  the latest deployed website commit; the different SHAs do not indicate a
  slideshow-worker source mismatch.
- `EXPLORE_SLIDESHOW_SAVING_ENABLED` is true in production. The
  `explore_format_workflows` migration is recorded under version
  `20261008071155`; `explore_save_slideshow` exists and is executable by
  `service_role`, with authenticated execution denied. The Library slide
  generation ID column is nullable as required by owned Explore slideshows.

Some implementation documents still say local/not deployed. Those historical
statements do not describe the current deployment metadata above.

## Confirmed production problems

### 1. Structure 2 screenshot persistence disagrees with the database

The worker explicitly requires Slide 6 to use the product screenshot when one
is available (`worker/src/lib/carousel-structure-2-render-spec.ts:177`). The
live `carousel_slides_structure_2_metadata_check` permits `product_asset`
only when `slide_number` is 4 or 5 and eligibility is allowed/preferred.

The database therefore rejects the worker's Slide 6 screenshot rows. Supabase
Postgres logs contain **9 actual PostgREST constraint failures** between
`2026-10-09T20:02:44Z` and `2026-10-09T20:09:00Z`. The failing-row details
include Slide 6, `story_product_reveal`, `product_asset`, and `preferred`.
Nine generation records from after the new worker became ready store:

> Could not store carousel slides: new row for relation "carousel_slides" violates check constraint "carousel_slides_structure_2_metadata_check"

This is a concrete worker/database contract incompatibility. The old 4/5
restriction also exists in the repository's baseline SQL, so its mere presence
is not proof that the latest deployment introduced it. A reviewed additive
migration must align the database with the intended six-slide product rule,
retain ownership/eligibility checks, and be tested against real inserts before
claiming recovery.

### 2. New generation is failing copy validation even after repair

At the inspected snapshot, **11 other Structure 2 generation records** created
after `2026-10-09T19:36:53Z` were failed on copy validation. Examples include
multi-statement/oversized Slide 1 hooks, more than four lines at fixed 84px,
body/takeaway copy outside the 14–30-word range, and generic copy. Their errors
explicitly say isolated LLM repair was exhausted.

The combined snapshot has 20 failed Structure 2 generation rows (9 persistence
plus 11 copy failures), with five Structure 1 and five Structure 2 rows still
processing. These are generation records, not 20 failed batch jobs or a
customer-level failure-rate estimate. Improving writer/repair adherence needs
live model acceptance; passing mocked writer tests cannot establish that.

### 3. Failed-batch recovery hits a reservation conflict

Vercel logs show `carousel_content_plan_reservation_idempotency_conflict` in
`/api/trending/feed` and `/api/internal/trending/reconcile`. Postgres logs
record **10 occurrences** after the worker rollout, latest at
`2026-10-09T20:08:08Z`. A feed request also hit Vercel's 60-second runtime
timeout at `2026-10-09T20:04:24Z`; correlation alone does not prove the conflict
caused that timeout.

Recent released content reservations have zero consumed items and five
previously dispatched generation records. The live reservation lifecycle
rejects reopening a released reservation with a non-null dispatched generation
reference. That is consistent with a failed-batch replay conflict, although
the exact request/reservation pairing was not captured for each log record.
Recovery should preserve idempotency while creating or selecting an appropriate
replacement batch, rather than repeatedly reopening dispatched failed work.

## Verified working and limits

- Two edits of the same existing six-slide slideshow completed on the new
  worker. Latest edit `951bbb43-5733-41a9-9708-0849f3f8b23e`, revision 2, is
  persisted as ready; job `e271ad8c-8058-4b87-9efe-ec36857d3f08` completed.
- Its output uses
  `story-native-full-frame-product-inter-tight-v13-normalized-edit-v3`.
  The changed hook was rendered and all five unchanged slide URLs were reused.
  HEAD requests to all six output files returned HTTP 200, `image/webp`, and
  positive content length.
- Rendering took about 3.1 seconds. One edit waited about 230 seconds before
  claim; another waited less than a second. A warm worker does not remove
  contention with generation jobs under one-instance/one-concurrency settings.
- The successful inspected edit uses the Hook library. It is not proof of an
  end-to-end manual upload on every slide. No ready media rows with project
  `trending-carousel-slide` or saved Explore slideshow Library items were found
  in the relevant inspected queries.
- Fresh local runs passed `test:trending-slide-images` (11/11) and
  `test:trending-edit` (37/37). These cover controlled implementation boundaries,
  not the failing hosted generation/database path.
- The real production Explore slideshow page rendered its workspace opening
  state and redirected the signed-out inspection browser to sign-in. No
  authenticated upload/save/publish acceptance was performed, no paid generation
  was started by this audit, and no customer scheduling was changed.
- Vercel ordinary runtime logs retain only about one hour on this project's
  plan. Supabase production logs and durable records supplied the additional
  evidence. General Node deprecation/listener warnings and signed-out probe
  messages were not treated as slideshow failures. An invalid-payload canary
  job (`023a0085-3e17-4083-b048-641b109e8a20`) was explicitly excluded from the
  customer-generation findings.

Repair priorities: align Slide 6 persistence with the schema, correct
failed-reservation recovery, then verify real copy generation and queue latency.
After repair, accept the complete authenticated flow on the production domain.

## Follow-up: hook-slide text activation

The hook presentation changes are deployed and active in the website and
Carousel worker revisions verified above. Shared source defines fixed 84px
Inter Tight Bold 700 cover text, a maximum of four measured lines, one text
block/statement, and no cover subtitle, supporting paragraph, heading pill,
or CTA. Both renderers use this treatment and the editor uses the shared
constants. New writer guidance aims for 6–14 words; the hard accepted range
is 5–14. This is not controlled by a separate typography enable flag.

Live generation metadata confirms
`llm-carousel-structure-2-writer-v21-single-statement-social-hook` and the
new v12/v13 renderers have run in production. However, a direct query found
no completed automatic carousel using either new structure's renderer at
this check. Failed generation and persistence remain the acceptance limit;
the presence of new version metadata is not a completed-generation result.

There is a successful actual production edit demonstrating the appearance:
edit `1b3e3026-2a09-4ce7-b115-9ad25eb90e29` is ready, with
`story-native-single-statement-hook-inter-tight-v12-normalized-edit-v1`.
Its hook reads "social media advice you should ignore" as one centered,
white, bold block spanning two lines, without a supporting paragraph or
pill. The production output and its original v11 image were retrieved and
visually inspected, with local evidence under
`.tmp/hook-text-production-20261010/live-hook-84px.webp` and
`original-hook-72px.webp`. This is a real stored production result, not a
locally generated demonstration. Its ready timestamp is
`2026-10-09T17:35:55.12525Z`.

Existing saved images are immutable and do not automatically acquire the
new presentation. The current compatibility helper preserves 72px when
only the image or position changes and the original hook text is unchanged
for known Structure 2 v11 / Structure 1 v25 sources. Changed text and
current/unknown sources use 84px. Latest ready edit
`951bbb43-5733-41a9-9708-0849f3f8b23e`, revision 2, retains the exact original
hook text and a v11 source renderer, so it falls under that 72px rule even
though its output has the newer v13 normalized-edit-v3 label. Renderer
version alone cannot establish that every legacy edit uses 84px.
