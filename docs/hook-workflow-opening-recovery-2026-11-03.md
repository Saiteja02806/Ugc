# Hook workflow opening and Recreate recovery — 3 November 2026

Status: **locally verified repairs; live signed-in acceptance remains open**. No push, deployment, paid generation, cloud setting, schema, dependency, or customer-job change was performed. Baseline HEAD was `b09e721f`; concurrent billing, character, and cover work was preserved.

## Findings and evidence

1. **Large cover downloads delay workflow navigation.** Five visible 1080p cover masters total 35,463,355 bytes and start downloading together. Live isolated browsers measured Hook URL commitment at 2,535/2,950 ms normally versus 190/170 ms with only cover downloads blocked; route responses were Vercel cache HITs. A separate comparison measured 2,574/2,599 ms with hosted masters versus 163/77 ms when the same live page received the worktree's optimized covers (3,891,228 total bytes, 89% smaller). This establishes a bandwidth contributor, not every possible slow-opening cause. These URL-commit measurements are anonymous and do not measure authenticated reference readiness. Optimized cover files/mappings were introduced concurrently by other work and were tested, not authored, in this task. The current hosted deployment still served the masters during these measurements.

   Releasing the videos only after clicking was less effective: 3,571/3,787 ms normal versus 2,719/3,299 ms with click-time release. Consequently this task did not add a redundant playback-handler change. Existing optimized delivery addresses the demonstrated initial contention while retaining the videos.

2. **A rejected starting-frame import reaches the page boundary.** The existing wrapper had Suspense for a pending import but no local error boundary. A real browser test returning HTTP 503 for its first on-demand JavaScript chunk reproduced the full-page error. React.lazy also caches a rejection, so reusing that lazy type cannot recover it. The fix contains the error inside the existing dialog/workspace and offers Retry opening and Back to references. Retry clears the failed import and creates a new lazy type only on explicit retry. Closing and reopening likewise gets a fresh instance. It does not clear saved preparations or replay generation.

   This is a reproduced failure mechanism compatible with the screenshot. **The original customer's signed-in Recreate exception was not captured**, so its exact trigger—chunk transport, another render exception, or data-specific failure—remains UNKNOWN. A fresh production-built preparation component mounted successfully with isolated auth failures. Historical development-fixture frame-validation and anonymous-upload defects are separate incidents and were not assumed to explain this report.

3. **The deployed page-error recovery callback is wrong.** The live application chunk `app/error-ddd14800ec07702e.js` reads `unstable_retry`; the same deployment's `93794-d15115bee35372c0.js` supplies `retry`. Installed Next 16.4.2 agrees. Rendering the actual error screen with the real runtime prop and clicking Try again reproduced `TypeError: unstable_retry is not a function`. The three-identifier correction uses `retry`, preserving all error-page markup and the workspace link. This explains failed recovery, not the original Recreate exception.

The earlier 15-second navigation stalls and approximately 7.8-second route reads remain recorded. Fresh traces varied and sometimes redirected normally to sign-in; no universal server or authentication root cause was inferred. Available production runtime logs did not identify the client exception.

## Files changed by this task

- `app/error.tsx`: correct the supplied retry callback.
- `components/explore/lazy-hook-starting-frame-workspace.tsx`: local opening boundary and fresh lazy retry; normal loading shell and child props retained.
- `scripts/page-error-retry.test.mjs`: execute the actual page-error action with the installed Next callback contract.
- `scripts/hook-starting-frame-opening.browser.cjs`: actual React/component/dialog/styles/chunk-loader regression, with isolated authentication and failing reads, never paid inference.
- `docs/ai-context/clear.md`: append OPEN incident and verification evidence for `UGC-UI-20261103-HOOK-OPEN-RECREATE`.
- `EXPLORE_CONTEXT.md`: append this recovery decision and production limits.
- This receipt.

Existing optimized-cover changes in `lib/explore/workflows.ts`, `components/explore/ai-character-card.tsx`, and five content-hashed public MP4s belong to concurrent work. Other worktree files were neither reverted nor included in a release by this task.

## Preflight and scope

Read AGENTS.md, nonnegotiables.md, the context-memory/immutable-contracts/UI-clarity/regression-gate/starting-frame skills, relevant Explore and ledger incident sections, and installed Next linking/navigation, lazy-loading and error-boundary guidance/runtime. The large historical context files were indexed and relevant sections read; this receipt does not claim every historical line was reviewed. Relevant prior incidents: UGC-UI-050, starting-frame UGC-UI-099 and UGC-UI-118. `python tools/preflight.py --repo . --task "Fix live Hook video navigation delay and Recreate starting frame page crash"` passed prerequisite discovery.

The newer explicit original-t=0 source policy in nonnegotiables supersedes historical skill examples; this patch changes no frame-selection or prompt policy. Scope and rollback boundary are the two application files, two new tests and append-only documentation. No API, provider, draft schema or scheduled execution change.

## Verification

