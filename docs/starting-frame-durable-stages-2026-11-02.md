# Durable starting-frame and Face Swap stages — 2 November 2026

Status: LOCALLY VERIFIED implementation, hosted acceptance NOT VERIFIED.

## Behavior
Stage 2 or harmonizer exceptions now fail the flow; no raw/Stage1 fallback is returned. New unsubmitted Gemini/OpenRouter starting-frame and Face Swap jobs use separate operation records: openrouter-image-scene-v1, openrouter-image-identity-v1, openrouter-image-harmonize-v1. Face Swap skips scene generation because its input already is the base scene.

Each stage has a request fingerprint over version, role and exact inputs. Successful stage output is decoded, normalized to PNG, written to a job/stage/fingerprint storage key, and recorded with output reference, model, provider request ID (paid stages only), SHA256 and stage. Retry validates saved pixels/hash and reuses them. Storage acknowledgement loss after saved bytes or DB receipt loss is recovered by the same object key without re-submission. No schema or billing ledger change is needed.

The aggregate operation gets stagesComplete=true only after all required stages finish and keeps that marker in final output-persistence metadata. Failed pipeline helpers cannot write aggregate success or final output. Existing completed outputs are reused without claiming that historical output passed every stage. Existing accepted unmarked operations retain the prior recovery path rather than being silently moved to new paid stage keys.

Historical receipt v4 uses opening + clarity + person references; the worker passes identity index2. Current v5 uses scene + person with identity index1. Identity/support order remains unchanged.

## Safe retries and limits
Only an atomic reservation submit grant permits a paid stage call. Known HTTP rejection such as 429 records retry_allowed through the existing classifier. Concurrent deliveries cannot both receive the submit grant. Ambiguous request/timeout or invalid returned image without saved bytes blocks resubmission; it does not auto-retry a potentially charged request. Once image bytes are saved, retries use them. A crash after provider acceptance but before any bytes are saved cannot be guaranteed recoverable through this synchronous OpenRouter API, and remains explicitly uncertain.

Harmonization is local CPU work; a failure records an explicit failed stage and throws a retryable error. Retrying the same job reuses its paid stages. Worker/job retry attempt limits and the existing billing reservation lifecycle remain in force. No new per-stage app credit reservation or new job ID is created. Existing retry RPC may re-reserve an original released app reservation under its current policy; this patch does not promise that a refunded job can be retried without funding its original charge. It prevents completed provider stages from being purchased again.

## Files changed by this task
- worker/src/lib/openrouter-gemini-image.ts
- worker/src/lib/durable-image-stages.ts (new)
- worker/src/jobs/generate-image.ts
- worker/src/lib/openrouter-gemini-image.test.ts
- worker/src/lib/durable-image-stages.test.ts (new)
- worker/src/jobs/generate-image.test.mjs
- EXPLORE_CONTEXT.md (append only)
- docs/ai-context/clear.md (UGC-VID-046 evidence appended)
- docs/starting-frame-durable-stages-2026-11-02.md (receipt)
All earlier user edits preserved. No palette/layout/component/manifest/config/schema changes by this task.

## Preflight and contracts
Applied previously read AGENTS.md, Explore context, incident ledger, nonnegotiables; context-memory, immutable-contracts, starting-frame, video-prompt, regression-gate and Supabase skills. Re-read relevant current context/ledger sections and protected contracts; Python preflight PASS. Inspected API admission, worker dispatch, provider helper, stage storage, operation reserve/update constraints, processor retry handling and original billing retry RPC. Existing original-t0 policy supersedes historical middle-frame suggestions. Used existing Supabase ledger methods; no live schema write. Supabase docs checked; changelog.md web fetch unsupported.

## Validation
1. npm run worker:build: PASS.
2. node --experimental-test-module-mocks --test worker/dist/lib/durable-image-stages.test.js worker/dist/lib/openrouter-gemini-image.test.js worker/dist/lib/image-harmonizer.test.js worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-image.hook-keyframe.test.mjs worker/dist/lib/generation-provider.test.js: 78 PASS, 0 FAIL.
3. node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/hook-keyframe-generation-api.test.mjs scripts/slideshow-face-swap-ui.test.mjs lib/jobs/generation-retry-credits.test.mjs scripts/hook-starting-frame-ui.test.mjs: 101 PASS, 0 FAIL.
4. npx tsc --noEmit --incremental false: PASS.
5. Scoped eslint on six changed TS/MJS implementation/test files: PASS, no output.
6. git diff --check -- worker/src: PASS (Git line-ending advisory only).
Logs .tmp/durable-image-build.txt, durable-image-tests.txt, durable-image-api-tests.txt, durable-image-types.txt, durable-image-lint.txt.

Fault cases: Stage2 rejected after Stage1 saved -> retries reuse Stage1; harmonizer failure in both flows -> same paid-call count on retry; ambiguous provider response -> second delivery never pays again; storage/DB acknowledgement loss -> saved-stage recovery; repeated completed runs -> zero additional calls; changed input/checksum mismatch -> rejection, zero replay; concurrent deliveries -> at most one paid call per stage. Worker dispatch and aggregate-success guard tested separately. All tests use synthetic images/provider/storage/ledger fixtures, not real provider quality or live DB persistence.

## Protected behavior receipt
VERIFIED locally: scene/identity ordering, version-aware offset, no partial success, stable operation fingerprints and output keys, no duplicate paid calls in tested failure/retry paths, existing billing retry tests, original starting-frame UI contracts. Palette/layout UNCHANGED BY PATCH; no new visual artifact needed for a worker-only change. Existing scheduling/source selection untouched. Rollback boundary is these worker files; do not replay accepted staged jobs on an older worker that lacks this stage contract.

NOT VERIFIED: hosted database/storage operation persistence, real paid request/debit, provider image identity/scene/cleanup fidelity, stage execution on deployed worker, production UX end-to-end. No paid generation, retry of customer jobs, commit, push or deployment performed. Prior observed output image belongs to the old code and is not evidence for this patch.
