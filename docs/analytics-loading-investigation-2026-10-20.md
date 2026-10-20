# Analytics loading investigation — 20 October 2026

The main confirmed issue is that slow work sits on the path used to display connected accounts. There are two separate gates: the page waits for Instagram insights and schedules before publishing its account list, and the server's account reader can wait for an Instagram profile request before returning Instagram, TikTok or YouTube connections. Existing snapshots help, but do not remove these gates.

The investigation below records the pre-fix behavior and evidence collected on 20 October 2026. The required fixes have since been implemented locally; see [implemented behavior and rollout requirements](social-analytics-cache.md). The original diagnostic used held, mocked I/O and read-only production database checks. No production migration or deployment has been performed. The workspace's unrelated existing changes were preserved.

## Production evidence and limits

The production domain `getugcpilot.com` resolved through Vercel to deployment `dpl_8vDMoogxxG5vxzoCFRH3heNKumpo`, commit `fac61da34608dc3f4414702ab87f3f332bdcc14f`. The inspected analytics page, APIs, analytics libraries, account reader, shared account queries, authentication helper, job service and analytics worker entry points have no diff from that commit. A newer READY deployment exists, but was not treated as proof of the code serving the real domain.

Supabase MCP points to project `kltxwijhluawgveykfbt`. Saved job timestamps provide the following examples. They measure job creation through completion, excluding the browser's initial request, response processing and polling detection delay.

| Job | Created, 20 October IST | Wait before start | Work after start | Total |
| --- | --- | ---: | ---: | ---: |
| Instagram insights, 30 days | 10:31:41 | 8.95 s | 3.85 s | 12.81 s |
| Instagram content, 30 days | 10:31:41 | 9.06 s | 4.64 s | 13.70 s |
| TikTok videos | 10:32:37 | 0.53 s | 3.55 s | 4.08 s |

Over the preceding 30 days, the 122 completed 30-day Instagram content jobs averaged 4.92 seconds before start plus 4.36 seconds working; the longest total was 20.15 seconds. The 79 completed 30-day insights jobs averaged 5.92 seconds before start plus 2.07 seconds working. These waits do not establish a worker cold start: dispatch and worker startup need separate tracing.

The latest successful YouTube job was on 3 October. Nine completed YouTube jobs in the 30-day window averaged about 4.05 seconds from creation to completion, with a maximum of 7.77 seconds. Four older failures on 23 September reported `analytics_sync input is invalid`; the current worker accepts `youtube_channel`. Those historical failures are not evidence of a current YouTube failure.

The owner associated with the latest Instagram job had five active connection rows: three Instagram and two TikTok. One Instagram profile timestamp was approximately 153 hours old, beyond the reader's 24-hour profile freshness limit. Its latest insights output required reconnection. This supports repeated profile lookup as a current risk; it does not identify the user's account or prove which request caused the reported visit. No YouTube connection appeared in that particular owner's rows.

Representative owner-scoped `EXPLAIN ANALYZE` reads after initial access took about 5–58 ms of database execution: connections 11.53 ms, account snapshots 5.40 ms, content 21.03 ms, completed TikTok jobs 58.26 ms, schedules 47.76 ms. These are individual SQL samples, not browser/API latency percentiles, and exclude network, authentication and JSON transfer. They do not support database indexing as the first fix for a multi-second screen wait. The health advisor returned no findings; broad index advisories do not establish the cause of this incident.

The available production browser redirected Analytics to sign-in. An authenticated network waterfall, browser CPU profile and battery measurement were unavailable. Vercel rejected a 24-hour runtime-log request because of retention; the corrected recent analytics query returned no entries. The exact duration and cause of the user's particular visit therefore remain unmeasured. In particular, the 13–14-second job examples must not be presented as measured account-display times: existing snapshots can return before those jobs finish.

## Confirmed loading mechanisms

1. **Ready account data is held behind unrelated requests.** `components/analytics/instagram-analytics-workspace.tsx:286` awaits connections, schedules and Instagram insights in one `Promise.all`. Only afterward, at line 337, does it set `allSocialConnections`, and at line 351 mark the workspace ready. TikTok and YouTube receive their connection props from this state. Slow schedules, a slow initial insights response, or a first insights sync without a snapshot delays every platform's account list. An insights error can also switch the entire Instagram workspace to an error despite successful account loading. The separate content request may finish while its enclosing workspace is still hidden by this gate.

