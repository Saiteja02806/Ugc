# Analytics empty-data production incident — 20 October 2026

The deployed app required `public.analytics_account_snapshots`, but the production migration had not been applied. The first saved-data GET failed, so the client had no snapshot response and could not start its normal refresh POST. This was a web/database release mismatch. Adding browser caching would not create the missing table or repair its API.

## Evidence

- `getugcpilot.com` and `www.getugcpilot.com` resolved to production deployment `dpl_GQiaoFn4Y2jXbD5gXPYcwJTATGNu`, commit `094e586455c2b686f6ee543c8e692d6fb88d6229`, matching the inspected local analytics source.
- The linked Supabase project and configured server URL both identify `kltxwijhluawgveykfbt`. SQL returned no `analytics_account_snapshots` relation; the migration ledger contained no corresponding entry.
- Production error aggregation reported eight occurrences from 18:14:24–18:15:16 UTC on the Instagram insights/content routes: `Analytics request failed: Error: Could not read saved analytics: Could not find the table 'public.analytics_account_snapshots' in the schema cache`. The other analytics operations use the same failing table reader. The actual observed request errors were Instagram; this is not a claim that authenticated requests to every platform were captured.
- No metric-sync jobs had been created after the earlier successful morning jobs. Profile renewal was separate: four old profile jobs failed with invalid input, but the latest profile job completed at 18:14 UTC. The current missing-table error occurs before provider synchronization and does not implicate provider APIs or worker startup.

## Production repair

The existing migration was rerun against isolated PostgreSQL fixtures before application. At 18:17:48 UTC (23:47:48 IST), the migration was applied successfully to production with name `analytics_account_snapshots`, remote version `20261020181748`. Its local SQL filename and test references were aligned to that ledger version; the SQL itself was unchanged.

The migration creates the required service-only table/function and backfills last-good per-account values from historical successful jobs. It does not delete connection rows, revoke consent or call providers. Post-repair verification found 21 snapshot rows: 9 Instagram content, 9 Instagram insights, 2 TikTok and 1 YouTube, across the available ranges. Historical content payloads contained 150 Instagram items, 40 TikTok videos and 20 YouTube videos before current-range filtering. Those counts describe stored results across owners/ranges, not a promise of content for every connected account or a deduplicated media count.

The actual server-side snapshot reader was exercised read-only for every currently connected owner/platform scope using production data. All reads completed without the missing-table error. Current 30-day results included 54 Instagram items and 40 TikTok videos; YouTube returned 20 videos in its independent lifetime-video dataset. Some connections still need first synchronization or have account-specific unavailable/permission states. No values were invented for them.

Observed maximum reader times from the local verification client were 824 ms for TikTok, 995 ms for YouTube, 1,236 ms for Instagram insights and 1,546 ms for Instagram content. These include this client's database round trips and are not production browser latency percentiles. Authentication, rendering and provider refresh were not measured by this read-only check.

The service REST API can now read the table, and the save RPC safely returns false for an unmatched readiness sentinel without modifying account data. RLS is enabled; only `service_role` has SELECT/INSERT/UPDATE table access. The advisor's informational [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) finding is expected for this service-only table; anonymous/authenticated access was not granted to suppress it.

## Follow-up code and checks

- Fixed `useAnalyticsResource` so a manual Refresh invalidates/retries the snapshot GET. Previously an initial GET error left `snapshot.data` absent, permanently disabling the refresh POST in that mounted screen. The regression was reproduced in the actual-component browser fixture, then passed after the correction.
- Added `scripts/check-analytics-storage.mjs` as a targeted release-readiness check for both table and RPC availability, with an explicit expected project. It uses server-only credentials and does not queue syncs or mutate real account snapshots. Run it before releasing analytics-dependent web code; a successful code build alone is insufficient.
- Updated the database tests to use the production migration version. The existing tests cover last-good retention, successful empty responses, owner/reconnect isolation, older writes, malformed historical dates and service-only permissions.

Repair validation: `npm run test:analytics-loading` passed 185 checks (56 analytics, 33 snapshot/policy, 93 API/database/regression and 3 worker-operation checks). The actual-component browser fixture passed 13 scenarios, including failure-to-repair recovery with Refresh. TypeScript and scoped ESLint passed. The service-API readiness probe returned `ready: true`, `snapshotRows: 21`, `accountDataChanged: false` against the explicitly selected production project.

The database repair is live without a new web deployment. The Refresh recovery code and readiness script are local changes awaiting release. Existing open tabs that already cached the failed GET should reload Analytics once to retry against the repaired database.

## Acceptance limit

The available production browser redirected to sign-in. A real account login was requested for the remaining authenticated waterfall/content check. Read-only production database/service/application-reader verification and local browser fixtures are complete; authenticated production UI rendering and the user's remaining perceived loading time must not be reported as verified until that session is available.
