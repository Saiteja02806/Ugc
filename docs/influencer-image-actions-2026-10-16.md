# Influencer image actions — 16 October 2026

Implemented locally; not pushed or deployed.

## Behavior

- Completed results have a download button and an ×. The × hides only the card
  in this mounted visit. Saved assets, generation receipts, History and any
  explicitly selected reference remain intact.
- Clicking result images toggles their use as references. My influencers has
  independent selections, a selected count and an explicit button to attach
  the selection to the prompt. Canceling the dialog leaves current references
  unchanged. Up to ten saved images can be used together, in selection order.
- Selected images appear as numbered composer thumbnails. Individual remove
  controls and Clear references change the next prompt's context. Uploading an
  image replaces the saved-reference mode, preserving the previous upload,
  paste/drop, pending/error and uncertain-request recovery rules.
- Generation submits owned IDs, never browser URLs. The server validates all
  references before reserving credits and queues the entire ordered URL list.
  GPT Image, Sunburst, Nano Banana, Gemini 3 Pro and Seedream receive that list.
  Existing single-reference request fingerprints remain compatible.
- Downloads resolve an authenticated owned ready asset, verify its saved storage
  object, and return a five-minute signed attachment URL. PNG, JPEG and WebP
  filenames follow the saved MIME type. The existing video route stays video-only.

## Verification

- 93 targeted app tests passed, covering reference submission/order, ownership, limits, mixed
  modes, retry conflicts, persisted selections, incomplete reference restoration,
  candidate toggles, non-destructive dismissal and secured image/video downloads.
- 41 worker tests passed, exercising the actual job with provider stubs and adapter contracts:
  every influencer model receives every reference, in order, while preserving
  the prompt and durable provider-operation recovery.
- `scripts/character-reference.browser.cjs` exercises the real React components
  against fixture endpoints at desktop and mobile sizes. It checks library
  selection, inline references, submitted context, actual browser file download,
  workspace removal and retained library/History entries, plus the existing
  upload, paste/drop, idle reset, route re-entry and uncertain-request flows.
  The maximum ten-reference selection also passes on mobile: the thumbnail strip
  scrolls horizontally while leaving the prompt field usable; an eleventh image
  cannot be selected.
- Browser screenshots are local artifacts under `.tmp/character-reference-browser/`:
  `multi-select-library-desktop.png`, `multi-select-library-mobile.png`,
  `multi-reference-desktop.png`, `multi-reference-mobile.png`, and
  `ten-references-mobile.png`.
- App TypeScript, worker build and targeted ESLint checks passed.
  Fixture checks do not spend generation credits or verify hosted integrations.

## Release and production acceptance

Deploy both the website and worker for the new ordered reference arrays. No new
database migration is introduced. Production must have the existing influencer
auto-save completion behavior from
`supabase/migrations/20261013143246_character_auto_save_influencer_images.sql`.

After deployment, verify signed-in behavior on `https://www.getugcpilot.com`:
download an owned image, attach several saved images and generate with them, then
dismiss a result and confirm it remains in My influencers and History. Production
generation quality and hosted download signing remain release acceptance checks.

Unrelated changes already present in the shared worktree are preserved.