2. **The account reader does provider work during a read.** `lib/social/oauth.ts:522` reads connection rows and then awaits `hydrateInstagramConnectionProfile` for all rows before returning them. Stale Instagram profiles call Meta at line 1684 and can write updated profile metadata. That fetch has no explicit timeout. A generic lookup failure returns the old row without recording a retry deadline, so a still-stale profile can be attempted again on the next read. The insights snapshot reader, content snapshot reader and TikTok/YouTube snapshot reader all call this function. Several concurrent initial API requests can consequently repeat the same stale profile lookup. Even a TikTok-only analytics read can wait for an Instagram profile.

3. **Cold reads wait for jobs, and polling adds detection delay.** `lib/analytics/background-sync-client.ts:61` returns saved data immediately after the initial API response when `data` exists. With no snapshot it instead waits for the job at line 109. Instagram uses the default 10-second poll interval; TikTok/YouTube override it to two seconds. A completed Instagram job can remain undiscovered until the next poll. The 15-minute client timeout bounds job waiting, not the initial POST at line 46. The snapshot routes also await enqueue/dispatch before returning a stale snapshot, adding that path to the initial response. These details explain why adding another cache alone would not fully solve loading.

4. **Refresh work can outlive the visible platform.** `lib/analytics/use-social-analytics.ts:27` does not consume the query context's signal or pass it into `runAnalyticsBackgroundSync`. The manual polling loop has no visibility gate. Switching platforms or leaving the page can leave work running until completion or the polling deadline. Instagram's imperative query loader also needs explicit background-poller lifecycle management: a query's initial saved-data promise can resolve while the detached refresh remains active. There is no measured battery drain or browser memory leak in this investigation, but these are unnecessary-request mechanisms.

5. **Full scheduling data adds unrelated initial work.** Analytics calls the general `/api/schedules` route without a date range. It loads up to 200 posts plus targets, although the initial selector needs only connections. The largest observed owner has 173 posts; raw post rows alone occupy about 406 KiB of JSON before targets. This is database row serialization size, not measured compressed HTTP payload size. It is secondary overhead and a reason to load publishing summaries independently.

The page also starts Instagram insights/content even after the user switches to another platform. This can be useful deliberate prefetching, but currently it shares the account-loading gate and lacks a clear priority/lifecycle boundary.

## Recommended implementation

Use the existing authenticated account queries, TanStack Query and durable snapshots. No additional cache service or database is necessary for the first correction.

1. Give connected accounts their own observed query and loading/error state. Render their saved result immediately when present, then update when the connection request resolves. Do not await insights, schedules or provider refresh to populate the selector. Distinguish “loading accounts” from a confirmed empty connection list. Keep the existing owner-scoped cache keys and clear ownership boundaries on sign-out/account switch.

2. Make the display-time account reader database-only. Move profile renewal to a deduplicated background operation, retaining stored names, avatars, statuses and eligibility errors for immediate rendering. Keep OAuth completion and publishing eligibility checks intact. Add provider deadlines and failure backoff to profile renewal so a revoked/invalid connection cannot cause a fresh provider lookup on every display read. A background job must be durably dispatched rather than an unawaited promise inside a serverless request.

3. Observe insights, content and publishing activity independently. Render saved snapshots while displaying a small refresh indicator. Fetch the selected platform's content with priority; defer other platform work. First-time users should see account identity immediately with a “first sync in progress” state within the metrics panel. Provider errors should remain scoped to the affected account/panel and preserve usable saved metrics. Continue representing unavailable metrics separately from genuine zeros.

4. Separate reading snapshots from starting refreshes where practical: render the saved response before requesting or awaiting refresh dispatch. Reuse active jobs with owner/operation/connection-generation keys. Existing Instagram snapshots and TikTok/YouTube completed job outputs already provide most of the required storage. Preserve reconnect/disconnect invalidation; do not put private analytics in a shared public cache.

5. Own polling explicitly for the active owner/platform/job. Forward query cancellation while the request is pending and use lifecycle-managed AbortControllers for detached background polling. Stop subscriptions on unmount, platform switch or owner change; pause hidden tabs; perform one catch-up read on return. Share a poller for the same job and back off when appropriate. Keep the existing sequential fetch behavior so a slow read cannot create overlapping polls. These changes reduce unnecessary network and browser work and are the relevant battery-efficiency improvement.

6. Load date-scoped publishing activity or a small summary independently of initial account rendering. Add timing measurements for authentication, database connection read, profile renewal, snapshot read, dispatch and queue wait; measure client time to accounts and time to first saved content. Only then tune queue concurrency, worker startup or hosting regions if those remain material.

Acceptance should use the real production domain and an authenticated account: warm navigation, hard reload with stale snapshots, first sync with no snapshot, a slow/failing Instagram profile, platform switching, hidden-tab resume, and account switch. Accounts must appear without waiting for analytics; a failing provider must not blank other platforms; existing content must remain visible during refresh. Performance targets should be set and verified from these measurements, rather than promising an unmeasured sub-second result.

