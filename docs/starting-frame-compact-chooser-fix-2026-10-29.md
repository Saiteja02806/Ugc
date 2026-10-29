# Compact starting-frame chooser - 29 October 2026

Local fix; not deployed. No image/video generation or provider charges.

The selected starting image used the generic full-width square wrapper. The compact renderer now reuses the existing `startingFrameCard` portrait sizing and `data-starting-frame` rules (about112x200 pixels), with the existing visible Change action instead of an ambiguous plus. Remove still clears the frame; photo controls remain behind Change with no duplicate always-visible chooser.

The reported non-opening button was not reproduced in the isolated actual-component browser. After this patch, Change opens the Choose image controls, and Change photos opens the photo library at both1280px and390px. This does not establish the cause of the original hosted click failure. Hosted acceptance remains NOT VERIFIED.

The browser did reveal the wrong initial library section for uploaded identity photos. The supplied influencer-library picker now defaults to Uploaded photos when its selected original is an upload, and retains My Influencers as the generated-image default. Explicit tab choices still take precedence.

## Original-photo handoff

Existing implementation verified by source and local tests:

- Image approval stores `identityAssetIds` from the exact frozen `approved.imageAssetIds` in hook-starting-frame-workspace.tsx.
- History recovery copies `receipt.personImageAssetIds` into the selection.
- useStartingFramePhotos restores the owned IDs, refreshing media URLs; explicit saved empty/replaced selections win over receipt defaults. Stale requests and deleted photos fail safely.
- startingFrameAnimationInput sends generated image identity as startingFrameAssetId/jobId and the original photo URLs separately as referenceImageUrls with person purpose. Supported Omni route consumes those roles; unsupported models do not silently acquire extra inputs.
- Added a connected uploaded-photo restoration-to-video-input test. No actual provider request was sent; output face consistency is unverified.

## Evidence

-19 focused tests PASS: starting-frame-animation-references, starting-frame-photo-carryover, starting-frame-model-extension and hook-starting-frame-client.
- Local browser PASS: actual component and photo library, compact geometry, desktop/mobile click, Uploaded photos selected, original photo retained. Authentication is stubbed and the source is local test media.
- TypeScript and scoped ESLint PASS; scoped diff whitespace PASS.
- Screenshots: `.tmp/starting-frame-compact/compact-1280.png`, `compact-390.png`, `chooser-1280.png`, `chooser-390.png`. Fixture CSS is scoped for geometry/interaction, not a complete application golden screenshot. User screenshot remains the broken before-state evidence.

## Files and protected behavior

Changed components: starting-frame-animation-references.tsx, format-generation-references.tsx. Tests: scripts/starting-frame-animation-references.test.mjs, scripts/starting-frame-photo-carryover.test.mjs, new scripts/starting-frame-compact.browser.cjs. This receipt and append-only context/incident notes.

Preflight: applicable AGENTS/Explore history and nonnegotiables; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate; installed Next use-client guide. Existing approved image/identity roles, photo removal/replacement, generation settings, drafts, scheduling and unrelated worktree edits are preserved. No dependency, schema or backend change. Incident UGC-UI-001 compact-frame recurrence; locally verified, production remains open.
