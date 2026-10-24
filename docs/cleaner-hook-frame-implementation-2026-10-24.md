# Cleaner Hook frames: local implementation

Deployment remains paused. These changes are prepared locally; production
visibility and hosted Recreate acceptance have not been verified.

## Count and scope

There are **20 approved replacements**, not 21. The previous combined review
filter also included Hook 88's unapproved proposal. The review now separates
Approved replacements (20) and Proposed replacement (1). Hook 88 keeps its
original opening. The frozen approval evidence is
`approved-hook-frame-selections-2026-10-24.json`; its historical `runtimeApplied`
flags describe the approval-record stage, not a production deployment.

Hooks 27, 84 and 89 are excluded by their stable reference IDs in their owning
release manifests. The local discovery catalog has 104 entries rather than 107.
Original videos, audio, captions, prompt identities and existing results remain
available through archival lookup. Direct new source preparation rejects hidden
references; saved owned results can still be recovered.

## Recreate behavior

1. Clicking Recreate resolves the active reference and source-video hash.
2. For an approved replacement, the server reads the exact reviewed PNG from
   `public/explore/curated-hook-frames/v1/`. Twenty PNGs total 11,422,314 bytes.
   Both server API bundles explicitly include these assets in Next file tracing.
   Other eligible references keep their original opening extraction.
3. Hash, dimensions, decoded frame index and elapsed timestamp are verified.
   A changed source or missing/corrupt asset stops preparation without an
   opening-frame fallback. Preview and paid admission use the same resolver.
4. Person photos remain ordered main-first. Generating sends the selected PNG
   as Image 1, followed by the chosen person's photos. Shared prompt v4 remains
   active; curated later frames omit the old frame-zero opening description.
5. Draft and generation receipt v3 bind the approved frame and model to the
   request. Legacy v1/v2 receipts retain their original frame-zero semantics and
   input keys. The shared curated bindings must remain immutable for recovery.
6. A stale or missing preparation key for a curated request is rejected before
   snapshot storage or credit reservation. Accepted requests retain their saved
   request identity for recovery without another provider submission.
7. Users review variations and explicitly select Use this frame. No inference
   starts simply by opening Recreate. Saved-result resolution returns the actual
   source-frame index, and Starting frames history derives motion from that
   saved frame rather than silently using frame zero.

Twenty frame-bound motion suggestions are prepared around the selected pose.
They are **preparation guidance, not visually qualified video results**. The
generated image can still drift in pose, clothing, identity or background;
inspect it and its directions before animation. No promise of reproducing the
original video chronology is implied by choosing a later opening image.

## Verification

- 242 automated tests pass across source extraction, curated asset integrity,
  browser response verification, drafts, API admission, worker/provider mocks,
  result recovery, Starting frames history, variations, navigation, discovery,
  archive lookup, existing audio behavior and historical scene-trim records.
- All twenty approved hashes and dimensions match the packaged PNGs. Unknown or
  altered v3 frames are rejected. Old v1/v2 records remain parseable.
- Worker tests exercise all five supported still-model routes with a valid v3
  later-frame receipt and exact image ordering. Providers are mocked; this is
  transport validation, not a new image-quality test.
- Review-page filter logic checks 20 approved, 1 proposed, 3 hidden and 83 kept.
- Worker TypeScript build and website production build pass, including type
  checking and the existing native-route bundle checks. Both source preparation
  and image-generation API traces contain all twenty unique PNGs; their traced
  files match every approved SHA-256. Windows trace path spellings are normalized
  before counting unique files.
- The restarted local audit page returns HTTP 200 with the corrected filters.
  This is an HTTP/static-script check, not authenticated browser acceptance.

No paid generation, database mutation, push or deployment was performed for this
implementation. Real authenticated production verification remains pending.

## Release order when resumed

First deploy the backward-compatible image-generation worker. Then deploy the
website producer and catalogs together with the twenty bundled PNGs. Existing
snapshot storage continues to copy verified scene bytes into the trusted media
store before dispatch. This implementation needs no separate asset upload or
new IAM/env changes. Verify both API traces contain every PNG, then check the
real production domain's discovery, Recreate, history and a reviewed animation.
Rollback the website producer first and retain v3 worker parsing and assets for
already accepted jobs.
