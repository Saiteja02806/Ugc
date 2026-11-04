# Pricing checkout — 4 November 2026

Status: local reduction of avoidable checkout reads verified by focused tests. Live configuration failure confirmed; deployed correction and end-to-end latency NOT VERIFIED. No build, development server, deployment, payment, checkout session or environment mutation performed.

## Production blocker

Vercel logs show three POST /api/billing/checkout errors November 3 at 18:26:13, 18:26:17 and 18:26:51 UTC (23:56 IST):

`Conflicting Dodo product configuration: DODO_STARTUP_PLAN_MONTHLY and DODO_GROWTH_MONTHLY_PRODUCT_ID.`

Current vidmake.io alias still points to that deployment: dpl_89uyJaRSFsUgXKFCGQYtqYMVZrfj, commit 597f54cc8be1e9b816bdafe1a4b2abcb61f822ce, ready November 3 17:24:13.940 UTC. Startup Monthly/Yearly settings were edited later at 18:38:54.736/18:39:29.592 UTC. Targeted Vercel reads hide their sensitive values, so the saved correction cannot be independently confirmed. No broad decrypted environment export attempted. Editing project settings does not demonstrate that this existing deployment received them. Keep the product-uniqueness guard; it prevents selling the wrong plan.

Direct read-only Dodo product calls confirmed:

| Setting | Correct product ID | USD | Interval |
|---|---|---|---|
| DODO_GROWTH_MONTHLY_PRODUCT_ID | pdt_0NjAiCt8PWENDXfDyVeyE | 49 | Month |
| DODO_STARTUP_PLAN_MONTHLY | pdt_0Nr1EU7fTOznh7Au0qrWK | 99 | Month |
| DODO_STARTUP_PLAN_YEARLY | pdt_0Nr1EcYSxhTFJs2KTD74z | 999 | Year |

Those reads took 512/173/209 ms. They are product GET timings, not checkout-session creation timings. Initial sandbox DNS failed; the approved network read succeeded without changing provider records.

## Local change

Checkout previously called the full getUserSubscription dashboard reader and customer lookup. That waited on subscriptions, credits, social accounts, trial, entitlements and complimentary grants, plus free-credit initialization or complimentary balance reads. Only isDodoManaged was consumed.

New getBillingCheckoutAccount performs four parallel owner-scoped reads: recent subscriptions, active subscriptions, balance ownership and customer ID. It retains normalized historical plan aliases, balance-owner preference over newer cancellations, active paid account detection and held/paused/failed recovery. Any required database read error refuses checkout. It does not grant/refresh credits. No provider session is precreated on hover or page load.

Scope/files changed:

- lib/billing/subscription-db.ts: add narrow account helper; existing dashboard reader unchanged.
- app/api/billing/checkout/route.ts: consume helper, preserve response/cookie/plan/portal logic.
- lib/billing/checkout-account-read.test.mjs: new actual-reader tests using a network fixture; four-request barrier proves concurrency and rejects unrelated table/RPC work.
- lib/billing/checkout-account-guard.test.mjs: update account-reader mock and cover all three paid plans × two billing intervals.
- docs/ai-context/clear.md: append UGC-BILL-20261104-CHECKOUT-LATENCY incident and verification.
- This report.

Rollback boundary: remove this helper and restore only its checkout caller/test changes. Preserve other uncommitted work.

## Checks and limits

70 focused pricing, Dodo, account, activation and pending-checkout tests PASS; zero failures/skips. Command:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/billing/checkout-account-read.test.mjs lib/billing/checkout-account-guard.test.mjs lib/billing/dodo.test.ts lib/billing/complimentary-plan-grants.test.ts lib/pricing/*.test.ts lib/pricing/pricing-actions-render.test.mjs lib/billing/pending-checkout.test.ts lib/billing/checkout-activation-logic.test.ts
```

Log: .tmp/pricing-checkout-fix-20261104.log. Scoped ESLint and diff whitespace checks PASS. Non-emitting TypeScript result recorded below once complete. Initial read-only audit ran 40 tests before the code change, all passed.

VERIFIED by tests/diff: selected plan and monthly/yearly interval unchanged; managed subscribers use existing portal; missing customer and read failures do not create checkout; activation cookie remains intact; no automatic billing POST replay. No UI/CSS/prices/credit allowance/product settings changed. Existing client shows Opening checkout before awaiting token, bounds response/body to 30 seconds, and immediately redirects after receiving the URL. Dodo creation timeout remains 15 seconds with no automatic retries. Signed-out users still sign in first.

NOT VERIFIED: live click-to-checkout duration, provider session creation time, authenticated desktop/mobile screenshots, saved Vercel variable values or deployment containing this optimization. No promise of zero network/provider delay or a measured millisecond improvement. The production configuration error is separate and remains OPEN until verified settings reach an authorized release.

Preflight: read-only preflight PASS; git status/diff and current checkout/auth/subscription/provider callers inspected. Skills read/applied: ugc-context-memory and ugc-immutable-contracts (earlier audit), ugc-ui-clarity and ugc-regression-gate (this task). Read AGENTS, installed Next use-client guide, protected-contract context and relevant billing ledger/history. Large Explore/incident ledgers were not freshly reread in full; this receipt does not claim otherwise. No frontend behavior/layout was edited, so no new UI screenshots produced. Browser automation remains unavailable from the prior initialization failure.

Final static verification: npx tsc --noEmit --incremental false PASS (exit 0, empty .tmp/pricing-checkout-types-20261104.log). No build output emitted.
