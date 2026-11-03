# Billing migration and local onboarding verification — 2 November 2026

Status: migration repaired and local isolated integration verified. Real Firebase sign-in, external analysis/queue execution and hosted acceptance are NOT VERIFIED. Nothing deployed, pushed, migrated remotely or changed in a live account.

## Scope and cause

The Startup migration closed `apply_dodo_subscription_event` with `$function$` instead of `$function$;`. The next `CREATE FUNCTION` consequently caused a parser error. The canonical migration chain failed during test setup, before any of the 17 onboarding database assertions ran. The application change is one statement terminator; billing values and onboarding behavior are unchanged.

Files changed by this task:

- `supabase/migrations/20261101233000_add_startup_billing_plan.sql`: missing separator repaired.
- `scripts/onboarding-background-db.test.mjs`: executable Starter/Growth/Startup grants and credit reservation regression added after the full canonical migration chain.
- `scripts/onboarding-local.browser.mjs`: actual local Next pages and Firebase client SDK, with isolated HTTP boundaries and canonical local SQL transitions, desktop/mobile screenshots.
- `scripts/onboarding-route-local.test.mjs`: actual onboarding route, service, Supabase client, schema validation and finalizer connected to the canonical local SQL through a test PostgREST transport.
- `docs/ai-context/clear.md`: append-only incident UGC-OPS-020 and verification.
- This receipt.

All pre-existing user/concurrent changes retained. No authentication, rollout, pricing, queue, prompt, workflow UI or global style changes.

## Preflight and boundaries

Read AGENTS.md preflight/contracts, nonnegotiables.md, relevant onboarding/auth and incident entries in EXPLORE_CONTEXT.md and clear.md, context-memory, immutable-contracts, ui-clarity and regression-gate skills, Supabase skill, and installed Next route-handler documentation. Historical context/ledger files exceed one megabyte combined; do not infer that every unrelated historical entry was re-read in this task. `python tools/preflight.py --repo . --task "Fix billing migration syntax failure and verify local sign-in to onboarding completion, screenshots, no deployment"` passed prerequisite discovery. Existing diffs and actual route/service callers were inspected.

The browser test runs against localhost only. Actual sign-in form, Firebase client SDK, AuthProvider, route navigation, AuthGuard, BackgroundBusinessOnboarding and the existing Explore page render normally. Firebase HTTP is simulated with disposable example.test users; no real account is created. Application API HTTP is handled by a local test adapter executing canonical SQL. Analysis output and finalizer completion are advanced explicitly by the harness, not by a paid model or deployed worker. The browser forces background onboarding for the test; it does not change the application's controlled rollout or prove the full legacy-mode browser journey.

The separate route integration uses the real Next GET/POST functions, onboarding services, actual Supabase client and real finalization logic. Firebase verification, external queue publication and content prebuild are replaced with test boundaries. Supabase HTTP is translated to the fresh local SQL database. It verifies unauthenticated rejection, invalid action rejection, start acceptance, persisted reload, deferred analysis dispatch intent, stale-revision rejection, identity/goals submission, finalized profile, one trial and correct timezone. This supports the browser evidence without treating a browser mock response as backend proof.

## Verification

- Canonical migration chain and onboarding database suite: **18/18 PASS**. Previously 17 cases failed in setup; repaired existing 17 cases pass. Added grants/reservations test asserts 360/720/1800 credits without changing amounts.
- Actual route/service/Supabase/local-SQL integration: **1/1 PASS**.
- Focused onboarding/access/route/UI/rollout/schema, auth/email, pricing-action and source encoding suite: **63/63 PASS**.
- TypeScript: `npx tsc --noEmit --incremental false` PASS.
- Scoped ESLint for all three touched/new scripts PASS; scoped diff whitespace check PASS.
- Desktop 1440×1000 and mobile 390×844 local browser journey: incorrect-password error; successful simulated sign-in → Explore → protected AI Studio redirects to onboarding → source form → initial read error and Retry → manual entry → progress → browser reload resumes same SQL draft → analyzed identity and default goal submitted → completion → Continue returns to Explore. Mobile additionally verifies failed URL analysis falls back to manual input. Completed profile, exact business name, Asia/Calcutta timezone and exactly one trial are asserted in SQL. Horizontal overflow is checked at each capture.
- Final browser assertion also checks that a completed persisted profile allows the protected AI Studio route after reload. AI Studio generation itself is outside this test; its other account APIs are blocked.

Browser artifacts: `.tmp/onboarding-local/desktop-*.png`, `mobile-*.png`, `evidence.json`. These are actual local application screens with the test service boundary described above, not live provider completion evidence. Source, sign-in error, manual form and desktop/mobile completion screenshots were visually inspected. No UI restyling was part of the migration repair.

Local machine issue during verification: a full C: disk interrupted one screenshot and a later dev-server request. Cleared the resolved repository `.next/cache/webpack` generated cache (about 5 GB) and the development Turbopack cache whose compaction logged a disk-write failure, restarted the dev server started by this task and reran the browser checks. Source files and evidence were preserved. An early browser attempt also clicked before sign-in hydration completed; the harness now waits for page load and hydration before interacting.

## Protected behavior and remaining acceptance

| Behavior | Status |
| --- | --- |
| Billing plan values and working SQL grants/reservations | VERIFIED locally |
| Onboarding ownership, stale writes, durable draft, duplicate protection, one trial | VERIFIED in local SQL/integration |
| Ordinary sign-in targets Explore; onboarding begins at protected workflow | VERIFIED with isolated auth transport |
| Desktop/mobile setup, load-error recovery, URL fallback, reload and completion | VERIFIED with isolated service boundaries |
| Existing UI and auth code unchanged | VERIFIED by scoped diff |
| Real Google/email authentication and delivery | NOT VERIFIED |
| Full legacy onboarding browser journey | NOT VERIFIED; existing focused contract tests pass |
| Hosted Supabase/PostgREST, external analysis, live worker and generated first ideas | NOT VERIFIED |
| Deployment or remote migration | NOT PERFORMED |

Real sign-in was requested from the user while testing continued. No password, credential or live business data was fetched or reset. Do not call these fixtures production acceptance. Rollback boundary is the one-character SQL fix and task-specific tests/docs; unrelated work is outside scope.

Additional real-flow blocker UGC-OPS-021: dev-server logs show verification delivery503. A read-only @next/env presence check confirms local RESEND_API_KEY absent; getAuthEmailConfiguration rejects that state. No real email was sent by this test harness. New-account email verification needs local email configuration; alternatively an already verified test account can be used for real sign-in acceptance. No credentials were copied and verification was not bypassed. This remains OPEN independently of the repaired migration.