## Isolated verification

`node .tmp/analytics-loading-audit/probe.cjs` extracts and transpiles the actual TypeScript functions, then holds their dependencies. It confirms:

- Connections are not published while insights are pending, even when connections and schedules have resolved.
- Connections are not published while schedules are pending, even when insights are ready.
- A pending Instagram profile request prevents all three platforms' rows from returning.
- Two generic failed profile reads retry the provider twice, without a negative-cache/backoff boundary.
- The social analytics query does not forward the provided cancellation signal and requests two-second polling.

All assertions passed. Receipt: `.tmp/analytics-loading-audit/results.json`. These checks reproduce the current mechanisms; they are not production acceptance of a fix.

## Cache follow-up and final recommendation

The follow-up checks distinguish a confirmed correction from an optional optimization. The earlier conversational recommendation made persistent IndexedDB caching sound more necessary than the evidence supports. The first required cache correction is to render and observe the existing query cache correctly. Persistent browser storage is a useful second layer for hard reloads, not a prerequisite for resolving the current loading gates.

### Additional verified findings

- **Stale cached data can exist while the current loader still waits.** The installed TanStack Query is 5.101.4. Its `fetchQuery` fetches when stale instead of immediately returning the existing value. `lib/analytics/instagram-query.ts:35` and the shared account-data loader use this imperative API. A probe seeded a 31-minute-old Instagram value, held refresh pending, and confirmed that the cache retained the value while the application's loader promise remained unresolved. A `QueryObserver` using the same installed library returned `status: success` with the cached value during the pending refresh, then delivered the updated result. This verifies a suitable primitive for the proposed subscribed `useQuery` implementation; it does not constitute a completed UI fix.

- **Instagram's background callback belongs to the original caller.** The actual Instagram loader's first call returned saved data and installed a background callback. A simulated second consumer called the loader while that data remained fresh; no new request ran. When the original callback completed, it updated the QueryClient and the original consumer callback, but not the second consumer callback. The page copies query results into its own state without observing that query. A new mounted screen can therefore miss a background cache update. Subscribing the view to the query fixes both stale-value rendering and this update-delivery gap.

- **Dispatch failure discards the Instagram API's saved-data response.** The insights route can read a stale snapshot successfully and then return HTTP 502 if enqueue/dispatch fails. Its `queueJob` catch ignores the `data` already available; the content route has the same shape. The extracted insights helper returned 502 without data under a mocked dispatch failure despite receiving a saved snapshot. It should return that snapshot with a refresh warning. TikTok/YouTube already have a saved-data fallback for enqueue failure, although their initial read still waits for dispatch.

- **Completed job output is not equivalent to a durable last successful value for each account.** `readOrRefreshSocialAnalytics` examines only five completed jobs. An analytics job can complete with individual account errors. `selectSocialSnapshot` returns the first job with any acceptable accounts rather than merging each connection's latest successful value across jobs. Synthetic probes confirmed that a recent partial success omits another account's older good output, and that five newer error-only outputs can put a good sixth output beyond recovery. These are demonstrated recovery defects, not proof that either sequence occurred during the reported visit.

- **Reconnect invalidation is incomplete.** TikTok/YouTube query keys and snapshot eligibility use `connectedAt`. `upsertSocialConnection` sets `connected_at` on insertion but omits it from the reconnect update patch. The live database has no trigger that updates it. A probe confirmed the unchanged timestamp permits an older output through `selectSocialSnapshot` even when other reconnection-related timestamps change. Instagram's analytics query key also excludes connection identity/generation, and the inspected Settings handlers refresh/remove connection data without invalidating the analytics prefix. Add a dedicated authorization revision updated only on OAuth connect/reconnect, include it in analytics keys/snapshot matching, and invalidate affected cached analytics on account mutations. Token refresh and profile renewal must not change this revision. This corrects the earlier statement that reconnect invalidation was already complete.

The current in-memory QueryClient is replaced when the authenticated UID changes; this is useful existing account isolation. It has no analytics persistence adapter. Browser cache TTL and retention differ: Instagram uses 30-minute freshness/retention in its loader; TikTok/YouTube use five-minute freshness and 30-minute retention. Increasing those numbers alone would keep data fresh by policy for longer without correcting loading order, authorization changes, background delivery or recovery.

### Concrete release sequence

1. **Make account display and cached data independent of refresh.** Replace imperative data copying with observed account, insights and content queries; remove the shared loading gate; keep each section's initial load/error/refresh state separate. Prioritize the selected platform. Preserve saved values while updating. Load the date-scoped publishing summary separately from accounts. A date-range change must keep its cache distinct and must never label a previous range's values as the current range.

