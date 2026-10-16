# Individual Hook reference prompt review

Completed locally on **16 October 2026**. Scope: the **98 active references in
the Hook video workflow**, in gallery order. Wall of Text and slideshow
references are outside this pass. Earlier totals of 195/192 mixed workflows.

All 98 exact source files were hash verified and decoded completely. Every
decoded frame was visually inspected in ordered contact sheets, including the
last frame: **9,773 frames total**. All prompt entries are version 2 with
`all_decoded_frames` provenance and source-bound frame counts. No Hook references
remain in this inventory.

## Saved content

- `lib/explore/reference-video-prompts.ts`: 98 individual prompts using the
  user's chosen original detailed approach. Each combines the conditional
  influencer identity instruction, a clip-specific performance paragraph and
  preservation/text-removal directions. The later numbered five-part template
  is not the default.
- `lib/explore/reference-text-catalog.json`: all 98 Hook caption records
  rechecked alongside the footage. There are 96 ready Remix source records and
  two `no_text` records (Hooks 94–95 contain graphic formulas only).
- Hooks 01–03 were revisited for the same all-frame caption check. Their final
  screen-view boundaries were confirmed from actual frame presentation times.

The performance paragraphs preserve the observed sequence: eye and brow
changes, hand contact and occlusion, props, framing, camera movement, lighting
and brief scene cuts. They do not turn every clip into a generic surprised
reaction. Single-frame screen tails retain their source timing without
elongation. Source videos were not trimmed or changed.

Every prompt requests removal of creator-added words, captions and associated
emoji, with no new text. Individual prompts also remove floating logo formulas
where present. Physical labels, printed clothing, packaging and incidental
interface text stay distinct from added overlays. No fixed test influencer
image, green shirt or hairstyle is embedded. Facial identity replacement is
conditional on the user's attached image.

Remix source text remains separate from footage-generation instructions.
Original wording and emojis are retained unless the visual inspection supports
a correction. These are source transcriptions, not newly invented business
remixes or fact-checked claims.

## Caption corrections

| Hook | Confirmed correction |
| --- | --- |
| 04 | Final instruction begins at frame 91 / 3033 ms, before the browser cut |
| 14 | Caption ends at the second-take cut, frame 170 / 5667 ms |
| 42 | Caption changes to GOOD at frame 102 / 3400 ms |
| 43 | Caption changes at frame 95 / 3167 ms |
| 48 | Additional caption starts at frame 70 / 2333 ms; first emoji is 🤨 |
| 64 | Additional caption starts at frame 52 / 1733 ms |
| 72 | First emoji corrected to 😳 after full-resolution inspection |
| 74 | Four-emoji sequence corrected to 👹😨🤯😭; caption ends at frame 106 / 3567 ms |
| 85 | Caption ends at frame 179 / 6033 ms, before its final two caption-free frames |
| 94–95 | No remixable caption words; retain empty blocks rather than inventing copy from logos |

Unchanged caption boundaries remain approximate where the individual record
does not state an exact presentation-time check. Overlapping captions, including
Hook 07's original caption plus final website instruction, remain intentional.

## Review evidence and validation

Evidence is under `.tmp/hook-reference-prompt-review/<permanent-reference-id>/`.
Each entry has the full frame sequence and source inspection metadata.
`scripts/inspect-hook-reference-frames.mjs <ordinal>` prepares those frames and
leaves review status pending; preparing frames never establishes visual review.

The export at
`C:/Users/chund/.codex/visualizations/2026/10/15/01a13e6b-1589-7610-b970-de6890bc8710/hook-reference-prompts/review.html`
shows all 98 source videos, exact prompts, separate Remix captions, review notes
and every frame sheet. Each entry includes downloadable `prompt.txt`,
`remix-text.json` and a `review.json` receipt. `progress.json` records 98 reviewed,
zero remaining. Export verifies source hashes and frame counts.

- All 98 prompt/source bindings, review counts, text-removal instructions and
  Hook-only scope passed integrity checks.
- All 98 caption records passed `ReferenceTextSchema`, hash matching and
  all-frame provenance checks.
- All 21 focused prompt, Remix and workflow reference-input regression checks
  passed. Focused ESLint passed.

This is frame review, not real-time playback, an audio evaluation or a generated
output quality test. No new generation, paid analysis, production database write
or deployment occurred. The visible prompt controls and authenticated production
flow still need release acceptance on the deployed site. This content pass does
not resolve an unrelated preview startup issue.
