# Wall-of-text Context

Last updated: 2026-09-06

## 2026-09-05 Regeneration recovery hardening

- A stale-creative typography refresh may span more than fifty historical Wall
  creatives. The database replacement RPC keeps its 1–50-row validation
  contract; the application submits larger refreshes as ordered batches of
  at most fifty rather than attempting an invalid all-history replacement.
- Failed replacement diagnostics record the expected batch count, returned
  count, affected creative IDs, request key, recovery key, and worker recovery
  iteration without logging generated copy.
- Idempotent background-job creation now resolves an existing job in Postgres
  before the API can emit a duplicate-key response. A queued reused job with no
  queue message remains dispatchable; deterministic replacement-contract
  failures are terminal rather than retried as infrastructure failures.

## 2026-09-06 Incident correction and release parity

- The 2026-09-05 invalid-count incident happened **before** the batching and
  atomic-create code was committed. A migration filename or a later merge is
  not evidence that the running application was protected at the incident
  time.
- A later incident was separate: a six-card request produced copy that could
  not fit five to eight balanced lines in the fixed 50px text area. This is a
  deterministic layout rejection, not a temporary HTTP failure. It must return
  a structured terminal error so recovery does not retry the same copy.
- When only some historical cards cannot be re-laid out, refresh the cards
  that fit and terminalize only the unfit legacy record. The terminal marker
  preserves its historical uniqueness reservation, removes any current or
  future ready feed slot, and ensures it is never assigned again. It does not
  cause the full history to be shown to the user; daily delivery still selects
  only that day's reserved Wall slots from strict-current assignments.
- Terminalization must test the full currentness contract: generator version,
  render-safety version, and final-layout version. A V9 creative with a V2/V3
  final layout is still stale; testing only its generator version silently
  leaves it in the retry/recovery path.
- If the database does not terminalize every creative that failed the measured
  re-layout, the application records a terminal regeneration mismatch rather
  than claiming successful recovery or retrying indefinitely.
- Automatic recovery is addressable from the original request using one stable
  `recovery-v1` idempotency key. It must never form a new
  `replacement:<failed-job-id>` chain; a persistent error is limited to the
  original job and one recoverable successor.
- A Wall release is complete only when the database migration, web application,
  and AI-generation Cloud Run worker run the same release SHA. The worker
  records its SHA in `background_jobs.worker_id`; production acceptance must
  verify that a canary Wall job records the target SHA and that no invalid-count
  or duplicate-job errors occur. A source commit, migration row, or successful
  web deployment by itself is insufficient.

## Live typing preview typography

- Wall editor drafts without a measured final layout now explicitly use
  Avenir Next Demi Bold 600, fixed 50px type, and a 2px outline. Clearing,
  typing, and pasting no longer trigger the legacy Inter/dynamic-size fallback.
- The draft remains unmeasured and wraps in the browser. Saving computes
  balanced final lines, so exact line breaks may still change on save; font,
  outline, and equal 15px inner side padding do not change for current layouts.
- Existing measured historical layouts retain their saved appearance when
  opened. Editing them uses the current typography that save-time reflow uses.
- This is an editor rendering fix only. No post-writing grammar/claim review
  or additional content-quality gate is added. Those checks were intentionally
  removed to keep generation flexible; the master prompt remains responsible
  for the writing instructions.

## 2026-09-05 Fixed font and natural line wrapping

This section supersedes historical word, font-size, and line-count policies
described below for newly generated or manually reflowed Wall copy.

- The writer receives an **18–30-word soft range**, not a single 18-word
  target. It chooses the length needed for a complete idea without padding
  to eight lines. The existing 15–50-word acceptance range remains a safety
  boundary; 30 is not a new hard maximum.
- Prompt V12 sends `preferredWordRange`, including for retries of older
  assignments that stored `target_words = 18`. New assignment storage uses
  the compatible scalar midpoint, 24; it is not sent as a single target to
  the writer. No production assignment rows are rewritten by this change.
