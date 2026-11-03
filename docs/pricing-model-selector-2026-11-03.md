# Pricing model selector — 3 November 2026

Implemented locally, not deployed. No build/dev server/browser bundling/push was started.

Scope: each paid PricingCard has an accessible native model selector in the existing monthly allowance box. Default Omni Flash; WAN 3.0 and Seedance 2.5 alternatives. Three-second and six-second quantities use the selected model and the plan monthly credit budget. Included video counts follow the same selection. Prices, monthly credits, checkout payload and billing interval controls remain unchanged. Selection is informational and does not select a generation model for the customer.

Video-only quantities (three seconds / six seconds):

| Plan | Credits | Omni Flash / WAN 3.0 | Seedance 2.5 |
| --- | ---: | --- | --- |
| Starter | 200 | 33 / 16 | 22 / 11 |
| Growth | 600 | 100 / 50 | 66 / 33 |
| Startup | 1200 | 200 / 100 | 133 / 66 |

Files changed in this UI patch:
- components/pricing/pricing-card.tsx
- lib/pricing/plans.ts
- lib/pricing/plans.test.ts
- lib/pricing/pricing-actions-render.test.mjs
- EXPLORE_CONTEXT.md (append only)
- docs/ai-context/clear.md (append only)
- docs/pricing-model-selector-2026-11-03.md

Preflight: existing AGENTS instructions and explicit no-build override; relevant EXPLORE_CONTEXT and clear ledger entries; nonnegotiables; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate; installed Next use-client guide. Preflight command log: .tmp/explore-checkout-fixes-2026-11-03/model-selector-preflight.log. Existing concurrent work preserved.

Verification: 29 pricing calculation/action/render tests PASS, including all three tiers/model rates, default selection, accessible model labels and unchanged billing-action tests. Logs: model-selector-tests.log, model-selector-types.log and model-selector-lint.log in .tmp/explore-checkout-fixes-2026-11-03/. Type/lint outcome is recorded in final completion message after command completion.

Protected prices/credits/checkout contract: VERIFIED by scoped diff and non-build pricing tests. Actual selector click/keyboard/touch and desktop/mobile screenshot acceptance: NOT TESTED for this patch because fresh browser fixture bundling is prohibited by the explicit no-build rule. Existing screenshots are requirement evidence, not proof of this implementation. Hosted acceptance: NOT VERIFIED. No payment, generation or provider action performed.

Incident: UGC-BILL-20261103-CREDIT-ALLOWANCE-CORRECTION appended with UI clarification. Pricing model values share the generation credit policy; historical jobs/receipts unchanged. Rollback boundary: this selector/calculation patch only; preserve concurrent work and prior authorized model-rate changes.


## Styled picker refinement and local acceptance

Latest implementation supersedes the native select above. The pricing-only `components/pricing/pricing-model-select.tsx` reuses the existing Popover component and installed Base UI dependency. Full-width compact trigger includes a video icon, current model and credits/second; menu has styled options, selected check, focus/keyboard navigation and Escape recovery. Omni Flash remains each card's initial state. The screenshot showing Seedance was a selected comparison state; fresh defaults are now captured explicitly before any model switching.

Additional files changed: new pricing-model-select.tsx; pricing-card.tsx integration; pricing-actions-render.test.mjs rendered-control assertions; pricing-checkout.browser.mjs responsive grid source/UTF-8 fixture headers, default/model/keyboard/selection/independence/no-billing assertions and captures. EXPLORE_CONTEXT and clear ledger append updates. No dependencies, prices, plan credits or charging logic were changed in this UI refinement.

UI status: VERIFIED in isolated real-component browser fixtures at1440x1000,390x844,320x720. All three models tested on every card; three/six-second counts and Included rows update; independent card selection; Arrow opening/End navigation, Enter selection and Escape close/reopen; no horizontal overflow or billing requests. `node scripts/pricing-checkout.browser.mjs --models-only` PASS. The original Select primitive experiment had a repeated-open failure and was replaced with the established Popover approach; final three-viewport matrix passes. Scope remains pricing-only.

Visual artifacts reviewed: .tmp/pricing-checkout-browser/default-omni-1440.png; picker-open-390.png; picker-preview-mobile.png. Fixture templates now explicitly include responsive grid classes and UTF-8 encoding. Real hosted theme/auth/integration acceptance remains separate and NOT VERIFIED. Local test-fixture builds were explicitly authorized; application builds, pushes and deployments remain prohibited.

Wider local audit:86 non-build pricing, billing, video API, description-safety and real PGlite migration tests PASS (.tmp/explore-checkout-fixes-2026-11-03/local-final-regressions.log). Video API fixture repaired to use actual model rate function and valid5secondSeedanceaudio;43APItestsPASS including explicit negative3secondaudio rejection. This adds meaningful admission-rate proof to the earlier smaller suite.

Open gates outside this picker: existing Hook build trace artifact still rejects public/explore/covers/sources/product-demo-source.mp4; no fresh application build authorized. Legacy components/characters/character-reference.test.mjs still has18failures on its obsolete composer import harness; failures preserved and not deleted or bypassed. Production Dodo descriptions and credit migration remain unapplied. Do not claim complete release readiness.

Final static receipt: TypeScript noEmit (nonincremental) PASS; scoped ESLint PASS with zero warnings/errors; scoped git diff check PASS. No application build or deployment. Current UI files: pricing-model-select.tsx and pricing-card.tsx; regression fixture/test and append-only documentation changes listed above.
