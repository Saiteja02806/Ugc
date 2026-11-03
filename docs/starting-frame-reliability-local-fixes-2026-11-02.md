# Starting-frame reliability fixes — local only, 2 November 2026

Status: scoped fixes VERIFIED locally; live upload unblock and hosted generation NOT VERIFIED. No push, deployment, infrastructure application, database mutation or paid request. Palette, layout and application UI files unchanged by this task; other dirty work preserved.

## Implemented

1. **Upload configuration:** foundation Terraform CORS defaults add https://vidmake.io and https://www.vidmake.io, retaining legacy and localhost origins. Offline prepare-media-upload-cors.mjs accepts a captured existing bucket configuration, adds these origins only to its existing PUT rule and writes a new review file exclusively. No cloud calls or apply path exist in the script. Live configuration was read, not changed. Reviewed additive artifact: .tmp/explore-deep-audit/media-cors-reviewed.json; captured rollback rules: media-bucket-before.json. Production uploads remain blocked until a separately authorized application and browser verification.
2. **Stage retries:** new Gemini Pro starting-frame admission uses maxAttempts3 and optional startingFramePipelineVersion2. Historical jobs recover before admission, retain old budgets/payloads/fingerprints and are not rewritten. The actual job processor plus durable runner now has a regression covering a definite identity429 and a local harmonizer failure: first delivery queues, second completes, previously successful paid stages are reused. A separate test proves retry exhaustion is terminal. Stage storage/ledger acknowledgment failure throws a retryable recovery error; aggregate final-stage save failure is retryable on version2. Missing/uncertain paid outputs never gain permission for another paid submission. This does not promise recovery of an irretrievably lost provider response.
3. **Aspect ratio:** only version2 jobs pass imageSize2K into scene and identity requests, which emits explicit image_config.aspect_ratio/image_size. Both stage results are checked before proceeding; substantial scene-shape drift stops before another paid identity call. Final output independently checks shape. More than1percent ratio drift fails with image_aspect_ratio_mismatch instead of silently adding white padding. Small provider pixel-grid rounding retains the existing bounded near-ratio crop. Wrong-shaped stage bytes stay saved for diagnosis; automatic quality-chasing regeneration is not introduced. Legacy absent-version requests stay unchanged.
4. **Caption exports:** bundled Editorial TTF name tables contain UGCPilot Editorial Study and UGCPilot-Editorial-Study-* PostScript names. Code had requested Vidmake names. Corrected internal family and selected-font verification to the bundled names. Font files, appearance, layout and render version unchanged. Actual local captions/export tests now pass across styles/placements with visible pixels and audio preservation.
5. **Test harness:** restored actual provider-info and slideshow helper imports, motion-time helper and queueMicrotask in three VM suites. No assertion was removed or relaxed. This exposes remaining failures rather than masking them.

OpenRouter reference: https://openrouter.ai/docs/guides/overview/multimodal/image-generation. Current documentation emphasizes explicit output configuration and per-endpoint capability validation. This patch preserves the existing chat-completions integration and its image_config form already used by character jobs; it does not migrate APIs. Hosted acceptance of the new stage configuration still requires a bounded real test after rollout.

## Files changed by this task

- infra/gcp/foundation/variables.tf
- lib/explore/hook-keyframe-generation-api.ts and hook-keyframe-generation-api.test.mjs
- worker/src/jobs/generate-image.ts, generate-image.test.mjs, generate-image.hook-keyframe.test.mjs
- worker/src/lib/durable-image-stages.ts and durable-image-stages.test.ts
- worker/src/lib/image-output.ts and image-output.test.ts
- worker/src/lib/openrouter-gemini-image.ts and openrouter-gemini-image.test.ts
- worker/src/processor.test.ts
- worker/src/subtitles/editorial.ts and editorial-media.ts
- scripts/prepare-media-upload-cors.mjs and media-upload-cors.test.mjs
- scripts/explore-format-generation-ui.test.mjs, workflow-reference-inputs-ui.test.mjs, explore-workflow-job-recovery.test.mjs
- Append-only docs/ai-context/clear.md, EXPLORE_CONTEXT.md and this receipt.

