# Slideshow Face Swap wiring audit — 5 November 2026

IMPLEMENTED locally. Local functional paths are verified with synthetic infrastructure. DEPLOYED and OUTPUT VERIFIED: NOT VERIFIED. No build, development server start, deployment, production mutation or paid generation was performed. This is not a claim of complete live end-to-end acceptance.

The actual breaks were more than a missing planner field: identity selection lived in browser localStorage instead of the generated-image job; foreground completion had to start a second request; a legacy slideshow face child lacked the business context the worker required. A base image could therefore be presented before identity work, or identity work never started. Saved AI-influencer photos were also rejected by the planner resolver's image-only collection check although the chooser supports them. Historical generated photos can lack file-size metadata; these are now downloaded within strict byte limits before planning/reservation, rather than rejected as though empty. Known invalid sizes and empty/oversize actual content still fail before spending. No historical rows are mutated.

New jobs freeze the exact marked target and ordered primary/support photo IDs and canonical URLs. Only marked targets in Version 1 carry this contract. The base image model receives its original source/layout/explicit generic uploads, not the separate face photos. The worker revalidates ownership, ready/deleted state, MIME, size, exact asset-to-URL mapping and order, then signs private photos at execution. The real face adapter receives the generated base PNG, primary photo PNG and every supporting PNG. Identity and harmonization must finish before final image storage and job completion. Retries reuse saved stages; uncertain paid submissions remain blocked. New combined jobs are marked in admission/recovery so the existing client does not start another paid swap.

Charging: successful request totals stay base images plus one face credit per marked source slide, Version 1 only. The marked image job reserves both credits together through the existing reservation API. The final slide is one completed job; a failed identity stage is a failed/recoverable combined job rather than a completed base plus a failed second swap. No billing schema or settlement function changed. Historical job inputs and paid stage fingerprints are not rewritten. The corrected support-count prompt is opt-in for new combined jobs only.

## Evidence matrix

| Boundary / protected behavior | Status and actual evidence |
|---|---|
| Existing two-step picker, Done/Cancel/Back, add/remove/upload, eligibility | VERIFIED locally by actual component-handler tests, synthetic upload/network; current UI components unchanged in this task |
| Actual composer request serializes dedicated selection without duplicate + upload | VERIFIED locally by actual component handler and pending-request persistence harness |
| Authoritative admission validates exact owned ready photos and current source targets before planning/reservation | VERIFIED locally by real API/named resolver with synthetic asset records; foreign/missing/deleted/duplicate/size/type/target negatives. Unknown-size historical photos undergo real bounded download code before planning/credit; synthetic empty/oversize replies are rejected |
| Saved execution input and source identity | VERIFIED locally by actual API queue payload JSON round-trip, exact original targets 1 and 4, reordered marks, repeated admissions and Version 1 only; real DB RPC persistence NOT TESTED |
| Browser-independent execution | VERIFIED locally by real worker invoked using only serialized jobs and saved operation/storage fakes, with no UI/localStorage; actual hosted queue delivery/browser-closed execution NOT TESTED |
| Actual selected-photo consumer and stage | VERIFIED locally: real downloader/durable runner/face adapter builds HTTP image bytes as base -> primary -> supports. DB rows deliberately reversed; private signing uses synthetic signer. Planner/base never receive the separate identity images |
| Unmarked slides and later versions | VERIFIED locally: no execution contract, identity query, adapter call or face credit; real pixel stability NOT TESTED |
| Final result correlation | VERIFIED locally: final storage key, returned URL, slideshow slot and image status refer to the final worker output; no base-only completion on identity failure. Authenticated live rendering NOT TESTED |
| A-to-B, order, four photos, clear | VERIFIED locally through API/worker/adapter bytes; picker-handler selection regressions also pass |
| Failures/recovery/idempotency | VERIFIED locally: invalid targets/versions, missing/foreign/deleted/unready/changed public photos, lost final write, lost stage acknowledgement, safe 429 retry, uncertain submission blocked, no duplicate browser swap or paid base retry |
| Existing standalone face requests | VERIFIED locally: owned-image API tests and actual worker compatibility test preserve slideshow slots without new business-copy snapshot; ordinary base jobs still require saved business context |
| Existing models, photo/source roles, historical fingerprints, unrelated controls | VERIFIED locally by scoped diffs and regression suites; no UI layout/provider/model/manifest/schema/config edits. Broader deployed behavior NOT TESTED |
| Real provider identity/copy/scene quality | NOT TESTED. HTTP responses are synthetic colored PNGs. Correct bytes do not prove a model honors them |

## Files changed by this audit