- New measured layouts use **50px Avenir Next Demi Bold**, with 55px line
  height on the 1080×1920 canvas. Font size never decreases to preserve fewer
  lines. The actual measured width determines how many rows are needed,
  retaining the five-line minimum and eight-line maximum. Balanced phrase
  breaks can add a line; the former word-count/4.5 preference is removed.
- The 780px text box, equal 15px internal side padding, 750px writing width,
  white fill, and 2px outline remain. If copy cannot fit at 50px within eight
  lines or the chosen box height, generation returns `layout_fit` for the
  existing bounded rewrite flow; manual edits show a fit error. Text is never
  truncated and the font is not shrunk.
- The Avenir final validator now uses the same Pango family name (`Avenir
  Next`) as initial measurement and the worker. It validates the persisted
  size without a shrinking fallback. Historical non-Avenir validation keeps
  its compatibility path, and already persisted layouts are not enlarged by
  a preview-only font override. New generation and manual reflow use 50px.
- The worker already preserves authoritative Avenir lines and size without
  reflow. This change needs application deployment before it affects new
  live output; production browser acceptance requires an authenticated
  session. No production data or deployment is changed by local validation.
- Local validation: all 121 Wall tests and 20 focused worker tests pass;
  worker build and focused ESLint pass. A rendered six-line/eight-line proof
  was visually inspected. The reported 22-word example now uses six lines
  at 50px instead of five at 44px. Repository-wide TypeScript reports eight
  errors in unrelated billing, onboarding, and provider-env test files, with
  none in the changed Wall files.

## Product Definition

- Wall-of-text is a separate format from Carousel and Hook video.
- Its copy is generated only from the current Business Profile by the dedicated
  Wall generator. Hook copy patterns and the Hook two-line validator must never
  be applied to Wall content.
- Wall copy is stored as 2-3 semantic segments (`lead`, optional `support`, and
  `closing`) plus one derived `fullText` value. These roles preserve the
  message beats in the backend, while every visible line uses one consistent
  baseline rhythm with no extra gap between segments. They are not Carousel
  headline/body/CTA fields and do not receive different font treatments.
- The six-second default targets 18-21 words. The hard range is 16-24 words,
  with 4-7 rendered lines, 5-6 lines preferred, and six lines best when
  natural. One-to-three-line Hook-style copy is rejected. Lines normally
  contain 2-5 words; six words are allowed only when a natural phrase cannot be
  split.
- Word and preferred-line limits are native-duration aware. Clips at or below
  4.5 seconds prefer exactly four semantic lines. A three-second clip allows
  8-11 words and prefers 9-11; longer clips grow into the standard 16-24-word
  range. The four-line minimum and measured reading-time check always remain.
- The copy contains two or three short grammatical sentences with visible
  sentence punctuation. Semantic segments may group those sentences, but the
  rendered result must not be one unpunctuated paragraph.
- A Wall idea carries one central thought, one turn, and one matching payoff.
  It has no CTA, includes at most one product feature and one natural product
  mention, and must be understood during one native play.
- New Wall generation is freeform. The writer receives the private plan idea
  and Business Profile facts, but no required writing format, format rotation,
  or preferred-format direction. The older format registry is kept only so
  historical cards remain readable; it does not guide new Wall copy.
- Generic AI marketing language and claims unsupported by the Business Profile
  are rejected.
- The Wall generator receives only Wall-relevant Business Profile fields. It
  does not receive Carousel angles, Carousel structure, image queries, or CTA
  suggestions.
- The complete copy is visible together over the background for the full clip.
- The source video plays once at its native duration. It does not loop.
- A Wall preview does not include a product demo.

## 2026-09-03 Avenir Next Typography

- New measured Wall layouts are persisted as `wall-text-overlay-v9` with
  `wall-text-final-layout-v5`: supplied Avenir Next Demi Bold at weight 600,
  white fill, a 2px black stroke, and the existing subtle shadow.
