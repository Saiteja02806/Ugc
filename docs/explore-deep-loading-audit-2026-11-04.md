# Explore and Slideshow loading audit — 4 November 2026

Status: PARTIALLY VERIFIED. The reported production issue remains OPEN. This is an audit, not a new application repair or a deployment approval.

The earlier verification mistake was testing signed-out Explore and controlled/preview paths without completing the actual signed-in Slideshow measurement. Those checks cannot establish the user's production root cause or prove that the local preload changes solved it. Recorded under UGC-UI-20261104-WORKFLOW-LOAD-RECURRING-ACCEPTANCE, linked to UGC-UI-20261104-WORKFLOW-LOAD.

## Measured local behavior

Actual Chrome against the locally compiled application, 1440×1000 and 390×844. Public Explore was signed out. Slideshow used the existing development-only `?preview=1` fixture with real source media and real application components. It bypasses authenticated data reads and billing; it is explicitly NOT signed-in acceptance.

| Scenario | HTML first byte | Controls/gallery visible | Ready checkpoint |
| --- | ---: | ---: | ---: |
| Slideshow preview desktop, repeat 1 | 193 ms | sections/gallery 2,196 ms; composer 2,506 ms | 2,856 ms |
| Slideshow preview desktop, repeat 2 | 288 ms | sections/gallery 3,332 ms; composer 4,086 ms | 4,414 ms |
| Slideshow preview mobile, Controls pane | 213 ms | sections 1,936 ms; composer 2,250 ms | 2,734 ms |
| Explore desktop, normal motion | 146 ms | — | cover-card checkpoint 694 ms |
| Explore mobile | 269 ms | — | cover-card checkpoint 435 ms |

The ready checkpoint includes Playwright polling overhead. MutationObserver marks record first visible elements after navigation. These runs are not a statistically reliable benchmark or a pre-patch/post-patch comparison. No claim of production speedup follows from them.

A separate cached preview reload using the browser tool reached the image composer in 2,867 ms, and all 12 reference images were already decoded at that checkpoint (2,900 ms after the final image inspection). Three dark image areas in an earlier immediate screenshot were transient; the later decoded-image check did not find broken images. Cache/network conditions differ between samples.

All five visible Explore cover videos were playing after two seconds in the normal-motion probe. Desktop and mobile showed no document-level horizontal overflow. Body background stayed `rgb(18,18,18)`. Mobile Controls→Preview displayed the reference gallery; returning to Controls and scrolling exposed the existing disabled blue Generate button inside the viewport: x36.8,y759,width312.8,height44, background `rgb(0,120,212)`. Disabled is expected for preview. No generation was submitted.

### Development compilation is a separate, observed problem

Earlier Slideshow requests took 291,820 ms and 153,219 ms during compilation/recompilation. These are not warm application load measurements. The actual Next development trace contains:

- `compile-path /explore/slideshows/page`: 258,091.985 ms and 145,036.792 ms.
- client webpack compilation: 130,731.384 ms and 138,640.218 ms.
- an invalidation tagged `EXPLORE_CONTEXT.md`: 120,640.678 ms, and a separate server invalidation tagged `lib/explore/hook-starting-frame-client.ts`.

The shared worktree was changing during compilation. The trace proves rebuilds occurred; it does not establish OneDrive, CPU pressure, a particular edited function, or production execution as their sole cause. Later repeat navigations with compilation complete were much faster as shown above. Do not mix these development numbers with production acceptance. Do not edit watched context/source files while collecting a supposed warm baseline.

## Findings and boundaries

### 1. Whole-page profile gate blocks workflow sections — CODE CONFIRMED

`components/auth/auth-guard.tsx:85` returns its full-page loading state while profileGateQuery is pending. AppShell/workflow children only render after that check. The public `/explore` route does not require this profile query; its child workflows do. Therefore a fast URL change followed by late Create/Edit/Schedule sections is structurally compatible with a slow profile read or client JavaScript readiness. The reference catalog alone cannot delay these static section tabs once FormatWorkspace has mounted.

The profile request calls Firebase verification and `getBusinessProfileForUser`, which selects the full business profile before converting it to the onboarding view. The caller only needs onboardingComplete. Local preloading overlaps this check with the catalog and composer, but cannot remove the profile check's own latency. User-session request timings remain NOT VERIFIED. Preserve the authentication, verification and onboarding decisions; never bypass this guard to improve a benchmark. A narrow status read is a possible follow-up, requiring explicit endpoint/contract tests.

### 2. Heavy workflow code still arrives before the useful controls — CODE + LOCAL MEASUREMENT

`components/explore/format-workspace.tsx:59` dynamically imports the complete image workspace. At line653 it renders that panel only after portal targets exist and selection recovery is ready. The local preload change starts the import sooner, but does not make this code smaller or eliminate hydration/execution. In preview, HTML arrived in 193–288 ms while useful controls appeared in 2.2–4.1 seconds; authenticated APIs were absent in that sample. This demonstrates additional local client work rather than proving which module dominates production.

