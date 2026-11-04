# Explore workflow loading — local verification, 4 November 2026

Status: PARTIALLY VERIFIED. No build, development server, push or deployment.

The user reported fast URL navigation followed by slow workflow sections and slideshow references. The code establishes a sequential dependency: the profile guard prevents FormatWorkspace mounting, its reference query starts after that mount, and the dynamic composer starts after portal targets exist. Public Explore does not require that profile query. Existing Vercel log records inspected have no duration field; they do not establish how much of the user's delay each step caused. Private creator galleries separately waited for all slides of all items in an account before publishing its data.

## Scope and preserved contracts

Start existing profile and public-reference reads and the appropriate dynamic composer import concurrently on workflow-link hover, keyboard focus or pointer down. Direct visits also start preparation outside the unchanged AuthGuard. Reads use the same owner-scoped query keys and stale times as mounted consumers, preserving cache reuse and in-flight request sharing. Preloading is limited to verified signed-in users, the three matching workflow routes, and non-preview operation; failures stay recoverable and do not trigger a speculative retry loop. No automatic data prefetch on the idle Explore catalog.

Extract the existing reference reader to a small client module so preloading does not import the complete gallery UI. Preserve its endpoint, result shape, archived references and deadline; bind token retrieval to the expected owner and check abort after token resolution. Keep its previous component export compatible with existing consumers.

Publish private slideshow accounts after each batch of three fully hydrated items. Every published item's slides are complete; subsequent items continue loading. Retain canonical entries for references still pending so saved selections do not disappear. Preserve bearer-authenticated media, generation URLs, owner/lifetime checks, error handling and object-URL cleanup. Hook galleries retain their full-account publication behavior.

No CSS, classes, visible controls, palette, route access matrix, API contracts, worker, generation prompts or scheduling implementation changed. Rollback boundary is only the files/edits listed below; preserve concurrent unrelated changes.

## Files changed for this task

- components/explore/explore-workflow-card.tsx
- components/explore/format-workspace.tsx
- components/explore/recreate-workspace.tsx
- components/explore/use-creator-accounts.ts
- components/explore/use-explore-workflow-preload.ts (new)
- components/layout/workspace-route-boundary.tsx
- lib/explore/reference-catalog-client.ts (new)
- lib/explore/workflow-preload.ts (new)
- scripts/workflow-preload.test.mjs (new)
- scripts/creator-preview-loading.test.mjs
- scripts/explore-navigation-ui.test.mjs (presentation fixture dependency updated)
- EXPLORE_CONTEXT.md (append only for this task)
- docs/ai-context/clear.md (append only for this task)
- this receipt

## Preflight and evidence

Ran `python tools/preflight.py --repo . --task "Reduce Explore to Slideshow loading waterfall without UI/auth changes; no build or deployment"`: prerequisites readable. Read mandatory context-memory, immutable-contracts, UI-clarity and regression-gate skills; protected nonnegotiables, root instructions and relevant Explore/incident ledger entries. The large historical ledgers were inspected by relevant sections/searches in this continuation; full historical review was not repeated. Read installed Next.js prefetching and lazy-loading guides. Inspected current auth/profile gate, route boundary, query provider, gallery consumers, creator media hydration and focused tests. Existing unrelated Hook motion, Talking Head sources and view-registry work was left intact.

Incident UGC-UI-20261104-WORKFLOW-LOAD remains OPEN for browser/production acceptance; code-supported contributors are distinguished from unmeasured user-session causality.

Tests execute actual preload/profile/catalog source with controlled transport and the real QueryClient. They establish concurrent start before the profile response, in-flight sharing and fresh-cache reuse at mounting, authenticated/no-store requests, failed preload recovery, incomplete onboarding preservation, account isolation, exclusions and cancellation before late token resolution. Private-media hook tests establish first-batch publication while later items are blocked, canonical recovery, completed-slide URLs, no duplicate items, owner authorization, unmount fencing and object-URL revocation. These are controlled local tests, not hosted integration proof.

Combined non-build regression command:

