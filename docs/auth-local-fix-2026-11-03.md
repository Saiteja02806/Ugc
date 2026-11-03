# Local authentication fixes — 3 November 2026

**Locally verified. No push, deployment or hosted configuration change.** The confirmed failures are repaired locally; the exact original production incident still needs an authenticated failing-click trace.

## Changes and files

- `lib/firebase/auth.ts`: wait for `authStateReady()` before explicit user refresh. Reject a changed SDK session after reload and after token acquisition, including logout or a new same-UID session. Subscribe to `onIdTokenChanged` so same-account verification updates reach the context. Match documented auth error codes for presentation/flow decisions because nested Firebase packages can carry different FirebaseError constructors; this does not grant authorization.
- `contexts/auth-context.tsx`: remove the awaited refresh-result write into React user state. SDK notifications remain authoritative; stale completions cannot overwrite account switches, resurrect logout or regress verification.
- `package.json`: override only `@firebase/auth` to official **1.13.8**, which fixes transient startup errors deleting persisted users. Declare **Node >=24.12.0**, required by that release; local runtime is24.13.1. The Firebase umbrella stays12.15.0. Separate worker configuration remains unchanged.
- `package-lock.json`: regenerate for the override and engine declaration. Changes are confined to nested Firebase Auth and its component/logger/util dependencies. No unrelated package upgrade.
- `lib/auth/email-client.test.mjs`, `lib/auth/signup-analytics.test.mjs`: update mock observer exports to onIdTokenChanged.
- New `lib/auth/session-refresh.test.mjs`, `contexts/auth-context.test.mjs`, `lib/auth/session-sdk.test.mjs`: helper races, provider callback interleavings and installed SDK regression tests.
- This receipt and append-only notes in `docs/ai-context/clear.md` and `EXPLORE_CONTEXT.md`.

## Before/after proof

New helper/provider regression tests against unchanged application code: **8 failed,4passed**. These caught premature signed-out results before restoration; stale identity after reload/token acquisition; and provider writes overriding a newer account, explicit logout or same-account verification snapshot. All12pass after correction.

Installed SDK restoration regressions before the override: **2 failed,5passed**. Simulated500/429startup responses removed the saved fixture user. With official1.13.8all7pass, including retained persisted users on outages and removal for disabled/revoked accounts. No private SDK patch was used.

An extra SDK error-message assertion failed after upgrading because FirebaseError constructors differed. Documented auth-code matching fixes it; it passes for both Node and browser SDK builds.

## Final checks

| Check | Result |
| --- | --- |
| Comprehensive auth/email/account-isolation/server-auth/Settings suite | **70/70 PASS** |
| Published browser SDK ESM variant, controlled persistence/transport | **7/7 PASS** |
| Full `tsc --noEmit --incremental false` | **PASS** |
| Scoped ESLint on all touched source/tests | **PASS** |
| Targeted `git diff --check` | **PASS**; existing LF/CRLF notices only |
| Prior modified/untracked files checked | **446; zero missing** |

The comprehensive command expanded all `lib/auth/*.test.*` files plus `contexts/auth-context.test.mjs`, `lib/firebase/in-flight-auth-requests.test.ts`, `scripts/server-auth-deadline.test.mjs` and `lib/settings-navigation-contract.test.ts`, using Node flags `--experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/next-server-only-test-loader.mjs --test`.

For browser SDK validation, set `AUTH_SDK_BUILD=browser` and run `lib/auth/session-sdk.test.mjs` with those flags. This executes the published browser SDK with a fixture persistence adapter, not Chrome IndexedDB. The provider tests execute actual provider callbacks with a minimal React-hook harness; they are not rendered DOM tests. All account identities/tokens and SDK HTTP responses are synthetic fixtures; no production account calls occurred.

Scoped lint command: `node node_modules/eslint/bin/eslint.js contexts/auth-context.tsx contexts/auth-context.test.mjs lib/firebase/auth.ts lib/auth/session-refresh.test.mjs lib/auth/session-sdk.test.mjs lib/auth/email-client.test.mjs lib/auth/signup-analytics.test.mjs`.

## Preservation and protected behavior

**VERIFIED locally:** explicit logout; revoked/disabled credential rejection; temporary startup outage retention; same-account verification notification; API expected-account checks; account-scoped cache replacement; existing route access matrix; server auth fail-closed behavior and outage503distinction.

**VERIFIED by change scope:** no UI layout/control/CSS, workflow route, generation/prompt, scheduling, provider, database or reference-media changes by this task. Main worktree was not reset, stashed, staged or committed.

Five prior-work files changed concurrently outside this task and were retained: `docs/function-bundle-media-review-2026-11-03.md`, `docs/linux-bundle-media-verification-2026-11-03.md`, `remotion/SlideshowPromo.tsx`, `scripts/verify-slideshow-promo.test.mjs`, `scripts/check-hook-frame-bundles.mjs`. Checksum comparison is in `.tmp/auth-fix-preservation-result-20261103.json`. No pre-existing file disappeared.

**NOT TESTED:** real Google popup/redirect; actual browser IndexedDB/quota events; desktop/mobile screenshots; real long-idle recovery; authenticated production workflow click; full production build; hosted Node runtime compatibility. No production-ready or live-fixed claim. User explicitly prohibited deployment.

## Dependency/build-cost review

Applied vercel-cost-guardian in PR guard mode and reviewed actual unstaged manifests/lockfile. Read-only static audit: `.tmp/auth-fix-build-cost-audit.md`. Existing worker validation/custom-install signals are unchanged hypotheses. This patch adds no deployment trigger, build script, lifecycle script, skipped check or preview removal. Nested SDK copies can increase installed/bundled bytes; actual Vercel CPU minutes, billing and browser bundle impact are **UNKNOWN**. No savings claimed.

**Node >=24.12.0 is required before any future app preview/release.** Hosted settings were not changed. The separate worker keeps its existing Node22runtime and lockfile. A full Firebase13upgrade was avoided.

## Preflight and history

Read AGENTS engineering requirements, nonnegotiables, full ugc-context-memory / ugc-immutable-contracts / ugc-regression-gate skills, and vercel-cost-guardian; reviewed auth/idle-navigation sections from EXPLORE_CONTEXT.md and clear.md, previous investigation/core receipts, current callers/tests, installed SDK internals, and local Next use-client guide. Large historical context files were searched/section-reviewed, not claimed as fully manually reviewed. Preflight script confirmed prerequisites readable. UGC-AUTH-001 was already OPEN before implementation; local fixes and live acceptance are distinct.

The official [Firebase Auth changelog](https://github.com/firebase/firebase-js-sdk/blob/main/packages/auth/CHANGELOG.md) documents rate-limit persistence correction in1.13.7 and transient-server-error correction in1.13.8. Official npm metadata confirmed publication, dependencies and Node requirement. No node_modules source editing, global fetch interception, raw credential restoration, cosmetic-cookie authorization or weakened AuthGuard was added.

## Rollback boundary

Revert only this task's auth source hunks, two mock-export changes, Auth override/root-engine/associated lockfile changes and three added tests. Preserve all concurrent work and append-only history. Reinstall from the prior reviewed lockfile if dependencies are rolled back. That restores the old1.13.3startup failure behavior and is not a repair.
