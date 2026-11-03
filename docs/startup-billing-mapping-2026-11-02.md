# Startup billing mapping — 2 November 2026

Scope: configure the existing Startup resolver; no application source or checkout UI changes.

Changed files: .env.local (ignored, two Startup product mappings), .env.example (two empty configuration keys), docs/ai-context/clear.md (UGC-BILL-001 evidence), this receipt.

Required production settings:
DODO_STARTUP_PLAN_MONTHLY=pdt_0Nr1EU7fTOznh7Au0qrWK
DODO_STARTUP_PLAN_YEARLY=pdt_0Nr1EcYSxhTFJs2KTD74z

Use production live-mode IDs. Keep Growth mapped to its own existing products. Apply to the production project and create a deployment using the updated environment. Already-created checkout sessions retain their original product; test a fresh session.

Preflight: tools/preflight.py completed; reviewed AGENTS billing safeguards, nonnegotiables, billing-related Explore context and ledger entries, ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate skills. Giant context/ledger files were not read in full during this audit; no application code edits were made. Next bundled env guide read. Existing user changes preserved.

VERIFIED locally: exact monthly/yearly IDs in createDodoCheckoutSession product_cart and metadata; reverse webhook mapping resolves to Startup. Actual live Dodo preview for the configured monthly ID returns USD99 with zero discount. No payment/session created by preview.

Tests: 38 tests pass across dodo.test.ts, plan-action.test.ts, plans.test.ts and checkout-account-guard.test.mjs. Two extra real-environment mocked SDK request assertions pass. git diff --check for .env.example passes. No UI changed; screenshot comparison not applicable. Static lint/build not run for environment-only changes.

NOT VERIFIED: production environment mappings (Vercel API403), fresh hosted authenticated Startup checkout, activation and real1800credit granting. UI/other plans unchanged in source; hosted behavior not retested. Existing managed subscribers continue to use the general billing portal.

Remaining: Startup annual provider priceUSD999 differs from advertisedUSD990; Starter annualUSD299 differs fromUSD290. Startup copied provider credit entitlements show1200video and1200image credits; app policy uses1800shared monthly credits. No provider changes authorized/performed for these differences. Production root cause remainsunknown, incidentOPEN.

Rollback: remove only the two local Startup entries and the two newly added example keys. Never revert unrelated existing changes or the append-only ledger.
