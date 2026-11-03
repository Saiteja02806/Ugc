# AI influencer verification — 3 November 2026

Result: core workflow passes local behavioral checks; complete production generation cannot yet be certified. Two existing test-contract issues were found. No application source changes or paid generations were made.

## Executed checks
- All lib/characters tests plus components/characters/influencer-studio.test.mjs:126PASS/1FAIL,127total. Command: `$characterTestPaths = @(rg --files lib/characters -g '*test.mjs' -g '*test.ts'); node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test @characterTestPaths components/characters/influencer-studio.test.mjs`.
- Actual builder hook:15/15PASS with same loader/mock/transform flags, components/characters/use-character-builder.test.mjs. Includes uncertain-request retry keys, duplicate-submission suppression, status polling recovery, account isolation, selection/cache refresh and signed-out denial.
- npm run worker:build:PASS exit0.
- node --experimental-test-module-mocks --test worker/src/jobs/generate-image.test.mjs:39/39PASS, including exact character prompts, ordered owned references, model routing, OpenRouter character jobs and ambiguous-request recovery without repeat charges.
- node --experimental-test-module-mocks --test worker/src/jobs/generate-character-image.test.mjs:FAIL before test execution due to stale mock export (below).
- Actual compiled worker module import:PASS; runGenerateImageJob is a function. No provider call made.
- node scripts/character-studio-layout.browser.mjs:PASS outside sandbox. Original shell/CTA checks at1440x1000,900x1000,390x844,320x720; four color groups at1440/390/320verify counts, rectangles, one label, mouse/Enterselection, busy lock/reset/nooverflow. Isolated real-dock fixture, not full authenticated app. Screenshots refreshed in .tmp/character-ui/.
- Current source's studio model remains Gemini3Pro; full/half framing and optional hair/head/color/reference tests pass. Palette/default changes from earlier tasks remain tested.

## Two failures and interpretation
1. lib/characters/explore-release.test.mjs:17 expects legacy getugcpilot.com route307but proxy.ts explicitly returns308for permanent public-domain migration. Current live navigation also reaches vidmake.io. This is a test expectation mismatch; it is not evidence generation fails. Preserve existing route/MCP isolation assertions when updating it.
2. worker/src/jobs/generate-character-image.test.mjs replaces image-output.js with an older mock without assertImageOutputAspectRatio, now imported by openrouter-gemini-image.js. Real worker/src/lib/image-output.ts exports it; worker build and actual module import pass. Main39-test image-worker suite also passes. Dedicated old suite remains unverified until mock maintenance; no runtime export defect established.

180 individual tests pass across the suites above; one redirect assertion and one dedicated suite import fail. Do not report an all-green complete suite.

## Hosted observations
Navigated https://www.getugcpilot.com/explore/build-character with connected Playwright browser. It redirected to https://vidmake.io/explore/build-character?moved=1, then https://vidmake.io/sign-in. Snapshot shows Google/email sign-in controls. No authenticated app session available in this browser. No login automation or paid submission performed.
Connected UGC entitlement read: Growth, active, image generation enabled,599credits available,0reserved. This proves connected-account access only, not website identity, completed character generation or deployment of the latest local edits.

## Verification boundaries
VERIFIED locally with controlled tests: access/pricing denial, ownership, invalid references, full prompt and multi-image ordering, duplicate/uncertain replay protections, generation status/recovery, save/select/history ownership, account isolation and current swatch/default behavior. Tests stub storage/providers; they do not prove hosted provider delivery.
NOT VERIFIED: signed-in production selection/upload, real provider output/identity fidelity, durable live saved identity and live download, latest local UI deployment. No successful live generation claimed. Previous types/lint checks passed in preceding implementation tasks; not freshly rerun for this read-only audit.

Preflight: context-memory/regression-gate skills reread; earlier AGENTS/nonnegotiables/UI/protected-contract reads retained. Relevant previous receipts/current source/test/proxy/mock boundary inspected. No full fresh megabyte-history read claimed. Incident UGC-TEST-20261103-CHARACTER-AUDIT added. Files written: this receipt and append-only docs/ai-context/clear.md only; app source untouched. No push/deploy/billing mutation.