- `lib/ai-studio/image-generation-api.ts`: freeze execution and reserve the combined marked job; return managed flag from saved input.
- `lib/ai-studio/generation-request-api.ts`, `lib/ai-studio/pending-generation.ts`: preserve managed flag in read-only recovery/types.
- `lib/explore/slideshow-named-context.ts`, `lib/explore/slideshow-request-plan.ts`: authoritative identity URL/collection validation, separate frozen identity context, bounded-byte admission for historical unknown-size saved photos.
- `lib/explore/slideshow-face-swap.ts`: no browser duplicate for managed jobs, historical planning preserved.
- `worker/src/jobs/generate-image.ts`: match target/version; consume identity contract before final storage; historical child compatibility; output provenance.
- `worker/src/lib/slideshow-face-swap-contract.ts`, `worker/src/lib/slideshow-face-swap.ts`: bounded dependency-free role validation and execution-time owned-photo resolution.
- `worker/src/lib/openrouter-gemini-image.ts`: opt-in accurate support count for new jobs, historical prompts unchanged.
- `lib/ai-studio/slideshow-face-wiring.test.mjs`, `lib/ai-studio/image-generation-api.test.mjs`, `scripts/explore-format-generation-ui.test.mjs`, `worker/src/jobs/generate-image.test.mjs`: cross-boundary bytes/recovery and actual handler tests.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/nonnegotiables.md`, `docs/ai-context/clear.md`, this receipt: append-only scope/contracts/incidents/evidence. Global mistakes ledger receives a linked reusable lesson.

Concurrent feedback, preload, starting-frame, Remotion and other work was preserved. Changes that already existed in shared files are not all attributable to this audit.

## Preflight sources actually read

Root/user `AGENTS.md`; global `C:/Users/chund/.codex/mistakes.md`; full protected `docs/ai-context/nonnegotiables.md`; relevant complete Slideshow face-selection/execution/recovery/planner sections of `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md` and `docs/ai-context/clear.md` under the user's explicit historical-read waiver. Skills: installed `verify-feature-wiring` and its evidence receipt; `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-ui-clarity`, `ugc-video-prompt`, `ugc-regression-gate`, and `supabase`. Installed Next use-client guide inspected. Preflight tool ran read-only and prerequisites passed. No claim to have read the megabyte historical ledgers completely.

Supabase filter/ownership lookup was checked against [official filters](https://supabase.com/docs/reference/javascript/using-filters) and [in](https://supabase.com/docs/reference/javascript/in) documentation. The initial web fetch of changelog.md rejected its text/markdown content type; this does not validate live database access. Worker uses existing ownership/signing infrastructure and no DB policy/schema changes.

## Checks and limits

Non-build node tests run directly against TypeScript sources. `scripts/worker-source-test-loader.mjs` maps worker .js imports to current .ts files; no stale dist or worker compilation is used. External network/provider/storage/queue/DB effects are fakes, not proof of deployed consumption. Isolated test SDK resolution failures were corrected and recorded, not counted as acceptance.

- Final combined regression suite: 422/422 PASS, zero skipped, `.tmp/slideshow-face-regressions.log`, including explicit legacy slot compatibility and historical unknown-size photo regressions.
- Latest worker compatibility suite: 40/40 PASS, `.tmp/slideshow-face-legacy-worker.log`.
- Cross-boundary integration: 12/12 PASS within the final combined suite; `.tmp/slideshow-face-final-compatibility.log` additionally records these12 plus37 app API tests (49/49). Covers public/private photos, exact bytes, only marked first versions, legacy missing-size metadata, recovery and negatives. Earlier ten-case log is `.tmp/slideshow-face-integration.log`.
- Standalone app API command without the worker source loader: 37/37 PASS, `.tmp/slideshow-face-api-portable.log`.
- Targeted ESLint: PASS, `.tmp/slideshow-face-lint.log`.
- `git diff --check`: PASS; uncommitted concurrent work retained.
- Worker `tsc -p worker/tsconfig.json --noEmit --incremental false`: PASS, `.tmp/slideshow-face-worker-types.log`.
- App `tsc --noEmit --incremental false`: FAILED on three pre-existing concurrent errors in `remotion/VidmakeLaunchPromo.tsx` (`isWinner` at1198; `highlight` at1901/1928), `.tmp/slideshow-face-app-types.log`. No reported errors in the face-wiring files. That unrelated work was not edited.
- No new screenshot baseline: runtime UI components/layout were not changed. Component interaction tests are not a browser screenshot or authenticated acceptance. No Next dev request was used to avoid implicit compilation under the no-build instruction.

Full combined command:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-format-generation-ui.test.mjs scripts/slideshow-face-swap-ui.test.mjs scripts/slideshow-face-flow.test.mjs lib/ai-studio/slideshow-face-wiring.test.mjs lib/ai-studio/face-swap-api.test.mjs lib/ai-studio/image-generation-api.test.mjs lib/ai-studio/pending-generation.test.mjs lib/explore/slideshow-generation-recovery.test.ts lib/explore/slideshow-plan-service.test.mjs lib/explore/slideshow-request-plan.test.ts scripts/slideshow-prompt-plan.test.mjs scripts/slideshow-prompt-api.test.mjs scripts/explore-format-reference-upload.test.mjs scripts/explore-workflow-job-recovery-api.test.mjs scripts/workflow-generation-recovery.test.mjs scripts/workflow-floating-feedback.test.mjs scripts/workflow-action-feedback.test.mjs scripts/workflow-sections.test.mjs scripts/workflow-composition-panel.test.mjs scripts/workflow-session-ui.test.mjs scripts/workflow-source-video-ui.test.mjs worker/src/jobs/generate-image.test.mjs worker/src/lib/openrouter-gemini-image.test.ts worker/src/lib/image-harmonizer.test.ts worker/src/lib/durable-image-stages.test.mjs
```

## Remaining acceptance and rollback

Incidents UGC-GEN-20261105-SLIDESHOW-FACE-EXECUTION and linked FRONTEND-BACKEND-COMPLETENESS remain OPEN for actual service/hosted/output acceptance. UGC-TEST-20261105-WORKER-DEPENDENCY-ISOLATION records the test/packaging correction; packaged execution is unbuilt.

Next authorized live acceptance must verify the real saved job/reservation and provider operation, close the browser, inspect identity-stage photo hashes/order and target/version scope, then reopen the exact completed result and review identity, text, scene and unmarked slides against their inputs. No paid/live test is implied by this audit. A future authorized release needs compatible worker code before API admission; an old worker ignores this new execution contract. No release was attempted here.

Rollback boundary: revert only this audit's additions to face contract/admission/worker execution/recovery suppression and supporting tests/docs, preserving pre-existing dirty work and all historical jobs. Worker and API admission must be coordinated; do not roll back the consumer while new combined jobs remain queued.