Read-only analysis of the existing production artifact from the earlier release (NOT a new build, NOT the current patch) found 1,363,144 raw bytes /398,410 summed gzip bytes across FormatWorkspace's manifest-listed chunks, versus 205,948 /64,470 for ExploreWorkspace's listed chunks. Shared chunks overlap; these are neither incremental transfer totals nor a full route budget. The image-composer dynamic import adds its own chunk list. The current dev bundles also contain large development/source-map payloads and must not be presented as production sizes.

Safe follow-up: profile a stable compiled local run and split only proven heavy dependencies by use; retain existing editor mounts/draft lifetimes. Do not unmount inactive editors or erase drafts to make initial load look faster.

### 3. Private slideshow gallery downloads full slides — QUANTIFIED

`components/explore/use-creator-accounts.ts` still downloads every slide for each item before that item is publishable, and keeps downloading all later items. The local progressive change now publishes every three completed items.

Read-only local pilot-catalog metadata contains 10 slideshows,39 slides,14,953,221 bytes. Its first three items require10 slide downloads and3,854,354 bytes before publication. These are exact catalog byte counts, not measured network-transfer times or proof of the currently hosted catalog. Every private-media request passes verified-user/pilot access checks and uses `private,no-store`; reopening remounted galleries can repeat those downloads. The loader's lifetime/revocation behavior is intentional security protection, not permission to cache private bytes globally.

This remains a concrete workload even with batch publication. A cover-first, authenticated, owner-scoped preview path would reduce the initial work; remaining slides must hydrate on demand without breaking full preview, saved selection or canonical generation URLs. That architectural change is NOT implemented by this audit.

### 4. Later private-slide failure hides already ready gallery — REPRODUCED DEFECT

Executed the actual `useCreatorAccounts` hook source with controlled transport (not a live provider) and real async/lifetime behavior:

1. First three slideshows complete: account.items.length3,loadingfalse,errornull; six preview blobs ready.
2. Later items return503: account still holds3 complete items, but error becomes `Creator references could not be loaded. Try again.`; six canonical references remain.
3. `components/explore/format-workspace.tsx:640` prioritizes creatorAccounts.error before visible.length. Thus the UI replaces those usable loaded cards with the error branch.

The existing8 private-preview tests pass because they did not cover a later failure after partial publication. This demonstrates an untested defect in the local progressive path; do not mark the local preload/gallery patch fully accepted. A future fix must preserve completed cards, retain existing retry affordance, retry only missing work where practical, and prove owner/logout cleanup and no duplicate cards. No UI/layout change was silently made here.

### 5. Signed-in entry runs unrelated and potentially expensive account reads — CODE CONFIRMED

- ImageGenerationStudioPanel immediately fetches generated-image history (`components/workspace/ugc-chat-workspace.tsx:451`). `/api/media` calls `listMediaAssets`, which uses `select("*")` with no explicit pagination limit (`lib/media/media-storage.ts:208`), then loads associated background jobs. Database service row limits may still apply; do not claim it necessarily returns the complete history. This read isn't required to show the public reference grid, but competes for resources. No actual account history size/latency was measured.
- `useRecoverableWorkflowJobs` always discovers active account jobs for the format on entry, even when the browser has no saved job ID. Its `recovering` state blocks Generate until that read finishes. This prevents duplicate generations and must be retained. The default read deadline is20seconds with existing retry behavior; a slow recovery can therefore feel like a stalled button. No duplicate-submission protection was removed.
- Billing subscription and AI Studio access use separate client queries/endpoints. Both call `getUserSubscription(...,{strict:true})`, each performing a credit-refresh RPC followed by multiple entitlement/account/trial reads, plus possible free-credit initialization. Same-token Firebase lookup coalescing does NOT coalesce these subscription operations. AppSidebar may already have a fresh billing query; duplicate work depends on cache and navigation. This is verified call structure, not a measured production bottleneck. Consolidation requires preserving authoritative entitlements, credit initialization, activation freshness and fail-closed behavior.
- Full Slideshow browsing depends on subscription.data.isActive at `format-workspace.tsx:279`; until it arrives the initial public gallery is limited to one card. Thus the catalog can already be present while the rest of the visible cards appear later. No gate/palette/layout was altered.

### 6. Navigation feedback finishes at the URL, not readiness — CODE CONFIRMED

`components/layout/workspace-navigation-feedback.tsx:31` clears the pending indicator when pathname/search differs from the origin. It does not wait for profile verification, composer mount or gallery bytes. This can make a completed route transition look like a broken/empty workflow after feedback disappears. It is a progress-semantics issue, not proof of server slowness. A follow-up should bind an existing status surface to explicit readiness without duplicate loaders or cosmetic fake success.

## Asset/catalog checks that did not reproduce a failure

