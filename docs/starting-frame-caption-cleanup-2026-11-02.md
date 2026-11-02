# Starting-frame caption cleanup — 2 November 2026

Status: locally implemented and tested; generated-output and production acceptance NOT VERIFIED.

## Scope and evidence
User reports retained captions in production, while accepting face replacement/harmonization. Current Stage1 opening prompt already requests cleanup; Stage2 has no cleanup clause and a custom Stage1 prompt can omit it. These are verified code gaps, not proof of the precise cause in an uninspected hosted job. This change keeps source t=0, source/identity order, face replacement, harmonizer algorithm, palette/layout, billing and stage count intact. No new dependencies, schema, UI, config or deployment.

New Gemini/OpenRouter starting-frame API admissions save `startingFrameTextCleanup: true` in internal immutable job input. Worker permits it only for verified Gemini/OpenRouter starting-frame jobs and fingerprints it. Both paid prompts append identical instructions to remove captions, outlines, fragments, emojis, watermarks and physical lettering/logos while reconstructing underlying materials and preserving source scene/identity. Identity stage preserves already cleaned output and removes residual text. No new provider call is added.

Absent flag preserves exact old prompts and aggregate/stage fingerprints. Recovery returns the previously stored job rather than changing its policy; standalone Face Swap and all other image routes remain unchanged. Old completed captioned assets are not auto-regenerated. API/website and worker require coordinated release; no deployment performed. Rollback boundary: this flag's admission/dispatch and prompt additions; retain pre-existing durable-stage work and all unrelated user changes.

## Files changed in this patch
- lib/explore/hook-keyframe-generation-api.ts
- lib/explore/hook-keyframe-generation-api.test.mjs
- worker/src/jobs/generate-image.ts
- worker/src/jobs/generate-image.test.mjs
- worker/src/lib/openrouter-gemini-image.ts
- worker/src/lib/openrouter-gemini-image.test.ts
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md (append-only UGC-VID-049 follow-ups)
- docs/starting-frame-caption-cleanup-2026-11-02.md
Local trial harness/artifacts also added under `.tmp/starting-frame-caption-cleanup-2026-11-02/`; no secrets saved. Repository already has many unrelated changes, preserved.

## Procedure and verification
Applied previously read repository context and incident history; rechecked relevant Explore/current-ledger entries, protected nonnegotiables, AGENTS.md, context-memory, immutable-contracts, starting-frame, video-prompt, opening-frame-prompt and regression-gate procedures. Read installed Next route-handler guide. Python preflight PASS. Inspected API admission/custom prompt/idempotent recovery, contract parser, job fingerprints, both worker dispatch branches, provider helper and harmonizer. Existing source/identity images and generated stage comparisons from the preceding real test remain the visual evidence; no motion/video fidelity claim.

- `npm run worker:build`: PASS.
- Worker durable stages/OpenRouter/harmonizer/job dispatch/hook input/provider suites:80PASS,0FAIL. Tests cover both-stage cleanup with custom prompts, absent-policy historical prompts, dispatch propagation, standalone exclusion, strict failure, safe retries and saved-output reuse. Log `.tmp/caption-cleanup-worker-tests.txt`.
- API admission/slideshow face swap/credit retries/starting-frame UI/strict UTF8 suites:103PASS,0FAIL. New admission policy and old-job recovery tested. Log `.tmp/caption-cleanup-regression-tests.txt`.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped eslint on six implementation/test files:0errors,1pre-existing unused `sourceFrame` warning in API test. Log `.tmp/caption-cleanup-lint.txt`.
- Scoped `git diff --check`: PASS, line-ending advisory only.

## Actual provider trial
One fresh full-pipeline test attempted with the approved source and identity photos and verified existing Secret Manager inference credential held in memory. Real request `gen-1793598463-BPf3GXHvb6zhfq9FLCDM` returned HTTP200 and usage cost0, but no usable image reached the helper. It threw; durable ledger records submission_uncertain, no final output or success. Stage2/harmonizer were not reached. No retry or second provider request was made. Complete response was not archived, so internal upstream cause remains UNKNOWN. Do not infer that cleanup succeeded or caused the upstream failure. Artifacts/usage: `.tmp/starting-frame-caption-cleanup-2026-11-02/run-receipt.json` and starting-frame-ledger.json.

## Protected behavior status
VERIFIED by local tests: cleanup reaches both paid stages; new custom prompt cannot omit this policy; historical requests retain original prompts; source/identity order and timestamps unchanged; standalone Face Swap unchanged; strict failure/no-partial-success and no-duplicate retry checks pass. Harmonizer implementation UNCHANGED. Palette/layout UNCHANGED by this patch. No responsive UI code changes.

NOT VERIFIED: visual caption removal from a new successful generated output, production report's exact root cause, hosted persistence/charging, deployed behavior, mobile/desktop browser acceptance. User's accepted face/harmonizer appearance was not redesigned. UGC-VID-049 stays OPEN for visual/production acceptance. A successful test/build is not proof of caption-free pixels.
