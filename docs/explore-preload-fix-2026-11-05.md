# Explore preload fix — 5 November 2026

Local implementation complete; no build or deployment. Production diagnosis/evidence is in `docs/explore-preload-warnings-2026-11-05.md`. Incident **UGC-PERF-20261105-EXPLORE-UNUSED-CSS-SERIF-PRELOAD** remains open for integrated/hosted acceptance.

## Exact changes / rollback boundary

1. `app/layout.tsx`: `brandSerif` uses `preload:false`. Original TTF, family, weight, variable, display and fallback behavior remain; normal Geist preload is unchanged.
2. `components/layout/workspace-navigation-feedback.tsx`: the existing WorkspaceLink suppresses viewport prefetch only while on `/explore` or `/explore/` and before intent on that destination. Pointer enter/down or keyboard focus restores the caller's original prefetch value. Changed href needs fresh intent; prevented events and explicit `prefetch:false` remain respected. Existing event handlers run, including authenticated workflow data/composer warmup. Other routes retain their policies. Navigation cancellation and pending/recovery UI are unchanged.
3. `components/explore/explore-workspace.tsx`: Upgrade/Sign up use the same WorkspaceLink rather than bypassing the policy with raw NextLink. Same hrefs, classes, text, conditional visibility and native anchor behavior.
4. `scripts/explore-intent-prefetch.test.mjs`: new focused callback/prefetch/route-isolation regressions.
5. `scripts/geist-preload.test.mjs`: additional real installed-font-loader test for demand-loaded serif with unchanged CSS/bytes/fallback metrics.
6. `scripts/explore-navigation-ui.test.mjs`: header-link fixture recognizes WorkspaceLink; same href/text/conditional assertions retained.
7. `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this receipt: recorded scope, decision, evidence and acceptance limits. Earlier diagnosis report is also new in this task sequence.

No dependencies, framework configuration, stylesheet, palette, typography values, card/media bytes, auth logic, catalog client, composer-loading function, provider/billing or scheduling code changed. The unrelated concurrent `scripts/onboarding-background-db.test.mjs` edit was preserved and excluded from this patch's verification claim. Rollback only the listed implementation/test hunks; do not revert shared documents wholesale.

## Why this is narrower than disabling prefetch

The live diagnostic showed11CSSpreloadwarnings plus1unusedseriffontwarning. Test-browser-only blocking of route-prefetch requests eliminated all CSS warnings, confirming the speculative-route cause. That interception is **not** shipped.

The repair keeps destination warming when the user approaches a link and leaves direct-route profile/catalog/composer overlap untouched. A hover/focus followed by no navigation can still produce a legitimate unused-resource warning. Zero warnings under every possible interaction is not promised. Initial load and next-navigation latency tradeoffs need a real candidate application benchmark; no speed improvement number is claimed.

## Preflight / contracts

Read context-memory, immutable-contracts, ui-clarity, regression-gate skills; root AGENTS and standing user no-build rule; current relevant Explore context/nonnegotiable/history entries including earlier slow-navigation and italic-preload incidents; installed Next prefetch guide; actual wrapper/callers/preload service and existing tests. `tools/preflight.py` prerequisite discovery PASS. Current ledger/context sections were refreshed; the entire large historical documents were not reread afresh in this turn.

Protected contracts: no UI/geometry changes; real href/navigation/modified-link attributes and event cancellation retained; anonymous/unverified users cannot trigger authenticated workflow reads; account-bound caches/retry/cancellation preserved; route mount warmup remains; primary regular font remains preloaded; fonts/selected source/identity/generation/scheduling untouched.

## Executed checks

- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-intent-prefetch.test.mjs scripts/geist-preload.test.mjs scripts/workflow-preload.test.mjs scripts/explore-navigation-ui.test.mjs scripts/idle-navigation-reads.test.mjs`: **42 PASS**, zero failures/skips.
- Same non-build loader with `scripts/idle-sidebar-diagnostics.mjs scripts/explore-scheduling-navigation-freshness.test.mjs`: **9 PASS**. Includes actual AuthGuard temporary-failure retention, owner-bound profile reads and scheduling cache-entry freshness; not real publishing acceptance.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint over the3appfiles and3tests: PASS.
- Targeted `git diff --check`: PASS.
- `node .tmp/explore-preload-audit/candidate-verify.cjs`: actual shared-link source rendered with React SSR before/after using a native-anchor Next boundary. **HTML identical**. Installed Next font loader's emitted CSS and actual original TTF tested in isolated Chrome at1440/390px. Initial serif requests0; explicit font demand requests1andbrandSerifloaded; zero font-preload warnings; native link geometry unchanged. Candidate screenshots and JSON reviewed/stored in `.tmp/explore-preload-audit/`. Next font loader is invoked as an isolated test, not an app/framework build; no bundles/server generated.

Font-loader test verifies byte length, identical face CSS and fallback metrics. Main component tests execute actual handlers with controlled hooks/NextLink boundary; they do not prove Next's full hydrated transport. Existing data-preload tests verify real React Query cache reuse, ownership and failure behavior with controlled API responses. Visual risk is limited by identical rendered anchor markup, identical font CSS, no app styling changes and retained original font data.

## Acceptance status

| Behavior | Status |
| --- | --- |
| Explore idle prefetch off; intent restores original policy | VERIFIED in actual-source callback tests |
| Other screens and explicit opt-out/cancel semantics unchanged | VERIFIED in tests |
| Existing auth/data/composer warming and route entry | VERIFIED in focused fixtures and unchanged-source diff |
| Serif demand-load / normal Geist preload / unchanged font CSS | VERIFIED against installed loader and isolated native browser |
| Palette/layout/labels/hrefs | No CSS/geometry edits; link SSR identical, native geometry unchanged |
| Fresh built/hydrated candidate desktop/mobile Explore | NOT TESTED — no new build authorized or started |
| Signed-in candidate click latency / hosted warning removal | NOT VERIFIED — changes remain local |
| Generation, payments and real scheduling publication | NOT TESTED; no implementation changes |

No build, devserver start, browser bundle, production setting change, push, deploy, provider generation or payment. Public production remains on the existing deployment and may continue logging the old warnings until a separately authorized build/deployment and acceptance check.