- The browser preview, server-side layout measurement, worker SVG, and worker
  raster validation use the same packaged font asset. The renderer refuses a
  missing asset rather than silently falling back to another face.
- Existing V1-V4 final layouts retain their original Inter or Arial styling,
  including their existing 4px outline. Saved cards are never rewritten merely
  because this visual treatment changed.
- V5 travels in a V4-compatible envelope during a Vercel-before-worker
  rollout. An updated worker restores Avenir before rendering; an older worker
  can still render the job with the prior V4 typography rather than reject it.

## Source Catalog Rules

Every selectable Wall video must have:

- `asset_type = video`
- `format_family = wall_text_overlay`
- `aspect_ratio = 9:16`
- `status = active`
- `analysis_status = succeeded`
- a positive native `duration_seconds`
- a public preview URL and thumbnail
- one `visual_group`
- one `source_batch`
- one lowercase SHA-256 hash
- a successful local `placement_analysis` with detected face/subject regions,
  candidate-zone scores, and a selected face-safe text zone

Motion level, a manually assigned readability score, and a manually assigned
text capacity are not Wall selection fields. Text position is computed from the
actual video frames, not entered as a catalog tag.

The v2 placement analyzer uses three center-aligned candidates:
`upper-middle` (Y=800), `middle` (Y=900), and `lower-middle` (Y=1040) on a
1080x1920 canvas. The text block is 620px wide and remains inside the
conservative X=120-880 and Y=280-1460 publishing safe area. A candidate is
rejected when it covers a protected eye or mouth landmark or overlaps the
detected face by 10% or more. The selected candidate balances local contrast,
subject overlap, and proximity to the middle. Existing v1 placement metadata
is converted to the nearest v2 vertical zone at read time so old assets remain
usable until their analysis is refreshed.

One video has exactly one visual group. Many videos may share a group. The
current groups are:

- `car_selfie`
- `indoor_closeup`
- `indoor_medium`
- `outdoor_static_selfie`
- `outdoor_walking_selfie`

Selection prefers low-use assets, spreads the current candidate set across
groups before reusing a group, and avoids recently used user assets when
possible.

## Reviewed 2026-07-28 Batch

Source: `C:/Users/chund/OneDrive/Desktop/videos_real`

Manifest:
`scripts/data/wall-text-videos-real-2026-07-28.json`

- 66 source files reviewed
- 51 unique approved videos
- 15 exact duplicates rejected
- native durations: 5.056-6.016 seconds
- all approved videos: 720x1280, silent MP4

The local files were not renamed. Canonical catalog names are used in GCP
object keys, while `source_file_name` preserves each original filename.

Production counts:

- `car_selfie`: 6
- `indoor_closeup`: 19
- `indoor_medium`: 21
- `outdoor_static_selfie`: 4
- `outdoor_walking_selfie`: 1

All 51 production rows have unique hashes and complete metadata. The importer
verified both the video and thumbnail object for every row before activation.

Synced local frame analysis found:

- 39 videos with a validated face-safe placement
- 12 videos with no candidate below the 10% face-overlap limit

The 12 placement-rejected videos were not deleted. They remain available for a
future renderer with additional text zones or different composition rules.

## Reviewed 2026-08-11 Batch

Source: `C:/Users/chund/OneDrive/Desktop/videos_real/sound`

Manifest:
`scripts/data/wall-text-videos-real-2026-08-11.json`

- 84 source files reviewed across the nested source folders
- 20 exact duplicate copies moved to the local `Duplicate` folder
- 64 unique videos imported under `wall-text-real-2026-08-11`
- all 64 videos: 720x1280, silent MP4, native duration 5.056-8 seconds
- visual groups: 12 car selfie, 14 indoor close-up, 31 indoor medium,
  5 outdoor static selfie, and 2 outdoor walking selfie
- 56 videos have validated v2 placement metadata: 45 lower-middle and
  11 middle
- 8 videos have no safe candidate in the current three-zone analyzer and
  remain stored but ineligible for selection

