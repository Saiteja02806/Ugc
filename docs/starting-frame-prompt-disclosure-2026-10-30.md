# Starting-frame prompt disclosure — 30 October 2026

Scope: replace the always-visible prompt section with a native, initially closed details/summary control titled Starting image prompt. Its editor, application/saved prompt buttons and default preference remain mounted inside. Existing disclosure CSS is reused; no payload, prompt template, model, persistence or generation change.

Files changed for this request:
- components/explore/hook-starting-frame-workspace.tsx
- scripts/hook-starting-frame-ui.test.mjs
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- this receipt

Preflight: repository AGENTS instructions, Explore context, mistake ledger, nonnegotiables, context-memory, immutable-contracts, UI-clarity and regression-gate procedures; bundled Next use-client guide. Read-only preflight script passed. Existing unrelated Talking Head changes retained.

Verification:
- VERIFIED: 59 starting-frame UI tests pass, including initial closed disclosure structure, full editor/preferences containment, exact prompt editing/save/default/reset, loading, errors, retries and source/photo handoff regressions.
- VERIFIED: scoped ESLint and npx tsc --noEmit --pretty false pass.
- VERIFIED by diff inspection: generation handlers, identity selection, preview geometry and provider requests untouched.
- NOT TESTED: real-browser toggle/keyboard, desktop/mobile screenshots, authenticated hosted acceptance. No screenshot comparison or paid generation claimed.

Incident UGC-UI-069 records this requested follow-up to UGC-UI-063. Local implementation is checked; visual acceptance remains open. No deployment or push. Rollback boundary is the disclosure wrapper and its regression assertion; saved prompt data requires no migration.

User follow-up: the explanation, application/saved prompt actions, default checkbox and saved status are now inside a native hidden container. They remain hidden even when the prompt disclosure is expanded; the textarea and validation stay visible. No saved preferences are deleted or changed. The 59-test suite passes with added assertions for this hidden group and editor separation. Browser visual verification remains NOT TESTED.
