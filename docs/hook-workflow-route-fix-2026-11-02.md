# Hook workflow route correction — local verification

## Cause and implementation

Production signed-out browsing reproduced the user's screenshot: `/explore/hook-video` displayed the 104-clip download offer. `WorkspaceRouteBoundary` explicitly substituted `HookVideoBundle` after authentication initialized without a user. This was an older intentional anonymous-offer decision recorded on26October, rather than a missing Hook workflow page or a rewrite.

Removed only that substitution and its unused imports. Hook now uses the existing `AuthGuard` and `AppShell` with the unchanged profile access requirement. Signed-out users enter the existing sign-in flow; signed-in users retain the workflow. The separate public `/hook-video-bundle` remains available. No styling, workflow state, API, provider, billing, download counter, configuration or deployment changes.

## Files changed for this correction

- `components/layout/workspace-route-boundary.tsx`: remove anonymous offer override.
- `scripts/hook-video-bundle-access.test.mjs`: enforce guarded Hook exact/trailing routes, dedicated public offer, public Explore landing and protected sibling routes. Unexpected boundary dependencies fail the fixture.
- `EXPLORE_CONTEXT.md`: record current user correction superseding anonymous offer at the workflow URL.
- `docs/ai-context/clear.md`: append UGC-UI-114 observation, verified cause and local results.
- This receipt.

Rollback boundary is these scoped edits, retaining all other uncommitted work. No commit, push or deploy occurred.

## Preflight sources applied

Repository AGENTS instructions, Explore source of truth including26October bundle decision, relevant incident history and protected contracts, plus ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate. Read installed Next.js layouts/pages documentation before editing. Python repository preflight passed. Context history is extensive; this receipt does not assert a fresh full reread of all historical entries. Existing worktree changes and targeted diffs were inspected and preserved.

## Evidence

- Live production browser: exact reported URL and offer reproduced, title remained Hook video. No download button clicked or slot consumed.
- Local actual app: signed-out `/explore/hook-video` reached `/sign-in`. Initial navigation timed out during compilation; subsequent browser snapshot confirmed the redirect.
- Local development-only `?preview=1`: actual Hook workspace rendered, with Create/Demo/Schedule and References/Your videos controls. Desktop and390px screenshots captured and visually inspected. Preview bypass is not a signed-in production test; generation is disabled there.
- Local `/hook-video-bundle`: dedicated public offer rendered. Its real local counter request logged an error; successful counter fetching/download delivery is not claimed or required to establish this route correction.
- Tests: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --test scripts/hook-video-bundle-access.test.mjs lib/auth/account-isolation-contract.test.ts` —12passed.
- Tests: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/resources/hook-video-bundle.test.ts lib/resources/hook-video-bundle-store.test.mjs` —16passed. An initial invocation omitted the module-mocks flag and failed the store harness; corrected invocation passes. Tests use isolated storage, not the live download counter.
- `npx eslint components/layout/workspace-route-boundary.tsx scripts/hook-video-bundle-access.test.mjs` —passed.
- `npx tsc --noEmit --incremental false` —passed.
- Scoped `git diff --check` —passed, line-ending advisories only.

Artifacts under `.tmp/hook-route-fix/`: `production-before.png`, `local-signed-out-after.png`, `local-workflow-desktop.png`, `local-workflow-mobile.png`, `tests.log`, `bundle-tests-final.log`.

## Protected behavior and limits

| Contract | Status |
| --- | --- |
| Hook no longer substitutes a download offer locally | VERIFIED |
| Existing sign-in guard is used; access matrix unchanged | VERIFIED locally |
| Hook workflow visible in development preview, dark palette/layout unchanged | VERIFIED locally |
| Dedicated library remains public | VERIFIED route/render; real counter/download NOT VERIFIED |
| Loading/email/profile guard implementation | Unchanged; account contract tests pass; full state matrix NOT TESTED in browser |
| Real signed-in workflow, saved data and generation | NOT TESTED |
| Hosted fix acceptance | NOT VERIFIED; not deployed |

UGC-UI-114 has local verification evidence. Previously recorded unrelated broad-suite failures remain outside this patch; no full-release acceptance is claimed.
