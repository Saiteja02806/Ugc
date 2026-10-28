# Starting-frame loading and reference audit

27 October 2026 — UGC-UI-039. **Locally verified; not deployed.**

## Findings

The reported reference selection is correct in production records:

| Attempt | Job | Identity photos | Total inputs including scene | Queue | Processing |
|---|---|---:|---:|---:|---:|
| First Seedream | 502e1728-8ad0-4e16-8ae3-8c5f58355f79 | 1 | 2 | 0.67s | 59.31s |
| Second Seedream | 9c814c29-7b9b-4425-a226-0c9a552dd817 | 3 | 4 | 0.63s | 70.28s |
| Later GPT Image | b674dbd6-2b61-47f8-8934-af4da315db39 | 3 | 4 | 1.11s | 19.85s |

These jobs share draft `4fc2eac2-ab15-447c-9ffa-bec852203960` and reference `talking-bittenbyaturtle` (Close glasses selfie). Results completed with ready media records. Counts come from saved job inputs and receipts, not the displayed photo strip. No assumption that three photos alone caused the longer runtime, and one example is not a model-speed benchmark.

`generateStartingImage` freezes the current prepared draft for each deliberate request. Its POST uses `frozen.imageAssetIds`. API admission resolves each owned asset and saves ordered `[source, ...identityPhotos]`; the worker preserves that list when resolving delivery URLs; Seedream's adapter maps every entry into `input_references`. Previous generation output is not silently substituted for these identity photos. Curated full-recreation routes can additionally contain an anchor with a separately defined role.

Job events show 58.43s and 69.43s in `waiting_for_image_provider`, with provider result persistence taking 0.60s and 0.65s. This stage includes preparation/provider work; operation `submitted_at` is null, so an exact provider-only duration cannot be calculated. It is nevertheless the dominant backend stage, not queue backlog or output storage. Provider wait is not reduced by a spinner.

A read-only download of the second completed PNG returned HTTP200, 1,280,719 bytes, first byte at 2.659s and total 3.374s from the audit environment. This is a single sample, not the user's browser telemetry. Initial sandboxed downloads failed; the network-enabled read succeeded. Healthy foreground status polling is every 3s; transient/collection errors use slower recovery, and background-tab polling can pause. No polling intervals, paid retries or worker architecture changed.

The image-preview component already has a loading spinner, image-load/error handlers and a 15s recoverable preview timeout. The missing generation feedback was earlier: the pending result used a static image icon, and pending recreation thumbnails were visually blank. No evidence justifies changing download safeguards, model defaults or reference limits for this issue.

## Implemented scope

- `components/explore/hook-starting-frame-workspace.tsx`: animated spinner and `aria-busy` for pending selected result, checking/queued/generating/finishing labels, spinner in pending recreation thumbnails, explicit saved-request message on read errors. Reduced-motion class retained. No new controls, layout/CSS changes, requests or auto retries.
- `scripts/hook-starting-frame-ui.test.mjs`: one-photo to three-photo regeneration freezes separate input keys/payloads; loading feedback across dialog/workspace/recreation; failures and status-read errors stop the busy state without resubmitting.
- `lib/explore/hook-keyframe-generation-api.test.mjs`: independent attempts retain one/three photos and queue two/four ordered references.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this report: append evidence and incident status.

Pre-existing retry-guard and recent-photo changes remain intact. Rollback only this request's loading variables/markup and tests/appended receipts; never revert entire shared files. Shared worktree still contains unrelated changes and unresolved merge conflicts. No release attempted.

## Verification

- `node --experimental-transform-types --test scripts/hook-starting-frame-ui.test.mjs scripts/starting-image-status-recovery.test.mjs scripts/hook-starting-frame-variations.test.mjs`: **66 PASS**.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/explore/hook-keyframe-generation-api.test.mjs lib/explore/hook-keyframe-client.test.ts`: **26 PASS**.
- `npm --prefix worker run build`, then `node --experimental-test-module-mocks --test worker/dist/lib/openrouter-seedream-image.test.js worker/src/jobs/generate-image.test.mjs`: build PASS, **36 tests PASS**. Includes ordered provider references, durable recovery and no duplicate paid dispatch. Initial direct source worker test was the wrong runner for `.js` imports; corrected compiled-worker tests pass.
- Scoped ESLint, `npx tsc --noEmit --incremental false`, scoped `git diff --check`: PASS.
- Isolated real component/CSS browser fixture at1440×900 and390×900: before has no pending spinners; after has one main spinner and two pending thumbnail spinners. Duplicate submission remains disabled; no overflow or browser errors. Temporary fixture uses auth/source/job stubs, not production inference. Encoding defects in initial fixture screenshots/new labels were corrected and rechecked.
- Before/after artifacts: `.tmp/starting-frame-loading-20261027/before-1440.png`, `after-1440.png`, `before-390.png`, `after-390.png`; browser receipt and logs alongside them. Desktop before/after and mobile after manually inspected.

| Protected behavior | Status |
|---|---|
| Latest photo selection and immutable prior attempts | VERIFIED by UI/API tests and saved production records |
| Ordered provider references | VERIFIED by source and worker/provider tests; no fresh paid call |
| Running/uncertain request duplicate guard, recovery | VERIFIED locally |
| Failed-image retry and source provenance | VERIFIED by retained regression tests |
| Existing controls and responsive geometry | VERIFIED in isolated browser |
| Authenticated deployed UI and exact browser completion latency | NOT VERIFIED |
| All normal-image workflows/models' production latency | NOT VERIFIED; sample is scoped |
| Scheduling / fresh generated image quality | NOT TESTED; no relevant code or paid calls |

Preflight: AGENTS instructions; relevant Explore context and incident ledger, including UGC-UI-036/038 and prior status recovery; nonnegotiables; context-memory, immutable-contracts, UI-clarity, regression-gate, starting-frame and video-prompt skills (the latter two retained from prior turn); bundled Next use-client guide retained; Supabase skill for read-only job evidence. Full historical context output had truncation, so no complete historical reread is claimed. Preflight readability check passed. Source/identity/timestamp/prompt contracts remain unchanged.

No paid generation, schema change, publishing, deployment or production state reset occurred. The fix improves truthful loading feedback; it does not claim faster provider execution or complete hosted acceptance.