The production Wall catalog now contains 115 rows with 115 unique source
hashes. The importer replay verified all new GCP video and thumbnail objects
and skipped all 64 existing rows without creating duplicates.

## Trending Flow

1. The unified feed reports Wall as unavailable when the current Business
   Profile version has no active Wall assignments.
2. The client calls the authenticated Wall preparation route.
3. The backend selects reviewed, placement-validated, group-diverse videos.
4. The dedicated freeform Wall prompt uses the private plan idea and Business
   Profile facts to generate one natural `fullText` message using `gpt-5-mini`.
5. Deterministic validation checks native-duration word limits and the 4-7
   line limits, CTA and
   generic-language rejection, two-to-three-sentence structure, common grammar
   failures, unsupported mechanisms and outcomes, semantic line breaks,
   clip-duration reading comfort, and real Inter Regular measurements at the
   final dynamic size.
6. Only after deterministic render validation succeeds, an AI reviewer checks
   readability, one-idea focus, claim grounding, and Wall-format suitability.
7. The backend persists the Business Profile ID/version, user ID, background,
   semantic copy, analyzed placement, generator version, and assignment.
8. The unified feed returns the preview-ready Wall cards.
9. The shared Trending controls and gestures call one decision handler. Left
   swipe or the red cross persists `rejected`; right swipe or the green check
   persists `accepted`. The card advances optimistically and is restored if
   persistence fails. Decisions are immutable, so the old customer Undo action
   is no longer part of this flow.
10. An accepted Wall assignment is marked `selected`, then the focused view
    shows the native background, the complete overlay copy, Back, Save to
    Content, and Schedule. It never shows or requests a demo video.
11. Save to Content claims the already-selected assignment and queues one
    idempotent standalone `render_wall_text_video` job.
12. The worker applies the analyzed placement and the duration-aware
    typography for the source video's native duration, then stores a ready
    9:16 `wall_text_render` media asset.
13. Schedule uses that ready standalone media asset as a single Reel. It does
    not enter the Hook-plus-demo combination renderer.

The Wall card uses the public GCP video URL and renders the exact semantic
lines without truncating or browser rewrapping. Preview and export use Inter
Regular 400. The layout engine tries the restored 52/50/48/46/44px range in
that order and persists the largest size that fits the existing 4-7-line rule.
The line-height ratio is 1.1 for every line, tracking is -0.2px, there is no
additional segment gap, alignment is centered, and the text block is up to
660px wide. Generated copy defaults to white text with a 2px black outline and
a subtle shadow; there is no scrim,
background box, gradient, highlighted word, or mixed font weight. The active
card starts from time zero and has no loop behavior.

Existing 36-42px layouts keep their persisted size until they are regenerated
or manually reflowed; scaling their already-measured lines up would risk
overflowing the unchanged seven-line text box.

Existing v1-v4 payloads and v1 placement metadata can still be read for
migration compatibility, but stale copy is regenerated in place as
`business-profile-wall-text-v5`. Creative IDs, background videos, and user
assignments are preserved.

## 2026-08-26 Freeform Wall Writing

- The 30-day plan remains the source of idea variety, duplicate avoidance,
  audience context, human moments, emotional tension, and supported angles.
- The five-field private brief no longer contains or sends a preferred format
  family to the final writer.
- New ordinary Wall assignments have no `assigned_format_id` and use the
  `freeform` selection mode. Their copy is stored as the `freeform` pattern.
- Freeform Wall copy is excluded from format-performance learning. It must
  never be attributed to one of the dormant 30 formats.
- Imported Instagram template metadata remains stored only to keep the exact
  source, safe box, and locked audio together. Its format metadata is not sent
  to the Wall writer and does not control the text.
- This change requires applying
  `20260826101500_disable_forced_wall_text_formats.sql` and
  `20260826113000_allow_freeform_wall_text_plan_briefs.sql` before deployment.
  The second migration keeps both the legacy private-plan column and the V6
  creative JSON constraint compatible with the `freeform` sentinel, then
  durably reopens reconciliation for current feeds whose Wall slots were
  stranded by either older constraint.

