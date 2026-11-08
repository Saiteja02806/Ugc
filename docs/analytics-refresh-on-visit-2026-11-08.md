# Analytics refresh on visit and removed manual-refresh dependency

Date: 8 November 2026. Status: LOCALLY VERIFIED / PRODUCTION OPEN.

## Reported problem

The user reported that the Analytics screen shows older data, takes time to update,
and only updates after a manual Refresh. This is a recurrence of
`UGC-UI-052-ANALYTICS` and `UGC-UI-067-ANALYTICS-ZERO`. It was recorded again as
`UGC-UI-20261107-ANALYTICS-STALE` before any fix.

## Root cause (code confirmed)

1. A visible Analytics visit only asked the provider for data when the saved
   snapshot was older than the server admission TTL: 15 minutes for Instagram and
   5 minutes for TikTok/YouTube (`lib/analytics/freshness-policy.ts`,
   `lib/analytics/snapshot-service.ts`). Inside that window every foreground read,
   including a browser reload, returned the same saved snapshot. Only the Refresh
   button sent `force: true`, so a click was the only way to see data newer than
   the TTL.
2. Even when a refresh was due, the open-screen saved-data check used a fixed
   interval aligned to mount. If the data arrived just after mount, the next tick
   was still younger than the one-minute stale threshold, so the read was skipped
   and the following check happened a full interval later. A visible screen could
   therefore revalidate only every ~2 minutes.
3. Instagram content sync is the expensive operation. `force: true` bypasses the
   per-post staleness policy and re-requests every post's metrics, so forcing a
   full refresh on every visit would multiply provider calls and risk Meta rate
   limits.
4. With zero connected YouTube accounts the content panel stayed on "Loading
   uploaded-video data for this connected channel." forever, because the query is
   disabled at zero connections and `hasRefreshed` stays false.

## Implemented change

- `lib/analytics/freshness-policy.ts`
  - `INSTAGRAM_ANALYTICS_REFRESH_MS`: 15 → 5 minutes.
  - `SOCIAL_ANALYTICS_REFRESH_MS`: 5 → 3 minutes.
  - Added `INSTAGRAM_RECENT_MEDIA_METRICS_REFRESH_MS` = 15 minutes so per-post
    Instagram insight calls keep their original budget.
  - Added `ANALYTICS_VISIT_RECHECK_MS` = 60 seconds as the visit floor.
- `lib/analytics/instagram-freshness.ts`
  - Account insights and media-feed staleness now derive from the 5-minute
    admission window.
  - Recent (<1 day) per-post metrics use the independent 15-minute constant.
  - New `shouldScanInstagramFeed()` separates "check for new posts" from "refresh
    every post's metrics".
- `lib/analytics/instagram-content.ts`
  - New optional `visit` input forces a feed scan only. Per-media metrics and
    thumbnail repair remain age-based unless the user explicitly forces a refresh.
- `lib/analytics/snapshot-service.ts`
  - `refreshAnalyticsSnapshot` accepts `visit`. A visit dispatches when the last
    attempt is at least 60 seconds old, even inside the background window, and
    never sets `force`.
  - A visit now attaches an already-running matching job so the browser keeps
    polling it instead of losing the completion.
  - A manual Refresh inside its 30-second cooldown can also attach an active job.
- `lib/analytics/jobs.ts`, `lib/analytics/route.ts`,
  `app/api/internal/jobs/sync-analytics/route.ts`
  - Forward the `visit` flag from the browser to the internal sync job.
- `lib/analytics/use-analytics-resource.ts`
  - Opening a screen, or returning after at least 60 seconds away, is one visit
    per resource. A quick tab switch is not a visit.
  - Visits use the existing refresh query, job polling and authoritative GET
    reconciliation. A manual Refresh is not replaced or replayed.
- `lib/analytics/use-analytics-wake.ts`
  - Open-screen checks are now scheduled from the moment the saved data actually
    becomes stale instead of a mount-aligned interval, removing the extra interval
    of delay. Hidden/offline screens pause, and return/online events catch up.
- `components/analytics/youtube-beta-analytics-panel.tsx`,
  `components/analytics/tiktok-beta-analytics-panel.tsx`
  - Zero-connection panels show a disconnected explanation instead of perpetual
    loading copy. The existing account-readiness card and Manage connection link
    are unchanged.
- `scripts/analytics-loading.browser.cjs`
  - The fixture's webpack config now handles CSS modules (it had been failing
    since the 4 November contrast module was added).
  - Added visit, remount-visit, and zero-connection panel scenarios.

## Protected behavior confirmed unchanged

- Manual Refresh still sends `force: true`, keeps its 30-second cooldown and is
  consumed only after the authoritative saved-data read succeeds.
- Hidden/offline screens send no periodic reads; job polling pauses and resumes.
- Account, date range and authorization revision remain part of every cache key.
- Existing saved content stays rendered during refresh and after refresh failures.
- No new permanent control, layout, palette, timer/cron, schema, dependency or
  provider change. The Refresh button remains the only manual action.

## Verification

- `lib/analytics` suites (all `.test.ts` and `.test.mjs` except the pre-existing
  failing `site-analytics.test.mjs`): **107/107 PASS**.
- `lib/analytics/use-analytics-wake.test.mjs`: **2/2 PASS**, including stale-moment
  scheduling, hidden/offline pause, resume and timer cleanup.
- `lib/analytics/social-snapshot.test.mjs`: visit dispatch, 60-second visit floor,
  active-job attach, manual cooldown and error cooldown PASS.
- `lib/analytics/routes.test.mjs`: `visit` forwarding from the POST body PASS.
- `node scripts/analytics-loading.browser.cjs`: **PASS** twice consecutively
  (32 receipt assertions), including
  `visitChecksProviderWithoutManualRefresh`,
  `visitNeverForcesPerPostWork`,
  `remountRunsVisitWithoutReplayingManual`,
  `zeroConnectionPanelsShowDisconnected`,
  `idleSnapshotsRevalidated`, and the existing hidden/offline/completion/recovery
  cases.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint on every changed file: 0 errors; two pre-existing `no-img-element`
  warnings in the platform panels.

Local artifacts: `.tmp/analytics-loading-browser/results.json`,
`.tmp/analytics-loading-browser.log`, `.tmp/analytics-loading-browser-2.log`,
`.tmp/analytics-loading-browser/analytics-ready.png`,
`.tmp/analytics-loading-browser/analytics-mobile.png`.

## Remaining risks and not verified

- Authenticated production acceptance was NOT performed. The live site requires
  sign-in and no account session was available in this task.
- Provider rate limits were not measured. The change adds at most one visit check
  per minute per mounted resource and keeps Instagram per-post calls on their
  original 15-minute cycle; real Meta/TikTok/YouTube quota behavior remains
  unverified.
- The real production timing, queue wait and the user's exact platform remain
  UNKNOWN until a signed-in session is inspected.
- Pre-existing, unrelated: `lib/analytics/site-analytics.test.mjs` fails in
  isolation (marketing GA consent `page_view` count) on this worktree; it is not
  touched by this change.
- No build, deployment, provider write, publishing or paid generation occurred.

## Rollback boundary

Revert only the files listed above and this receipt plus its documentation
updates. Do not reset the worktree wholesale; it contains unrelated user work.
