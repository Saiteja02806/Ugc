# Instagram connection and scheduling audit — 3 November 2026

**Conclusion:** the legacy-domain callback routing is intact, and production worker logs contain recent Instagram publishing completion events. This audit did not prove that every schedule succeeds or that a fresh Instagram consent flow currently completes. No application changes, account connections, new schedules, retries, publications or deployments were made.

## Domain and Connect Instagram flow

The project uses **getugcpilot.com**, not the user-typed getgucpanel.com. No getgucpanel domain was found in the searched implementation.

Expected sequence:

1. `InstagramAccountManager` invokes `useSocialOAuthPopup.startConnection`.
2. A popup opens immediately. Browser Firebase authentication supplies a Bearer token to the same-origin `POST /api/social/oauth/start`.
3. The API verifies the user, plan account limit, reconnect ownership and account intent. `createSocialAuthorization` saves a hashed OAuth state session with a ten-minute expiry in `social_oauth_sessions`.
4. The popup navigates to **https://www.instagram.com/oauth/authorize**. The legacy domain is the return destination, not necessarily the first page displayed.
5. `redirect_uri` is `INSTAGRAM_REDIRECT_URI` when configured, otherwise `SOCIAL_OAUTH_BASE_URL` plus `/api/social/instagram/callback`. The base defaults to **https://getugcpilot.com**.
6. Instagram returns code/state to **https://getugcpilot.com/api/social/instagram/callback** under the inspected local configuration/defaults. The callback atomically consumes matching unused/unexpired state, resolves its stored application user, exchanges the code using the same configured redirect URI, fetches the professional profile, enforces reconnect identity, and saves the connection before success.
7. The callback sends a result to the opener. Sender and receiver explicitly allow vidmake.io and getugcpilot.com origins; receiver also requires the original popup as event source. Callback fallback link returns to **https://vidmake.io/settings#instagram-publishing**. UI refreshes persisted connections.

Source: `components/social/use-social-oauth-popup.ts:138`, `lib/social/oauth.ts:325`, `lib/social/oauth.ts:1267`, `lib/social/oauth.ts:1437`, `lib/social/oauth.ts:2023`, `lib/social/oauth-callback.ts:180`.

**Configuration limitation:** local `.env.local` names the non-www legacy callback. That is local evidence, not proof of current Vercel production environment values or Meta's registered allowed redirect URI. The authenticated start endpoint was not called, so its live generated authorization URL is NOT VERIFIED. The Meta developer dashboard was not accessed.

## Live callback checks

Public GET requests without code/state are deliberately invalid and do not connect accounts or exchange tokens.

| Requested endpoint | Final endpoint | Result |
| --- | --- | --- |
| getugcpilot.com/api/social/instagram/callback | Same | HTTP200 safe missing-parameters page |
| www.getugcpilot.com/api/social/instagram/callback | Non-www getugcpilot.com callback | HTTP200 after host canonicalization |
| vidmake.io/api/social/instagram/callback | Same | HTTP200 safe missing-parameters page |
| getugcpilot.com/api/social/tiktok/callback | Same | HTTP200 safe missing-parameters page |
| getugcpilot.com/api/social/youtube/callback | Same | HTTP200 safe missing-parameters page |

All five returned no-store pages with vidmake.io result/fallback support. Importantly, the non-www legacy API callbacks were NOT redirected to the new application domain. Proxy excludes `/api/` from the marketing-domain migration.

**Watch point:** www and non-www URLs are not interchangeable when configuring provider redirect URIs. The live www endpoint canonicalizes to non-www. Use the exact configured/Meta-registered URL consistently during authorization and exchange; its live registration was not verified here.

Receipt: `docs/scheduling-oauth-live-probes-2026-11-03.json`.

## Durable scheduling trace

`Schedule UI -> authenticated schedule API -> createUserSchedule -> ownership/time/media/connection validation -> insertDirectScheduledPost RPC (parent + selected targets + publish jobs atomically) -> reconcileDirectScheduleHandoff -> deterministic Cloud Task -> /api/internal/schedules/dispatch with OIDC -> background publish queue -> ugc-social-publish-worker -> due-time/claim/account-lane guards -> persisted provider container -> Instagram publishing -> stored provider post result + target projection -> UI readback`.

`lib/scheduling/service.ts:425` uses the atomic RPC rather than acknowledging split parent/target writes. Handoff recovery checks every target's job and avoids declaring scheduled while unresolved targets remain. `schedule-dispatch-logic.ts` validates job type and target, avoids re-enqueueing already attached/terminal jobs, and retains recoverable delivery after a metadata-write failure.

The worker checks due time, cancellation, existing publication and operation claims. Instagram container identity is persisted before completion and reused during retry; invalid tokens renew once before retrying that same operation. Completion logging occurs after provider-operation and target publication updates (`worker/src/jobs/publish-social-post.ts:637`). No new provider post was triggered by the audit.

