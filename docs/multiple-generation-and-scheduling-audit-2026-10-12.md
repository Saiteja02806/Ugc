# Multiple generation and Schedule preparation audit

The additional changes in this audit are local. The user requested that
deployment be deferred. No production migration, new paid generation or social
publication was performed for this follow-up.

## Quantity findings

| Screen | Existing behavior | Local correction |
| --- | --- | --- |
| AI character | Counts 1, 2 and 3 create independent image jobs atomically | Preserve the existing count behavior; show partial results and the actual model |
| AI Studio images | Counts 1, 2 and 4; count 3 normalized to 1 | Offer and accept 1, 2, 3 and 4; reject malformed counts before reserving credits |
| AI Studio videos | Counts 1, 2 and 4; count 3 normalized to 1 | Same count correction; create a separate video/job ID for each output |
| Talking Head + Demo / creator-phone | Counts 1, 2 and 4 in UI, submission, receipts and database | Add 3 consistently, including atomic reservations and recovery |
| Hook video / Wall of Text | Shared video quantity settings and independent video jobs | Add 3 to the actual rendered control and API |
| Slideshow image generation | Quantity means versions of the selected slide, independently of reference/slide count | Add 3 versions and retain every job/result ID |

The two-image request confirmed by the user did create two jobs. The provider
accepted one and rejected the other through moderation; the rejected candidate's
credit was released. Its durable model was ChatGPT Image 2.5. Details are in
`character-partial-generation-2026-10-12.md`.

The shared quantity list previously contained `[1, 2, 4]`; its normalization
explicitly reduced 3 to 1. Talking Head's atomic endpoint rejected 3, and the
database receipt constraint/RPCs also excluded 3. Updating only the dropdown
would therefore be insufficient.

The local patch retains four-output compatibility, adds three-output requests
through every screen boundary, and rejects 0, 5, fractional, string and null
quantities instead of silently starting one generation. Omitted quantities
retain the existing single-output default. Character requests retain their
existing 1–3 maximum.

The separately reviewed MCP generation API retains its existing counts
`[1, 2, 4]`. Its capabilities response now uses the same constant as its own
input/output schema, so the expanded screen settings cannot advertise an MCP
count that its API rejects. The MCP read/discovery compatibility checks pass.

Successful admission is not a guarantee of provider success. Each admitted
image/video has its own worker operation and can succeed or fail independently.
The ordinary AI Studio APIs already disclose partial admission on a credit/queue
failure; the Talking Head atomic API commits the entire batch or nothing.
Recovery must keep all acknowledged job IDs and must not submit missing paid
outputs automatically. Selecting multiple videos creates alternatives; scheduling
uses the chosen opening and its attached demo. It does not automatically create
multiple social posts.

## Schedule preparation findings and corrections

Schedule still requires an owned ready publishing file. A browser preview is
not a publishing asset. Removing this requirement would risk publishing stale
or missing trims, text and audio.

Three avoidable waits were found:

1. The Format workflow passed its preparation trigger only while Schedule was
   active. Applying Demo edits did not start the final preparation. The local
   change triggers preparation on the explicit Apply demo edits action and
   keeps the trigger available outside Schedule. It never submits on hydration.
2. Opening-only finalization could run a new join render despite already having
   the finished opening. The local change reuses the ready unmodified opening.
   Talking Head can also reuse a single ready source with no selected effects.
   Existing pending/uncertain receipts are recovered first. Completed older
   requests do not force a new render for a different unchanged source.
3. At the standard 20% gain, a saved Demo track was mixed in its own job, then
   the mixed Demo was joined in another job. The existing final-join contract
   already supports owner-validated Demo-only audio. The local change sends the
   saved track and explicit once/repeat mode to that join, removing one worker
   stage and intermediate upload/download. Custom-volume and demo-only requests
   retain their sound stage to preserve gain and timing exactly.

Recovered Format joins also compare the current owned Demo audio selection,
including removal, and its playback mode against the saved receipt. A changed
selection cannot expose the older audio-bearing publishing file as current.
An opening without a Demo cannot attach a leftover Demo audio selection.

The Schedule helper now tells the user they can choose accounts, caption and
time while the publishing file prepares. Final confirmation continues to wait
for the verified output. Existing stage status/recovery/cancel controls remain
available. Queue wait, cold startup, large uploads and optional subtitles still
affect elapsed time; no maximum preparation time is promised by local checks.

## Validation and later release

The combined focused run passed 343 behavioral/API/client/SQL tests. A later
Schedule draft run passed all eight tests, including one added regression that
posting settings stay editable during preparation and survive the final-file
transition. A final 38-test finishing/preparation run passed, including two
additional regressions for audio removal after reload and opening-only audio
selection. This gives 346 distinct focused checks. The tests use
the actual parsers, request handlers, rendered selector callbacks and local
PostgreSQL transactions, with external provider calls replaced by fixtures.
They cover both 2 and 3 outputs, all supported Talking Head provider models,
distinct output IDs, replay, atomic rollback for insufficient total credits,
existing-receipt compatibility, RLS/service-only access, terminal moderation,
mixed-batch recovery, unchanged-video reuse and owned Demo audio in the join.
TypeScript and scoped ESLint pass. Another 23 real local FFmpeg composition and
finishing checks passed: Demo-only added audio, explicit once/repeat, independent
original speech, whole-video music, unchanged inputs and subtitle timing across
both clips. These checks confirm the existing join contract used by the faster
path. Full local production compilation could not be confirmed: both the root
build and an isolated source snapshot hit Windows EPERM while creating Next.js
output directories. No permissions were weakened or build artifacts deleted.
The later release still needs a successful full build and hosted acceptance.

Apply `supabase/migrations/20261012172333_explore_three_output_generation.sql`
before releasing the updated Talking Head website. This additive migration
changes the quantity constraint and the two existing RPC validators; the
transaction locks, owner checks, fingerprints, all-or-nothing reservation and
service-only privileges remain intact. It is created and tested locally and
has not been applied to production.

The follow-up changes require a website release and that database migration.
The Demo audio optimization uses the already-supported worker contract, so it
requires no new worker deployment. Authenticated acceptance of new three-output
requests and hosted Schedule timing is deferred until the user's deployment.
No additional fix was pushed or deployed for this follow-up.

## Quantity recheck — 2026-10-13

At the user's request, the current code was traced again from the selected
quantity through distinct job/output IDs, receipts, recovery and result lists.
A fresh focused run passed all 199 quantity/API/client/database/character/result
checks. The worker build then passed, and 32 actual image/video worker checks
passed with provider and storage fixtures. No live paid provider request was
made. This verifies the local count handling and worker contract; it does not
guarantee provider approval or replace hosted acceptance after release.

The count fix addresses three-output normalization and rejection. The user's
original two-image request already created both jobs; moderation caused its
partial result. The error-display fix makes that failure clear but cannot
force the provider to return a blocked image. Production three-output support
still requires the prepared migration and website release.