## 2026-08-02 Edit-to-render Contract

- A saved Wall edit remains a semantic `content` object plus the original Wall
  layout contract; the editor may change the full copy and normalized
  `layout.textBox` without flattening the render payload into generic text.
- Every manual Wall save reflows the edited copy at word boundaries, targets
  the pattern's duration-aware preferred line range, and enforces the same
  native-duration word limits,
  4-7-line, two-or-three-sentence, source-duration reading-time,
  semantic-break, and measured Inter fit checks used by generated Wall copy.
  The measured 44/46/48/50/52px font size is stored with the edit instead of
  retaining the pre-edit font size.
- The Wall edit preview uses the export renderer's Inter Regular face, up to
  660px text width, 1.1 line-height ratio on every line with no extra segment
  gap, 2px outline, shadow, and
  persisted safe area. Pointer, touch, and keyboard dragging clamp the whole
  text box to that safe area.
- Manual Hook and Wall edits may select one color from the shared, renderer-safe
  palette in `lib/trending/text-color.ts`. The color is validated by the edit
  API, stored in `content_json`, shown in card/detail/composer previews, and
  passed as render data to the worker. The worker validates the same palette
  before drawing the final SVG. Existing edits without a color resolve to
  white. Carousel color remains controlled by its separate bubble renderer.
- Manual Hook edits remain a separate contract: 2-12 words, 8-78 characters,
  at most two lines, no more than seven words per line, and a measured
  34-52px Geist SemiBold fit. The saved Hook lines and font size flow through
  the draft and schedule metadata into the worker and are rendered directly,
  without a second layout calculation.
- Save to Content loads the latest owner-scoped edit and uses its current
  resolved Creative Assets video, semantic copy, safe area, placement, and
  normalized text box. A replacement video uses its own persisted duration
  for validation and rendering, while intentionally retaining the existing
  text position. Missing or stale selected sources fail closed at save time,
  while opening the editor treats a stale stored source as unselected so the
  user can choose a replacement.
- Wall render claims persist the edit ID and revision. An existing queued or
  ready render is reusable only for the same revision; saving another revision
  creates a new render ID and immutable output instead of returning the old
  video.
- This edit contract is implemented locally and still requires migration,
  deployment, and authenticated production-domain verification.

## Operational Commands

Dry run:

```text
npm run wall-text:videos:import -- --dry-run
```

Execute only after a clean dry run and applied schema migration:

```text
npm run wall-text:videos:import -- --execute --yes
```

The importer is idempotent. Existing active rows must exactly match their hash,
batch, visual group, video key, and thumbnail key before they are skipped.
Interrupted inactive rows are safe to resume.

Analyze and sync placement metadata after importing new videos:

```text
npm run wall-text:placement:analyze
npm run wall-text:placement:sync
```

Placement analysis runs locally with OpenCV. Source frames and face detections
are not sent to an external face-analysis service.

## Deployment State

- Supabase six-second Wall v4 and evidence-controlled v5 migrations: applied
  and verified.
- GCP catalog import: complete and verified.
- Face-safe v2 placement analysis: synced for 39 eligible videos; 12 videos
  remain intentionally ineligible under the 10% face-overlap rule.
- Application code: implemented and production-build validated locally.
- Synthetic live generation: all six patterns passed with `gpt-5-mini`,
  deterministic Inter fit, and AI review. The synthetic check did not access
  or write Supabase and its temporary route was removed afterward.
- Wall tests: 22 passed. Worker tests: 123 passed, including the standalone
  Wall renderer.
- The currently stored Calorie Fit test creatives remain v4. Replacing them
  with v5 copy requires an explicitly approved run that sends the stored
  Business Profile to OpenAI and writes the replacement creatives to Supabase.
- Authenticated browser acceptance: pending a manual refresh because automated
  localhost navigation was blocked by the browser security policy.
