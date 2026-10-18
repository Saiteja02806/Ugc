# Library clarity improvements — 18 October 2026

Implemented locally; no push/deployment, worker change, migration, paid generation,
publishing or production data change was performed.

## Final behavior

- A background picker shows This slide/All slides before selection. Clicking a
  tile immediately updates the proposal; a single Apply action confirms it.
  Reference and add-image modes share the same fixed confirmation footer.
- The grid and preview appear side by side on desktop and stack on mobile.
  Cancel/Apply remain outside the scrolling body, including on short laptops.
  The footer names the affected slide(s) and reminds users to save afterward.
- Selection hides collection management actions. Manage library switches views
  within the same dialog and returns to selection without applying anything.
  Upload remains available in the selection grid.
- Trending previews use its actual EditorPreview renderer, including text and
  centre cropping. Explore previews use its actual createSlideTextSvg function
  and loaded image dimensions. Both are inert proposals; selecting/previewing
  never mutates the slideshow. Text baked into source pixels is still baked in.
- Collections show their selected image count and order. Proposal summaries
  name affected slide count, distinct used images and repeated placements.
  Earlier/later controls reorder the proposed images; they do not modify the
  saved collection or another slideshow. Excess collection images are unused.
- Thumbnails use portrait frames and contain the source instead of square
  cropping. Dimensions move to management's image details. Mobile uses a compact
  collection dropdown. Browser image-hover suppression remains scoped to library
  media; pointer/keyboard selection still targets the containing controls.
- Image upload results are visible and failed files have Retry. Successful files
  are not uploaded again when failed siblings retry. An upload whose collection
  membership failed is reported as saved in All images, with recovery guidance.
- Music state survives tab switches. Previewing another track pauses the first;
  leaving Music pauses previews. Track names handle long input, duration uses
  minutes:seconds, and failed uploads have Retry. Library uploads/updates block
  dismissal and tab changes until settled, with visible status. Music saving
  remains separate from attaching or enabling playback in an editor.

## Persistence and failure boundaries

The existing source resolver rechecks ownership/readiness/archive state before
one Apply callback. Repeated clicks share the in-flight lock. No pending image
change is committed by browsing, changing scope, reordering a proposal or opening
management. Failed checks leave the accepted draft intact. Existing editor
target/revision guards and save invalidation are retained. Returning from Manage
may show a retained proposal; Apply rechecks its sources after library changes.

Collections still persist their existing added-time/asset-ID order. The proposal
reordering controls are intentionally specific to the current slideshow and are
labelled that way. This release does not add global collection ordering, collection
cover images, automatic background matching or photo-slideshow soundtrack posting.

## Validation

- **313 focused regressions pass** across existing slideshow saving/recovery,
  references, Trending normalization, library API/ownership/archive, audio scopes,
  and generation controls. API/provider boundaries are isolated in these tests.
  Log: `.tmp/library-ui-regressions.log`.
- Application TypeScript and scoped ESLint pass. The sandboxed compiler/linter
  exhausted their memory allowance; identical checks succeeded outside the
  sandbox with a 4 GB Node heap. No dependencies or configuration were changed.
- `scripts/media-library.browser.cjs` runs real shared library components,
  Trending EditorPreview, Explore editor/SVG composition, saved audio picker and
  background-music hook with fixture auth/storage APIs. It covers direct image
  selection and scope, collection repetition, local proposed reordering, failed
  source checks, cancel, archive, preserved text/dirty state, direct music reuse,
  failed-file-only retry, blocked dismissal/tab switching during upload, retained
  panel state and native HTML audio pausing using a local WAV fixture.
- Browser checks cover **1366×680, 1366×768, 1536×864 and 390×844**. Apply button
  bounds stay inside the viewport. Actual preview screenshots were inspected.
  Fixture HTML now declares UTF-8; earlier mojibake was fixture encoding, not
  application copy. Browser image-search native chrome remains outside DOM tests.
- The existing `scripts/slideshow-add-slides.browser.cjs` passes assembly,
  capacity, retries, pointer/touch/keyboard ordering, text preservation, saving,
  reload, 4:5 image fitting and mobile/footer regressions.
- Screenshots: `.tmp/media-library-browser/picker-1366.png`, `picker-1536.png`,
  `picker-mobile.png`, `collections-desktop.png` and `music-mobile.png`.

These are local component/browser checks with isolated service boundaries.
Authenticated production acceptance is still required after a website deployment;
the previous production navigation attempt did not reach a usable signed-in page.
