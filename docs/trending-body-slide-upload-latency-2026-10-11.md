# Trending body-slide upload and save latency — 2026-10-11

## Scope and conclusion

Production investigation and subsequent local repairs for Trending → slideshow → Edit → replace a body-slide image → Save Edit. The owner confirmed that both the editor's Uploading state and Trending's Updating state were slow.

Production records include a replacement for **Slide 5**, using an **18,211-byte image**. The dominant observed delay was slow Supabase Data API/database responses. During the incident the UI waited for entire upload confirmation before showing a preview, and the edit worker waited on database checkpoints while processing changed slides sequentially.

The production investigation was read-only. Local application repairs and regression tests are now recorded in the final section; they have **not been deployed**. No schema, infrastructure or production data was changed.

## Production evidence

The affected uploads occurred on **October 11, approximately 12:29–12:33 AM IST** (October 10, 18:59–19:03 UTC). The save completed around **12:34 AM IST**.

The website deployment inspected through the Vercel production aliases was READY at commit `4ab55bbee69b637930931ebfde01ea6cba568a5a`. At the initial investigation the upload/helper and edit-render files inspected had no working-tree differences from that commit. Subsequent local repairs are described below.

### Uploading in the editor

The latest saved edit contains these four uploaded body backgrounds:

| Slide | Asset ID | File bytes | Asset creation → stored readiness timestamp |
| --- | --- | ---: | ---: |
| 2 | `50a8512a-0e28-4dc1-abf9-aea001075f37` | 31,243 | 4.659 s |
| 3 | `d1c802f9-2357-46d0-bc1a-bbdfd7af0230` | 85,807 | 14.375 s |
| 4 | `530ee40d-0f65-49ab-babb-9c783818137a` | 29,916 | 33.807 s |
| 5 | `eb589e0f-c704-47f6-bf12-fcf9cb5fb543` | 18,211 | 17.503 s |

**These intervals are not browser stopwatch measurements.** `updated_at` is constructed before the readiness UPDATE is sent, so it does not include that UPDATE's full response time. `created_at` is written during the preparation request, whose response can also be delayed. The intervals must not be added to individual request durations below.

Supabase edge logs identify actual delays on the upload path:

| Request | UTC start | Data API origin time | Upstream service time |
| --- | --- | ---: | ---: |
| Slide 3 asset lookup | 19:00:08.142 | 11.519 s | 10.477 s |
| Slide 3 ready UPDATE | 19:00:19.713 | 1.540 s | 1.246 s |
| Asset INSERT during Slide 4 preparation | 19:01:12.430 | 38.337 s | 38.086 s |
| Slide 4 ready UPDATE | 19:01:54.160 | 0.980 s | 0.685 s |
| Slide 5 asset lookup | 19:02:12.816 | **13.671 s** | **13.185 s** |
| Slide 5 ready UPDATE | 19:02:26.609 | **3.746 s** | **2.632 s** |

The preparation INSERT is correlated by the surrounding asset timestamps and request sequence; INSERT logs do not expose its asset ID. The Slide 3/4/5 lookups and updates are directly identified by their asset IDs in request filters.

A preceding 31,243-byte upload (`5e82ad31-e75d-4e0b-81d7-2520abc0f189`) also had a readiness PATCH return **500 after 28.649 seconds**, and its asset record remains `uploading`. A later replacement succeeded. This is additional evidence of server/database trouble during the same session.

An EXPLAIN of the Slide 5 ID lookup uses `media_assets_pkey`, with an estimated one-row index scan. The table has approximately 782 live rows. The evidence does not justify treating a missing primary-key index or large image bytes as the cause.

### Save Edit → Trending update

Edit `a8d81b7f-7196-4bec-b076-51a8306e0f4d`, revision 3, dispatched job `8717207f-4834-48ad-9290-f1d49ebfc791`:

| Stage | UTC timestamp / duration |
| --- | --- |
| Job created | 19:03:14.805678 |
| Job started | 19:03:37.578834 |
| Creation → start | **22.773 s** |
| Job completed | 19:04:21.930062 |
| Start → completion | **44.351 s** |
| Creation → completion | **67.124 s** |

The creation-to-start interval includes dispatch preparation and job claiming; it is not evidence that the worker spent all 22.773 seconds sitting in a busy queue.

Cloud Run logs confirm that this save rendered **slides 2, 3, 4, and 5**, and reused **slides 1 and 6**. All four body backgrounds had been replaced in this revision. Rendering four changed slides is expected; this sample does not prove unnecessary rerendering of unchanged slides.

The same job's awaited Supabase checkpoint PATCH requests took **4.024 s**, **10.889 s**, **3.981 s**, and **9.529 s**. Its final edit-ready PATCH took another **3.316 s**. These are API request durations, not pure image-render durations, and should not be added to the overall job interval again.

The dedicated `ugc-carousel-edit-worker` was already deployed at revision `ugc-carousel-edit-worker-00002-7hw`, with minimum instances 1, maximum instances 1, concurrency 1, and 100% traffic. The affected job ran on that revision. The previous scale-from-zero / shared-generation-worker diagnosis is therefore not the explanation for this particular body-slide save.

### Database condition during the incident

Supabase PostgreSQL logs contain **29 statement timeouts** between 18:58 and 19:05 UTC. They include Carousel plan/feed operations waiting on row or advisory locks, and timezone initialization. This supports a broader period of database/API slowness and contention, beyond the image-upload endpoint.

This investigation establishes where time was spent. Follow-up PostgREST logs confirm connection-pool acquisition timeouts (see the final section), but the exact cause of that pressure—long-held connections, resource constraints or pool capacity—still requires incident-time resource/pool metrics. Lock waits elsewhere also do not prove that the Slide 5 primary-key SELECT itself was waiting on a row lock.

Current query statistics and performance advisors were inspected. Historical cumulative statistics cannot reconstruct this seven-minute incident. Missing foreign-key indexes flagged on unrelated edit relationships do not demonstrate the cause of this owner/asset-ID lookup.

## Why the interface makes both waits visible

1. `lib/ai-studio/reference-media-upload.ts` decodes local image dimensions, prepares an owned upload, transfers the file directly to GCS, and then calls `/api/media/complete-upload` in sequence.
2. Completion loads the owned asset from Supabase, verifies the GCS object's type/size, and updates the database record to ready. It does not call an AI image generator or image-analysis provider.
3. `components/trending/carousel-slide-image-section.tsx` calls `onUploaded` only after that entire sequence resolves. There is no immediate local-file preview for the replacement, so database confirmation time appears to the user as image-upload time.
4. Save Edit queues server rendering. `worker/src/jobs/render-trending-carousel-edit.ts` iterates through changed slides one at a time. Each changed slide awaits rendering, a database progress checkpoint, and output upload. A slow checkpoint can stall the next slide even after image composition has finished.
5. Trending shows the original complete carousel until the revision is ready. The replacement is composited with the saved text/layout before it becomes the authoritative slideshow. Status polling runs once per second and can itself be delayed by slow API responses.

## Proposed safe repairs

1. **Address the database/API bottleneck first.** Correlate the incident's pool/CPU/I/O metrics and lock-holder traces. Reduce duplicate feed/reconciliation work and expensive transactions only where profiling proves they contribute. Do not simply extend timeouts or add arbitrary indexes.
2. **Show an immediate local preview while the upload is confirmed.** Capture the target slide ID, manage/revoke the object URL, display upload/error state, and keep Save disabled until the server confirms an owned ready asset. A preview must not masquerade as a persisted upload.
3. **Reduce awaited progress writes on the interactive edit path.** Keep durable claim/revision/readiness guards and meaningful progress, while avoiding a separate blocking database round trip for every intermediate cosmetic state. Verify retries and stale-revision handling before changing this path.
4. **Measure each stage explicitly.** Record metadata decode, preparation, PUT, ownership lookup, storage verification, ready UPDATE, save/dispatch, render, checkpoint, and output upload durations without recording credentials or signed URLs.
5. **Evaluate bounded changed-slide processing only after profiling.** Preserve original/previous-render reuse, output ordering and complete-revision readiness. Do not increase worker or database write concurrency as an unmeasured workaround.