- Production UI deployment and authenticated production-domain acceptance:
  still required before calling the Wall cards live.
- The 2026-08-02 shared X/Edit/check controls and unified creative-decision
  migration are implemented only in the local worktree. The migration is not
  applied and the UI is not deployed or production-verified yet.

## 2026-08-02 Creative Assets Saved Collection and Scheduling UI

- Creative Assets now has a `Saved` tab that reads the existing owner-scoped
  saved Wall-of-Text, Hook, and Carousel stores. This adds one customer-facing
  destination without copying media or changing the Wall render source of
  truth.
- Successful Trending saves link to `/avatars?tab=saved`. Existing Wall saves
  appear there automatically and continue to show their preparing or ready
  state from the established saved-draft API.
- Hook and Wall scheduling account rows now render the connection's
  `profilePictureUrl`, with the platform icon used only as a fallback.
- This UI is production-build validated locally but is not deployed or
  authenticated-production verified yet.

## 2026-08-09 Wall Audio V1 Runtime

- Wall audio is a global, server-managed library. It is not attached permanently
  to a background video. The runtime selection belongs to a Wall creative or to
  one exact saved edit revision.
- The local V2 preparation library is
  `D:\walloftext_sound\wall_audio_library_v2`. It contains 66 unique protected
  sources and remains the non-destructively preserved 76-asset preparation
  baseline. The completed reviewed library is
  `D:\walloftext_sound\wall_audio_library_v2_reviewed`: 28 retained approved
  assets plus 50 newly human-reviewed usable segments, for 78 approved and
  active assets with zero pending. All 78 files are 48 kHz stereo 192 kbps
  MP3s normalized to the -14 LUFS target with a maximum accepted measured true
  peak of -1.5 dBTP.
- The owner confirmed listening to every supplied usable segment. Review
  covered 48 new source files. Sources 019 and 051 each produce two segments;
  source 041 is included as one approved segment. Review-folder `hookTypes`
  values are message-purpose tags, so preparation renames that field to the
  production `messageTypes` field without changing its values.
- Library tags use controlled vocabulary. Runtime text intent is derived from
  the persisted Wall pattern, not free-form prompt text. Matching first applies
  the hard duration gate, then scores mood at 45%, message type at 40%, and
  energy at 15%, then prefers direct fits and avoids recent user reuse inside
  the top semantic band. Exact and longer trimmable assets form the first
  selection pool; shorter loopable assets are considered only when that direct
  pool is empty.
- Duration is not a subjective tag. A track is `exact` within 0.08 seconds,
  `trim` when it is longer, `loop` only as a last fallback when it is shorter
  and explicitly approved as loopable, or rejected otherwise. A long asset can
  therefore be trimmed to any shorter eligible video duration. Exact MP3 tails are padded only
  when needed and every path is trimmed to the precise final video duration
  with a 0.2-second fade-out. Wall source videos must be longer than zero and
  no longer than 60 seconds; this is enforced both during source eligibility
  and again before a render is claimed.
- `wall_audio_assets` stores normalized file, technical, review, and semantic
  metadata. `wall_text_audio_selections` stores the creative/edit scope,
  content fingerprint, final duration, selected asset, cue, fit mode, score,
  and matching version. Both tables are RLS-enabled, client privileges are
  revoked, and only the service role can use them.
- Layout-only edits reuse the existing selection while its content fingerprint
  and new duration remain eligible. Meaning changes rematch. Duration changes
  revalidate the preferred asset and rematch only when it can no longer cover
  the video.
- The feed exposes the saved base selection to the frontend. Preview videos are
  always muted and a user-controlled sound button synchronizes the selected
  Wall track, avoiding browser autoplay failures and accidental background
  audio. The preview also follows the render fade-out. Once text or source is
  edited, the base-audio control is hidden so stale audio is never presented as
  the edited result; the exact edit revision receives its rematch at render
  time.
