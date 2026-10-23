# Explore reference batches — 23 October 2026

The user requested newest-first Explore references and a `New` badge that lasts
until another upload batch arrives in that workflow. They supplied slideshow
and Hook folders, and explicitly chose to import six numbered images from
slideshow `New folder (2)` while leaving `middle.mp4` out.

## Import

| Workflow | Supplied folder | Imported reference ID | Content |
| --- | --- | --- | --- |
| Slideshow | `NONE/New folder` | `explore-slideshow-general-649259ba9668dd18` | 3 images |
| Slideshow | `NONE/New folder (2)` | `explore-slideshow-general-82d6b7c19da0b3ef` | 6 images; MP4 omitted |
| Slideshow | `NONE/New folder (3)` | `explore-slideshow-general-2f9cd9c161e9df4e` | 2 images |
| Slideshow | `NONE/New folder (4)` | `explore-slideshow-general-aa89f92f73637d43` | 2 images |
| Hook | `notbeen/New folder` | `explore-paired-hook-17133540b2315e0a3a05bfbd` | 4.1-second reaction clip |

Slideshow root: `D:/slideshow/slideshow explore/NONE`. Hook root:
`D:/hookswithlinks/notbeen`. Original files remain unchanged. Numbered image order
and original bytes are retained. Slideshows have no supplied category or source
post link, so neither is fabricated. Four independent references remain four
independent slideshows.

The Hook uses the supplied `online-video-cutter.com` reaction-only derivative.
The full 13.4-second `ssstik.io_1792736653143.mp4` includes a later screen recording
and is not used as the reference. The supplied TikTok URL is retained as source
provenance. Gallery preview uses the exact reaction video including native audio.
A separate MP3 for the existing paired-audio contract is extracted from that same
clip (4.127 seconds); no unrelated music is added. Poster is actual frame zero.
All 123 frames and source caption were inspected. Source observations and a
four-second motion adaptation were registered without claiming generated-output
qualification or promoting paid-motion admission.

Fourteen source-bound text records were added for Remix: thirteen slides plus
one Hook. Prior text and motion records are retained.

## New and order rules

- Each workflow has an independent ordered upload-batch history in
  `lib/explore/reference-upload-batches.json`.
- Every reference in the latest complete published batch has `isNew: true`.
  There is no wall-clock expiry and no per-user dismissal on viewing.
- A later successful upload in that workflow removes the prior batch's badge;
  older references remain available below the newer batches.
- A pending batch, missing reference or archived member cannot retire the prior
  complete batch. Development-only preview can explicitly include staged imports.
- Filtering remains authoritative. Batch priority is applied after category
  interleaving, with stable ordering within an equal-priority group.
- Both Explore galleries use the same shared priority helper and card badge.
  The badge sits inside the upper-left media corner and does not intercept
  pointer events or overlap the bottom source/Recreate controls.
- Future importers must add a unique batch ID, increasing workflow sequence and
  exact reference membership. Publish metadata only after verifying every object.
  Hook, Wall of Text and Slideshow share this mechanism; automatic Trending is
  separate.

## Upload and release status

`scripts/prepare-explore-reference-batch-20261023.mjs` stages original content and
creates immutable content-addressed manifests. It refuses to overwrite a published
import or duplicate an earlier reference. Preparation does not upload anything.

`scripts/publish-explore-reference-batch-20261023.mjs` defaults to dry run. Explicit
execution validates source text readiness, verifies local hashes, uploads only
missing objects under established Explore prefixes, then reads back every object
to verify content type, size and SHA-256 before activating local manifests. It
does not deploy the website or worker or modify database/billing state.

Upload completed at **2026-10-23 07:41:10 UTC**: **16 objects, 11,900,307 bytes**.
The first execution stopped on an incorrect storage stream method after uploading
three objects; activation did not occur. The corrected execution used the
provider's `transformToWebStream()` contract, verified those objects and uploaded
the other thirteen. All sixteen passed complete byte verification and public
media URL checks (HTTP 200 with expected sizes). Local receipt:
`.tmp/explore-upload-batch-20261023/publication-receipt.json`.

Website and worker deployment remain paused. These source changes and new
catalog entries are not yet live in the production application. Earlier
`slideshow-reference-additions.json` content remains staged; this import does not
activate it. Final signed-in production acceptance is still pending release.

## Validation

- 71 focused and release-regression tests pass, including real catalog ingestion, source text and Hook
  readiness, original slideshow identities, new-first order and next-batch badge
  retirement independently across all three reference workflows. The development
  media route admits only manifest-listed images from the new staging directory
  and rejects traversal, unknown filenames and all production requests.
- The added motion plan keeps caption cleanup in the starting-image stage;
  animation instructions describe only visible movement. All 99 source-bound
  motion plans compile without asserting paid-generation approval. Earlier
  scene-trim caption checks validate their reviewed replacement hashes and frame
  counts rather than requiring superseded prose in their review notes.
- Application TypeScript and worker compilation pass. Targeted ESLint passes.
- Production card components in an isolated local browser fixture verify badge
  placement, newest-first order, source actions, Recreate, playback controls and
  responsive layout on desktop/mobile. All four Hook previews in the fixture,
  including the new Hook, play completely with decoded pictures; all four new
  slideshow covers load. This is local UI verification, not signed-in
  hosted production acceptance.
- Evidence: `outputs/explore-new-batch-tests.log`,
  `outputs/explore-new-batch-worker-build.log`,
  `outputs/explore-new-batch-typecheck.log`,
  `outputs/explore-new-batch-lint.log`,
  `outputs/explore-new-badge-browser.log`,
  `outputs/explore-new-content-public-media-check.json` and
  `.tmp/hook-card-browser/` screenshots.
