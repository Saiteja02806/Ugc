# Trending slideshow production root causes — 2026-10-10

Production inspection on October 10 IST (October 9 UTC). Scope: Hook library
replacement latency, Settings app screenshot use, returned Trending cards, and
related automatic Carousel generation/recovery failures. Production reads and
source inspection only; the newly diagnosed repairs below have not been applied.
This report does not claim a complete repository audit or authenticated browser
acceptance. No customer edit, schedule, paid generation or screenshot upload was
submitted during this investigation.

## 1. The latest slow hook edit waited for the shared worker

The slideshow whose hook matches the supplied screenshot, "Master your brand
storytelling effortlessly.", is creative
`9a584fe6-edf2-4d8a-9aa8-81d0483b9c97`. Matching text identifies relevant durable
records, but does not prove the screenshot's exact browser session.

Both revisions of edit `951bbb43-5733-41a9-9708-0849f3f8b23e` completed on the
released worker. Production `background_jobs` records show:

| Edit job | Created UTC | Started UTC | Completed UTC | Queue wait | Processing |
| --- | --- | --- | --- | ---: | ---: |
| Revision 1, `e4ea374d-1970-4bff-b823-846281bc1e1d` | 20:01:10.124 | 20:01:10.875 | 20:01:14.040 | 0.75 s | 3.16 s |
| Revision 2, `e271ad8c-8058-4b87-9efe-ec36857d3f08` | 20:02:12.664 | 20:06:02.336 | 20:06:05.442 | 229.67 s | 3.11 s |

Revision 2 therefore took about **3 minutes 53 seconds**, almost all before
rendering. Its saved state is ready, with six rendered slide entries and renderer
`story-native-full-frame-product-inter-tight-v13-normalized-edit-v3`. The hook
changed; the five original body slide assets were reused.

Cloud Run request logs establish continuous dispatch occupancy:

| Request | Entered UTC | HTTP request finished UTC | Request duration |
| --- | --- | --- | ---: |
| Full generation 1 | 20:01:36.809 | 20:02:55.012 | 78.203 s |
| Full generation 2 | 20:02:55.048 | 20:06:01.919 | 186.871 s |
| Hook edit | 20:06:01.983 | about 20:06:05.864 | 3.881 s |

Cloud Tasks confirms the edit was scheduled immediately at 20:02:13.061 UTC,
first dispatched at 20:06:01.945 UTC and received OK at 20:06:05.888 UTC:
**228.88 seconds from schedule to dispatch, one delivery attempt**. This proves
there was no failed delivery/backoff for this edit. The preceding request
finished immediately before the edit request entered.

Full generation and `render_trending_carousel_edit` share `ugc-carousel` and
`ugc-carousel-worker`. The live queue permits one concurrent dispatch. The
worker has minimum instances 1, maximum instances 1 and request concurrency 1;
revision `ugc-carousel-worker-00107-qd5` serves 100% of traffic. Keeping it warm
fixes the previously measured scale-from-zero wait, but does not add another
execution slot. A second queue pointing at the same one-instance/one-concurrency
service would still contend. Revision 1 demonstrates an approximately
four-second total edit when the worker is available.

There is also work after a generation's durable failure: generation job
`7d6a2dcf-c0f2-447d-9248-173cabec9a2a` was marked failed around 20:04:43, while its
HTTP request remained in flight until 20:06:01. `worker/src/processor.ts:631`
marks failure, then awaits durable-output and Trending feed reconciliation at
lines 655/664 before returning. `worker/src/lib/trending-feed-reconciliation.ts:9`
sets a 45-second timeout and up to three attempts, with one-/two-second retry
pauses. This source path is
consistent with the remaining approximately 78 seconds, but individual
reconciliation-call timings were not captured, so that breakdown is an inference.

**Repair:** give interactive edit renders a separate warm queue/worker while
preserving the existing single-dispatch generation safeguards. Move slow
reconciliation behind durable independent delivery so a terminal generation job
does not retain the only execution slot. Do not merely increase the shared
generation concurrency: the infrastructure explicitly guards reservation safety.

