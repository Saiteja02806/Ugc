# Analytics automatic freshness — 29 October 2026

Status: locally verified behavior; production acceptance OPEN. No deployment,
live provider synchronization, production database mutation or publishing.

## Scope and findings

User reports repeatedly needing a manual refresh to see recent Analytics data.
The active `/analytics` route mounts `InstagramAnalyticsWorkspace`; the older
`analytics-dashboard.tsx` is dormant. This patch covers the active Instagram
account, metric, content and activity readers and the shared TikTok/YouTube
resource hook.

Two code-confirmed gaps explain ways the display can stay stale:

1. The 24 October implementation deliberately revalidated on return events only.
   A visible screen never reread saved metrics/activity as time passed. Existing
   baseline browser checks explicitly asserted no reads during two minutes of
   visible idling. Connection rows also used a thirty-minute browser freshness
   window.
2. A successful refresh POST can return without a job when fresh data was saved
   concurrently or the server applies its manual cooldown. The hook only
   invalidated its authoritative GET on completed jobs and preferred the previous
   GET over POST data. It could therefore retain older values and leave a manual
   event unconsumed until some later read.

These are repository/fixture findings. The precise cause and timings of the
user's production visit remain UNKNOWN: the production browser redirected from
`https://www.getugcpilot.com/analytics` to `/sign-in`.

## Minimal change contract

- Opt selected Analytics saved-data readers into a stale check every sixty
  seconds while mounted, visible and online. Use the existing stale/error/attempt
  cooldown and join in-flight requests with `cancelRefetch: false`.
- Include connection rows and Instagram publishing activity. Disabled platforms
  have no periodic metric reads. Unmount releases timers/listeners.
- Reconcile a successful refresh without a job through the authoritative GET,
  using the same ordered manual-event consumption as completed jobs.
- Preserve current controls, JSX, CSS, filters, charts, selected account/range,
  warnings, saved-data retention and request deadlines. No dependency, schema,
  config, queue, auth or worker implementation changes.
- Preserve provider synchronization admission: fifteen minutes for Instagram
  account/feed/recent-post metrics; five minutes for TikTok/YouTube; existing
  older-post and thumbnail policies. A saved-data check is not a forced provider
  fetch. Failed refresh dispatch remains subject to existing retry/admission
  behavior. This patch does not promise immediate social-provider metric updates.
- Rollback boundary: the five application/test files below, this receipt and
  documentation follow-up. Retain append-only incident history and all unrelated
  concurrent work. Nothing was committed or staged by this task.

## Files changed by this task

1. `lib/analytics/use-analytics-wake.ts` — opt-in periodic saved-data checks.
2. `lib/analytics/use-analytics-resource.ts` — enable snapshot checks; reconcile
   successful no-job refresh responses.
3. `components/analytics/instagram-analytics-workspace.tsx` — connection/activity
   freshness checks; connection browser freshness reduced to one minute.
4. `lib/analytics/use-analytics-wake.test.mjs` — timer, cooldown, visibility,
   offline, cleanup and inactive-resource coverage.
5. `scripts/analytics-loading.browser.cjs` — actual-workspace browser scenarios.
6. `docs/analytics-return-refresh-2026-10-24.md` — mark prior event-only policy
   superseded by this follow-up.
7. `docs/ai-context/clear.md` — append UGC-UI-052-ANALYTICS and evidence.
8. This receipt.

## Preflight and source review

Ran `python tools/preflight.py --repo . --task "Fix analytics screen stale recent
data requiring manual refresh"`: PASS, required sources readable. Inspected full
Git status, scoped diffs and recent analytics history; analytics files were clean
at entry. The worktree contains substantial unrelated concurrent work, preserved.

Read the four applicable skill files: `ugc-context-memory`,
`ugc-immutable-contracts`, `ugc-ui-clarity`, `ugc-regression-gate` (the gate was
reread after code changes). Read `docs/ai-context/nonnegotiables.md`, root
`AGENTS.md`, Explore recurring-failure/loading sections, ledger safeguards and
related incident entries, plus the 20/22/24 October analytics reports. The large
combined context/ledger read was truncated by tool output; exhaustive historical
review is NOT VERIFIED. No full-history completion claim is made.

Reviewed installed Next.js TanStack Query/data-fetching guidance before editing;
traced the active page, hooks, all hook callers, authenticated no-store transport,
snapshot service/store/route, sync admission, job dispatch and worker checkpoint
path. Relevant protections: UGC-UI-003 (scoped UI fixes), UGC-UI-005 (stale async
results), UGC-OPS-003 (local tests are not hosted acceptance). Prior ledger
historical backfill exists; no unrelated historical incidents imported here.

