# Shared Wall text asset: first end-to-end example

Status: local prototype validated on 2026-09-10. Feed, editor, authenticated
overlay endpoint, storage, and worker integration are implemented locally behind
`NEXT_PUBLIC_WALL_TEXT_SHARED_PNG`, but are not production-validated or deployed.
The local example is not acceptance of the authenticated integration.

## Implementation

`prepareWallTextOverlayAsset` extracts the existing worker preparation pipeline:
font registration, authoritative layout handling, measured width checks, SVG
rasterization, and pixel-fence validation. The worker export now calls this
helper with the same rendering behavior. The example persists its PNG once,
uses it as an image over a clean moving video, and passes that exact file into
the existing production FFmpeg argument builder. No video frame is inserted
into the source video and no browser font is used for the overlay.

The manifest includes a renderer version, input identity, font checksum,
renderer dependency versions, PNG checksum, and dimensions. Validation rejects
stale inputs, byte corruption, wrong dimensions, missing transparency, empty
images, and opaque images. These checks are integrity checks, not authentication.
Production ownership must be enforced separately.

## Reproduce

1. `npm run test:wall-overlay --prefix worker`
2. `node scripts/wall-text-shared-overlay-example.mjs output/wall-text-production-parity/inputs.json <clean-local-source.mp4>`
3. `node scripts/serve-wall-text-example.mjs`
4. Open `http://127.0.0.1:8766`, choose width, and compare at three seconds.
   `?fail=1` simulates a missing PNG without deleting the saved file.
   `?fail=video` simulates a missing background video.

The example requires the existing local reference fixture and clean source;
generated output is not a committed fixture. It uses silent audio for visual
testing. It does not validate the production audio-selection workflow.

## Evidence

- 50 focused worker/render/asset tests pass, including normalized content identity
  across product metadata removal by the worker transport.
- Worker TypeScript build passes.
- New PNG decoded pixels exactly equal the previous B worker PNG (all 8,294,400
  RGBA bytes). PNG file hashes differ because encoding differs.
- The preview and export consume the same new saved PNG checksum:
  `092b474c03772bc289a3164d7f14824bba7828d0793dc19b12483317825a97bd`.
- Browser inspected at 230, 277, 280, and 322 CSS pixels. Same line breaks and
  placement; small exported edge/sharpness differences remain, most noticeable
  at 230px. Sharing pixels does not eliminate video encoding or display scaling.
- Missing-PNG browser scenario disables playback and hides the cards with an
  explicit error. It does not substitute CSS text.
- Latest browser recheck confirms readiness waits for decoded video data as well
  as the verified PNG. Missing video times out with an explicit error and hidden
  cards; missing PNG also hides cards and disables comparison controls.
- Local React fixes prevent image creation after cancelled requests and display
  video errors even after an earlier successful load.
- Export frames at 1, 3, and 5 seconds differ, confirming background motion.
- Latest local run: 416ms text preparation, 125,080-byte PNG, 5.88s six-second video
  export. Preview only requires the PNG. These figures exclude cloud queue,
  storage upload, network, and AI generation latency.

## Work required before production enablement

The Next production build completed, but reports an overly broad NFT file-tracing
warning through the worker renderer import. A subsequent full TypeScript check
fails at `lib/trending/wall-text-publication-delivery.test.ts:8`: its `jobId` fixture
is not accepted by `PublicationReconciliationResult`. Do not describe the release
as fully validated until these are resolved.

The current storage integration uses deterministic manifests and verifies owned
asset references; the editor debounces draft generation and cancels stale loads.
Persisting the chosen reference with a creative revision, source-picker parity,
storage failure/concurrency coverage, and authenticated end-to-end acceptance
remain to be completed. Existing rendered exports need an explicit migration
policy; enabling a frontend flag does not rewrite those videos.

Persist the asset and manifest in object storage before marking a feed card
ready. Associate the immutable reference with the saved creative/edit revision.
Feed and editor must load that reference with cancellation, bounded retries,
and a visible error. Export jobs must receive and verify the same reference,
and never independently regenerate it. Reject stale edit completions. Handle
older records explicitly rather than assuming deployment updates baked videos.
Gate enablement, verify ownership and cross-user isolation, test concurrent
edits and storage failures, then validate a canary on the real production
domain before expanding rollout. No production enablement or acceptance is
claimed by this example.

## Combined release validation (2026-09-10)

The renderer was extracted into `worker/src/lib/wall-text-overlay-renderer.ts`
so Vercel does not import the full video worker. The app build now passes without
its previous NFT warning. Overlay tracing contains 261 files (~11 MB), includes
packaged fonts, and contains no local output or artifacts. The publication test
fixture type error was corrected. Worker checks: 235 plus 15 post-build tests;
asset checks: 5; UI/publication/scale checks: 40, all passing.

Release also includes Reaction foreground audio preservation, AAC output,
caption anchor at y=260, and a review-card sound toggle. Existing rendered media
are not rewritten by deployment. Production acceptance must still be recorded.
