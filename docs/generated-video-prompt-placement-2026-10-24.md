# Generated video and prompt placement — 24 October 2026

Implemented locally after the user's repeated marked-screenshot correction.
No deployment, paid generation, provider change or saved-data mutation.

## The requested placement

Keep the generated video in the left-hand results position. Put the prompt in
the separate upper-right region outlined by the user, aligned near the video's
top. Use the same placement while generating and after completion.

The earlier change addressed oversized previews and long prompt summaries, but
its 48rem maximum card width prevented the row from using the right-hand space.
That left the prompt close beside the player. The earlier checks asserted
height, aspect ratio, disclosure and overflow, but not the marked placement.

## Implementation

- Compact Explore rows fill their available width. At container widths of at
  least 580px, the left column is 36% wide, followed by a 28px gap and the prompt
  column. The player stays at the left edge with its existing height budget and
  aspect ratio. Prompt width remains bounded at 26rem. This scales with the
  results panel, rather than a fixed viewport coordinate.
- Narrow results stack the prompt below the player. Full text expands inside
  the existing bounded disclosure; copy retains the entire original string.
- Hook and Wall use the same pending/completed cards. Talking Head and Phone
  now use the same result grid and shared prompt component, retaining their
  existing Use video actions and native player controls.
- Pending Talking Head/Phone prompts are captured from the exact submitted
  draft. Completed prompts are explicitly requested from the authenticated
  owner's original generation job via `generationDetails=1`. The same whitelist
  already used by video history supplies metadata; no raw input is exposed.
  Ordinary media reads still avoid that lookup. A missing historical prompt
  is not replaced with the current composer text.
- Standalone AI Studio remains on its existing noncompact layout. Slideshow
  image results and generation/provider behavior are not part of this change.

## Verification

- 181 focused checks pass: generated-video detail ownership/fast path, history
  metadata, generation-client/recovery contracts, workflow composition and source
  selection. The test harness imports the extracted prompt component correctly.
- Actual pending/completed result functions and actual Talking Head/Phone canvas
  are rendered in Edge with isolated auth/inference/download boundaries. Eight
  viewport sizes include 1897x915, plus 320px and 390px mobile widths. Four ratios
  and pending/completed states produce 96 layout cases. Standalone Studio retains
  its larger presentation.
- New coordinate checks assert the media's left edge equals the result row's
  left edge; on wide panels prompt x is at least 35% into the row and its top
  aligns with the video. Narrow panels assert prompt follows the video.
- Keyboard expansion, edit/use selection, overflow, aspect ratio and full-string
  prompt copying remain checked. Additional captures at 1518x732 with 1.25 device
  scale approximate the physical proportions of the supplied screenshot. This
  is explicitly device scaling in an isolated fixture, not a verified browser
  zoom or a production account screenshot.
- TypeScript and scoped lint checked separately. Receipts:
  `.tmp/video-prompt-placement-tests-final.log`,
  `.tmp/video-prompt-placement-browser-verified.log`,
  `.tmp/video-prompt-placement-tsc-final.log`,
  `.tmp/video-prompt-placement-lint-final.log`.
- Screenshots: `.tmp/explore-compact-video-results/`, including
  `completed-1897.png`, `pending-1897.png`, `completed-screenshot-scale.png`,
  `pending-screenshot-scale.png` and mobile captures.

## Hosted acceptance still required

Website/API deployment required; no migration or worker release needed. After
release, verify the same placements on `https://www.getugcpilot.com` using an
existing generated video and an accepted generation's pending state. Local
fixtures do not establish authenticated hosted acceptance, provider output
quality or download transport.