## 2. App screenshots render, then fail database persistence

The Settings uploads are usable: four owner screenshots are ready, approved and
active. Their landscape/portrait ratios are not the cause of these failures.

The six-slide Structure 2 contract reserves an available approved app screenshot
on **slide 6**. The live `carousel_slides_structure_2_metadata_check` instead
allows `visual_role = 'product_asset'` only on **slides 4 or 5**, with
`product_visual_eligibility` allowed/preferred. The six-slide migrations expanded
reservation, role and usage-slot contracts, but omitted this metadata check.

Three recent generations confirm the mismatch:

- `abffe0ba-3eb3-4097-acdf-3834b1289fcf`
- `549ba816-5a98-4ac1-81d4-b062ff888899`
- `4473c043-4ac6-42b2-aee2-4f4416ac4a9a`

Their image-usage records reserved an app screenshot on slide 6. Rendering/upload
completed, then inserting the slides failed with:

```text
Could not store carousel slides: new row for relation "carousel_slides"
violates check constraint "carousel_slides_structure_2_metadata_check"
```

The same constraint failure occurred on the preceding v12 renderer. This is an
older schema incompatibility exposed by six-slide generation, not a failure
caused by the latest proportional full-frame crop.

The existing slideshow in the screenshot has a separate explanation: it was
generated at 05:51:58 UTC, approximately 12 hours before these app screenshots
were uploaded at 17:49–17:50 UTC. It originally selected a static final-slide
image. Changing only the hook preserves the other five saved images; it does
not add a subsequently uploaded screenshot to that earlier slideshow.

**Repair:** add a migration permitting eligible product screenshots on slides
**4, 5 or 6**, retaining compatibility with existing five-slide rows and all
other metadata/eligibility/ownership checks. Keep automatic six-slide selection
on slide 6. Validate the persistence path before retrying affected generations.
Do not silently regenerate existing saved slides. Existing slides can be
explicitly changed through the editor.

## 3. Returned cards can retain an old Updating state

Two concrete source defects affect revisited Carousel cards:

1. On skip, `trending-workspace.tsx:2463` captures `reviewedEdit`. Rendering at
   line 2737 always prefers that snapshot over `editByCreativeId`, even when the
   live map contains a newer ready edit. A queued/rendering snapshot therefore
   keeps the old image and Updating badge visible.
2. Status polling uses the editor GET. `creative-edit-service.ts:80` calls
   `assertEditableTrendingCreative`; Carousel access in `creative-edits.ts:149`
   allows pending/in_progress/accepted. Skip changes the assignment to
   completed_skipped, so subsequent polling is rejected with 404. The polling
   catch at `trending-workspace.tsx:2162` turns all errors into null and leaves the
   last pending state intact.

These are confirmed source paths, not a reproduced signed-in browser trace of
the user's screenshot. Normal polling is serialized once per second and rejects
older revisions/timestamps; reducing that interval cannot resolve these defects
or the measured queue wait.

**Repair:** prefer the newest owned edit by revision/timestamp, using the history
snapshot as fallback. Provide owner-scoped read-only status access for historical
assignments while keeping editing/save permissions strict. Surface persistent
refresh failures and bound hung status requests. Fix both history paths together.

## 4. Later edits can rerender unchanged previously edited body slides

The worker's `getReusableOriginalRender` compares each slide only with the
original generation. Save clears `render_output_json` on the next revision.
If a body slide was edited previously, a later hook-only change rerenders that
body slide even when it is unchanged since the preceding successful edit.
Rendering is sequential. This is a source-confirmed additional latency path,
but it is not the cause of revision 2 above, which reused all five original body
slides and processed in three seconds.

**Repair:** retain a server-derived preceding ready render and per-slide render
fingerprints. Reuse an output only when all copy, image/crop, position,
layout/role, typography and renderer-version inputs match. Do not trust
client-submitted output URLs or reuse eligibility.

