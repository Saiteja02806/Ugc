# Trending spacing production release — 8 October 2026

The owner's requested spacing fix is live at https://getugcpilot.com/dashboard.
Skip and Schedule stay below the card with about 12px of separation. The
approved smaller card sizing remains intact.

## Deployment

- Project: `ugcpilot/ugc` (`prj_mVOxt7AUko5egMAESaxjGyC60Kvu`).
- Target/status: production, READY; promotion succeeded.
- Deployment: `dpl_9vnrJiJYmruBizdZeCTzkoEUDQeF`.
- Deployment URL: https://ugc-evtp11t78-ugcpilot.vercel.app.
- Source commit: `591da964e3afb32a40b19a638a9f85fe2912d5da`.
- Production base: `0a8bc1beecea03b811940e0b371d988b504a6c5a`.
- Framework/runtime: Next.js 16.3.8, Node.js 24.x.
- Provider build interval: 133 seconds.

The live domain was checked before and after promotion: it moved from the
production base deployment to this exact release. The production base already
contained the smaller cards and scroll-back fix. This release adds only the
missing close spacing and its development fixture/documentation; it requires
no worker, database, environment or MCP service change.

## Validation

- Isolated source: 66 Trending interaction tests passed; scoped ESLint passed;
  TypeScript passed after `next typegen` generated the required Next types.
- Remote build: compile, TypeScript and generation of 151 static pages passed.
- Existing local matrix: 39 Reaction/Slideshow/Wall checks and 13 Hook checks
  passed, preserving the approved card sizes within 0.1px.
- Fresh local visual checks: 1366 × 680 measured 12.20px; 1536 × 776 measured
  12.19px. Cards and captions fit without document scrolling and button hit
  testing passed. The local presentation files match the release byte-for-byte.
- Live HTTP: dashboard and connection page returned 200. All 24 dashboard
  assets returned 200; the live CSS and JavaScript contain the spacing rule
  and ResizeObserver implementation.
- Immediate deployment error scan: no matching errors in the bounded scan.

The verification browser was signed out. The owner explicitly requested local
visual checking because sign-in was not possible there. Authenticated
production card geometry and saving/scheduling were therefore not verified.

## Scope and repository status

The main checkout's complete 1,134-path status audit is preserved at
`.tmp/trending-workspace-status-20261008.txt`. Unrelated source work remains
intact and is outside this specific Trending deployment request. The isolated
release contains five files: TrendingWorkspace, its review CSS, the
development-only preview, CAROUSEL_CONTEXT.md and the scoped release note.
The Vercel upload audit includes all five and excludes credentials, local
environment files, caches, build output and temporary evidence.

The source is committed in the separate local branch
`codex/trending-controls-gap-20261008`. It has not yet been pushed to main.
Automatic approval review rejected the direct main push because deployment
authorization did not explicitly establish default-branch push authorization.
Explicit approval was requested. Production deployment succeeded independently;
a later release from an older main commit could replace this fix until the
commit is incorporated into main.

Evidence: `.tmp/trending-live-alias-final-20261008.json`,
`.tmp/trending-staged-provider-20261008.json`,
`.tmp/trending-live-asset-verification-20261008.json`,
`.tmp/trending-production-error-scan-20261008.ndjson`,
`.tmp/trending-release-upload-plan-20261008.json` and the laptop report.
