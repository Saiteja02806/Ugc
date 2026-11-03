# Unexpected Explore → sign-in redirect — 3 November 2026

Status: **OPEN / ROOT CAUSE NOT ESTABLISHED**. User confirms the affected environment is live `vidmake.io`, after previously signing in. Explicit instruction: **do not deploy**.

## What is confirmed

1. Live `/explore`, `/explore/hook-video`, `/explore/slideshows`, `/explore/wall-of-text`, and `/sign-in` each returned HTTP200 at their requested canonical URLs. Read-only public HTTP checks only; no browser cookies/tokens were used.
2. Forty-one public production JavaScript chunks were retrieved successfully and inspected for the actual auth paths. The deployed AuthGuard matches the local condition: redirect to `/sign-in` only after initialization finishes and the React auth user is null. This is a client redirect, not an HTTP redirect in the public page request.
3. Workflow cards link to their workflow paths on the same origin. No card-specific sign-in URL or signOut call was found.
4. `/explore` is public. Being able to browse it does not establish that Firebase still has a signed-in user. Guarded workflows require one.
5. Firebase initialization uses getAuth(app). Installed SDK @firebase/auth 1.13.3 already tries IndexedDB, localStorage and sessionStorage. Adding setPersistence alone is not an evidence-backed diagnosis. Official Firebase documentation also specifies persistent local browser auth by default, subject to browser storage availability.
6. No automatic application logout timer, blanket localStorage.clear(), or ordinary API-failure signOut call was found in the searched auth/application code. Explicit signOut call sites correspond to Settings logout, verification account switching, email action continuation after reset/different account, and OAuth account switching.
7. The installed SDK deliberately signs users out for disabled/expired refresh credentials. Its startup restoration removes a stored user on non-network reload failure. Those are possible mechanisms, not observed causes for this incident.
8. A fragile application branch exists: an auth observer error clears both the cosmetic ugc_session hint and the React user, after which AuthGuard can redirect. This branch is present in local and live JavaScript. No observer error from the affected session has been captured, so it is NOT the established incident cause. Firebase's auth-state observer error callback is not a generic per-API/network error handler.
9. Canonical-domain checks succeeded: www.vidmake.io → vidmake.io; legacy www.getugcpilot.com → vidmake.io with moved=1. Firebase sessions are origin-scoped, so an old-domain session does not migrate automatically. This explains a domain-move re-login but does not prove frequent same-origin sign-outs.
10. Earlier disk pressure could affect browser storage, but the cleanup targeted only project-generated files, not Chrome/Comet profiles or Firebase browser storage. No browser quota/storage error was observed. Do not label disk pressure as the root cause.

## Tests actually run

`node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/next-server-only-test-loader.mjs --test lib/auth/account-isolation-contract.test.ts scripts/server-auth-deadline.test.mjs lib/firebase/in-flight-auth-requests.test.ts`

**18 passed; 0 failed.** Coverage includes account-scoped cache/subtree replacement, existing route access matrix, initial-loading sign-in guards, same-token concurrent verification, failed-request release, invalid/unverified credentials failing closed, and Firebase outage/throttling returning temporary unavailability rather than invalid-session401. These are local tests and do not reproduce the user's authenticated browser transition.

## Exact next evidence required

In the affected signed-in production browser, reproduce Explore → workflow and capture (without copying token values):

- hostname before/after, and whether navigation is client-side or a full page load;
- whether the sidebar account and Sign up header change before the click;
- Firebase initialized/current-user-present state before navigation and at redirect;
- any auth error code and Firebase lookup/refresh response status;
- availability of IndexedDB/localStorage and whether a persisted auth entry exists (presence only, never credential contents);
- whether another tab explicitly signed out or a password reset/revocation occurred.

Current blocker: native inventory reports **Local browser use is disabled in Work settings**. The existing Playwright MCP browser profile also reports **already in use**. No browser policy/settings change, profile deletion, credential extraction, or alternate-profile impersonation was attempted.

Enable browser access in Work settings and leave the affected production Explore tab open to complete the trace. Do not clear site data or sign out as a diagnostic step, as that destroys useful session evidence.

## Scope and preservation

Application source/configuration changes: **none**. Deployments: **none**. Database/provider/auth-console changes: **none**. Auth guards, verification, user-owned caches, UI layout, generation and scheduling code remain untouched by this investigation. Live authenticated acceptance: **NOT VERIFIED**. Do not claim either “fixed” or “no issue.”

Incident UGC-AUTH-001 is appended as OPEN in docs/ai-context/clear.md. Files added: this report and auth-production-public-trace-2026-11-03.json. The prior large project worktree was not reverted or staged.

## Preflight sources actually consulted

AGENTS.md engineering requirements; the full ugc-context-memory, ugc-immutable-contracts, ugc-regression-gate and ugc-ui-clarity skills; docs/ai-context/nonnegotiables.md; relevant auth/idle-navigation/sign-in sections and history headings from EXPLORE_CONTEXT.md and clear.md (the entire large historical files were not manually reviewed); docs/idle-navigation-investigation-2026-10-23.md; local Next use-client guide; the source and test files named in this report. `python tools/preflight.py --repo . --task ...` passed prerequisite discovery; its own output explicitly does not replace reading the context. No application-code edits were performed.

Primary reference: https://firebase.google.com/docs/auth/web/auth-state-persistence