## 5. New automatic slideshows also fail copy validation

In the inspected ten-generation batch created at 20:01:33–20:01:36 UTC, three
failed the screenshot metadata constraint and **seven failed copy validation**.
Errors include hook paragraphs/multiple statements, more than four lines at
84px, hook/body word counts, generic language and missing first-person voice.
The errors state isolated LLM repair was exhausted. These are ten generation
records in one sampled batch, not a global failure-rate estimate.

**Repair:** make planning and repair follow the exact current slide contract,
then verify with real model output. Preserve readability and validation rather
than truncating text or silently shrinking it. Fixing screenshot persistence
alone will not resolve these failures. These slow failed generations also
occupy the queue used by interactive edits.

## 6. Failed-batch recovery has production reservation conflicts

The separate production verification report records
`carousel_content_plan_reservation_idempotency_conflict` in feed/reconciliation
logs. This confirms rejected replay attempts. The exact request/reservation
pairing and which replacement guard blocked recovery were not captured.

The live successor function already contains the latest bounded recovery,
dispatched-failed-reservation replacement and active-job guards, matching the
September 6 migration. It is therefore inaccurate to prescribe installing the
old missing-recovery implementation without further tracing. Replacement can
return null while another job is active or the recovery budget is exhausted;
the caller can then prepare the same batch using its deterministic reservation
key.

**Repair investigation:** capture the conflicting reservation ID, active batch,
job states and recovery budget in the same request. Return a clear waiting or
terminal recovery state when successor creation is disallowed; preserve existing
idempotency and bounded-cost safeguards. Avoid reopening dispatched failed work.

## Deployment status and acceptance limits

The earlier requested release was pushed and deployed as
`3f352026e9ecefeba5877242738efdc65b3d86b1`. The current production website has
subsequently advanced to descendant `526f26a20ca50326220d87885c033393addafcaf`
(Explore recovery changes). Its Vercel production deployment
`dpl_J2N8tsHf11e14XonKuXtpkciwEgY` is READY and lists both real production
domains. `worker/src` has no diff between those two commits. The Carousel worker
still serves the verified release image/SHA, so these slideshow findings are
not explained by an older worker build or a deployment omission.

That release included per-slide image uploads, full-frame screenshot crops,
legacy unchanged-hook typography compatibility, render-state badges, faster
serialized polling, Wall history preview access and scroll-settlement fixes,
and the warm Carousel instance. Those earlier fixes do not include the new
database/history/queue problems diagnosed here.

Release validation covered 218 scoped tests, web TypeScript, scoped lint,
worker build, Terraform validation and the production Next build. Public-route
smoke checks ran on the real domain. An invalid-payload no-spend canary verified
queue delivery only. Production records now establish successful real Hook
library edits; they do not establish authenticated end-to-end acceptance of
manual uploads on all six slides, new screenshot generation, scheduling or
publishing. The user cannot sign into this inspection browser.

The complete original release path manifest and every excluded local path/reason
are saved in `.tmp/trending-release-included-paths.txt` and
`.tmp/trending-release-exclusions.txt`. Secrets, local environment/infrastructure
values, caches and generated artifacts were excluded. Concurrent Explore changes
created after the release snapshot were not included in that snapshot; the later
website deployment now contains them. This new diagnostic report and the separate
production verification report were created after the release and are local
documentation, not part of that deployed release.

An extra Vercel project, `trending-release-web-3f35202`, was accidentally created
during staging. It has only a failed build and its default Vercel domain; it has
no ready deployment or custom domain. It is separate from the existing `ugc`
project and database. Automated approval rejected project deletion because
deployment authorization does not cover deleting a hosted project. The user
asked about consequences but has not approved deletion; it remains untouched.

Prioritize screenshot persistence, interactive queue isolation and history status
refresh, then copy-generation adherence and traced recovery. Validate the full
authenticated production flow before declaring the slideshow path healthy.
