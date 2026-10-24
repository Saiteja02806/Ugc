# Creator starting-frame generation failure — 24 October 2026

Two production creator starting-frame requests failed before Google submission.
Both chose Gemini 3 Pro and an approved later source frame (version 3 receipt).
The saved provider-operation records report `request_not_submitted`, no
submission timestamp and no provider interaction ID. Both one-credit app
reservations are `released`. These checks read existing records only; neither
request was retried or modified.

The scene-mismatch error was misleading. The real Gemini adapter interpreted
only version 2 receipts as model-aware. It treated version 3 Pro as legacy Flash
and rejected it before contacting Google, even when source image hashes and
dimensions matched. This also affected public curated frames. Version 3 Flash
could inherit the legacy environment model instead of the selected Flash model.

The adapter now uses the existing shared receipt-model resolver for all three
receipt versions. Version 2 and 3 Flash use the explicit starting-frame Flash
model, while legacy version 1 retains its original override behavior. Contract
or model errors are reported separately from a genuine downloaded-image
digest/dimensions mismatch. All byte, prompt, receipt, model and ownership checks
remain in place; no input validation was bypassed.

Regression tests exercise the real adapter with every 21 public curated scene
and 12 private selected scene PNGs through both Gemini paths. Only downloads and
Google transport are simulated, with no paid provider request. Private fixture
checks explicitly skip in public clones without plaintext local assets; public
curated and negative checks still execute. The image test command includes this
regression suite. Separate legacy coverage preserves v1/v2 and saved-interaction
recovery behavior.

Local validation passes: worker TypeScript build; 89 focused adapter/job tests;
and all 135 tests in `npm run test:images --prefix worker` (zero failures/skips).
The focused set includes the separately run starting-frame job-contract suite.

This is a local fix awaiting deployment. It does not prove a new paid output's
likeness or that production generation is already repaired. Failed saved jobs
remain failed; checking their status never submits a replacement paid request.

Production follow-up: the fix is deployed on generation revision
`ugc-ai-generation-worker-r-e8cf2663` at 100% traffic. Baked and runtime source
identities agree, the functional worker configuration is preserved, and all
twelve private selected source frames return their approved hashes from the
live app. No new paid request was submitted. Existing failed requests remain
failed. Complete rollout: `creator-recreate-release-2026-10-24.md`.
