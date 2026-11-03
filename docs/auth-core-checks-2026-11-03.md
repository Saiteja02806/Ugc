# Core authentication checks — 3 November 2026

**Outcome: a reproducible session-loss mechanism was confirmed in the installed SDK, and the identical restoration condition is present in the public production bundle. It is not yet proven to have caused this user's workflow redirect. No application-source edit or deployment was performed.**

## 1. Confirmed SDK startup session-loss mechanism

The actual installed Firebase SDK was executed with test-only fake account credentials, a controlled transport and an in-process persistent-storage adapter. After a successful fixture sign-in, the app instance was deleted and recreated using the saved user, simulating startup restoration. The fake endpoints never contacted production.

| Restoration response | SDK current user | Saved fixture user | Observer error callback |
| --- | --- | --- | --- |
| Healthy lookup | Restored | Retained | Not called |
| Transport network failure | Restored | Retained | Not called |
| HTTP500 / INTERNAL_ERROR | Cleared | Removed | Not called |
| HTTP429 / TOO_MANY_ATTEMPTS_TRY_LATER | Cleared | Removed | Not called |
| HTTP400 / INVALID_ID_TOKEN | Cleared | Removed | Not called |

The first two are persistence controls; invalid token removal is a security control. The500/429 cases reproduce loss of a stored session from a simulated transient service failure rather than an intentionally invalid credential.

The browser SDK source implements `reloadAndSetCurrentUserOrClear`: every thrown error except `auth/network-request-failed` reaches `directlySetCurrentUser(null)`. The latter also removes the persisted user. Browser source inspected at `node_modules/@firebase/auth/dist/browser-cjs/index-80e3689c.js:2848` and `:3129`.

A second read-only public production check inspected21served JavaScript files and found the SAME method in `/_next/static/chunks/a36bde72-63b3d0fa53412277.js`: `catch(e){if(e?.code!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}`. No chunk errors on that successful attempt. One preceding page read timed out; the bounded retry succeeded. A public-script match is not evidence that a500/429 occurred for the affected user's account.

This mechanism requires initialization/restoration (such as a full document reload). A normal same-origin client-side workflow navigation should keep the existing root AuthProvider and Firebase instance; therefore a failing-click trace must establish whether a reload or prior startup loss occurred. Removing/bypassing AuthGuard cannot repair lost Firebase persistence safely.

## 2. Active-session refresh behaves differently

Additional actual-SDK tests confirm:

- A refresh request failing with `auth/network-request-failed` leaves the signed-in user intact; a subsequent healthy refresh succeeds.
- An active-session refresh receiving500 maps to `auth/internal-error` and retains the current user.
- An active-session refresh receiving429 maps to `auth/too-many-requests` and retains the current user.
- `TOKEN_EXPIRED` and `USER_DISABLED` trigger the SDK's normal sign-out and auth-state null notification. Those protections must remain.
- None of the tested refresh failures calls the auth-state observer's error callback. This demotes the application's observer-error-clearing branch as an explanation for these scenarios; it was previously only a hypothesis.

## 3. Two separately reproduced application-helper gaps

Tests invoked the actual `lib/firebase/auth.ts` exports with mocked Firebase primitives:

1. `refreshCurrentFirebaseUser()` reads currentUser immediately and can return null while initial restoration is pending. Unlike `getCurrentUserIdToken()`, it does not await `auth.authStateReady()`. AuthContext's explicit refreshUser operation can write that null result.
2. If the active account changes during its awaited reload/token calls, `refreshCurrentFirebaseUser()` returns the old captured user's mapped identity. AuthContext can then write a stale identity. Its API-token counterpart already checks the expected owner before and after token retrieval.

Controls passed: API token requests wait for initial readiness, reject the wrong account before token acquisition, reject an account switch during token acquisition, and explicit user-refresh network failures throw rather than call SDK logout.

Only email sign-in/creation and email-verification/action callers of explicit `refreshUser` were found. Workflow-card clicks do not directly invoke it. These gaps are confirmed under controlled interleavings but are NOT established as the reported Explore-to-workflow incident cause. No speculative patch was applied.

## Evidence and validation scope

- Seven actual-SDK sign-in/refresh/invalidation observations.
- Five actual-SDK restoration scenarios with a test persistent adapter.
- Three additional actual-SDK500/429/recovery observations.
- Six actual-app helper interleavings, including two confirmed gaps.
- **21 additional controlled observations in total**, plus the earlier **18/18 repository tests**. The helper gap cases deliberately assert the observed deficiency; do not describe all21 as healthy-behavior passes.
- No real Firebase account sign-in, Google popup, production token refresh, browser IndexedDB/quota test, authenticated UI click, provider console change, database write, or deployment.
- The initial refresh experiment failed because static imports captured the original fetch implementation before the fake transport was installed. It produced no passing receipt and was corrected to install the fake transport BEFORE dynamically importing firebase/auth. All retained successful SDK receipts use that corrected isolation. No user credentials were used in either attempt.

Receipts:

- `docs/auth-core-sdk-checks-2026-11-03.json`
- `docs/auth-core-restoration-checks-2026-11-03.json`
- `docs/auth-core-refresh-checks-2026-11-03.json`
- `docs/auth-core-client-helper-checks-2026-11-03.json`
- `docs/auth-core-live-sdk-check-2026-11-03.json`

## Recommended repair boundary and remaining evidence

The confirmed application helper gaps have a small local repair boundary: wait for auth readiness, reject results if the Firebase account changes, and prevent older refresh completions from overwriting a newer auth-state notification. Keep explicit sign-out, account-switch isolation and invalid/revoked credential behavior intact. These would repair the reproduced helper races; they must not be advertised as the production workflow fix without a matching trace.

For the SDK restoration mechanism, do not patch node_modules, restore raw serialized credentials manually, turn the cosmetic cookie into authentication, globally replace fetch, bypass backend checks, or keep a disabled/revoked account authenticated. Evaluate a supported SDK-level correction or bounded safe initialization strategy after confirming the affected request/error. The controlled tests and live bundle establish a possible real session-loss path; they do not justify a speculative auth architecture rewrite.

Remaining incident evidence: whether the affected live browser performs a full reload, its current-user transition and Firebase error/response status. Browser access was previously disabled; core checks do not depend on changing that setting. Incident UGC-AUTH-001 remains OPEN.

## Files and protected behavior

Only these new evidence/report files and append-only additions to `docs/ai-context/clear.md` were made in this continuation. Core application files, auth guard, Firebase initialization, dependency manifests, user work, application assets, reference media, subtitle environment, generation and scheduling logic were not changed. All new tokens/accounts are synthetic fixtures existing only inside isolated Node processes.

Source review: actual client/auth/context/guard files and callers, installed Node/browser SDK internals, previous investigation, local Next use-client guide. Context-memory/protected-contract instructions remain in force. This continuation is an audit, not a deployed fix.
