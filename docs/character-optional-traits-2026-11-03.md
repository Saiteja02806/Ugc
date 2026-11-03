# Character optional traits — 3 November 2026

Implemented locally: first-card **Keep hairstyle**, **Keep head shape**, **Keep hair color** options using the existing No outfit renderer. New/reset selections use all three. Preservation instructions refer to the chosen character/photo, including multicolor hair; haircut and color remain independent. Explicit original preset choices remain available. Keep cards attach no replacement image.

## Scope and files
- `lib/characters/influencer-registry.ts`: three new traits, transfer default flags from Oval/Bob/Black, three default IDs. Existing preset content untouched.
- `components/characters/influencer-studio.test.mjs`: default prompt now asserts preservation instead of bob.
- `lib/characters/studio-references.test.mjs`: defaults, unique default flags, all16catalog/upload override combinations, references and pills; old asset coverage retained; saturated outfit fixture explicitly selects head/hair.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`: append-only decision/incident receipts.
- This receipt.

No changes to components/CSS, other palettes/defaults, uploaded-face handling, model, API/schema, credit reservation or provider execution. Existing uncommitted registry additions and other work preserved. Rollback only the three traits/default flags/IDs and this task's tests/docs; retain earlier changes.

## Verification
- Python preflight: PASS, all prerequisite files discoverable/readable.
- `node --experimental-strip-types --test components/characters/influencer-studio.test.mjs lib/characters/studio-references.test.mjs`:21PASS. New expectations fail before implementation. Default no bob/oval/black override; all combinations retain required references only; uploaded face supported; reference cap/full-body/half-frame/outfit regressions pass.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/generation.test.mjs lib/characters/client-session.test.ts lib/characters/access-policy.test.ts`:47PASS, controlled fixtures only. Ownership/invalid references, credit denial/replay and exact uncertain-request recovery covered.
- `npx eslint lib/characters/influencer-registry.ts`:PASS.
- `npx tsc --noEmit --incremental false`:PASS (exit0).
- `git diff --check` scoped to changed code/tests:PASS (line-ending notices only).
- Programmatic pre-task/current registry comparison: all pre-existing trait content preserved except default flags on Oval/Bob/Black; all defaults outside the requested three equal.
- Existing `node scripts/character-studio-layout.browser.mjs`: baseline four viewport checks PASS after sandbox Edge-launch failure; rerun outside sandbox succeeds.
- Temporary extended real-dock fixture `node .tmp/character-optional/check.browser.mjs`:four viewport bounds/CTA checks PASS at1440x1000,900x1000,390x844,320x720; defaults/explicit override/restore/character switch/reset/fresh reload PASS at1440/390. Upload/provider services isolated, full authenticated application not exercised. The fixture's fixed Failed to fetch text is inherited fixture content, not a live failure.
- Screenshots: `.tmp/character-optional/before/` baseline; `.tmp/character-optional/{1440,390}-{Head-Shape,Hairstyle,Hair-Color}.png` after. Inspected1440HeadShape and390Hairstyle/HairColor. Existing icon-card/blue-border/selected-label pattern retained. No new spacing or typography changes.

## Preflight sources actually read
AGENTS.md; nonnegotiables.md; context-memory, immutable-contracts, UI-clarity, video-prompt and regression-gate skill files; installed Next use-client.md; current registry/customizer/workspace/compiler/reference code and tests; existing hairstyle and contrast/overflow receipts; relevant Explore context and incident history (UGC-UI-092,095,111). The initial combined historical document read was truncated; relevant sections were read separately. No claim of freshly reading all megabyte-scale history in full.

## Protected behavior status and limits
- VERIFIED locally: independent hair/head/color selection, original trait assets, other defaults, reference roles/order/cap, reset and fresh-screen defaults; existing framing and outfit tests; unchanged model/admission/ownership/replay through tests and diff.
- VERIFIED locally: card visibility/bounds and fixed CTA at four sizes; existing No outfit rendering reused.
- NOT TESTED: authenticated production UI, full-app browser recovery/upload, actual generated identity/hair/head fidelity, loading failure UI beyond unchanged existing guards, unrelated Hook/Schedule/Carousel end-to-end flows. No trait-persistence guarantee added: studio selections already live in component state; frozen job recovery remains separate and tested.
- No paid generation, push or deployment. Status: locally verified implementation; hosted/output acceptance NOT VERIFIED.

Incident: UGC-UI-20261103-CHARACTER-OPTIONAL, local verification appended without erasing history.
