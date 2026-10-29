# Talking Head: prepared image and voice reference — 29 October 2026

Status: LOCALLY VERIFIED; generated-output and hosted acceptance NOT VERIFIED. No deployment, paid generation, real publishing, database migration, dependency/config change or MCP build.

## User decision and implementation

The user clarified that selected audio is a **voice reference**, and explicitly approved using the prepared image as a general image reference when the chosen model cannot combine voice audio with a literal first frame.

- Selected audio now displays its filename on the tile itself. Long names wrap to two lines with a full-name tooltip; space is reserved for the existing remove/plus controls. Preview, upload, saved-audio selection and removal remain.
- The rejected long starting-frame/audio footer instructions are gone from valid Talking Head image+voice requests.
- Talking Head with an approved image, one voice reference and Sound on uses an explicit `startingFrameMode: image_voice_reference` request on WAN 3.0 or Seedance 2.5. The client still sends the approved image asset/job pair, rather than trusting a client-supplied scene URL.
- The server resolves that image's owned completed preparation, verifies canonical Talking Head workflow/reference/shape, and checks image size, owned audio identity, duration, MIME type, file size, provider/model and audio settings before billing. Public Hook and Wall cannot use this exception.
- Provider input uses the approved image as Image 1, optional owned face photos as Images 2+, and the owned recording as Audio 1. The wrapper tells the model that Image 1 supplies identity/scene/pose; later photos provide facial identity only; Audio 1 supplies voice/delivery rather than reference words or background music. The user's exact script remains in the prompt. This is guidance, not proof of voice cloning, script-perfect audio or lip-sync quality.
- The durable job keeps `startingImageReference` with mode, original image/job IDs, source hash/index and original receipt. It does not mislabel a reference image as a strict first frame. Ordinary worker reference routing is reused, so no worker application change was needed.
- Without selected voice audio, the existing literal-first-frame route remains unchanged. Sound off with attached voice is explicitly blocked until the user enables Sound. Omni's current route still does not accept uploaded voice references; it gives a supported-model message instead of dropping the audio or silently switching models.

## Provider evidence

Checked the current [WAN documentation](https://reapi.ai/docs/wan-3-0): strict frame-family inputs and reference-family inputs cannot be mixed. Checked [Seedance documentation](https://reapi.ai/docs/seedance-2-5): with timed references, frame-role images are interpreted as general references. This is why removing the old validation alone would have been incorrect. No paid capability probe was performed. The Google model-page fetch/search was unavailable; no additional Omni audio support was inferred.

## Files changed for this task

Application:
- components/explore/workflow-audio-reference.tsx — visible filename and bounded tile layout.
- lib/explore/workflow-generation-client.ts — validate voice/reference mode, freeze and submit explicit mode; preserve no-audio behavior.
- lib/explore/starting-frame-workflow.ts — separate voice/scene/identity role instructions while preserving supplied directions and defaults for old callers.
- lib/ai-studio/video-generation-api.ts — explicit admission, owned prepared-image/audio validation, reference-mode provider input and frozen provenance.

Tests:
- scripts/workflow-composition-panel.test.mjs — selected name and retained preview/removal binding.
- scripts/workflow-generation-client.test.mjs — WAN/Seedance mode and exact owned voice payload.
- scripts/workflow-generation-api-contract.test.mjs — real client/API admission with zero/one supporting photo, mode/identity/audio/size/workflow failures before credits.
- scripts/talking-head-references.browser.cjs — scoped audio-name browser fixture with production Sound markup and actual audio/form components.
- worker/src/jobs/generate-hook-video.reapi.test.mjs — actual compiled worker/provider transport, reference roles and same-operation recovery.

Documentation: EXPLORE_CONTEXT.md, docs/ai-context/clear.md, docs/ai-context/nonnegotiables.md and this receipt. Existing unrelated worktree changes retained. Roll back only these task hunks; no database rollback required.

## Preflight and protected scope

Read mandatory context-memory, immutable-contracts, UI-clarity, regression-gate, video-prompt and starting-frame skills; latest explicit original-t=0 contract supersedes historical fallback skill examples. Reviewed protected nonnegotiables, supplied AGENTS, relevant Explore/audio incidents under the user's prior relevant-sections authorization, actual callers, API ownership checks and provider role builders. Ran repository preflight successfully. This task changes an input-role wrapper, not any source-specific motion timeline or source-frame extraction. Incident UGC-UI-065 recorded before edits; later user approval recorded separately.

## Verification

- **205/205 PASS** application tests: actual client/API, generation contract, audio composition/picker, form, bookmarked audio, Hook/Phone UI and recovery. `.tmp/voice-image-final-tests.log`.
- **28/28 PASS** worker/provider tests: actual compiled worker with intercepted provider HTTP, WAN/Seedance `image_urls` + `audio_urls`, no strict frame-role mixing, native sound flag, one submit across recovery, no fallback/duplicate-charge bypass. `.tmp/voice-image-worker-tests.log`. Worker application source was unchanged; tests use its existing compiled output.
- Negative API tests cover unsupported Omni, Sound off, unknown mode, missing audio URL/ID, wrong reference, foreign audio owner, oversized prepared image and a public Hook masquerading as Talking Head. All reject before jobs/credit reservation.
- **Browser PASS** `node scripts/talking-head-references.browser.cjs --audio-name-only`: actual form/audio/preview components at1366/1536/390px, visible exact filename, two-line wrapping, no overlap with plus, full-name tooltip, removal and Sound keyboard/click behavior. Fixture audio state, no real generation. Visually inspected the final390px screenshot. The first visual review exposed inherited button nowrap; after correction, bounds caught a fractional overlap, fixed by reserving more footer space. Final assertions passed without weakening them. Screenshots `.tmp/talking-reference-browser/selected-audio-name-{1366,1536,390}.png`.
- TypeScript `npx tsc --noEmit`, scoped ESLint and diff check PASS; Git line-ending notices only. Logs `.tmp/voice-image-mode-{types,lint,diff}.log`.

VERIFIED locally: selected filename, input order/role contract, script retained, owned provenance, no-audio exact-first-frame compatibility, unsupported-route rejection, Sound choice, idempotent recovery, existing saved edits/routes untouched.

NOT VERIFIED: generated voice similarity, exact pronunciation/script adherence, lip-sync, scene/identity fidelity, exact opening in reference mode (explicitly not guaranteed), authenticated production UI and live provider availability. No full production build or deployment. The mode is authorized and implemented locally, not proven on the live site.
