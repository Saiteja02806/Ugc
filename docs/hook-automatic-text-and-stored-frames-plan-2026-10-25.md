# Hook: stored source frames and automatic text

25 October 2026. The user prioritizes these two improvements and asks to plan
them first. This is an implementation plan, not a completed feature or release.
The other Explore proposals remain outside this first delivery.

## Intended experience

1. Recreate opens the already-prepared reference frame.
2. The user chooses/reuses their current person photos, generates a starting
   image and approves the result through the existing flow.
3. Generate video includes adapted Hook text by default when a reviewed source
   and business context are available. One action starts both parts.
4. The completed result appears in the main preview with fitted, editable text.
   The initial automatic overlay is saved without a separate Apply/Save action.
5. Edit text, Remove text and explicit Try another remain available. Publishing
   still uses the existing deliberate review and Schedule post action.

Photo packages are a separate proposal. This work does not remove starting-image
approval or change which person's photos the current draft uses. On-video Hook
text is also separate from the saved post caption below a social post.

## Delivery 1: prepare and store ordinary reference frames

### Current integration points

- `lib/explore/hook-source-frame.ts` extracts ordinary frame zero after a miss
  in its five-minute process cache. Curated and private references already read
  stored selected frames; preserve those paths.
- `lib/explore/hook-source-frame-api.ts` authenticates and returns image bytes
  plus the source/frame hash, position and dimensions used by preparation.
- `lib/explore/hook-keyframe-generation-api.ts` already stores a public source
  snapshot at generation admission using `hookKeyframeSnapshotKey`. Reuse its
  canonical image identity where compatible; avoid a second competing copy.
- Existing object storage is GCP, accessed through `lib/storage/storage.ts`.
  Store image bytes there rather than in a database row.

### Implementation

1. Introduce a durable frame lookup using the source video hash, selected frame
   index/time and extraction version. Record the exact PNG hash and dimensions.
   Immutable object identity must not depend on a short-lived signed URL.
2. Add an idempotent preparation/backfill command that reads the reviewed source,
   verifies its hash, extracts the correct frame, uploads and verifies it, then
   marks the reference frame ready. Reuse verified existing snapshots. Do not
   overwrite approved curated/private frames or change their selected moment.
3. Prepare new references during import/review. Only advertise Recreate as ready
   once its frame is available. A failed preparation offers a bounded retry.
4. Make ordinary Recreate reads resolve the durable frame. Keep a small memory
   cache as an optimization, not the source of truth. A missing/unverified object
   should request deduplicated background preparation and report preparing/error;
   normal view requests must not repeatedly download/decode the video.
5. Preserve source/frame validation and accepted historical receipt identity.
   Old accepted jobs retain their original objects. A changed source/version gets
   a new record; it must not silently substitute pixels in an existing approval.
6. Keep private creator frames private. Public catalogue source storage must
   never receive the user's face photos or personalized generated images.

Backfill and verify the current catalogue before enabling stored-only reads.
Rollback may restore the current read path without deleting stored frames.
This removes extraction delay; it does not promise zero network/authentication
or image-decoding time. Measure the remaining load stages separately.

### Acceptance

- A prepared ordinary reference opens on a fresh server and after cache expiry
  without downloading its MP4 or invoking FFmpeg.
- Multiple viewers do not trigger duplicate frame preparation.
- Recreate preview and paid generation use exactly the same verified frame.
- Missing objects, hash mismatch and changed source versions have recoverable
  states. Curated/private frames and accepted historical requests remain valid.
- Compare click-to-visible-frame and server phases before/after on production;
  retain separate cold/warm measurements, including curated/private references.

## Delivery 2: automatically prepare and apply Hook text

### Initial scope and product behavior

New Hook video requests with reviewed reference text and a usable saved business
profile are eligible. This includes authorized private Hook references when their
source text is ready. Scratch/upload-only clips without prepared text remain on
the current manual path, with a clear reason; do not invent a reference.

Show a compact **Include adapted Hook text** option, on by default for eligible
requests, beside the existing Generate action. Show its allowance implications
before submission. Missing business context or exhausted text allowance must be
visible before generation; users can add context or deliberately proceed without
automatic text. Do not add a mandatory extra confirmation dialog.

Recommend one text remix per accepted video batch. Several video variations share
that copy, fitted separately to their durations/dimensions. A new deliberate
Generate action creates a new intent; reloading/recovering an intent does not.
Preserve the existing Hook adaptation/prompt rules and current daily allowance;
do not silently introduce new pricing or extra review-model calls.

### Durable orchestration

1. Extend the accepted video request with the auto-text choice and an owned,
   durable text-work link. Freeze reviewed source, business-profile version,
   instructions and prompt/model versions at admission. Link to the exact batch
   and its result asset IDs; never infer ownership from whichever clip is open.