Acceptance should cover a single Slide 5 replacement, multiple changed body slides, interrupted upload/retry, navigation during upload, stale edit revisions, text fidelity, and scheduling only the confirmed rendered revision. Confirm on the authenticated production flow after any eventual rollout.

## Verification limits

Evidence came from production database rows, Supabase edge/PostgreSQL logs, Cloud Run worker logs/settings, deployed-source comparison, and read-only query planning. No replacement was uploaded or saved on the owner's behalf. Browser transfer/paint timings were not available. Vercel runtime-log retention did not cover the incident at the final inspection; its empty recent window is not evidence of fast requests.

## Follow-up code audit: concrete implementation order

The follow-up review identified additional avoidable database work and the implementation order below. The first local repairs are now implemented as recorded in the final section; none have been deployed.

1. **Use a small status response for polling.** `trending-workspace.tsx` currently calls the history editor GET once per second for pending revisions. That GET verifies assignment access and rebuilds default editor content: the saved edit, generation, slide rows, and original background assets are loaded again. This is at least five database reads before any extra runtime/source checks. A status endpoint should retain owner/assignment checks but return only revision, state, timestamp and error while pending. Fetch the full confirmed edit once when it becomes ready, retaining stale-response guards. This reduces avoidable load; it does not prove that polling alone caused the incident.
2. **Batch ownership lookups on Save.** `getOwnedCarouselSlideImages` starts one lookup per distinct replacement asset. Replace this with one bounded owner-scoped query for the submitted asset IDs, retaining ready/type/purpose/deletion/dimension checks and rejection of missing/foreign assets. The current implementation already runs the individual queries concurrently; the benefit is fewer database requests, not removal of a serial loop.
3. **Add the local-file preview independently of confirmed content.** Maintain a temporary preview keyed by captured slide ID. On success replace it with the server-confirmed asset; on failure restore the prior background and show retry. Revoke object URLs on replacement/unmount. Save remains disabled while confirmation is pending.
4. **Make checkpoints smaller before changing their frequency.** `updateJobStage` returns the complete background-job row, although its production caller only needs to know whether the guarded update succeeded. Return the ID only while preserving the claim-token/status predicates and cancellation fallback. The per-slide checkpoint is also a job-ownership check, so simply deleting it or ignoring its promise is unsafe. Any later coalescing must preserve ownership, cancellation, heartbeat and final readiness checks.
5. **Profile database pressure and verify timing.** Correlate pool/resource metrics with lock waits and repeated reconciliation/timezone work. Apply workload or capacity changes only after identifying that cause. Measure real upload completion and save-to-ready duration, separately from local-preview paint time. Keep the already deployed warm edit worker and changed-slide reuse.

Regression coverage should include delayed confirmation (preview visible, Save blocked), failed completion (old image retained), changing the selected slide during upload, batched foreign/missing-asset rejection, cancellation/lost claim during checkpoint writes, and stale polling responses. After a rollout, repeat both a single Slide 5 replacement and a four-body-slide save on the authenticated production domain. No latency target or production improvement is claimed before these measurements.

## Local implementation and additional profiling, 2026-10-11

The user authorized implementation locally in small steps and regression testing before any deployment. No production upload, edit, scheduled post, migration, pool setting or deployment was created during this implementation.

Implemented:

- `GET .../edit?view=status` authenticates the request and checks readable owned assignment access, then selects only `id,revision,render_status,render_error,updated_at` for the owned Carousel. Pending polls avoid loading default content, generation, slides and background assets. A full history read follows readiness; discovery of a newer revision also requires its full content. Successful completion stops polling. Requests do not overlap and unmount aborts them. Stale/foreign/incomplete completion responses retain the last preview and retry, rather than marking old output ready.
- Save verifies distinct submitted media IDs with one owner-scoped `IN` request, bounded to 20 distinct IDs and excluding deleted rows. Existing image readiness, upload purpose, MIME, dimensions, trusted URL, catalogue, Hook-library and app-screenshot rules remain in effect.
- Choosing an image immediately creates a temporary object URL for the captured slide ID. The preview shows **Uploading image…**, with Save and dismissal blocked during confirmation. The preview is separate from saved content and is revoked on success, failure and unmount. Changing slides does not retarget an upload. Failed confirmation leaves the prior background unchanged and allows retry; late completion after navigation is ignored.
- `updateJobStage` returns only the guarded updated job ID. Claim token, allowed status, heartbeat, cancellation/lost-claim fallback, per-slide checkpoint frequency and final readiness fencing remain. This reduces response payload; it does **not** remove checkpoint round trips or promise to eliminate their historical waits.

Additional read-only incident profiling found **five `PGRST003` connection-pool acquisition timeouts** at 18:59:34.933518, 18:59:40.577189, 19:01:38.275772, 19:01:46.747162 and 19:01:52.188174 UTC, within the same seven-minute incident window. This confirms connection acquisition pressure, alongside the PostgreSQL statement timeouts and lock waits already recorded. Six statement timeouts explicitly occurred while feed reconciliation awaited its user/date advisory lock. Other records identify content-plan advisory locks and Wall generation chunk row locks. These observations are correlated with the upload incident; they do not prove that its simple media SELECT itself held or awaited those locks.

The current production project reports `ACTIVE_HEALTHY`; a bounded `pg_stat_activity` check found no non-idle or blocked sessions at that later snapshot. The known edit's small status SELECT returned revision 3, ready, without content/output. A read-only query plan for the owner/deletion-scoped media-ID lookup uses `media_assets_pkey`. Incident-time CPU/I/O and pool occupancy metrics remain unavailable, so increasing pool size, changing database capacity, or rewriting unrelated transactions remains a separate evidence-driven follow-up. Reducing request volume addresses confirmed avoidable pressure without weakening ownership or readiness.

Verification:

- Local browser harness runs the real Trending editor and upload section against isolated HTTP fixtures, with no production writes. At 1366×680 and 1536×760 it verifies immediate pending preview, blocked Save, Slide 5/6 switching, captured upload target, confirmed-only Save payload, failure restoration/retry, object URL cleanup and ignoring late completion after unmount. Screenshots were visually inspected. The viewport sizes are representative browser dimensions, not a claim that physical laptop size alone determines CSS layout.
- API/database tests cover authentication, no caching, owner/assignment scope, status-only columns, one bounded media query, failed reads, current full completion and rejection of old/foreign/incomplete output. Existing image normalizer tests cover both structures, all six replacements, missing/foreign/deleted/unready assets, original restore and Hook/app-screenshot compatibility.
- Worker build and processor/edit-render tests cover cancellation, lost ownership, retry/recovery, edited body-slide reuse on later Hook changes, changed-slide rendering and complete output. Checkpoint tests verify the smaller ID response and retained guards/heartbeat/null cancellation fallback.
- Library scheduling-path tests reject pending/failed/incomplete or temporary output, then accept the full current ready edit and its new images/copy/revision. Existing render-finalization tests reject stale/incomplete callbacks and prevent duplicate scheduling. These are isolated readiness regressions, not an actual future provider post.
- The final combined suite passed **41 application/API/database tests and 40 worker tests**, plus the real-component browser scenarios. The scoped and final full application TypeScript checks and worker build passed. An earlier full check found errors in concurrent Explore work; those were resolved by that work before the final check. No Explore fix was made in this latency task. ESLint reports no errors in the changed files; the existing worker `_id` unused-variable warning at `worker/src/lib/supabase.ts:4036` is outside the changed checkpoint.

