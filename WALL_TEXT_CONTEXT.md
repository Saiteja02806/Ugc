# Wall-of-text Context

Last updated: 2026-07-31

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
  with 5-7 rendered lines and six lines preferred. Lines normally contain 2-5
  words; six words are allowed only when a natural phrase cannot be split.
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
5. Deterministic validation checks the 16-24 word and 5-7 line limits, CTA and
   generic-language rejection, two-to-three-sentence structure, common grammar
   failures, unsupported mechanisms and outcomes, semantic line breaks,
   clip-duration reading comfort, and real Inter Bold measurements at the
   final dynamic size.
6. Only after deterministic render validation succeeds, an AI reviewer checks
   readability, one-idea focus, claim grounding, and Wall-format suitability.
7. The backend persists the Business Profile ID/version, user ID, background,
   semantic copy, analyzed placement, generator version, and assignment.
8. The unified feed returns the preview-ready Wall cards.
9. Left swipe records `skipped` and exposes an Undo action. Right swipe opens
   a focused Wall detail view without completing the assignment.
10. The focused view shows the native background, the complete overlay copy,
    Replay, Back, Save to Content, and Schedule. It never shows or requests a
    demo video.
11. Save to Content atomically marks the assignment `selected` and queues one
    idempotent standalone `render_wall_text_video` job.
12. The worker applies the analyzed placement and the exact six-second
    typography for the source video's native duration, then stores a ready
    9:16 `wall_text_render` media asset.
13. Schedule uses that ready standalone media asset as a single Reel. It does
    not enter the Hook-plus-demo combination renderer.

The Wall card uses the public GCP video URL and renders the exact semantic
lines without truncating or browser rewrapping. Preview and export use pinned
Inter Bold 700 at 52px for up to 18 words/5 lines, 48px for 19-21 words/6
lines, 46px for 22-23 words, and 44px for 24 words. The line-height ratio is
1.08, tracking is -0.2px, section gaps are 18px, alignment is centered, and
the 620px text block is horizontally centered. Readability comes from white
text with a 4px black outline and a subtle shadow; there is no scrim,
background box, gradient, highlighted word, or mixed font weight. The active
card starts from time zero and has no loop behavior. Replay is an explicit
user action; it does not change the no-loop product rule.

Existing v1-v4 payloads and v1 placement metadata can still be read for
migration compatibility, but stale copy is regenerated in place as
`business-profile-wall-text-v5`. Creative IDs, background videos, and user
assignments are preserved.

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