## Production infrastructure and recent execution evidence

Read-only gcloud checks in **ugcsaas/us-central1**:

- `ugc-social-publish` and `ugc-social-publish-scheduler`: **RUNNING**.
- Scheduler queue pending task sample: **empty** at inspection. This is not proof of no database backlog or no future schedules.
- Active service: **ugc-social-publish-worker**, ready revision **ugc-social-publish-worker-r-17fe15f2b**, job-type filter publish_social_post, configured application attempt limit4, service concurrency1.
- Publishing queue: concurrent dispatches1, rate1/sec, up to5Cloud Tasks delivery attempts, ten-second initial backoff, one-hour retry duration. Scheduler queue: concurrent10, rate5/sec, same transport retry bounds. Provider attempt counts and HTTP delivery attempts are separate mechanisms.
- Background recovery Cloud Scheduler: **ENABLED**, every five minutes, targeting **https://getugcpilot.com/api/internal/jobs/recover**. Last-attempt status had no error code in the returned metadata. This checks configuration/attempt metadata, not full recovery correctness.
- Recent active-service logs from27October onward:368projected log rows; **24worker-start events,23completion events**, including **10Instagram completions**. Most recent completion:30October2026at15:30:32UTC (21:00:32IST). Six recent completion events record start delays of1,7,7,12,18and23seconds; these are sample start delays, not all end-to-end posting lateness.
- Logs include **one tiktok_internal_error** and **two HTTP503responses**. These are real historical failure/retry signals, not proof that a post is currently stuck or that all retries recovered. No provider/database record was queried to establish the final outcome of that error.
- The similarly named *canary job* last completed inJuly and is not the active service; it was excluded from current publishing-success evidence.

Receipt: `docs/scheduling-live-worker-evidence-2026-11-03.json`. Only safe event counts, errors and timing were retained; no tokens, account identifiers, captions or provider URLs were printed.

## Issues and limits found

1. **Connection recovery gap — CODE CONFIRMED, live occurrence NOT REPRODUCED.** `useSocialOAuthPopup.startConnection` awaits token acquisition, the start fetch and response JSON without a deadline. The popup-close poll is installed only after those waits and navigation. A stalled auth/start/body request can leave an about:blank popup and pending UI without bounded recovery. Instagram code exchange and long-lived token exchange also lack explicit abort deadlines. This is a reliability concern, not evidence that the callback domain is wrong. Track as UGC-SCH-018; no fix included in this audit.
2. **Stale domain-migration tests — CONFIRMED.** Three tests expect307legacy redirects or200for `/`, while current unchanged proxy uses308legacy migration and307home-to-Explore. The file and proxy have no audit modifications. Their five callback/message/default-origin tests pass; the suite is still not fully green. Updating stale assertions requires a separate scoped change, not weakening callback protections.
3. **Provider errors observed.** Historical TikTok failure/503events require target-level follow-up before saying every schedule worked. Instagram completion evidence does exist.
4. **Possible queue backlog under bursts — configuration risk, not observed outage.** Publishing dispatch concurrency1serializes tasks. Current empty scheduler queue and sample delays do not establish capacity at higher traffic. Do not raise concurrency without reviewing provider account lanes and rate limits.
5. **Misleading account guidance — CODE CONFIRMED.** Backend accepts BUSINESS and MEDIA_CREATOR, but some callback/UI messages say the profile must become a Creator account. A Business account should not be described as inherently ineligible. No evidence that valid Business accounts are rejected by this backend guard.

## Checks actually run

- OAuth + schedule/time/dispatch/retry + PGlite atomic DB/service + domain-migration suites: **83tests:80PASS,3FAIL** (stale redirect assertions described above).
- `npm --prefix worker run build`: **PASS**.
- Compiled publishing job / Instagram token renewal / Instagram publisher tests: **42/42PASS**. Covers no early publish, cancellation races, stored provider operation reuse, projection recovery, bounded retries, rate limits, expired permissions and token renewal.
- Local database tests use PGlite; they do NOT prove those migrations are applied to production.

Total executed assertions: **125;122pass,3stale-test failures**. No claim of complete production acceptance from these local checks.

**NOT VERIFIED:** fresh consent from the affected user's browser, actual live start-generated redirect_uri, Meta allowlist/app-review state, current account token validity, production schedule/target/operation row consistency, every future dispatch target/audience, real browser-closed publication test, or final outcome of the historical TikTok failure. The configured Supabase skill file was unavailable at its catalog path and a local skill search found no replacement; no production database credential/client access was attempted. Browser access was previously disabled in Work settings. No account connection or live publishing was simulated as success.

## Preservation and scope

Read ugc-scheduling and scheduling-contract; inspected relevant social/scheduler/worker/source/tests and existing migration/auth history. Auth fixes and all pre-existing schedule/source changes were left intact. Only this report, two safe evidence receipts, and an append-only incident note were written during this audit. No application edits, hosted settings changes or deployment.