- Current public catalog:266 items +35 archived hooks;465,206 JSON bytes /94,724 gzip bytes. Slideshow-only:63 items,345 slides,91,873 bytes /18,474 gzip bytes. Current request fetches all formats, then filters client-side. This is overfetch, but95KB compressed alone does not explain an arbitrary long stall. One local static assembly measured76.51ms; it excludes auth, import cold start, transfer and render.
- Twelve sampled existing public Slideshow poster HEADs:12/12 HTTP200; slowest647ms; summed Content-Length2,455,306 bytes; immutable public caching. HEAD does not measure full-body download/decode or the entire catalog.
- Five local Explore cover MP4 files total3,891,228 bytes. All5 advanced in the live local motion check. No video or poster bytes were changed.

## Tests and artifacts

127 existing focused preload/private-preview/navigation/workflow/auth/deadline tests PASS,0fail. These are source/harness regressions, not the missing authenticated production trace. Command:

```
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/workflow-preload.test.mjs scripts/creator-preview-loading.test.mjs scripts/explore-navigation-ui.test.mjs scripts/explore-format-source-workspace.test.mjs lib/auth/account-isolation-contract.test.ts scripts/idle-navigation-reads.test.mjs
```

Raw regression output `.tmp/explore-deep-audit-regression-20261104.txt`.

Diagnostic scripts/results (local temporary artifacts; do not include in a release):

- `.tmp/explore-local-runtime-audit.cjs`; initial log `.tmp/explore-local-runtime-audit.log`; repeat log `.tmp/explore-local-runtime-repeat.log`.
- `.tmp/explore-local-runtime-audit-20261104/results.json` and desktop/mobile PNGs. First run exposed a test-script API error (`context.setViewportSize`); corrected to `page.setViewportSize` and reran successfully. No application fix was hidden in that harness correction.
- `.tmp/private-slideshow-failure-diagnostic.mjs` and `.json`: actual-hook partial-success/late503 fault reproduction.
- `.tmp/private-slideshow-size-audit.mjs` and `.json`: local metadata counts only; not browser-auth proof.
- `.tmp/explore-deep-audit-static.mjs` and `.json`; `.tmp/explore-poster-audit.mjs` and `.json`.
- `.tmp/explore-built-bundle-audit.json`: earlier production artifacts explicitly labeled historical.
- `.tmp/explore-local-compile-evidence.json`: selected actual development trace spans.

Screenshots inspected: slideshow-preview-repeat-2.png,slideshow-preview-mobile.png,explore-normal-motion.png. Additional mobile gallery and footer captures: slideshow-mobile-gallery.png,slideshow-mobile-controls-footer.png. No approved before/after pixel baseline exists for this audit, so unchanged source/palette and visual sanity are verified, not a pixel-identical regression claim.

## Signed-in and sidebar acceptance blocker

Existing signed-in Chrome was discovered, but window inspection repeatedly reported minimized; a supported activation attempt returned no screenshot/accessibility content. Default Playwright local browser is signed out (Sign up visible). No credential, token, cookie or private session was copied to manufacture a local account.

At the user's request, checked the sidebar browser: both browser inventory and direct IAB tab access return `Local browser use is disabled in Work settings`. `open_in_codex` requested the actual normal local `/explore/slideshows` route and returned `queued` for this chat. This confirms neither that the panel was displayed nor that its session is signed in. The earlier separate local sign-in probe aborted before obtaining any authenticated API reads. None of these is an authenticated performance sample.

Real signed-in click-to-controls, profile200,catalog200,billing/access/job/history timings, private-gallery browser behavior and production root cause remain NOT VERIFIED. Do not replace these with preview numbers. No timing attribution to a particular external service is established.

## Scope and next repair order

No application-code edits, palette/layout changes, provider calls, paid generation, publication, production build, push or deployment in this audit. Only this report and append-only context/incident documentation are intentional repository changes; diagnostic scripts/results live under ignored `.tmp`. Existing concurrent user/other-chat work remains intact. Local development compilation was explicitly authorized earlier; the local server remains available for the requested sidebar check.

Recommended sequence before any release:

1. Repair the reproduced partial-gallery failure without discarding complete items; add the late-failure regression first.
2. Obtain a stable real signed-in local trace with named readiness checkpoints and no concurrent watched-file edits; compare the same account/reference/access state before and after one change at a time.
3. Use those timings to choose between lightweight profile-gate data, shared entitlement reads, history pagination/deferment and private cover-first hydration. Preserve auth/onboarding, credit and duplicate-generation protections.
4. Verify actual desktop/mobile readiness and error/retry states, then separately perform production acceptance only after an explicitly approved deployment.

Preflight sources actually inspected: supplied root AGENTS rules; relevant current EXPLORE_CONTEXT.md and append-only clear.md entries; protected nonnegotiables from the preceding continuation; context-memory, immutable-contracts, UI-clarity and regression-gate skills; installed Next lazy-loading/prefetch guides; current callers,auth/query providers,API/data loaders,compiled artifacts and tests. The complete large historical ledgers were not reread in this audit. This limitation is not a claim of missing files or a waiver of protected contracts. No application-code edit was made.