Reproduce the combined local regression suite with `npm run test:trending-edit-latency`. Browser launch may require execution outside the Windows sandbox. Generated bundles, logs and screenshots remain under `.tmp` and are not release artifacts. Production acceptance and actual upload/save-to-ready latency measurements remain pending a separately requested deployment and an authenticated test on `https://www.getugcpilot.com`.

## Follow-up risk audit, 2026-10-11

The user's five controls were reviewed in the current worktree and their regressions rerun. The changes remain local. No deployment or production write was performed during this audit; existing incident evidence was used without issuing additional production diagnostic queries.

| Change | Audit result |
| --- | --- |
| Lighter status polling | Authentication, readable owned assignment scope, no caching, revision/timestamp rejection, retries after failed reads and a complete final fetch remain. A transient draft transition that could stop polling was found and fixed below. |
| Batched image verification | One request covers at most 20 distinct media IDs under the authenticated owner, excluding deleted rows. Every returned upload retains ready/image/purpose/MIME/dimension/storage checks. Missing IDs must resolve through the existing server-controlled Hook/app-screenshot rules or Save rejects them. Client-supplied image URLs do not authorize replacements. Upload completion still verifies the stored object type and size before marking it ready. |
| Immediate preview | The object URL remains separate from saved content and bound to the captured slide ID. The UI displays Uploading, blocks Save and dismissal until confirmation, restores the previous image after failure, supports retry and revokes temporary URLs. Confirmed-only Save payloads, slide switching and ignored late completion after unmount passed in the real-component browser harness. |
| Smaller progress updates | Only returned columns changed to the job ID. Claim-token/status predicates, checkpoint frequency, heartbeat, null-result cancellation/lost-claim handling and final edit revision/job/owner readiness checks remain. Processor regressions verify that cancellation and loss of ownership stop output completion. |
| Database profiling | Existing bounded read-only evidence and incident logs remain the basis for the diagnosis. No new polling diagnostic, migration, capacity or connection-pool change was added. Connection acquisition pressure and lock waits are confirmed; their underlying resource cause and production improvement remain unmeasured. |

Two concrete defects were reproduced with failing regressions before local fixes:

1. **A temporary draft could stop pending polling.** Save stores a new revision as draft before attaching the render job. A pending card that observed that state, either in the status response or in a later full fetch racing another tab's save, adopted draft and stopped checking. Refresh now retains pending state and retries through this interval. Temporary draft status does not trigger repeated full editor reads; the queued/ready revision is fetched when available.
2. **Slow verification could overwrite another tab's save.** The service checked the submitted expected revision before image verification, but the storage helper reread the row afterward and could silently use another tab's newer revision as its write baseline. The submitted expected revision is now passed into storage and checked again before the guarded write. A mismatch returns 409 before mutation; the existing owner/revision predicate still rejects a save racing the final write itself. Initial saves use expected revision zero. This guard also preserves the common Hook and Wall edit storage paths.

Final verification on this worktree:

- `npm run test:trending-edit-latency`: **45 application/API/database tests and 40 worker tests passed**, plus the real editor browser scenarios at 1366×680 and 1536×760. Pending and confirmed screenshots were inspected.
- `npm run test:trending-edit`: **37 additional edit and schema contract tests passed**.
- Full application TypeScript, scoped Trending TypeScript, worker build, affected-file ESLint and tracked-change whitespace checks passed. The initial full TypeScript run reported three prop errors in concurrent Explore work; the later full check passed on the current worktree. No Explore source was edited during this audit.

These checks establish local correctness of the controls, including scheduling readiness and stale callback handling. They do not constitute an actual future provider post or a production latency measurement. Smaller checkpoint responses retain their existing database round trips, and the immediate preview improves visible feedback while server confirmation can still be delayed by database pressure.
