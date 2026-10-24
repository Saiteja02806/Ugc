# Private TikTok slideshows and creator parity — 24 October 2026

Implemented locally. No push, deployment, paid generation or production acceptance
was performed for this work. This record supersedes the initial frame-zero and
four-sample qualification in `creator-account-pilot-2026-10-24.md`.

## TikTok collection

Explore → Slideshows now uses the existing **Recreate the account** selector to
offer **TikTok Creator Account**. The supplied source is
`D:\slideshow\slideshow explore\marketing\creator`. It contains **10 slideshow
sets and 39 images**, ordered naturally by source folder and slide number.
Set sizes are 6, 2, 2, 6, 6, 2, 2, 6, 2 and 5. All references restores the ordinary
gallery and filters. Hook retains Creator Account 1 and Creator Account 2.

The selector, collection metadata, source images, imports and Remix/generation
admission require verified `vtu19403@veltech.edu.in`. Server checks reinforce the
UI check. These imports do not enter the public/MCP reference catalogue.

Original image bytes are stored outside `public/`, bound to SHA-256, size and
actual format. Some files named JPG contain WebP; the manifest serves the actual
content type. Native dimensions remain intact, including the one 9:16 slide
among predominantly 3:4 images. Similar posts remain distinct references.

Only two original post URLs were supplied, for sets 1 and 10. Other source links
are omitted; account provenance is not invented. All 39 source-text records were
visually reviewed and bound to their exact source image hash. Claims in those
posts are reference copy, not verified facts about the user's business.

## Recreate, Remix and recovery

- Private slideshow cards use the existing Recreate slide-selection flow. The
  selected images retain source order and their reference/slide identities.
  Authenticated browser previews use disposable object URLs; jobs retain stable
  canonical URLs, never those object URLs or expiring provider links.
- The image-generation parser admits the exact private reference only for the
  approved actor. The existing slideshow planner, named context, image models,
  instructions, per-slide jobs and editor receive the same ordered source roles
  as ordinary references. Provider operations were mocked during verification.
- The user explicitly approved private slideshow images, captions and editing
  instructions being sent to existing AI providers for Recreate/Generate and
  Remix. The worker creates a ten-minute capability for one manifest-bound image
  immediately before provider use. The provider route rejects changed identity,
  hash, host or expired signatures. Original preview routes require authentication.
- Canvas source reads and reference imports resolve authorized local bytes.
  Imports use owned ready-media records without copying originals into public
  storage; repeat imports reuse those records. Owned reads additionally enforce
  the pilot email, including after an account email change.
- Remix resolves canonical source identity even when preview object URLs change
  or generated history is reopened. It uses the reviewed text for the exact
  reference/slide and the existing business-context rules.
- Saving the existing rendered editor output preserves reference metadata.
  Raw private canonical originals cannot be published directly through the
  Library save route; the existing canvas render/upload flow supplies the owned
  rendered output. No publication or scheduling action was performed.

Website and worker must share the creator delivery signing key and deploy
together. `CREATOR_REFERENCE_SIGNING_SECRET` is preferred; the existing shared
service-role key remains the purpose-specific HMAC fallback. No real environment
file was edited for this work.

## Creator Account 1 and 2 corrections

An independent simulated-agent audit reviewed twelve evenly spaced frames per
clip plus extra transition frames. It found three workflow gaps: private clips
always used frame zero, selected frame-zero receipts disagreed about v2/v3, and
legacy preparation recovery could replace an accepted source and discard approval.
All three are corrected. The source inspection is sampling, not an exhaustive
semantic review of every decoded frame.

Current selected frames and their source elapsed times:

| Account / clip | Frame index | Seconds |
| --- | ---: | ---: |
| 1 / 1 | 51 | 1.700000 |
| 1 / 2 | 44 | 1.466666 |
| 1 / 3 | 55 | 1.833333 |
| 1 / 4 | 0 | 0 |
| 1 / 5 | 0 | 0 |
| 1 / 6 | 20 | 0.666666 |
| 2 / 1 | 68 | 2.266666 |
| 2 / 2 | 61 | 2.033333 |
| 2 / 3 | 31 | 1.033333 |
| 2 / 4 | 32 | 1.066666 |
| 2 / 5 | 43 | 1.433333 |
| 2 / 6 | 85 | 2.833333 |

Starting-image preparation, API validation and the worker use the same curated
tuple and digest. Movement directions match that selected pose; for example,
Creator 1 clip 3 already has its glasses off, so the prompt does not repeat their
removal. Creator 2 clip 3 still has a hand partially covering the lower face in
the clearest sampled frame. It has better eye visibility, not a fully clear face.
Optional owned person photos remain available in the normal preparation flow.

Accepted older v1/v2 preparations retain the original frame bytes, directions,
generated variation and approval. Reopening does not resubmit or charge. An
explicit **Use clearer source frame** action begins a new preparation while
preserving photo/model/instruction choices and the prior history.

## Validation and limits

| Check | Local result |
| --- | --- |
| Combined creator, image/video admission, Remix, slideshow and starting-frame regression suite | 326 passed; 0 failed |
| Worker image/private-media/contracts | 47 passed; 0 failed |
| Pure creator receipt/model/role/capability/approval simulations | All 12 clips × 3 image models passed |
| Actual starting-image API with mocked auth, credits and jobs | All 12 clips × 3 image models passed, including repeat and legacy replay |
| Complete new preparation browser journeys | 12 passed: source, photo fixture, variation choice, loaded preview, approval, motion/handoff, recovery |
| Accepted legacy preparation browser journeys | 12 passed: original source, zero-submit recovery, explicit clearer-frame switch |
| Hook menu/gallery/authenticated media | Seven desktop/mobile viewport sizes passed |
| TikTok menu/gallery/Recreate selections | All 10 sets at 1280×720, 390×844 and 320×568 passed |
| Private slideshow image generation admission/planning | All 10 sets / 39 ordered image inputs passed with mocked providers |
| Build packaging | All 39 slides in preview, provider and canvas routes; all 12 selected + 12 retained source files in frame routes |
| Client/public packaging check | No private hash-named assets under public; private manifest markers absent from 430 client JS bundles |
| TypeScript, scoped lint and webpack production build | Passed |

The browser checks use fixture authentication, entitlements, person photos and
generated outputs around actual menu/cards, authenticated APIs and preparation
components. They verify workflow behavior, not generated facial likeness,
caption removal, motion fidelity, live provider availability or viral traction.
No live paid image/video/Remix call was made for this work. Final authenticated
acceptance must use `https://www.getugcpilot.com` after an authorized website and
worker deployment.

Durable evidence alongside this file:

- `creator-profile-frame-review-2026-10-24.json`: hashes, timestamps, review notes
  and selected-pose directions.
- `creator-profile-api-simulation-2026-10-24.json`: per-clip/model API results.
- `creator-profile-browser-simulation-2026-10-24.json`: new preparation journeys.
- `creator-profile-legacy-simulation-2026-10-24.json`: legacy recovery journeys.
- `creator-reference-packaging-2026-10-24.json`: server asset traces and client
  manifest-marker checks.
- `creator-reference-gallery-simulation-2026-10-24.json`: Hook and TikTok viewport
  and access-check results.

Reproducible current-source contract simulation:
`node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/simulate-creator-reference-parity.mjs`.