No dependency, migration, billing policy, prompt text, CSS or application navigation change. The optional pipeline version is a server-admitted job field; invalid versions/models/routes are rejected before provider work and the version participates in the aggregate fingerprint.

## Validation

| Check | Result |
|---|---|
| Python preflight | PASS |
| npm run worker:build | PASS after final changes |
| npx tsc --noEmit --incremental false | PASS |
| Starting-frame API/result/client/draft/prompt/motion/history/variations/photo carryover/animation references |114PASS, includes two earlier CORS cases |
| Final worker processor/durable stages/OpenRouter/image output/Editorial tests |65PASS |
| Final generate-image + Hook dispatch tests |48PASS |
| Offline CORS policy and Terraform-origin tests |3PASS |
| Actual local single-pass captions + video finishing tests |10PASS; same frames/audio and fonts verified by render assertions |
| Scoped ESLint |0errors;1existing unused-variable warning in API test |
| Scoped diff check |PASS; CRLF advisories only |
| Full npm run test:explore |1314PASS /34FAIL /1348total; previously1178PASS /170FAIL |

Counts overlap and are not a unique total. Logs: .tmp/explore-deep-audit/fix-starting-frame-final.log, fix-worker-final.log, fix-dispatch-final.log, fix-cors-final.log, fix-subtitle-tests.log, fix-types-final.log, fix-lint-final.log, fix-last-lint.log, fix-explore-full.log.

Full-suite remaining34failures span older model/duration assumptions,14workflow recovery fixtures, style assertions expecting blue accents, a missing scheduling-helper mock and one slideshow fixture. They were not waived, and unrelated runtime behavior was not changed to satisfy them. Full suite ran before the last additive ratio-stage guard; its focused worker/dispatch checks were rerun after that guard. Full app release acceptance remains PARTIAL.

The ratio-validator export initially exposed another stale image-output module mock in Hook dispatch tests; the mock now reuses the actual validator, and the final48tests pass. No production defect was hidden by a no-op mock.

## Protected behavior and limitations

- VERIFIED locally: source t0/hash/ownership, source-default background/outfit and independent photo overrides, source/identity order, stale-result rejection, exact paid request recovery, old absent-field fingerprints, no Stage1 fallback after Stage2 failure, harmonizer failure propagation, uncertain-call no duplicate submission, bounded retries, no padded success for new wrong-ratio stages.
- UNCHANGED by scoped source diff: darker palette, layouts, selection controls, scheduling/publishing behavior, app credit quote/reservation semantics, standalone character and historical jobs. Standalone swaps retain their prior configuration; durable persistence error recovery is shared safely.
- NOT VERIFIED: live Vidmake upload after CORS application, production stage-ledger execution and provider image fidelity, caption removal in fresh model pixels, identity/wardrobe/background fidelity, production font rendering after worker release. Synthetic/local mocks cannot prove these.
- No current browser screenshots are necessary for this backend-only repair; existing approved UI geometry was not edited. Screenshots from the prior audit are not presented as new-output QA.

## Preflight and rollout boundary

AGENTS and relevant Explore/incident/nonnegotiable context, context-memory/immutable/start-frame/video-prompt/regression procedures, installed Next route guide and actual API/worker/store/processor/callers inspected. Large historical files were not reread in full in this fix pass; no full-history claim. UGC-UI-111, UGC-VID-053/054 and UGC-OPS-021 updated with measured local evidence; hosted status remains open.

Future authorized rollout order: review/apply only additive media CORS policy; verify real browser upload; deploy compatible worker before website admits version2 jobs; then one bounded authenticated source→upload→billing→queue→scene→identity→harmonizer→savedframe→approval pilot and pixel review. This document does not authorize or perform those operations.

Rollback: revert new website admission first; retain worker version2 compatibility until accepted jobs finish. Do not rewrite accepted inputs, remove stages or replay uncertain paid calls. Restore captured CORS only if required in a separately approved operation. No rollback performed locally.