- Before correction, `node --test scripts/page-error-retry.test.mjs` failed with the exact undefined callback TypeError; afterward **1/1 passed**.
- `HOOK_OPENING_EXPECT_BROKEN=1 node scripts/hook-starting-frame-opening.browser.cjs` reproduced the pre-fix full-page error from a single failed chunk.
- Final `node scripts/hook-starting-frame-opening.browser.cjs`: **4/4 passed**, 1440×900 and 390×844, recreation dialog and workspace presentations. Each contains a real first-download failure; explicit retry/reopen imports the actual component successfully. Checks cover parent draft/localStorage retention, close/reopen, no horizontal overflow in recovery, no uncaught page errors, and **zero API writes**. Authentication/source errors remain safely visible within preparation. This is controlled boundary verification, not a real signed-in provider test.
- Existing suites: **116/116 passed** using `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test` with `scripts/hook-starting-frame-ui.test.mjs`, `hook-starting-frame-navigation.test.mjs`, `hook-starting-frame-client.test.mjs`, `hook-local-starting-frame-preview.test.mjs`, `hook-composer-selection.test.mjs`, `hook-starting-frame-variations.test.mjs`, `explore-navigation-ui.test.mjs`, `reference-cover-playback.test.mjs`, and `source-utf8.test.mjs`.
- Scoped ESLint for both application files and both new tests passed. `npx tsc --noEmit --incremental false` passed. Scoped diff whitespace check passed.
- Real application CSS recovery screenshots were inspected at desktop/mobile. The original screenshot is failure evidence, not an approved normal-layout baseline. The earlier full-flow receipt dated 27 October was identified as historical; it is **not** counted as a fresh pass. Initial new-harness failures (hidden background heading, missing relative auth alias) were corrected in the harness rather than weakening product checks.

Artifacts: `.tmp/workflow-open-audit-2026-11-03/` contains live navigation comparisons, route trace, production-component mount, hosted retry contract, commands/results and scope. `.tmp/hook-starting-frame-opening/` contains final `results.json`, before-page-crash.png and recreation/workspace desktop/mobile `*-recoverable.png` / `*-opened.png` screenshots. These ignored local artifacts are review evidence, not release assets.

## Protected behavior and remaining work

| Contract | Result |
|---|---|
| Existing frame/identity/source scope and handoff | VERIFIED in unchanged source and existing client/navigation/state suites |
| Existing draft preservation on opening failure/retry/cancel | VERIFIED in browser and state suites |
| No automatic generation, upload or scheduling writes while opening | VERIFIED in opening regression (zero writes) |
| Normal dialog/loading shell, source component, prompt/model and controls | VERIFIED by scoped diff; no normal-state redesign |
| Desktop/mobile failure recovery and reopened screen | VERIFIED locally with actual CSS |
| Existing gallery hover/reduced-motion policy and destinations | VERIFIED by existing regression suites; playback hook unchanged |
| Hosted signed-in Hook → Recreate → source-ready → owned photo → approval | NOT VERIFIED; available sessions redirect to sign-in |
| Exact exception from the user's original live Recreate session | NOT VERIFIED; incident remains OPEN |
| Hosted repaired release, real generation quality/credits and publishing | NOT TESTED; no deployment or paid operation |

An authenticated failing-click console/network trace is still required to close the original Recreate incident. The local recovery fixes and optimized cover delivery must be released and checked on the hosted site before claiming the live workflow fixed. Broader concurrent worktree validation/release is outside this targeted task.


## 3 November continuation — user clarifies local failure

The user clarified that the reported changes/failure were local, so the prior assumption of an authenticated live incident is superseded. Full actual Next development route was checked using its loopback-only non-spending preview, not just a component fixture. Initial page took36.3s, ofwhich32.6swasNextcompilation; initialsourceendpoint17.0s, ofwhich15.5swascompilation. WarmRecreatetoimage1089ms. These developmentcompilecostsare not productionnavigationtimings.

This actual check found a further concrete provenance defect: app/e2e/hook-keyframe-preview/source/route.ts used getHookSourceFrame (legacy curated resolver) but hardcoded originalindex0/time0headers. Hook100returnedknownindex70/time2.333333PNGdf452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c. It now uses existing getHookOpeningSourceFrame, rejects nonzeroindex/time, and emits actual metadata. Correct originalframehashis9eb3c117dbf181a870d89fb3c4b3f4495e10cfe435aa035140e079d4e1218f26 at720x1280. Oldcuratedresolver/jobs/productiongeneration areunchanged. Developmentendpoint remains404inproduction/nonloopback. Added regression rejects a later frame rather than relabelingit.

Four actualHookreferences wereopened; eachframePNGhashmatchedits0/0receipt. Desktop1440andmobile390have nooverflow/pageexceptions. Source503faultrecoveredthroughTryagain; photochooseropen/Done andsourceenlarge/Escape retainedselection;0APIwrites. No imageinference/payment/publication.118targetedtests+20source/APItests+4chunkrecoverybrowsercasesPASS;scopedlintPASS. Screenshotandrequestevidenceunder.tmp/hook-opening-deploy-2026-11-03/. Previous29October/27Octoberreceiptsremainhistorical. The local originalopeningdata issue is now independently verified; a completely separate real signed-in provider output is outside this preview acceptance.

Additional release paths: app/e2e/hook-keyframe-preview/source/route.ts; scripts/hook-local-starting-frame-preview.test.mjs; scripts/explore-cover-budget.test.mjs; scripts/explore-playback.browser.mjs. The lasttwo are cover-verification work from the same optimization and are included alongside the optimized files. Deployment status is recorded separately after hosted validation.
