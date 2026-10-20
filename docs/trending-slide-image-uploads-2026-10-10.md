# Trending slideshow image uploads

Date: 2026-10-10. Status: implemented and verified locally; not deployed.

## User flow

Open Trending → Edit → select any slide with Previous/Next → Upload image for
that slide → review its immediate preview → Confirm and save creative edit.
All six slides in either slideshow structure can have independent uploaded
backgrounds. Restore original resets only the selected image; copy stays editable.

Accepted formats are JPG, PNG and WebP, up to 25 MB. Portrait, square, 4:5 and
landscape sources fill the slide with proportional centre cropping. Edges can
be cropped; images are not stretched. Existing text remains an editable overlay.

## Implementation boundaries

- `CarouselSlideImageSection` appears beside the selected slide's text fields.
  A synchronous busy ref prevents repeated uploads. Pending uploads block
  Save/Cancel/Close and the other image pickers. Slide navigation and text edits
  remain available. Completion targets the original captured slide ID and uses
  functional state updates, preserving intervening changes. Failure leaves the
  previous image selected and reports the affected slide.
- The uploader reuses `/api/media/create-upload-url`, the signed storage PUT,
  and `/api/media/complete-upload`, with project purpose
  `trending-carousel-slide`. The existing completion path verifies object type
  and size; the browser decodes dimensions before upload. A lost completion
  acknowledgement recovers through the owner media endpoint without deleting
  an asset that may already be ready. Files retain their uploaded dimensions.
- PATCH still accepts only background asset IDs. The save service resolves
  distinct manual uploads under the authenticated user and validates ready,
  undeleted upload images, supported MIME type, purpose and positive dimensions.
  URLs/crop/roles are server-derived. Original assignment access and revision
  fencing are unchanged. No new public endpoint, schema or migration is needed.
- Manual uploads are independent of the business/category app screenshot
  library and automatic generation's image matching. Source slide roles/layouts
  remain, so there is no product-role inference from an arbitrary uploaded photo.
  Hook library replacements still require Slide 1. App screenshot replacements
  retain their Structure 2 eligibility and single-product rules.
- Both workers receive each saved background. Source slides with no changes
  still reuse their immutable output; new manual backgrounds are rendered into
  the existing immutable edit output and publishing flow. Structure 1 already
  uses centre cropping. Structure 2 explicitly selects centre cropping for manual
  uploads, versioned `normalized-edit-v3`. Generation retains its v13 renderer
  and catalogue attention crop. Previously saved render bytes are not rewritten.

## Validation

- 11 new boundary/behavior tests: all six independent selections, captured target
  and intervening copy, restoration, file validation, owner/purpose/readiness,
  real save normalization in both structures, server URL/crop/role derivation,
  retained catalogue rules, actual upload client → route handler → signed PUT
  → HEAD → completion response, upload failure and acknowledgement recovery.
  Database/storage/authentication boundaries are controlled test doubles.
  Run with `npm run test:trending-slide-images`.
- 37 existing Trending editor, Settings screenshot, Hook library and ownership
  contract tests pass (`npm run test:trending-edit`).
- 41 scoped worker tests pass, including all six manual images in both structures,
  a changed body slide with five original renders reused, legacy cover typography,
  and actual crop pixels for 16:9 / 4:5 / 9:16 sources in both 4:5 and square output.
- Web TypeScript, worker TypeScript build, scoped ESLint and diff whitespace checks.
- Browser fixture `/e2e/carousel-slide-image-preview` compiles and is unavailable
  in production. It uses the real text fields, editor preview, upload section and
  selection helpers, with local object URL uploads and a browser-only Save marker.
  All six images were uploaded through the actual file chooser. A held upload on
  Slide 2 followed by switching to Slide 3 and editing its headline preserved
  that headline and updated Slide 2. Save/Cancel were disabled while uploading.
  Injected failure retained all six replacements; restoring Slide 6 left five.
  After a fresh compiled-page reload, opening the file picker on Slide 1,
  switching to Slide 2 before choosing a file, and completing the upload updated
  Slide 1 while preserving Slide 2's original image.
- Browser sizes: 1366 × 680 and 1536 × 776. Save buttons stay inside the viewport
  (bottom approximately 647px and 741px respectively). The image preview uses
  `object-fit: cover`; a 1600 × 900 source fills its 340 × 425 frame on the larger
  viewport. On the shorter window, the body scrolls while the footer stays visible.

Visual evidence is stored locally in
`.tmp/trending-slide-images-20261010/editor-14.png`, `editor-15.png` and
`measurements.json`. These are temporary artifacts, not release source files.

## Release status

No push, application deployment or worker deployment was performed. The web
application and Carousel worker must both ship for complete preview/export
fidelity. Earlier local history, spacing, screenshot ratio and edit status fixes
remain in the worktree. The user's signed-in production session is unavailable
here, so authenticated acceptance on https://www.getugcpilot.com remains pending.