- Final rendering downloads the selected app-owned audio separately, ignores
  any source-video audio stream, applies exact/trim/loop processing, and maps
  only the processed Wall audio to the output AAC stream. Before upload,
  `ffprobe` must confirm a playable video stream, the expected duration within
  0.15 seconds, and an AAC audio stream. Recoverable payload-validation and
  render-start failures also persist the Wall render as failed.
- Preparation, import, matcher, database, frontend, and FFmpeg contracts are
  implemented locally. Current validation passes 53 Wall/audio tests, all 20
  preparation/review/import contract tests, 15 targeted worker render tests,
  the worker TypeScript build, and the Next production build. The reviewed
  library dry-run import accepts all 78 assets. Real proof renders cover exact,
  trim, fallback loop, and a 135.024-second asset trimmed and stitched into a
  12-second video. The new migration has not been applied, approved
  audio has not been uploaded to production GCP, and the code has not been
  deployed; production remains blocked until those rollout steps and
  authenticated production-domain acceptance are complete.

Audio operational commands:

```text
npm run wall-audio:prepare:test
npm run wall-audio:prepare-reviewed:test
npm run wall-audio:prepare-reviewed
npm run wall-audio:review:test
npm run wall-audio:review
npm run wall-audio:review -- --execute --yes
npm run wall-audio:import:test
npm run wall-audio:import
npm run wall-audio:import -- --canary 3 --execute --yes
npm run wall-audio:import -- --verify
npm run wall-audio:simulate -- --library D:\walloftext_sound\wall_audio_library_v2_reviewed
npm run wall-audio:poc -- --library D:\walloftext_sound\wall_audio_library_v2_reviewed
```

## 2026-09-03 Explore Wall of Text Reference Library

- Explore exposes Wall of Text as a separate, switchable library beside Hook
  Videos. It is a direct reference catalog, not part of the Trending Wall
  source picker, assignment store, placement analysis, render pipeline, or
  saved Wall collection.
- The 63 user-supplied `D:\walloftext` MP4s are stored immutably in GCP under
  `explore/wall-text-videos/2026-09-03/<sha256>.mp4`. Their original audio is
  preserved in storage, while Explore previews remain muted like Hook previews.
- Every Wall card keeps the Explore `Recreate` route. It passes the verified
  `wall_text` reference identity to AI Studio, and the client and generation
  API require the user to choose an image reference before creating a video.


## 2026-09-06 Terminal Worker Recovery

- Exhausted or cancelled Wall generation jobs terminalize only their own
  unfinished chunks and assignments in the database transaction. Deterministic
  terminal error codes also trigger cleanup; retryable failures with attempts
  remaining retain resumable work. Completed creatives and consumed ideas are
  preserved. The parent must match the user, profile, version, and request key.
- Reservation and claim operations check the owning job before taking child
  locks, so late HTTP work cannot reserve or claim after a terminal parent.
- Persistence uniqueness errors are terminal contract failures rather than
  infrastructure retries that repeat the same rejected write.
- An empty planner response yields immediately to the durable worker retry.
  Saved ten-item chunks survive retries. Chunk timing and saved-item counts
  are logged separately from whole-job duration.
- The 200-item active-plan prerequisite remains the product contract. Its
  sequential model calls remain a first-use latency cost, even with successful
  generation; this repair does not introduce partial-plan publishing.

## 2026-09-07 Existing-User Delay and Feed-State Repair

- The 200 ideas are reused for their 30-day plan/profile version. Existing
  users do not repeat planning for every piece; failed writing, rendering, and
  recovery must be measured separately.
- Wall copy calls now use a 60-second request timeout and zero SDK retries.
  Classified temporary app errors, gateway 408/429/5xx responses, aborted
  requests, and network failures use the durable retry path. Typed layout,
  persistence, and authentication failures remain terminal.
- Missing physical daily slots count as pending. Terminal failures produce an
  explicit public failure rather than leaving the retained deck on Generating.
  Ready content from other formats remains available.