2. **Make display reads provider-independent and resilient.** Return stored connection rows without Meta profile hydration. Give profile renewal an owned, deduplicated background lifecycle, explicit request deadlines and failure backoff. Provide snapshot reads independently of refresh dispatch, so the UI can receive saved data before dispatch latency. Return saved data with a warning if refresh cannot start. A browser with no saved data should see its accounts and a scoped first-sync state; no cache can invent first-sync metrics.

3. **Correct invalidation and preserve last successful account values.** Introduce the authorization revision described above, invalidate the affected connection/analytics keys after OAuth and disconnect, and propagate invalidations to other open tabs. Keep last-good snapshots per connection and authorization revision independently of a bounded recent-job scan. Existing Instagram tables provide the storage foundation. For TikTok/YouTube, a small last-good snapshot record in the existing database, written by the worker, is a robust option; a browser-only merge does not survive a hard reload. Errors update refresh status without destroying the last successful metrics. A successful empty result must still clear genuinely removed content, and unavailable metrics must remain distinct from zero. Migration/storage shape is an implementation decision, not an existing feature.

4. **Control the refresh lifecycle.** Separate snapshot queries from job-status queries. Share one status query for the same owner/job, subscribe only while a refresh is active, pause polling in hidden tabs, and stop the browser subscription on unmount/platform/account change. Cancellation of a browser status read need not cancel the durable worker job. Forward AbortSignal to pending requests and bound the initial request as well as polling. Refresh completed results into the observed query cache rather than a captured screen setter. Keep sequential reads and cooldowns to avoid bursts.

5. **Optionally persist selected display snapshots for faster reloads.** After the preceding corrections, use a UID-scoped IndexedDB persister for a bounded set of successful account/analytics display queries. Retain last-updated timestamps, a cache schema version and authorization revision. Restore only after the current user is identified; revalidate connection membership/status against the server. Clear persisted data on sign-out, and invalidate it on connection changes. Persist no tokens, job-polling responses, mutations, billing entitlements or media binaries. Treat cached thumbnail URLs as replaceable rather than permanent. Storage errors or eviction must fall back to the normal database snapshot path. Coordinate restoration with query mounting so restoration itself does not cause duplicate reads. This improves repeat hard reloads; it is not required for the first four fixes.

6. **Measure the remaining bottleneck before changing infrastructure.** Record time to first account, time to first saved content, initial API duration, dispatch duration and queue wait separately. The observed nine-second job wait is real, but its cause is not established. The existing SQL samples do not justify adding Redis, increasing database capacity or changing indexes as the first action. Neither browser CPU nor bundle weight has been profiled, so neither should be presented as the cause of the reported heavy screen.

The required first release is items 1–4 with instrumentation. Item 5 can join that release if hard-reload acceleration is part of scope, after invalidation and recovery are covered. It should not delay correcting the confirmed load-order defects.

### Acceptance evidence to collect

Use authenticated production acceptance after implementation, with local tests as a separate stage:

| Scenario | Required behavior |
| --- | --- |
| Return with stale in-memory data and a held refresh | Saved accounts/content remain visible; results update when refresh completes |
| Hard reload with no browser cache | Database-saved accounts/content load without waiting for a provider sync |
| Hard reload with a persisted cache, if implemented | Matching owner's cached display appears; server membership/status validation follows |
| Slow Instagram profile provider | TikTok/YouTube account display remains independent |
| Queue failure with an existing snapshot | Saved values remain visible with a refresh warning |
| Switch away and back during background refresh | Current screen receives the completed cache update; no orphan status poller |
| Partial account failure or repeated error-only jobs | Other accounts and previous successful values remain available after reload |
| Reconnect the same connection ID with changed consent | Authorization revision changes and old cache cannot suppress revalidation |
| Sign out, change owner, or disconnect in another tab | Private cache and visible connection membership update correctly |
| Hidden tab, storage denial, expired thumbnail, first-ever sync | Graceful fallback, no hidden polling burst, and no invented metrics |

The original additional probe was `node .tmp/analytics-loading-audit/cache-probe.cjs`; all assertions passed before implementation. Receipt: `.tmp/analytics-loading-audit/cache-results.json`. These historical probes describe the original defects. Current implementation checks and rollout requirements are recorded in [the cache implementation notes](social-analytics-cache.md); production deployment remains outstanding.

Official references checked alongside the installed source: [TanStack persistence and restoration](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient), [query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), and [browser storage eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Installed package behavior was tested directly rather than assuming newer online API signatures match the installed version.
