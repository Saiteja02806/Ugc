# Sidebar navigation after 5–30 minutes idle

Status: diagnosis only; no application fix or deployment. Incident UGC-UI-050 remains OPEN. User confirmed sidebar/Explore links fail after idle and refresh restores them. No further computer/browser control was used for this continuation.

## Findings

1. **Route transport can wait without a deadline, with no sidebar feedback/recovery.** Both expanded and collapsed sidebar entries are ordinary Next Links; no click lock or idle-disable condition was found. They do not use pending indicators. Installed Next 16.4.2 `fetch-server-response.js` awaits the route fetch without adding a deadline; fallback to full-page navigation occurs on failure, not while headers remain pending. Executing its actual exported `createFetch` with a stalled transport and advancing an isolated clock 30 minutes leaves it pending with no AbortSignal. Releasing the fixture response completes it. This reproduces a mechanism for apparently dead sidebar navigation, not the user's actual network failure.

   Installed Next defaults (`node_modules/next/dist/server/config-shared.js`) set static prefetch freshness to 300 seconds. The installed prefetch guide documents that lifetime. Once cached data is stale, navigation may require fresh transport. This matches the reported time window but is an inference, not a demonstrated production root cause. Cache expiry itself is normal; extending it would not repair an indefinitely stalled request.

2. **A temporary profile recheck failure removes a previously verified workspace.** `AuthGuard` returns its full-screen error for any `profileGateQuery.isError`, including a background refetch failure with retained `{onboardingComplete:true}` data. A real TanStack QueryObserver with a 31-minute-old successful result and an injected transient failure returns `isRefetchError:true` with valid cached data; executing the actual guard with that result replaces its workspace/sidebar child with the error screen. Reconnect or re-enabling/remounting a stale gate can trigger rechecks; simple elapsed time alone does not trigger one, and focus refetch is explicitly disabled. This explains workspace interruption, not visible-but-unclickable sidebar links by itself. Initial checks, confirmed incomplete setup and authentication failures must still fail closed in any future correction.

3. **The shared profile read has incomplete cancellation/account binding.** Unlike the previously corrected Trending, billing and AI Studio readers, `fetchBusinessProfileGate` calls token acquisition without an expected owner and omits `bounded.throwIfAborted()` after token resolution. A cancelled token wait rejects promptly, but resolving its token later still invokes fetch with an already-aborted signal. Native fetch should reject without sending that request. This is a cancellation consistency defect; no cross-account disclosure or user-visible freeze was demonstrated. The query already has a 20-second deadline, so claiming it waits forever would be incorrect.

## Checks

`node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/idle-sidebar-diagnostics.mjs scripts/idle-navigation-reads.test.mjs scripts/server-auth-deadline.test.mjs lib/http/read-deadline.test.ts scripts/explore-navigation-ui.test.mjs`

The diagnostics execute current source with isolated auth/transport boundaries and real QueryClient/QueryObserver behavior. They deliberately assert the current defects for diagnosis; they are not assertions of desired fixed behavior. The installed Next transport test mocks the network and clock; it does not emulate browser suspension. The initial diagnostic had one overly broad source assertion catching the mobile focus-trap's legitimate preventDefault; narrowing it to the link functions resolved the harness error.

Existing tests verify bounded token/header/body waits, server lookup coalescing/recovery and fail-closed auth; Explore destination and decorative-media behavior. These passing checks do not establish deployed production acceptance.

Final combined run: **34/34 PASS** (five diagnostic probes and 29 existing checks). Targeted diff whitespace check passed. Diagnosis files changed: this report, `scripts/idle-sidebar-diagnostics.mjs`, appended entries in `docs/ai-context/clear.md` and `EXPLORE_CONTEXT.md`; temporary probes under ignored `.tmp/idle-sidebar-audit/`. Existing unrelated working-tree changes were preserved. Protected behavior status: source-level application/layout/auth/persistence changes absent (VERIFIED by scoped changes); production sidebar after idle, desktop/mobile visual acceptance and live integration effects NOT TESTED in this continuation.

## Scope and limits

Reviewed current sidebar links, workspace boundary, AuthGuard, auth context/token helper, QueryClient provider, profile query, existing idle-read/server-auth tests, installed Next transport/cache defaults/guides, prior 19/23 October idle investigations, and UGC-UI-050/UGC-UI-048 ledger entries. Application source, layout, authorization, persistence, generation and scheduling were not changed. No lint/build/visual acceptance is claimed for an application patch because no such patch was made.

Root cause of the actual production failure remains UNKNOWN: no request/console/performance capture from a failing idle session exists. Missing evidence includes whether a click starts RSC transport, whether it remains pending, and whether a renderer long task or browser suspension prevents handler execution. A refresh restoring navigation is compatible with several of these mechanisms. No five-minute logout rule was found in the inspected shared auth/navigation code.

Candidate fixes should separately cover route pending/recovery without forced reload or lost drafts, distinguish transient recheck failure from confirmed access denial, and complete profile cancellation/owner checks. Preserve all server authorization. Do not patch framework internals, increase cache times blindly, or force periodic page reloads.
