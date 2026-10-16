# Slideshow assembly UI — local implementation, 16 October 2026

## Scope

The user authorized the second workstream only: clearer generated-version
presentation and choosing generated/original/uploaded images for one slideshow.
Exact screenshot placement, AI edit fidelity, prompts, models, generation credits
and worker processing are outside this implementation. No production writes,
paid generation, migrations or deployments were performed.

## User flow

- Generated outputs sharing a batch/version appear together, ordered by output
  slide number, in a horizontal strip. The primary action is **Edit these N
  slides**; individual actions say **Add to slideshow** or **Replace selected
  slide**, depending on the actual pending operation. Partial results remain
  available without treating failed outputs as complete.
- Completion no longer automatically initializes an empty editor. Opening a
  version is explicit and preserves an existing draft through Earlier drafts.
- **Add slides** opens an in-place dialog with **Generated images**, **Original
  reference**, and **Upload images**. **Create new slides** remains a separate
  navigation action. Existing edit/replace/reorder/save controls remain intact.
- The reference source shows all original numbered thumbnails, marks sources
  already represented by an original or recreated slide, and supports selection
  of a subset or **Select all remaining**. Nothing is selected automatically.
- The footer shows current count and remaining capacity. Oversized selections
  show an explanation and disable Add, without truncation. A full slideshow
  disables Add slides. Marketing's 12 originals remain browsable even though a
  saved sequence contains at most 10 slides.
- Selected originals fill their source-order positions around generated slides.
  Existing slides retain their relative order and text. Other generated images
  and uploads append. Users can subsequently reorder or remove any image.

## Data and safety

The new authenticated POST `/api/explore/slideshows/reference-images` accepts
only a catalogue reference ID and 1–10 distinct slide IDs. It resolves current
published slideshow sources on the server, rejects arbitrary URLs and foreign
slide IDs, checks immutable trusted storage keys and object metadata, then
registers those unchanged objects as ready images owned by the caller. It does
not copy pixels or request generation. Repeated imports reuse active owned rows;
existing owner/source and owner/storage unique indexes arbitrate concurrent
imports. Failed partial registration can be retried without duplicate rows.

Imported rows use source type `upload` and project `explore-catalog-reference`.
They retain the original reference/slide ID, source number/hash and Remix source.
The owner-scoped media detail path preserves that server-written provenance.
Catalogue objects are immutable shared sources; media deletion only soft-deletes
the caller's row. Uploaded reference slides instead resolve their existing owned
asset IDs; the browser's stored URLs are never sufficient for saving.

The editor resolves every selected asset before changing the draft, guards
duplicate actions with an immediate ref lock, rejects changed/abandoned drafts,
and preserves current images on import failure. Original positions are inferred
from verified source URLs/provenance, not from generated output index 2 meaning
master slide 2. The existing v2 draft, editable-source saving, immutable legacy
receipts, Library verification and scheduling boundaries remain in use.

## Verification

- 150 focused tests passed: grouped pending/completed/failed results, explicit
  version opening, assembly, original import validation/ownership/reuse/races,
  media provenance, text, draft/save/recovery and scheduling navigation.
- Full TypeScript and scoped ESLint passed. Production Next build passed:
  compilation, TypeScript and all 164 pages/routes.
- `scripts/slideshow-add-slides.browser.cjs` passed against the real editor and
  picker with isolated APIs: regenerate master 1/5, choose originals, exact
  ten-slide order, text preservation, save/reload without duplicate save,
  12-slide capacity handling, keyboard close, failed import retention,
  repeated-click fencing, generated selection, upload, uploaded references,
  mobile fit and no paid generation requests.
- `scripts/explore-slideshow.browser.cjs` passed existing add/replace/reorder,
  interrupted save/retry, two-tab completion, legacy recovery, attachment
  ownership and account-switch regressions. Provider/network failures in that
  fixture are intentional injected cases.
- Desktop/mobile screenshots were inspected. Fixture CSS Modules use scoped
  class names to avoid false collisions with Tailwind's `grid` utility.
  Evidence: `.tmp/slideshow-add-slides-browser/` and corresponding local logs.

Local fixtures do not establish signed-in production acceptance. This change is
not deployed. Release the compatible website API and UI together; no worker or
database rollout is required for this workstream. Verify signed-in selection,
import, save, reopen and scheduling against the real production domain afterward.
