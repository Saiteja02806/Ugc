# Wall-of-text Context

Last updated: 2026-08-09

## Product Definition

- Wall-of-text is a separate format from Carousel and Hook video.
- Its copy is generated only from the current Business Profile by the dedicated
  Wall generator. Hook copy patterns and the Hook two-line validator must never
  be applied to Wall content.
- Wall copy is stored as 2-3 semantic segments (`lead`, optional `support`, and
  `closing`) plus one derived `fullText` value. These roles preserve the
  message beats and small visual gaps; they are not Carousel
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
- Each candidate is assigned one stable universal pattern:
  `problem_change_result`, `mistake_correction`, `situation_discovery`,
  `before_after`, `belief_reframe`, or `action_benefit`.
- Generic AI marketing language and claims unsupported by the Business Profile
  are rejected.
- The Wall generator receives only Wall-relevant Business Profile fields. It
  does not receive Carousel angles, Carousel structure, image queries, or CTA
  suggestions.
- The complete copy is visible together over the background for the full clip.
- The source video plays once at its native duration. It does not loop.
- A Wall preview does not include a product demo.

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

## Trending Flow

1. The unified feed reports Wall as unavailable when the current Business
   Profile version has no active Wall assignments.
2. The client calls the authenticated Wall preparation route.
3. The backend selects reviewed, placement-validated, group-diverse videos.
4. The dedicated Wall v5 prompt assigns one of the six universal patterns and
   generates semantic segments plus `fullText` using `gpt-5-mini`.
5. Deterministic validation checks native-duration word limits and the 4-7
   line limits, CTA and
   generic-language rejection, two-to-three-sentence structure, common grammar
   failures, unsupported mechanisms and outcomes, semantic line breaks,
   clip-duration reading comfort, and real Inter Bold measurements at the
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
    shows the native background, the complete overlay copy,
    Replay, Back, Save to Content, and Schedule. It never shows or requests a
    demo video.
11. Save to Content claims the already-selected assignment and queues one
    idempotent standalone `render_wall_text_video` job.
12. The worker applies the analyzed placement and the duration-aware
    typography for the source video's native duration, then stores a ready
    9:16 `wall_text_render` media asset.
13. Schedule uses that ready standalone media asset as a single Reel. It does
    not enter the Hook-plus-demo combination renderer.

The Wall card uses the public GCP video URL and renders the exact semantic
lines without truncating or browser rewrapping. Preview and export use pinned
Inter Bold 700 at 52px for up to 18 words/5 lines, 48px for 19-21 words/6
lines, 46px for 22-23 words, and 44px for 24 words. The line-height ratio is
1.08, tracking is -0.2px, section gaps are 18px, alignment is centered, and
the 620px text block is horizontally centered. Generated copy defaults to white
text with a 4px black outline and a subtle shadow; there is no scrim,
background box, gradient, highlighted word, or mixed font weight. The active
card starts from time zero and has no loop behavior. Replay is an explicit
user action; it does not change the no-loop product rule.

Existing v1-v4 payloads and v1 placement metadata can still be read for
migration compatibility, but stale copy is regenerated in place as
`business-profile-wall-text-v5`. Creative IDs, background videos, and user
assignments are preserved.

## 2026-08-02 Edit-to-render Contract

- A saved Wall edit remains a semantic `content` object plus the original Wall
  layout contract; the editor may change the full copy and normalized
  `layout.textBox` without flattening the render payload into generic text.
- Every manual Wall save reflows the edited copy at word boundaries, targets
  the pattern's duration-aware preferred line range, and enforces the same
  native-duration word limits,
  4-7-line, two-or-three-sentence, source-duration reading-time,
  semantic-break, and measured Inter fit checks used by generated Wall copy.
  The measured 44/46/48/52px font size is stored with the edit instead of
  retaining the pre-edit font size.
- The Wall edit preview uses the export renderer's Inter Bold face, 620px text
  width, 52/48 line-height ratio, 18px segment gap, 4px outline, shadow, and
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