```
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-format-source-workspace.test.mjs scripts/explore-recreate-source-action.test.mjs scripts/workflow-preload.test.mjs scripts/explore-navigation-ui.test.mjs scripts/creator-preview-loading.test.mjs lib/auth/account-isolation-contract.test.ts scripts/idle-navigation-reads.test.mjs lib/http/read-deadline.test.ts
```

Result: 158 tests PASS, 0 fail. Full output: `.tmp/workflow-load-regression-20261104.txt`. The initial run exposed presentation fixtures that did not know the newly extracted dependency; the compatible gallery export was retained and the card fixture now supplies the new preload hook. The final combined run passes without suppressing behavioral assertions.

Scoped ESLint on all changed source/test files: PASS, no warnings/errors. Scoped `git diff --check`: PASS. The first full `node node_modules/typescript/bin/tsc --noEmit --incremental false` completed with exit0. During verification, concurrently edited Hook/Slideshow view registries changed. The final full type check exits1 with two TS2352 errors: `lib/explore/hook-reference-views.ts:32` expects galleryIndex/caption absent in current JSON, and `lib/explore/slideshow-reference-views.ts:35` expects galleryIndex/platform/sourceKind/coverText absent in current JSON. No diagnostic names a loading-patch file. These concurrent files were left untouched; the full current worktree type gate is FAILED until their owners resolve the mismatches. Do not report a clean final worktree type check.

## Acceptance limits

- VERIFIED locally: parallel reads, cache reuse, account-bound tokens, auth/onboarding guard contracts, retry/cancellation behavior, progressive complete-item publication, canonical saved-reference availability, private blob lifetime, existing workflow navigation/source tests.
- VERIFIED by diff: no styling/layout markup changes other than existing-link event handlers; no generation/provider/schedule implementation changes.
- NOT TESTED: fresh desktop/mobile before/after screenshots and click-to-interactive times. Native browser showed the user actively preparing a starting frame; its navigation/draft was left undisturbed. No successful network timing capture was obtained.
- NOT VERIFIED: actual bundle graph/compiled dynamic import behavior and user-observed speed gain; no builds authorized. Direct cold route JavaScript, billing/access reads, network conditions and provider latency may still contribute. Private galleries still fetch later slides in the background; this patch reduces their publication barrier, not total private bytes.
- NOT TESTED: real paid generation, real publishing or production acceptance of this patch. No such calls were needed or made.

Do not label the overall reported slowness fixed or deploy this patch until remaining acceptance is completed under explicit authorization.

## Follow-up registry verification and interrupted local timing
Current shared worktree already contained corrections to both full-entry types. Preserved them; no JSON values modified. Added scripts/reference-view-registry-contract.test.mjs,4tests for exact full records/runtime fields/lookup agreement/missingIDs. Full nonincremental TypeScript now exit0; scoped registry/test lint PASS.13registry tests and57combined registry/loading/auth tests PASS. Prior type-failure report above remains historical. Incident UGC-TYPE-20261104-VIEW-REGISTRIES locally verified.
User explicitly authorized local development compilation only. Started authorized Next dev webpack server, no production build or deploy. First sandbox listener was inaccessible externally; restarted outside sandbox for browser access. Isolated actual Chrome measured Explore first response39.888s while compiler active, then warm reload442ms (TTFB254ms, heading392ms),HTTP200, backgroundrgb(18,18,18), no horizontal overflow at1440x1000. These are cold/warm local observations, not proof of patch improvement. Slideshow compilation/measurement was in progress when native Computer Use reported user physical Escape; stopped UI work and owned probe/server. Slideshow signed-in performance, mobile comparisons and patch before/after remainNOTVERIFIED. Raw log .tmp/workflow-local-loading-probe.log; screenshots .tmp/workflow-local-loading-20261104/.
Follow-up files changed: scripts/reference-view-registry-contract.test.mjs(new), this receipt, append-only docs/ai-context/clear.md. Existing registry type corrections were present before this turn, not authored by this agent. Palette/layout and generation/scheduling code unchanged.