2. Start text work only after video admission succeeds. Use an existing durable
   background-job path, with any required job type/queue routing added explicitly.
   Persist the linkage and dispatch intent before launching work so interruption
   cannot strand it. Video and text then progress independently in parallel.
3. Reuse the claim/allowance/result semantics in `remix-text-api.ts`, extracting
   its provider orchestration into a worker-compatible service where necessary.
   Do not import a Next request handler directly into a worker or launch an
   unawaited provider call from a short-lived web request.
4. A stable text request key prevents duplicate provider calls. Recovery reads
   saved results; uncertain provider outcomes never automatically submit anew.
   Frozen inputs remain authoritative even if business settings change later.
5. When the owned video and text are ready, initialize its clip draft exactly
   once using the existing revision-checked draft store. Record whether automatic
   text was applied or skipped because the user already changed/removed text.
6. Guard both server revisions and unsaved browser edits. A late automatic result
   must not replace an active edit. Draft initialization is create-if-untouched,
   not unconditional replacement. Reopening a completed result restores it.

Relevant integration points: `lib/ai-studio/video-generation-api.ts`, generation
batch admission, worker job dispatch, `worker/src/jobs/generate-hook-video.ts`,
`lib/explore/remix-text-api.ts`, `lib/explore/clip-draft-store.ts`,
`components/explore/format-workspace.tsx` and `format-video-editor.tsx`.

### Text fitting and display

- Start from `applyVideoTextRemix` and the existing approved Hook styling.
  Preserve source voice and emotional meaning; automation does not authorize
  rewriting the hook as a generic sales pitch.
- Use the shared `formatTextLayout`/renderer measurements to wrap lines and fit
  the overlay inside safe bounds with a readable size. Prefer moving/wrapping
  before reducing font size. Do not truncate or shrink indefinitely.
- A single Hook text block follows the trimmed opening duration. Multiple blocks
  retain their source timing relationships. Do not copy Hook text onto Demo.
- Save the overlay as editable draft data; keep generated footage clean. Main
  preview, focused editor and final export must consume the same saved revision.
- Unsupported glyphs or copy that cannot fit readably become a visible editing
  issue. Do not mark the result fully ready while hiding/clipping its words.
  Automatic face-aware placement is not part of this initial implementation.

### States and failure behavior

| Video | Text | Result shown |
| --- | --- | --- |
| Pending | Pending/ready | Existing video progress; adapted text preparing/ready |
| Ready | Pending | Playable footage with “Adding Hook text…” and a deliberate option to continue without it |
| Ready | Ready and fitted | Main preview with saved, editable overlay |
| Ready | Failed/unavailable | Preserve footage; explain the text problem and offer explicit retry/manual editing/continue without text |
| Failed | Ready | Preserve the saved text and video failure receipt; do not create another request on reload |
| Ready | Late result after user editing/removal | Keep the user's text choice; offer the saved automatic suggestion without applying it |

While automatic text is unresolved, scheduling must not silently publish a clean
video. Wait for the overlay or let the user explicitly choose to proceed without
it. This choice also suppresses later auto-application to that confirmed snapshot.

### Acceptance

- One Generate action produces a reference-backed video and fitted editable text
  without separate Generate remix, Apply or initial Save clicks.
- Closing the page, worker retries and duplicate completion events do not lose
  the text or duplicate provider work. Batch variations receive their own fitted
  overlays from the single linked remix.
- Business changes, clip switching, multi-tab edits, trimming and manual text
  removal cannot redirect or overwrite the automatic result.
- Test video-first/text-first completion, video failure, text failure, missing
  context/source, allowance exhaustion and uncertain saved responses.
- Verify long copy, emoji, multiple blocks, supported aspect ratios and exact
  text/style/timing parity between preview and final render.

## Implementation order and release checks

1. Durable frame identity/store and offline backfill verification.
2. Stored-frame reader, recovery behavior and production latency checks.
3. Automatic-text admission/linkage, worker execution and owned result recovery.
4. Deterministic fitting, one-time draft initialization and main-preview UI.
5. Local contract/race/render tests, then authenticated production acceptance.

Use separate rollout switches so either improvement can be disabled without
losing approved frames, generated media or saved edits. Database changes should
be additive and locally tested under the repository's migration workflow. Read
current bundled Next guidance and relevant Supabase docs before implementation.

Production browser access was previously disabled; Vercel denied request-log
access. Those remain acceptance dependencies, not reasons to skip local work.
New paid-generation comparisons and actual publishing need explicit test scope.
This planning turn performs no schema/storage writes, generation or deployment.

Implementation follow-up: both features are now implemented locally. See
`docs/hook-frames-and-automatic-text-implementation-2026-10-25.md` for the final
design, tests and rollout. The initial release prepares frames during explicit
backfill/catalogue publication; a Recreate cache miss does not enqueue extraction.
Text runs alongside video inside its durable worker, and completion atomically
initializes the owned clip draft. Production activation remains separate.