## Verification

- Existing browser baseline: PASS before edits, including the old assertion that
  visible idling never fetched snapshots. Evidence copied to
  `.tmp/analytics-freshness-before/`.
- `node --import ./scripts/next-server-only-test-loader.mjs
  --experimental-test-module-mocks --experimental-transform-types
  --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test
  lib/analytics/*.test.mjs lib/analytics/*.test.ts`: **105/105 PASS**.
  Log: `.tmp/analytics-freshness-all.log`.
- `npm run test:analytics-loading` with process-local
  `NODE_OPTIONS=--import ./scripts/next-server-only-test-loader.mjs`:
  **188/188 PASS** (57 analytics + 35 posttest + 93 API/database/auth/social +
  3 worker checks), including worker TypeScript compilation. Log:
  `.tmp/analytics-freshness-tests-loader.log`. This overlaps the 105-test run;
  these are not 293 unique tests.
- The unmodified package command first failed resolving the existing extensionless
  `./freshness-policy` import under direct Node execution. Used the existing
  loader for validation; did not alter package scripts, imports or build config.
  Initial failure: `.tmp/analytics-freshness-tests.log`.
- `npx tsc --noEmit`: PASS. Log `.tmp/analytics-freshness-types.log`.
- Scoped ESLint and scoped `git diff --check`: PASS. No lint diagnostics.
- `node scripts/analytics-loading.browser.cjs`: PASS in headless Edge after
  sandboxed Edge startup failed. Actual components/hooks run against controlled
  local HTTP/auth boundaries. It verifies: automatic metric/account/activity
  rereads without clicks, selected TikTok/YouTube rereads, no unselected metric
  polling, no forced sync for fresh data, stale content retained, hidden/offline
  pause, window-return deduplication, no-job refresh reconciliation/manual-event
  consumption, date/owner/consent isolation, cancellation, active-job polling,
  completion update, automatic recovery after a failed completion GET, stopped
  terminal jobs, Refresh error/retry and no prior manual-event replay.
- Browser receipt: `.tmp/analytics-loading-browser/results.json`.
  Before desktop: `.tmp/analytics-freshness-before/analytics-ready.png`.
  After desktop/mobile: `.tmp/analytics-loading-browser/analytics-ready.png` and
  `analytics-mobile.png`. Inspected all three. Desktop before/after PNG SHA-256
  matches: `9d658557753809dd5319ec67361fa0f1d1e0b2ef008f54152e4a33a5dbd6c796`.
  These fixtures use minimal test styles and are **behavior evidence, not approved
  production visual baselines**. Production CSS/responsive visual acceptance
  remains NOT VERIFIED.
- Production build outcome is recorded in the final verification addendum below.

## Protected behavior receipt

| Behavior | Status / evidence |
| --- | --- |
| Saved results survive reads and refresh failures | VERIFIED locally in actual-workspace browser |
| Account, owner, range and consent separation | VERIFIED locally, browser plus API/storage tests |
| Existing controls and component markup | VERIFIED scoped source diff; desktop fixture pixels identical |
| Hidden/offline periodic reads and inactive-platform metric reads stop | VERIFIED locally in browser |
| Shared-job deduplication, server cooldowns and read-only GET | VERIFIED existing API/unit/database contracts; server source unchanged |
| Completed jobs stay stopped; snapshot failure recovers without reload | VERIFIED locally in browser |
| Production visual, real provider lag, real sleep/idle soak | NOT TESTED / NOT VERIFIED |
| Explore generation/prompt and Schedule end-to-end behavior | NOT TESTED by this task; implementations untouched; scheduling/auth contract checks passed within combined suite |

Incident UGC-UI-052-ANALYTICS is locally verified and remains OPEN for hosted
acceptance. No real provider sync or publishing evidence is claimed. Release
acceptance requires deploying the website change and testing an authenticated
account on the production domain, including provider-due sync completion and a
real laptop return. No worker or database release is required by this patch.

## Final verification addendum

`npm run build -- --webpack`: NOT VERIFIED. The sandboxed build failed creating
`.next/server/app/.well-known` with Windows EPERM. An outside-sandbox retry was
accepted but exited because another Next build held the workspace build lock.
No other build/process was stopped and no lock/build output was deleted. Logs:
`.tmp/analytics-freshness-build.log` and
`.tmp/analytics-freshness-build-elevated.log`. The passing application/worker
typechecks, lint, tests and actual-workspace fixture do not replace a completed
production build or live acceptance.
